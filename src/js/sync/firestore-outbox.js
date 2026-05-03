import {
  db,
  FIRESTORE_CONFLICT_STORE,
  FIRESTORE_META_STORE,
  FIRESTORE_OUTBOX_STORE,
} from '../store.js?v=8.36';

const LATEST_SNAPSHOT_ID = 'latest_snapshot';
const META_ID = 'firestore_sync';
const CONFLICT_ID = 'active_conflict';

function withTransaction(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    if (!db || !db.objectStoreNames.contains(storeName)) {
      resolve(false);
      return;
    }
    try {
      const tx = db.transaction([storeName], mode);
      const store = tx.objectStore(storeName);
      operation(store, tx, resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

function readOp(storeName, key) {
  return withTransaction(storeName, 'readonly', (store, _tx, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }).then((result) => (result === false ? null : result));
}

function writeOp(storeName, operation) {
  return withTransaction(storeName, 'readwrite', (store, tx, resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    operation(store);
  });
}

function readModifyWrite(storeName, key, modifier) {
  return withTransaction(storeName, 'readwrite', (store, tx, resolve, reject) => {
    const getRequest = store.get(key);
    getRequest.onsuccess = () => {
      try {
        const result = modifier(getRequest.result ?? null);
        if (result === null || result === false) {
          resolve(false);
          return;
        }
        const putRequest = store.put(result);
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(putRequest.error);
      } catch (err) {
        reject(err);
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function enqueueFirestoreSnapshot(envelope) {
  return writeOp(FIRESTORE_OUTBOX_STORE, (store) => {
    store.put({
      id: LATEST_SNAPSHOT_ID,
      type: 'snapshot',
      status: 'pending',
      attempts: 0,
      queuedAt: new Date().toISOString(),
      nextAttemptAt: null,
      lastError: null,
      envelope,
    });
  }).catch(() => false);
}

export async function getPendingFirestoreSnapshot() {
  return readOp(FIRESTORE_OUTBOX_STORE, LATEST_SNAPSHOT_ID);
}

export async function markFirestoreSnapshotSynced() {
  return writeOp(FIRESTORE_OUTBOX_STORE, (store) => {
    store.delete(LATEST_SNAPSHOT_ID);
  }).catch(() => false);
}

export async function markFirestoreSnapshotFailed(error) {
  return readModifyWrite(FIRESTORE_OUTBOX_STORE, LATEST_SNAPSHOT_ID, (existing) => {
    if (!existing) return false;
    const attempts = (existing.attempts || 0) + 1;
    const delayMs = Math.min(300000, 1000 * 2 ** Math.min(attempts, 8));
    return {
      ...existing,
      status: 'pending',
      attempts,
      lastError: error?.message || String(error),
      nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
    };
  }).catch(() => false);
}

export async function saveFirestoreMeta(meta) {
  return writeOp(FIRESTORE_META_STORE, (store) => {
    store.put({ id: META_ID, ...meta });
  }).catch(() => false);
}

export async function getFirestoreMeta() {
  return readOp(FIRESTORE_META_STORE, META_ID);
}

export async function saveFirestoreConflict(conflict) {
  return writeOp(FIRESTORE_CONFLICT_STORE, (store) => {
    store.put({ id: CONFLICT_ID, ...conflict });
  }).catch(() => false);
}

export async function clearFirestoreConflict() {
  return writeOp(FIRESTORE_CONFLICT_STORE, (store) => {
    store.delete(CONFLICT_ID);
  }).catch(() => false);
}
