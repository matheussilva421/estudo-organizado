import type { OutboxOperation } from '../application/sync-types';
import type { ProfileRecord } from '../application/profile-service';
import { LOCAL_DB_VERSION } from '../domain/versions';
import { UPGRADE_BLOCKED_MESSAGE, upgradeV2Schema } from './content-migration';
import { canDeliver } from './sync/delivery-policy';

export const DB_NAME = 'estudo-organizado-v2';

export const STORES = {
  subjects: 'subjects',
  outbox: 'outbox',
  operations: 'operations',
  profiles: 'profiles',
  meta: 'meta',
  conflicts: 'conflicts',
  editais: 'editais',
  editalDisciplines: 'edital_disciplines',
  assuntos: 'assuntos',
  aulas: 'aulas',
  lessonTopicLinks: 'lesson_topic_links',
  tombstones: 'tombstones',
  quarantine: 'quarantine',
  importReceipts: 'import_receipts',
  planningScenarios: 'planning_scenarios',
  planningBlocks: 'planning_blocks',
  planningDrafts: 'planning_drafts',
  planningCheckpoints: 'planning_checkpoints',
  planningPriorityProfiles: 'planning_priority_profiles',
  planningAvailability: 'planning_availability',
  planningImports: 'planning_imports',
} as const;

export type LocalPersistenceKind = 'QUOTA' | 'ABORT' | 'UNAVAILABLE' | 'BLOCKED_UPGRADE';

export class LocalPersistenceError extends Error {
  readonly kind: LocalPersistenceKind;
  readonly recoverable: boolean;

  constructor(kind: LocalPersistenceKind, message: string, recoverable: boolean) {
    super(message);
    this.name = 'LocalPersistenceError';
    this.kind = kind;
    this.recoverable = recoverable;
  }
}

export function toLocalPersistenceError(error: unknown): LocalPersistenceError {
  if (error instanceof LocalPersistenceError) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'VersionError') {
    return new LocalPersistenceError(
      'BLOCKED_UPGRADE',
      `${UPGRADE_BLOCKED_MESSAGE}: indexeddb schema version is ahead`,
      false,
    );
  }
  if (name === 'QuotaExceededError') {
    return new LocalPersistenceError('QUOTA', 'storage quota exceeded', true);
  }
  if (name === 'AbortError') {
    return new LocalPersistenceError('ABORT', 'indexeddb transaction aborted', true);
  }
  return new LocalPersistenceError('UNAVAILABLE', 'indexeddb unavailable', false);
}

let cachedDatabase: Promise<IDBDatabase> | null = null;

export type DatabaseUpgradeKind = 'IDLE' | 'READY' | 'BLOCKED_UPGRADE' | 'FAILED';

export type DatabaseUpgradeState = {
  kind: DatabaseUpgradeKind;
  blocked: boolean;
  version: number;
};

let upgradeState: DatabaseUpgradeState = {
  kind: 'IDLE',
  blocked: false,
  version: LOCAL_DB_VERSION,
};

const upgradeListeners = new Set<(state: DatabaseUpgradeState) => void>();

function publishUpgradeState(next: DatabaseUpgradeState): void {
  upgradeState = next;
  for (const listener of [...upgradeListeners]) {
    try {
      listener(next);
    } catch {
      // A rendering listener must not break the database lifecycle.
    }
  }
}

export function getDatabaseUpgradeState(): DatabaseUpgradeState {
  return upgradeState;
}

export function subscribeDatabaseUpgrade(
  listener: (state: DatabaseUpgradeState) => void,
): () => void {
  upgradeListeners.add(listener);
  return () => {
    upgradeListeners.delete(listener);
  };
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new DOMException('aborted', 'AbortError'));
  });
}

export function openV2Database(profileId: string): Promise<IDBDatabase> {
  if (typeof profileId !== 'string' || !profileId.trim()) {
    return Promise.reject(new LocalPersistenceError('UNAVAILABLE', 'profileId is required', false));
  }
  if (cachedDatabase) return cachedDatabase;

  const pending: Promise<IDBDatabase> = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, LOCAL_DB_VERSION);
    } catch (error) {
      reject(toLocalPersistenceError(error));
      return;
    }
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) {
        throw new LocalPersistenceError('UNAVAILABLE', 'indexeddb upgrade has no transaction', false);
      }
      upgradeV2Schema(request.result, event.oldVersion, transaction);
    };
    request.onsuccess = () => {
      const database = request.result;
      // An older tab must release the database when a newer schema is opened in
      // another tab; otherwise the upgrade stays blocked forever.
      database.onversionchange = () => {
        database.close();
        if (cachedDatabase === pending) cachedDatabase = null;
        publishUpgradeState({ kind: 'IDLE', blocked: false, version: database.version });
      };
      // A browser-forced close must not leave a dead connection in the cache.
      database.onclose = () => {
        if (cachedDatabase === pending) cachedDatabase = null;
        publishUpgradeState({ kind: 'IDLE', blocked: false, version: database.version });
      };
      publishUpgradeState({ kind: 'READY', blocked: false, version: database.version });
      resolve(database);
    };
    request.onerror = () => {
      cachedDatabase = null;
      publishUpgradeState({ kind: 'FAILED', blocked: false, version: LOCAL_DB_VERSION });
      reject(toLocalPersistenceError(request.error));
    };
    // Keep the request alive: the browser completes it as soon as the tab that
    // holds the previous version closes or releases the connection. The state
    // is published so the UI can explain the block without destroying data.
    request.onblocked = () => {
      publishUpgradeState({ kind: 'BLOCKED_UPGRADE', blocked: true, version: LOCAL_DB_VERSION });
    };
  });

  cachedDatabase = pending;
  // A synchronous throw or an early rejection must not poison the cache.
  void pending.catch(() => {
    if (cachedDatabase === pending) cachedDatabase = null;
  });
  return pending;
}

