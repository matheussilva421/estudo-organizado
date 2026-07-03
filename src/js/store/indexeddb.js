// =============================================
// INDEXEDDB PERSISTENCE LAYER
// =============================================
import * as credentialsStore from '../credentials.js?v=8.37';
import { appendSyncPerformanceMetric } from '../sync/sync-health.js?v=8.37';
import { runMigrations as _runMigrations, DEFAULT_SCHEMA_VERSION } from './migrations.js';
import { reconcileSequenceWithEvents } from '../logic/cycle-progress.js?v=8.37';
import {
  createLocalStateEnvelope,
  isLocalStateEnvelopeValid,
  pickRecoverableLocalState,
} from './normalize-state.js';

// Runtime binding: store.js sets this reference during module init.
// Avoids ES module URL mismatch when tests use different version query strings.
let _stateRef = null;
export function _bindState(ref) {
  if (_stateRef === null) {
    _stateRef = ref;
  }
}

let _setStateRef = null;
export function _bindSetState(ref) {
  if (_setStateRef === null) {
    _setStateRef = ref;
  }
}

export const DB_NAME = 'EstudoOrganizadoDB';
export const DB_VERSION = 6;
export const STORE_NAME = 'app_state';
export const FIRESTORE_OUTBOX_STORE = 'firestore_outbox';
export const FIRESTORE_META_STORE = 'firestore_meta';
export const FIRESTORE_CONFLICT_STORE = 'firestore_conflicts';
export const ENTITY_META_STORE = 'entity_meta';
export const FIRESTORE_ENTITY_OUTBOX_STORE = 'firestore_entity_outbox';
export const LOCAL_STATE_CURRENT_KEY = 'main_state_current';
export const LOCAL_STATE_PREVIOUS_KEY = 'main_state_previous';
export const LOCAL_STATE_LEGACY_KEY = 'main_state';

export let db;
export const DEFAULT_FIRESTORE_SYNC_CONFIG = {
  enabled: false,
  mode: 'shadow',
  uid: null,
  lastPullAt: null,
  lastPushAt: null,
  remoteUpdatedAt: null,
  hasPendingWrites: false,
  conflict: null,
  lastError: null,
};

function readEmergencyState() {
  for (const key of ['estudo_state_emergency', 'estudo_state']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.error(`Error reading ${key}:`, err);
    }
  }
  return null;
}

/**
 * Inicializa banco de dados IndexedDB e carrega estado
 * @returns {Promise<void>}
 */
