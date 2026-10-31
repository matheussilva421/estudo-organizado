import type { OutboxOperation } from '../application/sync-types';
import type { SessionConflict } from '../domain/session-conflicts';
import {
  SessionValidationError,
  transitionSession,
  validateSession,
  type ClockObservation,
  type SessionOutcome,
  type SessionScope,
  type SessionState,
  type SessionInterval,
  type StudySession,
} from '../domain/session';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';
import { notifySessionChange } from './local-events';
import type {
  SessionAuthority,
  SessionControlRecord,
} from './session-coordination';

type Fault = 'abort' | 'quota' | null;

export type SessionRepositoryOptions = {
  fault?: Fault;
  now?: () => string;
};

export type SessionFactsPatch = Partial<
  Pick<
    StudySession,
    | 'manualDeclaredMs'
    | 'recordedAtCivilDate'
    | 'planBlockIds'
    | 'editalIds'
    | 'intervals'
    | 'planReconciliation'
    | 'measurements'
    | 'materials'
    | 'note'
    | 'allocations'
  >
>;

export type SessionFactsSnapshot = Pick<
  StudySession,
  | 'manualDeclaredMs'
  | 'recordedAtCivilDate'
  | 'planBlockIds'
  | 'editalIds'
  | 'intervals'
  | 'measurements'
  | 'materials'
  | 'note'
  | 'allocations'
  | 'planReconciliation'
  | 'tombstone'
  | 'deletedAt'
  | 'deletedReason'
>;

export type SessionAuditRecord = {
  id: string;
  profileId: string;
  sessionId: string;
  operationId: string;
  baseRevision: number;
  newRevision: number;
  mutationKind: 'EDIT_FACTS' | 'TOMBSTONE';
  previousDigest: string;
  newDigest: string;
  before: SessionFactsSnapshot;
  after: SessionFactsSnapshot;
  source: 'MEASURED' | 'MANUAL' | 'CORRECTED';
  reason?: string;
  createdAt: string;
};

export type SessionCommitInput =
  | {
      kind: 'CREATE';
      scope: SessionScope;
      sessionId: string;
      authority?: SessionAuthority;
      session: StudySession;
    }
  | {
      kind: 'TRANSITION';
      scope: SessionScope;
      sessionId: string;
      authority?: SessionAuthority;
      nextState: SessionState;
      checkpoint?: {
        intervalId: string;
        verifiedMs: number;
        checkpoint: ClockObservation;
        endedAt?: string;
      };
      newInterval?: SessionInterval;
      patchIntervals?: SessionInterval[];
    }
  | {
      kind: 'CHECKPOINT';
      scope: SessionScope;
      sessionId: string;
      authority?: SessionAuthority;
      intervalId: string;
      verifiedMs: number;
      checkpoint: ClockObservation;
    }
  | {
      kind: 'EDIT_FACTS';
      scope: SessionScope;
      sessionId: string;
      authority?: SessionAuthority;
      patch: SessionFactsPatch;
      reason?: string;
    }
  | {
      kind: 'TOMBSTONE';
      scope: SessionScope;
      sessionId: string;
      authority?: SessionAuthority;
      reason?: string;
    };

export type SessionOperationRecord = {
  operationId: string;
  profileId: string;
  entityType: 'study-session' | 'session-checkpoint';
  entityId: string;
  command: unknown;
  outcome: SessionOutcome<unknown>;
  committedAt: string;
};

