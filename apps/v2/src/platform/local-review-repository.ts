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
  type TopicMatchDecision,
} from '../domain/review';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
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
  now?: () => string;
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
  private readonly now: () => string;

  constructor(options: ReviewRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
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
      if (input.type === 'SAVE_COMMITMENT' && !current) {
        const semantic = (await requestResult(
          transaction
            .objectStore(STORES.reviewCommitments)
            .index('by_topic')
            .getAll([scope.profileId, input.commitment.canonicalTopicKey]),
        )) as ReviewCommitment[];
        const duplicate = semantic.find(
          (item) =>
            item.status !== 'CANCELLED' &&
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
}