const CACHED_CLOSE_TIMEOUT_MS = 2_000;

async function releaseCachedDatabase(): Promise<void> {
  const pending = cachedDatabase;
  cachedDatabase = null;
  if (!pending) return;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), CACHED_CLOSE_TIMEOUT_MS));
  const database = await Promise.race([pending.catch(() => null), timeout]);
  if (database) {
    database.close();
    return;
  }
  // A blocked open settles only when the other tab releases it; close late.
  void pending.then((late) => late.close()).catch(() => undefined);
}

export async function deleteV2DatabaseForTests(): Promise<void> {
  await releaseCachedDatabase();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  publishUpgradeState({ kind: 'IDLE', blocked: false, version: LOCAL_DB_VERSION });
}

export async function getPendingOutbox(profileId: string): Promise<OutboxOperation[]> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readonly');
  const index = transaction.objectStore(STORES.outbox).index('by_profile_status');
  return requestResult(index.getAll([profileId, 'PENDING'])) as Promise<OutboxOperation[]>;
}

const UNDELIVERABLE_STATES = new Set(['LOCAL_ONLY', 'PAUSED_AUTH', 'PAUSED_QUOTA', 'RECOVERY_REQUIRED']);

/**
 * Pending operations whose backoff window elapsed. A paused profile returns an
 * empty list so the UI never spins on auth/quota failures.
 */
export async function getEligibleOutbox(
  profileId: string,
  now: number,
): Promise<OutboxOperation[]> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction([STORES.outbox, STORES.profiles], 'readonly');
  const profile = (await requestResult(
    transaction.objectStore(STORES.profiles).get(profileId),
  )) as ProfileRecord | undefined;
  // Fail closed: without a consented profile nothing may leave the device.
  if (!profile) return [];
  if (UNDELIVERABLE_STATES.has(profile.state)) return [];

  const pending = (await requestResult(
    transaction.objectStore(STORES.outbox).index('by_profile_status').getAll([profileId, 'PENDING']),
  )) as OutboxOperation[];
  return pending
    .filter((operation) => {
    const next = operation.nextRetryAt;
    const due = next === null || next === undefined || (Number.isFinite(next) && next <= now);
    if (!due) return false;
    return canDeliver(
      operation,
      {
        operationId: operation.operationId,
        profileId: operation.profileId,
        deliveryUid: operation.deliveryUid ?? null,
        remoteLibraryId: operation.remoteLibraryId ?? null,
        attempts: operation.attempts ?? 0,
        nextRetryAt: operation.nextRetryAt ?? null,
      },
      profile,
    );
    })
    .sort((left, right) => {
      // Causal order first (sequence), then a stable tiebreaker.
      const leftSequence = left.sequence ?? 0;
      const rightSequence = right.sequence ?? 0;
      if (leftSequence !== rightSequence) return leftSequence - rightSequence;
      return left.operationId < right.operationId ? -1 : left.operationId > right.operationId ? 1 : 0;
    });
}

/** Monotonic per-profile sequence used for causal delivery order. */
export async function nextSequence(
  profileId: string,
  transaction: IDBTransaction,
): Promise<number> {
  const key = `sequence:${profileId}`;
  const store = transaction.objectStore(STORES.meta);
  const record = (await requestResult(store.get(key))) as { value?: number } | undefined;
  const next = (record?.value ?? 0) + 1;
  store.put({ key, value: next });
  return next;
}

export async function applyRetryPlan(
  profileId: string,
  failures: readonly { operationId: string; attempts: number; nextRetryAt: number | null }[],
): Promise<void> {
  if (failures.length === 0) return;
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readwrite');
  const store = transaction.objectStore(STORES.outbox);
  try {
    for (const failure of failures) {
      if (
        !Number.isInteger(failure.attempts) ||
        failure.attempts < 1 ||
        (failure.nextRetryAt !== null && !Number.isFinite(failure.nextRetryAt))
      ) {
        continue;
      }
      const operation = (await requestResult(store.get(failure.operationId))) as
        | OutboxOperation
        | undefined;
      if (!operation || operation.profileId !== profileId) continue;
      if (operation.status !== 'PENDING') continue;
      store.put({
        ...operation,
        attempts: Math.max(operation.attempts ?? 0, failure.attempts),
        nextRetryAt: failure.nextRetryAt,
      });
    }
    await transactionDone(transaction);
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    throw toLocalPersistenceError(error);
  }
}

