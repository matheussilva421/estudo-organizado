import { THEME_OPTIONS, applyTheme, closeModal, currentView, navigate, normalizeTheme, showConfirm, showToast, openModal, cancelConfirm } from './app.js?v=8.13';
import { cutoffDateStr, esc, formatDate, formatTime, formatH, getEventStatus, invalidateTodayCache, todayStr, trunc, uid, HABIT_TYPES, addCleanupListener } from './utils.js?v=8.13';
import { scheduleSave, state, setState, runMigrations } from './store.js?v=8.13';
import { calcRevisionDates, getAllDisciplinas, getDisc, getPendingRevisoes, invalidateDiscCache, invalidateDashCaches, invalidateRevCache, invalidatePendingRevCache, reattachTimers, getElapsedSeconds, getPerformanceStats, getPagesReadStats, getSyllabusProgress, getConsistencyStreak, getSubjectStats, getCurrentWeekStats, getPredictiveStats, syncCicloToEventos } from './logic.js?v=8.13';
import { renderCurrentView, renderEventCard, updateBadges } from './components.js?v=8.13';
import { updateDriveUI } from './drive-sync.js?v=8.13';
import { renderDisciplinaDashboard } from './views/dashboard-view.js';

// Re-export from extracted view modules
export { renderHome } from './views/home-view.js';
export { renderCiclo, recomecarCiclo, zerarCiclosCounter, calculateCyclePredictions } from './views/ciclo-view.js';
export { renderHabitos, renderHabitHistPage, setHabitPage, openHabitModal, selectHabitType, saveHabit, calcSimuladoPerc, deleteHabito, HABIT_HIST_PAGE_SIZE, habitHistPage } from './views/habitos-view.js';
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
  setVertFilterEdital
} from './views/editais-view.js';
export { renderDisciplinaDashboard } from './views/dashboard-view.js';
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
  setAnalyzerCtx
} from './views/banca-view.js';

let editingSubjectCtx = null;
let editingDiscCtx = null;

function formatBackupDateTime(value) {
  if (!value) return 'Nunca';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Nunca';
  return dt.toLocaleString('pt-BR');
}

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
      html += `<td><div class="skeleton skeleton-cell"></div></td>`;
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
  '#8aa4bf', '#7dd3a8', '#d8a657', '#ef7777', '#a7a4d6',
  '#b6a28a', '#7fb7c7', '#9fbf8a', '#c58f6b', '#8e9fd0',
  '#79b8ad', '#d58c9d', '#83a9cb', '#b7a1cf', '#93c9a8',
  '#c6b176', '#c59ac1', '#7f8a99'
];

export const DISC_ICONS = [
  '📚', '📖', '📝', '📋', '📊', '📈', '🔬', '🧪', '🧮', '💻',
  '🌍', '🏛️', '⚖️', '🧠', '💡', '📐', '🔢', '🗂️', '📜', '🎯',
  '🩺', '🔧', '🎨', '🎵', '🏃', '🌱', '💰', '📡', '🔐', '📦'
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
  const ev = (state.eventos || []).find(e => e.id === record.eventoId);
  if (!ev) return 0;
  const qs = ev.sessao?.questoes || ev.questoes;
  if (!qs) return 0;
  const eventTotal = Number(qs.total ?? qs.quantidade ?? ((qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0)));
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function getPagesTotal(record) {
  if (!record) return 0;
  const rawPages = record.paginas;
  const pagesValue = (rawPages && typeof rawPages === 'object') ? rawPages.total : rawPages;
  const total = Number(record.total ?? pagesValue ?? record.quantidade ?? record.paginasLidas ?? 0);
  if (Number.isFinite(total) && total > 0) return total;

  // Legacy compatibility: some old habit records store only eventoId.
  const ev = (state.eventos || []).find(e => e.id === record.eventoId);
  if (!ev) return 0;
  const evPages = ev.sessao?.paginas;
  const eventTotal = Number((evPages && typeof evPages === 'object' ? evPages.total : evPages) ?? ev.paginas ?? 0);
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
  const best = estudados.length > 0
    ? estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a)
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
  const todayEvents = state.eventos.filter(e => e.data === today);
  const agendados = todayEvents.filter(e => e.status !== 'estudei');
  const estudados = todayEvents.filter(e => e.status === 'estudei');
  const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  el.innerHTML = `
    <div id="med-stats-row" class="med-stats-row">
      ${buildMEDStatsHTML(estudados, agendados)}
    </div>


        ${agendados.length === 0 && estudados.length === 0 ? `
      <div class="empty-state med-empty-state">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p class="mb-4">Adicione eventos de estudo para começar a registrar seu tempo.</p>
        <button class="btn btn-primary" data-action="open-add-event"><i class="fa fa-plus"></i> Iniciar Estudo</button>
      </div>
    ` : `
      <div id="med-section-agendado">
        ${agendados.length > 0 ? `
          <div class="section-header"><h2>📌 Agendado para Hoje</h2></div>
          ${agendados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
      <div id="med-section-estudado">
        ${estudados.length > 0 ? `
          <div class="section-header"><h2>✅ Estudado Hoje</h2></div>
          ${estudados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
    `}
    `;
}

// SURGICAL DOM UPDATES ---------------------------------------
export function refreshEventCard(eventId) {
  const el = document.querySelector(`[data-event-id="${eventId}"]`);
  if (!el) { renderCurrentView(); return; }
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) { el.remove(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = renderEventCard(ev);
  el.replaceWith(tmp.firstElementChild);
  reattachTimers();
}

export function refreshMEDSections() {
  if (currentView !== 'med') { renderCurrentView(); return; }
  const today = todayStr();
  const todayEvents = state.eventos.filter(e => e.data === today);
  const agendados = todayEvents.filter(e => e.status !== 'estudei');
  const estudados = todayEvents.filter(e => e.status === 'estudei');

  const statsRow = document.getElementById('med-stats-row');
  if (statsRow) statsRow.innerHTML = buildMEDStatsHTML(estudados, agendados);

  const secAgendado = document.getElementById('med-section-agendado');
  if (secAgendado) {
    secAgendado.innerHTML = agendados.length > 0
      ? `<div class="section-header"><h2>📌 Agendado para Hoje</h2></div> ${agendados.map(e => renderEventCard(e)).join('')}`
      : '';
  }

  const secEstudado = document.getElementById('med-section-estudado');
  if (secEstudado) {
    secEstudado.innerHTML = estudados.length > 0
      ? `<div class="section-header"><h2>✅ Estudado Hoje</h2></div> ${estudados.map(e => renderEventCard(e)).join('')}`
      : '';
  }

  reattachTimers();
}

export function removeDOMCard(eventId) {
  const el = document.querySelector(`[data-event-id="${eventId}"]`);
  if (el) {
    el.remove();
  } else {
    renderCurrentView();
    return;
  }
  refreshMEDSections();
}

// =============================================
function isMobileCalendar() {
  return window.innerWidth <= 600;
}

function renderCalendar(el) {
  const mobile = isMobileCalendar();
  let gridContent;
  if (mobile) {
    gridContent = calViewMode === 'mes' ? renderCalendarMobileMonth() : renderCalendarMobileWeek();
  } else {
    gridContent = calViewMode === 'mes' ? renderCalendarGrid() : renderCalendarWeek();
  }
  el.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="cal-header">
          <div class="cal-nav">
            <button aria-label="Mês anterior" data-action="cal-navigate" data-dir="-1"><i class="fa fa-chevron-left"></i></button>
            <button aria-label="Próximo mês" data-action="cal-navigate" data-dir="1"><i class="fa fa-chevron-right"></i></button>
          </div>
          <div class="cal-title" id="cal-title">${calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())} <span class="cal-version-tag">v6.0</span></div>
          <button class="btn btn-ghost btn-sm" id="cal-today-btn" data-action="cal-today">Hoje</button>
          <div class="cal-view-tabs ml-auto" role="tablist" aria-label="Visualização do calendário">
            <button type="button" class="cal-view-tab ${calViewMode === 'mes' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="mes" role="tab" aria-selected="${calViewMode === 'mes'}" aria-controls="cal-grid">Mês</button>
            <button type="button" class="cal-view-tab ${calViewMode === 'semana' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="semana" role="tab" aria-selected="${calViewMode === 'semana'}" aria-controls="cal-grid">Semana</button>
          </div>
        </div>
        <div id="cal-grid">${gridContent}</div>
      </div>
    </div>
  `;
  // Auto-scroll mobile list to today
  if (mobile) {
    requestAnimationFrame(() => {
      const todayEl = el.querySelector('.cal-mobile-day.today');
      if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
}

function resetCalDate() {
  calDate = new Date();
  renderCurrentView();
}

function calNavigate(dir) {
  if (calViewMode === 'mes') {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  } else {
    calDate.setDate(calDate.getDate() + dir * 7);
  }
  // Optimized: update only calendar grid instead of full re-render
  const grid = document.getElementById('cal-grid');
  if (grid) {
    const mobile = isMobileCalendar();
    if (mobile) {
      grid.innerHTML = calViewMode === 'mes' ? renderCalendarMobileMonth() : renderCalendarMobileWeek();
      // Scroll to today if visible in this month/week
      requestAnimationFrame(() => {
        const todayEl = grid.querySelector('.cal-mobile-day.today');
        if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    } else {
      grid.innerHTML = renderCalendarGrid();
    }
    updateCalendarHeader();
  } else {
    renderCurrentView();
  }
}

function renderCalendarMonth() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const startDow = (firstDay.getDay() - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana || 1;
  const dowOrder = Array.from({ length: 7 }, (_, i) => dows[(startDow0 + i) % 7]);

  let cells = [];
  // Previous month fill
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    cells.push({ date: d, other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), other: false });
  }
  // Fill the rest of the grid to ensure always 6 full rows (42 cells)
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), other: true });
  }

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

  // Pre-index events by date for O(1) lookup
  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }

  const gridClass = cells.length > 35 ? 'cal-grid rows-6' : 'cal-grid';

  return `
    <div class="${gridClass}">
      ${dowOrder.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.map(cell => {
    const ds = getDateStr(cell.date);
    const isToday = ds === today;
    const dayEvents = eventsByDate[ds] || [];
    const show = dayEvents.slice(0, 3);
    const more = dayEvents.length - 3;
    return `
          <div class="cal-cell ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-action="open-event-modal-date" data-date="${ds}">
            <div class="cal-date">${cell.date.getDate()}</div>
            ${show.map(e => {
      const st = getEventStatus(e);
      return `<button type="button" class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</button>`;
    }).join('')}
            ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// Optimized: render only calendar grid (for navigation without full re-render)
function renderCalendarGrid() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const startDow = (firstDay.getDay() - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana || 1;
  const dowOrder = Array.from({ length: 7 }, (_, i) => dows[(startDow0 + i) % 7]);

  let cells = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    cells.push({ date: d, other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), other: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), other: true });
  }

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }

  const gridClass = cells.length > 35 ? 'cal-grid rows-6' : 'cal-grid';

  return `
    <div class="${gridClass}" id="cal-grid-inner">
      ${dowOrder.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.map(cell => {
      const ds = getDateStr(cell.date);
      const isToday = ds === today;
      const dayEvents = eventsByDate[ds] || [];
      const show = dayEvents.slice(0, 3);
      const more = dayEvents.length - 3;
      return `
        <div class="cal-cell ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-action="open-event-modal-date" data-date="${ds}">
          <div class="cal-date">${cell.date.getDate()}</div>
          ${show.map(e => {
            const st = getEventStatus(e);
            return `<button type="button" class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</button>`;
          }).join('')}
          ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
        </div>
      `;
    }).join('')}
    </div>
  `;
}

function updateCalendarHeader() {
  const title = document.getElementById('cal-title');
  if (title) {
    const monthName = calDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }
  const todayBtn = document.getElementById('cal-today-btn');
  if (todayBtn) {
    const today = todayStr();
    const current = calDate.toISOString().split('T')[0];
    const isCurrentMonth = today.slice(0, 7) === current.slice(0, 7);
    if (todayBtn.classList.contains('cal-view-btn')) {
      todayBtn.classList.toggle('active', isCurrentMonth);
    }
  }
}

function renderCalendarWeek() {
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const weekStart = new Date(calDate);
  weekStart.setDate(calDate.getDate() - startOffset);
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana || 1;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

  // Pre-index events by date for O(1) lookup
  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }

  return `
    <div class="cal-week-grid">
      ${days.map(d => {
    const ds = getDateStr(d);
    const isToday = ds === today;
    const dayEvents = eventsByDate[ds] || [];
    return `
          <div class="cal-week-cell">
            <div class="cal-week-cell-header ${isToday ? 'cal-week-cell-header--today' : ''}">
              <div class="text-sm font-semibold text-secondary text-center">${dows[d.getDay()]}</div>
              <div class="text-xl font-bold ${isToday ? 'text-blue' : ''} text-center">${d.getDate()}</div>
            </div>
            <div class="cal-week-cell-body">
              ${dayEvents.map(e => {
      const st = getEventStatus(e);
      return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" class="cal-week-event" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
              <div class="text-center mt-1">
                <button class="icon-btn cal-week-add-btn" data-action="open-event-modal-date" data-date="${ds}">+</button>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// ── Mobile Calendar Views (vertical scrollable list) ──

function renderCalendarMobileMonth() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }

  let html = '<div class="cal-mobile-list">';
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const ds = getDateStr(date);
    const isToday = ds === today;
    const dayEvents = eventsByDate[ds] || [];
    const dowName = dows[date.getDay()];

    html += `
      <div class="cal-mobile-day ${isToday ? 'today' : ''} ${dayEvents.length === 0 ? 'empty' : ''}" data-action="open-event-modal-date" data-date="${ds}">
        <div class="cal-mobile-day-header">
          <div class="cal-mobile-date ${isToday ? 'today' : ''}">${d}</div>
          <div class="cal-mobile-dow">${dowName}</div>
          ${dayEvents.length === 0 ? '<span class="cal-mobile-empty">Sem eventos</span>' : ''}
        </div>
        ${dayEvents.length > 0 ? `
          <div class="cal-mobile-events">
            ${dayEvents.map(e => {
              const st = getEventStatus(e);
              return `<div class="cal-event-chip ${st} text-wrap" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function renderCalendarMobileWeek() {
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const weekStart = new Date(calDate);
  weekStart.setDate(calDate.getDate() - startOffset);
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }

  let html = '<div class="cal-mobile-list">';
  for (const d of days) {
    const ds = getDateStr(d);
    const isToday = ds === today;
    const dayEvents = eventsByDate[ds] || [];
    const dowName = dows[d.getDay()];

    html += `
      <div class="cal-mobile-day ${isToday ? 'today' : ''} ${dayEvents.length === 0 ? 'empty' : ''}" data-action="open-event-modal-date" data-date="${ds}">
        <div class="cal-mobile-day-header">
          <div class="cal-mobile-date ${isToday ? 'today' : ''}">${d.getDate()}</div>
          <div class="cal-mobile-dow">${dowName}</div>
          ${dayEvents.length === 0 ? '<span class="cal-mobile-empty">Sem eventos</span>' : ''}
        </div>
        ${dayEvents.length > 0 ? `
          <div class="cal-mobile-events">
            ${dayEvents.map(e => {
              const st = getEventStatus(e);
              return `<div class="cal-event-chip ${st} text-wrap" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// calClickDay removed — inline calls use openAddEventModalDate directly

export function openAddEventModalDate(dateStr) {
  openAddEventModal(dateStr);
}

// =============================================
// EVENT DETAIL MODAL
// =============================================
export function openEventDetail(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;
  const body = document.getElementById('modal-event-detail-body');
  if (!body) return;
  const status = getEventStatus(ev);
  const elapsed = getElapsedSeconds(ev);
  const tempoStr = elapsed > 0 ? formatTime(elapsed) : '00:00:00';
  const discInfo = ev.discId ? getDisc(ev.discId) : null;
  const disc = discInfo ? discInfo.disc : null;
  const ass = disc && ev.assId && disc.assuntos ? disc.assuntos.find(a => a.id === ev.assId) : null;

  let html = `
    <div class="stack-md">
      <div class="event-detail-title">
        ${esc(ev.titulo)}
      </div>
      <div class="grid-2">
        <div class="card p-3">
          <div class="text-sm text-muted font-semibold mb-1">STATUS</div>
          <div class="text-lg text-primary font-medium event-tag ${status}">
            ${status === 'estudei' ? 'concluido' : status === 'atrasado' ? 'Atrasado' : 'Agendado'}
          </div>
        </div>
        <div class="card p-3">
          <div class="text-sm text-muted font-semibold mb-1">TEMPO ACUMULADO</div>
          <div class="text-xl text-primary font-bold text-mono">
            ${tempoStr}
          </div>
        </div>
      </div>
      <div><strong>Data Inicial:</strong> ${formatDate(ev.data)}</div>
      ${disc ? `<div><strong>Disciplina:</strong> ${esc(disc.nome)}</div>` : ''}
      ${ass ? `<div><strong>Assunto:</strong> ${esc(ass.nome)}</div>` : ''}
      ${ev.notas ? `<div class="mt-2"><strong>Anotações:</strong><div class="card p-3 mt-2 event-detail-notes">${esc(ev.notas)}</div></div>` : ''}
      ${ev.fontes ? `<div><strong>Fontes:</strong> ${esc(ev.fontes)}</div>` : ''}
      ${ev.legislacao ? `<div><strong>Legislação:</strong> ${esc(ev.legislacao)}</div>` : ''}
    </div>
    <div class="modal-footer event-detail-footer">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-event-detail">Fechar</button>
      <button class="btn btn-danger" data-action="delete-event-from-modal" data-event-id="${ev.id}">Excluir Evento</button>
    </div>
  `;
  body.innerHTML = html;
  openModal('modal-event-detail');
}

// =============================================
// DASHBOARD VIEW
// =============================================
// =============================================
// UX 4 — DASHBOARD WITH PERIOD FILTER
// =============================================
export let dashPeriod = 7; // default: last 7 days
export let _chartDaily = null, _chartDisc = null;

export function destroyDashboardCharts() {
  if (_chartDaily) { _chartDaily.destroy(); _chartDaily = null; }
  if (_chartDisc) { _chartDisc.destroy(); _chartDisc = null; }
}

export function renderDashboard(el) {
  const periodDays = dashPeriod; // null = all time
  const periodLabel = { 7: '7 dias', 30: '30 dias', 90: '3 meses', null: 'Total' }[periodDays];

  // Fix 2: compute cutoff once, reuse across all filters in this render
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  const filteredEvts = cutoffStr
    ? state.eventos.filter(e => e.status === 'estudei' && e.data && e.data >= cutoffStr)
    : state.eventos.filter(e => e.status === 'estudei');

  const totalSecs = filteredEvts.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const questTot = cutoffStr
    ? sumQuestionRecords((state.habitos.questoes || []).filter(r => r.data >= cutoffStr))
    : sumQuestionRecords(state.habitos.questoes || []);
  const simTot = cutoffStr
    ? (state.habitos.simulado || []).filter(r => r.data >= cutoffStr).length
    : (state.habitos.simulado || []).length;

  el.innerHTML = `
    <!-- Period selector -->
    <div class="flex-between mb-4">
      <div class="text-md text-secondary">Exibindo dados: <strong class="text-primary">${periodLabel}</strong></div>
      <div class="cal-view-tabs" role="tablist" aria-label="Período do dashboard">
        ${[7, 30, 90, null].map(p => `
          <button type="button" class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" data-action="set-dash-period" data-period="${p}" role="tab" aria-selected="${dashPeriod === p}">
            ${{ 7: '7d', 30: '30d', 90: '3m', null: 'Total' }[p]}
          </button>`).join('')}
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
  if (_chartDaily) { _chartDaily.destroy(); _chartDaily = null; }
  const themeVars = getComputedStyle(document.documentElement);
  const accent = themeVars.getPropertyValue('--accent').trim() || '#8aa4bf';
  const accentLight = themeVars.getPropertyValue('--accent-light').trim() || 'rgba(138, 164, 191, 0.16)';
  const border = themeVars.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.14)';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#b8c0cc';
  const numDays = periodDays ? Math.min(periodDays, 90) : 30;
  // Pre-aggregate study time by date for O(1) lookup
  const secsByDate = {};
  for (const e of state.eventos) {
    if (e.status === 'estudei' && e.tempoAcumulado) {
      secsByDate[e.data] = (secsByDate[e.data] || 0) + (e.tempoAcumulado || 0);
    }
  }
  const days = [], data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    const ds = d2.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    data.push(Math.round((secsByDate[ds] || 0) / 60));
  }
  _chartDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{ label: 'Minutos', data, backgroundColor: accentLight, borderColor: accent, borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: border }, ticks: { color: textSecondary, font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: textSecondary, font: { size: numDays > 20 ? 9 : 11 }, maxRotation: numDays > 20 ? 45 : 0, maxTicksLimit: 20 } }
      }
    }
  });
}

export function renderDiscChart(periodDays) {
  const ctx = document.getElementById('chart-disc');
  if (!ctx) return;
  if (_chartDisc) { _chartDisc.destroy(); _chartDisc = null; }
  const themeVars = getComputedStyle(document.documentElement);
  const border = themeVars.getPropertyValue('--border').trim() || '#e2e8f0';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#475569';
  const discTime = {};
  const cutoffStr2 = periodDays ? cutoffDateStr(periodDays) : null;
  const evts = cutoffStr2
    ? state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado && e.data >= cutoffStr2)
    : state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado);
  evts.forEach(e => { discTime[e.discId] = (discTime[e.discId] || 0) + e.tempoAcumulado; });
  const labels = [], data = [], colors = [];
  Object.entries(discTime).forEach(([id, secs]) => {
    const d = getDisc(id);
    labels.push(d ? d.disc.nome : id);
    data.push(Math.round(secs / 60));
    colors.push(d ? (d.disc.cor || '#8aa4bf') : '#7f8a99');
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
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textSecondary, font: { size: 11 }, boxWidth: 12 } },
        tooltip: { enabled: !dummyTooltip }
      }
    }
  });
}