export function initDB() {
  return new Promise((resolve, _reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB Error:', event.target.error);
      loadLegacyState(); // Fallback
      resolve();
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(FIRESTORE_OUTBOX_STORE)) {
        db.createObjectStore(FIRESTORE_OUTBOX_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FIRESTORE_META_STORE)) {
        db.createObjectStore(FIRESTORE_META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FIRESTORE_CONFLICT_STORE)) {
        db.createObjectStore(FIRESTORE_CONFLICT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ENTITY_META_STORE)) {
        db.createObjectStore(ENTITY_META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) {
        db.createObjectStore(FIRESTORE_ENTITY_OUTBOX_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      loadStateFromDB().then(() => {
        resolve();
      });
    };
  });
}

/**
 * Carrega estado do IndexedDB e aplica migrações se necessário
 * @returns {Promise<void>}
 */
export function loadStateFromDB() {
  return new Promise((resolve) => {
    if (!db) {
      loadLegacyState();
      resolve();
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const currentRequest = store.get(LOCAL_STATE_CURRENT_KEY);
    const previousRequest = store.get(LOCAL_STATE_PREVIOUS_KEY);
    const legacyRequest = store.get(LOCAL_STATE_LEGACY_KEY);
    const loaded = {};

    const finishLoad = () => {
      if (!('current' in loaded) || !('previous' in loaded) || !('legacy' in loaded)) return;
      const recovered = pickRecoverableLocalState({
        current: loaded.current,
        previous: loaded.previous,
        legacy: loaded.legacy,
        emergency: readEmergencyState(),
      });
      if (recovered.state) {
        const loadedState = recovered.state;

        // BUG 3: Prevenir persistência inflada de timer ao fechar a aba
        const isSameSession = sessionStorage.getItem('estudo_session_active');
        if (!isSameSession && recovered.source !== 'emergency') {
          if (loadedState.cronoLivre && loadedState.cronoLivre._timerStart) {
            loadedState.cronoLivre._timerStart = null;
          }
          if (loadedState.eventos) {
            loadedState.eventos.forEach((ev) => {
              if (ev._timerStart) ev._timerStart = null;
            });
          }
        }
        sessionStorage.setItem('estudo_session_active', '1');

        _setStateRef(loadedState);
        runMigrations();
        // Boot: re-deriva o status auto das etapas do ciclo a partir dos
        // eventos (cobre estados gravados por versões antigas do app).
        if (_stateRef) {
          reconcileSequenceWithEvents(_stateRef.planejamento, _stateRef.eventos);
        }
      } else {
        loadLegacyState(); // Try migration from localStorage
      }
      resolve();
    };

    currentRequest.onsuccess = () => {
      loaded.current = currentRequest.result || null;
      finishLoad();
    };
    previousRequest.onsuccess = () => {
      loaded.previous = previousRequest.result || null;
      finishLoad();
    };
    legacyRequest.onsuccess = () => {
      loaded.legacy = legacyRequest.result || null;
      finishLoad();
    };
    currentRequest.onerror = () => {
      loaded.current = null;
      finishLoad();
    };
    previousRequest.onerror = () => {
      loaded.previous = null;
      finishLoad();
    };
    legacyRequest.onerror = () => {
      loaded.legacy = null;
      finishLoad();
    };

    transaction.onerror = () => {
      console.error('loadStateFromDB transaction error:', transaction.error);
      loadLegacyState();
      resolve();
    };
  });
}

/**
 * Carrega estado do localStorage (migração para usuários legados + recovery emergencial)
 */
export function loadLegacyState() {
  try {
    // Check for emergency save first (from beforeunload)
    const emergency = localStorage.getItem('estudo_state_emergency');
    const saved = localStorage.getItem('estudo_state');
    const source = emergency || saved;
    if (source) {
      _setStateRef(JSON.parse(source));
      runMigrations();
      scheduleSave(); // Save to IndexedDB immediately
      // Clean up both legacy keys
      localStorage.removeItem('estudo_state');
      localStorage.removeItem('estudo_state_emergency');
    }
  } catch (e) {
    console.error('Error loading legacy state:', e);
  }
}

/**
 * Salva estado no IndexedDB com debounce de 800ms
 */
export let saveTimeout = null;

export function describeSaveFailure(err) {
  const source = err?.target?.error || err?.currentTarget?.error || err;
  const name = source?.name || 'Erro desconhecido';
  const message = source?.message || String(source || 'sem detalhes');

  if (name === 'QuotaExceededError' || /quota|storage/i.test(message)) {
    return `Espaço de armazenamento insuficiente no navegador (${name}: ${message})`;
  }

  if (name === 'InvalidStateError' || name === 'NotFoundError') {
    return `IndexedDB indisponível ou fechado (${name}: ${message})`;
  }

  return `${name}: ${message}`;
}

function emitSaveStatus(status, detail = {}) {
  if (typeof document === 'undefined') return;
  const message =
    detail.message ||
    (status === 'saving'
      ? 'Salvando...'
      : status === 'error'
        ? 'Erro ao salvar'
        : 'Salvo localmente');
  document.dispatchEvent(
    new CustomEvent('app:saveStatus', {
      detail: {
        status,
        message,
        detail: detail.detail || '',
        timestamp: new Date().toISOString(),
      },
    })
  );
}

// Handler pagehide - mais confiável que beforeunload em mobile e fechamentos bruscos
window.addEventListener('pagehide', () => {
  if (saveTimeout !== null) {
    // Emergency sync save via localStorage (síncrono e confiável)
    try {
      localStorage.setItem('estudo_state_emergency', JSON.stringify(_stateRef));
    } catch (err) {
      console.error('pagehide emergency localStorage save failed:', err);
    }
    // Também tenta IndexedDB (pode não completar em fechamentos bruscos)
    saveStateToDB();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (saveTimeout !== null) {
    // Emergency sync save via localStorage (IndexedDB is async and may not complete)
    try {
      localStorage.setItem('estudo_state_emergency', JSON.stringify(_stateRef));
    } catch (err) {
      console.error('Emergency localStorage save failed:', err);
    }
    // Also attempt IndexedDB save (may or may not complete)
    saveStateToDB();
    e.preventDefault();
    e.returnValue = 'Há alterações pendentes aguardando salvamento. Deseja sair assim mesmo?';
    return e.returnValue;
  }
});

/**
 * Fila de sincronização para operações sequenciais no IndexedDB
 */
export const SyncQueue = {
  isProcessing: false,
  tasks: [],
  add(taskFn) {
    return new Promise((resolve, reject) => {
      this.tasks.push(async () => {
        try {
          await taskFn();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  },
  async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.tasks.length > 0) {
      const fn = this.tasks.shift();
      try {
        await fn();
      } catch (err) {
        console.error('SyncQueue Error (task skipped, remaining will continue):', err);
      }
    }
    this.isProcessing = false;
  },
  clear() {
    this.tasks = [];
    this.isProcessing = false;
  },
};

let _invalidateTimeout = null;

/**
 * Agenda salvamento do estado com debounce de 800ms
 * Dispara eventos de update de badges e invalidação de caches
 */
export function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  emitSaveStatus('saving');

  // Update badges instantly without waiting for the save
  document.dispatchEvent(new Event('app:updateBadges'));

  // Debounce cache invalidation to avoid clearing caches on every rapid change
  if (!_invalidateTimeout) {
    _invalidateTimeout = setTimeout(() => {
      document.dispatchEvent(new Event('app:invalidateCaches'));
      _invalidateTimeout = null;
    }, 100);
  }

  saveTimeout = setTimeout(() => {
    // Ensure caches are invalidated before save
    if (_invalidateTimeout) {
      clearTimeout(_invalidateTimeout);
      _invalidateTimeout = null;
      document.dispatchEvent(new Event('app:invalidateCaches'));
    }
    saveStateToDB().catch((err) => {
      console.error('CRITICAL: Failed to save to IndexedDB', err);
      const detail = describeSaveFailure(err);
      emitSaveStatus('error', { detail });
      if (typeof document !== 'undefined') {
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: { msg: `ERRO GRAVE: Falha ao salvar. ${detail}`, type: 'error' },
          })
        );
      }
    });
  }, 800); // 800ms debounce (matches documented value)
}

/**
 * Salva estado no IndexedDB imediatamente
 * @param {boolean|Object} [firstArg=false] - Se boolean, skipCloudSync. Se objeto, opções.
 * @param {boolean} [skipFirestoreSync=false] - Legacy: se true, não sincroniza com Firestore
 * @param {boolean} [skipDriveSync=false] - Legacy: se true, não sincroniza com Drive
 * @param {Object} [legacyOptions] - Legacy: opções adicionais
 * @returns {Promise<void>}
 */
export function saveStateToDB(
  firstArg = false,
  skipFirestoreSync = false,
  skipDriveSync = false,
  legacyOptions = {}
) {
  let skipCloudSync, options;
  if (typeof firstArg === 'object' && firstArg !== null) {
    options = firstArg;
    skipCloudSync = options.skipCloudSync ?? false;
    skipFirestoreSync = options.skipFirestoreSync ?? false;
    skipDriveSync = options.skipDriveSync ?? false;
  } else {
    skipCloudSync = firstArg;
    options = legacyOptions && typeof legacyOptions === 'object' ? legacyOptions : {};
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!db) return Promise.resolve();
  const localCommitStart = performance.now();
  const touchLocalBackup = options.touchLocalBackup !== false;
  const skipSyncEvent = options.skipSyncEvent === true;
  const emitUserSaveStatus = options.emitSaveStatus !== false && touchLocalBackup;
  if (emitUserSaveStatus) emitSaveStatus('saving');

  if (!_stateRef.config) _stateRef.config = {};
  if (touchLocalBackup) {
    _stateRef.config.localBackupAt = new Date().toISOString();
  }

  const prepare = Promise.resolve();

  return prepare.then(
    () =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const currentRequest = store.get(LOCAL_STATE_CURRENT_KEY);
        let settled = false;

        const rejectOnce = (err) => {
          if (settled) return;
          settled = true;
          if (emitUserSaveStatus) emitSaveStatus('error', { detail: describeSaveFailure(err) });
          reject(err);
        };

        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          if (!skipSyncEvent) {
            document.dispatchEvent(
              new CustomEvent('stateSaved', {
                detail: {
                  skipCloudSync,
                  skipFirestoreSync,
                  skipDriveSync,
                  touchLocalBackup,
                  metadataOnly: !touchLocalBackup,
                },
              })
            );
          }
          if (emitUserSaveStatus) emitSaveStatus('saved');
          appendSyncPerformanceMetric(_stateRef, {
            name: 'localCommitMs',
            durationMs: performance.now() - localCommitStart,
          });
          resolve();
        };

        transaction.onerror = () => {
          rejectOnce(transaction.error || new Error('Transaction failed'));
        };

        transaction.onabort = () => {
          rejectOnce(transaction.error || new Error('Transaction aborted'));
        };

        currentRequest.onsuccess = () => {
          const currentEnvelope = currentRequest.result;
          if (isLocalStateEnvelopeValid(currentEnvelope)) {
            store.put({ ...currentEnvelope, slot: 'previous' }, LOCAL_STATE_PREVIOUS_KEY);
          }
          const envelope = createLocalStateEnvelope(_stateRef, { slot: 'current' });
          const currentWrite = store.put(envelope, LOCAL_STATE_CURRENT_KEY);
          const legacyWrite = store.put(_stateRef, LOCAL_STATE_LEGACY_KEY);
          currentWrite.onerror = legacyWrite.onerror = (e) => {
            rejectOnce(e?.target?.error || e);
          };
        };
        currentRequest.onerror = (e) => {
          rejectOnce(currentRequest.error || e?.target?.error || e);
        };
      })
  );
}