export type SwitchTimerInput = {
  scope: SessionScope;
  fromSessionId: string;
  toSession: StudySession;
  authority: SessionAuthority;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function normalizeCommand(input: SessionCommitInput): Record<string, unknown> {
  const { scope, ...rest } = input;
  return {
    type: 'SESSION_COMMIT',
    profileId: scope.profileId,
    operationId: scope.operationId,
    baseRevision: scope.baseRevision,
    ...rest,
  };
}

function snapshotSession(session: StudySession): SessionFactsSnapshot {
  return {
    manualDeclaredMs: session.manualDeclaredMs,
    recordedAtCivilDate: session.recordedAtCivilDate,
    planBlockIds: [...session.planBlockIds],
    editalIds: [...session.editalIds],
    intervals: session.intervals.map((interval) => ({ ...interval })),
    measurements: session.measurements?.map((measurement) => ({ ...measurement })),
    materials: session.materials?.map((material) => ({ ...material })),
    allocations: session.allocations?.map((allocation) => ({ ...allocation })),
    note: session.note,
    planReconciliation: session.planReconciliation
      ? { ...session.planReconciliation }
      : undefined,
    tombstone: session.tombstone,
    deletedAt: session.deletedAt,
    deletedReason: session.deletedReason,
  };
}

function invalid<T = StudySession>(code: string): SessionOutcome<T> {
  return { kind: 'INVALID', code };
}

function conflict<T = StudySession>(code: string): SessionOutcome<T> {
  return { kind: 'CONFLICT', code };
}

function validationFailure<T = StudySession>(error: unknown): SessionOutcome<T> {
  if (error instanceof SessionValidationError) {
    return { kind: 'INVALID', code: error.code };
  }
  return { kind: 'FAILED', reason: 'VALIDATION' };
}

export class LocalSessionRepository {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: SessionRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async load(profileId: string, sessionId: string): Promise<StudySession | null> {
    if (
      typeof profileId !== 'string' ||
      !profileId.trim() ||
      typeof sessionId !== 'string' ||
      !sessionId.trim()
    ) {
      return null;
    }
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessions, 'readonly');
    const record = await requestResult(
      transaction.objectStore(STORES.sessions).get([profileId, sessionId]),
    );
    return (record as StudySession | undefined) ?? null;
  }

  async listByCivilDate(profileId: string, civilDate: string): Promise<StudySession[]> {
    if (
      typeof profileId !== 'string' ||
      !profileId.trim() ||
      typeof civilDate !== 'string' ||
      !civilDate.trim()
    ) {
      return [];
    }
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessions, 'readonly');
    const records = (await requestResult(
      transaction
        .objectStore(STORES.sessions)
        .index('by_profile_date')
        .getAll([profileId, civilDate]),
    )) as StudySession[];
    return records.filter((record) => record.tombstone !== true);
  }

  async listSessions(profileId: string): Promise<StudySession[]> {
    if (typeof profileId !== 'string' || !profileId.trim()) return [];
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessions, 'readonly');
    return (await requestResult(
      transaction.objectStore(STORES.sessions).index('by_profile').getAll(profileId),
    )) as StudySession[];
  }

  async listSessionRevisions(
    profileId: string,
    sessionId: string,
  ): Promise<SessionAuditRecord[]> {
    if (
      typeof profileId !== 'string' ||
      !profileId.trim() ||
      typeof sessionId !== 'string' ||
      !sessionId.trim()
    ) {
      return [];
    }
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessionAudit, 'readonly');
    const records = (await requestResult(
      transaction
        .objectStore(STORES.sessionAudit)
        .index('by_session')
        .getAll([profileId, sessionId]),
    )) as SessionAuditRecord[];
    return records.sort(
      (left, right) =>
        left.newRevision - right.newRevision ||
        left.createdAt.localeCompare(right.createdAt),
    );
  }

  async saveSessionConflict(conflict: SessionConflict): Promise<void> {
    if (
      !conflict ||
      typeof conflict.profileId !== 'string' ||
      !conflict.profileId.trim() ||
      typeof conflict.id !== 'string' ||
      !conflict.id.trim()
    ) {
      return;
    }
    const database = await openV2Database(conflict.profileId);
    const transaction = database.transaction(STORES.sessionConflicts, 'readwrite');
    transaction.objectStore(STORES.sessionConflicts).put({
      ...conflict,
      status: conflict.status ?? 'OPEN',
    });
    await transactionDone(transaction);
  }

  async listSessionConflicts(profileId: string): Promise<SessionConflict[]> {
    if (typeof profileId !== 'string' || !profileId.trim()) return [];
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessionConflicts, 'readonly');
    return (await requestResult(
      transaction
        .objectStore(STORES.sessionConflicts)
        .index('by_profile')
        .getAll(profileId),
    )) as SessionConflict[];
  }

  async resolveSessionConflict(
    profileId: string,
    conflictId: string,
    choice: 'LOCAL' | 'INCOMING' | 'KEEP_BOTH',
  ): Promise<SessionConflict | null> {
    if (!profileId.trim() || !conflictId.trim()) return null;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessionConflicts, 'readwrite');
    const store = transaction.objectStore(STORES.sessionConflicts);
    const current = (await requestResult(
      store.get([profileId, conflictId]),
    )) as SessionConflict | undefined;
    if (!current) {
      transaction.abort();
      return null;
    }
    const next: SessionConflict = {
      ...current,
      status: 'RESOLVED',
      resolution: choice,
    };
    store.put(next);
    await transactionDone(transaction);
    return next;
  }

  async commit(input: SessionCommitInput): Promise<SessionOutcome<StudySession>> {
    const scope = input?.scope;
    if (
      !scope ||
      typeof scope.profileId !== 'string' ||
      !scope.profileId.trim() ||
      typeof scope.operationId !== 'string' ||
      !scope.operationId.trim() ||
      typeof input.sessionId !== 'string' ||
      !input.sessionId.trim()
    ) {
      return invalid('INVALID_COMMAND');
    }
    if (input.kind === 'CREATE') {
      if (input.session?.id !== input.sessionId) return invalid('INVALID_IDENTIFIER');
      if (input.session?.profileId !== scope.profileId) return invalid('INVALID_PROFILE');
    }

    const command = normalizeCommand(input);
    const commandJson = stableStringify(command);
    const database = await openV2Database(scope.profileId);
    const stores: string[] = [
      STORES.sessions,
      STORES.operations,
      STORES.sessionControl,
      STORES.sessionAudit,
    ];
    if (input.kind !== 'CHECKPOINT') stores.push(STORES.outbox);
    const transaction = database.transaction(stores, 'readwrite');

    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(scope.operationId))) as
        | SessionOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== scope.profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return invalid('INVALID_OPERATION_ID_REUSED');
        }
        await transactionDone(transaction);
        return replay.outcome as SessionOutcome<StudySession>;
      }

      if (input.authority) {
        const control = (await requestResult(
          transaction.objectStore(STORES.sessionControl).get(scope.profileId),
        )) as SessionControlRecord | undefined;
        if (
          !control ||
          control.holderId !== input.authority.holderId ||
          control.sessionId !== input.authority.sessionId ||
          control.generation !== input.authority.generation
        ) {
          transaction.abort();
          return conflict('STALE_AUTHORITY');
        }
      }

      const sessions = transaction.objectStore(STORES.sessions);
      const current = (await requestResult(
        sessions.get([scope.profileId, input.sessionId]),
      )) as StudySession | undefined;

      if (input.kind === 'CREATE') {
        if (current) {
          transaction.abort();
          return conflict('SESSION_EXISTS');
        }
        if (scope.baseRevision !== null) {
          transaction.abort();
          return conflict('STALE_REVISION');
        }
        let persisted: StudySession;
        try {
          persisted = validateSession({
            ...input.session,
            id: input.sessionId,
            profileId: scope.profileId,
            localRevision: 1,
            schemaVersion: DOMAIN_SCHEMA_VERSION,
          });
        } catch (error) {
          transaction.abort();
          return validationFailure(error);
        }
        this.injectFault();
        sessions.put(persisted);
        this.putOutbox(transaction, scope, persisted, 'upsert', null);
        const outcome: SessionOutcome<StudySession> = {
          kind: 'LOCAL_COMMITTED',
          value: persisted,
        };
        this.putOperation(
          operations,
          scope,
          'study-session',
          input.sessionId,
          command,
          outcome,
        );
        await transactionDone(transaction);
        notifySessionChange(scope.profileId, input.sessionId);
        return outcome;
      }

      if (!current) {
        transaction.abort();
        return invalid('SESSION_NOT_FOUND');
      }
      if (scope.baseRevision === null || scope.baseRevision !== current.localRevision) {
        transaction.abort();
        return conflict('STALE_REVISION');
      }

      if (input.kind === 'TRANSITION') {
        let persisted: StudySession;
        try {
          let intervals = current.intervals;
          if (input.checkpoint) {
            if (
              typeof input.checkpoint.verifiedMs !== 'number' ||
              !Number.isFinite(input.checkpoint.verifiedMs) ||
              input.checkpoint.verifiedMs < 0
            ) {
              transaction.abort();
              return invalid('INVALID_DURATION');
            }
            const index = intervals.findIndex(
              (interval) => interval.id === input.checkpoint?.intervalId,
            );
            if (index < 0) {
              transaction.abort();
              return invalid('INTERVAL_NOT_FOUND');
            }
            intervals = intervals.map((interval, position) =>
              position === index
                ? {
                    ...interval,
                    verifiedMs: input.checkpoint?.verifiedMs ?? interval.verifiedMs,
                    contextId:
                      input.checkpoint?.checkpoint.contextId ?? interval.contextId,
                    checkpoint: input.checkpoint?.checkpoint ?? interval.checkpoint,
                    recoveryFlag: false,
                    endedAt: input.checkpoint?.endedAt ?? interval.endedAt,
                  }
                : interval,
            );
          }
          if (input.newInterval) {
            intervals = [...intervals, input.newInterval];
          }
          if (input.patchIntervals) {
            intervals = input.patchIntervals;
          }
          persisted = validateSession({
            ...transitionSession({ ...current, intervals }, input.nextState),
            localRevision: current.localRevision + 1,
          });
        } catch (error) {
          transaction.abort();
          return validationFailure(error);
        }
        this.injectFault();
        sessions.put(persisted);
        this.putOutbox(transaction, scope, persisted, 'upsert', current.localRevision);
        const outcome: SessionOutcome<StudySession> = {
          kind: 'LOCAL_COMMITTED',
          value: persisted,
        };
        this.putOperation(
          operations,
          scope,
          'study-session',
          input.sessionId,
          command,
          outcome,
        );
        await transactionDone(transaction);
        notifySessionChange(scope.profileId, input.sessionId);
        return outcome;
      }

      if (input.kind === 'CHECKPOINT') {
        if (
          typeof input.verifiedMs !== 'number' ||
          !Number.isFinite(input.verifiedMs) ||
          input.verifiedMs < 0
        ) {
          transaction.abort();
          return invalid('INVALID_DURATION');
        }
        const intervals = current.intervals.map((interval) => ({ ...interval }));
        const index = intervals.findIndex((interval) => interval.id === input.intervalId);
        if (index < 0) {
          transaction.abort();
          return invalid('INTERVAL_NOT_FOUND');
        }
        intervals[index] = {
          ...intervals[index]!,
          verifiedMs: input.verifiedMs,
          contextId: input.checkpoint.contextId,
          checkpoint: input.checkpoint,
          recoveryFlag: false,
        };
        let persisted: StudySession;
        try {
          persisted = validateSession({ ...current, intervals });
        } catch (error) {
          transaction.abort();
          return validationFailure(error);
        }
        this.injectFault();
        // Checkpoints are local durability only: no revision bump and no
        // outbox row. The semantic revision remains the CAS anchor.
        sessions.put(persisted);
        const outcome: SessionOutcome<StudySession> = {
          kind: 'LOCAL_COMMITTED',
          value: persisted,
        };
        this.putOperation(
          operations,
          scope,
          'session-checkpoint',
          input.sessionId,
          command,
          outcome,
        );
        await transactionDone(transaction);
        notifySessionChange(scope.profileId, input.sessionId);
        return outcome;
      }

      if (input.kind === 'EDIT_FACTS') {
        let persisted: StudySession;
        try {
          persisted = validateSession({
            ...current,
            ...input.patch,
            localRevision: current.localRevision + 1,
          });
        } catch (error) {
          transaction.abort();
          return validationFailure(error);
        }
        this.injectFault();
        sessions.put(persisted);
        this.putAudit(transaction, scope, current, persisted, 'EDIT_FACTS', input.reason);
        this.putOutbox(transaction, scope, persisted, 'upsert', current.localRevision);
        const outcome: SessionOutcome<StudySession> = {
          kind: 'LOCAL_COMMITTED',
          value: persisted,
        };
        this.putOperation(
          operations,
          scope,
          'study-session',
          input.sessionId,
          command,
          outcome,
        );
        await transactionDone(transaction);
        notifySessionChange(scope.profileId, input.sessionId);
        return outcome;
      }

      if (input.kind === 'TOMBSTONE') {
        let persisted: StudySession;
        try {
          persisted = validateSession({
            ...current,
            tombstone: true,
            deletedAt: this.now(),
            deletedReason: input.reason,
            localRevision: current.localRevision + 1,
          });
        } catch (error) {
          transaction.abort();
          return validationFailure(error);
        }
        this.injectFault();
        sessions.put(persisted);
        this.putAudit(transaction, scope, current, persisted, 'TOMBSTONE', input.reason);
        this.putOutbox(transaction, scope, persisted, 'delete', current.localRevision);
        const outcome: SessionOutcome<StudySession> = {
          kind: 'LOCAL_COMMITTED',
          value: persisted,
        };
        this.putOperation(
          operations,
          scope,
          'study-session',
          input.sessionId,
          command,
          outcome,
        );
        await transactionDone(transaction);
        notifySessionChange(scope.profileId, input.sessionId);
        return outcome;
      }

      transaction.abort();
      return invalid('INVALID_COMMAND');
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async switchTimerAtomic(
    input: SwitchTimerInput,
  ): Promise<SessionOutcome<{ from: StudySession; to: StudySession }>> {
    const scope = input?.scope;
    if (
      !scope ||
      typeof scope.profileId !== 'string' ||
      !scope.profileId.trim() ||
      typeof scope.operationId !== 'string' ||
      !scope.operationId.trim() ||
      typeof input.fromSessionId !== 'string' ||
      !input.fromSessionId.trim() ||
      !input.toSession ||
      typeof input.toSession.id !== 'string' ||
      !input.toSession.id.trim()
    ) {
      return invalid('INVALID_COMMAND');
    }
    if (input.toSession.profileId !== scope.profileId) {
      return invalid('INVALID_PROFILE');
    }
    if (input.toSession.state !== 'RUNNING') {
      return invalid('INVALID_STATE');
    }

    const command = {
      type: 'SESSION_SWITCH',
      profileId: scope.profileId,
      operationId: scope.operationId,
      baseRevision: scope.baseRevision,
      fromSessionId: input.fromSessionId,
      toSession: input.toSession,
    };
    const commandJson = stableStringify(command);
    const database = await openV2Database(scope.profileId);
    const transaction = database.transaction(
      [STORES.sessions, STORES.operations, STORES.outbox, STORES.sessionControl],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(scope.operationId))) as
        | SessionOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== scope.profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return invalid('INVALID_OPERATION_ID_REUSED');
        }
        await transactionDone(transaction);
        return replay.outcome as SessionOutcome<{ from: StudySession; to: StudySession }>;
      }

      const control = (await requestResult(
        transaction.objectStore(STORES.sessionControl).get(scope.profileId),
      )) as SessionControlRecord | undefined;
      if (
        !control ||
        control.holderId !== input.authority?.holderId ||
        control.sessionId !== input.authority?.sessionId ||
        control.generation !== input.authority?.generation
      ) {
        transaction.abort();
        return conflict('STALE_AUTHORITY');
      }

      const sessions = transaction.objectStore(STORES.sessions);
      const from = (await requestResult(
        sessions.get([scope.profileId, input.fromSessionId]),
      )) as StudySession | undefined;
      if (!from) {
        transaction.abort();
        return invalid('SESSION_NOT_FOUND');
      }
      if (from.state === 'COMPLETED' || from.state === 'CANCELLED') {
        transaction.abort();
        return invalid('INVALID_TRANSITION');
      }
      if (scope.baseRevision !== null && scope.baseRevision !== from.localRevision) {
        transaction.abort();
        return conflict('STALE_REVISION');
      }
      const existingTo = (await requestResult(
        sessions.get([scope.profileId, input.toSession.id]),
      )) as StudySession | undefined;
      if (existingTo) {
        transaction.abort();
        return conflict('SESSION_EXISTS');
      }

      let persistedFrom: StudySession;
      try {
        const paused =
          from.state === 'RUNNING' ? transitionSession(from, 'PAUSED') : from;
        persistedFrom = validateSession({
          ...paused,
          localRevision: from.localRevision + 1,
        });
      } catch (error) {
        transaction.abort();
        return validationFailure(error);
      }
      let persistedTo: StudySession;
      try {
        persistedTo = validateSession({
          ...input.toSession,
          localRevision: 1,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
        });
      } catch (error) {
        transaction.abort();
        return validationFailure(error);
      }

      sessions.put(persistedFrom);
      sessions.put(persistedTo);
      if (control) {
        transaction.objectStore(STORES.sessionControl).put({
          ...control,
          sessionId: persistedTo.id,
          updatedAt: this.now(),
        } satisfies SessionControlRecord);
      }
      this.putOutbox(transaction, scope, persistedFrom, 'upsert', from.localRevision);
      this.putOutbox(transaction, scope, persistedTo, 'upsert', null);
      const outcome: SessionOutcome<{ from: StudySession; to: StudySession }> = {
        kind: 'LOCAL_COMMITTED',
        value: { from: persistedFrom, to: persistedTo },
      };
      this.putOperation(
        operations,
        scope,
        'study-session',
        input.fromSessionId,
        command,
        outcome,
      );
      await transactionDone(transaction);
      notifySessionChange(scope.profileId, persistedFrom.id);
      notifySessionChange(scope.profileId, persistedTo.id);
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

  private injectFault(): void {
    if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
    if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');
  }

  private putOutbox(
    transaction: IDBTransaction,
    scope: SessionScope,
    session: StudySession,
    kind: 'upsert' | 'delete',
    baseRevision: number | null,
  ): void {
    const operation: OutboxOperation = {
      operationId: `${scope.operationId}~session~${session.id}`,
      profileId: scope.profileId,
      entityType: 'study-session',
      entityId: session.id,
      kind,
      baseRevision,
      payload: session,
      schemaVersion: DOMAIN_SCHEMA_VERSION,
      status: 'PENDING',
      deliveryMode: 'BLOCKED',
    };
    transaction.objectStore(STORES.outbox).put(operation);
  }

  private putAudit(
    transaction: IDBTransaction,
    scope: SessionScope,
    before: StudySession,
    after: StudySession,
    mutationKind: SessionAuditRecord['mutationKind'],
    reason?: string,
  ): void {
    const beforeSnapshot = snapshotSession(before);
    const afterSnapshot = snapshotSession(after);
    const audit: SessionAuditRecord = {
      id: `${scope.operationId}~audit`,
      profileId: scope.profileId,
      sessionId: after.id,
      operationId: scope.operationId,
      baseRevision: before.localRevision,
      newRevision: after.localRevision,
      mutationKind,
      previousDigest: stableStringify(beforeSnapshot),
      newDigest: stableStringify(afterSnapshot),
      before: beforeSnapshot,
      after: afterSnapshot,
      source: 'CORRECTED',
      reason,
      createdAt: this.now(),
    };
    transaction.objectStore(STORES.sessionAudit).put(audit);
  }

  private putOperation(
    store: IDBObjectStore,
    scope: SessionScope,
    entityType: SessionOperationRecord['entityType'],
    entityId: string,
    command: unknown,
    outcome: SessionOutcome<unknown>,
  ): void {
    store.put({
      operationId: scope.operationId,
      profileId: scope.profileId,
      entityType,
      entityId,
      command,
      outcome,
      committedAt: this.now(),
    } satisfies SessionOperationRecord);
  }
}