export type ConfirmedProof = Record<string, number>;

export async function markConfirmed(
  profileId: string,
  operationIds: string[],
  proof: ConfirmedProof,
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readwrite');
  const store = transaction.objectStore(STORES.outbox);

  try {
    for (const operationId of operationIds) {
      const operation = (await requestResult(store.get(operationId))) as
        | OutboxOperation
        | undefined;
      const remoteRevision = proof[operationId];
      if (
        !operation ||
        operation.profileId !== profileId ||
        typeof remoteRevision !== 'number' ||
        !Number.isInteger(remoteRevision) ||
        remoteRevision < 1 ||
        operation.status !== 'PENDING'
      ) {
        transaction.abort();
        throw new LocalPersistenceError('UNAVAILABLE', 'ACK without a known operation', false);
      }
      store.put({ ...operation, status: 'CONFIRMED', remoteRevision });
    }
    await transactionDone(transaction);
  } catch (error) {
    throw toLocalPersistenceError(error);
  }
}

export async function markConflict(
  profileId: string,
  operation: OutboxOperation,
  remoteRevision: number,
  remote?: { payload: unknown | null; deleted: boolean },
): Promise<void> {
  if (
    operation.profileId !== profileId ||
    operation.status === 'CONFIRMED' ||
    !Number.isInteger(remoteRevision) ||
    remoteRevision < 1
  ) {
    throw new LocalPersistenceError('UNAVAILABLE', 'conflict outside the profile scope', false);
  }
  const database = await openV2Database(profileId);
  const transaction = database.transaction([STORES.outbox, STORES.conflicts], 'readwrite');
  const outbox = transaction.objectStore(STORES.outbox);
  const conflicts = transaction.objectStore(STORES.conflicts);

  try {
    const persisted = (await requestResult(outbox.get(operation.operationId))) as
      | OutboxOperation
      | undefined;
    if (
      !persisted ||
      persisted.profileId !== profileId ||
      persisted.entityId !== operation.entityId ||
      persisted.status !== 'PENDING'
    ) {
      transaction.abort();
      throw new LocalPersistenceError(
        'UNAVAILABLE',
        'conflict requires a persisted pending operation',
        false,
      );
    }
    outbox.put({ ...persisted, status: 'CONFLICT' });
    conflicts.put({
      conflictId: operation.operationId,
      profileId,
      operationId: operation.operationId,
      entityType: persisted.entityType,
      entityId: persisted.entityId,
      localPayload: persisted.payload,
      remotePayload: remote?.payload ?? null,
      baseRevision: persisted.baseRevision,
      remoteRevision,
      deleted: remote?.deleted === true,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });
    await transactionDone(transaction);
  } catch (error) {
    throw toLocalPersistenceError(error);
  }
}

export type PersistedConflict = {
  conflictId: string;
  profileId: string;
  operationId: string;
  entityType: string;
  entityId: string;
  localPayload: unknown;
  remotePayload: unknown | null;
  baseRevision: number | null;
  remoteRevision: number;
  deleted: boolean;
  status: 'OPEN' | 'RESOLVED';
  resolution?: 'LOCAL' | 'REMOTE';
  resolvedByOperationId?: string;
  createdAt: string;
};

export async function resolveConflictRecord(
  profileId: string,
  conflictId: string,
  patch: Partial<Pick<PersistedConflict, 'status' | 'resolution' | 'resolvedByOperationId'>>,
): Promise<PersistedConflict | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.conflicts, 'readwrite');
  const store = transaction.objectStore(STORES.conflicts);
  try {
    const current = (await requestResult(store.get(conflictId))) as PersistedConflict | undefined;
    if (!current || current.profileId !== profileId) {
      transaction.abort();
      return null;
    }
    const next = { ...current, ...patch };
    store.put(next);
    await transactionDone(transaction);
    return next;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    throw toLocalPersistenceError(error);
  }
}

export async function annotateRemoteBaseRevision(
  profileId: string,
  operationId: string,
  remoteBaseRevision: number,
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readwrite');
  const store = transaction.objectStore(STORES.outbox);
  try {
    const operation = (await requestResult(store.get(operationId))) as OutboxOperation | undefined;
    if (!operation || operation.profileId !== profileId) {
      transaction.abort();
      throw new LocalPersistenceError('UNAVAILABLE', 'operation is not in this profile', false);
    }
    store.put({ ...operation, remoteBaseRevision });
    await transactionDone(transaction);
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    throw toLocalPersistenceError(error);
  }
}

export async function getConflicts(profileId: string): Promise<PersistedConflict[]> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.conflicts, 'readonly');
  const index = transaction.objectStore(STORES.conflicts).index('by_profile');
  return requestResult(index.getAll(profileId)) as Promise<PersistedConflict[]>;
}
