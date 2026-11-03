import type { OutboxEntityType, OutboxPayload } from '../application/sync-types';
import {
  ReviewValidationError,
  stableStringify,
  validateReviewPolicy,
  validateReviewTopicLink,
  type BoardEvidence,
  type ContextPriorityProjection,
  type ReviewCommitment,
  type ReviewExecution,
  type ReviewPolicy,
  type ReviewScope,
  type ReviewTopicLink,
  type ReviewOutcome,
  type MaterializedReviewProjection,
  type ReviewReminderSettings,
  type TopicMatchDecision,
  validateReviewReminderSettings,
} from '../domain/review';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import { isCivilDate } from '../domain/planning-time';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';

type Fault = 'abort' | 'quota' | null;

export type ReviewRepositoryOptions = {
  fault?: Fault;
  /** Test-only injection: fail immediately before the Nth new import row. */
  importFaultAfter?: number;
  now?: () => string;
};

export type ReviewImportPayload = {
  topics?: ReviewTopicLink[];
  policies?: ReviewPolicy[];
  commitments?: ReviewCommitment[];
  executions?: ReviewExecution[];
  board?: BoardEvidence[];
  matches?: TopicMatchDecision[];
  priorities?: ContextPriorityProjection[];
};

export type ReviewImportReceipt = {
  applied: number;
  duplicate: number;
  receiptId: string;
};

export type ReviewCommitInput =
  | { type: 'SAVE_TOPIC'; scope: ReviewScope; topic: ReviewTopicLink }
  | { type: 'SAVE_POLICY'; scope: ReviewScope; policy: ReviewPolicy }
  | { type: 'SAVE_COMMITMENT'; scope: ReviewScope; commitment: ReviewCommitment }
  | {
      type: 'SAVE_EXECUTION';
      scope: ReviewScope;
      execution: ReviewExecution;
      commitment?: ReviewCommitment | null;
      commitmentBaseRevision?: number | null;
    }
  | { type: 'SAVE_BOARD'; scope: ReviewScope; evidence: BoardEvidence }
  | { type: 'SAVE_MATCH'; scope: ReviewScope; match: TopicMatchDecision }
  | { type: 'SAVE_PRIORITY'; scope: ReviewScope; priority: ContextPriorityProjection };

type OperationRecord = {
  operationId: string;
  profileId: string;
  entityType: string;
  entityId: string;
  command: unknown;
  outcome: ReviewOutcome<unknown>;
  committedAt: string;
};

function normalizeCommand(input: ReviewCommitInput): Record<string, unknown> {
  const { scope, type, ...rest } = input;
  return {
    type: 'REVIEW_COMMIT',
    commandType: type,
    profileId: scope.profileId,
    operationId: scope.operationId,
    baseRevision: scope.baseRevision ?? null,
    ...rest,
  };
}

function entityTypeOf(value: ReviewCommitInput): OutboxEntityType {
  switch (value.type) {
    case 'SAVE_TOPIC': return 'review-topic';
    case 'SAVE_POLICY': return 'review-policy';
    case 'SAVE_COMMITMENT': return 'review-commitment';
    case 'SAVE_EXECUTION': return 'review-execution';
    case 'SAVE_BOARD': return 'review-board-evidence';
    case 'SAVE_MATCH': return 'review-match';
    case 'SAVE_PRIORITY': return 'review-priority';
  }
}

function valueOf(value: ReviewCommitInput): { store: string; entityId: string; value: unknown } {
  switch (value.type) {
    case 'SAVE_TOPIC': return { store: STORES.reviewTopics, entityId: value.topic.id, value: value.topic };
    case 'SAVE_POLICY': return { store: STORES.reviewPolicies, entityId: value.policy.id, value: value.policy };
    case 'SAVE_COMMITMENT': return { store: STORES.reviewCommitments, entityId: value.commitment.id, value: value.commitment };
    case 'SAVE_EXECUTION': return { store: STORES.reviewExecutions, entityId: value.execution.id, value: value.execution };
    case 'SAVE_BOARD': return { store: STORES.reviewBoardEvidence, entityId: value.evidence.id, value: value.evidence };
    case 'SAVE_MATCH': return { store: STORES.reviewMatches, entityId: value.match.id, value: value.match };
    case 'SAVE_PRIORITY': return { store: STORES.reviewPriorities, entityId: value.priority.id, value: value.priority };
  }
}

