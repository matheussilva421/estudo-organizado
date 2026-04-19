import { applyTheme, closeModal, currentView, navigate, showConfirm, showToast, openModal, cancelConfirm } from './app.js?v=8.3';
import { cutoffDateStr, esc, formatDate, formatTime, formatH, getEventStatus, invalidateTodayCache, todayStr, trunc, uid, HABIT_TYPES } from './utils.js?v=8.3';
import { scheduleSave, state, setState, runMigrations } from './store.js?v=8.3';
import { calcRevisionDates, getAllDisciplinas, getDisc, getPendingRevisoes, invalidateDiscCache, invalidateDashCaches, invalidateRevCache, reattachTimers, getElapsedSeconds, getPerformanceStats, getPagesReadStats, getSyllabusProgress, getConsistencyStreak, getSubjectStats, getCurrentWeekStats, getPredictiveStats, syncCicloToEventos, resetCicloAndWipeEvents, calculateCyclePredictionsModel } from './logic.js?v=8.3';
import { renderCurrentView, renderEventCard, updateBadges } from './components.js?v=8.3';
import { updateDriveUI } from './drive-sync.js?v=8.3';
import { renderDisciplinaDashboard } from './views/dashboard-view.js';

// Re-export from extracted view modules
export { renderHome } from './views/home-view.js';
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
export { renderDisciplinaDashboard };
export {
  renderBancaAnalyzerModule,
  getAnalyzerCtx,
  setAnalyzerCtx
} from './views/banca-view.js';

// Legacy calendar state (for backward compatibility during migration)
export let calDate = new Date();
export let calViewMode = 'mes';
export function setCalViewMode(mode) {
  calViewMode = mode;
  renderCurrentView();
}
let currentHabitType = null;
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
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
  '#eab308', '#d946ef', '#64748b'
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

export function renderCalendar(el) {
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
            <button data-action="cal-navigate" data-dir="-1"><i class="fa fa-chevron-left"></i></button>
            <button data-action="cal-navigate" data-dir="1"><i class="fa fa-chevron-right"></i></button>
          </div>
          <div class="cal-title" id="cal-title">${calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())} <span class="cal-version-tag">v6.0</span></div>
          <button class="btn btn-ghost btn-sm" id="cal-today-btn" data-action="cal-today">Hoje</button>
          <div class="cal-view-tabs ml-auto">
            <div class="cal-view-tab ${calViewMode === 'mes' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="mes">Mês</div>
            <div class="cal-view-tab ${calViewMode === 'semana' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="semana">Semana</div>
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

export function resetCalDate() {
  calDate = new Date();
  renderCurrentView();
}

export function calNavigate(dir) {
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

export function renderCalendarMonth() {
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
      return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
            ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// Optimized: render only calendar grid (for navigation without full re-render)
export function renderCalendarGrid() {
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
            return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
          }).join('')}
          ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
        </div>
      `;
    }).join('')}
    </div>
  `;
}

