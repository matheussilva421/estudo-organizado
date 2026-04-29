// =============================================
// SCHEMA & STATE MANAGEMENT (INDEXEDDB)
// =============================================
import { uid } from './utils.js?v=8.29';
import * as credentialsStore from './credentials.js?v=8.29';
import {
  normalizeEntityMetadata,
  prepareEntityMetadataForSave,
} from './sync/entity-metadata.js?v=8.29';

export const DB_NAME = 'EstudoOrganizadoDB';
export const DB_VERSION = 6;
export const STORE_NAME = 'app_state';
export const FIRESTORE_OUTBOX_STORE = 'firestore_outbox';
export const FIRESTORE_META_STORE = 'firestore_meta';
export const FIRESTORE_CONFLICT_STORE = 'firestore_conflicts';
export const ENTITY_META_STORE = 'entity_meta';
export const FIRESTORE_ENTITY_OUTBOX_STORE = 'firestore_entity_outbox';

export let db;
export const DEFAULT_SCHEMA_VERSION = 9;
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

export const DEFAULT_ENTITY_SYNC_CONFIG = {
  enabled: false,
  mode: 'off',
  lastShadowPushAt: null,
  lastShadowReadAt: null,
  lastShadowDiff: null,
  lastError: null,
};

/**
 * Deep clone helper para prevenir mutação de estado
 * Usa structuredClone se disponível, fallback para JSON parse/stringify
 * @param {any} obj - Objeto para clonar
 * @returns {any} - Cópia profunda do objeto
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  // structuredClone é mais preciso e suporta mais tipos
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // Fallback para JSON (funciona para objetos JSON-serializáveis)
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Atualiza o estado global com deep clone para prevenir mutações
 * @param {Object} newState - Novo estado parcial ou completo
 */
export function setState(newState) {
  const normalized = {
    schemaVersion: newState.schemaVersion || DEFAULT_SCHEMA_VERSION,
    ciclo: deepClone(newState.ciclo || { ativo: false, ciclosCompletos: 0, disciplinas: [] }),
    planejamento: deepClone(
      newState.planejamento || {
        ativo: false,
        tipo: null,
        disciplinas: [],
        relevancia: {},
        horarios: {},
        sequencia: [],
        ciclosCompletos: 0,
        dataInicioCicloAtual: null,
      }
    ),
    editais: deepClone(Array.isArray(newState.editais) ? newState.editais : []),
    eventos: deepClone(Array.isArray(newState.eventos) ? newState.eventos : []),
    arquivo: deepClone(Array.isArray(newState.arquivo) ? newState.arquivo : []),
    // Hábitos e Histórico
    habitos: deepClone(
      Object.assign(
        {
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
        typeof newState.habitos === 'object' && newState.habitos !== null ? newState.habitos : {}
      )
    ),
    revisoes: deepClone(Array.isArray(newState.revisoes) ? newState.revisoes : []),
    config: deepClone(
      Object.assign(
        {
          visualizacao: 'mes',
          primeirodiaSemana: 1,
          mostrarNumeroSemana: false,
          agruparEventos: true,
          frequenciaRevisao: [1, 7, 30, 90],
          materiasPorDia: 3,
          entityTombstones: [],
          firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
          entitySync: { ...DEFAULT_ENTITY_SYNC_CONFIG },
        },
        newState.config || {}
      )
    ),
    cronoLivre: deepClone(newState.cronoLivre || { _timerStart: null, tempoAcumulado: 0 }),
    bancaRelevance: deepClone(
      newState.bancaRelevance || { hotTopics: [], userMappings: {}, lessonMappings: {} }
    ),
    driveFileId: newState.driveFileId || null,
    lastSync: newState.lastSync || null,
  };

  // Deep clone do normalized para o state para prevenir mutação externa
  const cloned = deepClone(normalized);
  cloned.config.firestoreSync = Object.assign(
    {},
    DEFAULT_FIRESTORE_SYNC_CONFIG,
    cloned.config.firestoreSync || {}
  );
  cloned.config.entitySync = Object.assign(
    {},
    DEFAULT_ENTITY_SYNC_CONFIG,
    cloned.config.entitySync || {}
  );

  // Replace the state object properties instead of the reference
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, cloned);

  // Disparar evento de state alterado para debugging (apenas em ambiente browser)
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('app:stateChanged', {
        detail: { timestamp: Date.now(), source: 'setState' },
      })
    );
  }
}

export const state = {
  schemaVersion: DEFAULT_SCHEMA_VERSION,
  ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
  planejamento: {
    ativo: false,
    tipo: null,
    disciplinas: [],
    relevancia: {},
    horarios: {},
    sequencia: [],
    ciclosCompletos: 0,
    dataInicioCicloAtual: null,
  },
  editais: [],
  eventos: [],
  arquivo: [], // concluded events older than 90 days
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
    entityTombstones: [],
    firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
    entitySync: { ...DEFAULT_ENTITY_SYNC_CONFIG },
  },
  cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
  bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
  driveFileId: null,
  lastSync: null,
};

