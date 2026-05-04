import { closeModal, showConfirm, showToast, openModal } from './app.js?v=8.37';
import {
  cutoffDateStr,
  esc,
  formatDate,
  formatTime,
  todayStr,
  uid,
  HABIT_TYPES,
  addCleanupListener,
} from './utils.js?v=8.37';
import { scheduleSave, state } from './store.js?v=8.37';
import {
  getActiveDisciplinas,
  getDisc,
  invalidateDiscCache,
  invalidateDashCaches,
  syncCicloToEventos,
} from './logic.js?v=8.37';
import { renderDisciplinaDashboard } from './views/dashboard-view.js';
import { renderCurrentView, renderEventCard } from './components.js?v=8.37';
import {
  setActiveDashboardDiscCtx,
  clearActiveDashboardDiscCtx,
  getActiveDashboardDiscCtx,
  setActiveDashboardTab,
  resetActiveDashboardTab,
} from './state/dashboard-context.js?v=8.37';
import { openAddEventModal, loadAssuntos } from './ui/event-modals.js?v=8.37';
import { renderVerticalList } from './views/editais-view.js';
import { setDiscChartInstance, getDiscChartInstance } from './state/chart-state.js?v=8.37';

// Module-level state (replaces window globals)
let _activeDiscManagerTab = 'topicos';
let _tempSequencia = null;
let _isEditingSequence = false;

export function getActiveDiscManagerTab() {
  return _activeDiscManagerTab;
}
export function setActiveDiscManagerTab(tab) {
  _activeDiscManagerTab = tab;
}
export function getTempSequencia() {
  return _tempSequencia;
}
export function setTempSequencia(val) {
  _tempSequencia = val;
}
export function getIsEditingSequence() {
  return _isEditingSequence;
}
export function setIsEditingSequence(val) {
  _isEditingSequence = val;
}

// Re-export from extracted view modules
export { renderHome } from './views/home-view.js';
export {
  renderCiclo,
  recomecarCiclo,
  zerarCiclosCounter,
  calculateCyclePredictions,
} from './views/ciclo-view.js';
export {
  renderHabitos,
  renderHabitHistPage,
  setHabitPage,
  openHabitModal,
  selectHabitType,
  saveHabit,
  calcSimuladoPerc,
  deleteHabito,
  HABIT_HIST_PAGE_SIZE,
  habitHistPage,
} from './views/habitos-view.js';
export {
  renderVertical,
  renderVerticalList,
  renderEditais,
  renderEditalTree,
  toggleVertDisc,
  getVertSearch,
  setVertSearch,
  getVertFilterStatus,
  setVertFilterStatus,
  getVertFilterEdital,
  setVertFilterEdital,
  getDiscFilterStatus,
  setDiscFilterStatus,
} from './views/editais-view.js';
export { renderDisciplinaDashboard } from './views/dashboard-view.js';
export {
  renderRevisoes,
  switchRevTab,
  marcarRevisao,
  adiarRevisao,
  deletarRevisao,
  getUpcomingRevisoes,
} from './views/revisao-view.js';
export {
  renderBancaAnalyzerModule,
  renderBancaAnalyzerContent,
  mudarEditalAnalisador,
  filtrarViewPorDisciplina,
  carregarAnaliseBanca,
  excluirAnaliseBanca,
  parseBancaText,
  renderBancaMatches,
  applyBancaRanking,
  openMatchCorrector,
  saveMatchCorrection,
  getAnalyzerCtx,
  setAnalyzerCtx,
} from './views/banca-view.js';
export {
  renderConfig,
  setTheme,
  updateConfig,
  toggleConfig,
  toggleCfSync,
  updateFrequencia,
  openDriveModal,
  driveDisconnect,
  archiveOldEvents,
  exportData,
  importData,
  restoreBackupFromSelectedSource,
  clearAllData,
} from './views/config-view.js';
export {
  searchBlurTimeout,
  debouncedOnSearch,
  onSearch,
  onSearchFocus,
  onSearchBlur,
  clearSearch,
} from './ui/search.js';
export {
  openAddEventModal,
  updateDayLoad,
  loadAssuntos,
  saveEvent,
  openAddPastSessionModal,
  savePastEvent,
  openEventDetail,
  refreshEventCard,
  removeDOMCard,
} from './ui/event-modals.js';
export {
  getCalDate,
  getCalViewMode,
  setCalDate,
  setCalViewMode,
  updateCalendarHeader,
  renderCalendar,
  resetCalDate,
  calNavigate,
  renderCalendarMonth,
  renderCalendarGrid,
  renderCalendarWeek,
  renderCalendarMobileMonth,
  renderCalendarMobileWeek,
} from './views/calendar-view.js';

let editingSubjectCtx = null;
let editingDiscCtx = null;

// =============================================
// LOADING SKELETONS
// =============================================
export function renderSkeletonLoader() {
  return `
    <div class="loading-skeleton">
      <div class="skeleton-stats-grid">
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-card-content">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-chart"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderSkeletonList(count = 5) {
  let html = '<div class="loading-skeleton"><div class="skeleton-list">';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-list-item">
        <div class="skeleton skeleton-list-icon"></div>
        <div class="skeleton-list-text">
          <div class="skeleton skeleton-text skeleton-text-width-md"></div>
          <div class="skeleton skeleton-text skeleton-text-width-sm"></div>
        </div>
      </div>
    `;
  }
  html += '</div></div>';
  return html;
}

