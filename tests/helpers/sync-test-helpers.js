/**
 * Sync Test Helpers — utilities for testing async/concurrent sync scenarios.
 *
 * Used by TDD tests for sync modules (T7-T15).
 */

/**
 * Simple promise-based delay.
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delayMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock state object for testing.
 * @param {Object} overrides - Fields to override
 * @returns {Object}
 */
export function createMockState(overrides = {}) {
  return {
    schemaVersion: 9,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [], ciclosCompletos: 0, dataInicioCicloAtual: null },
    editais: [],
    eventos: [],
    arquivo: [],
    habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [] },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      entityTombstones: [],
      firestoreSync: { enabled: false, uid: null, lastSyncAt: null },
      entitySync: { primaryEnabled: false, lastSyncAt: null },
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
    ...overrides
  };
}

/**
 * Wait for a condition to become true, polling at intervals.
 * @param {Function} predicate - Function returning boolean
 * @param {number} timeoutMs - Max time to wait
 * @param {number} intervalMs - Polling interval
 * @returns {Promise<void>}
 * @throws {Error} If timeout exceeded
 */
export async function waitForCondition(predicate, timeoutMs = 5000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await delayMs(intervalMs);
  }
  throw new Error(`waitForCondition: timeout after ${timeoutMs}ms`);
}

/**
 * Count how many times an event was dispatched on a target.
 * @param {EventTarget} target - Document or element
 * @param {string} eventType - Event name
 * @returns {{ count: number, reset: Function }} Object with count and reset function
 */
export function countEventDispatches(target, eventType) {
  let count = 0;
  const handler = () => { count++; };
  target.addEventListener(eventType, handler);
  return {
    get count() { return count; },
    reset() { count = 0; },
    cleanup() { target.removeEventListener(eventType, handler); }
  };
}

/**
 * Create a mock IndexedDB database for testing.
 * Returns an object that simulates IndexedDB operations in memory.
 * @returns {Object} Mock DB with stores
 */
export function createMockIndexedDB() {
  const stores = new Map();

  return {
    getStore(storeName) {
      if (!stores.has(storeName)) {
        stores.set(storeName, new Map());
      }
      return stores.get(storeName);
    },

    async get(storeName, key) {
      const store = this.getStore(storeName);
      return store.get(key);
    },

    async put(storeName, key, value) {
      const store = this.getStore(storeName);
      store.set(key, value);
      return value;
    },

    async delete(storeName, key) {
      const store = this.getStore(storeName);
      store.delete(key);
    },

    async getAll(storeName) {
      const store = this.getStore(storeName);
      return Array.from(store.values());
    },

    clear() {
      stores.clear();
    }
  };
}