export function renderHabitSummary(periodDays) {
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  return HABIT_TYPES.map(h => {
    const recent = cutoffStr
      ? (state.habitos[h.key] || []).filter(r => r.data >= cutoffStr)
      : (state.habitos[h.key] || []);
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
  const discs = getAllDisciplinas();
  if (discs.length === 0) return '<div class="empty-state"><div class="icon">📋</div><p>Nenhuma disciplina cadastrada</p></div>';
  return discs.slice(0, 8).map(({ disc, edital }) => {
    const total = (disc.assuntos || []).length;
    const done = (disc.assuntos || []).filter(a => a.concluido).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
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
  }).join('');
}

// =============================================
// REVISOES VIEW
// =============================================
// Fix 4: Get upcoming revisions for next N days
export function getUpcomingRevisoes(days = 30) {
  const today = todayStr();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const future2 = new Date(future.getTime() - (future.getTimezoneOffset() * 60000));
  const futureStr = future2.toISOString().split('T')[0];
  const upcoming = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
      for (const ass of (disc.assuntos || [])) {
        if (!ass.concluido || !ass.dataConclusao) continue;
        const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || [], ass.adiamentos || 0);
        for (const rd of revDates) {
          if (rd > today && rd <= futureStr) {
            upcoming.push({ assunto: ass, disc, edital, data: rd, revNum: (ass.revisoesFetas || []).length + 1 });
            break; // only the next scheduled one
          }
        }
      }
    }
  }
  return upcoming.sort((a, b) => a.data.localeCompare(b.data));
}

