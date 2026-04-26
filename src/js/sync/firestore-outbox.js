import { db, FIRESTORE_CONFLICT_STORE, FIRESTORE_META_STORE, FIRESTORE_OUTBOX_STORE } from '../store.js?v=8.19';

const LATEST_SNAPSHOT_ID = 'latest_snapshot';
const META_ID = 'firestore_sync';
const CONFLICT_ID = 'active_conflict';

function getObjectStore(storeName, mode = 'readonly') {
  if (!db || !db.objectStoreNames.contains(storeName)) return null;
  const tx = db.transaction([storeName], mode);
  return tx.objectStore(storeName);
}

function requestToPromise(request, fallback = undefined) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? fallback);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueFirestoreSnapshot(envelope) {
  const store = getObjectStore(FIRESTORE_OUTBOX_STORE, 'readwrite');
  if (!store) return false;
  const record = {
    id: LATEST_SNAPSHOT_ID,
    type: 'snapshot',
    status: 'pending',
    attempts: 0,
    queuedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: null,
    envelope
  };
  await requestToPromise(store.put(record));
  return true;
}

export async function getPendingFirestoreSnapshot() {
  const store = getObjectStore(FIRESTORE_OUTBOX_STORE, 'readonly');
  if (!store) return null;
  return await requestToPromise(store.get(LATEST_SNAPSHOT_ID), null);
}

export async function markFirestoreSnapshotSynced() {
  const store = getObjectStore(FIRESTORE_OUTBOX_STORE, 'readwrite');
  if (!store) return false;
  await requestToPromise(store.delete(LATEST_SNAPSHOT_ID));
  return true;
}

export async function markFirestoreSnapshotFailed(error) {
  const pending = await getPendingFirestoreSnapshot();
  if (!pending) return false;
  const attempts = (pending.attempts || 0) + 1;
  const delayMs = Math.min(300000, 1000 * (2 ** Math.min(attempts, 8)));
  const store = getObjectStore(FIRESTORE_OUTBOX_STORE, 'readwrite');
  if (!store) return false;
  await requestToPromise(store.put({
    ...pending,
    status: 'pending',
    attempts,
    lastError: error?.message || String(error),
    nextAttemptAt: new Date(Date.now() + delayMs).toISOString()
  }));
  return true;
}

export async function saveFirestoreMeta(meta) {
  const store = getObjectStore(FIRESTORE_META_STORE, 'readwrite');
  if (!store) return false;
  await requestToPromise(store.put({ id: META_ID, ...meta }));
  return true;
}

export async function getFirestoreMeta() {
  const store = getObjectStore(FIRESTORE_META_STORE, 'readonly');
  if (!store) return null;
  return await requestToPromise(store.get(META_ID), null);
}

export async function saveFirestoreConflict(conflict) {
  const store = getObjectStore(FIRESTORE_CONFLICT_STORE, 'readwrite');
  if (!store) return false;
  await requestToPromise(store.put({ id: CONFLICT_ID, ...conflict }));
  return true;
}

export async function clearFirestoreConflict() {
  const store = getObjectStore(FIRESTORE_CONFLICT_STORE, 'readwrite');
  if (!store) return false;
  await requestToPromise(store.delete(CONFLICT_ID));
  return true;
}
