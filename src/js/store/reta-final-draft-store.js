import { RETA_FINAL_DRAFT_STORE } from './indexeddb.js';

export { RETA_FINAL_DRAFT_STORE };

function transactionError(event, transaction) {
  if (event?.target?.error) return event.target.error;
  if (transaction?.error) return transaction.error;
  const error = new Error('Transação IndexedDB abortada.');
  error.name = 'AbortError';
  return error;
}
function requireDatabase(database) {
  if (!database || typeof database.transaction !== 'function') {
    throw new TypeError('Instância IndexedDB indisponível.');
  }
}
function runTransaction(database, mode, action) {
  try {
    requireDatabase(database);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error('Falha na transação IndexedDB.'));
    };
    try {
      transaction = database.transaction([RETA_FINAL_DRAFT_STORE], mode);
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      transaction.onerror = (event) =>
        fail(transactionError(event, transaction));
      transaction.onabort = (event) =>
        fail(transactionError(event, transaction));
      result = action(
        transaction.objectStore(RETA_FINAL_DRAFT_STORE),
        transaction,
        fail,
      );
    } catch (error) {
      fail(error);
    }
  });
}

/** Loads a draft (or null) after the readonly transaction completes. */
export function loadRetaFinalDraft(database, draftId) {
  return runTransaction(database, 'readonly', (store, _transaction, fail) => {
    const holder = { value: null };
    const request = store.get(draftId);
    request.onsuccess = () => {
      holder.value = request.result ?? null;
    };
    request.onerror = (event) => fail(transactionError(event));
    return holder;
  }).then((holder) => holder.value);
}

/** Saves one local draft; success is reported only after transaction completion. */
export function saveRetaFinalDraft(database, draft) {
  if (!draft || typeof draft.draftId !== 'string' || !draft.draftId.trim()) {
    return Promise.reject(new TypeError('Rascunho inválido.'));
  }
  return runTransaction(database, 'readwrite', (store) => {
    store.put(draft);
    return draft;
  });
}

/** Removes only the requested draft after transaction completion. */
export function discardRetaFinalDraft(database, draftId) {
  return runTransaction(database, 'readwrite', (store) => {
    store.delete(draftId);
    return true;
  });
}