export function renderSkeletonTable(rows = 5, cols = 4) {
  let html = '<div class="loading-skeleton"><table class="skeleton-table">';
  for (let i = 0; i < rows; i++) {
    html += '<tr>';
    for (let j = 0; j < cols; j++) {
      html += '<td><div class="skeleton skeleton-cell"></div></td>';
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}

// =============================================
// CONSTANTS
// =============================================
export const COLORS = [
  '#8aa4bf',
  '#7dd3a8',
  '#d8a657',
  '#ef7777',
  '#a7a4d6',
  '#b6a28a',
  '#7fb7c7',
  '#9fbf8a',
  '#c58f6b',
  '#8e9fd0',
  '#79b8ad',
  '#d58c9d',
  '#83a9cb',
  '#b7a1cf',
  '#93c9a8',
  '#c6b176',
  '#c59ac1',
  '#7f8a99',
];

export const DISC_ICONS = [
  '📚',
  '📖',
  '📝',
  '📋',
  '📊',
  '📈',
  '🔬',
  '🧪',
  '🧮',
  '💻',
  '🌍',
  '🏛️',
  '⚖️',
  '🧠',
  '💡',
  '📐',
  '🔢',
  '🗂️',
  '📜',
  '🎯',
  '🩺',
  '🔧',
  '🎨',
  '🎵',
  '🏃',
  '🌱',
  '💰',
  '📡',
  '🔐',
  '📦',
];

function getQuestionTotal(record) {
  if (!record) return 0;
  const explicit = Number(record.total ?? record.quantidade);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const acertos = Number(record.acertos ?? record.certas ?? 0);
  const erros = Number(record.erros ?? record.erradas ?? 0);
  const derived = acertos + erros;
  if (Number.isFinite(derived) && derived > 0) return derived;

  // Legacy compatibility: some old habit records store only eventoId.
  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  if (!ev) return 0;
  const qs = ev.sessao?.questoes || ev.questoes;
  if (!qs) return 0;
  const eventTotal = Number(
    qs.total ?? qs.quantidade ?? (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0)
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function getPagesTotal(record) {
  if (!record) return 0;
  const rawPages = record.paginas;
  const pagesValue = rawPages && typeof rawPages === 'object' ? rawPages.total : rawPages;
  const total = Number(record.total ?? pagesValue ?? record.quantidade ?? record.paginasLidas ?? 0);
  if (Number.isFinite(total) && total > 0) return total;

  // Legacy compatibility: some old habit records store only eventoId.
  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  if (!ev) return 0;
  const evPages = ev.sessao?.paginas;
  const eventTotal = Number(
    (evPages && typeof evPages === 'object' ? evPages.total : evPages) ?? ev.paginas ?? 0
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function sumQuestionRecords(records = []) {
  return records.reduce((sum, r) => sum + getQuestionTotal(r), 0);
}

function sumPageRecords(records = []) {
  return records.reduce((sum, r) => sum + getPagesTotal(r), 0);
}

// =============================================
// NOVO HOME VIEW (DASHBOARD REDESIGN)
// =============================================
// renderHome exported to home-view.js

// =============================================
// MED VIEW
// =============================================

// Shared stats row builder — eliminates duplication between renderMED and refreshMEDSections
function buildMEDStatsHTML(estudados, agendados) {
  const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const best =
    estudados.length > 0
      ? estudados.reduce((a, b) => ((b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a))
      : null;
  return `
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Tempo Total Hoje</div>
      <div class="dashboard-stat-value dashboard-stat-value--mono" id="total-time">${formatTime(totalSeconds)}</div>
      <div class="caption">${estudados.length} evento(s) concluido(s)</div>
    </div>
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Pendentes</div>
      <div class="text-3xl font-extrabold text-blue">${agendados.length}</div>
      <div class="caption">evento(s) para hoje</div>
    </div>
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Maior Foco</div>
      <div class="text-lg font-bold text-primary mt-2">${best ? esc(best.titulo || 'N/A') : '\u2014'}</div>
      <div class="caption">${best ? formatTime(best.tempoAcumulado || 0) : ''}</div>
    </div>`;
}

export function renderMED(el) {
  const today = todayStr();
  const todayEvents = state.eventos.filter((e) => e.data === today);
  const agendados = todayEvents.filter((e) => e.status !== 'estudei');
  const estudados = todayEvents.filter((e) => e.status === 'estudei');
  const _totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  el.innerHTML = `
    <div id="med-stats-row" class="med-stats-row">
      ${buildMEDStatsHTML(estudados, agendados)}
    </div>


        ${
          agendados.length === 0 && estudados.length === 0
            ? `
      <div class="empty-state med-empty-state">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p class="mb-4">Adicione eventos de estudo para começar a registrar seu tempo.</p>
        <button class="btn btn-primary" data-action="open-add-event"><i class="fa fa-plus"></i> Iniciar Estudo</button>
      </div>
    `
            : `
      <div id="med-section-agendado">
        ${
          agendados.length > 0
            ? `
          <div class="section-header"><h2>📌 Agendado para Hoje</h2></div>
          ${agendados.map((e) => renderEventCard(e)).join('')}
        `
            : ''
        }
      </div>
      <div id="med-section-estudado">
        ${
          estudados.length > 0
            ? `
          <div class="section-header"><h2>✅ Estudado Hoje</h2></div>
          ${estudados.map((e) => renderEventCard(e)).join('')}
        `
            : ''
        }
      </div>
    `
        }
    `;
}

export function refreshMEDSections() {
  const el = document.getElementById('main-content');
  if (!el) return;
  renderMED(el);
}

// Surgical DOM updates moved to ui/event-modals.js
// Re-exported below

// Calendar functions moved to views/calendar-view.js
// Re-exported below

// Event modal functions moved to ui/event-modals.js
// Re-exported below

export function openAddEventModalDate(dateStr) {
  openAddEventModal(dateStr);
}

// Event detail modal moved to ui/event-modals.js
// Re-exported below

// =============================================
// DASHBOARD VIEW
// =============================================
// UX 4 — DASHBOARD WITH PERIOD FILTER
// =============================================
export let dashPeriod = 7; // default: last 7 days
export let _chartDaily = null,
  _chartDisc = null;

export function destroyDashboardCharts() {
  if (_chartDaily) {
    _chartDaily.destroy();
    _chartDaily = null;
  }
  if (_chartDisc) {
    _chartDisc.destroy();
    _chartDisc = null;
  }
}

export function renderDashboard(el) {
  const periodDays = dashPeriod; // null = all time
  const periodLabel = {
    7: '7 dias',
    15: '15 dias',
    30: '30 dias',
    90: '3 meses',
    365: '1 ano',
    null: 'Total',
  }[periodDays];

  // Fix 2: compute cutoff once, reuse across all filters in this render
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  const filteredEvts = cutoffStr
    ? state.eventos.filter((e) => e.status === 'estudei' && e.data && e.data >= cutoffStr)
    : state.eventos.filter((e) => e.status === 'estudei');

  const totalSecs = filteredEvts.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const questTot = cutoffStr
    ? sumQuestionRecords((state.habitos.questoes || []).filter((r) => r.data >= cutoffStr))
    : sumQuestionRecords(state.habitos.questoes || []);
  const simTot = cutoffStr
    ? (state.habitos.simulado || []).filter((r) => r.data >= cutoffStr).length
    : (state.habitos.simulado || []).length;

  el.innerHTML = `
    <!-- Period selector -->
    <div class="flex-between mb-4">
      <div class="text-md text-secondary">Exibindo dados: <strong class="text-primary">${periodLabel}</strong></div>
      <div class="cal-view-tabs" role="tablist" aria-label="Período do dashboard">
        ${[7, 15, 30, 90, 365, null]
          .map(
            (p) => `
          <button type="button" class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" data-action="set-dash-period" data-period="${p}" role="tab" aria-selected="${dashPeriod === p}">
            ${{ 7: '7d', 15: '15d', 30: '30d', 90: '3m', 365: '1a', null: 'Total' }[p]}
          </button>`
          )
          .join('')}
      </div>
    </div>

    <div class="stats-grid mb-6">
      <div class="stat-card green">
        <div class="stat-label">Tempo Estudado</div>
        <div class="stat-value">${formatTime(totalSecs)}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Sessões Realizadas</div>
        <div class="stat-value">${filteredEvts.length}</div>
        <div class="stat-sub">eventos concluidos</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Questões</div>
        <div class="stat-value">${questTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Simulados</div>
        <div class="stat-value">${simTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="card">
        <div class="card-header">
          <h3>📊 Horas por Dia</h3>
          <span class="text-sm text-muted">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-daily"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>📚 Tempo por Disciplina</h3>
          <span class="text-sm text-muted">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-disc"></canvas></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>⚡ Hábitos (${periodLabel})</h3></div>
        <div class="card-body">${renderHabitSummary(periodDays)}</div>
      </div>
      <div class="card">
        <div class="card-header"><h3>📏 Progresso por Disciplina</h3></div>
        <div class="card-body">${renderDiscProgress()}</div>
      </div>
    </div>
  `;

  renderDailyChart(periodDays);
  renderDiscChart(periodDays);
}

export function setDashPeriod(p) {
  dashPeriod = p;
  renderCurrentView();
}

export function renderDailyChart(periodDays) {
  const ctx = document.getElementById('chart-daily');
  if (!ctx) return;
  if (_chartDaily) {
    _chartDaily.destroy();
    _chartDaily = null;
  }
  const themeVars = getComputedStyle(document.documentElement);
  const accent = themeVars.getPropertyValue('--accent').trim() || '#8aa4bf';
  const accentLight =
    themeVars.getPropertyValue('--accent-light').trim() || 'rgba(138, 164, 191, 0.16)';
  const border = themeVars.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.14)';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#b8c0cc';
  const numDays = periodDays ? Math.min(periodDays, 365) : 30;
  // Pre-aggregate study time by date for O(1) lookup
  const secsByDate = {};
  for (const e of state.eventos) {
    if (e.status === 'estudei' && e.tempoAcumulado) {
      secsByDate[e.data] = (secsByDate[e.data] || 0) + (e.tempoAcumulado || 0);
    }
  }
  const days = [],
    data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const d2 = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    const ds = d2.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    data.push(Math.round((secsByDate[ds] || 0) / 60));
  }
  _chartDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Minutos',
          data,
          backgroundColor: accentLight,
          borderColor: accent,
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: border },
          ticks: { color: textSecondary, font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textSecondary,
            font: { size: numDays > 60 ? 9 : numDays > 20 ? 10 : 11 },
            maxRotation: numDays > 20 ? 45 : 0,
            maxTicksLimit: numDays > 180 ? 12 : 20,
          },
        },
      },
    },
  });
}

export function renderDiscChart(periodDays) {
  const ctx = document.getElementById('chart-disc');
  if (!ctx) return;
  if (_chartDisc) {
    _chartDisc.destroy();
    _chartDisc = null;
  }
  const themeVars = getComputedStyle(document.documentElement);
  const border = themeVars.getPropertyValue('--border').trim() || '#e2e8f0';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#475569';
  const discTime = {};
  const cutoffStr2 = periodDays ? cutoffDateStr(periodDays) : null;
  const evts = cutoffStr2
    ? state.eventos.filter(
        (e) => e.status === 'estudei' && e.discId && e.tempoAcumulado && e.data >= cutoffStr2
      )
    : state.eventos.filter((e) => e.status === 'estudei' && e.discId && e.tempoAcumulado);
  evts.forEach((e) => {
    discTime[e.discId] = (discTime[e.discId] || 0) + e.tempoAcumulado;
  });
  const labels = [],
    data = [],
    colors = [];
  Object.entries(discTime).forEach(([id, secs]) => {
    const d = getDisc(id);
    labels.push(d ? d.disc.nome : id);
    data.push(Math.round(secs / 60));
    colors.push(d ? d.disc.cor || '#8aa4bf' : '#7f8a99');
  });
  let dummyTooltip = false;
  if (data.length === 0) {
    labels.push('Sem Dados Registrados');
    data.push(1);
    colors.push(border);
    dummyTooltip = true;
  }
  _chartDisc = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textSecondary, font: { size: 11 }, boxWidth: 12 },
        },
        tooltip: { enabled: !dummyTooltip },
      },
    },
  });
}

