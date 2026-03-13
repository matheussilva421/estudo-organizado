import { renderCurrentView } from './components.js?v=8.2';
import { initDB, scheduleSave, state } from './store.js?v=8.2';
import { initGoogleAPIs, updateDriveUI, syncWithDrive } from './drive-sync.js?v=8.2';
import { todayStr, esc } from './utils.js?v=8.2';
import { pullFromCloudflare } from './cloud-sync.js?v=8.2';
import { initNotifications } from './notifications.js?v=8.2';

// =============================================
// APP STATE & DATA
// =============================================
export let currentView = 'home';
let _driveSyncInterval = null;

document.addEventListener('app:driveDisconnected', () => {
  if (_driveSyncInterval) {
    clearInterval(_driveSyncInterval);
    _driveSyncInterval = null;
  }
});


// =============================================
// NAVIGATION
// =============================================
export function navigate(view) {
  // Keep navigation responsive even if a modal is currently open.
  // This prevents stale overlays from trapping pointer events after view switches.
  document.querySelectorAll('.modal-overlay.open').forEach((modal) => {
    closeModal(modal.id);
  });

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
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  const hasOpenModal = document.querySelector('.modal-overlay.open');
  document.body.style.overflow = hasOpenModal ? 'hidden' : '';
}

// Custom Confirm
export let _confirmCallback = null;
export function showConfirm(msg, onYes, opts = {}) {
  const { title = 'Confirmar', label = 'Confirmar', danger = false } = opts;
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-msg');
  const okBtn = document.getElementById('confirm-ok-btn');

  if (!titleEl || !msgEl || !okBtn) {
    console.error('showConfirm: elementos do modal não encontrados');
    return;
  }

  titleEl.textContent = title;
  msgEl.textContent = msg;
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
  if (!container) return;

  const last = container.lastElementChild;
  if (last && last.dataset.msg === msg) {
    last.classList.remove('show');
    void last.offsetWidth;
    last.classList.add('show');
    return;
  }
  while (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    oldest.remove();
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

  // Auto-dismiss with pause on hover
  let dismissTimeout;
  const scheduleDismiss = () => {
    dismissTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const cancelDismiss = () => {
    if (dismissTimeout) clearTimeout(dismissTimeout);
  };

  toast.addEventListener('mouseenter', cancelDismiss);
  toast.addEventListener('mouseleave', scheduleDismiss);
  toast.addEventListener('click', () => toast.remove());

  requestAnimationFrame(() => { toast.classList.add('show'); });
  scheduleDismiss();
}

// Sidebars
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

export function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  // Salvar preferencia
  if (sidebar.classList.contains('collapsed')) {
    localStorage.setItem('estudo_sidebar_collapsed', 'true');
  } else {
    localStorage.removeItem('estudo_sidebar_collapsed');
  }
}

// Init Setup
export function applyTheme(toggle = false) {
  if (toggle) {
    const currentTheme = state.config.tema || (state.config.darkMode ? 'dark' : 'light');
    if (currentTheme === 'light') {
      // Switch to last used dark theme, or default 'dark'
      const lastDark = state.config.lastDarkTheme || 'dark';
      state.config.tema = lastDark;
      state.config.darkMode = true;
    } else {
      // Save current dark theme for later toggle back
      state.config.lastDarkTheme = currentTheme;
      state.config.tema = 'light';
      state.config.darkMode = false;
    }
    scheduleSave();
  }
  const theme = state.config.tema || (state.config.darkMode ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const isLight = theme === 'light';
    btn.textContent = isLight ? '🌙 Modo escuro' : '☀️ Modo claro';
  }
}

export function init() {
  initDB().then(async () => {
    // Notify modules that state is loaded from IndexedDB
    document.dispatchEvent(new Event('app:stateLoaded'));
    applyTheme();
    initNotifications();

    // Restaurar estado da sidebar (collapsed/expanded)
    const sidebarCollapsed = localStorage.getItem('estudo_sidebar_collapsed') === 'true';
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    }

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
    const content = document.getElementById('main-content');
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
    <input type="date" id="prompt-input-data" class="form-control" value="${esc(atual)}">
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
      <input type="number" id="prompt-input-horas" class="form-control" value="${esc(horas)}" min="1" max="168">
    </div>
    <div style="margin-bottom:12px;">
      <label class="form-label">Meta de Questões (por semana)</label>
      <input type="number" id="prompt-input-quest" class="form-control" value="${esc(quest)}" min="1">
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
