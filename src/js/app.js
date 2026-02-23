// =============================================
// APP STATE & DATA
// =============================================
let currentView = 'home';
let calDate = new Date();
let calViewMode = 'mes';
let timerIntervals = {};   // eventId → intervalId
let editingEventId = null;
let editingDiscCtx = null; // { editaId, grupoId }
let editingSubjectCtx = null; // { editaId, grupoId, discId }
let currentHabitType = null;

const HABIT_TYPES = [
  { key: 'questoes', label: 'Questões', icon: '📝', color: '#3b82f6' },
  { key: 'revisao', label: 'Revisão', icon: '🔄', color: '#10b981' },
  { key: 'discursiva', label: 'Discursiva', icon: '✍️', color: '#f59e0b' },
  { key: 'simulado', label: 'Simulado', icon: '🎯', color: '#ef4444' },
  { key: 'leitura', label: 'Leitura Seca', icon: '📖', color: '#8b5cf6' },
  { key: 'informativo', label: 'Informativos', icon: '📰', color: '#06b6d4' },
  { key: 'sumula', label: 'Súmulas', icon: '⚖️', color: '#6366f1' }
];


// =============================================
// NAVIGATION
// =============================================
function navigate(view) {
  if (window.innerWidth <= 768) closeSidebar();
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderCurrentView();
}

function updateTopbar() {
  const titles = {
    home: 'Página Inicial', med: 'Meu Estudo Diário', calendar: 'Calendário',
    dashboard: 'Dashboard', revisoes: 'Revisões', habitos: 'Hábitos',
    editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações'
  };
  document.getElementById('topbar-title').textContent = titles[currentView] || '';

  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('pt-BR', opts);

  const actions = document.getElementById('topbar-actions');
  if (currentView === 'home' || currentView === 'med') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Novo Evento</button>`;
  } else if (currentView === 'editais') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openEditaModal()"><i class="fa fa-plus"></i> Novo Edital</button>`;
  } else if (currentView === 'habitos') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openHabitModal(null)"><i class="fa fa-plus"></i> Registrar Hábito</button>`;
  } else if (currentView === 'calendar') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Novo Evento</button>`;
  } else {
    actions.innerHTML = '';
  }
}

// =============================================
// HELPERS
// =============================================
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let _todayCache = null;
function invalidateTodayCache() { _todayCache = null; }
function todayStr() {
  if (!_todayCache) _todayCache = new Date().toISOString().split('T')[0];
  return _todayCache;
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getEventStatus(evento) {
  const today = todayStr();
  if (evento.status === 'estudei') return 'estudei';
  if (!evento.data || evento.data > today) return 'agendado';
  if (evento.data < today) return 'atrasado';
  return 'agendado';
}

function cutoffDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// UI Modals
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Custom Confirm
let _confirmCallback = null;
function showConfirm(msg, onYes, opts = {}) {
  const { title = 'Confirmar', label = 'Confirmar', danger = false } = opts;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = label;
  okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;
  _confirmCallback = onYes;
  openModal('modal-confirm');
}

document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  closeModal('modal-confirm');
  if (_confirmCallback) { const cb = _confirmCallback; _confirmCallback = null; cb(); }
});
document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
  closeModal('modal-confirm');
  _confirmCallback = null;
});

// Toast Notifications
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const last = container.lastElementChild;
  if (last && last.dataset.msg === msg) {
    last.classList.remove('show');
    void last.offsetWidth;
    last.classList.add('show');
    return;
  }
  while (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    oldest.classList.remove('show');
    setTimeout(() => oldest.remove(), 300);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.msg = msg;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || '💬'}</span> <span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('show'); });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Sidebars
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// Init Setup
function applyTheme(toggle = false) {
  if (toggle) {
    state.config.darkMode = !state.config.darkMode;
    scheduleSave();
  }
  document.documentElement.setAttribute('data-theme', state.config.darkMode ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = state.config.darkMode ? '☀️ Modo escuro' : '🌙 Modo claro';
}

function init() {
  document.body.innerHTML += '<div style="background:blue;color:white;z-index:999999;position:relative;">1: init start</div>';
  console.log('init start');
  initDB().then(() => {
    document.body.innerHTML += '<div style="background:blue;color:white;z-index:999999;position:relative;">2: initDB done</div>';
    console.log('initDB done');
    applyTheme();
    updateDriveUI();
    if (state.config.clientId && state.config.driveConnected) {
      initGoogleAPIs();
    }

    document.body.innerHTML += '<div style="background:blue;color:white;z-index:999999;position:relative;">3: before navigate</div>';
    console.log('before navigate');
    try {
      navigate('home');
      document.body.innerHTML += '<div style="background:green;color:white;z-index:999999;position:relative;">4: navigate SUCCESS</div>';
    } catch (err) {
      document.body.innerHTML += '<div style="background:red;color:white;padding:20px;z-index:999999;position:relative;">NAVIGATE ERROR: ' + err.stack + '</div>';
    }

    // Auto Update states
    state.eventos.forEach(ev => {
      if (ev.status === 'agendado' && ev.data && ev.data < todayStr()) {
        ev.status = 'atrasado';
      }
    });
    scheduleSave();

    // Check Drive Sync Every 5 Min
    setInterval(() => {
      if (state.config.driveConnected) syncWithDrive();
    }, 300000);
  }).catch(err => {
    document.body.innerHTML += '<div style="background:red;color:white;padding:20px;z-index:999999;position:relative;">INIT ERROR: ' + err.stack + '</div>';
  });
}

// Start application
window.addEventListener('DOMContentLoaded', init);