export function renderHabitSummary(periodDays) {
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  return HABIT_TYPES.map((h) => {
    const recent = cutoffStr
      ? (state.habitos[h.key] || []).filter((r) => r.data >= cutoffStr)
      : state.habitos[h.key] || [];
    let count = recent.length;
    if (h.key === 'questoes') count = sumQuestionRecords(recent);
    if (h.key === 'paginas') count = sumPageRecords(recent);
    return `
      <div class="flex border-b habit-row">
        <div class="text-xl">${h.icon}</div>
        <div class="flex-1 text-md font-medium">${h.label}</div>
        <div class="text-xl font-bold habit-count" data-habit-color="${h.color}">${count}</div>
      </div>
    `;
  }).join('');
}

export function renderDiscProgress() {
  const discs = getActiveDisciplinas();
  if (discs.length === 0)
    return '<div class="empty-state"><div class="icon">📋</div><p>Nenhuma disciplina cadastrada</p></div>';
  return discs
    .slice(0, 8)
    .map(({ disc, edital: _edital }) => {
      const total = (disc.assuntos || []).length;
      const done = (disc.assuntos || []).filter((a) => a.concluido).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
      <div class="mb-3">
        <div class="flex-between mb-1">
          <div class="text-base font-semibold cluster-sm">
            <span>${disc.icone || '📚'}</span> ${esc(disc.nome)}
          </div>
          <div class="text-sm text-muted">${done}/${total}</div>
        </div>
        <div class="progress">
          <div class="progress-bar" data-progress-width="${pct}" data-progress-color="${disc.cor || 'var(--accent)'}"></div>
        </div>
      </div>
    `;
    })
    .join('');
}

// =============================================
// HABITOS VIEW
// =============================================

export function renderHistoricoSessoes(el) {
  const eventosEstudados = [...(state.eventos || []), ...(state.arquivo || [])]
    .filter((ev) => ev && ev.status === 'estudei')
    .sort((a, b) => {
      const dateA = String(a.dataEstudo || a.data || '');
      const dateB = String(b.dataEstudo || b.data || '');
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      const timeA = Number(new Date(a.updatedAt || a.createdAt || a.criadoEm || 0).getTime()) || 0;
      const timeB = Number(new Date(b.updatedAt || b.createdAt || b.criadoEm || 0).getTime()) || 0;
      return timeB - timeA;
    });

  if (eventosEstudados.length === 0) {
    el.innerHTML = `
      <div class="card p-24 session-empty-state">
        <div class="session-empty-icon">🕘</div>
        <div class="session-empty-title">Nenhuma sessão registrada ainda</div>
        <div class="session-empty-hint">Quando você finalizar uma sessão de estudo, ela aparecerá aqui para edição e exclusão.</div>
      </div>
    `;
    return;
  }

  const gruposPorData = new Map();
  eventosEstudados.forEach((ev) => {
    const dateKey = ev.dataEstudo || ev.data || '__sem_data__';
    if (!gruposPorData.has(dateKey)) gruposPorData.set(dateKey, new Map());

    const discInfo = ev.discId ? getDisc(ev.discId) : null;
    const discId = discInfo?.disc?.id || '__sem_disciplina__';

    if (!gruposPorData.get(dateKey).has(discId)) {
      gruposPorData.get(dateKey).set(discId, {
        discId,
        discNome: discInfo?.disc?.nome || 'Sem disciplina',
        discIcone: discInfo?.disc?.icone || '📚',
        discCor: discInfo?.disc?.cor || discInfo?.edital?.cor || '#64748b',
        itens: [],
      });
    }

    gruposPorData.get(dateKey).get(discId).itens.push(ev);
  });

  const dateKeys = [...gruposPorData.keys()].sort((a, b) => {
    if (a === '__sem_data__') return 1;
    if (b === '__sem_data__') return -1;
    return String(b).localeCompare(String(a));
  });

  const totalSessoes = eventosEstudados.length;
  const totalTempo = eventosEstudados.reduce(
    (sum, ev) => sum + (Number(ev.tempoAcumulado) || 0),
    0
  );

  el.innerHTML = `
    <div class="card p-16 session-history-summary">
      <div class="session-history-header">
        <div class="dash-label">HISTÓRICO GLOBAL DE SESSÕES</div>
        <div class="session-history-badges">
          <span class="badge">${totalSessoes} sessões</span>
          <span class="badge">⏱ ${formatTime(totalTempo)}</span>
        </div>
      </div>
      <div class="session-history-hint">Agrupado pela data real do estudo e por disciplina. Use "Editar" para ajustar o registro e "Apagar" para remover permanentemente.</div>
    </div>

    ${dateKeys
      .map((dateKey) => {
        const disciplinas = [...gruposPorData.get(dateKey).values()].sort((a, b) =>
          String(a.discNome).localeCompare(String(b.discNome), 'pt-BR', { sensitivity: 'base' })
        );

        const dateLabel = dateKey === '__sem_data__' ? 'Sem data' : formatDate(dateKey);
        const sessoesNoDia = disciplinas.reduce((sum, d) => sum + d.itens.length, 0);

        return `
        <section class="card p-16 session-group-section">
          <div class="session-group-header">
            <div class="session-group-title">${esc(dateLabel)}</div>
            <div class="session-group-count">${sessoesNoDia} sessão(ões)</div>
          </div>

          <div class="session-group-list">
            ${disciplinas
              .map((group) => {
                // Fallback para disciplina sem nome
                const discName =
                  group.discNome === 'Sem disciplina' || !group.discNome
                    ? 'Disciplina não vinculada'
                    : group.discNome;
                const discIcon = group.discIcone || '📚';

                const discColor = group.discCor || '#64748b';
                return `
              <div class="session-disc-card" style="--session-disc-color:${esc(discColor)};">
                <div class="session-disc-header">
                  <div class="session-disc-title">${esc(discIcon)} ${esc(discName)}</div>
                  <div class="session-disc-count">${group.itens.length} registro(s)</div>
                </div>

                <div class="custom-scrollbar session-scroll-container">
                  ${group.itens
                    .map((ev) => {
                      const questoes = ev.sessao?.questoes || ev.questoes || {};
                      const acertos = Number(questoes.acertos ?? questoes.certas ?? 0) || 0;
                      const erros = Number(questoes.erros ?? questoes.erradas ?? 0) || 0;
                      const totalExplicito = Number(questoes.total ?? questoes.quantidade);
                      const totalQuestoes =
                        Number.isFinite(totalExplicito) && totalExplicito > 0
                          ? totalExplicito
                          : acertos + erros;
                      const percAcertos =
                        totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0;

                      const paginasRaw = ev.sessao?.paginas;
                      const paginas =
                        Number(
                          (paginasRaw && typeof paginasRaw === 'object'
                            ? paginasRaw.total
                            : paginasRaw) ??
                            ev.paginas ??
                            0
                        ) || 0;
                      const tempoLabel = formatTime(Number(ev.tempoAcumulado) || 0);

                      const discInfo = ev.discId ? getDisc(ev.discId) : null;
                      const assunto =
                        ev.assId && discInfo?.disc?.assuntos
                          ? discInfo.disc.assuntos.find((a) => a.id === ev.assId)?.nome
                          : '';
                      const eventId = esc(String(ev.id || ''));

                      return `
                    <div class="session-detail-card">
                      <div class="session-detail-row">
                        <div class="session-detail-content">
                          <div class="session-detail-title">${esc(ev.titulo || 'Sessão de estudo')}</div>
                          ${assunto ? `<div class="session-detail-subject">Tópico: ${esc(assunto)}</div>` : ''}
                        </div>
                        <div class="session-detail-actions">
                          <button class="btn btn-ghost btn-sm session-item-btn" data-action="edit-session-record" data-session-id="${eventId}" aria-label="Editar sessão">Editar</button>
                          <button class="btn btn-ghost btn-sm session-item-btn session-item-btn-danger" data-action="delete-session-record" data-session-id="${eventId}" aria-label="Apagar sessão">Apagar</button>
                        </div>
                      </div>

                      <div class="session-item-badges">
                        <span class="badge session-item-badge">⏱ ${tempoLabel}</span>
                        <span class="badge session-item-badge">❓ ${totalQuestoes > 0 ? `${acertos}/${totalQuestoes} (${percAcertos}%)` : '-'}</span>
                        <span class="badge session-item-badge">📄 ${paginas > 0 ? paginas : '-'}</span>
                      </div>
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              </div>
            `;
              })
              .join('')}
          </div>
        </section>
      `;
      })
      .join('')}
  `;
}

// =============================================
// EDITAIS VIEW
// =============================================

export const vertFilterEdital = '';
export const vertFilterStatus = 'todos';
export let vertSearch = '';
export let _vertSearchDebounce = null;

export function onVertSearch(val) {
  vertSearch = val;
  clearTimeout(_vertSearchDebounce);
  _vertSearchDebounce = setTimeout(() => {
    // Fix 3: only re-render the list portion, not the entire view
    const listEl = document.getElementById('vert-list-container');
    if (listEl) {
      renderVerticalList(listEl);
    } else {
      renderCurrentView(); // fallback if container not found
    }
  }, 200);
}

export function getFilteredVertItems() {
  let items = [];
  for (const edital of state.editais) {
    for (const disc of edital.disciplinas || []) {
      for (const ass of disc.assuntos || []) {
        items.push({ edital, disc, ass });
      }
    }
  }
  if (vertFilterEdital) items = items.filter((i) => i.edital.id === vertFilterEdital);
  if (vertFilterStatus === 'pendentes') items = items.filter((i) => !i.ass.concluido);
  if (vertFilterStatus === 'concluidos') items = items.filter((i) => i.ass.concluido);
  if (vertSearch) {
    const q = vertSearch.toLowerCase();
    items = items.filter(
      (i) => i.ass.nome.toLowerCase().includes(q) || i.disc.nome.toLowerCase().includes(q)
    );
  }
  return items;
}

// verResumoSimulado removida — funcionalidade descontinuada

export function toggleEditSeq() {
  _isEditingSequence = !_isEditingSequence;
  if (_isEditingSequence) {
    _tempSequencia = JSON.parse(JSON.stringify(state.planejamento.sequencia));
  } else {
    _tempSequencia = null;
  }
  renderCurrentView();
}

export function saveEditSeq() {
  if (!_tempSequencia || _tempSequencia.length === 0) {
    showToast('A sequência de estudos não pode ficar vazia.', 'error');
    return;
  }
  for (const s of _tempSequencia) {
    if (!s.discId) {
      showToast(
        'Por favor, selecione uma disciplina para todas as etapas antes de salvar.',
        'error'
      );
      return;
    }
  }

  state.planejamento.sequencia = _tempSequencia;
  syncCicloToEventos();
  scheduleSave();

  _isEditingSequence = false;
  _tempSequencia = null;
  renderCurrentView();
}

export function cancelEditSeq() {
  _isEditingSequence = false;
  _tempSequencia = null;
  renderCurrentView();
}

export function updateSeqItem(i, field, val) {
  i = parseInt(i, 10);
  if (field === 'minutosAlvo') val = parseInt(val) || 0;
  _tempSequencia[i][field] = val;
}

export function dupSeqItem(i) {
  i = parseInt(i, 10);
  const obj = JSON.parse(JSON.stringify(_tempSequencia[i]));
  obj.id = 'seq_' + uid();
  _tempSequencia.splice(i + 1, 0, obj);
  renderCurrentView();
}

export function remSeqItem(i) {
  i = parseInt(i, 10);
  _tempSequencia.splice(i, 1);
  renderCurrentView();
}

export function moveSeqItem(i, dir) {
  i = parseInt(i, 10);
  const arr = _tempSequencia;
  if (i + dir < 0 || i + dir >= arr.length) return;
  const temp = arr[i];
  arr[i] = arr[i + dir];
  arr[i + dir] = temp;
  renderCurrentView();
}

export function addSeqItem() {
  _tempSequencia.push({
    id: 'seq_' + uid(),
    discId: '',
    minutosAlvo: 60,
  });
  renderCurrentView();
}

export function addEventoParaAssunto(editaId, discId, assId) {
  const d = getDisc(discId);
  const ass = d?.disc?.assuntos?.find((a) => a.id === assId);
  if (!ass || !d) return;
  // Pre-select discipline and subject then open modal
  openAddEventModal(todayStr());
  // After modal renders, pre-fill
  setTimeout(() => {
    const discSel = document.getElementById('event-disc');
    if (discSel) {
      discSel.value = discId;
      loadAssuntos();
      setTimeout(() => {
        const assSel = document.getElementById('event-assunto');
        if (assSel) {
          assSel.value = assId;
          const ti = document.getElementById('event-titulo');
          if (ti) {
            ti.value = ass.nome;
            ti.dataset.autoFilled = 'true';
          }
        }
      }, 50);
    }
  }, 50);
}

export function toggleEdital(id) {
  const el = document.getElementById(`edital-tree-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

export function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      const ass = (disc.assuntos || []).find((a) => a.id === assId);
      if (ass) {
        ass.concluido = !ass.concluido;
        ass.dataConclusao = ass.concluido ? todayStr() : null;
        if (ass.concluido) ass.revisoesFetas = [];
        scheduleSave();

        // Re-render local dashboard if open, otherwise full view
        const ctx = getActiveDashboardDiscCtx();
        if (ctx && ctx.discId === discId) {
          openDiscDashboard(ctx.editaId, discId);
        } else {
          renderCurrentView();
        }
        return;
      }
    }
  }
}

export function toggleAulaDashboard(editaId, discId, aulaId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (!disc) continue;

    const aula = (disc.aulas || []).find((a) => a.id === aulaId);
    if (!aula) return;

    aula.estudada = !aula.estudada;
    aula.dataEstudo = aula.estudada ? todayStr() : null;
    scheduleSave();

    const ctx = getActiveDashboardDiscCtx();
    if (ctx && ctx.discId === discId) {
      openDiscDashboard(editaId, discId);
    } else {
      renderCurrentView();
    }

    showToast(aula.estudada ? 'Aula marcada como estudada.' : 'Aula desmarcada.', 'success');
    return;
  }
}

export function openDiscDashboard(editaId, discId) {
  const edital = state.editais.find((e) => e.id === editaId);
  if (!edital || !edital.disciplinas) return;
  const disc = edital.disciplinas.find((d) => d.id === discId);
  if (!disc) return;

  setActiveDashboardDiscCtx({ editaId, discId });

  // Set window Topbar
  const topbarTitle = document.getElementById('topbar-title');
  const actions = document.getElementById('topbar-actions');
  if (!topbarTitle || !actions) return;
  topbarTitle.textContent = `${disc.icone || '📚'} ${disc.nome} `;
  actions.innerHTML =
    '<button class="btn btn-ghost btn-sm" data-action="close-disc-dashboard"><i class="fa fa-arrow-left"></i> Voltar</button>';

  const el = document.getElementById('main-content');
  el.innerHTML = renderDisciplinaDashboard(edital, disc);
  setTimeout(() => initDiscDashboardChart(disc.id), 100);
}

export function closeDiscDashboard() {
  clearActiveDashboardDiscCtx();
  resetActiveDashboardTab();
  renderCurrentView();
}

export function switchDashboardTab(tabName) {
  setActiveDashboardTab(tabName);
  const ctx = getActiveDashboardDiscCtx();
  if (ctx && ctx.editaId && ctx.discId) {
    const edital = state.editais.find((e) => e.id === ctx.editaId);
    const disc = edital?.disciplinas?.find((d) => d.id === ctx.discId);
    if (disc) {
      openDiscDashboard(ctx.editaId, ctx.discId);
      return;
    }
  }

  renderCurrentView();
}

function _renderHistoricoDisciplina(tempos) {
  const reverseTempos = [...tempos].reverse().slice(0, 50);
  if (reverseTempos.length === 0) {
    return '<div class="empty-state-centered">Nenhuma sessão de estudo registrada.</div>';
  }

  return `
    <div class="custom-scrollbar">
      <table class="session-history-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tempo</th>
            <th>Pág.</th>
            <th>Questões</th>
            <th>Acerto</th>
          </tr>
        </thead>
        <tbody>
          ${reverseTempos
            .map((t) => {
              const dateStr = formatDate(t.data);
              const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
              const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
              const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
              const certas = qs.acertos || qs.certas || 0;
              const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
              const _percColor =
                perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
              const pags = t.sessao?.paginas?.total || t.paginas || null;

              return `
              <tr class="session-history-row" data-action="open-registro-sessao" data-event-id="${t.id}">
                <td>${dateStr}</td>
                <td class="session-history-time">${tempoStr}</td>
                <td>${pags ?? '-'}</td>
                <td>${certas} / ${totQs}</td>
                <td class="session-history-acerto ${totQs > 0 ? (perc >= 70 ? 'text-green' : perc >= 50 ? 'text-accent' : 'text-red') : ''}">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
          `;
}

function _renderTopicosEditalDisciplina(edital, disc) {
  if (!disc.assuntos || disc.assuntos.length === 0) {
    return '<div class="empty-state-centered">Nenhum tópico cadastrado.</div>';
  }

  return `
    <div class="custom-scrollbar">
      ${disc.assuntos
        .map((ass) => {
          const importanceBadge =
            ass.relevance?.priority === 'P1'
              ? '<span class="priority-badge-p1" title="Alta Chance de Cobrança">🔥 P1</span>'
              : ass.relevance?.priority === 'P2'
                ? '<span class="priority-badge-p2">⚠️ P2</span>'
                : '';

          return `
        <div class="subject-item ${ass.concluido ? 'subject-item-concluded' : ''}">
          <div class="check-circle ${ass.concluido ? 'done' : ''}" data-action="toggle-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-width-0 subject-item-title ${ass.concluido ? 'subject-item-title--concluded' : ''}">
             ${esc(ass.nome)} ${importanceBadge}
          </div>
          ${
            ass.concluido
              ? `
            <div class="text-right">
              <div class="text-concluded-badge">✅ concluído</div>
              <div class="text-concluded-date">${formatDate(ass.dataConclusao)}</div>
            </div>
          `
              : `
            <button class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">+ Agenda</button>
          `
          }
        </div>
      `;
        })
        .join('')}
    </div>
  `;
}

function _renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return `<div class="empty-state-column">
      <div class="empty-state-icon">🗂️</div>
      <div class="empty-state-title">Nenhuma aula ou material cadastrado.</div>
      <div class="empty-state-hint">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</div>
    </div>`;
  }

  return `
    <div class="custom-scrollbar">
      ${disc.aulas
        .map((aul) => {
          const itemClass = aul.estudada ? 'aula-item aula-item-concluded' : 'aula-item';
          const titleClass = aul.estudada ? 'aula-title aula-title-concluded' : 'aula-title';

          return `
        <div class="${itemClass}">
          <div class="check-circle ${aul.estudada ? 'done' : ''}" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="${titleClass}">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div class="aula-linked-count">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${
            !aul.estudada
              ? `
            <button class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
          `
              : ''
          }
        </div>
      `;
        })
        .join('')}
    </div>
  `;
}

function _renderBancaDisciplinaDashboard(edital, disc) {
  const hasHotTopics =
    state.bancaRelevance &&
    state.bancaRelevance.hotTopics &&
    state.bancaRelevance.hotTopics.some((ht) => ht.disciplinaId === disc.id);
  const hasAulas = disc.aulas && disc.aulas.length > 0;

  if (!hasHotTopics) {
    return `
         <div class="banca-empty-state">
           <i class="fa fa-robot banca-empty-icon"></i>
           <div class="banca-empty-title">Nenhuma análise encontrada</div>
           <div class="banca-empty-hint">Use o Analisador de Banca no menu principal para injetar o sumário de exigência desta disciplina.</div>
         </div>
       `;
  }

  return `
       <div class="custom-scrollbar pt-2">
         <div class="banca-status-card">
            <div class="banca-status-label">STATUS DO MAPEADOR DE INTELIGÊNCIA</div>

            <div class="banca-status-row">
              <span>Dados de Banca extraídos:</span>
              <span class="banca-status-success">✅ ATIVO</span>
            </div>

            <div class="banca-status-row">
              <span>Aulas atreladas aos Tópicos P1 e P2:</span>
              <span class="${hasAulas ? 'banca-status-success' : 'banca-status-warning'}">${hasAulas ? '✅ CONECTADAS' : '⚠️ FALTA IMPORTAR'}</span>
            </div>
         </div>

         <div class="banca-info-text">
            A inteligência da prova injetou prioridades (P1 e P2) diretamente na sua janela de <strong>Tópicos do Edital</strong>. Veja as marcações em chamas 🔥 ao lado dos tópicos que demandam mais a sua atenção.
         </div>

         <button class="btn btn-outline banca-action-btn" data-action="navigate" data-view="banca-analyzer">
            Abrir Analisador Preditivo
         </button>
       </div>
   `;
}

export function initDiscDashboardChart(discId) {
  const canvas = document.getElementById('disc-chart-acertos');
  if (!canvas) return;
  const themeVars = getComputedStyle(document.documentElement);
  const accent = themeVars.getPropertyValue('--accent').trim() || '#8aa4bf';
  const bg = themeVars.getPropertyValue('--bg').trim() || '#08090d';
  const card = themeVars.getPropertyValue('--card').trim() || '#121821';
  const border = themeVars.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.14)';
  const textPrimary = themeVars.getPropertyValue('--text-primary').trim() || '#f3f6fb';
  const textMuted = themeVars.getPropertyValue('--text-muted').trim() || '#7f8a99';
  const grid = border;
  const accentSoft = /^#[0-9A-Fa-f]{6}$/.test(accent) ? `${accent}29` : 'rgba(138, 164, 191, 0.16)';

  const tempos = state.eventos
    ? state.eventos.filter((e) => {
        const qs = e.sessao?.questoes || e.questoes;
        return (
          e.discId === discId &&
          e.status === 'estudei' &&
          qs &&
          ((qs.acertos || qs.certas || 0) > 0 || (qs.erros || qs.erradas || 0) > 0)
        );
      })
    : [];

  const grouped = {};
  [...tempos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((t) => {
      if (!grouped[t.data]) grouped[t.data] = { certas: 0, erradas: 0 };
      const qs = t.sessao?.questoes || t.questoes;
      grouped[t.data].certas += qs.acertos || qs.certas || 0;
      grouped[t.data].erradas += qs.erros || qs.erradas || 0;
    });

  const rawLabels = Object.keys(grouped).slice(-15);
  const labels = rawLabels.map((d) => formatDate(d));
  const dataPerc = rawLabels.map((d) => {
    const total = grouped[d].certas + grouped[d].erradas;
    return total > 0 ? Math.round((grouped[d].certas / total) * 100) : 0;
  });

  if (getDiscChartInstance()) {
    getDiscChartInstance().destroy();
  }

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    parent.innerHTML =
      '<div class="dashboard-chart-empty">Métricas insuficientes. Registre sessões com número de questões para gerar o gráfico de evolução.</div>';
    return;
  }

  const ctx = canvas.getContext('2d');
  setDiscChartInstance(
    new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '% de Acertos',
            data: dataPerc,
            borderColor: accent,
            backgroundColor: accentSoft,
            borderWidth: 2,
            pointBackgroundColor: bg,
            pointBorderColor: accent,
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: card,
            titleColor: textMuted,
            bodyColor: textPrimary,
            borderColor: border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.raw}% de Acerto`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: textMuted, callback: (v) => v + '%' },
            grid: { color: grid },
          },
          x: {
            ticks: { color: textMuted },
            grid: { display: false },
          },
        },
      },
    })
  );
}

export function deleteAssunto(discId, assId) {
  showConfirm(
    'Excluir este assunto? Eventos vinculados serão desvinculados.',
    () => {
      const entry = getDisc(discId);
      if (entry) {
        entry.disc.assuntos = entry.disc.assuntos.filter((a) => a.id !== assId);

        if (state.eventos) {
          state.eventos.forEach((e) => {
            if (e.assId === assId) {
              delete e.assId;
            }
          });
        }

        invalidateDiscCache();
        invalidateDashCaches();
        scheduleSave();
        renderCurrentView();
        if (
          typeof editingSubjectCtx !== 'undefined' &&
          editingSubjectCtx &&
          editingSubjectCtx.discId === discId
        ) {
          openDiscManager(editingSubjectCtx.editaId, discId);
        }
      }
    },
    { danger: true, label: 'Excluir', title: 'Excluir assunto' }
  );
}

export function deleteDisc(editaId, discId) {
  showConfirm(
    'Excluir esta disciplina e todos seus assuntos?\n\nEsta ação não pode ser desfeita.',
    () => {
      const edital = state.editais.find((e) => e.id === editaId);
      if (!edital || !edital.disciplinas) return;
      edital.disciplinas = edital.disciplinas.filter((d) => d.id !== discId);

      if (state.eventos) {
        state.eventos.forEach((e) => {
          if (e.discId === discId) {
            delete e.discId;
            delete e.assId;
          }
        });
      }
      if (state.planejamento && state.planejamento.disciplinas) {
        state.planejamento.disciplinas = state.planejamento.disciplinas.filter(
          (id) => id !== discId
        );
        if (state.planejamento.relevancia && state.planejamento.relevancia[discId])
          delete state.planejamento.relevancia[discId];
        if (state.planejamento.sequencia)
          state.planejamento.sequencia = state.planejamento.sequencia.filter(
            (s) => s.discId !== discId
          );
      }

      invalidateDiscCache();
      invalidateDashCaches();
      scheduleSave();
      renderCurrentView();
    },
    { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' }
  );
}

export function deleteEdital(editaId) {
  const edital = state.editais.find((e) => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(
    `Excluir "${nome}" completamente ?

      Todos os grupos, disciplinas e assuntos serão removidos.Esta ação não pode ser desfeita.`,
    () => {
      const discIds = edital && edital.disciplinas ? edital.disciplinas.map((d) => d.id) : [];
      state.editais = state.editais.filter((e) => e.id !== editaId);

      if (discIds.length > 0 && state.eventos) {
        state.eventos.forEach((e) => {
          if (discIds.includes(e.discId)) {
            delete e.discId;
            delete e.assId;
          }
        });
      }
      if (discIds.length > 0 && state.planejamento && state.planejamento.disciplinas) {
        state.planejamento.disciplinas = state.planejamento.disciplinas.filter(
          (id) => !discIds.includes(id)
        );
        discIds.forEach((id) => {
          if (state.planejamento.relevancia && state.planejamento.relevancia[id])
            delete state.planejamento.relevancia[id];
        });
        if (state.planejamento.sequencia)
          state.planejamento.sequencia = state.planejamento.sequencia.filter(
            (s) => !discIds.includes(s.discId)
          );
      }

      invalidateDiscCache();
      scheduleSave();
      renderCurrentView();
    },
    { danger: true, label: 'Excluir edital', title: 'Excluir edital' }
  );
}

// =============================================
// EDITAL MODAL
// =============================================
export function openEditaModal(editaId = null) {
  const edital = editaId ? state.editais.find((e) => e.id === editaId) : null;
  document.getElementById('modal-edital-title').textContent = edital
    ? 'Editar Edital'
    : 'Novo Edital';
  document.getElementById('modal-edital-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome do Edital</label>
      <input type="text" class="form-control" id="edital-nome" placeholder="Ex: Concurso TRF 2025" value="${edital ? esc(edital.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="edital-colors">
        ${COLORS.map((c) => `<div class="color-swatch ${edital && edital.cor === c ? 'selected' : ''}" data-action="select-color" data-color="${c}" data-container="edital-colors" data-color-value="${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="edital-cor" value="${edital ? edital.cor : COLORS[0]}">
    </div>
    <div class="modal-footer-standard">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-edital">Cancelar</button>
      <button class="btn btn-primary" data-action="save-edital" data-edital-id="${editaId || ''}">Salvar Edital</button>
    </div>
    `;
  if (!edital) {
    document.querySelector('#edital-colors .color-swatch').classList.add('selected');
  }
  openModal('modal-edital');
}

export function selectColor(color, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
  container.querySelector(`[data-color-value="${color}"]`)?.classList.add('selected');
  const input = document.getElementById(
    containerId === 'edital-colors'
      ? 'edital-cor'
      : containerId === 'disc-colors'
        ? 'disc-cor'
        : 'edital-cor'
  );
  if (input) input.value = color;
}

export function saveEdital(editaId) {
  const nomeEl = document.getElementById('edital-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) {
    showToast('Informe o nome do edital', 'error');
    return;
  }
  const cor = document.getElementById('edital-cor')?.value || COLORS[0];

  if (editaId) {
    const edital = state.editais.find((e) => e.id === editaId);
    if (edital) {
      edital.nome = nome;
      edital.cor = cor;
    }
  } else {
    state.editais.push({
      id: uid(),
      nome,
      cor,
      disciplinas: [],
    });
  }
  scheduleSave();
  closeModal('modal-edital');
  renderCurrentView();
  showToast('Edital salvo!', 'success');
}

// =============================================
// DISCIPLINE MODAL
// =============================================
export function openDiscModal(editaId, discId) {
  editingDiscCtx = { editaId, discId: discId || null };
  const edital = state.editais.find((e) => e.id === editaId);
  const existingDisc = discId && edital ? edital.disciplinas.find((d) => d.id === discId) : null;
  const isEdit = !!existingDisc;

  document.getElementById('modal-disc-title').textContent = isEdit
    ? 'Editar Disciplina'
    : 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional" value="${isEdit ? esc(existingDisc.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div class="icon-grid" id="disc-icons">
        ${DISC_ICONS.map((ic, _i) => `<div class="icon-grid-item ${ic === (isEdit ? existingDisc.icone : DISC_ICONS[0]) ? 'selected-icon' : ''}" data-action="select-icon" data-icon="${ic}">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${isEdit ? existingDisc.icone : DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c, _i) => `<div class="color-swatch ${c === (isEdit ? existingDisc.cor : COLORS[0]) ? 'selected' : ''}" data-disc-color="${c}" data-action="select-disc-color" data-color="${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${isEdit ? existingDisc.cor : COLORS[0]}">
    </div>
    `;
  openModal('modal-disc');
}

export function selectIcon(icon, el) {
  document.querySelectorAll('#disc-icons > .icon-grid-item').forEach((d) => {
    d.classList.remove('selected-icon');
  });
  el.classList.add('selected-icon');
  document.getElementById('disc-icone').value = icon;
}

export function selectDiscColor(color) {
  document
    .querySelectorAll('#disc-colors .color-swatch')
    .forEach((s) => s.classList.remove('selected'));
  document
    .querySelector(`#disc-colors .color-swatch[data-disc-color="${color}"]`)
    ?.classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

export function saveDisc() {
  const nomeEl = document.getElementById('disc-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) {
    showToast('Informe o nome da disciplina', 'error');
    return;
  }
  const icone = document.getElementById('disc-icone')?.value || '📖';
  const cor = document.getElementById('disc-cor')?.value || '#8aa4bf';
  if (!editingDiscCtx) return;
  const { editaId, discId } = editingDiscCtx;
  const edital = state.editais.find((e) => e.id === editaId);
  if (!edital) return;
  if (!edital.disciplinas) edital.disciplinas = [];

  if (discId) {
    // Edit existing discipline
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      disc.nome = nome;
      disc.icone = icone;
      disc.cor = cor;
      showToast('Disciplina atualizada!', 'success');
    }
  } else {
    // Create new
    edital.disciplinas.push({ id: uid(), nome, icone, cor, assuntos: [] });
    showToast('Disciplina criada!', 'success');
  }
  scheduleSave();
  closeModal('modal-disc');
  renderCurrentView();
}

export function saveDiscManager(editalId, discId) {
  const edital = state.editais.find((e) => e.id === editalId);
  if (!edital) return;
  const disc = edital.disciplinas?.find((d) => d.id === discId);
  if (!disc) return;
  const nomeEl = document.getElementById('dm-nome');
  const corEl = document.getElementById('dm-cor');
  if (nomeEl) disc.nome = nomeEl.value.trim() || disc.nome;
  if (corEl) disc.cor = corEl.value || disc.cor;
  scheduleSave();
  openDiscManager(editalId, discId);
  showToast('Disciplina atualizada!', 'success');
}

export function moveSubject(discId, idx, dir) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (!disc || !disc.assuntos) continue;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= disc.assuntos.length) return;
    const temp = disc.assuntos[idx];
    disc.assuntos[idx] = disc.assuntos[targetIdx];
    disc.assuntos[targetIdx] = temp;
    scheduleSave();
    openDiscManager(editingSubjectCtx?.editaId || edital.id, discId);
    return;
  }
}

// =============================================
// SUBJECT MANAGER AND BULK ADD
// =============================================
export function openDiscManager(editaId, discId) {
  let disc = null;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const d = edital.disciplinas.find((x) => x.id === discId);
    if (d) {
      disc = d;
      break;
    }
  }
  if (!disc) return;

  editingSubjectCtx = { editaId, discId };
  // Default tab when opening
  _activeDiscManagerTab = _activeDiscManagerTab || 'topicos';

  // Render subject items
  const subjectsHtml =
    disc.assuntos
      .map(
        (ass, idx) =>
          `
      <div class="sm-list-item" draggable="true"
    data-disc-id="${disc.id}"
    data-ass-idx="${idx}"
    data-dnd-subject=""
    data-dnd-disc="${disc.id}"
    data-dnd-idx="${idx}">
      <div class="sm-drag-handle" title="Arrastar">☰</div>
      <div class="sm-item-text" data-action="edit-subject-inline" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">
        ${esc(ass.nome)}
        ` +
          (ass.relevance
            ? `<span class="relevance-badge relevance-badge-${ass.relevance.priority === 'P1' ? 'p1' : ass.relevance.priority === 'P2' ? 'p2' : 'muted'}" title="${esc(ass.relevance.reason)}">${ass.relevance.priority}</span>`
            : '') +
          `
        ${
          ass.linkedAulaIds && ass.linkedAulaIds.length > 0
            ? `
           <div class="linked-aulas-list">
             ${ass.linkedAulaIds
               .map((auId) => {
                 const aulaObj = (disc.aulas || []).find((a) => a.id === auId);
                 return aulaObj
                   ? `<span class="linked-aula-tag"><i class="fa fa-play-circle"></i> ${esc(aulaObj.nome)}</span>`
                   : '';
               })
               .join('')}
           </div>
        `
            : ''
        }
      </div>
      <div class="sm-item-actions">
        <button aria-label="Subir tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="-1" title="Subir"><i class="fa fa-chevron-up"></i></button>
        <button aria-label="Descer tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="1" title="Descer"><i class="fa fa-chevron-down"></i></button>
        <button aria-label="Excluir tópico" data-action="delete-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `
      )
      .join('') || '<div class="sm-empty-state">Nenhum tópico no Edital.</div>';

  // Render Lesson items
  const aulasHtml =
    (disc.aulas || [])
      .map(
        (aula, _idx) => `
      <div class="sm-list-item sm-list-item--lesson">
      <div class="sm-item-content">
          <div class="sm-item-text sm-item-text--clickable" data-action="edit-lesson-inline" data-disc-id="${disc.id}" data-aula-id="${aula.id}">
             <input type="checkbox" ${aula.estudada ? 'checked' : ''} data-action="toggle-aula-estudada" data-disc-id="${disc.id}" data-aula-id="${aula.id}" class="sm-checkbox" title="Marcar como Estudada">
             <span class="${aula.estudada ? 'sm-text-concluded' : ''}">${esc(aula.nome)}</span>
          </div>
          ${
            aula.linkedAssuntoIds && aula.linkedAssuntoIds.length > 0
              ? `
           <div class="sm-linked-info">
             <strong>Cobre: </strong> ${aula.linkedAssuntoIds
               .map((asId) => {
                 const assObj = disc.assuntos.find((a) => a.id === asId);
                 return assObj ? esc(assObj.nome) : '';
               })
               .filter((n) => n)
               .join(', ')}
           </div>
        `
              : '<div class="sm-linked-info sm-linked-info--empty">Não conectada a assunto do edital.</div>'
          }
      </div>
      <div class="sm-item-actions">
         <button aria-label="Excluir aula" data-action="delete-aula" data-disc-id="${disc.id}" data-aula-id="${aula.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `
      )
      .join('') || '<div class="sm-empty-state">Nenhuma Aula adicionada.</div>';

  const colorOptions = COLORS.map(
    (c) =>
      `<option value="${c}" ${disc.cor === c ? 'selected' : ''}" data-color-option="${c}">${c}</option>`
  ).join('');

  document.getElementById('modal-disc-manager-title').textContent =
    disc.nome || 'Gerenciar Disciplina';
  document.getElementById('modal-disc-manager-body').innerHTML = `
      <!--Configurações Globais da Disciplina-->
    <div class="sm-header">
      <div class="sm-form-group">
        <label>Nome</label>
        <input type="text" id="dm-nome" value="${esc(disc.nome)}">
      </div>
      <div class="sm-form-group sm-form-group--narrow">
        <label>Cor</label>
        <div class="sm-color-picker-group">
          <input type="color" id="dm-cor-picker" value="${disc.cor || COLORS[0]}">
          <select id="dm-cor" class="form-control" data-action="sync-color-to-picker">
            ${colorOptions}
          </select>
        </div>
      </div>
    </div>

    <!--TABS de Navegação Wave 39 -->
    <div class="manager-tabs" role="tablist" aria-label="Gerenciamento de disciplina">
        <button type="button" data-action="switch-manager-tab" data-tab="topicos" class="manager-tab ${_activeDiscManagerTab === 'topicos' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${_activeDiscManagerTab === 'topicos'}" aria-controls="tab-manager-topicos">
            Tópicos do Edital (${disc.assuntos.length})
        </button>
        <button type="button" data-action="switch-manager-tab" data-tab="aulas" class="manager-tab ${_activeDiscManagerTab === 'aulas' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${_activeDiscManagerTab === 'aulas'}" aria-controls="tab-manager-aulas">
            Meus Materiais/Aulas (${disc.aulas ? disc.aulas.length : 0})
        </button>
    </div>

    <!--ABA TÓPICOS-->
    <div id="tab-manager-topicos" class="${_activeDiscManagerTab === 'topicos' ? 'tab-content active' : 'tab-content--hidden'}">
        <div class="sm-add-form">
           <textarea class="form-control" id="new-assunto-nome" placeholder="Novo tópico (Digite ou cole vários separados por quebra de linha)" rows="1"></textarea>
           <button class="btn btn-primary" data-action="add-assunto" data-disc-id="${disc.id}">Adicionar Tópico</button>
        </div>
        <div class="sm-list custom-scrollbar">
           ${subjectsHtml}
        </div>
    </div>

    <!--ABA AULAS-->
    <div id="tab-manager-aulas" class="${_activeDiscManagerTab === 'aulas' ? 'tab-content active' : 'tab-content--hidden'}">
        <div class="sm-bulk-import-form">
           <div>
               <label>Adição em Lote (Copie e paste o índice do seu PDF/Cursinho aqui)</label>
      <textarea class="form-control form-control--resize sm-bulk-textarea" id="new-aula-bulk" placeholder="Aula 00 - Concordância Nominal\nAula 01 - Crase..."></textarea>
           </div>
           <button class="btn btn-primary" data-action="add-bulk-aulas" data-disc-id="${disc.id}">Importar Lote</button>
        </div>

        ${
          disc.aulas && disc.aulas.length > 0 && disc.assuntos.length > 0
            ? `
          <div class="sm-auto-link-card">
             <div class="sm-auto-link-card-text">O Sistema pode analisar os nomes e conectá-los automaticamente ao Edital.</div>
             <button class="btn btn-ghost btn-sm" data-action="run-lesson-mapper" data-edital-id="${editaId}" data-disc-id="${disc.id}"><i class="fa fa-magic"></i> Auto-Link ML</button>
          </div>
        `
            : ''
        }

        <div class="sm-list custom-scrollbar">
          ${aulasHtml}
        </div>
    </div>

    <!--BOTOES INFERIORES-->
      <div class="sm-footer-actions">
        <button class="btn btn-ghost btn-text-danger" data-action="delete-disc" data-edital-id="${editaId}" data-disc-id="${discId}">Remover Disciplina</button>
        <button class="btn btn-primary" data-action="save-disc-manager" data-edital-id="${editaId}" data-disc-id="${discId}">Salvar alterações</button>
      </div>
    `;
  openModal('modal-disc-manager');
}

export function switchManagerTab(tabName) {
  _activeDiscManagerTab = tabName;
  if (editingSubjectCtx) {
    openDiscManager(editingSubjectCtx.editaId, editingSubjectCtx.discId);
  }
}

export function editSubjectInline(discId, assId, el) {
  const currentText = el.innerText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.style.width = '100%';
  input.style.border = '1px solid var(--accent)';
  input.style.padding = '4px 8px';
  input.style.borderRadius = '4px';
  input.style.background = 'var(--bg)';
  input.style.color = 'var(--text)';

  input.onblur = () => {
    const newVal = input.value.trim();
    if (newVal && newVal !== currentText) {
      for (const edital of state.editais) {
        const disc = (edital.disciplinas || []).find((d) => d.id === discId);
        const ass = (disc?.assuntos || []).find((a) => a.id === assId);
        if (ass) {
          ass.nome = newVal;
          scheduleSave();
          break;
        }
      }
    }
    renderCurrentView();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    else if (e.key === 'Escape') {
      input.value = currentText;
      input.blur();
    }
  };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
}

export function editLessonInline(discId, aulaId, el) {
  const d = getDisc(discId);
  const aulaObj = (d.disc.aulas || []).find((a) => a.id === aulaId);
  if (!aulaObj) return;

  const originalText = aulaObj.nome;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'form-control sm-item-input';
  input.style.width = '100%';

  const finish = () => {
    const val = input.value.trim();
    if (val && val !== originalText) {
      aulaObj.nome = val;
      scheduleSave();
      openDiscManager(editingSubjectCtx.editaId, discId);
    } else {
      openDiscManager(editingSubjectCtx.editaId, discId);
    }
  };

  input.onblur = finish;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') openDiscManager(editingSubjectCtx.editaId, discId);
  };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
  input.select();
}

export function toggleAulaEstudada(discId, aulaId) {
  const d = getDisc(discId);
  if (!d) return;
  const aulaObj = (d.disc.aulas || []).find((a) => a.id === aulaId);
  if (!aulaObj) return;

  aulaObj.estudada = !aulaObj.estudada;
  aulaObj.dataEstudo = aulaObj.estudada ? todayStr() : null;
  scheduleSave();
  openDiscManager(editingSubjectCtx.editaId, discId);
}

export function addBulkAulas(discId) {
  const textarea = document.getElementById('new-aula-bulk');
  if (!textarea) return;

  const lines = textarea.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    showToast('Nenhum texto de aula encontrado.', 'error');
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  if (!d.disc.aulas) d.disc.aulas = [];

  lines.forEach((lineNome) => {
    d.disc.aulas.push({
      id: 'aula_' + uid(),
      nome: lineNome,
      descricao: '',
      estudada: false,
      dataEstudo: null,
      progress: 0,
      linkedAssuntoIds: [],
    });
  });

  scheduleSave();
  textarea.value = '';
  showToast(`${lines.length} Aulas adicionadas!`, 'success');
  openDiscManager(editingSubjectCtx.editaId, discId);
}

export function addAssunto(discId) {
  const input = document.getElementById('new-assunto-nome');
  if (!input) return;
  const lines = input.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return;
  const d = getDisc(discId);
  if (!d) return;
  if (!d.disc.assuntos) d.disc.assuntos = [];
  lines.forEach((nome) => {
    d.disc.assuntos.push({
      id: 'ass_' + uid(),
      nome: nome,
      concluido: false,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    });
  });
  input.value = '';
  scheduleSave();
  openDiscManager(editingSubjectCtx.editaId, discId);
}

export function deleteAula(discId, aulaId) {
  showConfirm('Tem certeza que deseja apagar esta Aula?', () => {
    const d = getDisc(discId);
    if (!d) return;

    // Remove backlinks
    d.disc.assuntos.forEach((ass) => {
      if (ass.linkedAulaIds) {
        ass.linkedAulaIds = ass.linkedAulaIds.filter((id) => id !== aulaId);
      }
    });

    d.disc.aulas = d.disc.aulas.filter((a) => a.id !== aulaId);
    scheduleSave();
    openDiscManager(editingSubjectCtx.editaId, discId);
  });
}

import { mapAulasToAssuntos } from './lesson-mapper.js?v=8.37';
export function runLessonMapperUI(editaId, discId) {
  showConfirm(
    'Deseja aplicar Inteligência Artificial para conectar automaticamente as Aulas aos Assuntos deste Edital com base em similaridade (NLP + Levenshtein)?',
    () => {
      const resultCount = mapAulasToAssuntos(editaId, discId);
      if (resultCount > 0) {
        showToast(`${resultCount} Aulas Conectadas Automaticamente!`, 'success');
      } else {
        showToast('Nenhum Tópico bateu com 70%+ de precisão com esta base de Aulas.', 'info');
      }
      openDiscManager(editingSubjectCtx.editaId, discId);
    },
    { label: 'Rodar Auto-Link', title: 'Mapeador ML' }
  );
}

// Event modal functions moved to ui/event-modals.js
// Re-exported below

// Event modal functions moved to ui/event-modals.js
// Re-exported below

// Event modal functions moved to ui/event-modals.js
// Re-exported below

// =============================================
// UX 3 — DRAG AND DROP ASSUNTOS
// =============================================
export let _dndSrcDiscId = null;
export let _dndSrcIdx = null;

export function dndStart(event, discId, idx) {
  _dndSrcDiscId = discId;
  _dndSrcIdx = idx;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(idx));
}
export function dndOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}
export function dndLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}
export function dndDrop(event, discId, targetIdx) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  const srcIdx = _dndSrcIdx;
  if (srcIdx === null || srcIdx === targetIdx || _dndSrcDiscId !== discId) return;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      const moved = disc.assuntos.splice(srcIdx, 1)[0];
      disc.assuntos.splice(targetIdx, 0, moved);
      scheduleSave();
      // Re-render then re-open that disc's assuntos if available
      renderCurrentView();
      if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
        openDiscManager(editingSubjectCtx.editaId, discId);
      }
      showToast('Assunto reordenado!', 'success');
      _dndSrcDiscId = null;
      _dndSrcIdx = null;
      return;
    }
  }
}
addCleanupListener(document, 'dragend', () => {
  document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
});

