// =============================================
// SCHEMA & STATE MANAGEMENT (INDEXEDDB)
// =============================================
import { pushToCloudflare } from './cloud-sync.js';
import { uid } from './utils.js';

export const DB_NAME = 'EstudoOrganizadoDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'app_state';

export let db;
export const DEFAULT_SCHEMA_VERSION = 7;

export function setState(newState) {
  const normalized = {
    schemaVersion: newState.schemaVersion || DEFAULT_SCHEMA_VERSION,
    ciclo: newState.ciclo || { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: newState.planejamento || { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [], ciclosCompletos: 0, dataInicioCicloAtual: null },
    editais: newState.editais || [],
    eventos: newState.eventos || [],
    arquivo: newState.arquivo || [],
    habitos: Object.assign({ questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [] }, newState.habitos || {}),
    revisoes: newState.revisoes || [],
    config: Object.assign({ visualizacao: 'mes', primeirodiaSemana: 1, mostrarNumeroSemana: false, agruparEventos: true, frequenciaRevisao: [1, 7, 30, 90], materiasPorDia: 3 }, newState.config || {}),
    cronoLivre: newState.cronoLivre || { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: newState.bancaRelevance || { hotTopics: [], userMappings: {} },
    driveFileId: newState.driveFileId || null,
    lastSync: newState.lastSync || null
  };

  // Replace the state object properties instead of the reference
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, normalized);
}

export let state = {
  schemaVersion: DEFAULT_SCHEMA_VERSION,
  ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
  planejamento: { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [], ciclosCompletos: 0, dataInicioCicloAtual: null },
  editais: [],
  eventos: [],
  arquivo: [], // concluded events older than 90 days
  habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [] },
  revisoes: [],
  config: {
    visualizacao: 'mes',
    primeirodiaSemana: 1,
    mostrarNumeroSemana: false,
    agruparEventos: true,
    frequenciaRevisao: [1, 7, 30, 90],
    materiasPorDia: 3
  },
  cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
  bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
  driveFileId: null,
  lastSync: null
};

// Initialize DB and load state
export function initDB() {
  return new Promise((resolve, reject) => {
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
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      loadStateFromDB().then(() => {
        resolve();
      });
    };
  });
}

export function loadStateFromDB() {
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('main_state');

    request.onsuccess = (event) => {
      if (request.result) {
        const loadedState = request.result;

        // BUG 3: Prevenir persistência inflada de timer ao fechar a aba
        const isSameSession = sessionStorage.getItem('estudo_session_active');
        if (!isSameSession) {
          if (loadedState.cronoLivre && loadedState.cronoLivre._timerStart) {
            loadedState.cronoLivre._timerStart = null;
          }
          if (loadedState.eventos) {
            loadedState.eventos.forEach(ev => {
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
  });
}

// Fallback to load from LocalStorage (migration path for old users)
export function loadLegacyState() {
  try {
    const saved = localStorage.getItem('estudo_state');
    if (saved) {
      setState(JSON.parse(saved));
      runMigrations();
      scheduleSave(); // Save to IndexedDB immediately
      localStorage.removeItem('estudo_state'); // Clean up old storage
    }
  } catch (e) {
    console.error('Error loading legacy state:', e);
  }
}

// Save state to IndexedDB with debounce
export let saveTimeout = null;

window.addEventListener('beforeunload', (e) => {
  if (saveTimeout !== null) {
    e.preventDefault();
    e.returnValue = 'Há alterações pendentes aguardando salvamento. Deseja sair assim mesmo?';
    return e.returnValue;
  }
});

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
  }
};

export function scheduleSave() {
  document.dispatchEvent(new Event('app:invalidateCaches'));
  if (saveTimeout) clearTimeout(saveTimeout);

  // Update badges instantly without waiting for the save
  document.dispatchEvent(new Event('app:updateBadges'));

  saveTimeout = setTimeout(() => {
    saveStateToDB();
  }, 2000); // 2 second debounce
}

// Immediate save (used before closures or explicit syncs)
export function saveStateToDB() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!db) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(state, 'main_state');

    request.onsuccess = () => {
      document.dispatchEvent(new Event('stateSaved'));

      // Cascata de Sincronização: Local -> Cloudflare
      if (state.config && state.config.cfSyncSyncEnabled && typeof pushToCloudflare === 'function') {
        SyncQueue.add(() => pushToCloudflare());
      }

      resolve();
    };
    request.onerror = (e) => reject(e);
  });
}