export function renderRevisoes(el) {
  const pending = getPendingRevisoes();
  const upcoming = getUpcomingRevisoes(30);
  const today = todayStr();

  el.innerHTML = `
    <div class="rev-summary-grid">
      <div class="card rev-summary-card">
        <div class="section-label">Pendentes Hoje</div>
        <div class="rev-stat-count rev-stat-count--danger">${pending.filter(r => r.data <= today).length}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Próx. 30 dias</div>
        <div class="rev-stat-count rev-stat-count--info">${upcoming.length}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Assuntos concluidos</div>
        <div class="rev-stat-count rev-stat-count--accent">${getAllDisciplinas().reduce((s, { disc }) => s + (disc.assuntos || []).filter(a => a.concluido).length, 0)}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Frequência</div>
        <div class="text-md font-bold text-primary mt-2">${(state.config.frequenciaRevisao || [1, 7, 30, 90]).join(', ')} dias</div>
      </div>
    </div>

    <div class="tabs rev-tabs" role="tablist" aria-label="Revisões">
      <button type="button" class="tab-btn active" data-action="switch-revision-tab" data-tab="pendentes" data-target="this" role="tab" aria-selected="true" aria-controls="rev-tab-pendentes">🔄 Pendentes (${pending.length})</button>
      <button type="button" class="tab-btn" data-action="switch-revision-tab" data-tab="proximas" data-target="this" role="tab" aria-selected="false" aria-controls="rev-tab-proximas">📅 Próximas 30 dias (${upcoming.length})</button>
    </div>

    <div id="rev-tab-pendentes" class="tab-content active">
      ${pending.length === 0 ? `
        <div class="empty-state"><div class="icon">✅</div><h4>Nenhuma revisão pendente!</h4><p>Conclua assuntos para que as revisões sejam agendadas automaticamente.</p></div>
      ` : pending.map(r => {
    const isOverdue = r.data < today;
    const revNum = (r.assunto.revisoesFetas || []).length + 1;
    return `
          <div class="rev-item">
            <div class="rev-days ${isOverdue ? 'overdue' : 'today'}">
              <div class="num">${revNum}ª</div>
              <div class="label">Rev</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-md font-semibold">${r.assunto.nome}</div>
              <div class="text-base text-secondary">${r.disc.nome} • ${r.edital.nome}</div>
              <div class="text-sm mt-1 ${isOverdue ? 'text-red' : 'text-accent'}">
                ${isOverdue ? '⚠️ Atrasada' : '📅 Hoje'} • Prevista para ${formatDate(r.data)}
              </div>
            </div>
            <div class="rev-item-actions cluster-sm">
              <button type="button" class="btn btn-primary btn-sm" data-action="mark-revision" data-assunto-id="${r.assunto.id}">✅ Feita</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="postpone-revision" data-assunto-id="${r.assunto.id}">⏩ +1 dia</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="delete-revision" data-assunto-id="${r.assunto.id}" title="Excluir revisão" style="color:var(--danger);">🗑️</button>
            </div>
          </div>
        `;
  }).join('')}
    </div>

    <div id="rev-tab-proximas" class="tab-content">
      ${upcoming.length === 0 ? `
        <div class="empty-state"><div class="icon">📅</div><h4>Nenhuma revisão nos próximos 30 dias</h4><p>Continue estudando e concluíndo assuntos!</p></div>
      ` : (() => {
      return upcoming.map(r => {
        const diffDays = Math.ceil((new Date(r.data + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
        return `
            <div class="rev-item">
              <div class="rev-days rev-days--upcoming">
                <div class="num">${r.revNum}ª</div>
                <div class="label">Rev</div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-md font-semibold">${r.assunto.nome}</div>
                <div class="text-base text-secondary">${r.disc.nome} • ${r.edital.nome}</div>
              </div>
              <div class="text-right">
                <div class="text-base font-bold text-blue">${formatDate(r.data)}</div>
                <div class="text-sm text-muted">em ${diffDays} dia${diffDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `;
      }).join('');
    })()}
    </div>
  `;
}

export function switchRevTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rev-tab-pendentes').classList.toggle('active', tab === 'pendentes');
  document.getElementById('rev-tab-proximas').classList.toggle('active', tab === 'proximas');
}

export function marcarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
      const ass = (disc.assuntos || []).find(a => a.id === assId);
      if (ass) {
        if (!ass.revisoesFetas) ass.revisoesFetas = [];
        ass.revisoesFetas.push(todayStr());
        invalidateRevCache();
        invalidatePendingRevCache();
        scheduleSave();
        renderCurrentView();
        showToast('Revisão registrada! ✅', 'success');
        return;
      }
    }
  }
}

export function adiarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
      const ass = (disc.assuntos || []).find(a => a.id === assId);
      if (ass) {
        // Store a deferral date natively without mutating completion history
        if (!ass.adiamentos) ass.adiamentos = 0;
        ass.adiamentos = (ass.adiamentos || 0) + 1;
        invalidateRevCache();
        invalidatePendingRevCache();
        scheduleSave();
        renderCurrentView();
        showToast('Revisão adiada por 1 dia', 'info');
        return;
      }
    }
  }
}

export function deletarRevisao(assId) {
  showConfirm('Tem certeza que deseja excluir esta revisão? Isso não removerá o tópico dos concluídos, apenas a removerá da lista de revisões pendentes.', async (confirmed) => {
    if (!confirmed) return;

    for (const edital of state.editais) {
      for (const disc of (edital.disciplinas || [])) {
        const ass = (disc.assuntos || []).find(a => a.id === assId);
        if (ass) {
          // Remove the last revision entry from the array
          if (ass.revisoesFetas && ass.revisoesFetas.length > 0) {
            ass.revisoesFetas.pop();
          }
          invalidateRevCache();
          invalidatePendingRevCache();
          scheduleSave();
          renderCurrentView();
          showToast('Revisão excluída!', 'info');
          return;
        }
      }
    }
  });
}

// =============================================
// HABITOS VIEW
// =============================================

