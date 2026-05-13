// =============================================
// SCHEMA & STATE MANAGEMENT
// =============================================
import { DEFAULT_SCHEMA_VERSION } from './store/migrations.js';

import { deepClone } from './store/normalize-state.js';

import { createExportableState as _createExportableState } from './store/export-state.js';

// IndexedDB persistence layer
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  FIRESTORE_OUTBOX_STORE,
  FIRESTORE_META_STORE,
  FIRESTORE_CONFLICT_STORE,
  ENTITY_META_STORE,
  FIRESTORE_ENTITY_OUTBOX_STORE,
  LOCAL_STATE_CURRENT_KEY,
  LOCAL_STATE_PREVIOUS_KEY,
  LOCAL_STATE_LEGACY_KEY,
  db,
  saveTimeout,
  DEFAULT_FIRESTORE_SYNC_CONFIG,
  initDB,
  loadStateFromDB,
  loadLegacyState,
  saveStateToDB,
  clearData,
  scheduleSave,
  describeSaveFailure,
  SyncQueue,
  runMigrations,
  _bindState,
  _bindSetState,
} from './store/indexeddb.js';

export { DEFAULT_SCHEMA_VERSION };

export {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  FIRESTORE_OUTBOX_STORE,
  FIRESTORE_META_STORE,
  FIRESTORE_CONFLICT_STORE,
  ENTITY_META_STORE,
  FIRESTORE_ENTITY_OUTBOX_STORE,
  LOCAL_STATE_CURRENT_KEY,
  LOCAL_STATE_PREVIOUS_KEY,
  LOCAL_STATE_LEGACY_KEY,
  db,
  saveTimeout,
  DEFAULT_FIRESTORE_SYNC_CONFIG,
  initDB,
  loadStateFromDB,
  loadLegacyState,
  saveStateToDB,
  clearData,
  scheduleSave,
  describeSaveFailure,
  SyncQueue,
  runMigrations,
};

export {
  createLocalStateEnvelope,
  isLocalStateEnvelopeValid,
  pickRecoverableLocalState,
} from './store/normalize-state.js';

/**
 * Atualiza o estado global com deep clone para prevenir mutações
 * @param {Object} newState - Novo estado parcial ou completo
 * @param {Object} [options] - Opções adicionais
 * @param {boolean} [options.merge=false] - Se true, faz merge profundo preservando dados existentes
 */
