// =============================================
// INDEXEDDB PERSISTENCE LAYER
// =============================================
import * as credentialsStore from '../credentials.js?v=8.37';
import { appendSyncPerformanceMetric } from '../sync/sync-health.js?v=8.37';
import { runMigrations as _runMigrations, DEFAULT_SCHEMA_VERSION } from './migrations.js';
import { reconcileSequenceWithEvents } from '../logic/cycle-progress.js?v=8.37';
import { markDerivedRecoveryPending } from './boot-recovery.js';
import {
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  V1_LOCAL_STATE_STORE,
  V1_SYNC_OUTBOX_STORE,
  V1_ENTITY_META_STORE,
  V1_SYNC_CONFLICT_STORE,
  V1_SYNC_META_STORE,
  clearActiveV1Context,
  getActiveV1Context,
  prepareLocalCommit,
  v1ScopeKey,
} from '../sync/v1-next/local.js';
import {
  createLocalStateEnvelope,
  isLocalStateEnvelopeValid,
  pickRecoverableLocalState,
} from './normalize-state.js';
import {
  getV1SyncStatusSnapshot,
  shouldWarnV1BeforeUnload,
} from '../sync/v1-next/status.js';

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

/** Publish state and local-save notifications only after a durable commit. */
export function _publishRetaFinalCommit(nextState, result) {
  void nextState;
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('app:saveStatus', {
      detail: {
        status: 'saved',
        message: 'Salvo localmente',
        detail: 'Alterações da Reta Final gravadas no dispositivo.',
        timestamp: new Date().toISOString(),
        localCommitted: true,
        syncPending: true,
      },
    }),
  );
  document.dispatchEvent(
    new CustomEvent('stateSaved', {
      detail: {
        source: 'reta-final-commit',
        localCommitted: true,
        syncPending: true,
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        revision: result?.revision ?? null,
      },
    }),
  );
}

export const DB_NAME = LOCAL_DB_NAME;
export const DB_VERSION = LOCAL_DB_VERSION;
export const STORE_NAME = 'app_state';
export const FIRESTORE_OUTBOX_STORE = 'firestore_outbox';
export const FIRESTORE_META_STORE = 'firestore_meta';
export const FIRESTORE_CONFLICT_STORE = 'firestore_conflicts';
export const ENTITY_META_STORE = 'entity_meta';
export const FIRESTORE_ENTITY_OUTBOX_STORE = 'firestore_entity_outbox';
export const RETA_FINAL_DRAFT_STORE = 'reta_final_drafts';
export const RETA_FINAL_JOURNAL_STORE = 'reta_final_journal';
export { V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE,
  V1_SYNC_CONFLICT_STORE, V1_SYNC_META_STORE };
export const LOCAL_STATE_CURRENT_KEY = 'main_state_current';
export const LOCAL_STATE_PREVIOUS_KEY = 'main_state_previous';
export const LOCAL_STATE_LEGACY_KEY = 'main_state';

// Per-tab snapshot of the durable V1 state as this tab last observed it.
// Saves diff against it so a stale tab cannot revert another tab's ACKed edit.
let v1BaselineState = null;
let v1BaselineScope = null;

export function noteV1ChangeBaseline(nextState) {
  const activeContext = getActiveV1Context();
  if (!activeContext || !nextState || typeof nextState !== 'object') {
    v1BaselineState = null;
    v1BaselineScope = null;
    return;
  }
  v1BaselineScope = v1ScopeKey(activeContext.uid, activeContext.generationId);
  v1BaselineState = structuredClone(nextState);
}

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