export function renderHistoricoSessoes(el) {
  const eventosEstudados = (state.eventos || [])
    .filter(ev => ev && ev.status === 'estudei')
    .sort((a, b) => {
      const dateA = String(a.data || '');
      const dateB = String(b.data || '');
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      const timeA = Number(new Date(a.updatedAt || a.createdAt || 0).getTime()) || 0;
      const timeB = Number(new Date(b.updatedAt || b.createdAt || 0).getTime()) || 0;
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
  eventosEstudados.forEach(ev => {
    const dateKey = ev.data || '__sem_data__';
    if (!gruposPorData.has(dateKey)) gruposPorData.set(dateKey, new Map());

    const discInfo = ev.discId ? getDisc(ev.discId) : null;
    const discId = discInfo?.disc?.id || '__sem_disciplina__';

    if (!gruposPorData.get(dateKey).has(discId)) {
      gruposPorData.get(dateKey).set(discId, {
        discId,
        discNome: discInfo?.disc?.nome || 'Sem disciplina',
        discIcone: discInfo?.disc?.icone || '📚',
        itens: []
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
  const totalTempo = eventosEstudados.reduce((sum, ev) => sum + (Number(ev.tempoAcumulado) || 0), 0);

  el.innerHTML = `
    <div class="card p-16 session-history-summary">
      <div class="session-history-header">
        <div class="dash-label">HISTÓRICO GLOBAL DE SESSÕES</div>
        <div class="session-history-badges">
          <span class="badge">${totalSessoes} sessões</span>
          <span class="badge">⏱ ${formatTime(totalTempo)}</span>
        </div>
      </div>
      <div class="session-history-hint">Agrupado por data e disciplina. Use "Editar" para ajustar o registro e "Apagar" para remover permanentemente.</div>
    </div>

    ${dateKeys.map(dateKey => {
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

          <div class="session-group-grid">
            ${disciplinas.map(group => `
              <div class="session-disc-card">
                <div class="session-disc-header">
                  <div class="session-disc-title">${esc(group.discIcone)} ${esc(group.discNome)}</div>
                  <div class="session-disc-count">${group.itens.length} registro(s)</div>
                </div>

                <div class="custom-scrollbar session-scroll-container">
                  ${group.itens.map(ev => {
      const questoes = ev.sessao?.questoes || ev.questoes || {};
      const acertos = Number(questoes.acertos ?? questoes.certas ?? 0) || 0;
      const erros = Number(questoes.erros ?? questoes.erradas ?? 0) || 0;
      const totalExplicito = Number(questoes.total ?? questoes.quantidade);
      const totalQuestoes = Number.isFinite(totalExplicito) && totalExplicito > 0 ? totalExplicito : (acertos + erros);
      const percAcertos = totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0;

      const paginasRaw = ev.sessao?.paginas;
      const paginas = Number((paginasRaw && typeof paginasRaw === 'object' ? paginasRaw.total : paginasRaw) ?? ev.paginas ?? 0) || 0;
      const tempoLabel = formatTime(Number(ev.tempoAcumulado) || 0);

      const discInfo = ev.discId ? getDisc(ev.discId) : null;
      const assunto = ev.assId && discInfo?.disc?.assuntos
        ? discInfo.disc.assuntos.find(a => a.id === ev.assId)?.nome
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
                          <button class="btn btn-ghost btn-sm session-item-btn" data-action="edit-session-record" data-session-id="${eventId}">Editar</button>
                          <button class="btn btn-ghost btn-sm session-item-btn session-item-btn-danger" data-action="delete-session-record" data-session-id="${eventId}">Apagar</button>
                        </div>
                      </div>

                      <div class="session-item-badges">
                        <span class="badge session-item-badge">⏱ ${tempoLabel}</span>
                        <span class="badge session-item-badge">❓ ${totalQuestoes > 0 ? `${acertos}/${totalQuestoes} (${percAcertos}%)` : '-'}</span>
                        <span class="badge session-item-badge">📄 ${paginas > 0 ? paginas : '-'}</span>
                      </div>
                    </div>
                  `;
    }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      `;
  }).join('')}
  `;
}

// =============================================
// EDITAIS VIEW
// =============================================


export let vertFilterEdital = '';
export let vertFilterStatus = 'todos';
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
    for (const disc of (edital.disciplinas || [])) {
      for (const ass of (disc.assuntos || [])) {
        items.push({ edital, disc, ass });
      }
    }
  }
  if (vertFilterEdital) items = items.filter(i => i.edital.id === vertFilterEdital);
  if (vertFilterStatus === 'pendentes') items = items.filter(i => !i.ass.concluido);
  if (vertFilterStatus === 'concluidos') items = items.filter(i => i.ass.concluido);
  if (vertSearch) {
    const q = vertSearch.toLowerCase();
    items = items.filter(i => i.ass.nome.toLowerCase().includes(q) || i.disc.nome.toLowerCase().includes(q));
  }
  return items;
}

// verResumoSimulado removida — funcionalidade descontinuada

export function toggleEditSeq() {
  window._isEditingSequence = !window._isEditingSequence;
  if (window._isEditingSequence) {
    window._tempSequencia = JSON.parse(JSON.stringify(state.planejamento.sequencia));
  } else {
    window._tempSequencia = null;
  }
  renderCurrentView();
}
window.toggleEditSeq = toggleEditSeq;

export function saveEditSeq() {
  if (!window._tempSequencia || window._tempSequencia.length === 0) {
    showToast("A sequência de estudos não pode ficar vazia.", "error");
    return;
  }
  for (let s of window._tempSequencia) {
    if (!s.discId) {
      showToast("Por favor, selecione uma disciplina para todas as etapas antes de salvar.", "error");
      return;
    }
  }

  state.planejamento.sequencia = window._tempSequencia;
  syncCicloToEventos();
  scheduleSave();

  window._isEditingSequence = false;
  window._tempSequencia = null;
  renderCurrentView();
}
window.saveEditSeq = saveEditSeq;

export function cancelEditSeq() {
  window._isEditingSequence = false;
  window._tempSequencia = null;
  renderCurrentView();
}
window.cancelEditSeq = cancelEditSeq;

export function updateSeqItem(i, field, val) {
  i = parseInt(i, 10);
  if (field === 'minutosAlvo') val = parseInt(val) || 0;
  window._tempSequencia[i][field] = val;
}
window.updateSeqItem = updateSeqItem;

export function dupSeqItem(i) {
  i = parseInt(i, 10);
  const obj = JSON.parse(JSON.stringify(window._tempSequencia[i]));
  obj.id = 'seq_' + uid();
  window._tempSequencia.splice(i + 1, 0, obj);
  renderCurrentView();
}
window.dupSeqItem = dupSeqItem;

export function remSeqItem(i) {
  i = parseInt(i, 10);
  window._tempSequencia.splice(i, 1);
  renderCurrentView();
}
window.remSeqItem = remSeqItem;

export function moveSeqItem(i, dir) {
  i = parseInt(i, 10);
  const arr = window._tempSequencia;
  if (i + dir < 0 || i + dir >= arr.length) return;
  const temp = arr[i];
  arr[i] = arr[i + dir];
  arr[i + dir] = temp;
  renderCurrentView();
}
window.moveSeqItem = moveSeqItem;

export function addSeqItem() {
  window._tempSequencia.push({
    id: 'seq_' + uid(),
    discId: '',
    minutosAlvo: 60
  });
  renderCurrentView();
}
window.addSeqItem = addSeqItem;

export function addEventoParaAssunto(editaId, discId, assId) {
  const d = getDisc(discId);
  const ass = d?.disc?.assuntos?.find(a => a.id === assId);
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
          if (ti) { ti.value = ass.nome; ti.dataset.autoFilled = 'true'; }
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
    if (!edital.disciplinas) continue; const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      const ass = (disc.assuntos || []).find(a => a.id === assId);
      if (ass) {
        ass.concluido = !ass.concluido;
        ass.dataConclusao = ass.concluido ? todayStr() : null;
        if (ass.concluido) ass.revisoesFetas = [];
        scheduleSave();

        // Re-render local dashboard if open, otherwise full view
        if (window.activeDashboardDiscCtx && window.activeDashboardDiscCtx.discId === discId) {
          openDiscDashboard(window.activeDashboardDiscCtx.editaId, discId);
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
    const disc = edital.disciplinas.find(d => d.id === discId);
    if (!disc) continue;

    const aula = (disc.aulas || []).find(a => a.id === aulaId);
    if (!aula) return;

    aula.estudada = !aula.estudada;
    aula.dataEstudo = aula.estudada ? todayStr() : null;
    scheduleSave();

    if (window.activeDashboardDiscCtx && window.activeDashboardDiscCtx.discId === discId) {
      openDiscDashboard(editaId, discId);
    } else {
      renderCurrentView();
    }

    showToast(aula.estudada ? 'Aula marcada como estudada.' : 'Aula desmarcada.', 'success');
    return;
  }
}

window.activeDashboardDiscCtx = null;

export function openDiscDashboard(editaId, discId) {
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital || !edital.disciplinas) return;
  const disc = edital.disciplinas.find(d => d.id === discId);
  if (!disc) return;

  window.activeDashboardDiscCtx = { editaId, discId };

  // Set window Topbar
  const topbarTitle = document.getElementById('topbar-title');
  const actions = document.getElementById('topbar-actions');
  if (!topbarTitle || !actions) return;
  topbarTitle.textContent = `${disc.icone || '📚'} ${disc.nome} `;
  actions.innerHTML = `<button class="btn btn-ghost btn-sm" data-action="close-disc-dashboard"><i class="fa fa-arrow-left"></i> Voltar</button>`;

  const el = document.getElementById('main-content');
  el.innerHTML = renderDisciplinaDashboard(edital, disc);
  setTimeout(() => initDiscDashboardChart(disc.id), 100);
}

export function closeDiscDashboard() {
  window.activeDashboardDiscCtx = null;
  window.activeDashboardTab = 'topicos'; // Reset tab
  renderCurrentView();
}

export function switchDashboardTab(tabName) {
  window.activeDashboardTab = tabName;
  const ctx = window.activeDashboardDiscCtx;
  if (ctx && ctx.editaId && ctx.discId) {
    const edital = state.editais.find(e => e.id === ctx.editaId);
    const disc = edital?.disciplinas?.find(d => d.id === ctx.discId);
    if (disc) {
      openDiscDashboard(ctx.editaId, ctx.discId);
      return;
    }
  }

  renderCurrentView();
}
window.switchDashboardTab = switchDashboardTab;



function renderHistoricoDisciplina(tempos) {
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
          ${reverseTempos.map(t => {
    const dateStr = formatDate(t.data);
    const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
    const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
    const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
    const certas = qs.acertos || qs.certas || 0;
    const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
    const percColor = perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
    const pags = t.sessao?.paginas?.total || t.paginas || null;

    return `
              <tr class="session-history-row" data-action="open-registro-sessao" data-disc-id="${t.id}">
                <td>${dateStr}</td>
                <td class="session-history-time">${tempoStr}</td>
                <td>${pags ?? '-'}</td>
                <td>${certas} / ${totQs}</td>
                <td class="session-history-acerto ${totQs > 0 ? (perc >= 70 ? 'text-green' : perc >= 50 ? 'text-accent' : 'text-red') : ''}">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
  }).join('')}
        </tbody>
      </table>
    </div>
          `;
}

function renderTopicosEditalDisciplina(edital, disc) {
  if (!disc.assuntos || disc.assuntos.length === 0) {
    return '<div class="empty-state-centered">Nenhum tópico cadastrado.</div>';
  }

  return `
    <div class="custom-scrollbar">
      ${disc.assuntos.map(ass => {
    const importanceBadge = ass.relevance?.priority === 'P1' ?
      `<span class="priority-badge-p1" title="Alta Chance de Cobrança">🔥 P1</span>` :
      (ass.relevance?.priority === 'P2' ? `<span class="priority-badge-p2">⚠️ P2</span>` : '');

    return `
        <div class="subject-item ${ass.concluido ? 'subject-item-concluded' : ''}">
          <div class="check-circle ${ass.concluido ? 'done' : ''}" data-action="toggle-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-width-0 subject-item-title ${ass.concluido ? 'subject-item-title--concluded' : ''}">
             ${esc(ass.nome)} ${importanceBadge}
          </div>
          ${ass.concluido ? `
            <div class="text-right">
              <div class="text-concluded-badge">✅ concluído</div>
              <div class="text-concluded-date">${formatDate(ass.dataConclusao)}</div>
            </div>
          ` : `
            <button class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">+ Agenda</button>
          `}
        </div>
      `}).join('')}
    </div>
  `;
}

function renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return `<div class="empty-state-column">
      <div class="empty-state-icon">🗂️</div>
      <div class="empty-state-title">Nenhuma aula ou material cadastrado.</div>
      <div class="empty-state-hint">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</div>
    </div>`;
  }

  return `
    <div class="custom-scrollbar">
      ${disc.aulas.map(aul => {
    const itemClass = aul.estudada ? 'aula-item aula-item-concluded' : 'aula-item';
    const titleClass = aul.estudada ? 'aula-title aula-title-concluded' : 'aula-title';

    return `
        <div class="${itemClass}">
          <div class="check-circle ${aul.estudada ? 'done' : ''}" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="${titleClass}">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div class="aula-linked-count">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${!aul.estudada ? `
            <button class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
          ` : ''}
        </div>
      `}).join('')}
    </div>
  `;
}

function renderBancaDisciplinaDashboard(edital, disc) {
  const hasHotTopics = state.bancaRelevance && state.bancaRelevance.hotTopics && state.bancaRelevance.hotTopics.some(ht => ht.disciplinaId === disc.id);
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

  const tempos = state.eventos ? state.eventos.filter(e => {
    const qs = e.sessao?.questoes || e.questoes;
    return e.discId === discId && e.status === 'estudei' && qs &&
      ((qs.acertos || qs.certas || 0) > 0 || (qs.erros || qs.erradas || 0) > 0);
  }) : [];

  const grouped = {};
  [...tempos].sort((a, b) => a.data.localeCompare(b.data)).forEach(t => {
    if (!grouped[t.data]) grouped[t.data] = { certas: 0, erradas: 0 };
    const qs = t.sessao?.questoes || t.questoes;
    grouped[t.data].certas += (qs.acertos || qs.certas || 0);
    grouped[t.data].erradas += (qs.erros || qs.erradas || 0);
  });

  const rawLabels = Object.keys(grouped).slice(-15);
  const labels = rawLabels.map(d => formatDate(d));
  const dataPerc = rawLabels.map(d => {
    const total = grouped[d].certas + grouped[d].erradas;
    return total > 0 ? Math.round((grouped[d].certas / total) * 100) : 0;
  });

  if (window._discChartInstance) {
    window._discChartInstance.destroy();
  }

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    parent.innerHTML = '<div class="dashboard-chart-empty">Métricas insuficientes. Registre sessões com número de questões para gerar o gráfico de evolução.</div>';
    return;
  }

  const ctx = canvas.getContext('2d');
  window._discChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
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
        fill: true
      }]
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
            label: (ctx) => `${ctx.raw}% de Acerto`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: textMuted, callback: v => v + '%' },
          grid: { color: grid }
        },
        x: {
          ticks: { color: textMuted },
          grid: { display: false }
        }
      }
    }
  });
}

export function deleteAssunto(discId, assId) {
  showConfirm('Excluir este assunto? Eventos vinculados serão desvinculados.', () => {
    const entry = getDisc(discId);
    if (entry) {
      entry.disc.assuntos = entry.disc.assuntos.filter(a => a.id !== assId);

      if (state.eventos) {
        state.eventos.forEach(e => {
          if (e.assId === assId) { delete e.assId; }
        });
      }

      invalidateDiscCache();
      invalidateDashCaches();
      scheduleSave();
      renderCurrentView();
      if (typeof editingSubjectCtx !== 'undefined' && editingSubjectCtx && editingSubjectCtx.discId === discId) {
        openDiscManager(editingSubjectCtx.editaId, discId);
      }
    }
  }, { danger: true, label: 'Excluir', title: 'Excluir assunto' });
}

export function deleteDisc(editaId, discId) {
  showConfirm('Excluir esta disciplina e todos seus assuntos?\n\nEsta ação não pode ser desfeita.', () => {
    const edital = state.editais.find(e => e.id === editaId);
    if (!edital || !edital.disciplinas) return;
    edital.disciplinas = edital.disciplinas.filter(d => d.id !== discId);

    if (state.eventos) {
      state.eventos.forEach(e => {
        if (e.discId === discId) { delete e.discId; delete e.assId; }
      });
    }
    if (state.planejamento && state.planejamento.disciplinas) {
      state.planejamento.disciplinas = state.planejamento.disciplinas.filter(id => id !== discId);
      if (state.planejamento.relevancia && state.planejamento.relevancia[discId]) delete state.planejamento.relevancia[discId];
      if (state.planejamento.sequencia) state.planejamento.sequencia = state.planejamento.sequencia.filter(s => s.discId !== discId);
    }

    invalidateDiscCache();
    invalidateDashCaches();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' });
}

export function deleteEdital(editaId) {
  const edital = state.editais.find(e => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(`Excluir "${nome}" completamente ?

      Todos os grupos, disciplinas e assuntos serão removidos.Esta ação não pode ser desfeita.`, () => {
    const discIds = edital && edital.disciplinas ? edital.disciplinas.map(d => d.id) : [];
    state.editais = state.editais.filter(e => e.id !== editaId);

    if (discIds.length > 0 && state.eventos) {
      state.eventos.forEach(e => {
        if (discIds.includes(e.discId)) { delete e.discId; delete e.assId; }
      });
    }
    if (discIds.length > 0 && state.planejamento && state.planejamento.disciplinas) {
      state.planejamento.disciplinas = state.planejamento.disciplinas.filter(id => !discIds.includes(id));
      discIds.forEach(id => {
        if (state.planejamento.relevancia && state.planejamento.relevancia[id]) delete state.planejamento.relevancia[id];
      });
      if (state.planejamento.sequencia) state.planejamento.sequencia = state.planejamento.sequencia.filter(s => !discIds.includes(s.discId));
    }

    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir edital', title: 'Excluir edital' });
}

// =============================================
// EDITAL MODAL
// =============================================
export function openEditaModal(editaId = null) {
  const edital = editaId ? state.editais.find(e => e.id === editaId) : null;
  document.getElementById('modal-edital-title').textContent = edital ? 'Editar Edital' : 'Novo Edital';
  document.getElementById('modal-edital-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome do Edital</label>
      <input type="text" class="form-control" id="edital-nome" placeholder="Ex: Concurso TRF 2025" value="${edital ? esc(edital.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="edital-colors">
        ${COLORS.map(c => `<div class="color-swatch ${edital && edital.cor === c ? 'selected' : ''}" data-action="select-color" data-color="${c}" data-container="edital-colors" data-color-value="${c}"></div>`).join('')}
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
  container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  container.querySelector(`[data-color-value="${color}"]`)?.classList.add('selected');
  const input = document.getElementById(containerId === 'edital-colors' ? 'edital-cor' : containerId === 'disc-colors' ? 'disc-cor' : 'edital-cor');
  if (input) input.value = color;
}

export function saveEdital(editaId) {
  const nomeEl = document.getElementById('edital-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) { showToast('Informe o nome do edital', 'error'); return; }
  const cor = document.getElementById('edital-cor')?.value || COLORS[0];

  if (editaId) {
    const edital = state.editais.find(e => e.id === editaId);
    if (edital) { edital.nome = nome; edital.cor = cor; }
  } else {
    state.editais.push({
      id: uid(), nome, cor,
      disciplinas: []
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
  const edital = state.editais.find(e => e.id === editaId);
  const existingDisc = discId && edital ? edital.disciplinas.find(d => d.id === discId) : null;
  const isEdit = !!existingDisc;

  document.getElementById('modal-disc-title').textContent = isEdit ? 'Editar Disciplina' : 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional" value="${isEdit ? esc(existingDisc.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div class="icon-grid" id="disc-icons">
        ${DISC_ICONS.map((ic, i) => `<div class="icon-grid-item ${ic === (isEdit ? existingDisc.icone : DISC_ICONS[0]) ? 'selected-icon' : ''}" data-action="select-icon" data-icon="${ic}">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${isEdit ? existingDisc.icone : DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c, i) => `<div class="color-swatch ${c === (isEdit ? existingDisc.cor : COLORS[0]) ? 'selected' : ''}" data-disc-color="${c}" data-action="select-disc-color" data-color="${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${isEdit ? existingDisc.cor : COLORS[0]}">
    </div>
    `;
  openModal('modal-disc');
}

export function selectIcon(icon, el) {
  document.querySelectorAll('#disc-icons > .icon-grid-item').forEach(d => {
    d.classList.remove('selected-icon');
  });
  el.classList.add('selected-icon');
  document.getElementById('disc-icone').value = icon;
}

export function selectDiscColor(color) {
  document.querySelectorAll('#disc-colors .color-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelector(`#disc-colors .color-swatch[data-disc-color="${color}"]`)?.classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

export function saveDisc() {
  const nomeEl = document.getElementById('disc-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) { showToast('Informe o nome da disciplina', 'error'); return; }
  const icone = document.getElementById('disc-icone')?.value || '📖';
  const cor = document.getElementById('disc-cor')?.value || '#8aa4bf';
  if (!editingDiscCtx) return;
  const { editaId, discId } = editingDiscCtx;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  if (!edital.disciplinas) edital.disciplinas = [];

  if (discId) {
    // Edit existing discipline
    const disc = edital.disciplinas.find(d => d.id === discId);
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

// =============================================
// SUBJECT MANAGER AND BULK ADD
// =============================================
export function openDiscManager(editaId, discId) {
  let disc = null;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const d = edital.disciplinas.find(x => x.id === discId);
    if (d) { disc = d; break; }
  }
  if (!disc) return;

  editingSubjectCtx = { editaId, discId };
  // Default tab when opening
  window._activeDiscManagerTab = window._activeDiscManagerTab || 'topicos';

  // Render subject items
  const subjectsHtml = disc.assuntos.map((ass, idx) => `
      <div class="sm-list-item" draggable="true"
    data-disc-id="${disc.id}"
    data-ass-idx="${idx}"
    ondragstart="dndStart(event,'${disc.id}',${idx})"
    ondragover="dndOver(event)"
    ondragleave="dndLeave(event)"
    ondrop="dndDrop(event,'${disc.id}',${idx})">
      <div class="sm-drag-handle" title="Arrastar">☰</div>
      <div class="sm-item-text" data-action="edit-subject-inline" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">
        ${esc(ass.nome)}
        ` + (ass.relevance ? `<span class="relevance-badge relevance-badge-${ass.relevance.priority === 'P1' ? 'p1' : ass.relevance.priority === 'P2' ? 'p2' : 'muted'}" title="${esc(ass.relevance.reason)}">${ass.relevance.priority}</span>` : '') + `
        ${(ass.linkedAulaIds && ass.linkedAulaIds.length > 0) ? `
           <div class="linked-aulas-list">
             ${ass.linkedAulaIds.map(auId => {
    const aulaObj = (disc.aulas || []).find(a => a.id === auId);
    return aulaObj ? `<span class="linked-aula-tag"><i class="fa fa-play-circle"></i> ${esc(aulaObj.nome)}</span>` : '';
  }).join('')}
           </div>
        ` : ''}
      </div>
      <div class="sm-item-actions">
        <button aria-label="Subir tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="-1" title="Subir"><i class="fa fa-chevron-up"></i></button>
        <button aria-label="Descer tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="1" title="Descer"><i class="fa fa-chevron-down"></i></button>
        <button aria-label="Excluir tópico" data-action="delete-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `).join('') || '<div class="sm-empty-state">Nenhum tópico no Edital.</div>';

  // Render Lesson items
  const aulasHtml = (disc.aulas || []).map((aula, idx) => `
      <div class="sm-list-item sm-list-item--lesson">
      <div class="sm-item-content">
          <div class="sm-item-text sm-item-text--clickable" data-action="edit-lesson-inline" data-disc-id="${disc.id}" data-aula-id="${aula.id}">
             <input type="checkbox" ${aula.estudada ? 'checked' : ''} data-action="toggle-aula-estudada" data-disc-id="${disc.id}" data-aula-id="${aula.id}" class="sm-checkbox" title="Marcar como Estudada">
             <span class="${aula.estudada ? 'sm-text-concluded' : ''}">${esc(aula.nome)}</span>
          </div>
          ${(aula.linkedAssuntoIds && aula.linkedAssuntoIds.length > 0) ? `
           <div class="sm-linked-info">
             <strong>Cobre: </strong> ${aula.linkedAssuntoIds.map(asId => {
    const assObj = disc.assuntos.find(a => a.id === asId);
    return assObj ? esc(assObj.nome) : '';
  }).filter(n => n).join(', ')}
           </div>
        ` : '<div class="sm-linked-info sm-linked-info--empty">Não conectada a assunto do edital.</div>'}
      </div>
      <div class="sm-item-actions">
         <button aria-label="Excluir aula" data-action="delete-aula" data-disc-id="${disc.id}" data-aula-id="${aula.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `).join('') || '<div class="sm-empty-state">Nenhuma Aula adicionada.</div>';

  const colorOptions = COLORS.map(c => `<option value="${c}" ${disc.cor === c ? 'selected' : ''}" data-color-option="${c}">${c}</option>`).join('');

  document.getElementById('modal-disc-manager-title').textContent = disc.nome || 'Gerenciar Disciplina';
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
        <button type="button" data-action="switch-manager-tab" data-tab="topicos" class="manager-tab ${window._activeDiscManagerTab === 'topicos' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${window._activeDiscManagerTab === 'topicos'}" aria-controls="tab-manager-topicos">
            Tópicos do Edital (${disc.assuntos.length})
        </button>
        <button type="button" data-action="switch-manager-tab" data-tab="aulas" class="manager-tab ${window._activeDiscManagerTab === 'aulas' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${window._activeDiscManagerTab === 'aulas'}" aria-controls="tab-manager-aulas">
            Meus Materiais/Aulas (${disc.aulas ? disc.aulas.length : 0})
        </button>
    </div>

    <!--ABA TÓPICOS-->
    <div id="tab-manager-topicos" class="${window._activeDiscManagerTab === 'topicos' ? 'tab-content' : 'tab-content--hidden'}">
        <div class="sm-add-form">
           <textarea class="form-control" id="new-assunto-nome" placeholder="Novo tópico (Digite ou cole vários separados por quebra de linha)" rows="1"></textarea>
           <button class="btn btn-primary" data-action="add-assunto" data-disc-id="${disc.id}">Adicionar Tópico</button>
        </div>
        <div class="sm-list custom-scrollbar">
           ${subjectsHtml}
        </div>
    </div>

    <!--ABA AULAS-->
    <div id="tab-manager-aulas" class="${window._activeDiscManagerTab === 'aulas' ? 'tab-content' : 'tab-content--hidden'}">
        <div class="sm-bulk-import-form">
           <div>
               <label>Adição em Lote (Copie e paste o índice do seu PDF/Cursinho aqui)</label>
      <textarea class="form-control form-control--resize sm-bulk-textarea" id="new-aula-bulk" placeholder="Aula 00 - Concordância Nominal\nAula 01 - Crase..."></textarea>
           </div>
           <button class="btn btn-primary" data-action="add-bulk-aulas" data-disc-id="${disc.id}">Importar Lote</button>
        </div>

        ${(disc.aulas && disc.aulas.length > 0 && disc.assuntos.length > 0) ? `
          <div class="sm-auto-link-card">
             <div class="sm-auto-link-card-text">O Sistema pode analisar os nomes e conectá-los automaticamente ao Edital.</div>
             <button class="btn btn-ghost btn-sm" data-action="run-lesson-mapper" data-edital-id="${editaId}" data-disc-id="${disc.id}"><i class="fa fa-magic"></i> Auto-Link ML</button>
          </div>
        ` : ''}

        <div class="sm-list custom-scrollbar">
          ${aulasHtml}
        </div>
    </div>

    <!--BOTOES INFERIORES-->
      <div class="sm-footer-actions">
        <button class="btn btn-ghost btn-text-danger" data-action="delete-disc" data-edital-id="${editaId}" data-disc-id="${discId}">Remover Disciplina</button>
        <button class="btn btn-primary" data-action="save-disc-manager" data-edital-id="${editaId}" data-disc-id="${discId}">Salvar Manager</button>
      </div>
    `;
  openModal('modal-disc-manager');
}

export function switchManagerTab(tabName) {
  window._activeDiscManagerTab = tabName;
  if (editingSubjectCtx) {
    openDiscManager(editingSubjectCtx.editaId, editingSubjectCtx.discId);
  }
}
window.switchManagerTab = switchManagerTab;

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

  input.onblur = () => finishInlineEdit(discId, assId, input.value, el);
  input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); else if (e.key === 'Escape') { input.value = currentText; input.blur(); } };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
}

export function editLessonInline(discId, aulaId, el) {
  const d = getDisc(discId);
  const aulaObj = (d.disc.aulas || []).find(a => a.id === aulaId);
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
window.editLessonInline = editLessonInline;

export function toggleAulaEstudada(discId, aulaId) {
  const d = getDisc(discId);
  if (!d) return;
  const aulaObj = (d.disc.aulas || []).find(a => a.id === aulaId);
  if (!aulaObj) return;

  aulaObj.estudada = !aulaObj.estudada;
  aulaObj.dataEstudo = aulaObj.estudada ? todayStr() : null;
  scheduleSave();
  openDiscManager(editingSubjectCtx.editaId, discId);
}
window.toggleAulaEstudada = toggleAulaEstudada;

export function addBulkAulas(discId) {
  const textarea = document.getElementById('new-aula-bulk');
  if (!textarea) return;

  const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    showToast('Nenhum texto de aula encontrado.', 'error');
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  if (!d.disc.aulas) d.disc.aulas = [];

  lines.forEach(lineNome => {
    d.disc.aulas.push({
      id: 'aula_' + uid(),
      nome: lineNome,
      descricao: '',
      estudada: false,
      dataEstudo: null,
      progress: 0,
      linkedAssuntoIds: []
    });
  });

  scheduleSave();
  textarea.value = '';
  showToast(`${lines.length} Aulas adicionadas!`, 'success');
  openDiscManager(editingSubjectCtx.editaId, discId);
}
window.addBulkAulas = addBulkAulas;

export function addAssunto(discId) {
  const input = document.getElementById('new-assunto-nome');
  if (!input) return;
  const lines = input.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return;
  const d = getDisc(discId);
  if (!d) return;
  if (!d.disc.assuntos) d.disc.assuntos = [];
  lines.forEach(nome => {
    d.disc.assuntos.push({ id: 'ass_' + uid(), nome: nome, concluido: false, revisoesFetas: [], adiamentos: 0, linkedAulaIds: [] });
  });
  input.value = '';
  scheduleSave();
  openDiscManager(editingSubjectCtx.editaId, discId);
}
window.addAssunto = addAssunto;

export function deleteAula(discId, aulaId) {
  showConfirm('Tem certeza que deseja apagar esta Aula?', () => {
    const d = getDisc(discId);
    if (!d) return;

    // Remove backlinks
    d.disc.assuntos.forEach(ass => {
      if (ass.linkedAulaIds) {
        ass.linkedAulaIds = ass.linkedAulaIds.filter(id => id !== aulaId);
      }
    });

    d.disc.aulas = d.disc.aulas.filter(a => a.id !== aulaId);
    scheduleSave();
    openDiscManager(editingSubjectCtx.editaId, discId);
  });
}
window.deleteAula = deleteAula;

import { mapAulasToAssuntos } from './lesson-mapper.js?v=8.13';
export function runLessonMapperUI(editaId, discId) {
  showConfirm("Deseja aplicar Inteligência Artificial para conectar automaticamente as Aulas aos Assuntos deste Edital com base em similaridade (NLP + Levenshtein)?", () => {
    const resultCount = mapAulasToAssuntos(editaId, discId);
    if (resultCount > 0) {
      showToast(`${resultCount} Aulas Conectadas Automaticamente!`, 'success');
    } else {
      showToast('Nenhum Tópico bateu com 70%+ de precisão com esta base de Aulas.', 'info');
    }
    openDiscManager(editingSubjectCtx.editaId, discId);
  }, { label: 'Rodar Auto-Link', title: 'Mapeador ML' });
}
window.runLessonMapperUI = runLessonMapperUI;

// =============================================
// ADD EVENT MODAL
// =============================================
export function openAddEventModal(dateStr = null) {
  const allDiscs = getAllDisciplinas();
  const discOptions = allDiscs.map(({ disc, edital }) => `<option value="${disc.id}" data-edital="${edital.id}">${esc(edital.nome)} → ${esc(disc.nome)}</option>`
  ).join('');

  document.getElementById('modal-event-title').textContent = 'Iniciar Estudo';
  document.getElementById('modal-event-body').innerHTML = `
    <div id="event-conteudo-fields">
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="event-disc" data-action="load-assuntos">
          <option value="">Sem disciplina específica</option>
          ${discOptions}
        </select>
      </div>
      <div class="form-group event-form-group--hidden" id="event-assunto-group">
        <label class="form-label">Tópico do Edital (opcional)</label>
        <select class="form-control" id="event-assunto">
          <option value="">Sem tópico específico</option>
        </select>
      </div>
      <div class="form-group event-form-group--hidden mt-3" id="event-aula-group">
        <label class="form-label event-form-label--inline">
          Material / Aula (opcional)
        </label>
        <select class="form-control" id="event-aula">
          <option value="">Sem material/aula específica</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Título do Evento</label>
      <input type="text" class="form-control" id="event-titulo" placeholder="Ex: Estudar Direito Constitucional">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-control" id="event-data" value="${dateStr || todayStr()}"
          data-action="update-day-load">
        <div id="day-load-hint" class="event-form-hint"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Duração Prevista</label>
        <select class="form-control" id="event-duracao">
          <option value="30">30 min</option>
          <option value="60" selected>1 hora</option>
          <option value="90">1h30</option>
          <option value="120">2 horas</option>
          <option value="180">3 horas</option>
          <option value="240">4 horas</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Anotações (opcional)</label>
      <textarea class="form-control" id="event-notas" rows="2" placeholder="Observações rápidas sobre o estudo..."></textarea>
    </div>
    <details class="event-form-details">
      <summary>📝 Fontes e referências (opcional)</summary>
      <div class="event-form-details-content">
        <div class="form-group event-form-group--compact">
          <label class="form-label">Fontes de Estudo</label>
          <input type="text" class="form-control" id="event-fontes" placeholder="Ex: Gran Cursos pág. 45, Art. 37 CF/88...">
        </div>
        <div class="form-group event-form-group--compact">
          <label class="form-label">Legislação Pertinente</label>
          <input type="text" class="form-control" id="event-legislacao" placeholder="Ex: Lei 8.112/90, CF Art. 5º...">
        </div>
      </div>
    </details>
    <div class="modal-footer-standard--padded">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-event">Cancelar</button>
      <button class="btn btn-primary" data-action="save-event">Salvar / Iniciar</button>
    </div>
  `;
  openModal('modal-event');
  // Tech 3: Show day load immediately using requestAnimationFrame
  requestAnimationFrame(() => updateDayLoad(dateStr || todayStr()));
}


// Tech 3: Real-time day-load hint
export function updateDayLoad(dateStr) {
  const el = document.getElementById('day-load-hint');
  if (!el || !dateStr) return;
  const evts = state.eventos.filter(e => e.data === dateStr && e.status !== 'estudei');
  const mins = evts.reduce((s, e) => s + (e.duracao || 0), 0);
  if (evts.length === 0) {
    el.textContent = '📅 Dia livre';
    el.style.color = 'var(--accent)';
  } else {
    const horas = (mins / 60).toFixed(1);
    const color = mins > 480 ? 'var(--red)' : mins > 300 ? 'var(--orange)' : 'var(--text-muted)';
    el.textContent = `⚠️ ${evts.length} evento(s) já agendado(s) neste dia — ${horas}h previstas`;
    el.style.color = color;
  }
}

export function loadAssuntos() {
  const discId = document.getElementById('event-disc').value;
  const assuntoGroup = document.getElementById('event-assunto-group');
  const assuntoSel = document.getElementById('event-assunto');
  const aulaGroup = document.getElementById('event-aula-group');
  const aulaSel = document.getElementById('event-aula');
  
  if (!discId) {
    assuntoGroup.style.display = 'none';
    if (aulaGroup) aulaGroup.style.display = 'none';
    return;
  }
  
  const d = getDisc(discId);
  const tituloInput = document.getElementById('event-titulo');
  if (d && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
    tituloInput.value = `Estudar ${d.disc.nome} `;
    tituloInput.dataset.autoFilled = 'true';
  }

  if (!d) return;

  const pendingAssuntos = d.disc.assuntos.filter(a => !a.concluido);
  if (pendingAssuntos.length > 0) {
    let html = '<option value="">Sem tópico específico</option>';
    html += pendingAssuntos.map(a => `<option value="${a.id}" title="${esc(a.nome)}">${esc(trunc(a.nome))}</option>`).join('');
    assuntoSel.innerHTML = html;
    assuntoGroup.style.display = '';
  } else {
    assuntoGroup.style.display = 'none';
  }

  const aulas = d.disc.aulas || [];
  const pendingAulas = aulas.filter(a => !a.estudada);
  if (pendingAulas.length > 0 && aulaGroup && aulaSel) {
    let ht = '<option value="">Sem material/aula específico</option>';
    ht += pendingAulas.map(a => `<option value="${a.id}" title="${esc(a.nome)}">${esc(trunc(a.nome))}</option>`).join('');
    aulaSel.innerHTML = ht;
    aulaGroup.style.display = '';
  } else if (aulaGroup) {
    aulaGroup.style.display = 'none';
  }

  const buildTitle = () => {
    const rawAss = assuntoSel.value;
    const rawAul = aulaSel ? aulaSel.value : '';
    let name = '';
    
    // Choose which name to apply to the auto title
    if (rawAul) {
      const aulaObj = d.disc.aulas?.find(a => a.id === rawAul);
      if (aulaObj) name = aulaObj.nome;
    } else if (rawAss) {
      const assObj = d.disc.assuntos?.find(a => a.id === rawAss);
      if (assObj) name = assObj.nome;
    }

    if (name) {
      tituloInput.value = name;
      tituloInput.dataset.autoFilled = 'true';
    } else {
      tituloInput.value = `Estudar ${d.disc.nome} `;
    }
  };

  assuntoSel.onchange = () => {
    if (!tituloInput.value || tituloInput.dataset.autoFilled === 'true') buildTitle();
  };
  if (aulaSel) aulaSel.onchange = () => {
    if (!tituloInput.value || tituloInput.dataset.autoFilled === 'true') buildTitle();
  };
}

// Clear auto-filled flag if user manually types in title
addCleanupListener(document, 'input', e => {
  if (e.target && e.target.id === 'event-titulo') {
    e.target.dataset.autoFilled = 'false';
  }
});

export function saveEvent() {
  const titulo = document.getElementById('event-titulo').value.trim();
  const data = document.getElementById('event-data').value;
  const duracao = parseInt(document.getElementById('event-duracao').value || '60');
  const notas = document.getElementById('event-notas').value.trim();
  const fontes = document.getElementById('event-fontes')?.value.trim() || '';
  const legislacao = document.getElementById('event-legislacao')?.value.trim() || '';

  let discId = document.getElementById('event-disc')?.value || '';
  let assId = document.getElementById('event-assunto')?.value || '';
  let aulaId = document.getElementById('event-aula')?.value || '';
  let autoTitle = titulo;

  // Cleanup potential prefixes if present (backwards compatibility safety)
  if (assId && assId.startsWith('ass_')) assId = assId.substring(4);
  if (aulaId && aulaId.startsWith('aul_')) aulaId = aulaId.substring(4);

  if (!titulo && discId) {
    const d = getDisc(discId);
    autoTitle = `Estudar ${d?.disc.nome || 'Disciplina'} `;
  }

  if (!autoTitle) { showToast('Informe um título para o evento', 'error'); return; }

  // Helper that actually creates and saves the event
  const doSave = () => {
    const evento = {
      id: 'ev_' + uid(), titulo: autoTitle, data, duracao, notas, fontes, legislacao,
      status: 'agendado', tempoAcumulado: 0,
      tipo: 'conteudo',
      discId: discId || null,
      assId: assId || null,
      aulaId: aulaId || null,
      habito: null, // Habit array is formed upon completion
      criadoEm: new Date().toISOString()
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Estudo iniciado/agendado!', 'success');
  };

  // Tech 3: Warn if there are already many events on this day
  const existingOnDay = state.eventos.filter(e => e.data === data && e.status !== 'estudei');
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round(totalDuracao / 60 * 10) / 10;
    const msg = existingOnDay.length >= 3
      ? `Você já tem ${existingOnDay.length} evento(s) neste dia.Adicionar mais pode gerar sobrecarga.`
      : `Você já tem ${Math.round((totalDuracao - duracao) / 60 * 10) / 10}h agendadas neste dia.Com este evento seriam ${horas} h.`;
    showConfirm(msg, doSave, { label: 'Adicionar mesmo assim', title: 'Muitos eventos no dia' });
    return;
  }

  doSave();
}

// =============================================
// REGISTRO DE SESSÃO ANTERIOR (DIRETO)
// =============================================
export function openAddPastSessionModal(discId) {
  const d = getDisc(discId);
  if(!d) return;

  // Monta as opções de assunto baseadas na disciplina
  let assuntoOptions = '<option value="">Sem tópico específico</option>';
  
  const assuntos = d.disc.assuntos || [];
  if (assuntos.length > 0) {
    assuntoOptions += assuntos.map(a => `<option value="${a.id}" title="${esc(a.nome)}">${a.concluido ? '✅ ' : ''}${esc(trunc(a.nome, 100))}</option>`).join('');
  }
  
  let aulaOptions = '<option value="">Sem material/aula específico</option>';
  const aulas = d.disc.aulas || [];
  if (aulas.length > 0) {
    aulaOptions += aulas.map(a => `<option value="${a.id}" title="${esc(a.nome)}">${a.estudada ? '✅ ' : ''}${esc(trunc(a.nome, 100))}</option>`).join('');
  }

  document.getElementById('modal-event-title').textContent = 'Registrar Sessão Anterior';
  document.getElementById('modal-event-body').innerHTML = `
    <div class="config-sub">
      Disciplina: <strong>${esc(d.disc.nome)}</strong>
    </div>
    
    <div class="form-group" id="event-assunto-group">
      <label class="form-label">Tópico do Edital (opcional)</label>
      <select class="form-control" id="past-event-assunto">
        ${assuntoOptions}
      </select>
    </div>

    <div class="form-group mt-3" id="event-aula-group">
      <label class="form-label">Material / Aula (opcional)</label>
      <select class="form-control" id="past-event-aula">
        ${aulaOptions}
      </select>
    </div>

    <div class="form-row mt-5">
      <div class="form-group">
        <label class="form-label">Data do Estudo</label>
        <input type="date" class="form-control" id="past-event-data" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label class="form-label">Tempo Estudado (minutos)</label>
        <input type="number" class="form-control" id="past-event-duracao" value="60" min="1">
      </div>
    </div>
    
    <div class="modal-footer-standard--padded">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-event">Cancelar</button>
      <button class="btn btn-primary" data-action="save-past-event" data-disc-id="${discId}">Continuar Registro</button>
    </div>
  `;
  openModal('modal-event');
}
window.openAddPastSessionModal = openAddPastSessionModal;

export function savePastEvent(discId) {
  const d = getDisc(discId);
  const data = document.getElementById('past-event-data').value;
  const duracao = parseInt(document.getElementById('past-event-duracao').value, 10) || 60;
  
  const assId = document.getElementById('past-event-assunto')?.value || null;
  const aulaId = document.getElementById('past-event-aula')?.value || null;

  if (!data || duracao <= 0) {
    showToast('Preencha a data e o tempo estudado corretamente.', 'error');
    return;
  }

  let assuntoNome = '';

  if (aulaId) {
    const achado = d.disc.aulas?.find(a => a.id === aulaId);
    if(achado) assuntoNome = ' — ' + achado.nome;
  } else if (assId) {
    const achado = d.disc.assuntos?.find(a => a.id === assId);
    if(achado) assuntoNome = ' — ' + achado.nome;
  }

  // Cria um placeholder de evento que o \`openRegistroSessao\` pode carregar e modificar
  const evento = {
    id: 'ev_' + uid(),
    titulo: d.disc.nome + assuntoNome,
    data: data,
    status: 'agendado', // Agendado prevents it from instantly showing up as Estudei before the modal
    duracao: duracao,
    tempoAcumulado: duracao * 60,
    discId: discId,
    assId: assId,
    aulaId: aulaId,
    sessao: {},
    _isPastSession: true
  };

  state.eventos.push(evento);
  scheduleSave();
  closeModal('modal-event');

  // Abre registro real para input the metadados
  if (typeof window.EstudoApp?.openRegistroSessao === 'function') {
    window.EstudoApp.openRegistroSessao(evento.id);
  } else {
    showToast('Erro ao abrir registro detalhado.', 'error');
  }
}
window.savePastEvent = savePastEvent;


// =============================================
// CONFIG VIEW
// =============================================
function renderCloudflareConflict(conflict) {
  if (!conflict) return '';

  const remote = formatBackupDateTime(conflict.remoteUpdatedAt);
  const detected = formatBackupDateTime(conflict.detectedAt);
  const device = esc(conflict.remoteDeviceId || 'dispositivo remoto');

  return `
    <div class="sync-conflict-panel" data-testid="cf-sync-conflict" role="alert">
      <div class="sync-conflict-header">
        <i class="fa fa-triangle-exclamation"></i>
        <div>
          <div class="sync-conflict-title">Conflito de sincronizaÃ§Ã£o</div>
          <div class="sync-conflict-sub">O remoto mudou antes deste dispositivo enviar seus dados.</div>
        </div>
      </div>
      <div class="sync-conflict-meta">
        <span>Remoto: ${remote}</span>
        <span>Origem: ${device}</span>
        <span>Detectado: ${detected}</span>
      </div>
      <div class="sync-conflict-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="cloud-conflict-export-local">
          <i class="fa fa-download"></i> Exportar backup local
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-conflict-pull-remote">
          <i class="fa fa-cloud-download-alt"></i> Baixar remoto
        </button>
        <button type="button" class="btn btn-danger btn-sm" data-action="cloud-conflict-force-push">
          <i class="fa fa-cloud-upload-alt"></i> ForÃ§ar envio local
        </button>
      </div>
    </div>
  `;
}

export function renderConfig(el) {
  const cfg = state.config;
  const activeTheme = normalizeTheme(cfg.tema, cfg.darkMode);
  const themeOptionsHtml = THEME_OPTIONS
    .map(theme => `<option value="${theme.value}" ${activeTheme === theme.value ? 'selected' : ''}>${theme.label}</option>`)
    .join('');
  el.innerHTML = `
    <div class="config-grid">
      <div>
        <div class="card config-card">
          <div class="card-header"><h3>🎨 Aparência</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Tema Visual</div>
                <div class="config-sub">Personalize a aparência do seu sistema</div>
              </div>
              <select class="form-control config-select" data-action="set-theme">
                ${themeOptionsHtml}
              </select>
            </div>
          </div>
        </div>
        <div class="card config-card">
          <div class="card-header"><h3>⚖️ Calendário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Visualização padrão</div>
                <div class="config-sub">Modo inicial do calendário</div>
              </div>
              <select class="form-control config-select--narrow" data-action="update-config" data-config-key="visualizacao">
                <option value="mes" ${cfg.visualizacao === 'mes' ? 'selected' : ''}>Mês</option>
                <option value="semana" ${cfg.visualizacao === 'semana' ? 'selected' : ''}>Semana</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Primeiro dia da semana</div>
              </div>
              <select class="form-control config-select--medium" data-action="update-config" data-config-key="primeirodiaSemana" data-value-type="number">
                <option value="0" ${cfg.primeirodiaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${cfg.primeirodiaSemana === 1 ? 'selected' : ''}>Segunda-feira</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Número da semana</div>
              </div>
              <button type="button" class="toggle ${cfg.mostrarNumeroSemana ? 'on' : ''}" aria-pressed="${cfg.mostrarNumeroSemana ? 'true' : 'false'}" aria-label="Mostrar número da semana" data-action="toggle-config" data-config-key="mostrarNumeroSemana"></button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade visível</div>
              </div>
              <button type="button" class="toggle ${cfg.agruparEventos ? 'on' : ''}" aria-pressed="${cfg.agruparEventos ? 'true' : 'false'}" aria-label="Agrupar eventos no dia" data-action="toggle-config" data-config-key="agruparEventos"></button>
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>⏱️ Temporizador</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Foco do Pomodoro (min)</div>
                <div class="config-sub">Tempo ininterrupto de estudo</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="120" value="${cfg.pomodoroFoco || 25}" data-action="update-config" data-config-key="pomodoroFoco" data-value-type="number">
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Pausa do Pomodoro (min)</div>
                <div class="config-sub">Intervalo de descanso</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="60" value="${cfg.pomodoroPausa || 5}" data-action="update-config" data-config-key="pomodoroPausa" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>📚 Planejamento Diário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Matérias por dia no Ciclo</div>
                <div class="config-sub">Quantidade de disciplinas distribuídas diariamente no calendário/MED.</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="15" value="${cfg.materiasPorDia || 3}" data-action="update-config" data-config-key="materiasPorDia" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔄 Frequência de Revisão</h3></div>
          <div class="card-body">
            <div class="config-desc">
              Defina em quantos dias após concluir um assunto o programa vai sugerir cada revisão.
            </div>
            <div class="form-group">
              <label class="form-label">Intervalos (em dias, separados por vírgula)</label>
              <input type="text" class="form-control" id="freq-input" value="${(cfg.frequenciaRevisao || [1, 7, 30, 90]).join(', ')}"
                data-action="update-frequencia">
            </div>
            <div class="config-hint">Ex: 1, 7, 30, 90 = 4 revisões no 1º, 7º, 30º e 90º dia</div>
          </div>
        </div>
      </div>

      <div>
        <div class="card config-card">
          <div class="card-header"><h3><i class="fa fa-cloud"></i> Sincronização Cloudflare (Primária)</h3></div>
          <div class="card-body">
            <div class="config-desc">Sincronização em tempo real de baixíssima latência entre dispositivos via Cloudflare KV.</div>

            ${renderCloudflareConflict(cfg.cfConflict)}

            <div class="form-group config-input-group">
              <label class="form-label">URL do Cloudflare Worker (API)</label>
              <input type="url" id="config-cf-url" class="form-control" placeholder="Ex: https://estudo-sync-api.xxxx.workers.dev" value="${esc(cfg.cfUrl || '')}" data-action="update-config" data-config-key="cfUrl" data-value-transform="trim-url">
            </div>

            <div class="form-group config-input-group">
              <label class="form-label">Token de Acesso (Auth Token)</label>
              <div class="config-input-group">
                  <input type="password" id="config-cf-token" class="form-control" placeholder="Sua senha secreta do Worker" value="${esc(cfg.cfToken || '')}" data-action="update-config" data-config-key="cfToken" data-value-transform="trim">
                  <button type="button" class="btn btn-outline" data-action="toggle-password-visibility" data-target-id="config-cf-token" title="Mostrar/Esconder Senha"><i class="fa fa-eye"></i></button>
              </div>
            </div>
            
            <div class="config-toggle-row">
                <label class="btn ${cfg.cfSyncEnabled ? 'btn-primary' : 'btn-outline'}">
                    <input type="checkbox" id="config-cf-enabled" data-action="toggle-cf-sync" ${cfg.cfSyncEnabled ? 'checked' : ''}>
                    <i class="fa fa-power-off"></i> <span id="cf-sync-toggle-text">${cfg.cfSyncEnabled ? 'Sincronização Ativada' : 'Ativar Sincronização'}</span>
                </label>
                <button type="button" class="btn btn-outline" data-action="force-cloudflare-sync" id="btn-force-cf-sync"><i class="fa fa-sync"></i> Forçar Sincronização Agora</button>
            </div>
            <p id="cf-sync-status" class="config-status"></p>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>😁️ Google Drive</h3></div>
          <div class="card-body">
            <div class="flex cluster-md mb-4">
              <div class="config-emoji-icon">😁️</div>
              <div>
                <div class="config-title">${state.driveFileId ? 'Conectado ao Google Drive' : 'Não conectado'}</div>
                <div class="config-subtitle">${state.driveFileId ? 'Seus dados são sincronizados automaticamente' : 'Sincronize seus dados entre dispositivos'}</div>
              </div>
            </div>
            ${state.driveFileId ? `
              <div class="config-actions-row">
                <button class="btn btn-primary btn-sm" data-action="drive-sync-now">
                  <i class="fa fa-cloud-upload-alt"></i> Sincronizar agora
                </button>
                <button class="btn btn-ghost btn-sm" data-action="pull-from-drive">
                  <i class="fa fa-cloud-download-alt"></i> Carregar do Drive
                </button>
                <button class="btn btn-danger btn-sm" data-action="drive-disconnect">Desconectar</button>
              </div>
            ` : `
              <button class="btn btn-primary" data-action="open-drive-modal">
                <i class="fa fa-cloud"></i> Conectar ao Google Drive
              </button>
            `}
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔖 Notificações</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Notificações do browser</div>
                <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? '✅ Ativadas' : Notification.permission === 'denied' ? '🚫 Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revisões') : '❌ Browser não suporta'}</div>
              </div>
              ${'Notification' in window && Notification.permission !== 'denied' && Notification.permission !== 'granted' ? `
                <button class="btn btn-primary btn-sm" data-action="request-notification-permission">🔖 Ativar</button>
              ` : Notification.permission === 'granted' ? `
                <button class="btn btn-ghost btn-sm" data-action="test-notification">🔖 Testar</button>
              ` : ''}
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Início)</div>
                <div class="config-sub">A partir de qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeStart ?? 22}" data-action="update-config" data-config-key="silentModeStart" data-value-type="number">
            </div>
            
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Fim)</div>
                <div class="config-sub">Até qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeEnd ?? 8}" data-action="update-config" data-config-key="silentModeEnd" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>💾 Dados</h3></div>
          <div class="card-body">
            <div class="config-sub">
              ${state.eventos.length} evento(s) ativos
              ${(state.arquivo || []).length > 0 ? ` • ${state.arquivo.length} arquivado(s)` : ''}
            </div>

            <div class="grid config-backup-grid">
              <div class="flex flex-between"><span>Backup local:</span><strong>${formatBackupDateTime(state.config.localBackupAt)}</strong></div>
              <div class="flex flex-between"><span>Backup Cloudflare:</span><strong>${formatBackupDateTime(state.config.cfLastSyncAt)}</strong></div>
              <div class="flex flex-between"><span>Backup Google Drive:</span><strong>${formatBackupDateTime(state.lastSync)}</strong></div>
            </div>

            <div class="form-group mb-3">
              <label class="form-label">Origem do backup para restauração</label>
              <select id="backup-restore-source" class="form-control">
                <option value="local">Backup local (importar arquivo JSON)</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="drive">Google Drive</option>
              </select>
            </div>

            <div class="flex flex-wrap gap-sm">
              <button class="btn btn-ghost" data-action="export-data">📱 Exportar JSON</button>
              <button class="btn btn-ghost" data-action="restore-backup">♻️ Restaurar backup selecionado</button>
              <button class="btn btn-ghost btn-sm" data-action="archive-old-events" data-days="90" title="Move eventos concluidos há mais de 90 dias para o arquivo">🙉 Arquivar antigos</button>
              <button class="btn btn-danger btn-sm" data-action="clear-all-data">🙆 Limpar tudo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>🔄 Service Worker</h3></div>
          <div class="card-body">
            <div class="config-desc" style="margin-bottom:12px;">
              Limpe o cache do service worker e force o carregamento da versão mais recente. Útil quando há problemas de cache após atualizações.
            </div>
            <button class="btn btn-primary btn-sm" data-action="force-sw-cache-clear">
              🔄 Limpar cache e recarregar
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>ℹ️ Sobre</h3></div>
          <div class="card-body">
            <div class="config-desc">
              <strong>Estudo Organizado</strong> é um app para planejamento e organização de estudos para concursos públicos.<br><br>
              Baseado no Ciclo PDCA: planeje no Calendário, execute no Study Organizer, meça no Dashboard e corrija com as Revisões.<br><br>
              <span class="text-xs text-muted">Versão 1.0 • Dados salvos localmente + Google Drive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setTheme(themeName) {
  const theme = normalizeTheme(themeName, state.config.darkMode);
  state.config.tema = theme;
  state.config.darkMode = true;
  state.config.lastTheme = theme;
  applyTheme();
  scheduleSave();
  renderCurrentView();
}

export function updateConfig(key, value) {
  state.config[key] = value;
  if (key === 'materiasPorDia') {
    syncCicloToEventos();
  }
  scheduleSave();
  renderCurrentView();
}

export function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

export function toggleCfSync(enabled) {
  if (enabled) {
    const url = document.getElementById('config-cf-url').value.trim();
    const token = document.getElementById('config-cf-token').value.trim();
    if (!url || !token) {
      showToast('Preencha a URL do Worker e o Token antes de ativar.', 'error');
      const checkbox = document.getElementById('config-cf-enabled');
      if (checkbox) checkbox.checked = false;
      return;
    }
  }

  state.config.cfSyncEnabled = enabled;

  if (enabled && typeof window.forceCloudflareSync === 'function') {
    if (typeof showToast === 'function') showToast('Conectando à nuvem para sincronizar...', 'info');
    window.forceCloudflareSync().finally(() => {
      scheduleSave();
      renderCurrentView();
    });
  } else {
    scheduleSave();
    renderCurrentView();
  }
}

export function updateFrequencia(value) {
  const nums = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

export function openDriveModal() {
  openModal('modal-drive');
  const savedId = localStorage.getItem('estudo_drive_client_id');
  if (savedId) {
    const input = document.getElementById('drive-client-id');
    if (input) input.value = savedId;
  }
}

export function driveDisconnect() {
  // Delegate to the proper disconnectDrive in drive-sync.js which revokes the OAuth token
  if (typeof window.disconnectDrive === 'function') {
    window.disconnectDrive();
  } else {
    // Fallback: just clear local state
    state.driveFileId = null;
    state.lastSync = null;
    scheduleSave();
    renderCurrentView();
    showToast('Google Drive desconectado', 'info');
  }
}

// Fix 7: Move concluded events older than N days into state.arquivo.
// Archived events are excluded from all renders/filters but kept in export/Drive sync.
export function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(e => e.status === 'estudei' && e.data && e.data < cutoffStr);
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) concluido(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map(e => e.id));
      state.eventos = state.eventos.filter(e => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

export function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast('Dados exportados!', 'success');
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.className = 'sr-only';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) {
      input.remove();
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        // Validate JSON structure to prevent data corruption
        if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
          showToast('Arquivo inválido! O JSON não contém um objeto de dados válido.', 'error');
          return;
        }
        const hasValidStructure = (
          (Array.isArray(imported.editais) || imported.editais === undefined) &&
          (Array.isArray(imported.eventos) || imported.eventos === undefined) &&
          (typeof imported.config === 'object' || imported.config === undefined)
        );
        if (!hasValidStructure) {
          showToast('Arquivo inválido! Este JSON não parece ser um backup do Estudo Organizado.', 'error');
          return;
        }
        showConfirm(
          `Importar dados de "${file.name}"?\n\nIsso substituirá todos os dados atuais. Faça um export antes para garantir o backup.`,
          () => {
            setState(imported);
            runMigrations();
            invalidateDiscCache();
            invalidateDashCaches();
            invalidateRevCache();
            invalidateTodayCache();
            scheduleSave();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
          { label: 'Importar', title: 'Importar dados' }
        );
      } catch (err) {
        showToast('Arquivo inválido! Verifique se é um JSON de backup do Estudo Organizado.', 'error');
      }
    };
    reader.onloadend = () => {
      input.remove();
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}


export function restoreBackupFromSelectedSource() {
  const source = document.getElementById('backup-restore-source')?.value || 'local';

  if (source === 'local') {
    importData();
    return;
  }

  if (source === 'cloudflare') {
    if (!state.config?.cfSyncEnabled || !state.config?.cfUrl || !state.config?.cfToken) {
      showToast('Configure a sincronização Cloudflare antes de restaurar por ela.', 'error');
      return;
    }

    showConfirm(
      'Restaurar os dados da Cloudflare? Isso substituirá os dados locais atuais.',
      () => {
        if (typeof window.pullFromCloudflare === 'function') {
          window.pullFromCloudflare(true);
        }
      },
      { label: 'Restaurar Cloudflare', title: 'Restaurar backup' }
    );
    return;
  }

  if (source === 'drive') {
    if (!state.driveFileId) {
      showToast('Conecte o Google Drive antes de restaurar por ele.', 'error');
      return;
    }

    showConfirm(
      'Restaurar os dados do Google Drive? Isso substituirá os dados locais atuais.',
      () => {
        if (typeof window.pullFromDrive === 'function') {
          window.pullFromDrive().catch(err => console.error('Erro ao restaurar do Drive:', err));
        }
      },
      { label: 'Restaurar Drive', title: 'Restaurar backup' }
    );
  }
}

export function clearAllData() {
  showConfirm(
    '⚠️ Apagar TODOS os dados permanentemente?\n\nEditais, eventos, hábitos e configurações serão removidos.\n\nEsta ação é irreversível.',
    () => {
      showConfirm(
        'Última confirmação: isso não pode ser desfeito.',
        () => {
          window.clearData(); // usa clearData() do store.js que limpa IndexedDB
        },
        { danger: true, label: 'Apagar tudo definitivamente', title: '⚠️ Confirmação final' }
      );
    },
    { danger: true, label: 'Continuar com exclusão', title: '⚠️ Apagar todos os dados' }
  );
}

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
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  const srcIdx = _dndSrcIdx;
  if (srcIdx === null || srcIdx === targetIdx || _dndSrcDiscId !== discId) return;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue; const disc = edital.disciplinas.find(d => d.id === discId);
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
      _dndSrcDiscId = null; _dndSrcIdx = null; return;
    }
  }
} addCleanupListener(document, 'dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

// =============================================
// UX 1 — GLOBAL SEARCH
// =============================================
export let searchBlurTimeout = null;

let _searchDebounceTimer = null;
export function debouncedOnSearch(query) {
  if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    onSearch(query);
  }, 300);
}
window.debouncedOnSearch = debouncedOnSearch;