export function updateCalendarHeader() {
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

export function renderCalendarWeek() {
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
      <div class="cal-view-tabs">
        ${[7, 30, 90, null].map(p => `
          <div class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" data-action="set-dash-period" data-period="${p}">
            ${{ 7: '7d', 30: '30d', 90: '3m', null: 'Total' }[p]}
          </div>`).join('')}
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
  const accent = themeVars.getPropertyValue('--accent').trim() || '#10b981';
  const accentLight = themeVars.getPropertyValue('--accent-light').trim() || '#d1fae5';
  const border = themeVars.getPropertyValue('--border').trim() || '#e2e8f0';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#475569';
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
    colors.push(d ? (d.disc.cor || '#10b981') : '#94a3b8');
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

    <div class="tabs rev-tabs">
      <div class="tab-btn active" data-action="switch-revision-tab" data-tab="pendentes" data-target="this">🔄 Pendentes (${pending.length})</div>
      <div class="tab-btn" data-action="switch-revision-tab" data-tab="proximas" data-target="this">📅 Próximas 30 dias (${upcoming.length})</div>
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
              <button class="btn btn-primary btn-sm" data-action="mark-revision" data-assunto-id="${r.assunto.id}">✅ Feita</button>
              <button class="btn btn-ghost btn-sm" data-action="postpone-revision" data-assunto-id="${r.assunto.id}">⏩ +1 dia</button>
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

// =============================================
// HABITOS VIEW
// =============================================
export let habitHistPage = 1;
export const HABIT_HIST_PAGE_SIZE = 20;

export function renderHabitos(el) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoff2 = new Date(cutoff.getTime() - (cutoff.getTimezoneOffset() * 60000));
  const cutoffStr = cutoff2.toISOString().split('T')[0];

  el.innerHTML = `
    <div class="habit-grid">
      ${HABIT_TYPES.map(h => {
    const all = state.habitos[h.key] || [];
    const recentArr = all.filter(r => r.data >= cutoffStr);
    
    let total = 0;
    let recentStr = '';
    
    if (h.key === 'questoes') {
      total = sumQuestionRecords(all);
      recentStr = `Total acumulado`;
    } else if (h.key === 'paginas') {
      total = sumPageRecords(all);
      recentStr = `Total acumulado`;
    } else {
      total = all.length;
      recentStr = `Total acumulado`;
    }

    return `
          <div class="habit-card" data-action="open-habit-modal" data-habit-key="${h.key}">
            <div class="hc-icon">${h.icon}</div>
            <div class="hc-label">${h.label}</div>
            <div class="hc-count" data-habit-color="${h.color}">${total}</div>
            <div class="hc-sub">${recentStr}</div>
          </div>
        `;
  }).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <h3>📏 Histórico de Hábitos</h3>
        <span class="text-base text-muted" id="habit-hist-count"></span>
      </div>
      <div class="card-body habit-hist-list" id="habit-hist-list">
      </div>
      <div id="habit-hist-footer" class="habit-hist-footer"></div>
    </div>
  `;
  renderHabitHistPage();
}

export function renderHabitHistPage() {
  const all = HABIT_TYPES
    .flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })))
    .sort((a, b) => b.data.localeCompare(a.data));
  const total = all.length;
  const page = habitHistPage;
  const start = (page - 1) * HABIT_HIST_PAGE_SIZE;
  const end = start + HABIT_HIST_PAGE_SIZE;
  const items = all.slice(start, end);
  const totalPages = Math.max(1, Math.ceil(total / HABIT_HIST_PAGE_SIZE));

  const countEl = document.getElementById('habit-hist-count');
  if (countEl) countEl.textContent = `${total} registro(s)`;

  const listEl = document.getElementById('habit-hist-list');
  if (listEl) {
    listEl.innerHTML = items.length === 0
      ? '<div class="empty-state"><div class="icon">⚡</div><p>Nenhum hábito registrado ainda</p></div>'
      : items.map(r => `
        <div class="flex border-b habit-hist-item">
          <div class="habit-item-icon">${r.tipo.icon}</div>
          <div class="flex-1">
            <div class="text-md font-semibold">${esc(r.tipo.label)}${r.descricao ? ' - ' + esc(r.descricao) : ''}</div>
            <div class="text-base text-secondary">${formatDate(r.data)}${(r.quantidade || r.total) && r.tipo.key === 'questoes' ? ' • ' + (r.quantidade || r.total) + ' questões' : ''}${r.total && r.tipo.key === 'paginas' ? ' • ' + r.total + ' páginas' : ''}${r.acertos !== undefined && r.tipo.key === 'questoes' ? ' • ' + r.acertos + ' acertos' : ''}${r.total && r.total > 0 && r.tipo.key === 'questoes' ? ` • ${r.acertos}/${r.total} (${Math.round(r.acertos / r.total * 100)}%)` : ''}</div>
            ${r.gabaritoPorDisc && r.gabaritoPorDisc.length ? `
              <div class="flex-wrap gap-sm mt-1 habit-disc-tags">
                ${r.gabaritoPorDisc.map(g => `<span class="habit-disc-tag">${esc(g.discNome)}: ${g.acertos}/${g.total}</span>`).join('')}
              </div>` : ''}
          </div>
          <button class="icon-btn" data-action="delete-habit" data-type="${r.tipo.key}" data-habit-id="${r.id}">🗑️</button>
        </div>
      `).join('');
  }

  const footerEl = document.getElementById('habit-hist-footer');
  if (footerEl && total > HABIT_HIST_PAGE_SIZE) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>⇉ Anterior</button>
      <span class="text-base text-muted flex-1 text-center">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima ⇆</button>
    `;
    footerEl.style.display = 'flex';
  } else if (footerEl) {
    footerEl.style.display = 'none';
  }
}

export function setHabitPage(p) {
  const all = HABIT_TYPES.flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })));
  const totalPages = Math.max(1, Math.ceil(all.length / HABIT_HIST_PAGE_SIZE));
  habitHistPage = Math.max(1, Math.min(p, totalPages));
  renderHabitHistPage();
  document.getElementById('habit-hist-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function openHabitModal(tipo) {
  currentHabitType = tipo;
  const h = tipo ? HABIT_TYPES.find(ht => ht.key === tipo) : null;
  const titleEl = document.getElementById('modal-habit-title');
  if (titleEl) titleEl.textContent = h ? `Registrar: ${h.label}` : 'Registrar Hábito';

  const discOptions = getAllDisciplinas().map(d => `<option value="${d.disc.id}">${esc(d.disc.nome)}</option>`).join('');

  const habitBody = document.getElementById('modal-habit-body');
  if (!habitBody) return;
  habitBody.innerHTML = `
    ${!tipo ? `
      <div class="form-group">
        <label class="form-label">Tipo de Hábito</label>
        <div class="event-type-grid">
          ${HABIT_TYPES.map(h => `
            <div class="event-type-card" data-action="select-habit-type" data-tipo="${h.key}">
              <div class="et-icon">${h.icon}</div>
              <div class="et-label">${h.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div class="form-group">
      <label class="form-label">Data</label>
      <input type="date" class="form-control" id="habit-data" value="${todayStr()}">
    </div>
    ${tipo === 'questoes' ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantidade de Questões</label>
          <input type="number" class="form-control" id="habit-qtd" value="10" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="habit-disc">${discOptions}</select>
      </div>
    ` : tipo === 'simulado' ? `
      <div class="form-group">
        <label class="form-label">Nome do Simulado</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Simulado CEBRASPE 01">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total de Questões</label>
          <input type="number" class="form-control" id="habit-total" value="120" data-action="calc-simulado-perc">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos (Geral)</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0" data-action="calc-simulado-perc">
        </div>
      </div>
      <div id="sim-perc" class="simulado-perc"></div>

      <!-- Feature 13: gabarito por disciplina -->
      <details>
        <summary class="simulado-disc-summary">📈 Gabarito por Disciplina (opcional)</summary>
        <div id="sim-disc-list" class="simulado-disc-list">
          ${getAllDisciplinas().map(({ disc, edital }) => `
            <div class="simulado-disc-row">
              <span class="simulado-disc-name" title="${esc(edital.nome)}">${disc.icone || '📚'} ${esc(disc.nome)}</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Total" id="sim-total-${disc.id}" min="0">
              <span class="simulado-disc-separator">/</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Acertos" id="sim-acertos-${disc.id}" min="0">
            </div>
          `).join('')}
          ${getAllDisciplinas().length === 0 ? '<div class="simulado-empty">Cadastre disciplinas para usar o gabarito detalhado.</div>' : ''}
        </div>
      </details>
    ` : tipo === 'discursiva' ? `
      <div class="form-group">
        <label class="form-label">Tema</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Tema da discursiva">
      </div>
      <div class="form-group">
        <label class="form-label">Nota/Pontuação (opcional)</label>
        <input type="number" class="form-control" id="habit-nota" placeholder="Ex: 8.5">
      </div>
    ` : tipo === 'leitura' ? `
      <div class="form-group">
        <label class="form-label">Título / Legislação</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Lei 8.112/1990">
      </div>
      <div class="form-group">
        <label class="form-label">Páginas/Artigos lidos</label>
        <input type="number" class="form-control" id="habit-paginas" placeholder="Ex: 30">
      </div>
    ` : `
      <div class="form-group">
        <label class="form-label">Descrição (opcional)</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Observações">
      </div>
    `}
  `;
  openModal('modal-habit');
}

export function selectHabitType(tipo, el) {
  document.querySelectorAll('.event-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  currentHabitType = tipo;
}

export function saveHabit() {
  if (!currentHabitType) { showToast('Selecione o tipo de hábito', 'error'); return; }
  const data = document.getElementById('habit-data')?.value || todayStr();
  const registro = { id: uid(), data, tipo: currentHabitType };

  if (currentHabitType === 'questoes') {
    const qtd = parseInt(document.getElementById('habit-qtd')?.value || '10');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate questoes
    if (isNaN(qtd) || qtd < 1) { showToast('Informe uma quantidade válida de questões (mínimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos não pode ser negativo', 'error'); return; }
    if (acertos > qtd) { showToast(`Acertos (${acertos}) não pode ser maior que o total (${qtd})`, 'error'); return; }
    registro.quantidade = qtd;
    registro.acertos = acertos;
    registro.discId = document.getElementById('habit-disc')?.value;

  } else if (currentHabitType === 'simulado') {
    const total = parseInt(document.getElementById('habit-total')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate simulado
    if (isNaN(total) || total < 1) { showToast('Informe o total de questões do simulado (mínimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos não pode ser negativo', 'error'); return; }
    if (acertos > total) { showToast(`Acertos (${acertos}) não pode ser maior que o total (${total})`, 'error'); return; }
    registro.total = total;
    registro.acertos = acertos;
    registro.descricao = document.getElementById('habit-desc')?.value;
    // Feature 13: collect gabarito por disciplina
    const gabDiscs = [];
    getAllDisciplinas().forEach(({ disc }) => {
      const tot = parseInt(document.getElementById(`sim-total-${disc.id}`)?.value || '');
      const ace = parseInt(document.getElementById(`sim-acertos-${disc.id}`)?.value || '');
      if (!isNaN(tot) && tot > 0) {
        // Fix J: cap per-disc acertos at its total
        gabDiscs.push({ discId: disc.id, discNome: disc.nome, total: tot, acertos: isNaN(ace) ? 0 : Math.min(ace, tot) });
      }
    });
    if (gabDiscs.length > 0) registro.gabaritoPorDisc = gabDiscs;

  } else if (currentHabitType === 'discursiva') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const nota = parseFloat(document.getElementById('habit-nota')?.value || '0');
    // Fix J: validate nota
    if (!isNaN(nota) && (nota < 0 || nota > 10)) { showToast('Nota deve estar entre 0 e 10', 'error'); return; }
    registro.nota = isNaN(nota) ? null : nota;

  } else if (currentHabitType === 'leitura') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const paginas = parseInt(document.getElementById('habit-paginas')?.value || '0');
    // Fix J: validate paginas
    if (isNaN(paginas) || paginas < 1) { showToast('Informe o número de páginas (mínimo 1)', 'error'); return; }
    registro.paginas = paginas;

  } else {
    registro.descricao = document.getElementById('habit-desc')?.value;
  }

  if (!state.habitos[currentHabitType]) state.habitos[currentHabitType] = [];
  state.habitos[currentHabitType].push(registro);
  scheduleSave();
  closeModal('modal-habit');
  renderCurrentView();
  showToast('Hábito registrado!', 'success');
}

export function calcSimuladoPerc() {
  const tot = parseInt(document.getElementById('habit-total')?.value || '0');
  const ace = parseInt(document.getElementById('habit-acertos')?.value || '0');
  const el = document.getElementById('sim-perc');
  if (!el || !tot) return;
  const pct = Math.round(ace / tot * 100);
  const colorClass = pct >= 70 ? 'text-accent' : pct >= 50 ? 'text-orange' : 'text-red';
  el.innerHTML = `<span class="${colorClass}">${pct}% de aproveitamento (${ace}/${tot})</span>`;
}

export function deleteHabito(tipo, id) {
  showConfirm('Excluir este registro de hábito?', () => {
    state.habitos[tipo] = (state.habitos[tipo] || []).filter(h => h.id !== id);
    habitHistPage = 1;
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir', title: 'Excluir registro' });
}

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

window.setVertFilterStatus = function (s) { vertFilterStatus = s; };
window.setVertFilterEdital = function (e) { vertFilterEdital = e; };

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

window.toggleEditSeq = () => {
  window._isEditingSequence = !window._isEditingSequence;
  if (window._isEditingSequence) {
    window._tempSequencia = JSON.parse(JSON.stringify(state.planejamento.sequencia));
  } else {
    window._tempSequencia = null;
  }
  renderCurrentView();
};

window.saveEditSeq = () => {
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
};

window.cancelEditSeq = () => {
  window._isEditingSequence = false;
  window._tempSequencia = null;
  renderCurrentView();
};

window.updateSeqItem = (i, field, val) => {
  i = parseInt(i, 10);
  if (field === 'minutosAlvo') val = parseInt(val) || 0;
  window._tempSequencia[i][field] = val;
};

window.dupSeqItem = (i) => {
  i = parseInt(i, 10);
  const obj = JSON.parse(JSON.stringify(window._tempSequencia[i]));
  obj.id = 'seq_' + uid();
  window._tempSequencia.splice(i + 1, 0, obj);
  renderCurrentView();
};

window.remSeqItem = (i) => {
  i = parseInt(i, 10);
  window._tempSequencia.splice(i, 1);
  renderCurrentView();
};

window.moveSeqItem = (i, dir) => {
  i = parseInt(i, 10);
  const arr = window._tempSequencia;
  if (i + dir < 0 || i + dir >= arr.length) return;
  const temp = arr[i];
  arr[i] = arr[i + dir];
  arr[i + dir] = temp;
  renderCurrentView();
};

window.addSeqItem = () => {
  window._tempSequencia.push({
    id: 'seq_' + uid(),
    discId: '',
    minutosAlvo: 60
  });
  renderCurrentView();
};



window.toggleVertDisc = function (id) {
  const body = document.getElementById('vert-disc-body-' + id);
  const icon = document.getElementById('vert-disc-icon-' + id);
  if (!body || !icon) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    body.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
};

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

// Global switch tab function
window.switchDashboardTab = function (tabName) {
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
  const accent = themeVars.getPropertyValue('--accent').trim() || '#3b82f6';
  const bg = themeVars.getPropertyValue('--bg').trim() || '#0f172a';
  const card = themeVars.getPropertyValue('--card').trim() || '#1e293b';
  const border = themeVars.getPropertyValue('--border').trim() || '#334155';
  const textPrimary = themeVars.getPropertyValue('--text-primary').trim() || '#f1f5f9';
  const textMuted = themeVars.getPropertyValue('--text-muted').trim() || '#94a3b8';
  const grid = border;
  const accentSoft = /^#[0-9A-Fa-f]{6}$/.test(accent) ? `${accent}1A` : 'rgba(59,130,246,0.1)';

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
    parent.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;font-style:italic;">Métricas insuficientes. Registre sessões com número de questões para gerar o gráfico de evolução.</div>';
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
  const cor = document.getElementById('disc-cor')?.value || '#10b981';
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
        <button data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="-1" title="Subir"><i class="fa fa-chevron-up"></i></button>
        <button data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="1" title="Descer"><i class="fa fa-chevron-down"></i></button>
        <button data-action="delete-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" title="Excluir"><i class="fa fa-trash"></i></button>
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
         <button data-action="delete-aula" data-disc-id="${disc.id}" data-aula-id="${aula.id}" title="Excluir"><i class="fa fa-trash"></i></button>
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
    <div class="manager-tabs">
        <div data-action="switch-manager-tab" data-tab="topicos" class="manager-tab ${window._activeDiscManagerTab === 'topicos' ? 'manager-tab--active' : ''}">
            Tópicos do Edital (${disc.assuntos.length})
        </div>
        <div data-action="switch-manager-tab" data-tab="aulas" class="manager-tab ${window._activeDiscManagerTab === 'aulas' ? 'manager-tab--active' : ''}">
            Meus Materiais/Aulas (${disc.aulas ? disc.aulas.length : 0})
        </div>
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
      <textarea class="form-control form-control--resize" id="new-aula-bulk" placeholder="Aula 00 - Concordância Nominal\nAula 01 - Crase..." style="min-height:80px;"></textarea>
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

window.switchManagerTab = function (tabName) {
  window._activeDiscManagerTab = tabName;
  if (editingSubjectCtx) {
    openDiscManager(editingSubjectCtx.editaId, editingSubjectCtx.discId);
  }
};

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

window.editLessonInline = function (discId, aulaId, el) {
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
};

window.toggleAulaEstudada = function (discId, aulaId) {
  const d = getDisc(discId);
  if (!d) return;
  const aulaObj = (d.disc.aulas || []).find(a => a.id === aulaId);
  if (!aulaObj) return;

  aulaObj.estudada = !aulaObj.estudada;
  aulaObj.dataEstudo = aulaObj.estudada ? todayStr() : null;
  scheduleSave();
  openDiscManager(editingSubjectCtx.editaId, discId);
};

window.addBulkAulas = function (discId) {
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
};

window.deleteAula = function (discId, aulaId) {
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
};

import { mapAulasToAssuntos } from './lesson-mapper.js?v=8.3';
window.runLessonMapperUI = function (editaId, discId) {
  showConfirm("Deseja aplicar Inteligência Artificial para conectar automaticamente as Aulas aos Assuntos deste Edital com base em similaridade (NLP + Levenshtein)?", () => {
    const resultCount = mapAulasToAssuntos(editaId, discId);
    if (resultCount > 0) {
      showToast(`${resultCount} Aulas Conectadas Automaticamente!`, 'success');
    } else {
      showToast('Nenhum Tópico bateu com 70%+ de precisão com esta base de Aulas.', 'info');
    }
    openDiscManager(editingSubjectCtx.editaId, discId);
  }, { label: 'Rodar Auto-Link', title: 'Mapeador ML' });
};


// =============================================
// MÓDULO PREDITIVO DE BANCA E RELEVÂNCIA (WAVE 33)
// =============================================
import { applyRankingToEdital, commitEditalOrdering, revertEditalOrdering } from './relevance.js?v=8.3';

let analyzerCtx = { editaId: null, parsedHotTopics: [], tempMatchResults: [] };


window.mudarEditalAnalisador = function (editaId) {
  analyzerCtx.editaId = editaId;
  window._renderBancaAnalyzerContent(document.getElementById('main-content'));
};

window.filtrarViewPorDisciplina = function (discId) {
  // Option selected changed - do we automatically map the results?
  // It's good practice to try matching the already stored topics from DB
  const hotTopics = state.bancaRelevance?.hotTopics || [];
  const hasTopics = hotTopics.some(ht => ht.disciplinaId === discId);

  if (hasTopics) {
    analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(res => res.discId === discId);
    window.renderBancaMatches();
  } else {
    analyzerCtx.tempMatchResults = [];
    window.renderBancaMatches();
  }
};

window.carregarAnaliseBanca = function (discId) {
  const selectEl = document.getElementById('banca-disc-select');
  if (selectEl) selectEl.value = discId;

  const hotTopics = state.bancaRelevance?.hotTopics || [];
  const topicsForDisc = hotTopics.filter(ht => ht.disciplinaId === discId);

  if (topicsForDisc.length > 0) {
    topicsForDisc.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.weight && b.weight) return b.weight - a.weight;
      return 0;
    });

    const textStr = topicsForDisc.map(ht => {
      let wStr = ht.weight ? ` (${ht.weight} %)` : '';
      return `${ht.rank ? ht.rank + '.' : '-'} ${ht.nome}${wStr} `;
    }).join('\n');

    const textarea = document.getElementById('banca-input-text');
    if (textarea) textarea.value = textStr;
  }

  window.filtrarViewPorDisciplina(discId);
};

window.excluirAnaliseBanca = function (discId) {
  const edital = state.editais.find(e => e.id === analyzerCtx.editaId);
  const discName = edital?.disciplinas?.find(d => d.id === discId)?.nome || 'esta disciplina';

  showConfirm(`Tem certeza que deseja apagar a análise preditiva salva de "${discName}" ?\nOs Hot Topics importados serão removidos.`, () => {
    state.bancaRelevance.hotTopics = state.bancaRelevance.hotTopics.filter(ht => ht.disciplinaId !== discId);

    // Wave 36 - Limpeza do Edital.
    if (analyzerCtx.editaId) {
      revertEditalOrdering(analyzerCtx.editaId, discId);
    } else {
      scheduleSave();
    }

    // reset selection if needed
    const selectEl = document.getElementById('banca-disc-select');
    if (selectEl && selectEl.value === discId) {
      selectEl.value = "";
      const textEl = document.getElementById('banca-input-text');
      if (textEl) textEl.value = "";
      analyzerCtx.tempMatchResults = [];
    }

    window._renderBancaAnalyzerContent(document.getElementById('main-content'));
    showToast('Análise excluída e Assuntos Reordenados para o Default.', 'success');
  }, { title: 'Excluir Análise', danger: true });
};

window.parseBancaText = function () {
  const discId = document.getElementById('banca-disc-select').value;
  if (!discId) { showToast('Selecione uma matéria no campo acima antes de processar.', 'error'); return; }

  const rawArgs = document.getElementById('banca-input-text').value;
  if (!rawArgs.trim()) { showToast('Nenhum texto informado.', 'error'); return; }

  const lines = rawArgs.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2);
  let parsedRows = [];

  // Expressões regulares para achar padrão "1. Assunto" ou "Assunto (25%)"
  lines.forEach((line, idx) => {
    let weight = undefined;
    let extName = line;

    // Limpa numerações padrão como "1.", "1 -", "1)", etc, e assume Rank pelo index
    const rankMatch = extName.match(/^(\d+)[\.\-\)\–\—]\s+(.*)/);
    if (rankMatch) {
      extName = rankMatch[2];
    }

    // Procura por % ou "Alta/Média/Baixa"
    const percMatch = extName.match(/(.*?)(?:(?:\s*\()|\s*[\-\–\—])?\s*(\d+(?:[.,]\d+)?)\s*%(?:\))?/);
    if (percMatch && percMatch[2]) {
      extName = percMatch[1].trim();
      weight = parseFloat(percMatch[2].replace(',', '.')); // de 0 a 100
    } else {
      // Tenta extrair Level
      if (extName.toUpperCase().includes('ALTA')) weight = 100;
      else if (extName.toUpperCase().match(/\bM[EÉ]DIA\b/)) weight = 60;
      else if (extName.toUpperCase().includes('BAIXA')) weight = 30;
    }

    parsedRows.push({
      id: uid(),
      nome: extName.replace(/[\*\-\–\—•]/g, '').trim(),
      rank: idx + 1, // Se for sequencial, aproveita
      weight: weight,
      disciplinaId: discId
    });
  });

  // Mantém o histórico filtrando a disciplina selecionada e apendando os novos rows
  let existingTopics = state.bancaRelevance && state.bancaRelevance.hotTopics ? state.bancaRelevance.hotTopics : [];
  existingTopics = existingTopics.filter(ht => ht.disciplinaId !== discId);

  if (!state.bancaRelevance) state.bancaRelevance = {};
  state.bancaRelevance.hotTopics = existingTopics.concat(parsedRows);
  scheduleSave();

  // Atualiza a opção no select como Processada (Checkmark)
  const selectOpt = document.querySelector(`#banca-disc-select option[value="${discId}"]`);
  if (selectOpt && !selectOpt.text.startsWith('✅')) {
    selectOpt.text = selectOpt.text.replace('⚪', '✅');
  }
  document.getElementById('banca-input-text').value = '';

  // Roda a Engine Completa de Match para a disciplina específica para simulação na View
  analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(res => res.discId === discId);
  window.renderBancaMatches();
  showToast('Matéria processada com sucesso!', 'success');
};

