// =============================================
// CREDENTIALS MANAGEMENT (IndexedDB)
// =============================================
// Armazena credenciais de sync separadamente do estado exportável.
// Previne exfiltração de tokens via backup/exportação.
// Se IndexedDB estiver indisponível, operações falham explicitamente
// em vez de fallback para localStorage (risco XSS).

import { debugLog } from './debug.js?v=8.37';

const CREDS_DB_NAME = 'EstudoCredenciaisDB';
const CREDS_DB_VERSION = 1;
const CREDS_STORE_NAME = 'credentials';

let credsDb = null;
let _initPromise = null;
let _indexedDBAvailable = typeof indexedDB !== 'undefined';

/**
 * Inicializa banco de dados de credenciais
 * @returns {Promise<IDBDatabase>}
 */
export function initCredentialsDB() {
  if (!_indexedDBAvailable)
    return Promise.reject(
      new Error('IndexedDB indisponível - credenciais não podem ser armazenadas com segurança.')
    );
  if (_initPromise) return _initPromise;
  if (credsDb) return Promise.resolve(credsDb);

  _initPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(CREDS_DB_NAME, CREDS_DB_VERSION);
    } catch (err) {
      _initPromise = null;
      _indexedDBAvailable = false;
      reject(err);
      return;
    }

    request.onerror = (event) => {
      _initPromise = null;
      _indexedDBAvailable = false;
      reject(event.target.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CREDS_STORE_NAME)) {
        db.createObjectStore(CREDS_STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      credsDb = event.target.result;
      resolve(credsDb);
    };
  });

  return _initPromise;
}

/**
 * Armazena credencial de forma isolada
 * @param {string} key - Chave da credencial (ex: 'cloudflare', 'drive')
 * @param {object} value - Objeto da credencial
 * @returns {Promise<void>}
 */
export async function setCredential(key, value) {
  debugLog('credentials', '[Credentials] setCredential START:', {
    key,
    hasValue: !!value,
    valueKeys: value ? Object.keys(value) : null,
    valueUrl: value?.url ? `${value.url.substring(0, 30)}...` : null,
    valueHasToken: !!value?.token,
    valueEnabled: value?.enabled,
  });

  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.put(value, key);

    req.onsuccess = () => {
      debugLog('credentials', '[Credentials] setCredential SUCCESS:', { key });
      resolve();
    };
    req.onerror = () => {
      console.error('[Credentials] setCredential ERROR:', { key, error: req.error });
      reject(req.error);
    };
  });
}

/**
 * Recupera credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<object|undefined>}
 */
export async function getCredential(key) {
  debugLog('credentials', '[Credentials] getCredential START:', { key });

  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.get(key);

    req.onsuccess = () => {
      const result = req.result;
      debugLog('credentials', '[Credentials] getCredential RESULT:', {
        key,
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : null,
        resultUrl: result?.url ? `${result.url.substring(0, 30)}...` : null,
        resultHasToken: !!result?.token,
        resultEnabled: result?.enabled,
      });
      resolve(result);
    };
    req.onerror = () => {
      console.error('[Credentials] getCredential ERROR:', { key, error: req.error });
      reject(req.error);
    };
  });
}

/**
 * Remove credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<void>}
 */
export async function deleteCredential(key) {
  debugLog('credentials', '[Credentials] deleteCredential START:', { key });
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.delete(key);

    req.onsuccess = () => {
      debugLog('credentials', '[Credentials] deleteCredential SUCCESS:', { key });
      resolve();
    };
    req.onerror = () => {
      console.error('[Credentials] deleteCredential ERROR:', { key, error: req.error });
      reject(req.error);
    };
  });
}

/**
 * Lista todas as chaves de credenciais
 * @returns {Promise<string[]>}
 */
export async function listCredentialKeys() {
  debugLog('credentials', '[Credentials] listCredentialKeys START');
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.getAllKeys();

    req.onsuccess = () => {
      debugLog('credentials', '[Credentials] listCredentialKeys RESULT:', { keys: req.result });
      resolve(req.result);
    };
    req.onerror = () => {
      console.error('[Credentials] listCredentialKeys ERROR:', { error: req.error });
      reject(req.error);
    };
  });
}

/**
 * Limpa todas as credenciais (para logout/reset)
 * @returns {Promise<void>}
 */
export async function clearAllCredentials() {
  debugLog('credentials', '[Credentials] clearAllCredentials START');
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => {
      debugLog('credentials', '[Credentials] clearAllCredentials SUCCESS');
      resolve();
    };
    req.onerror = () => {
      console.error('[Credentials] clearAllCredentials ERROR:', { error: req.error });
      reject(req.error);
    };
  });
}
