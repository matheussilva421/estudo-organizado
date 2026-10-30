import {
  SessionValidationError,
  type SessionOutcome,
} from '../domain/session';
import {
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from './indexeddb';

export type SessionAuthority = {
  profileId: string;
  sessionId: string;
  holderId: string;
  generation: number;
};

export type SessionControlRecord = {
  profileId: string;
  holderId: string | null;
  sessionId: string | null;
  generation: number;
  leaseExpiresAt: string | null;
  updatedAt: string;
};

export type SessionCoordinationOptions = {
  now?: () => string;
  leaseMs?: number;
};

type AuthorityOperationRecord = {
  operationId: string;
  profileId: string;
  entityType: 'session-authority';
  entityId: string;
  command: unknown;
  outcome: SessionOutcome<SessionAuthority>;
  committedAt: string;
};

const DEFAULT_LEASE_MS = 30_000;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function invalid(code: string): SessionOutcome<SessionAuthority> {
  return { kind: 'INVALID', code };
}

function conflict(code: string): SessionOutcome<SessionAuthority> {
  return { kind: 'CONFLICT', code };
}

function required(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SessionValidationError(code, 'non-empty identifier required');
  }
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new SessionValidationError(code, 'positive integer required');
  }
  return value as number;
}

export class LocalSessionCoordinator {
  private readonly now: () => string;
  private readonly leaseMs: number;

  constructor(options: SessionCoordinationOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    if (!Number.isFinite(this.leaseMs) || this.leaseMs < 1) {
      throw new SessionValidationError('INVALID_LEASE', 'leaseMs must be positive');
    }
  }