export function createExportableState(sourceState = state) {
  const exportable = deepClone(sourceState);
  if (!exportable.config) exportable.config = {};

  delete exportable.config.localBackupAt;
  delete exportable.config.cfUrl;
  delete exportable.config.cfToken;
  delete exportable.config.cfTokenSaved;
  delete exportable.config.cfConflict;
  delete exportable.config.cfRemoteUpdatedAt;
  delete exportable.config.cfLastSyncAt;
  delete exportable.config._lastUpdated;
  delete exportable.config.syncMergeConflicts;
  exportable.config.cfSyncEnabled = false;
  exportable.config.firestoreSync = { ...DEFAULT_FIRESTORE_SYNC_CONFIG };
  exportable.config.entitySync = { ...DEFAULT_ENTITY_SYNC_CONFIG };

  return exportable;
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
    const request = store.get('main_state');

    request.onsuccess = (_event) => {
      if (request.result) {
        const loadedState = request.result;

        // BUG 3: Prevenir persistência inflada de timer ao fechar a aba
        const isSameSession = sessionStorage.getItem('estudo_session_active');
        if (!isSameSession) {
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

        setState(loadedState);
        runMigrations();
      } else {
        loadLegacyState(); // Try migration from localStorage
      }
      resolve();
    };

    request.onerror = () => {
      loadLegacyState();
      resolve();
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
      setState(JSON.parse(source));
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
      localStorage.setItem('estudo_state_emergency', JSON.stringify(state));
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
      localStorage.setItem('estudo_state_emergency', JSON.stringify(state));
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
        console.error('SyncQueue Error:', err);
      }
    }
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
  }, 2000); // 2 second debounce
}

/**
 * Salva estado no IndexedDB imediatamente
 * @param {boolean} [skipCloudSync=false] - Se true, não sincroniza com Cloudflare
 * @returns {Promise<void>}
 */
export function saveStateToDB(
  skipCloudSync = false,
  skipFirestoreSync = false,
  skipDriveSync = false,
  options = {}
) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!db) return Promise.resolve();
  emitSaveStatus('saving');

  const saveOptions = options && typeof options === 'object' ? options : {};
  if (!state.config) state.config = {};
  if (saveOptions.touchLocalBackup !== false) {
    state.config.localBackupAt = new Date().toISOString();
  }

  const prepare =
    saveOptions.touchLocalBackup === false
      ? Promise.resolve()
      : prepareEntityMetadataForSave(state, { db, storeName: ENTITY_META_STORE });

  return prepare.then(
    () =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(state, 'main_state');

        request.onsuccess = () => {
          document.dispatchEvent(
            new CustomEvent('stateSaved', {
              detail: { skipCloudSync, skipFirestoreSync, skipDriveSync },
            })
          );
          emitSaveStatus('saved');
          resolve();
        };
        request.onerror = (e) => {
          const err = request.error || e?.target?.error || e;
          emitSaveStatus('error', { detail: describeSaveFailure(err) });
          reject(err);
        };

        transaction.onerror = () => {
          const err = transaction.error || new Error('Transaction failed');
          emitSaveStatus('error', { detail: describeSaveFailure(err) });
          reject(err);
        };
      })
  );
}

/**
 * Executa migrações de schema do estado (v1 → v9)
 * @returns {void}
 */
