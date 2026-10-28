import type { OutboxOperation } from '../application/sync-types';
import { LOCAL_DB_VERSION } from '../domain/versions';

export const DB_NAME = 'estudo-organizado-v2';

export const STORES = {
  subjects: 'subjects',
  outbox: 'outbox',
  operations: 'operations',
  profiles: 'profiles',
  meta: 'meta',
  conflicts: 'conflicts',
} as const;

export type LocalPersistenceKind = 'QUOTA' | 'ABORT' | 'UNAVAILABLE';

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
  if (name === 'QuotaExceededError') {
    return new LocalPersistenceError('QUOTA', 'storage quota exceeded', true);
  }
  if (name === 'AbortError') {
    return new LocalPersistenceError('ABORT', 'indexeddb transaction aborted', true);
  }
  return new LocalPersistenceError('UNAVAILABLE', 'indexeddb unavailable', false);
}

let cachedDatabase: Promise<IDBDatabase> | null = null;

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

function upgrade(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(STORES.subjects)) {
    const subjects = database.createObjectStore(STORES.subjects, { keyPath: ['profileId', 'id'] });
    subjects.createIndex('by_profile', 'profileId', { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.outbox)) {
    const outbox = database.createObjectStore(STORES.outbox, { keyPath: 'operationId' });
    outbox.createIndex('by_profile_status', ['profileId', 'status'], { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.operations)) {
    const operations = database.createObjectStore(STORES.operations, { keyPath: 'operationId' });
    operations.createIndex('by_profile', 'profileId', { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.profiles)) {
    database.createObjectStore(STORES.profiles, { keyPath: 'profileId' });
  }
  if (!database.objectStoreNames.contains(STORES.meta)) {
    database.createObjectStore(STORES.meta, { keyPath: 'key' });
  }
  if (!database.objectStoreNames.contains(STORES.conflicts)) {
    const conflicts = database.createObjectStore(STORES.conflicts, { keyPath: 'conflictId' });
    conflicts.createIndex('by_profile', 'profileId', { unique: false });
  }
}

export function openV2Database(profileId: string): Promise<IDBDatabase> {
  if (typeof profileId !== 'string' || !profileId.trim()) {
    return Promise.reject(new LocalPersistenceError('UNAVAILABLE', 'profileId is required', false));
  }
  if (cachedDatabase) return cachedDatabase;

  cachedDatabase = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      cachedDatabase = null;
      reject(toLocalPersistenceError(request.error));
    };
    request.onblocked = () => {
      cachedDatabase = null;
      reject(new LocalPersistenceError('UNAVAILABLE', 'indexeddb upgrade blocked', false));
    };
  });

  return cachedDatabase;
}

export async function deleteV2DatabaseForTests(): Promise<void> {
  if (cachedDatabase) {
    const database = await cachedDatabase.catch(() => null);
    database?.close();
    cachedDatabase = null;
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export async function getPendingOutbox(profileId: string): Promise<OutboxOperation[]> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readonly');
  const index = transaction.objectStore(STORES.outbox).index('by_profile_status');
  return requestResult(index.getAll([profileId, 'PENDING'])) as Promise<OutboxOperation[]>;
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
      if (!operation || operation.profileId !== profileId || typeof remoteRevision !== 'number') {
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
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction([STORES.outbox, STORES.conflicts], 'readwrite');
  const outbox = transaction.objectStore(STORES.outbox);
  const conflicts = transaction.objectStore(STORES.conflicts);

  try {
    outbox.put({ ...operation, status: 'CONFLICT' });
    conflicts.put({
      conflictId: operation.operationId,
      profileId,
      operationId: operation.operationId,
      localPayload: operation.payload,
      remoteRevision,
      createdAt: new Date().toISOString(),
    });
    await transactionDone(transaction);
  } catch (error) {
    throw toLocalPersistenceError(error);
  }
}