export function onSearch(query) {
  const box = document.getElementById('search-results');
  const input = document.getElementById('global-search');
  if (!box || !input) return;

  if (!query || query.length < 2) {
    box.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    return;
  }

  const q = query.toLowerCase();
  const results = { eventos: [], disciplinas: [], assuntos: [], habitos: [] };

  // Search eventos
  state.eventos.forEach(ev => {
    if (ev.titulo.toLowerCase().includes(q)) {
      const disc = ev.discId ? getDisc(ev.discId)?.disc : null;
      results.eventos.push({ ev, disc });
    }
  });

  // Search disciplinas (deduplicated by id)
  const seenDiscIds = new Set();
  getAllDisciplinas().forEach(({ disc, edital }) => {
    if (disc.nome.toLowerCase().includes(q) && !seenDiscIds.has(disc.id)) {
      seenDiscIds.add(disc.id);
      results.disciplinas.push({ disc, edital });
    }
    // Search assuntos
    (disc.assuntos || []).forEach(ass => {
      if (ass.nome.toLowerCase().includes(q) || disc.nome.toLowerCase().includes(q)) {
        results.assuntos.push({ ass, disc, edital });
      }
    });
  });

  // Search hábitos
  HABIT_TYPES.forEach(h => {
    (state.habitos[h.key] || []).forEach(r => {
      if ((r.descricao || '').toLowerCase().includes(q)) {
        results.habitos.push({ r, h });
      }
    });
  });

  const totalResults = results.eventos.length + results.disciplinas.length + results.assuntos.length + results.habitos.length;

  // Announce results to screen readers
  const announcer = document.getElementById('aria-announcer');
  if (announcer) {
    announcer.textContent = `${totalResults} resultado(s) encontrado(s)`;
  }

  const highlight = str => esc(str).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  let html = '';

  if (results.eventos.length) {
    html += `<div class="search-section-title" role="presentation">📅 Eventos</div>`;
    html += results.eventos.slice(0, 5).map(({ ev, disc }) => `
      <button type="button" class="search-item" data-action="open-search-event" data-event-id="${ev.id}">
        <div class="search-item-icon">${disc ? disc.icone || '📚' : '📅'}</div>
        <div>
          <div class="search-item-label">${highlight(ev.titulo)}</div>
          <div class="search-item-sub">${ev.data ? formatDate(ev.data) : ''}${disc ? ' • ' + disc.nome : ''}</div>
        </div>
      </button>`).join('');
  }

  if (results.disciplinas.length) {
    html += `<div class="search-section-title" role="presentation">📖 Disciplinas</div>`;
    html += results.disciplinas.slice(0, 5).map(({ disc, edital }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📖'}</div>
        <div>
          <div class="search-item-label">${highlight(disc.nome)}</div>
          <div class="search-item-sub">${esc(edital.nome)} • ${(disc.assuntos || []).length} assunto(s)</div>
        </div>
      </button>`).join('');
  }

  if (results.assuntos.length) {
    html += `<div class="search-section-title" role="presentation">📚 Assuntos</div>`;
    html += results.assuntos.slice(0, 5).map(({ ass, disc, edital }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📚'}</div>
        <div>
          <div class="search-item-label">${highlight(ass.nome)}</div>
          <div class="search-item-sub">${esc(disc.nome)} • ${esc(edital.nome)} ${ass.concluido ? '✅' : ''}</div>
        </div>
      </button>`).join('');
  }

  if (results.habitos.length) {
    html += `<div class="search-section-title" role="presentation">⚡ Hábitos</div>`;
    html += results.habitos.slice(0, 3).map(({ r, h }) => `
      <button type="button" class="search-item" data-action="navigate-clear-search" data-view="habitos">
        <div class="search-item-icon">${h.icon}</div>
        <div>
          <div class="search-item-label">${highlight(r.descricao || h.label)}</div>
          <div class="search-item-sub">${formatDate(r.data)}</div>
        </div>
      </button>`).join('');
  }

  if (!html) html = `<div class="search-empty">Nenhum resultado para "<strong>${query}</strong>"</div>`;
  box.innerHTML = html;
  box.classList.add('open');
  input.setAttribute('aria-expanded', 'true');
}

export function onSearchFocus() {
  clearTimeout(searchBlurTimeout);
  const input = document.getElementById('global-search');
  const val = input?.value || '';
  if (val && val.length >= 2) {
    onSearch(val);
  }
}

export function onSearchBlur() {
  searchBlurTimeout = setTimeout(() => {
    document.getElementById('search-results')?.classList.remove('open');
    document.getElementById('global-search')?.setAttribute('aria-expanded', 'false');
  }, 200);
}

export function clearSearch() {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (input) {
    input.value = '';
    input.setAttribute('aria-expanded', 'false');
  }
  results?.classList.remove('open');
}

function handleSearchKeydown(e) {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (!input || !results || !results.classList.contains('open')) return false;

  const active = document.activeElement;
  const isInsideSearch = active === input || results.contains(active);
  if (!isInsideSearch) return false;

  if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
    input.focus();
    return true;
  }

  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;

  const buttons = [...results.querySelectorAll('button.search-item')];
  if (buttons.length === 0) return false;

  e.preventDefault();
  const currentIndex = buttons.indexOf(active);
  const nextIndex = e.key === 'ArrowDown'
    ? (currentIndex + 1) % buttons.length
    : (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1);

  buttons[nextIndex].focus();
  return true;
}