export function setState(newState, options = {}) {
  const merge = options.merge === true;

  // Helper: deep merge two values
  const mergeValues = (oldVal, newVal) => {
    if (newVal === undefined || newVal === null) return oldVal;
    if (Array.isArray(newVal)) {
      if (!Array.isArray(oldVal)) return deepClone(newVal);
      // Merge arrays by ID if items have id field
      if (
        newVal.length > 0 &&
        typeof newVal[0] === 'object' &&
        newVal[0] !== null &&
        'id' in newVal[0]
      ) {
        const oldMap = new Map(oldVal.map((item) => [item.id, item]));
        const merged = newVal.map((item) => {
          if (item.id && oldMap.has(item.id)) {
            // Merge: prefer new value but preserve old fields not in new
            return { ...oldMap.get(item.id), ...item };
          }
          return item;
        });
        // Keep old items that weren't in new array
        for (const oldItem of oldVal) {
          if (!newVal.some((n) => n.id === oldItem.id)) {
            merged.push(oldItem);
          }
        }
        return deepClone(merged);
      }
      // For arrays without IDs, keep the longer one
      return deepClone(newVal.length >= oldVal.length ? newVal : oldVal);
    }
    if (typeof newVal === 'object' && typeof oldVal === 'object' && oldVal !== null) {
      // Deep merge objects
      const merged = { ...oldVal };
      for (const key of Object.keys(newVal)) {
        merged[key] = mergeValues(oldVal[key], newVal[key]);
      }
      return merged;
    }
    return deepClone(newVal);
  };

  const normalized = {
    schemaVersion: newState.schemaVersion || (merge ? state.schemaVersion : DEFAULT_SCHEMA_VERSION),
    ciclo: merge
      ? mergeValues(
          state.ciclo,
          newState.ciclo || { ativo: false, ciclosCompletos: 0, disciplinas: [] }
        )
      : deepClone(newState.ciclo || { ativo: false, ciclosCompletos: 0, disciplinas: [] }),
    planejamento: merge
      ? mergeValues(
          state.planejamento,
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
        )
      : deepClone(
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
    editais: merge
      ? mergeValues(state.editais, Array.isArray(newState.editais) ? newState.editais : [])
      : deepClone(Array.isArray(newState.editais) ? newState.editais : []),
    eventos: merge
      ? mergeValues(state.eventos, Array.isArray(newState.eventos) ? newState.eventos : [])
      : deepClone(Array.isArray(newState.eventos) ? newState.eventos : []),
    arquivo: merge
      ? mergeValues(state.arquivo, Array.isArray(newState.arquivo) ? newState.arquivo : [])
      : deepClone(Array.isArray(newState.arquivo) ? newState.arquivo : []),
    // Hábitos e Histórico
    habitos: merge
      ? mergeValues(
          state.habitos,
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
            typeof newState.habitos === 'object' && newState.habitos !== null
              ? newState.habitos
              : {}
          )
        )
      : deepClone(
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
            typeof newState.habitos === 'object' && newState.habitos !== null
              ? newState.habitos
              : {}
          )
        ),
    revisoes: merge
      ? mergeValues(state.revisoes, Array.isArray(newState.revisoes) ? newState.revisoes : [])
      : deepClone(Array.isArray(newState.revisoes) ? newState.revisoes : []),
    config: merge
      ? mergeValues(
          state.config,
          Object.assign(
            {
              visualizacao: 'mes',
              primeirodiaSemana: 1,
              mostrarNumeroSemana: false,
              agruparEventos: true,
              frequenciaRevisao: [1, 7, 30, 90],
              materiasPorDia: 3,
              globalSyncPaused: true,
              firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
            },
            newState.config || {}
          )
        )
      : deepClone(
          Object.assign(
            {
              visualizacao: 'mes',
              primeirodiaSemana: 1,
              mostrarNumeroSemana: false,
              agruparEventos: true,
              frequenciaRevisao: [1, 7, 30, 90],
              materiasPorDia: 3,
              globalSyncPaused: true,
              firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
            },
            newState.config || {}
          )
        ),
    cronoLivre: merge
      ? mergeValues(
          state.cronoLivre,
          newState.cronoLivre || { _timerStart: null, tempoAcumulado: 0 }
        )
      : deepClone(newState.cronoLivre || { _timerStart: null, tempoAcumulado: 0 }),
    bancaRelevance: merge
      ? mergeValues(
          state.bancaRelevance,
          newState.bancaRelevance || { hotTopics: [], userMappings: {}, lessonMappings: {} }
        )
      : deepClone(
          newState.bancaRelevance || { hotTopics: [], userMappings: {}, lessonMappings: {} }
        ),
    driveFileId:
      newState.driveFileId !== undefined ? newState.driveFileId : merge ? state.driveFileId : null,
    lastSync: newState.lastSync !== undefined ? newState.lastSync : merge ? state.lastSync : null,
  };

  // Avoid redundant deep clone — per-field cloning above already isolates state
  const cloned = normalized;
  cloned.config.firestoreSync = Object.assign(
    {},
    DEFAULT_FIRESTORE_SYNC_CONFIG,
    cloned.config.firestoreSync || {}
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
    globalSyncPaused: true,
    firestoreSync: { ...DEFAULT_FIRESTORE_SYNC_CONFIG },
  },
  cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
  bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
  driveFileId: null,
  lastSync: null,
};

_bindState(state);
_bindSetState(setState);

export function createExportableState(sourceState = state) {
  return _createExportableState(sourceState);
}