window.renderBancaMatches = function () {
  const container = document.getElementById('banca-match-results');
  const emptyView = document.getElementById('banca-match-empty');
  const applyBtn = document.getElementById('banca-apply-btn');
  const statsDiv = document.getElementById('banca-stats');

  if (!analyzerCtx.tempMatchResults || analyzerCtx.tempMatchResults.length === 0) {
    container.style.display = 'none';
    applyBtn.style.display = 'none';
    emptyView.style.display = 'flex';
    statsDiv.textContent = 'Aguardando Input...';
    return;
  }

  let p1c = 0, p2c = 0;

  const rows = analyzerCtx.tempMatchResults.map(res => {
    if (res.priority === 'P1') p1c++;
    if (res.priority === 'P2') p2c++;

    const stIcon = res.priority === 'P1' ? 'fa-fire' : (res.priority === 'P2' ? 'fa-bolt' : 'fa-check');
    const stColor = res.priority === 'P1' ? 'var(--red)' : (res.priority === 'P2' ? 'var(--orange)' : 'var(--text-muted)');

    const confBadgeColor = res.matchData.confidence === 'HIGH' ? 'var(--green)' : (res.matchData.confidence === 'MEDIUM' ? 'var(--yellow)' : 'var(--text-muted)');

    return `
      <div class="banca-match-row">
                <div class="banca-match-priority-icon" style="color:${stColor};"><i class="fa ${stIcon}"></i></div>
                <div>
                   <div class="banca-match-title">${esc(res.assuntoNome)}</div>
                   <div class="banca-match-subtitle">${esc(res.discNome)}</div>
                </div>
                <div>
                   <div class="banca-match-name" title="${res.matchData.matchedItem ? esc(res.matchData.matchedItem.nome) : 'Sem Incidencia'}">
                       ${res.matchData.matchedItem ? esc(res.matchData.matchedItem.nome) : '<span class="text-muted"><i>Sem Incidência</i></span>'}
                   </div>
                   <div class="banca-match-score" style="color:${confBadgeColor};">${res.matchData.reason} | Score: ${res.finalScore.toFixed(0)}</div>
                </div>
                <div>
                     <span class="event-tag banca-match-tag" style="background:${stColor};">${res.priority}</span>
                </div>
                <div>
                     <button class="btn btn-ghost btn-sm" title="Corrigir Erro Textual" data-action="open-match-corrector" data-assunto-nome="${esc(res.assuntoNome)}"><i class="fa fa-edit"></i></button>
                </div>
            </div>
      `;
  });

  emptyView.style.display = 'none';
  container.innerHTML = `
      <div class="dash-label" style = "margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:8px; display:flex; justify-content:space-between;" >
           <span>Matéria Processada (Assuntos do Edital local)</span>
           <span>Prioridade Reordenada</span>
        </div>
      ${rows.join('')}
    `;

  container.style.display = 'block';
  applyBtn.style.display = 'inline-block';
  statsDiv.textContent = `P1: ${p1c} incríveis | P2: ${p2c} de suporte`;
  showToast('Match Processado! Revise a lista antes de aplicar.', 'success');
};