// ESC closes search
addCleanupListener(document, 'keydown', e => {
  if (handleSearchKeydown(e)) return;
  // Fix H: ESC — close the topmost open modal, or clear search
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal-overlay.open')];
    if (openModals.length > 0) {
      const top = openModals[openModals.length - 1];
      if (top.id === 'modal-confirm') {
        // cancel callback handled by app.js
      }
      closeModal(top.id);
    } else {
      clearSearch();
    }
  }

  // Fix H: Enter submits the active modal form (not inside textarea)
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
    const openModal = document.querySelector('.modal-overlay.open:not(#modal-confirm):not(#modal-event-detail)');
    if (openModal) {
      const saveBtn = openModal.querySelector('button[onclick*="save"], button[onclick*="Save"], button.btn-primary');
      if (saveBtn && !saveBtn.disabled) {
        e.preventDefault();
        saveBtn.click();
      }
    }
  }
});


export function openCicloHistory(seqId) {
  const plan = state.planejamento;
  if (!plan || !plan.sequencia) return;
  const seqItem = plan.sequencia.find(s => s.id === seqId);
  if (!seqItem) return;

  const discInfo = getDisc(seqItem.discId);
  if (!discInfo) return;

  const titleEl = document.getElementById('modal-ciclo-history-title');
  if (titleEl) titleEl.innerHTML = `🕒 Histórico: ${discInfo.disc.icone || '📚'} ${esc(discInfo.disc.nome)}`;

  const bodyEl = document.getElementById('modal-ciclo-history-body');

  // Filtrar histórico de estudos da disciplina
  const eventosDisc = state.eventos
    .filter(e => e.discId === seqItem.discId && e.status === 'estudei' && e.tempoAcumulado > 0)
    .sort((a, b) => (b.data + 'T' + (b.hora || '00:00:00')).localeCompare(a.data + 'T' + (a.hora || '00:00:00')));


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

  let htmlHistorico = '';
  if (eventosDisc.length === 0) {
    htmlHistorico = `<div class="ciclo-history-empty">Nenhuma sessão de estudo registrada ainda.</div>`;
  } else {
    htmlHistorico = `
      <div class="flex flex-col gap-sm">
        ${eventosDisc.map(ev => {
      return `
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
          `;
    }).join('')}
      </div>
    `;
  }

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
window.openCicloHistory = openCicloHistory;

// Global exports for Disc Dashboard
window.openDiscDashboard = openDiscDashboard;
window.closeDiscDashboard = closeDiscDashboard;
window.addEventoParaAssunto = addEventoParaAssunto;
window.setTheme = setTheme;

export function filtrarDropdownBanca(termo) {
  termo = termo.toLowerCase().trim();
  const select = document.getElementById('banca-disc-select');
  if (!select) return;
  Array.from(select.options).forEach(opt => {
    if (opt.value === '') return;
    const visible = opt.text.toLowerCase().includes(termo);
    opt.style.display = visible ? '' : 'none';
  });
}
window.filtrarDropdownBanca = filtrarDropdownBanca;
