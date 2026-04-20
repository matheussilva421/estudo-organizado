// =============================================
// CREDENTIALS MANAGEMENT (IndexedDB)
// =============================================
// Armazena credenciais de sync separadamente do estado exportável
// Previne exfiltração de tokens via exportação de backup

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

  _initPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CREDS_DB_NAME, CREDS_DB_VERSION);

    request.onerror = (event) => {
      console.error('[CredentialsDB] Erro ao abrir DB:', event.target.error);
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
    console.error('[CredentialsDB] Erro ao salvar credencial:', err);
    // Fallback para localStorage se IndexedDB falhar
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
    console.error('[CredentialsDB] Erro ao ler credencial:', err);
    // Fallback para localStorage
    const raw = localStorage.getItem(`estudo_cred_${key}`);
    return raw ? JSON.parse(raw) : undefined;
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
    console.error('[CredentialsDB] Erro ao remover credencial:', err);
    // Cleanup fallback do localStorage
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
    console.error('[CredentialsDB] Erro ao listar chaves:', err);
    return [];
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
  } catch (err) {
    console.error('[CredentialsDB] Erro ao limpar credenciais:', err);
  }
}

// Inicializa DB no próximo tick para não bloquear boot
if (typeof indexedDB !== 'undefined') {
  initCredentialsDB().catch(() => {
    // Silencioso - fallback para localStorage já está implementado
  });
}