window.applyBancaRanking = function () {
  if (commitEditalOrdering(analyzerCtx.editaId, analyzerCtx.tempMatchResults)) {
    showToast('Prioridades P1/P2/P3 gravadas na Memória Principal!', 'success');
  } else {
    showToast('Falha crítica ao gravar novo Edital na Store', 'error');
  }
}

window.openMatchCorrector = function (assuntoNome) {
  let hotTopics = state.bancaRelevance?.hotTopics || [];

  // Limpeza de cache de string longa corrompida do commit passado (glitch cleanup)
  const lenOriginal = hotTopics.length;
  hotTopics = hotTopics.filter(ht => ht.nome.length < 150);
  if (hotTopics.length !== lenOriginal) {
    state.bancaRelevance.hotTopics = hotTopics;
    scheduleSave();
  }

  // Lista as opções da banca detectada para o usuário "ligar os pontos"
  const optionsHtml = hotTopics.map(ht => `<option value = "${ht.id}" style = "width:100%;max-width:350px;" > ${esc(ht.nome)} (Rank: ${ht.rank || ht.weight
    })</option> `).join('');

  document.getElementById('modal-match-corrector-title').textContent = 'Corrigir Assunto';
  document.getElementById('modal-match-corrector-body').innerHTML = `
    <div class="form-group" >
            <div class="banca-corrector-label">${esc(assuntoNome)}</div>
            <label class="form-label">Qual tema real da Banca equivale a esse tópico do Edital?</label>
            <select id="corrector-select" class="form-control banca-corrector-select">
                <option value="NONE">⚠️ Nenhuma Correspondência (Sem Incidência Real)</option>
                ${optionsHtml}
            </select>
            <div class="banca-corrector-hint">
                Isto forçará um *Match 100% (HIGH)* daqui pra frente.
            </div>
        </div>

    <div class="modal-footer-standard--padded">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-match-corrector">Cancelar</button>
      <button class="btn btn-primary" data-action="save-match-correction" data-assunto-nome="${esc(assuntoNome)}">Forçar Correção</button>
    </div>
  `;
  openModal('modal-match-corrector');
}

window.saveMatchCorrection = function (assuntoOrigemRaw) {
  const overrideId = document.getElementById('corrector-select').value;
  // Salva o mapping
  if (!state.bancaRelevance) state.bancaRelevance = {};
  if (!state.bancaRelevance.userMappings) state.bancaRelevance.userMappings = {};

  state.bancaRelevance.userMappings[assuntoOrigemRaw] = overrideId;
  scheduleSave();

  closeModal('modal-match-corrector');
  showToast('Match forçado com sucesso!', 'success');

  // Reprocessa
  if (analyzerCtx.parsedHotTopics || analyzerCtx.tempMatchResults) {
    const discId = document.getElementById('banca-disc-select').value;
    if (discId) {
      analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(res => res.discId === discId);
      window.renderBancaMatches();
    }
  }
}

// Bug 1 Fix: Dedicated function for adding topics from Verticalizado view
// The registro-sessao addNovoTopico() reads from DOM (#reg-disciplina) which doesn't exist here
export function addNovoTopicoVertical(editaId, discId) {
  const entry = getDisc(discId);
  if (!entry) { showToast('Disciplina não encontrada', 'error'); return; }

  document.getElementById('modal-prompt-title').textContent = 'Novo Tópico';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div class="config-sub">
      Adicionar tópico em <strong>${esc(entry.disc.nome)}</strong>
    </div>
    <input type="text" id="prompt-input-topico" class="form-control" placeholder="Nome do novo tópico..." autofocus>
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const nome = document.getElementById('prompt-input-topico')?.value.trim();
    if (!nome) { showToast('Informe o nome do tópico', 'error'); return; }

    entry.disc.assuntos.push({
      id: uid(),
      nome,
      concluido: false,
      dataConclusao: null,
      revisoesFetas: []
    });
    scheduleSave();
    closeModal('modal-prompt');
    renderCurrentView();
    showToast(`Tópico "${nome}" adicionado!`, 'success');
  };

  openModal('modal-prompt');
  setTimeout(() => document.getElementById('prompt-input-topico')?.focus(), 100);
}

