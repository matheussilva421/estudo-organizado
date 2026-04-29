// =============================================
// CREDENTIALS MANAGEMENT (IndexedDB)
// =============================================
// Armazena credenciais de sync separadamente do estado exportavel.
// Previne exfiltracao de tokens via backup/exportacao.
// Se IndexedDB estiver indisponivel, operacoes falham explicitamente
// em vez de fallback para localStorage (risco XSS).

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
      new Error('IndexedDB indisponivel — credenciais nao podem ser armazenadas com seguranca.')
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
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.put(value, key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Recupera credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<object|undefined>}
 */
export async function getCredential(key) {
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove credencial isolada
 * @param {string} key - Chave da credencial
 * @returns {Promise<void>}
 */
export async function deleteCredential(key) {
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lista todas as chaves de credenciais (para debug)
 * @returns {Promise<string[]>}
 */
export async function listCredentialKeys() {
  await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.getAllKeys();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Limpa todas as credenciais (para logout/reset)
 * @returns {Promise<void>}
 */
export async function clearAllCredentials() {
  await initCredentialsDB();
  const keys = await listCredentialKeys();
  await Promise.all(keys.map((key) => deleteCredential(key)));
}