// Migration Logic
export function runMigrations() {
  let changed = false;
  if (!state.schemaVersion || state.schemaVersion < 2) {
    if (!state.eventos) state.eventos = [];
    if (!state.revisoes) state.revisoes = [];
    if (!state.config) state.config = { visualizacao: 'mes', agruparEventos: true };
    if (!state.config.frequenciaRevisao) state.config.frequenciaRevisao = [1, 7, 30, 90];
    if (!state.habitos) state.habitos = { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [] };

    // Add IDs where missing
    state.editais.forEach(ed => {
      if (!ed.id) ed.id = 'ed_' + uid();
      if (!ed.cor) ed.cor = '#10b981';
      // Migration: flatten grupos into disciplinas
      if (ed.grupos && !ed.disciplinas) {
        ed.disciplinas = [];
        ed.grupos.forEach(gr => {
          gr.disciplinas.forEach(d => ed.disciplinas.push(d));
        });
        delete ed.grupos;
      }
      if (!ed.disciplinas) ed.disciplinas = [];
      ed.disciplinas.forEach(d => {
        if (!d.id) d.id = 'disc_' + uid();
        if (!d.icone) d.icone = '📖';
        if (!d.assuntos) d.assuntos = [];
        d.assuntos.forEach(a => {
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
      state.config.frequenciaRevisao = state.config.frequenciaRevisao.split(',').map(Number).filter(n => !isNaN(n));
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
      state.planejamento = { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [] };
    }
    state.schemaVersion = 5;
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
  }

  // Wave 39: Separation between Assuntos (Edital Topics) and Aulas (Course Materials)
  if (state.schemaVersion < 7) {
    if (!state.bancaRelevance) state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
    if (!state.bancaRelevance.lessonMappings) state.bancaRelevance.lessonMappings = {};

    const classRegex = /(^aula\s*\d+)|(^modulo\s*\d+)/i;
    
    state.editais.forEach(ed => {
      ed.disciplinas.forEach(d => {
        if (!d.aulas) d.aulas = []; // Initialize aulas array
        
        // Ensure reverse link exists on old items
        d.assuntos.forEach(a => {
            if (!a.linkedAulaIds) a.linkedAulaIds = [];
        });

        // Scan for lesson-like topics and migrate them
        const remainingAssuntos = [];
        d.assuntos.forEach(ass => {
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
              _migratedFromV6: true
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

  if (changed) scheduleSave();
  // archiveOldEvents removido do boot — disponível manualmente em Configurações
}














// Clean up state
export function clearData() {
  document.dispatchEvent(new CustomEvent('app:showConfirm', {
    detail: {
      msg: 'Tem certeza que deseja apagar TODOS os seus dados? Esta ação não pode ser desfeita.',
      onYes: () => {
        setState({
          schemaVersion: DEFAULT_SCHEMA_VERSION,
          ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
          planejamento: { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [], ciclosCompletos: 0, dataInicioCicloAtual: null },
          editais: [],
          eventos: [],
          arquivo: [],
          habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [] },
          revisoes: [],
          config: { visualizacao: 'mes', primeirodiaSemana: 1, mostrarNumeroSemana: false, agruparEventos: true, frequenciaRevisao: [1, 7, 30, 90] },
          driveFileId: null,
          lastSync: null
        });
        saveStateToDB().then(() => {
          document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Dados apagados com sucesso.', type: 'info' } }));
          document.dispatchEvent(new Event('app:renderCurrentView'));
        });
      },
      opts: { danger: true, label: 'Apagar tudo', title: 'Atenção' }
    }
  }));
}