  async getAuthority(profileId: string): Promise<SessionAuthority | null> {
    if (typeof profileId !== 'string' || !profileId.trim()) return null;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.sessionControl, 'readonly');
    const record = (await requestResult(
      transaction.objectStore(STORES.sessionControl).get(profileId),
    )) as SessionControlRecord | undefined;
    if (!record?.holderId || !record.sessionId) return null;
    return {
      profileId,
      sessionId: record.sessionId,
      holderId: record.holderId,
      generation: record.generation,
    };
  }

  async validateAuthority(authority: SessionAuthority): Promise<boolean> {
    if (!authority) return false;
    const current = await this.getAuthority(authority.profileId);
    return (
      current !== null &&
      current.sessionId === authority.sessionId &&
      current.holderId === authority.holderId &&
      current.generation === authority.generation
    );
  }

  async acquireAuthority(
    sessionId: string,
    profileId: string,
    holderId: string,
    baseRevision: number | null,
    operationId: string,
  ): Promise<SessionOutcome<SessionAuthority>> {
    try {
      required(sessionId, 'INVALID_SESSION');
      required(profileId, 'INVALID_PROFILE');
      required(holderId, 'INVALID_HOLDER');
      required(operationId, 'INVALID_OPERATION');
      if (
        baseRevision !== null &&
        (!Number.isInteger(baseRevision) || baseRevision < 1)
      ) {
        return invalid('INVALID_REVISION');
      }
    } catch (error) {
      return invalid(error instanceof SessionValidationError ? error.code : 'INVALID_COMMAND');
    }

    const command = {
      type: 'SESSION_AUTHORITY_ACQUIRE',
      profileId,
      sessionId,
      holderId,
      baseRevision,
      operationId,
    };
    const commandJson = stableStringify(command);
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.sessionControl, STORES.operations],
      'readwrite',
    );
    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(operationId))) as
        | AuthorityOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return invalid('INVALID_OPERATION_ID_REUSED');
        }
        await transactionDone(transaction);
        return replay.outcome;
      }

      const controls = transaction.objectStore(STORES.sessionControl);
      const current = (await requestResult(controls.get(profileId))) as
        | SessionControlRecord
        | undefined;

      if (current?.holderId) {
        if (current.holderId !== holderId) {
          transaction.abort();
          return conflict('AUTHORITY_HELD');
        }
        if (current.sessionId !== sessionId) {
          transaction.abort();
          return conflict('SESSION_MISMATCH');
        }
        const outcome: SessionOutcome<SessionAuthority> = {
          kind: 'LOCAL_COMMITTED',
          value: {
            profileId,
            sessionId,
            holderId,
            generation: current.generation,
          },
        };
        this.putOperation(operations, operationId, profileId, sessionId, command, outcome);
        await transactionDone(transaction);
        return outcome;
      }

      const generation = (current?.generation ?? 0) + 1;
      const now = this.now();
      const record: SessionControlRecord = {
        profileId,
        holderId,
        sessionId,
        generation,
        leaseExpiresAt: new Date(Date.parse(now) + this.leaseMs).toISOString(),
        updatedAt: now,
      };
      controls.put(record);
      const outcome: SessionOutcome<SessionAuthority> = {
        kind: 'LOCAL_COMMITTED',
        value: { profileId, sessionId, holderId, generation },
      };
      this.putOperation(operations, operationId, profileId, sessionId, command, outcome);
      await transactionDone(transaction);
      return outcome;
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
  }

  async transferAuthority(
    sessionId: string,
    profileId: string,
    fromHolderId: string,
    toHolderId: string,
    generation: number,
    operationId: string,
  ): Promise<SessionOutcome<SessionAuthority>> {
    try {
      required(sessionId, 'INVALID_SESSION');
      required(profileId, 'INVALID_PROFILE');
      required(fromHolderId, 'INVALID_HOLDER');
      required(toHolderId, 'INVALID_HOLDER');
      required(operationId, 'INVALID_OPERATION');
      positiveInteger(generation, 'INVALID_GENERATION');
    } catch (error) {
      return invalid(error instanceof SessionValidationError ? error.code : 'INVALID_COMMAND');
    }

    const command = {
      type: 'SESSION_AUTHORITY_TRANSFER',
      profileId,
      sessionId,
      fromHolderId,
      toHolderId,
      generation,
      operationId,
    };
    const commandJson = stableStringify(command);
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.sessionControl, STORES.operations],
      'readwrite',
    );
    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(operationId))) as
        | AuthorityOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return invalid('INVALID_OPERATION_ID_REUSED');
        }
        await transactionDone(transaction);
        return replay.outcome;
      }

      const controls = transaction.objectStore(STORES.sessionControl);
      const current = (await requestResult(controls.get(profileId))) as
        | SessionControlRecord
        | undefined;
      if (
        !current ||
        current.holderId !== fromHolderId ||
        current.sessionId !== sessionId ||
        current.generation !== generation
      ) {
        transaction.abort();
        return conflict('STALE_AUTHORITY');
      }

      const now = this.now();
      const nextGeneration = current.generation + 1;
      controls.put({
        ...current,
        holderId: toHolderId,
        generation: nextGeneration,
        leaseExpiresAt: new Date(Date.parse(now) + this.leaseMs).toISOString(),
        updatedAt: now,
      } satisfies SessionControlRecord);
      const outcome: SessionOutcome<SessionAuthority> = {
        kind: 'LOCAL_COMMITTED',
        value: {
          profileId,
          sessionId,
          holderId: toHolderId,
          generation: nextGeneration,
        },
      };
      this.putOperation(operations, operationId, profileId, sessionId, command, outcome);
      await transactionDone(transaction);
      return outcome;
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
  }

  async releaseAuthority(
    sessionId: string,
    profileId: string,
    holderId: string,
    generation: number,
    operationId: string,
  ): Promise<SessionOutcome<SessionAuthority>> {
    try {
      required(sessionId, 'INVALID_SESSION');
      required(profileId, 'INVALID_PROFILE');
      required(holderId, 'INVALID_HOLDER');
      required(operationId, 'INVALID_OPERATION');
      positiveInteger(generation, 'INVALID_GENERATION');
    } catch (error) {
      return invalid(error instanceof SessionValidationError ? error.code : 'INVALID_COMMAND');
    }

    const command = {
      type: 'SESSION_AUTHORITY_RELEASE',
      profileId,
      sessionId,
      holderId,
      generation,
      operationId,
    };
    const commandJson = stableStringify(command);
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.sessionControl, STORES.operations],
      'readwrite',
    );
    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(operationId))) as
        | AuthorityOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return invalid('INVALID_OPERATION_ID_REUSED');
        }
        await transactionDone(transaction);
        return replay.outcome;
      }

      const controls = transaction.objectStore(STORES.sessionControl);
      const current = (await requestResult(controls.get(profileId))) as
        | SessionControlRecord
        | undefined;
      if (
        !current ||
        current.holderId !== holderId ||
        current.sessionId !== sessionId ||
        current.generation !== generation
      ) {
        transaction.abort();
        return conflict('STALE_AUTHORITY');
      }

      const now = this.now();
      const nextGeneration = current.generation + 1;
      controls.put({
        ...current,
        holderId: null,
        sessionId: null,
        generation: nextGeneration,
        leaseExpiresAt: null,
        updatedAt: now,
      } satisfies SessionControlRecord);
      const outcome: SessionOutcome<SessionAuthority> = {
        kind: 'LOCAL_COMMITTED',
        value: {
          profileId,
          sessionId,
          holderId,
          generation: nextGeneration,
        },
      };
      this.putOperation(operations, operationId, profileId, sessionId, command, outcome);
      await transactionDone(transaction);
      return outcome;
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
  }

  private putOperation(
    store: IDBObjectStore,
    operationId: string,
    profileId: string,
    entityId: string,
    command: unknown,
    outcome: SessionOutcome<SessionAuthority>,
  ): void {
    store.put({
      operationId,
      profileId,
      entityType: 'session-authority',
      entityId,
      command,
      outcome,
      committedAt: this.now(),
    } satisfies AuthorityOperationRecord);
  }
}
