import { renderCurrentView } from './components.js';
import { openAddEventModal, openEditaModal, openHabitModal } from './views.js';
import { initDB, scheduleSave, state } from './store.js';
import { initGoogleAPIs, updateDriveUI, syncWithDrive } from './drive-sync.js';

// =============================================
// APP STATE & DATA
// =============================================
export let currentView = 'home';
export let calDate = new Date();
export let calViewMode = 'mes';
export let timerIntervals = {};   // eventId → intervalId
export let editingEventId = null;
export let editingDiscCtx = null; // { editaId }
export let editingSubjectCtx = null; // { editaId, discId }
export let currentHabitType = null;

export const HABIT_TYPES = [
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
export function navigate(view) {
  if (window.innerWidth <= 768) closeSidebar();
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderCurrentView();
}

export function updateTopbar() {
  const titles = {
    home: 'Página Inicial', med: 'Meu Estudo Diário', calendar: 'Calendário',
    dashboard: 'Dashboard', revisoes: 'Revisões', habitos: 'Hábitos',
    editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações',
    ciclo: 'Ciclo de Estudos'
  };
  document.getElementById('topbar-title').textContent = titles[currentView] || '';

  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('pt-BR', opts);

  const actions = document.getElementById('topbar-actions');
  if (currentView === 'home' || currentView === 'med') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Iniciar Estudo</button>`;
  } else if (currentView === 'editais') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openEditaModal()"><i class="fa fa-plus"></i> Novo Edital</button>`;
  } else if (currentView === 'habitos') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openHabitModal(null)"><i class="fa fa-plus"></i> Registrar Hábito</button>`;
  } else if (currentView === 'calendar') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Iniciar Estudo</button>`;
  } else if (currentView === 'ciclo') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-replanejar-ciclo"><i class="fa fa-cog"></i> Configurar Ciclo</button>`;
  } else {
    actions.innerHTML = '';
  }
}

// =============================================
// HELPERS
// =============================================
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export let _todayCache = null;
export function invalidateTodayCache() { _todayCache = null; }
export function todayStr() {
  if (!_todayCache) _todayCache = new Date().toISOString().split('T')[0];
  return _todayCache;
}

export function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function pad(n) { return String(n).padStart(2, '0'); }

export function getEventStatus(evento) {
  const today = todayStr();
  if (evento.status === 'estudei') return 'estudei';
  if (!evento.data || evento.data > today) return 'agendado';
  if (evento.data < today) return 'atrasado';
  return 'agendado';
}

export function cutoffDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// UI Modals
export function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
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
  toast.innerHTML = `<span>${icons[type] || '💬'}</span> <span>${msg}</span>`;
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
    scheduleSave();
  }
  document.documentElement.setAttribute('data-theme', state.config.darkMode ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = state.config.darkMode ? '☀️ Modo escuro' : '🌙 Modo claro';
}

export function init() {
  initDB().then(() => {
    applyTheme();
    updateDriveUI();
    if (state.config.clientId && state.config.driveConnected) {
      initGoogleAPIs();
    }
    navigate('home');

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
  });
}

// Start application
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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

// =============================================
// CICLO WIZARD E CONTROLES
// =============================================
let _wizardStep = 1;
let _wizardDisc = [];

export function replanejarCiclo() {
  _wizardStep = 1;
  if (state.ciclo && state.ciclo.ativo && state.ciclo.disciplinas && state.ciclo.disciplinas.length > 0) {
    _wizardDisc = JSON.parse(JSON.stringify(state.ciclo.disciplinas));
  } else {
    _wizardDisc = [];
  }
  renderCicloWizard();
  openModal('modal-ciclo');
}

