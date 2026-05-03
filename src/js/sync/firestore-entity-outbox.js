import { db, FIRESTORE_ENTITY_OUTBOX_STORE } from '../store.js?v=8.32';
import {
  createFirestoreEntityDocument,
  createFirestoreTombstoneDocument,
} from './firestore-entity-schema.js?v=8.32';
import { createEntityIndex } from './entity-metadata.js?v=8.32';

export const FIRESTORE_ENTITY_OUTBOX_ID = 'entity_shadow';
const MAX_BACKOFF_MS = 300000;
const MAX_BACKOFF_EXPONENT = 8;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getEntityByKey(state, key) {
  const active = createEntityIndex(state);
  const match = active.find((item) => item.key === key);
  if (!match) return null;
  const segments = key.split('/');
  if (match.collection === 'editais')
    return (state.editais || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'eventos')
    return (state.eventos || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'arquivo')
    return (state.arquivo || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'revisoes')
    return (state.revisoes || []).find((item) => item.id === match.id) || null;
  if (match.collection.startsWith('habitos.')) {
    const type = match.collection.split('.')[1];
    return (state.habitos?.[type] || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'planejamento.sequencia') {
    return (state.planejamento?.sequencia || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'disciplinas') {
    const edital = (state.editais || []).find((item) => item.id === segments[1]);
    return (edital?.disciplinas || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'assuntos' || match.collection === 'aulas') {
    const edital = (state.editais || []).find((item) => item.id === segments[1]);
    const disciplina = (edital?.disciplinas || []).find((item) => item.id === segments[3]);
    const list = match.collection === 'assuntos' ? disciplina?.assuntos : disciplina?.aulas;
    return (list || []).find((item) => item.id === match.id) || null;
  }
  return null;
}

export async function queueFirestoreEntityBatchFromState(state, options = {}) {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return null;
  const schemaVersion = state.schemaVersion || 9;
  const sentAt = options.sentAt || new Date().toISOString();
  const activeDocs = createEntityIndex(state)
    .map((item) =>
      createFirestoreEntityDocument({
        key: item.key,
        collection: item.collection,
        id: item.id,
        entity: getEntityByKey(state, item.key),
        schemaVersion,
        sentAt,
      })
    )
    .filter((item) => item.payload);
  const tombstoneDocs = (state.config?.entityTombstones || []).map((tombstone) =>
    createFirestoreTombstoneDocument({
      tombstone,
      schemaVersion,
      sentAt,
    })
  );
  const record = {
    id: FIRESTORE_ENTITY_OUTBOX_ID,
    status: 'pending',
    attempts: 0,
    queuedAt: sentAt,
    nextAttemptAt: null,
    lastError: null,
    docs: [...activeDocs, ...tombstoneDocs],
  };

  const tx = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readwrite');
  const store = tx.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
  const existing = await requestToPromise(store.get(FIRESTORE_ENTITY_OUTBOX_ID));
  if (existing && existing.status === 'pending') {
    record.attempts = existing.attempts || 0;
    record.nextAttemptAt = existing.nextAttemptAt;
  }
  await requestToPromise(store.put(record));
  return record;
}

export async function getPendingFirestoreEntityBatch() {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return null;
  const tx = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readonly');
  const store = tx.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
  return requestToPromise(store.get(FIRESTORE_ENTITY_OUTBOX_ID));
}

export async function markFirestoreEntityBatchSynced() {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return false;
  const tx = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readwrite');
  const store = tx.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
  const current = await requestToPromise(store.get(FIRESTORE_ENTITY_OUTBOX_ID));
  if (!current) return false;
  await requestToPromise(
    store.put({
      ...current,
      status: 'synced',
      syncedAt: new Date().toISOString(),
    })
  );
  return true;
}

export async function markFirestoreEntityBatchFailed(error) {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return false;
  const tx = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readwrite');
  const store = tx.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
  const current = await requestToPromise(store.get(FIRESTORE_ENTITY_OUTBOX_ID));
  if (!current) return false;
  const attempts = (current.attempts || 0) + 1;
  const delayMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts, MAX_BACKOFF_EXPONENT));
  await requestToPromise(
    store.put({
      ...current,
      status: 'pending',
      attempts,
      lastError: error?.message || String(error),
      nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
    })
  );
  return true;
}

export function canRetryEntityBatch(batch, now = Date.now()) {
  if (!batch || batch.status !== 'pending') return false;
  if (!batch.nextAttemptAt) return true;
  return new Date(batch.nextAttemptAt).getTime() <= now;
}
