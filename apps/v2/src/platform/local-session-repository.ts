import type { OutboxOperation } from '../application/sync-types';
import {
  SessionValidationError,
  transitionSession,
  validateSession,
  type ClockObservation,
  type SessionOutcome,
  type SessionScope,
  type SessionState,
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
    'manualDeclaredMs' | 'recordedAtCivilDate' | 'planBlockIds' | 'editalIds' | 'intervals'
  >
>;

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
  outcome: SessionOutcome<StudySession>;
  committedAt: string;
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

function invalid(code: string): SessionOutcome<StudySession> {
  return { kind: 'INVALID', code };
}

function conflict(code: string): SessionOutcome<StudySession> {
  return { kind: 'CONFLICT', code };
}

function validationFailure(error: unknown): SessionOutcome<StudySession> {
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
    const stores: string[] = [STORES.sessions, STORES.operations, STORES.sessionControl];
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
        return replay.outcome;
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
          persisted = validateSession({
            ...transitionSession(current, input.nextState),
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

  private putOperation(
    store: IDBObjectStore,
    scope: SessionScope,
    entityType: SessionOperationRecord['entityType'],
    entityId: string,
    command: unknown,
    outcome: SessionOutcome<StudySession>,
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
