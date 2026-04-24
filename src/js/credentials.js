// =============================================
// CREDENTIALS MANAGEMENT (IndexedDB)
// =============================================
// Armazena credenciais de sync separadamente do estado exportavel.
// Previne exfiltracao de tokens via backup/exportacao.

const CREDS_DB_NAME = 'EstudoCredenciaisDB';
const CREDS_DB_VERSION = 1;
const CREDS_STORE_NAME = 'credentials';

let credsDb = null;
let _initPromise = null;

/**
 * Inicializa banco de dados de credenciais
 * @returns {Promise<IDBDatabase>}
 */
export function initCredentialsDB() {
  if (_initPromise) return _initPromise;
  if (credsDb) return Promise.resolve(credsDb);
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponivel'));

  _initPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(CREDS_DB_NAME, CREDS_DB_VERSION);
    } catch (err) {
      _initPromise = null;
      reject(err);
      return;
    }

    request.onerror = (event) => {
      _initPromise = null;
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

function readFallbackCredential(key) {
  const raw = localStorage.getItem(`estudo_cred_${key}`);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[CredentialsDB] Credencial fallback invalida:', err);
    return undefined;
  }
}

function listFallbackCredentialKeys() {
  const prefix = 'estudo_cred_';
  return Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length));
}

/**
 * Armazena credencial de forma isolada
 * @param {string} key - Chave da credencial (ex: 'cloudflare', 'drive')
 * @param {object} value - Objeto da credencial
 * @returns {Promise<void>}
 */
export async function setCredential(key, value) {
  try {
    await initCredentialsDB();
    return new Promise((resolve, reject) => {
      const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(CREDS_STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    localStorage.setItem(`estudo_cred_${key}`, JSON.stringify(value));
  }
}

/**
 * Recupera credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<object|undefined>}
 */
export async function getCredential(key) {
  try {
    await initCredentialsDB();
    return new Promise((resolve, reject) => {
      const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
      const store = tx.objectStore(CREDS_STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return readFallbackCredential(key);
  }
}

/**
 * Remove credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<void>}
 */
export async function deleteCredential(key) {
  try {
    await initCredentialsDB();
    return new Promise((resolve, reject) => {
      const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(CREDS_STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    localStorage.removeItem(`estudo_cred_${key}`);
  }
}

/**
 * Lista todas as chaves de credenciais (para debug)
 * @returns {Promise<string[]>}
 */
export async function listCredentialKeys() {
  try {
    await initCredentialsDB();
    return new Promise((resolve, reject) => {
      const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
      const store = tx.objectStore(CREDS_STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return listFallbackCredentialKeys();
  }
}

/**
 * Limpa todas as credenciais (para logout/reset)
 * @returns {Promise<void>}
 */
export async function clearAllCredentials() {
  try {
    await initCredentialsDB();
    const keys = await listCredentialKeys();
    await Promise.all(keys.map(key => deleteCredential(key)));
    listFallbackCredentialKeys().forEach(key => localStorage.removeItem(`estudo_cred_${key}`));
  } catch (err) {
    listFallbackCredentialKeys().forEach(key => localStorage.removeItem(`estudo_cred_${key}`));
  }
}