export function finishInlineEdit(discId, assId, newName, el) {
  newName = newName.trim();
  const entry = getDisc(discId);
  if (entry && newName) {
    const ass = entry.disc.assuntos.find(a => a.id === assId);
    if (ass) {
      ass.nome = newName;
      scheduleSave();
    }
  }
  if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
    openDiscManager(editingSubjectCtx.editaId, discId);
    renderCurrentView();
  }
}

export function moveSubject(discId, idx, dir) {
  const entry = getDisc(discId);
  if (!entry) return;
  const assuntos = entry.disc.assuntos;
  if (idx + dir < 0 || idx + dir >= assuntos.length) return;

  const temp = assuntos[idx];
  assuntos[idx] = assuntos[idx + dir];
  assuntos[idx + dir] = temp;

  scheduleSave();
  if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
    openDiscManager(editingSubjectCtx.editaId, discId);
    renderCurrentView();
  }
}

export function saveDiscManager(editaId, discId) {
  const entry = getDisc(discId);
  if (!entry) return;

  const nome = document.getElementById('dm-nome').value.trim();
  const cor = document.getElementById('dm-cor-picker').value;

  if (nome) entry.disc.nome = nome;
  if (cor) entry.disc.cor = cor;

  scheduleSave();
  closeModal('modal-disc-manager');
  renderCurrentView();
  showToast('Disciplina atualizada!', 'success');
}

export function addAssunto(discId) {
  const input = document.getElementById('new-assunto-nome');
  const nome = input ? input.value.trim() : '';
  if (!nome) return;

  const entry = getDisc(discId);
  if (!entry) return;

  // Normalize and parse: handle numbered topics pasted on a single line, remove prefixes
  const normalized = nome
    .replace(/\r/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/([^\n])\s+(\d+(?:\.\d+)*[.)-]?\s+(?=[A-Za-z\u00C0-\u00FF]))/g, '$1\n$2');

  const lines = normalized.split('\n')
    .map(s => s.trim())
    .map(s => s.replace(/^(\d+(?:\.\d+)*[.)-]?|[a-z][.)-]?|[IVXLCDM]+\s*[.)-]?|[-\u2022\u2013\u2014])\s+/i, ''))
    .filter(s => s.length > 0);
  let added = 0;
  lines.forEach(line => {
    if (!entry.disc.assuntos.find(a => a.nome === line)) {
      entry.disc.assuntos.push({ id: uid(), nome: line, concluido: false, dataConclusao: null, revisoesFetas: [] });
      added++;
    }
  });

  if (added > 0) {
    scheduleSave();
    showToast(`${added} tópico(s) adicionado(s)!`, 'success');
  }
  if (editingSubjectCtx) {
    openDiscManager(editingSubjectCtx.editaId, discId);
  }
}

export function openSubjectAddModal(editaId, discId) {
  editingSubjectCtx = { editaId, discId };
  document.getElementById('modal-subject-add-body').innerHTML = `
    <div class="form-group" >
      <label class="form-label text-xs text-uppercase text-muted font-semibold">Conteúdo</label>
      <textarea id="bulk-subject-text" class="form-control form-control--mono" rows="8" placeholder="Ex:\n1. Configuração do Estado\n2. Direitos Fundamentais\n3. ..."></textarea>
      <div class="config-hint">
        Dica: Você pode fazer quebra de linha com Enter para adicionar mais de um tópico. O sistema limpará numerações como "1.", "1.1", "-", etc.
      </div>
    </div>
    <div class="modal-footer-standard--padded">
      <label class="flex cluster-sm cursor-pointer">
        <input type="checkbox" id="bulk-save-continue"> Salvar e continuar
      </label>
      <div class="flex gap-sm">
        <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-subject-add">Cancelar</button>
        <button class="btn btn-primary" data-action="save-bulk-subjects">Adicionar</button>
      </div>
    </div>
  `;
  openModal('modal-subject-add');
  setTimeout(() => document.getElementById('bulk-subject-text').focus(), 100);
}

export function saveBulkSubjects() {
  const text = document.getElementById('bulk-subject-text').value;
  if (!text.trim()) { closeModal('modal-subject-add'); return; }

  const { discId } = editingSubjectCtx;
  const entry = getDisc(discId);
  if (!entry) return;

  // Parse lines, including pasted edital blocks that come in a single paragraph
  // Ex: "1 Conceito... 1.1 Regime... 2 Administração..."
  const normalized = text
    .replace(/\r/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    // When multiple numbered topics are pasted on one line, force a line break before each index.
    .replace(/([^\n])\s+(\d+(?:\.\d+)*[.)-]?\s+(?=[A-Za-z\u00C0-\u00FF]))/g, '$1\n$2');

  const lines = normalized.split('\n')
    .map(s => s.trim())
    // Matches: "1 ", "1. ", "1.1 ", "1) ", "a) ", "III - ", "- ", "• "
    .map(s => s.replace(/^(\d+(?:\.\d+)*[.)-]?|[a-z][.)-]?|[IVXLCDM]+\s*[.)-]?|[-\u2022\u2013\u2014])\s+/i, ''))
    .filter(s => s.length > 0);

  let added = 0;
  lines.forEach(nome => {
    if (!entry.disc.assuntos.find(a => a.nome === nome)) {
      entry.disc.assuntos.push({ id: uid(), nome, concluido: false, dataConclusao: null, revisoesFetas: [] });
      added++;
    }
  });

  scheduleSave();
  renderCurrentView();

  const keepOpen = document.getElementById('bulk-save-continue').checked;
  if (keepOpen) {
    document.getElementById('bulk-subject-text').value = '';
    document.getElementById('bulk-subject-text').focus();
    showToast(`${added} tópico(s) adicionado(s)!`, 'success');
  } else {
    closeModal('modal-subject-add');
    openDiscManager(editingSubjectCtx.editaId, discId);
    showToast(`${added} tópico(s) adicionado(s)!`, 'success');
  }
}

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
  // Tech 3: Show day load immediately
  setTimeout(() => updateDayLoad(dateStr || todayStr()), 50);
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
document.addEventListener('input', e => {
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
window.openAddPastSessionModal = function(discId) {
  const d = window.getDisc(discId);
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

    <div class="form-group" id="event-aula-group" class="mt-3">
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
};

window.savePastEvent = function(discId) {
  const d = window.getDisc(discId);
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
  if (typeof window.openRegistroSessao === 'function') {
    window.openRegistroSessao(evento.id);
  } else {
    showToast('Erro ao abrir registro detalhado.', 'error');
  }
};


// =============================================
// CONFIG VIEW
// =============================================
export function renderConfig(el) {
  const cfg = state.config;
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
                <option value="light" ${cfg.tema === 'light' || !cfg.darkMode ? 'selected' : ''}>☀️ Light</option>
                <option value="dark" ${cfg.tema === 'dark' || (cfg.darkMode && !cfg.tema) ? 'selected' : ''}>🌑 Original Dark</option>
                <option value="furtivo" ${cfg.tema === 'furtivo' ? 'selected' : ''}>🕶️ Furtivo</option>
                <option value="abismo" ${cfg.tema === 'abismo' ? 'selected' : ''}>🌌 Abismo</option>
                <option value="grafite" ${cfg.tema === 'grafite' ? 'selected' : ''}>🌫️ Grafite</option>
                <option value="matrix" ${cfg.tema === 'matrix' ? 'selected' : ''}>📟 Matrix</option>
                <option value="rubi" ${cfg.tema === 'rubi' ? 'selected' : ''}>🩸 Rubi</option>
                <option value="cyberpunk2077" ${cfg.tema === 'cyberpunk2077' ? 'selected' : ''}>Cyberpunk 2077</option>
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
  state.config.tema = themeName;
  state.config.darkMode = themeName !== 'light';
  // Remember last dark theme for topbar toggle
  if (themeName !== 'light') {
    state.config.lastDarkTheme = themeName;
  }

  document.documentElement.setAttribute('data-theme', themeName);
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
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
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
    reader.readAsText(file);
  };
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
} document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

// =============================================
// UX 1 — GLOBAL SEARCH
// =============================================
export let searchBlurTimeout = null;

let _searchDebounceTimer = null;
window.debouncedOnSearch = function (query) {
  if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    onSearch(query);
  }, 300);
};

