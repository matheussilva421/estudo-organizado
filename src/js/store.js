// =============================================
// SCHEMA & STATE MANAGEMENT (INDEXEDDB)
// =============================================

const DB_NAME = 'EstudoOrganizadoDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

let db;
const DEFAULT_SCHEMA_VERSION = 3;

let state = {
  schemaVersion: DEFAULT_SCHEMA_VERSION,
  editais: [],
  eventos: [],
  arquivo: [], // concluded events older than 90 days
  habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [] },
  revisoes: [],
  config: {
    visualizacao: 'mes',
    primeirodiaSemana: 1,
    mostrarNumeroSemana: false,
    agruparEventos: true,
    frequenciaRevisao: [1, 7, 30, 90]
  },
  driveFileId: null,
  lastSync: null
};

// Initialize DB and load state
function initDB() {
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

function loadStateFromDB() {
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('main_state');

    request.onsuccess = (event) => {
      if (request.result) {
        state = request.result;
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
function loadLegacyState() {
  try {
    const saved = localStorage.getItem('estudo_state');
    if (saved) {
      state = JSON.parse(saved);
      runMigrations();
      scheduleSave(); // Save to IndexedDB immediately
      localStorage.removeItem('estudo_state'); // Clean up old storage
    }
  } catch (e) {
    console.error('Error loading legacy state:', e);
  }
}

// Save state to IndexedDB with debounce
let saveTimeout = null;
function scheduleSave() {
  invalidateDiscCache();
  invalidateRevCache();
  if (saveTimeout) clearTimeout(saveTimeout);

  // Update badges instantly without waiting for the save
  if (typeof updateBadges === 'function') updateBadges();

  saveTimeout = setTimeout(() => {
    saveStateToDB();
  }, 2000); // 2 second debounce
}

// Immediate save (used before closures or explicit syncs)
function saveStateToDB() {
  if (!db) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(state, 'main_state');

    request.onsuccess = () => {
      document.dispatchEvent(new Event('stateSaved'));
      resolve();
    };
    request.onerror = (e) => reject(e);
  });
}

// Migration Logic
function runMigrations() {
  let changed = false;
  if (!state.schemaVersion || state.schemaVersion < 2) {
    if (!state.eventos) state.eventos = [];
    if (!state.revisoes) state.revisoes = [];
    if (!state.config) state.config = { visualizacao: 'mes', agruparEventos: true };
    if (!state.config.frequenciaRevisao) state.config.frequenciaRevisao = [1, 7, 30, 90];
    if (!state.habitos) state.habitos = { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [] };

    // Add IDs where missing
    state.editais.forEach(ed => {
      if (!ed.id) ed.id = 'ed_' + Date.now() + Math.random();
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
        if (!d.id) d.id = 'disc_' + Date.now() + Math.random();
        if (!d.icone) d.icone = '📖';
        if (!d.assuntos) d.assuntos = [];
        d.assuntos.forEach(a => {
          if (!a.id) a.id = 'ass_' + Date.now() + Math.random();
          if (!a.revisoesFeitas) a.revisoesFeitas = [];
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

  if (changed) scheduleSave();
  archiveOldEvents();
}

// Fix 7: Automatic Cleanup — Archive VERY old 'estudei' events (older than 90 days)
// Prevents the main `eventos` array from ballooning indefinitely.
function archiveOldEvents() {
  const CUTOFF_DAYS = 90;
  const d = new Date();
  d.setDate(d.getDate() - CUTOFF_DAYS);
  const cutoffStr = d.toISOString().split('T')[0];

  const toArchive = state.eventos.filter(e => e.status === 'estudei' && e.data < cutoffStr);
  if (toArchive.length > 0) {
    if (!state.arquivo) state.arquivo = [];
    state.arquivo.push(...toArchive);
    state.eventos = state.eventos.filter(e => !(e.status === 'estudei' && e.data < cutoffStr));
    scheduleSave();
  }
}

// Clean up state
function clearData() {
  showConfirm('Tem certeza que deseja apagar TODOS os seus dados? Esta ação não pode ser desfeita.', () => {
    state = {
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      editais: [],
      eventos: [],
      arquivo: [],
      habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [] },
      revisoes: [],
      config: { visualizacao: 'mes', primeirodiaSemana: 1, mostrarNumeroSemana: false, agruparEventos: true, frequenciaRevisao: [1, 7, 30, 90] },
      driveFileId: null,
      lastSync: null
    };
    saveStateToDB().then(() => {
      showToast('Dados apagados com sucesso.', 'info');
      if (typeof renderCurrentView === 'function') renderCurrentView();
    });
  }, { danger: true, label: 'Apagar tudo', title: 'Atenção' });
}