function renderCicloWizard() {
  const body = document.getElementById('modal-ciclo-body');
  const btnNext = document.getElementById('btn-ciclo-next');
  const btnPrev = document.getElementById('btn-ciclo-prev');

  if (_wizardStep === 1) {
    btnPrev.style.display = 'none';
    btnNext.innerHTML = 'Próximo <i class="fa fa-arrow-right"></i>';
    btnNext.onclick = () => {
      const inputs = body.querySelectorAll('.wizard-disc-input');
      const colors = body.querySelectorAll('.wizard-color-input');
      const mins = body.querySelectorAll('.wizard-min-input');

      _wizardDisc = [];
      inputs.forEach((inp, i) => {
        const val = inp.value.trim();
        const minVal = parseInt(mins[i].value, 10);
        if (val && minVal > 0) {
          _wizardDisc.push({
            id: 'cdisc_' + Date.now() + i,
            nome: val,
            cor: colors[i].value || '#3b82f6',
            planejadoMin: minVal,
            estudadoMin: 0,
            concluido: false
          });
        }
      });

      if (_wizardDisc.length === 0) {
        showToast('Adicione pelo menos uma disciplina.', 'error');
        return;
      }
      _wizardStep = 2;
      renderCicloWizard();
    };

    // Step 1: Editor de disciplinas
    body.innerHTML = `
      <div class="stepper">
        <div class="step-item active"><div class="step-circle">1</div> Disciplinas</div>
        <div class="step-item"><div class="step-circle">2</div> Ordem</div>
      </div>
      <p style="color:var(--text-secondary); margin-bottom:16px;">Adicione as disciplinas que farão parte do seu ciclo e o tempo que deseja dedicar a cada bloco (ex: 60 minutos).</p>
      <div id="wizard-disc-list">
        ${_wizardDisc.length > 0 ? _wizardDisc.map(d => window.wizardRowHtml(d.nome, d.cor, d.planejadoMin)).join('') : window.wizardRowHtml('', '#3b82f6', 60)}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="addWizardRow()" style="margin-top:12px;"><i class="fa fa-plus"></i> Adicionar disciplina</button>
    `;
  } else if (_wizardStep === 2) {
    btnPrev.style.display = 'block';
    btnPrev.onclick = () => { _wizardStep = 1; renderCicloWizard(); };
    btnNext.innerHTML = 'Salvar Ciclo <i class="fa fa-check"></i>';
    btnNext.onclick = () => {
      const orderIds = [...body.querySelectorAll('.ciclo-disc-row')].map(el => el.dataset.id);
      const reordered = [];
      orderIds.forEach(id => {
        const found = _wizardDisc.find(d => d.id === id);
        if (found) reordered.push(found);
      });
      if (reordered.length === 0) reordered.push(..._wizardDisc);

      if (!state.ciclo) state.ciclo = { ciclosCompletos: 0 };
      state.ciclo.ativo = true;
      state.ciclo.disciplinas = reordered;
      scheduleSave();
      closeModal('modal-ciclo');
      if (currentView === 'ciclo') renderCurrentView();
      showToast('Ciclo configurado!', 'success');
    };

    // Step 2: Ordenação via Drag
    body.innerHTML = `
      <div class="stepper">
        <div class="step-item done"><div class="step-circle"><i class="fa fa-check"></i></div> Disciplinas</div>
        <div class="step-item active"><div class="step-circle">2</div> Ordem</div>
      </div>
      <p style="color:var(--text-secondary); margin-bottom:16px;">Arraste para definir a ordem de estudo do ciclo.</p>
      <div id="wizard-reorder-list">
        ${_wizardDisc.map((d, i) => `
          <div class="ciclo-disc-row" draggable="true" data-id="${d.id}" ondragstart="wizardDragStart(event)" ondragover="wizardDragOver(event)" ondrop="wizardDrop(event)" style="cursor:grab; justify-content:flex-start; align-items:center; padding:12px 16px;">
            <i class="fa fa-bars ciclo-disc-drag" style="padding:0; margin-right:12px; font-size:16px;"></i>
            <div style="width:16px;height:16px;border-radius:4px;background:${d.cor};margin-right:12px;"></div>
            <div style="flex:1; font-weight:600; font-size:15px;">${esc(d.nome)}</div>
            <div style="font-size:13px; color:var(--text-muted); font-variant-numeric: tabular-nums;">${d.planejadoMin} min</div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

window.wizardRowHtml = (nome = '', cor = '#3b82f6', min = 60) => `
  <div class="ciclo-disc-row" style="align-items:center; padding:8px 12px; margin-bottom:10px;">
     <input type="color" class="wizard-color-input" value="${cor}" style="width:36px; height:36px; padding:0; border:none; border-radius:6px; background:none; cursor:pointer;" title="Cor">
     <input type="text" class="form-control wizard-disc-input" style="flex:1; font-size:14px;" placeholder="Nome da Disciplina" value="${esc(nome)}">
     <input type="text" inputmode="numeric" pattern="[0-9]*" class="form-control wizard-min-input" style="width:70px; font-size:14px; text-align:center;" placeholder="Min" value="${min}">
     <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="color:var(--red); padding:8px 10px;" title="Remover"><i class="fa fa-trash"></i></button>
  </div>
`;

window.addWizardRow = () => {
  const list = document.getElementById('wizard-disc-list');
  if (list) list.insertAdjacentHTML('beforeend', window.wizardRowHtml('', '#3b82f6', 60));
};

let _dragSrcEl = null;
window.wizardDragStart = function (e) {
  _dragSrcEl = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', _dragSrcEl.innerHTML);
  _dragSrcEl.style.opacity = '0.5';
};
window.wizardDragOver = function (e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
};
window.wizardDrop = function (e) {
  e.stopPropagation();
  const target = e.currentTarget;
  if (_dragSrcEl) _dragSrcEl.style.opacity = '1';
  if (_dragSrcEl !== target) {
    const srcId = _dragSrcEl.dataset.id;
    const tgtId = target.dataset.id;
    _dragSrcEl.innerHTML = target.innerHTML;
    _dragSrcEl.dataset.id = tgtId;
    target.innerHTML = e.dataTransfer.getData('text/html');
    target.dataset.id = srcId;
  }
  return false;
};
document.addEventListener('dragend', (e) => {
  if (_dragSrcEl) _dragSrcEl.style.opacity = '1';
});

export function removerCiclo() {
  showConfirm('Tem certeza que deseja apagar todo o Ciclo Atual? Seu histórico de Ciclos Completos será perdido.', () => {
    state.ciclo = { ativo: false, ciclosCompletos: 0, disciplinas: [] };
    scheduleSave();
    if (currentView === 'ciclo') renderCurrentView();
  }, { danger: true, title: 'Remover Ciclo' });
}

export function recomecarCiclo() {
  showConfirm('Isto irá zerar o tempo estudado de todas as disciplinas do ciclo atual, mantendo a ordem e as disciplinas intactas.', () => {
    if (state.ciclo && state.ciclo.disciplinas) {
      state.ciclo.disciplinas.forEach(d => {
        d.estudadoMin = 0;
        d.concluido = false;
      });
      scheduleSave();
      if (currentView === 'ciclo') renderCurrentView();
      showToast('Ciclo reiniciado com sucesso!', 'success');
    }
  });
}

export function toggleCicloFin(checked) {
  window._hideConcluidosCiclo = checked;
  if (currentView === 'ciclo') renderCurrentView();
}