export function onSearch(query) {
  const box = document.getElementById('search-results');
  if (!query || query.length < 2) { box.classList.remove('open'); return; }
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

  const highlight = str => esc(str).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  let html = '';

  if (results.eventos.length) {
    html += `<div class="search-section-title">📅 Eventos</div>`;
    html += results.eventos.slice(0, 5).map(({ ev, disc }) => `
      <div class="search-item" data-action="open-search-event" data-event-id="${ev.id}">
        <div class="search-item-icon">${disc ? disc.icone || '📚' : '📅'}</div>
        <div>
          <div class="search-item-label">${highlight(ev.titulo)}</div>
          <div class="search-item-sub">${ev.data ? formatDate(ev.data) : ''}${disc ? ' • ' + disc.nome : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.disciplinas.length) {
    html += `<div class="search-section-title">📖 Disciplinas</div>`;
    html += results.disciplinas.slice(0, 5).map(({ disc, edital }) => `
      <div class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📖'}</div>
        <div>
          <div class="search-item-label">${highlight(disc.nome)}</div>
          <div class="search-item-sub">${esc(edital.nome)} • ${(disc.assuntos || []).length} assunto(s)</div>
        </div>
      </div>`).join('');
  }

  if (results.assuntos.length) {
    html += `<div class="search-section-title">📚 Assuntos</div>`;
    html += results.assuntos.slice(0, 5).map(({ ass, disc, edital }) => `
      <div class="search-item" data-action="navigate-clear-search" data-view="editais">
        <div class="search-item-icon">${disc.icone || '📚'}</div>
        <div>
          <div class="search-item-label">${highlight(ass.nome)}</div>
          <div class="search-item-sub">${esc(disc.nome)} • ${esc(edital.nome)} ${ass.concluido ? '✅' : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.habitos.length) {
    html += `<div class="search-section-title">⚡ Hábitos</div>`;
    html += results.habitos.slice(0, 3).map(({ r, h }) => `
      <div class="search-item" data-action="navigate-clear-search" data-view="habitos">
        <div class="search-item-icon">${h.icon}</div>
        <div>
          <div class="search-item-label">${highlight(r.descricao || h.label)}</div>
          <div class="search-item-sub">${formatDate(r.data)}</div>
        </div>
      </div>`).join('');
  }

  if (!html) html = `<div class="search-empty">Nenhum resultado para "<strong>${query}</strong>"</div>`;
  box.innerHTML = html;
  box.classList.add('open');
}

export function onSearchFocus() {
  clearTimeout(searchBlurTimeout);
  const val = document.getElementById('global-search').value;
  if (val && val.length >= 2) onSearch(val);
}

export function onSearchBlur() {
  searchBlurTimeout = setTimeout(() => {
    document.getElementById('search-results')?.classList.remove('open');
  }, 200);
}

export function clearSearch() {
  document.getElementById('global-search').value = '';
  document.getElementById('search-results').classList.remove('open');
}

// ESC closes search
document.addEventListener('keydown', e => {
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

// =============================================
// PLANEJAMENTO DE ESTUDOS VIEW (WIZARD RESULTS)
// =============================================
export function renderCiclo(el) {
  const plan = state.planejamento || {};

  window.recomecarCiclo = function () {
    showConfirm('Isto irá arquivar a rodada e reiniciar toda a sequência do zero, mantendo as configurações. Tem certeza?', () => {
      if (state.planejamento && state.planejamento.tipo) {
        state.planejamento.ciclosCompletos = (state.planejamento.ciclosCompletos || 0) + 1;
        state.planejamento.dataInicioCicloAtual = new Date().toISOString();
        resetCicloAndWipeEvents();
        renderCurrentView();
        document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Ciclo recomeçado com sucesso! (Eventos Limpos)', type: 'success' } }));
      }
    });
  };

  window.zerarCiclosCounter = function () {
    showConfirm('Isso voltará a contagem de "Ciclos Completos" para zero. Tem certeza?', () => {
      if (state.planejamento) {
        state.planejamento.ciclosCompletos = 0;
        scheduleSave();
        renderCurrentView();
        document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Contador de ciclos zerado!', type: 'info' } }));
      }
    });
  };

  window.calculateCyclePredictions = function () {
    const startObj = document.getElementById('predict-start-date');
    const endObj = document.getElementById('predict-end-date');
    if (!startObj || !endObj) return;

    const sVal = startObj.value;
    const eVal = endObj.value;
    const container = document.getElementById('predict-results-container');
    const emptyState = document.getElementById('predict-empty-state');

    if (sVal && eVal) {
      if (sVal > eVal) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'A data inicial não pode ser maior que a final.';
        emptyState.style.color = '#f87171';
        container.style.display = 'none';
        return;
      }

      const proj = calculateCyclePredictionsModel(sVal, eVal);
      const keys = Object.keys(proj);

      if (keys.length === 0) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'O ciclo não gera sessões nesses dias (Verifique Dias Ativos).';
        emptyState.style.color = 'var(--text-muted)';
        container.style.display = 'none';
      } else {
        emptyState.style.display = 'none';
        container.style.display = 'flex';

        // Get subjects from dictionary
        const listHTML = keys.map(id => {
          const disc = getDisc(id);
          const name = disc ? disc.disc.nome : 'Desconhecida';
          const color = disc ? (disc.disc.cor || disc.edital.cor || 'var(--accent)') : '#888';
          const sessCount = proj[id].sessoes;
          const mins = proj[id].minutos;
          const hr = Math.floor(mins / 60);
          const mn = mins % 60;
          const hrStr = hr > 0 ? `${hr}h${mn}m` : `${mn}m`;

          return `
            <div class="seq-discipline-list-item">
               <div class="seq-discipline-info">
                 <div class="seq-discipline-dot" style="background:${color};"></div>
                 <span class="seq-discipline-name">${esc(name)}</span>
               </div>
               <div class="seq-discipline-stats">
                 <span style="color:var(--text-primary);">${sessCount}</span> sessões <span style="font-weight:400; font-size:10px;">(${hrStr})</span>
               </div>
            </div>
          `;
        }).join('');
        container.innerHTML = listHTML;
      }
    } else {
      emptyState.style.display = 'block';
      emptyState.textContent = 'Selecione as datas para calcular.';
      emptyState.style.color = 'var(--text-muted)';
      container.style.display = 'none';
    }
  };

  if (!plan.ativo || !plan.disciplinas || plan.disciplinas.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">🧭</div>
        <h4>Nenhum Planejamento de Estudos</h4>
        <p class="mb-6">Configure uma estratégia escolhendo entre o "Ciclo Contínuo de Estudos" ou a "Grade Semanal Fixa" para organizar seu tempo otimizadamente.</p>
        <button class="btn btn-primary" data-action="open-planejamento-wizard"><i class="fa fa-play"></i> Criar Meu Planejamento</button>
      </div>
    `;
    return;
  }

  const formatH = min => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return m > 0 ? `${h}h${m}min` : `${h}h`;
    return `${m}min`;
  };

  if (plan.tipo === 'ciclo') {
    // Calculo do tempo estudado desde dataInicioCicloAtual
    let dataInicio = plan.dataInicioCicloAtual || '1970-01-01T00:00:00.000Z';
    dataInicio = dataInicio.substring(0, 10);
    const statsPorDisc = {};
    plan.disciplinas.forEach(id => statsPorDisc[id] = 0);

    const eventosFiltrados = state.eventos.filter(ev => {
      const isEstudado = ev.status === 'estudei' && (ev.tempoAcumulado && ev.tempoAcumulado > 0);
      const evDate = ev.dataEstudo || ev.data;
      return isEstudado && evDate >= dataInicio;
    });

    eventosFiltrados.forEach(ev => {
      if (statsPorDisc[ev.discId] !== undefined) {
        statsPorDisc[ev.discId] += (ev.tempoAcumulado / 60); // min
      }
    });

    let totalTarget = 0;
    let sequenceHtml = '';
    const dictDisciplinas = {};
    plan.disciplinas.forEach(id => {
      const disc = getDisc(id);
      if (disc) dictDisciplinas[id] = disc;
    });

    // Construção Progressiva de Blocos da Sequência
    const copyStats = { ...statsPorDisc };
    let minutosCompletosCiclo = 0;

    let targetLoop = window._isEditingSequence ? (window._tempSequencia || []) : plan.sequencia;

    let optionsHtml = '<option value="">(Selecione)</option>';
    if (window._isEditingSequence) {
      plan.disciplinas.forEach(dId => {
        const disc = getDisc(dId);
        if (disc) optionsHtml += `<option value="${dId}">${esc(disc.disc.nome)}</option>`;
      });
    }

    targetLoop.forEach((seq, i) => {
      const d = dictDisciplinas[seq.discId];
      if (!window._isEditingSequence && !d) return; // skip se não estiver editando e for nulo

      totalTarget += seq.minutosAlvo;

      // Consome os minutos estudados para esta disciplina progressivamente
      let pct = 0;
      let usedMins = 0;
      if (seq.discId && copyStats[seq.discId] > 0) {
        if (copyStats[seq.discId] >= seq.minutosAlvo) {
          usedMins = seq.minutosAlvo;
          pct = 100;
          copyStats[seq.discId] -= seq.minutosAlvo;
        } else {
          usedMins = copyStats[seq.discId];
          pct = (usedMins / seq.minutosAlvo) * 100;
          copyStats[seq.discId] = 0;
        }
      }
      minutosCompletosCiclo += usedMins;
      const pctStr = pct.toFixed(2);
      const cor = d ? (d.disc.cor || d.edital.cor || '#3b82f6') : '#ccc';

      if (!window._isEditingSequence && window._hideConcluidosCiclo && pct >= 100) return;

      if (window._isEditingSequence) {
        let selHtml = optionsHtml;
        if (seq.discId) selHtml = selHtml.replace(`value="${seq.discId}"`, `value="${seq.discId}" selected`);

        sequenceHtml += `
          <div class="seq-item-card">
            <div class="seq-item-color-bar" style="background:${cor};"></div>
            <div class="seq-item-content">
               <div class="seq-item-field" style="flex:2;">
                 <div class="seq-item-field-label">Disciplina</div>
                 <select class="form-control seq-item-select" data-action="update-seq-item" data-index="${i}" data-field="discId">
                   ${selHtml}
                 </select>
               </div>
               <div class="seq-item-field" style="flex:1;">
                 <div class="seq-item-field-label">Minutos</div>
                 <input type="number" class="form-control seq-item-input" value="${seq.minutosAlvo}" data-action="update-seq-item" data-index="${i}" data-field="minutosAlvo">
               </div>

               <div class="seq-item-actions">
                 <div class="seq-item-action-buttons">
                   <button class="btn btn-ghost btn-sm seq-item-action-btn" data-action="dup-seq-item" data-index="${i}">Duplicar</button>
                   <button class="btn btn-ghost btn-sm seq-item-action-btn" data-action="rem-seq-item" data-index="${i}">Remover</button>
                 </div>
                 <div class="seq-item-time">
                   <i class="fa fa-clock"></i> ${formatH(usedMins)} ${pct >= 100 ? '(Feito)' : ''}
                 </div>
               </div>

               <div class="seq-item-move-controls">
                 ${i > 0 ? `<i class="fa fa-caret-up seq-item-move-btn" data-action="move-seq-item" data-index="${i}" data-dir="-1"></i>` : '<div class="seq-item-move-placeholder"></div>'}
                 ${i < targetLoop.length - 1 ? `<i class="fa fa-caret-down seq-item-move-btn" data-action="move-seq-item" data-index="${i}" data-dir="1"></i>` : '<div class="seq-item-move-placeholder"></div>'}
               </div>

            </div>
          </div>
        `;
      } else {
        sequenceHtml += `
          <div class="seq-item-card">
            <div class="seq-item-color-bar" style="background:${cor};"></div>
            <div class="seq-item-content" style="display:block;">
              <div class="seq-item-header">
                <div class="seq-item-title" title="Editar Nome do Evento" data-action="open-ciclo-history" data-seq-id="${seq.id}">${d.disc.icone || '📚'} ${esc(d.disc.nome)}</div>
                <div class="seq-item-time-display">
                   <i class="fa fa-clock"></i> <span style="font-weight:700; color:var(--text-primary);">${formatH(usedMins)}</span> / ${formatH(seq.minutosAlvo)}
                </div>
              </div>

              <div class="seq-progress-bar">
                <div style="position:absolute; top:0; left:0; height:100%; width:${Math.min(pct, 100)}%; background:${cor}; border-radius:8px; opacity:0.6;"></div>
                <div class="seq-progress-text">${pctStr}%</div>
              </div>

              <div class="ciclo-sequence-actions" style="display:flex; gap:16px; font-size:11px;">
                <span class="ciclo-action-link" data-action="iniciar-etapa-planejamento" data-seq-id="${seq.id}"><i class="fa fa-play"></i> Iniciar Estudo</span>
                <span class="ciclo-action-link" data-action="open-add-event"><i class="fa fa-plus"></i> Adicionar Estudo Manualmente</span>
                <span class="ciclo-action-link" data-action="open-ciclo-history" data-seq-id="${seq.id}"><i class="fa fa-history"></i> Ver Últimos Estudos</span>
              </div>
            </div>
          </div>
        `;
      }
    });

    if (window._isEditingSequence) {
      sequenceHtml += `
         <div class="seq-edit-footer">
           <button class="btn btn-ghost" style="border:1px solid var(--accent); color:var(--accent);" data-action="add-seq-item"><i class="fa fa-plus"></i> Adicionar Disciplina</button>
           <div class="seq-edit-footer-actions">
              <button class="btn btn-ghost" data-action="cancel-edit-seq">Cancelar</button>
              <button class="btn btn-primary" data-action="save-edit-seq"><i class="fa fa-save"></i> Salvar Alterações</button>
           </div>
         </div>
      `;
    }

    const progressoGlobalPct = totalTarget > 0 ? ((minutosCompletosCiclo / totalTarget) * 100).toFixed(2) : 0;
    const ciclosFeitos = plan.ciclosCompletos || 0;

    el.innerHTML = `
      <!-- HEADER ACTIONS -->
      <div class="ciclo-header-actions">
        <h2 class="ciclo-header-title">Planejamento</h2>
        <div class="ciclo-header-buttons">
          <button class="btn btn-ghost btn-sm ciclo-btn" data-action="recomecar-ciclo"><i class="fa fa-sync"></i> Recomeçar Ciclo</button>
          <button class="btn btn-ghost btn-sm ciclo-btn" data-action="open-planejamento-wizard"><i class="fa fa-edit"></i> Replanejar</button>
          <button class="btn btn-ghost btn-sm ciclo-btn" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover</button>
        </div>
      </div>

      <div class="grid-2 ciclo-layout">

        <!-- COLUNA ESQUERDA -->
        <div class="ciclo-content-col">
          <div class="ciclo-summary-row">
            <!-- CICLOS COMPLETOS -->
            <div class="card ciclo-stat-card ciclo-stat-card--center">
              <div class="ciclo-stat-label">CICLOS COMPLETOS</div>
              <div class="ciclo-stat-value">${ciclosFeitos}</div>
            </div>
            <!-- PROGRESSO GERAL -->
            <div class="card ciclo-stat-card ciclo-stat-card--fill">
              <div class="ciclo-stat-label">PROGRESSO</div>
              <div class="ciclo-stat-detail">${formatH(minutosCompletosCiclo)} <span class="ciclo-stat-detail-muted">/ ${formatH(totalTarget)}</span></div>
              <div class="flex cluster-sm">
                <div class="ciclo-stat-badge">${progressoGlobalPct}%</div>
                <div class="ciclo-progress-track">
                  <div class="ciclo-progress-bar" style="width:${Math.min(progressoGlobalPct, 100)}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- SEQUENCIA DOS ESTUDOS -->
          <div class="card ciclo-sequence-card">
            <div class="ciclo-sequence-header">
               <div class="ciclo-sequence-title">Sequência dos Estudos</div>
               <div class="ciclo-sequence-controls">
                 ${!window._isEditingSequence ? `
                   <button class="btn btn-ghost btn-sm ciclo-sequence-edit-btn" data-action="toggle-edit-seq"><i class="fa fa-pencil"></i> Editar Sequência</button>
                 ` : ''}
                 <label class="ciclo-filter-label">
                   <input type="checkbox" data-action="toggle-ciclo-fin" ${window._hideConcluidosCiclo ? 'checked' : ''} class="ciclo-filter-checkbox"> FINALIZADOS
                 </label>
               </div>
            </div>
            <div class="custom-scrollbar" style="max-height:600px; overflow-y:auto; padding-right:8px;">
              ${sequenceHtml}
            </div>
          </div>
        </div>

        <!-- COLUNA DIREITA -->
        <div class="card ciclo-side-panel" style="padding:24px; display:flex; flex-direction:column; max-height:calc(100vh - 100px); overflow:hidden;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); letter-spacing:0.5px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
            <span>CICLO</span>
            <button class="btn btn-ghost btn-sm" data-action="zerar-ciclos-counter" style="color:var(--text-muted); padding:4px 8px; font-size:11px;">
              <i class="fa fa-undo"></i> Zerar
            </button>
          </div>
          
          <div style="width: 100%; height: 200px; position:relative; margin-bottom:20px; flex-shrink:0;">
             <canvas id="planejamentoChart"></canvas>
             <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-weight:800; font-size:24px; color:var(--text-muted);">${formatH(totalTarget)}</div>
          </div>
          
          <!-- FILETE LINEAR -->
          <div id="filete-linear-ciclo" style="display:flex; height:12px; border-radius:6px; overflow:hidden; opacity:0.8; margin-bottom:16px; flex-shrink:0;"></div>
          
          <!-- CALCULADORA DE PREVISÃO -->
          <div class="ciclo-predict-box" style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; flex:1; display:flex; flex-direction:column; overflow:hidden; margin-bottom:12px;">
             <h4 style="font-size:12px; font-weight:700; color:var(--text-primary); letter-spacing:0.5px; margin-bottom:12px; flex-shrink:0;"><i class="fa fa-calculator" style="color:var(--accent);"></i> PREVISÃO DE SESSÕES</h4>
             <div class="ciclo-predict-dates" style="display:flex; gap:12px; margin-bottom:16px; flex-shrink:0;">
                <div style="flex:1;">
                   <label style="font-size:10px; color:var(--text-muted); font-weight:600; display:block; margin-bottom:4px;">DATA INICIAL</label>
                   <input type="date" id="predict-start-date" class="form-control" style="font-size:12px; padding:6px 10px;" data-action="calculate-cycle-predictions" value="${plan.horarios?.dataInicial || ''}">
                </div>
                <div style="flex:1;">
                   <label style="font-size:10px; color:var(--text-muted); font-weight:600; display:block; margin-bottom:4px;">DATA FINAL</label>
                   <input type="date" id="predict-end-date" class="form-control" style="font-size:12px; padding:6px 10px;" data-action="calculate-cycle-predictions" value="${plan.horarios?.dataFinal || ''}">
                </div>
             </div>
             <div id="predict-results-container" class="custom-scrollbar" style="display:none; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:4px;">
                <!-- Preenchido via JS -->
             </div>
             <div id="predict-empty-state" style="font-size:12px; color:var(--text-muted); text-align:center; padding:16px 0; flex-shrink:0;">
                Selecione as datas para calcular.
             </div>
          </div>

        </div>
      </div>
    `;

    // Render Chart.js
    setTimeout(() => {
      const ctx = document.getElementById('planejamentoChart');
      if (ctx) {
        const labels = [];
        const data = [];
        const bgColors = [];

        // Agrupar targets por disciplina para o gráfico
        const chartData = {};
        plan.sequencia.forEach(seq => {
          if (!chartData[seq.discId]) chartData[seq.discId] = 0;
          chartData[seq.discId] += seq.minutosAlvo;
        });

        let linearHtml = '';
        for (const [id, min] of Object.entries(chartData)) {
          const d = dictDisciplinas[id];
          if (d) {
            labels.push(d.disc.nome);
            data.push(min);
            const color = d.disc.cor || d.edital.cor || '#3b82f6';
            bgColors.push(color);
            const wPct = totalTarget > 0 ? ((min / totalTarget) * 100).toFixed(2) : 0;
            linearHtml += `<div style="width:${wPct}%; background:${color}; height:100%;"></div>`;
          }
        }

        document.getElementById('filete-linear-ciclo').innerHTML = linearHtml;

        if (window._planjChartInstance) {
          window._planjChartInstance.destroy();
          window._planjChartInstance = null;
        }
        window._planjChartInstance = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: bgColors,
              borderColor: 'transparent',
              borderWidth: 0,
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: { size: 13 },
                bodyFont: { size: 14, weight: 'bold' },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                  label: function (context) {
                    return ' ' + formatH(context.raw);
                  }
                }
              }
            }
          }
        });
      }

      // Auto-trigger prediction calculations if dates are pre-filled by Wizard
      if (plan.horarios?.dataInicial && plan.horarios?.dataFinal) {
        window.calculateCyclePredictions();
      }
    }, 100);

  } else if (plan.tipo === 'semanal') {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    let weeklyHtml = '';
    let totalTarget = 0;

    for (let i = 0; i < 7; i++) {
      if (plan.horarios.diasAtivos.includes(i)) {
        weeklyHtml += `
            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px;">
               <div style="font-weight:700; margin-bottom:8px;">${days[i]}</div>
               <div style="color:var(--text-muted); font-size:13px;">${(() => { const hm = plan.horarios.horasPorDia[i]; if (!hm || !hm.includes(':')) return hm || '?'; const [h, m] = hm.split(':'); const hi = parseInt(h, 10); const mi = parseInt(m, 10); return hi > 0 ? (mi > 0 ? `${hi}h${String(mi).padStart(2, '0')}min` : `${hi}h`) : `${mi}min`; })()} planejadas</div>
            </div>
          `;
      }
    }

    let sequenceHtml = '';
    const dictDisciplinas = {};
    if (plan.disciplinas && plan.sequencia) {
      plan.disciplinas.forEach(id => {
        const disc = getDisc(id);
        if (disc) dictDisciplinas[id] = disc;
      });

      plan.sequencia.forEach((seq, i) => {
        const d = dictDisciplinas[seq.discId];
        if (!d) return;
        totalTarget += seq.minutosAlvo;

        sequenceHtml += `
            <div class="ciclo-item ${seq.concluido ? 'concluido' : ''}" style="margin-bottom:12px;">
              <div class="ciclo-item-cor" style="background:${d.disc.cor || d.edital.cor || '#3b82f6'};"></div>
              <div class="ciclo-item-body">
                <div class="ciclo-item-header">
                  <div class="ciclo-item-title" style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <button class="icon-btn" style="padding:0px 4px; font-size:10px; height:16px; color:var(--text-muted);" data-action="move-ciclo-seq" data-index="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button>
                      <button class="icon-btn" style="padding:0px 4px; font-size:10px; height:16px; color:var(--text-muted);" data-action="move-ciclo-seq" data-index="${i}" data-dir="1" ${i === plan.sequencia.length - 1 ? 'disabled' : ''}><i class="fa fa-chevron-down"></i></button>
                    </div>
                    <div style="cursor:pointer; display:flex; align-items:center; gap:6px;" data-action="open-ciclo-history" data-seq-id="${seq.id}" title="Ver Histórico de Sessões">${d.disc.icone || '📚'} <span style="text-decoration:underline;">${esc(d.disc.nome)}</span></div>
                  </div>
                  <div class="ciclo-item-meta" style="cursor:pointer; text-decoration:underline;" data-action="edit-ciclo-seq-hours" data-index="${i}" title="Clique para editar as horas planejadas">${formatH(seq.minutosAlvo)} planejado</div>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Etapa ${i + 1} da sequência global da semana</div>
                <div style="margin-top:8px;">
                   ${!seq.concluido
            ? `<button class="btn btn-primary btn-sm" data-action="iniciar-etapa-planejamento" data-seq-id="${seq.id}"><i class="fa fa-play"></i> Estudar Agora</button>`
            : `<span style="color:var(--green);font-size:12px;font-weight:600;"><i class="fa fa-check"></i> Etapa Concluída</span>`
          }
                </div>
              </div>
            </div>
          `;
      });
    }

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;color:var(--text-primary);"><i class="fa fa-calendar-alt"></i> Sua Grade Semanal</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" data-action="open-planejamento-wizard"><i class="fa fa-edit"></i> Editar Grade</button>
          <button class="btn btn-danger btn-sm" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover</button>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">
        <div>
          ${weeklyHtml || '<p>Nenhum dia de estudo planejado.</p>'}
        </div>
        <div class="card">
          <div class="card-header" style="padding-bottom:12px;border:none;">
            <h3 style="display:flex; align-items:center; gap:8px;"><i class="fa fa-list-ol" style="color:var(--text-muted);"></i> Sequência Gerada</h3>
          </div>
          <div class="card-body" style="padding-top:0;">
            <div class="ciclo-lista" style="max-height: 400px; overflow-y:auto; padding-right:8px;">
              ${sequenceHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted);">Sequência vazia.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

window.openCicloHistory = function (seqId) {
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
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
        <button class="btn btn-ghost" style="color:var(--orange); border: 1px solid var(--border);" data-action="desfazer-etapa" data-seq-id="${seqId}">
          <i class="fa fa-undo"></i> Desfazer 'Etapa Concluída' desta matéria
        </button>
      </div>
    `;
  }

  let htmlHistorico = '';
  if (eventosDisc.length === 0) {
    htmlHistorico = `<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size:14px;">Nenhuma sessão de estudo registrada ainda.</div>`;
  } else {
    htmlHistorico = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${eventosDisc.map(ev => {
      return `
            <div class="card" style="padding:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:14px; color:var(--text-primary); margin-bottom:4px;">
                  ${formatDate(ev.data)} ${ev.hora ? `às ${ev.hora}` : ''}
                </div>
                <div style="font-size:13px; color:var(--text-muted);">
                  📍 ${esc(ev.titulo)}
                </div>
                <div style="font-size:13px; color:var(--blue); font-weight:700; margin-top:2px;">
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
      <div style="padding:16px;">
        ${btnDesfazer}
        <h4 style="margin-bottom:12px; font-size:15px; color:var(--text-secondary);">Sessões Recentes (${eventosDisc.length})</h4>
        ${htmlHistorico}
      </div>
    `;
  }

  openModal('modal-ciclo-history');
};

// Global exports for Disc Dashboard
window.openDiscDashboard = openDiscDashboard;
window.closeDiscDashboard = closeDiscDashboard;
window.addEventoParaAssunto = addEventoParaAssunto;
window.setTheme = setTheme;

window.filtrarDropdownBanca = function (termo) {
  termo = termo.toLowerCase().trim();
  const select = document.getElementById('banca-disc-select');
  if (!select) return;
  Array.from(select.options).forEach(opt => {
    if (opt.value === '') return;
    const visible = opt.text.toLowerCase().includes(termo);
    opt.style.display = visible ? '' : 'none';
  });
};