addCleanupListener(document, 'dragstart', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  const discId = target.dataset.dndDisc;
  const idx = parseInt(target.dataset.dndIdx, 10);
  dndStart(e, discId, idx);
});

addCleanupListener(document, 'dragover', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  dndOver(e);
});

addCleanupListener(document, 'dragleave', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  dndLeave(e);
});

addCleanupListener(document, 'drop', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  const discId = target.dataset.dndDisc;
  const idx = parseInt(target.dataset.dndIdx, 10);
  dndDrop(e, discId, idx);
});

// Search functions moved to ui/search.js
// Re-exported below

export function openCicloHistory(seqId) {
  const plan = state.planejamento;
  if (!plan || !plan.sequencia) return;
  const seqItem = plan.sequencia.find((s) => s.id === seqId);
  if (!seqItem) return;

  const discInfo = getDisc(seqItem.discId);
  if (!discInfo) return;

  const titleEl = document.getElementById('modal-ciclo-history-title');
  if (titleEl)
    titleEl.innerHTML = `🕒 Histórico: ${discInfo.disc.icone || '📚'} ${esc(discInfo.disc.nome)}`;

  const bodyEl = document.getElementById('modal-ciclo-history-body');

  // Filtrar histórico de estudos da disciplina
  const eventosDisc = state.eventos
    .filter((e) => e.discId === seqItem.discId && e.status === 'estudei' && e.tempoAcumulado > 0)
    .sort((a, b) =>
      (b.data + 'T' + (b.hora || '00:00:00')).localeCompare(a.data + 'T' + (a.hora || '00:00:00'))
    );

  let btnDesfazer = '';
  if (seqItem.concluido) {
    btnDesfazer = `
      <div class="ciclo-history-actions">
        <button class="btn btn-ghost ciclo-history-undo-btn" data-action="desfazer-etapa" data-seq-id="${seqId}">
          <i class="fa fa-undo"></i> Desfazer 'Etapa Concluída' desta matéria
        </button>
      </div>
    `;
  }

  const htmlHistorico =
    eventosDisc.length === 0
      ? '<div class="ciclo-history-empty">Nenhuma sessão de estudo registrada ainda.</div>'
      : `
      <div class="flex flex-col gap-sm">
        ${eventosDisc
          .map(
            (ev) => `
            <div class="card ciclo-history-session-card">
              <div>
                <div class="ciclo-history-session-title">
                  ${formatDate(ev.data)} ${ev.hora ? `às ${ev.hora}` : ''}
                </div>
                <div class="ciclo-history-session-location">
                  📍 ${esc(ev.titulo)}
                </div>
                <div class="ciclo-history-session-time">
                   ⏱️ ${formatTime(ev.tempoAcumulado)} estudados
                </div>
              </div>
              <div>
                <button class="btn btn-ghost btn-sm" data-action="open-event-from-ciclo-history" data-event-id="${ev.id}"><i class="fa fa-edit"></i> Editar</button>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    `;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="modal-body-padded">
        ${btnDesfazer}
        <h4 class="ciclo-history-sessions-title">Sessões Recentes (${eventosDisc.length})</h4>
        ${htmlHistorico}
      </div>
    `;
  }

  openModal('modal-ciclo-history');
}

export function filtrarDropdownBanca(termo) {
  termo = termo.toLowerCase().trim();
  const select = document.getElementById('banca-disc-select');
  if (!select) return;
  Array.from(select.options).forEach((opt) => {
    if (opt.value === '') return;
    const visible = opt.text.toLowerCase().includes(termo);
    opt.style.display = visible ? '' : 'none';
  });
}