export function runMigrations() {
  let changed = false;
  if (!state.schemaVersion || state.schemaVersion < 2) {
    if (!state.eventos) state.eventos = [];
    if (!state.revisoes) state.revisoes = [];
    if (!state.config) state.config = { visualizacao: 'mes', agruparEventos: true };
    if (!state.config.frequenciaRevisao) state.config.frequenciaRevisao = [1, 7, 30, 90];
    if (!state.habitos)
      state.habitos = {
        questoes: [],
        revisao: [],
        discursiva: [],
        simulado: [],
        leitura: [],
        informativo: [],
        sumula: [],
        videoaula: [],
        paginas: [],
      };

    // Add IDs where missing
    if (!state.editais) state.editais = [];
    state.editais.forEach((ed) => {
      if (!ed.id) ed.id = 'ed_' + uid();
      if (!ed.cor) ed.cor = '#8aa4bf';
      // Migration: flatten grupos into disciplinas
      if (ed.grupos && !ed.disciplinas) {
        ed.disciplinas = [];
        ed.grupos.forEach((gr) => {
          gr.disciplinas.forEach((d) => ed.disciplinas.push(d));
        });
        delete ed.grupos;
      }
      if (!ed.disciplinas) ed.disciplinas = [];
      ed.disciplinas.forEach((d) => {
        if (!d.id) d.id = 'disc_' + uid();
        if (!d.icone) d.icone = '📖';
        if (!d.assuntos) d.assuntos = [];
        d.assuntos.forEach((a) => {
          if (!a.id) a.id = 'ass_' + uid();
          if (!a.revisoesFetas) a.revisoesFetas = [];
        });
      });
    });

    state.schemaVersion = 2;
    changed = true;
  }

  if (state.schemaVersion === 2) {
    if (!state.arquivo) state.arquivo = [];
    if (state.config.frequenciaRevisao && typeof state.config.frequenciaRevisao === 'string') {
      state.config.frequenciaRevisao = state.config.frequenciaRevisao
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n));
    }
    state.schemaVersion = 3;
    changed = true;
  }

  if (state.schemaVersion === 3) {
    if (!state.ciclo) {
      state.ciclo = { ativo: false, ciclosCompletos: 0, disciplinas: [] };
    }
    state.schemaVersion = 4;
    changed = true;
  }

  if (state.schemaVersion === 4) {
    if (!state.planejamento) {
      state.planejamento = {
        ativo: false,
        tipo: null,
        disciplinas: [],
        relevancia: {},
        horarios: {},
        sequencia: [],
      };
    }
    state.schemaVersion = 5;
    changed = true;
  }

  // v5 and v6 were intermediate states — let the < 7 block below run the aulas migration
  if (state.schemaVersion === 5 || state.schemaVersion === 6) {
    changed = true;
  }

  // Normalize habitos keys
  if (state.habitos) {
    if (state.habitos.sumulas && !state.habitos.sumula) {
      state.habitos.sumula = state.habitos.sumulas;
      delete state.habitos.sumulas;
    }
    if (!state.habitos.videoaula) state.habitos.videoaula = [];
    if (!state.habitos.sumula) state.habitos.sumula = [];
    if (!state.habitos.paginas) state.habitos.paginas = [];
  }

  // Wave 39: Separation between Assuntos (Edital Topics) and Aulas (Course Materials)
  if (state.schemaVersion < 7) {
    if (!state.bancaRelevance)
      state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
    if (!state.bancaRelevance.lessonMappings) state.bancaRelevance.lessonMappings = {};

    const classRegex = /(^aula\s*\d+)|(^modulo\s*\d+)/i;

    state.editais.forEach((ed) => {
      ed.disciplinas.forEach((d) => {
        if (!d.aulas) d.aulas = []; // Initialize aulas array

        // Ensure reverse link exists on old items
        d.assuntos.forEach((a) => {
          if (!a.linkedAulaIds) a.linkedAulaIds = [];
        });

        // Scan for lesson-like topics and migrate them
        const remainingAssuntos = [];
        d.assuntos.forEach((ass) => {
          if (classRegex.test(ass.nome.trim())) {
            // Is a lesson! Move to disc.aulas
            const newAula = {
              id: 'aula_' + uid(),
              legacyAssid: ass.id, // For tracking
              nome: ass.nome,
              descricao: ass.descricao || '',
              estudada: !!ass.concluido,
              dataEstudo: ass.dataConclusao || null,
              progress: 0,
              linkedAssuntoIds: [], // Will be populated by ML Mapping
              _migratedFromV6: true,
            };
            d.aulas.push(newAula);
          } else {
            // It is an actual Subject topic, keep it in assuntos
            remainingAssuntos.push(ass);
          }
        });

        d.assuntos = remainingAssuntos;
      });
    });

    state.schemaVersion = 7;
    changed = true;
  }

  // v7 → v8: Add archive flag to disciplines
  if (state.schemaVersion < 8) {
    (state.editais || []).forEach((ed) => {
      (ed.disciplinas || []).forEach((d) => {
        if (d.arquivada === undefined) d.arquivada = false;
        if (d.arquivadaEm === undefined) d.arquivadaEm = null;
      });
    });
    state.schemaVersion = 8;
    changed = true;
  }

  // v8 -> v9: Prepare entity-level sync metadata without creating tombstones.
  if (state.schemaVersion < 9) {
    normalizeEntityMetadata(state, { baselineOnly: true });
    state.schemaVersion = 9;
    changed = true;
  }

  if (changed) scheduleSave();
  // archiveOldEvents removido do boot — disponível manualmente em Configurações
}

// Clean up state (called by clearAllData in views.js which already double-confirms)
export function clearData() {
  credentialsStore.clearAllCredentials().catch((err) => {
    console.error('Erro ao limpar credenciais:', err);
  });
  setState({
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      sequencia: [],
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
      entityTombstones: [],
      firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
      entitySync: { ...DEFAULT_ENTITY_SYNC_CONFIG },
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