/**
 * Executa migrações de schema do estado (v1 → v10)
 * @returns {void}
 */
export function runMigrations() {
  _runMigrations(_stateRef, scheduleSave);
}

// Clean up state (called by clearAllData in views.js which already double-confirms)
export function clearData() {
  credentialsStore.clearAllCredentials().catch((err) => {
    console.error('Erro ao limpar credenciais:', err);
  });
  _setStateRef({
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      materiasPorDia: 3,
      sequencia: [],
      slotOverrides: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: null,
    },
    editais: [],
    eventos: [],
    arquivo: [],
    habitos: {
      questoes: [],
      revisao: [],
      discursiva: [],
      simulado: [],
      leitura: [],
      informativo: [],
      sumula: [],
      videoaula: [],
      paginas: [],
    },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      globalSyncPaused: true,
      firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
  });
  const clearAuxStores = () => {
    if (!db) return Promise.resolve();
    const stores = [
      FIRESTORE_OUTBOX_STORE,
      FIRESTORE_META_STORE,
      FIRESTORE_CONFLICT_STORE,
      ENTITY_META_STORE,
      FIRESTORE_ENTITY_OUTBOX_STORE,
    ];
    return Promise.all(
      stores.map((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      })
    );
  };
  saveStateToDB()
    .then(() => clearAuxStores())
    .then(() => {
      document.dispatchEvent(
        new CustomEvent('app:showToast', {
          detail: { msg: 'Dados apagados com sucesso.', type: 'info' },
        })
      );
      document.dispatchEvent(new Event('app:renderCurrentView'));
    })
    .catch((e) => console.error('Erro ao limpar dados:', e));
}