function openDatabaseSchema() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject(event.target.error);
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
      if (!db.objectStoreNames.contains(RETA_FINAL_DRAFT_STORE)) {
        db.createObjectStore(RETA_FINAL_DRAFT_STORE, { keyPath: 'draftId' });
      }
      if (!db.objectStoreNames.contains(RETA_FINAL_JOURNAL_STORE)) {
        db.createObjectStore(RETA_FINAL_JOURNAL_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(V1_LOCAL_STATE_STORE)) {
        db.createObjectStore(V1_LOCAL_STATE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(V1_SYNC_OUTBOX_STORE)) {
        db.createObjectStore(V1_SYNC_OUTBOX_STORE, { keyPath: 'opId' });
      }
      if (!db.objectStoreNames.contains(V1_ENTITY_META_STORE)) {
        db.createObjectStore(V1_ENTITY_META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(V1_SYNC_CONFLICT_STORE)) {
        db.createObjectStore(V1_SYNC_CONFLICT_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(V1_SYNC_META_STORE)) {
        db.createObjectStore(V1_SYNC_META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
  });
}

/** Open and upgrade the schema without reading or migrating academic state. */
export function ensureDB() {
  if (db) return Promise.resolve(db);
  return openDatabaseSchema();
}

/**
 * Inicializa banco de dados IndexedDB e carrega estado
 * @returns {Promise<void>}
 */
async function loadOrMigrateDatabase({ loadState = true } = {}) {
  try {
    await ensureDB();
    if (loadState) await loadStateFromDB();
  } catch (event) {
    console.error('IndexedDB Error:', event?.target?.error || event);
    try {
      await loadLegacyState();
    } catch (err) {
      console.error('Legacy fallback failed:', err);
    }
  }
}

export function initDB(options = {}) {
  return loadOrMigrateDatabase(options);
}

// Reuse the checksum envelopes and atomic previous/current/legacy save. Boot
// migrations and RF sources recovered from localStorage must commit first.
async function migrateLoadedState(loadedState, { persistEvenIfUnchanged = false } = {}) {
  const backup = createLocalStateEnvelope(loadedState, { slot: 'previous' });
  _setStateRef(loadedState);
  let migration;
  try {
    migration = runMigrations();
  } catch (err) {
    _setStateRef(backup.payload);
    markDerivedRecoveryPending();
    throw err;
  } finally {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }
  if (!migration.changed && !persistEvenIfUnchanged) return true;
  if (!db) {
    _setStateRef(backup.payload);
    console.error('Reta Final: IndexedDB indisponível; migração não persistida e fonte local preservada.');
    return false;
  }
  try {
    await saveStateToDB({
      migrationBackup: backup,
      touchLocalBackup: false,
      emitSaveStatus: false,
      skipSyncEvent: true,
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
    });
    return true;
  } catch (err) {
    _setStateRef(backup.payload);
    markDerivedRecoveryPending();
    console.error('Reta Final: migração não persistida; estado anterior restaurado.', err);
    return false;
  }
}

/**
 * Carrega estado do IndexedDB e aplica migrações se necessário
 * @returns {Promise<void>}
 */
export function loadStateFromDB() {
  return new Promise((resolve) => {
    if (!db) {
      Promise.resolve(loadLegacyState()).then(resolve, (err) => {
        console.error('Legacy fallback failed:', err);
        resolve();
      });
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const currentRequest = store.get(LOCAL_STATE_CURRENT_KEY);
    const previousRequest = store.get(LOCAL_STATE_PREVIOUS_KEY);
    const legacyRequest = store.get(LOCAL_STATE_LEGACY_KEY);
    const loaded = {};

    const finishLoad = async () => {
      if (!('current' in loaded) || !('previous' in loaded) || !('legacy' in loaded)) return;
      try {
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

          await migrateLoadedState(loadedState);
          // Boot: re-deriva o status auto das etapas do ciclo a partir dos
          // eventos (cobre estados gravados por versões antigas do app).
          if (_stateRef) {
            reconcileSequenceWithEvents(_stateRef.planejamento, _stateRef.eventos);
          }
        } else {
          await loadLegacyState(); // Try migration from localStorage
        }
      } catch (err) {
        console.error('loadStateFromDB failed to finish loading:', err);
      } finally {
        resolve();
      }
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
      Promise.resolve(loadLegacyState()).then(resolve, (err) => {
        console.error('Legacy fallback failed:', err);
        resolve();
      });
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
      const loadedState = JSON.parse(source);
      // Legacy callers retain synchronous loading; RF normalization waits for
      // durability before deleting the last localStorage recovery source.
      if (loadedState.planejamento?.tipo === 'reta_final') {
        return migrateLoadedState(loadedState, { persistEvenIfUnchanged: true }).then((saved) => {
          if (!saved) return;
          try {
            localStorage.removeItem('estudo_state');
            localStorage.removeItem('estudo_state_emergency');
          } catch (err) {
            console.error('Reta Final: falha ao limpar fonte local já persistida.', err);
          }
        });
      }
      _setStateRef(loadedState);
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
    saveStateToDB().catch((err) => {
      console.error('pagehide IndexedDB emergency save failed:', err);
    });
  }
});

window.addEventListener('beforeunload', (e) => {
  const v1Pending = shouldWarnV1BeforeUnload(getV1SyncStatusSnapshot());
  const localSavePending = saveTimeout !== null;
  if (localSavePending) {
    // Emergency sync save via localStorage (IndexedDB is async and may not complete)
    try {
      localStorage.setItem('estudo_state_emergency', JSON.stringify(_stateRef));
    } catch (err) {
      console.error('Emergency localStorage save failed:', err);
    }
    // Also attempt IndexedDB save (may or may not complete)
    saveStateToDB().catch((err) => {
      console.error('beforeunload IndexedDB emergency save failed:', err);
    });
  }
  if (!v1Pending && !localSavePending) return;
  // Browsers may replace this text; the confirmation itself remains native.
  const warning = v1Pending
    ? 'Há alterações salvas neste dispositivo aguardando confirmação do servidor.'
    : 'Há alterações pendentes aguardando salvamento.';
  e.preventDefault();
  e.returnValue = warning;
  return warning;
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
  const touchLocalBackup = options.touchLocalBackup !== false;
  const skipSyncEvent = options.skipSyncEvent === true;
  const emitUserSaveStatus = options.emitSaveStatus !== false && touchLocalBackup;
  if (emitUserSaveStatus) emitSaveStatus('saving');
  if (!db) {
    const error = new Error('IndexedDB unavailable');
    if (emitUserSaveStatus) emitSaveStatus('error', { detail: describeSaveFailure(error) });
    return Promise.reject(error);
  }

  const localCommitStart = performance.now();

  if (!_stateRef.config) _stateRef.config = {};
  if (touchLocalBackup) {
    _stateRef.config.localBackupAt = new Date().toISOString();
  }

  const activeContext = getActiveV1Context();
  const v1Stores = activeContext
    ? [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE,
      V1_SYNC_CONFLICT_STORE, V1_SYNC_META_STORE]
    : [];
  if (v1Stores.some((storeName) => !db.objectStoreNames.contains(storeName))) {
    const error = new Error('V1 local stores are unavailable');
    if (emitUserSaveStatus) emitSaveStatus('error', { detail: describeSaveFailure(error) });
    return Promise.reject(error);
  }
  const stateSnapshot = activeContext ? structuredClone(_stateRef) : null;
  const v1Scope = activeContext
    ? v1ScopeKey(activeContext.uid, activeContext.generationId)
    : null;
  const changeBaseState = v1Scope && v1BaselineScope === v1Scope
    ? v1BaselineState
    : null;

  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectOnce = (err) => {
      if (settled) return;
      settled = true;
      if (emitUserSaveStatus) emitSaveStatus('error', { detail: describeSaveFailure(err) });
      reject(err);
    };

    let transaction;
    try {
      transaction = db.transaction([STORE_NAME, ...v1Stores], 'readwrite');
    } catch (error) {
      rejectOnce(error);
      return;
    }
    const store = transaction.objectStore(STORE_NAME);
    const currentRequest = store.get(LOCAL_STATE_CURRENT_KEY);
    const v1Reads = activeContext
      ? {
          scopeKey: v1ScopeKey(activeContext.uid, activeContext.generationId),
          state: undefined,
          operations: undefined,
          entityMeta: undefined,
          conflicts: undefined,
          syncMeta: undefined,
          done: new Set(),
        }
      : null;
    let currentDone = false;
    let staged = false;
    const trackWrite = (request) => {
      request.onerror = (event) => rejectOnce(event?.target?.error || request.error || event);
    };
    const stage = () => {
      if (staged || !currentDone ||
        (v1Reads && v1Reads.done.size !== 5)) return;
      staged = true;
      let prepared = null;
      try {
        if (v1Reads) {
          const record = v1Reads.state;
          if (record && (record.key !== v1Reads.scopeKey ||
            record.uid !== activeContext.uid ||
            record.generationId !== activeContext.generationId ||
            !record.state || typeof record.state !== 'object')) {
            throw new Error('Invalid V1 local state record');
          }
          prepared = prepareLocalCommit({
            uid: activeContext.uid,
            generationId: activeContext.generationId,
            previousState: record?.state || null,
            changeBaseState,
            nextState: stateSnapshot,
            pendingOperations: v1Reads.operations || [],
            entityMeta: v1Reads.entityMeta || [],
            existingConflicts: v1Reads.conflicts || [],
            syncMeta: v1Reads.syncMeta || null,
            verified: record?.verified,
          });
        }
        const currentEnvelope = currentRequest.result;
        const previousEnvelope = options.migrationBackup || currentEnvelope;
        if (isLocalStateEnvelopeValid(previousEnvelope)) {
          trackWrite(store.put(
            { ...previousEnvelope, slot: 'previous' },
            LOCAL_STATE_PREVIOUS_KEY,
          ));
        }
        const persistedState = stateSnapshot || _stateRef;
        const envelope = createLocalStateEnvelope(persistedState, { slot: 'current' });
        trackWrite(store.put(envelope, LOCAL_STATE_CURRENT_KEY));
        trackWrite(store.put(persistedState, LOCAL_STATE_LEGACY_KEY));
        if (prepared) {
          trackWrite(transaction.objectStore(V1_LOCAL_STATE_STORE).put(prepared.stateRecord));
          const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
          for (const operation of prepared.operations) trackWrite(outbox.put(operation));
          for (const opId of prepared.deletedOperationIds) trackWrite(outbox.delete(opId));
          const entityMeta = transaction.objectStore(V1_ENTITY_META_STORE);
          for (const record of prepared.entityMeta) trackWrite(entityMeta.put(record));
          for (const key of prepared.deletedEntityMetaKeys) {
            trackWrite(entityMeta.delete(key));
          }
          const conflicts = transaction.objectStore(V1_SYNC_CONFLICT_STORE);
          for (const conflict of prepared.conflicts) trackWrite(conflicts.put(conflict));
          trackWrite(transaction.objectStore(V1_SYNC_META_STORE).put(prepared.syncMeta));
        }
      } catch (error) {
        rejectOnce(error);
        try {
          transaction.abort();
        } catch {
          // The rejection above is the user-visible failure.
        }
      }
    };

    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      if (v1Scope && stateSnapshot) {
        v1BaselineScope = v1Scope;
        v1BaselineState = structuredClone(stateSnapshot);
      }
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
      currentDone = true;
      stage();
    };
    currentRequest.onerror = (event) => {
      rejectOnce(currentRequest.error || event?.target?.error || event);
    };

    if (v1Reads) {
      const v1StateRequest = transaction.objectStore(V1_LOCAL_STATE_STORE).get(v1Reads.scopeKey);
      v1StateRequest.onsuccess = () => {
        v1Reads.state = v1StateRequest.result;
        v1Reads.done.add('state');
        stage();
      };
      v1StateRequest.onerror = () => rejectOnce(v1StateRequest.error);

      const outboxRequest = transaction.objectStore(V1_SYNC_OUTBOX_STORE).getAll();
      outboxRequest.onsuccess = () => {
        v1Reads.operations = outboxRequest.result || [];
        v1Reads.done.add('operations');
        stage();
      };
      outboxRequest.onerror = () => rejectOnce(outboxRequest.error);

      const metaRequest = transaction.objectStore(V1_ENTITY_META_STORE).getAll();
      metaRequest.onsuccess = () => {
        v1Reads.entityMeta = metaRequest.result || [];
        v1Reads.done.add('entityMeta');
        stage();
      };
      metaRequest.onerror = () => rejectOnce(metaRequest.error);

      const conflictRequest = transaction.objectStore(V1_SYNC_CONFLICT_STORE).getAll();
      conflictRequest.onsuccess = () => {
        v1Reads.conflicts = conflictRequest.result || [];
        v1Reads.done.add('conflicts');
        stage();
      };
      conflictRequest.onerror = () => rejectOnce(conflictRequest.error);

      const syncMetaRequest = transaction.objectStore(V1_SYNC_META_STORE).get(v1Reads.scopeKey);
      syncMetaRequest.onsuccess = () => {
        v1Reads.syncMeta = syncMetaRequest.result || null;
        v1Reads.done.add('syncMeta');
        stage();
      };
      syncMetaRequest.onerror = () => rejectOnce(syncMetaRequest.error);
    }
  });
}

/**
 * Executa migrações de schema do estado (v1 → v12)
 * @returns {{plan: object|undefined, changed: boolean, diagnostics: string[]}}
 */
export function runMigrations() {
  const result = _runMigrations(_stateRef, scheduleSave);
  if (result.diagnostics.length) console.warn('Reta Final: reparo humano necessário.', result.diagnostics);
  return result;
}

// Clean up state (called by clearAllData in views.js which already double-confirms)
export function clearData() {
  clearActiveV1Context();
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
      V1_LOCAL_STATE_STORE,
      V1_SYNC_OUTBOX_STORE,
      V1_ENTITY_META_STORE,
      V1_SYNC_CONFLICT_STORE,
      V1_SYNC_META_STORE,
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