function withRevision(value: unknown, revision: number): unknown {
  return { ...(value as Record<string, unknown>), localRevision: revision };
}

export class LocalReviewRepository {
  private readonly fault: Fault;
  private readonly importFaultAfter: number | null;
  private readonly now: () => string;

  constructor(options: ReviewRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.importFaultAfter =
      typeof options.importFaultAfter === 'number' && Number.isInteger(options.importFaultAfter)
        ? options.importFaultAfter
        : null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private injectFault(): void {
    if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
    if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');
  }

  async getOperation(operationId: string): Promise<{ command: unknown; outcome: ReviewOutcome<unknown> } | null> {
    if (!operationId.trim()) return null;
    const database = await openV2Database('operation-probe');
    const transaction = database.transaction(STORES.operations, 'readonly');
    const record = (await requestResult(
      transaction.objectStore(STORES.operations).get(operationId),
    )) as OperationRecord | undefined;
    return record ? { command: record.command, outcome: record.outcome } : null;
  }

  async commit(input: ReviewCommitInput): Promise<ReviewOutcome<unknown>> {
    const scope = input?.scope;
    if (
      !scope ||
      typeof scope.profileId !== 'string' ||
      !scope.profileId.trim() ||
      typeof scope.operationId !== 'string' ||
      !scope.operationId.trim()
    ) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }
    let primary: ReturnType<typeof valueOf>;
    try {
      primary = valueOf(input);
      if (input.type === 'SAVE_POLICY') validateReviewPolicy(input.policy);
      if (input.type === 'SAVE_TOPIC') validateReviewTopicLink(input.topic);
    } catch (error) {
      if (error instanceof ReviewValidationError) return { kind: 'INVALID', code: error.code };
      return { kind: 'FAILED', reason: 'VALIDATION' };
    }
    const entityProfile = (primary.value as { profileId?: unknown }).profileId;
    if (entityProfile !== scope.profileId) {
      return { kind: 'INVALID', code: 'PROFILE_MISMATCH' };
    }
    const command = normalizeCommand(input);
    const commandJson = stableStringify(command);
    const database = await openV2Database(scope.profileId);
    const stores = [primary.store, STORES.operations, STORES.outbox];
    if (input.type === 'SAVE_EXECUTION' && input.commitment) stores.push(STORES.reviewCommitments);
    const transaction = database.transaction(stores, 'readwrite');
    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(scope.operationId))) as OperationRecord | undefined;
      if (replay) {
        if (replay.profileId !== scope.profileId || stableStringify(replay.command) !== commandJson) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return replay.outcome as ReviewOutcome<unknown>;
      }
      const store = transaction.objectStore(primary.store);
      const current = (await requestResult(
        store.get([scope.profileId, primary.entityId]),
      )) as { localRevision?: number } | undefined;
      const baseRevision = scope.baseRevision ?? null;
      if (current && baseRevision !== current.localRevision) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'STALE_REVISION' };
      }
      if (!current && baseRevision !== null && baseRevision !== undefined) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'STALE_REVISION' };
      }
      if (input.type === 'SAVE_COMMITMENT') {
        const semantic = (await requestResult(
          transaction
            .objectStore(STORES.reviewCommitments)
            .index('by_topic')
            .getAll([scope.profileId, input.commitment.canonicalTopicKey]),
        )) as ReviewCommitment[];
        const duplicate = semantic.find(
          (item) =>
            item.id !== input.commitment.id &&
            item.status !== 'CANCELLED' &&
            item.status !== 'FULFILLED' &&
            item.currentDueDate === input.commitment.currentDueDate,
        );
        if (duplicate) {
          transaction.abort();
          return { kind: 'CONFLICT', code: 'DUPLICATE_COMMITMENT' };
        }
      }
      const revision = (current?.localRevision ?? 0) + 1;
      const persisted = withRevision(primary.value, revision);
      let persistedCommitment: ReviewCommitment | null = null;
      this.injectFault();
      store.put(persisted);
      const outbox = transaction.objectStore(STORES.outbox);
      const putOutbox = (entityType: OutboxEntityType, entityId: string, value: unknown, base: number | null, suffix: string): void => {
        outbox.put({
          operationId: `${scope.operationId}~${suffix}`,
          profileId: scope.profileId,
          entityType,
          entityId,
          kind: 'upsert',
          baseRevision: base,
          payload: value as OutboxPayload,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
      };
      putOutbox(entityTypeOf(input), primary.entityId, persisted, current?.localRevision ?? null, `${entityTypeOf(input)}~${primary.entityId}`);
      if (input.type === 'SAVE_EXECUTION' && input.commitment) {
        const commitmentStore = transaction.objectStore(STORES.reviewCommitments);
        const existingCommitment = (await requestResult(
          commitmentStore.get([scope.profileId, input.commitment.id]),
        )) as ReviewCommitment | undefined;
        const expectedBase = input.commitmentBaseRevision ?? null;
        if (!existingCommitment || existingCommitment.localRevision !== expectedBase) {
          transaction.abort();
          return { kind: 'CONFLICT', code: 'STALE_REVISION' };
        }
        const commitmentRevision = (existingCommitment?.localRevision ?? 0) + 1;
        persistedCommitment = withRevision(input.commitment, commitmentRevision) as ReviewCommitment;
        commitmentStore.put(persistedCommitment);
        putOutbox('review-commitment', persistedCommitment.id, persistedCommitment, existingCommitment?.localRevision ?? null, `review-commitment~${persistedCommitment.id}`);
      }
      const outcome: ReviewOutcome<unknown> =
        input.type === 'SAVE_EXECUTION' && input.commitment
          ? { kind: 'LOCAL_COMMITTED', value: { execution: persisted, commitment: persistedCommitment } }
          : { kind: 'LOCAL_COMMITTED', value: persisted };
      operations.put({
        operationId: scope.operationId,
        profileId: scope.profileId,
        entityType: entityTypeOf(input),
        entityId: primary.entityId,
        command,
        outcome,
        committedAt: this.now(),
      } satisfies OperationRecord);
      await transactionDone(transaction);
      return outcome;
    } catch (error) {
      try { transaction.abort(); } catch { /* already aborted */ }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  /**
   * Publishes an entire F5 academic package in one IndexedDB transaction.
   *
   * Every entity, outbox row, receipt and replay record is written together;
   * a quota, abort or validation error rolls the whole transaction back. The
   * operation record is only written after all rows succeed, so a retry with
   * the same operationId is either an exact replay or a clean first attempt.
   */
  async commitImport(input: {
    profileId: string;
    operationId: string;
    data: ReviewImportPayload;
  }): Promise<ReviewOutcome<ReviewImportReceipt>> {
    const profileId = input?.profileId;
    const operationId = input?.operationId;
    if (
      typeof profileId !== 'string' ||
      !profileId.trim() ||
      typeof operationId !== 'string' ||
      !operationId.trim() ||
      !input.data ||
      typeof input.data !== 'object'
    ) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }
    const data = input.data;
    const invalid = validateImportPayload(profileId, data);
    if (invalid) return { kind: 'INVALID', code: invalid };

    const digest = stableStringify(data);
    const command = {
      type: 'REVIEW_IMPORT',
      profileId,
      operationId,
      digest,
    };
    const database = await openV2Database(profileId);
    const stores = [
      STORES.reviewTopics,
      STORES.reviewPolicies,
      STORES.reviewCommitments,
      STORES.reviewExecutions,
      STORES.reviewBoardEvidence,
      STORES.reviewMatches,
      STORES.reviewPriorities,
      STORES.operations,
      STORES.outbox,
      STORES.importReceipts,
    ];
    const transaction = database.transaction(stores, 'readwrite');
    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(operationId))) as
        | OperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== profileId ||
          stableStringify(replay.command) !== stableStringify(command)
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return replay.outcome as ReviewOutcome<ReviewImportReceipt>;
      }

      const outbox = transaction.objectStore(STORES.outbox);
      let applied = 0;
      let duplicate = 0;

      const putOutbox = (entityType: OutboxEntityType, entityId: string, value: unknown, suffix: string): void => {
        outbox.put({
          operationId: `${operationId}~import~${suffix}`,
          profileId,
          entityType,
          entityId,
          kind: 'upsert',
          baseRevision: null,
          payload: value as OutboxPayload,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
      };

      const putNew = (
        storeName: string,
        entityType: OutboxEntityType,
        entity: { id: string },
      ): void => {
        if (this.importFaultAfter !== null && this.importFaultAfter === applied + 1) {
          this.injectFault();
        }
        const persisted = withRevision(entity, 1);
        transaction.objectStore(storeName).put(persisted);
        putOutbox(entityType, entity.id, persisted, `${entityType}~${entity.id}`);
        applied += 1;
      };

      const importRows = async <T extends { id: string }>(
        rows: T[] | undefined,
        storeName: string,
        entityType: OutboxEntityType,
        validate: (row: T) => boolean,
      ): Promise<ReviewOutcome<null> | null> => {
        const seen = new Set<string>();
        for (const row of rows ?? []) {
          if (!validate(row)) {
            transaction.abort();
            return { kind: 'INVALID', code: 'IMPORT_INVALID_DATA' };
          }
          if (seen.has(row.id)) {
            transaction.abort();
            return { kind: 'INVALID', code: 'IMPORT_DUPLICATE_ID' };
          }
          seen.add(row.id);
          const store = transaction.objectStore(storeName);
          const existing = (await requestResult(
            store.get([profileId, row.id]),
          )) as T | undefined;
          if (existing) {
            if (!sameImportedValue(existing, row)) {
              transaction.abort();
              return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
            }
            duplicate += 1;
            continue;
          }
          putNew(storeName, entityType, row);
        }
        return null;
      };

      const failure =
        (await importRows(data.topics, STORES.reviewTopics, 'review-topic', isValidTopic)) ??
        (await importRows(data.policies, STORES.reviewPolicies, 'review-policy', isValidPolicy)) ??
        (await importRows(
          data.commitments,
          STORES.reviewCommitments,
          'review-commitment',
          isValidCommitment,
        )) ??
        (await importRows(
          data.executions,
          STORES.reviewExecutions,
          'review-execution',
          isValidExecution,
        )) ??
        (await importRows(
          data.board,
          STORES.reviewBoardEvidence,
          'review-board-evidence',
          isValidBoardEvidence,
        )) ??
        (await importRows(
          data.matches,
          STORES.reviewMatches,
          'review-match',
          isValidMatch,
        )) ??
        (await importRows(
          data.priorities,
          STORES.reviewPriorities,
          'review-priority',
          isValidPriority,
        ));
      if (failure) return failure as ReviewOutcome<ReviewImportReceipt>;

      const semanticFailure = await this.assertImportedCommitmentsUnique(
        transaction,
        profileId,
        data.commitments ?? [],
      );
      if (semanticFailure) return semanticFailure;

      const outcome: ReviewOutcome<ReviewImportReceipt> = {
        kind: 'LOCAL_COMMITTED',
        value: { applied, duplicate, receiptId: operationId },
      };
      transaction.objectStore(STORES.importReceipts).put({
        profileId,
        importId: operationId,
        kind: 'F5_ACADEMIC_DATA',
        digest,
        applied,
        duplicate,
        committedAt: this.now(),
      });
      operations.put({
        operationId,
        profileId,
        entityType: 'review-import',
        entityId: operationId,
        command,
        outcome,
        committedAt: this.now(),
      } satisfies OperationRecord);
      await transactionDone(transaction);
      return outcome;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  private async assertImportedCommitmentsUnique(
    transaction: IDBTransaction,
    profileId: string,
    imported: ReviewCommitment[],
  ): Promise<ReviewOutcome<ReviewImportReceipt> | null> {
    const active = imported.filter(
      (item) => item.status !== 'CANCELLED' && item.status !== 'FULFILLED',
    );
    const keys = new Set<string>();
    for (const item of active) {
      const key = `${item.canonicalTopicKey}::${item.currentDueDate}`;
      if (keys.has(key)) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'DUPLICATE_COMMITMENT' };
      }
      keys.add(key);
      const existing = (await requestResult(
        transaction
          .objectStore(STORES.reviewCommitments)
          .index('by_topic')
          .getAll([profileId, item.canonicalTopicKey]),
      )) as ReviewCommitment[];
      const duplicate = existing.find(
        (candidate) =>
          candidate.id !== item.id &&
          candidate.status !== 'CANCELLED' &&
          candidate.status !== 'FULFILLED' &&
          candidate.currentDueDate === item.currentDueDate,
      );
      if (duplicate) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'DUPLICATE_COMMITMENT' };
      }
    }
    return null;
  }

  async load<T>(profileId: string, storeName: string, id: string): Promise<T | null> {
    if (!profileId.trim() || !id.trim()) return null;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(storeName, 'readonly');
    return ((await requestResult(
      transaction.objectStore(storeName).get([profileId, id]),
    )) as T | undefined) ?? null;
  }

  async list<T>(profileId: string, storeName: string): Promise<T[]> {
    if (!profileId.trim()) return [];
    const database = await openV2Database(profileId);
    const transaction = database.transaction(storeName, 'readonly');
    return (await requestResult(
      transaction.objectStore(storeName).index('by_profile').getAll(profileId),
    )) as T[];
  }

  listTopics(profileId: string): Promise<ReviewTopicLink[]> {
    return this.list<ReviewTopicLink>(profileId, STORES.reviewTopics);
  }

  listCommitments(profileId: string): Promise<ReviewCommitment[]> {
    return this.list<ReviewCommitment>(profileId, STORES.reviewCommitments);
  }

  listExecutions(profileId: string): Promise<ReviewExecution[]> {
    return this.list<ReviewExecution>(profileId, STORES.reviewExecutions);
  }

  listPolicies(profileId: string): Promise<ReviewPolicy[]> {
    return this.list<ReviewPolicy>(profileId, STORES.reviewPolicies);
  }

  listBoardEvidence(profileId: string): Promise<BoardEvidence[]> {
    return this.list<BoardEvidence>(profileId, STORES.reviewBoardEvidence);
  }

  listMatches(profileId: string): Promise<TopicMatchDecision[]> {
    return this.list<TopicMatchDecision>(profileId, STORES.reviewMatches);
  }

  listPriorities(profileId: string): Promise<ContextPriorityProjection[]> {
    return this.list<ContextPriorityProjection>(profileId, STORES.reviewPriorities);
  }

  async loadProjection(
    profileId: string,
    id: string,
  ): Promise<MaterializedReviewProjection | null> {
    return this.load<MaterializedReviewProjection>(profileId, STORES.reviewProjections, id);
  }

  async listProjections(profileId: string): Promise<MaterializedReviewProjection[]> {
    return this.list<MaterializedReviewProjection>(profileId, STORES.reviewProjections);
  }

  /**
   * CAS publication. An older generation can never overwrite a newer one,
   * even when both were computed from the same starting snapshot.
   */
  async publishProjection(input: {
    record: MaterializedReviewProjection;
    expectedGenerationId: string | null;
    expectedFingerprint: string | null;
  }): Promise<ReviewOutcome<MaterializedReviewProjection>> {
    const profileId = input?.record?.profileId;
    if (!isValidIdentifier(profileId) || !isValidIdentifier(input.record.id)) {
      return { kind: 'INVALID', code: 'INVALID_PROJECTION' };
    }
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.reviewProjections, 'readwrite');
    try {
      const store = transaction.objectStore(STORES.reviewProjections);
      const current = (await requestResult(
        store.get([profileId, input.record.id]),
      )) as MaterializedReviewProjection | undefined;
      const currentGeneration = current?.generationId ?? null;
      const currentFingerprint = current?.fingerprint ?? null;
      if (
        currentGeneration !== input.expectedGenerationId ||
        currentFingerprint !== input.expectedFingerprint
      ) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'STALE_GENERATION' };
      }
      store.put(input.record);
      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: input.record };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async getReminderSettings(profileId: string): Promise<ReviewReminderSettings | null> {
    if (!profileId.trim()) return null;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.reviewSettings, 'readonly');
    const record = (await requestResult(
      transaction.objectStore(STORES.reviewSettings).get(profileId),
    )) as ReviewReminderSettings | undefined;
    return record ?? null;
  }

  async saveReminderSettings(input: {
    settings: ReviewReminderSettings;
    expectedRevision: number | null;
  }): Promise<ReviewOutcome<ReviewReminderSettings>> {
    let settings: ReviewReminderSettings;
    try {
      settings = validateReviewReminderSettings(input.settings);
    } catch (error) {
      return {
        kind: 'INVALID',
        code:
          error instanceof ReviewValidationError
            ? error.code
            : 'INVALID_REMINDER_SETTINGS',
      };
    }
    const database = await openV2Database(settings.profileId);
    const transaction = database.transaction(STORES.reviewSettings, 'readwrite');
    try {
      const store = transaction.objectStore(STORES.reviewSettings);
      const current = (await requestResult(
        store.get(settings.profileId),
      )) as ReviewReminderSettings | undefined;
      const currentRevision = current?.localRevision ?? null;
      if (currentRevision !== input.expectedRevision) {
        transaction.abort();
        return { kind: 'CONFLICT', code: 'STALE_SETTINGS' };
      }
      const next = {
        ...settings,
        localRevision: (current?.localRevision ?? 0) + 1,
      };
      store.put(next);
      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: next };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  /**
   * Cross-tab notification lease. Two tabs share IndexedDB, so the read/mark
   * sequence is serialized by a single readwrite transaction. BroadcastChannel
   * is never used as a lock. A denied claim returns false without writing.
   */
  async claimNotification(profileId: string, key: string, at: string): Promise<boolean> {
    if (!profileId.trim() || !key.trim() || !at.trim()) return false;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.reviewSettings, 'readwrite');
    try {
      const store = transaction.objectStore(STORES.reviewSettings);
      const current = (await requestResult(
        store.get(profileId),
      )) as ReviewReminderSettings | undefined;
      if (!current || !current.externalNotifications) {
        await transactionDone(transaction);
        return false;
      }
      if (current.notificationLeases[key]) {
        await transactionDone(transaction);
        return false;
      }
      const leases = { ...current.notificationLeases, [key]: at };
      const entries = Object.entries(leases).sort((left, right) =>
        left[1].localeCompare(right[1]),
      );
      const cutoff = Date.parse(at) - 90 * 24 * 60 * 60_000;
      const bounded = Object.fromEntries(
        entries.filter(([, timestamp]) => {
          const parsed = Date.parse(timestamp);
          return !Number.isFinite(parsed) || parsed >= cutoff;
        }),
      );
      store.put({
        ...current,
        notificationLeases: bounded,
        lastNotification: { key, at },
        localRevision: current.localRevision + 1,
      });
      await transactionDone(transaction);
      return true;
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return false;
    }
  }
}

