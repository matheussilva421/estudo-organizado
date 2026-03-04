import { renderCurrentView } from './components.js';
import { initDB, scheduleSave, state } from './store.js';
import { initGoogleAPIs, updateDriveUI, syncWithDrive } from './drive-sync.js';
import { todayStr, esc } from './utils.js';
import { pullFromCloudflare } from './cloud-sync.js';
import { initNotifications } from './notifications.js';

// =============================================
// APP STATE & DATA
// =============================================
export let currentView = 'home';
let _driveSyncInterval = null;


// =============================================
// NAVIGATION
// =============================================
export function navigate(view) {
  if (window.innerWidth <= 768) closeSidebar();

  if (view === 'editais') {
    window.activeDashboardDiscCtx = null;
  }

  currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderCurrentView();
}

// removed utilities to utils.js

// UI Modals
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}

// Custom Confirm
export let _confirmCallback = null;
export function showConfirm(msg, onYes, opts = {}) {
  const { title = 'Confirmar', label = 'Confirmar', danger = false } = opts;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = label;
  okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;
  _confirmCallback = onYes;
  openModal('modal-confirm');
}

export function setupConfirmHandlers() {
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  if (okBtn) okBtn.addEventListener('click', () => {
    closeModal('modal-confirm');
    if (_confirmCallback) { const cb = _confirmCallback; _confirmCallback = null; cb(); }
  });
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    cancelConfirm();
  });
}

export function cancelConfirm() {
  _confirmCallback = null;
  closeModal('modal-confirm');
}


// Toast Notifications
export function showToast(msg, type = '') {
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
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icons[type] || '💬';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  toast.appendChild(iconSpan);
  toast.appendChild(document.createTextNode(' '));
  toast.appendChild(msgSpan);
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('show'); });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Sidebars
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// Init Setup
export function applyTheme(toggle = false) {
  if (toggle) {
    state.config.darkMode = !state.config.darkMode;
    state.config.tema = state.config.darkMode ? 'dark' : 'light';
    scheduleSave();
  }
  const theme = state.config.tema || (state.config.darkMode ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = state.config.darkMode ? '☀️ Modo claro' : '🌙 Modo escuro';
}

export function init() {
  initDB().then(async () => {
    applyTheme();
    initNotifications();

    // Primeira Sincronização: Cloudflare (Primária Rápida)
    if (state.config && state.config.cfSyncEnabled) {
      try {
        await pullFromCloudflare();
      } catch (e) {
        console.error('Falha no Boot Sync (Cloudflare)', e);
      }
    }

    // Segunda Sincronização: Google Drive (Secundária Lenta)
    updateDriveUI('disconnected', 'Google Drive');
    const savedClientId = localStorage.getItem('estudo_drive_client_id');
    if (savedClientId) {
      initGoogleAPIs();
    }

    navigate('home');

    // Note: event statuses ('atrasado') are computed dynamically by getEventStatus().
    // No need to mutate or save here — avoids triggering Cloudflare push on every boot.

    // Check Drive Sync Every 5 Min
    if (_driveSyncInterval) clearInterval(_driveSyncInterval);
    _driveSyncInterval = setInterval(() => {
      if (typeof gapi !== 'undefined' && gapi.client?.getToken() !== null && state.driveFileId) syncWithDrive();
    }, 300000);
  }).catch(err => {
    console.error('Falha ao inicializar o aplicativo:', err);
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;"><h2>Erro ao carregar o aplicativo</h2><p>Tente recarregar a página. Se o erro persistir, limpe os dados do navegador.</p></div>';
    }
  });
}

// init() is called from main.js

// =============================================
// INTERACTIVE PROMPTS
// =============================================
export function promptDataProva() {
  const atual = state.config.dataProva || '';

  document.getElementById('modal-prompt-title').textContent = 'Data da Prova';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div style="margin-bottom:12px;color:var(--text-secondary);font-size:14px;">Informe a data final para os contadores regressivos.</div>
    <input type="date" id="prompt-input-data" class="form-control" value="${atual}">
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const nova = document.getElementById('prompt-input-data').value;
    if (nova.trim() === '') {
      state.config.dataProva = null;
    } else {
      if (/^\d{4}-\d{2}-\d{2}$/.test(nova)) {
        state.config.dataProva = nova;
      } else {
        showToast('Data inválida.', 'error');
        return;
      }
    }
    scheduleSave();
    if (currentView === 'home') renderCurrentView();
    closeModal('modal-prompt');
  };

  openModal('modal-prompt');
}

export function promptMetas() {
  const horas = state.config.metas?.horasSemana || 20;
  const quest = state.config.metas?.questoesSemana || 150;

  document.getElementById('modal-prompt-title').textContent = 'Metas da Semana';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div style="margin-bottom:12px;">
      <label class="form-label">Meta de Horas (por semana)</label>
      <input type="number" id="prompt-input-horas" class="form-control" value="${horas}" min="1" max="168">
    </div>
    <div style="margin-bottom:12px;">
      <label class="form-label">Meta de Questões (por semana)</label>
      <input type="number" id="prompt-input-quest" class="form-control" value="${quest}" min="1">
    </div>
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const h = parseInt(document.getElementById('prompt-input-horas').value, 10);
    const q = parseInt(document.getElementById('prompt-input-quest').value, 10);

    if (!isNaN(h) && !isNaN(q) && h > 0 && q > 0) {
      if (!state.config.metas) state.config.metas = {};
      state.config.metas.horasSemana = h;
      state.config.metas.questoesSemana = q;
      scheduleSave();
      if (currentView === 'home') renderCurrentView();
      closeModal('modal-prompt');
    } else {
      showToast('Valores inválidos. Insira números maiores que 0.', 'error');
    }
  };

  openModal('modal-prompt');
}



// recomecarCiclo is defined inside renderCiclo() in views.js
// and assigned to window.recomecarCiclo — it operates on state.planejamento


export function toggleCicloFin(checked) {
  window._hideConcluidosCiclo = checked;
  if (currentView === 'ciclo') renderCurrentView();
}

// Compat layer: removerCiclo is wired via data-action="remover-ciclo" in main.js.
// It must operate on state.planejamento (the active system) AND state.ciclo (legacy).
export function removerCiclo() {
  showConfirm('Tem certeza que deseja apagar todo o Planejamento Atual? Esta ação não pode ser desfeita.', () => {
    // Clear the active planning system
    state.planejamento = { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [] };
    // Also clear legacy ciclo if it exists
    state.ciclo = { ativo: false, ciclosCompletos: 0, disciplinas: [] };
    scheduleSave();
    if (currentView === 'ciclo') renderCurrentView();
  }, { danger: true, title: 'Remover Planejamento', label: 'Excluir' });
}
