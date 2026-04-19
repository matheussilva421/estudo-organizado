/**
 * Calendar View Module
 * Renderiza calendário mensal, semanal e mobile
 */

import { state } from '../store.js?v=8.3';
import { esc, getEventStatus, todayStr } from '../utils.js?v=8.3';

// Exported state
let calDate = new Date();
let calViewMode = 'mes';

// Re-export for external access
export function getCalDate() { return calDate; }
export function getCalViewMode() { return calViewMode; }
export function setCalDate(d) { calDate = d; }
export function setCalViewMode(mode) {
  calViewMode = mode;
  if (typeof window.renderCurrentView === 'function') {
    window.renderCurrentView();
  }
}

// ── Helper: Check if mobile calendar should be used ──
function isMobileCalendar() {
  return window.innerWidth < 768;
}

// ── Helper: Update calendar header title ──
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

// ── Helper: Get date string from Date object ──
function getDateStr(d) {
  const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return d2.toISOString().split('T')[0];
}

// ── Helper: Pre-index events by date ──
function indexEventsByDate() {
  const eventsByDate = {};
  for (const e of state.eventos) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }
  return eventsByDate;
}

// ── Main Render Function ──
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
          <div class="cal-view-tabs ml-auto" role="tablist" aria-label="Visualizacao do calendario">
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

// ── Navigation Functions ──
export function resetCalDate() {
  calDate = new Date();
  if (typeof window.renderCurrentView === 'function') {
    window.renderCurrentView();
  }
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
      requestAnimationFrame(() => {
        const todayEl = grid.querySelector('.cal-mobile-day.today');
        if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    } else {
      grid.innerHTML = renderCalendarGrid();
    }
    updateCalendarHeader();
  } else {
    if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }
  }
}

// ── Month View (Desktop) ──
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

  const eventsByDate = indexEventsByDate();
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

// ── Month Grid Render (optimized for navigation) ──
export function renderCalendarGrid() {
  return renderCalendarMonth();
}

// ── Week View (Desktop) ──
export function renderCalendarWeek() {
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

  const eventsByDate = indexEventsByDate();

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">
      ${days.map(d => {
    const ds = getDateStr(d);
    const isToday = ds === today;
    const dayEvents = eventsByDate[ds] || [];
    return `
          <div style="min-height:200px;border-radius:8px;border:1px solid var(--border);overflow:hidden;">
            <div style="padding:8px;background:${isToday ? 'var(--accent-light)' : 'var(--bg)'};text-align:center;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);">${dows[d.getDay()]}</div>
              <div style="font-size:16px;font-weight:700;${isToday ? 'color:var(--blue);' : ''}">${d.getDate()}</div>
            </div>
            <div style="padding:6px;">
              ${dayEvents.map(e => {
      const st = getEventStatus(e);
      return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" style="margin-bottom:3px;" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
              <div style="text-align:center;margin-top:4px;">
                <button class="icon-btn" data-action="open-event-modal-date" data-date="${ds}" style="width:24px;height:24px;">+</button>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// ── Mobile Month View ──
export function renderCalendarMobileMonth() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const eventsByDate = indexEventsByDate();

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
      return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" style="white-space:normal;" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// ── Mobile Week View ──
export function renderCalendarMobileWeek() {
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

  const eventsByDate = indexEventsByDate();

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
      return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" style="white-space:normal;" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  html += '</div>';
  return html;
}

export default {
  renderCalendar,
  renderCalendarMonth,
  renderCalendarGrid,
  renderCalendarWeek,
  renderCalendarMobileMonth,
  renderCalendarMobileWeek,
  resetCalDate,
  calNavigate,
  updateCalendarHeader,
  getCalDate,
  setCalDate,
  getCalViewMode,
  setCalViewMode
};