function validateImportPayload(profileId: string, data: ReviewImportPayload): string | null {
  for (const key of [
    'topics',
    'policies',
    'commitments',
    'executions',
    'board',
    'matches',
    'priorities',
  ] as const) {
    const value = data[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return 'IMPORT_INVALID_DATA';
    for (const item of value) {
      if (!item || typeof item !== 'object') return 'IMPORT_INVALID_DATA';
      if ((item as { profileId?: unknown }).profileId !== profileId) {
        return 'PROFILE_MISMATCH';
      }
    }
  }
  return null;
}

function isValidIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTopic(value: ReviewTopicLink): boolean {
  try {
    validateReviewTopicLink(value);
    return true;
  } catch {
    return false;
  }
}

function isValidPolicy(value: ReviewPolicy): boolean {
  try {
    validateReviewPolicy(value);
    return true;
  } catch {
    return false;
  }
}

function isValidCommitment(value: ReviewCommitment): boolean {
  return (
    isValidIdentifier(value.id) &&
    isValidIdentifier(value.canonicalTopicKey) &&
    isCivilDate(value.originalDueDate) &&
    isCivilDate(value.currentDueDate) &&
    ['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'].includes(value.status) &&
    Array.isArray(value.history)
  );
}

function isValidExecution(value: ReviewExecution): boolean {
  return (
    isValidIdentifier(value.id) &&
    isValidIdentifier(value.canonicalTopicKey) &&
    isCivilDate(value.civilDate) &&
    ['FORGOT', 'PARTIAL', 'GOOD', 'UNRATED'].includes(value.assessment) &&
    ['FULL', 'PARTIAL', 'UNKNOWN'].includes(value.coverage)
  );
}

function isValidBoardEvidence(value: BoardEvidence): boolean {
  return (
    isValidIdentifier(value.id) &&
    ['QUANTITATIVE', 'QUALITATIVE', 'PREFERENCE'].includes(value.kind) &&
    typeof value.text === 'string' &&
    value.text.length <= 20_000 &&
    Number.isInteger(value.version) &&
    value.version > 0
  );
}

function isValidMatch(value: TopicMatchDecision): boolean {
  return (
    isValidIdentifier(value.id) &&
    isValidIdentifier(value.evidenceId) &&
    isValidIdentifier(value.canonicalTopicKey) &&
    ['ACCEPTED', 'REJECTED', 'PENDING'].includes(value.decision) &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score)
  );
}

function isValidPriority(value: ContextPriorityProjection): boolean {
  return (
    isValidIdentifier(value.id) &&
    isValidIdentifier(value.editalId) &&
    typeof value.fingerprint === 'string' &&
    Array.isArray(value.rows)
  );
}

function sameImportedValue(left: unknown, right: unknown): boolean {
  const strip = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const copy = { ...(value as Record<string, unknown>) };
    delete copy.localRevision;
    return copy;
  };
  return stableStringify(strip(left)) === stableStringify(strip(right));
}
