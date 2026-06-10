/**
 * Calendar View Module (Orchestrator)
 * Coordinates calendar state, events, day-panel, and rendering.
 */
import { state } from '../store.js?v=8.37';
import { addCleanupListener, esc, getEventStatus, todayStr } from '../utils.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';

import {
  getCalDate,
  getCalViewMode,
  getSelectedDayStr,
  setCalDate,
  setCalViewMode,
  setSelectedCalendarDay,
  isMobileCalendar,
  updateCalendarHeader,
  resetCalDate,
} from './calendar/calendar-state.js?v=8.37';

import { getDiscColor, resetDiscColorMemo, indexEventsByDate } from './calendar/calendar-events.js?v=8.37';

import { renderSelectedDayPanel } from './calendar/calendar-day-panel.js?v=8.37';

// ── Re-exports from sub-modules ──
export {
  getCalDate,
  getCalViewMode,
  getSelectedDayStr,
  setCalDate,
  setCalViewMode,
  setSelectedCalendarDay,
  isMobileCalendar,
  updateCalendarHeader,
  resetCalDate,
} from './calendar/calendar-state.js?v=8.37';

export { getDiscColor, resetDiscColorMemo, indexEventsByDate } from './calendar/calendar-events.js?v=8.37';

export { renderSelectedDayPanel } from './calendar/calendar-day-panel.js?v=8.37';

// ── Helper: Get date string from Date object ──
function getDateStr(d) {
  const d2 = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return d2.toISOString().split('T')[0];
}

// ── Navigation ──
export function calNavigate(dir) {
  const calViewMode = getCalViewMode();
  const calDate = getCalDate();
  if (calViewMode === 'mes') {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1));
  } else {
    calDate.setDate(calDate.getDate() + dir * 7);
    setCalDate(calDate);
  }
  // Optimized: update only calendar grid instead of full re-render
  const grid = document.getElementById('cal-grid');
  if (grid) {
    const mobile = isMobileCalendar();
    if (mobile) {
      grid.innerHTML =
        calViewMode === 'mes' ? renderCalendarMobileMonth() : renderCalendarMobileWeek();
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

// ── Main Render ──
export function renderCalendar(el) {
  const mobile = isMobileCalendar();
  const calViewMode = getCalViewMode();
  const calDate = getCalDate();
  let gridContent;
  if (mobile) {
    gridContent = calViewMode === 'mes' ? renderCalendarMobileMonth() : renderCalendarMobileWeek();
  } else {
    gridContent = calViewMode === 'mes' ? renderCalendarGrid() : renderCalendarWeek();
  }
  el.innerHTML = `
    <div class="card calendar-shell-card">
      <div class="card-body">
        <div class="cal-header">
          <div class="cal-nav">
            <button aria-label="Mês anterior" data-action="cal-navigate" data-dir="-1"><i class="fa fa-chevron-left"></i></button>
            <button aria-label="Próximo mês" data-action="cal-navigate" data-dir="1"><i class="fa fa-chevron-right"></i></button>
          </div>
          <div class="cal-title" id="cal-title">${calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}</div>
          <button class="btn btn-ghost btn-sm" id="cal-today-btn" data-action="cal-today">Hoje</button>
          <div class="cal-view-tabs ml-auto" role="tablist" aria-label="Visualizacao do calendario">
            <button type="button" class="cal-view-tab ${calViewMode === 'mes' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="mes" role="tab" aria-selected="${calViewMode === 'mes'}" aria-controls="cal-grid">Mês</button>
            <button type="button" class="cal-view-tab ${calViewMode === 'semana' ? 'active' : ''}" data-action="set-cal-view-mode" data-mode="semana" role="tab" aria-selected="${calViewMode === 'semana'}" aria-controls="cal-grid">Semana</button>
          </div>
          <button type="button" class="btn btn-ghost btn-sm cal-clear-btn" data-action="clear-ciclo-events" title="Apaga eventos auto-gerados pelo Ciclo de Estudos que ainda não começaram. Eventos manuais e com tempo registrado são preservados.">
            <i class="fa fa-broom"></i> Limpar agendados
          </button>
        </div>
        <div id="cal-grid">${gridContent}</div>
        ${renderSelectedDayPanel(getSelectedDayStr())}
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

// ── Month View (Desktop) ──
export function renderCalendarMonth() {
  const calDate = getCalDate();
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const startDow = (firstDay.getDay() - (state.config.primeirodiaSemana ?? 1) + 7) % 7;
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana ?? 1;
  const dowOrder = Array.from({ length: 7 }, (_, i) => dows[(startDow0 + i) % 7]);

  const cells = [];
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
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      other: true,
    });
  }

  const eventsByDate = indexEventsByDate();
  const gridClass = cells.length > 35 ? 'cal-grid rows-6' : 'cal-grid';

  // Roving tabindex: um único ponto de entrada por Tab (hoje, ou o 1º dia do
  // mês corrente); as setas movem o foco entre as células.
  const todayVisible = cells.some((c) => getDateStr(c.date) === today);
  const firstCurrent = cells.find((c) => !c.other) || cells[0];
  const focusDs = todayVisible ? today : getDateStr(firstCurrent.date);

  return `
    <div class="${gridClass}">
      ${dowOrder.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells
        .map((cell) => {
          const ds = getDateStr(cell.date);
          const isToday = ds === today;
          const dayEvents = eventsByDate[ds] || [];
          const show = dayEvents.slice(0, 3);
          const more = dayEvents.length - 3;
          const moreTitle =
            more > 0
              ? esc(
                  dayEvents
                    .slice(3)
                    .map((e) => `• ${e.titulo}`)
                    .join('\n')
                )
              : '';
          return `
          <div class="cal-cell ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-action="select-calendar-day" data-date="${ds}" role="button" tabindex="${ds === focusDs ? '0' : '-1'}" aria-label="${cell.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${dayEvents.length > 0 ? `, ${dayEvents.length} evento(s)` : ''}">
            <div class="cal-date">${cell.date.getDate()}</div>
            <button type="button" class="cal-day-add-inline" data-action="open-event-modal-date" data-date="${ds}" aria-label="Adicionar sessao em ${ds}" title="Adicionar sessao">+</button>
            ${show
              .map((e) => {
                const st = getEventStatus(e);
                const cor = getDiscColor(e.discId);
                const styleAttr = cor ? ` style="border-left:3px solid ${esc(cor)};"` : '';
                return `<button type="button" class="cal-event-chip ${st}"${styleAttr} data-action="open-event-detail" data-event-id="${e.id}" title="${esc(e.titulo)}">${esc(e.titulo)}</button>`;
              })
              .join('')}
            ${more > 0 ? `<button type="button" class="cal-more" data-action="select-calendar-day" data-date="${ds}" title="${moreTitle}">+${more} mais</button>` : ''}
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

// ── Month Grid Render (optimized for navigation) ──
export function renderCalendarGrid() {
  return renderCalendarMonth();
}

// ── Keyboard navigation entre células do grid mensal (roving tabindex) ──
export function handleCalGridKeydown(event) {
  const cell = event.target?.closest?.('.cal-cell');
  if (!cell) return;
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const delta = moves[event.key];
  if (!delta) return;
  const cells = [...document.querySelectorAll('.cal-grid .cal-cell')];
  const idx = cells.indexOf(cell);
  if (idx === -1) return;
  const next = cells[idx + delta];
  if (!next) return;
  event.preventDefault();
  cell.setAttribute('tabindex', '-1');
  next.setAttribute('tabindex', '0');
  next.focus();
}

addCleanupListener(document, 'keydown', handleCalGridKeydown);

// ── Week View (Desktop) ──
export function renderCalendarWeek() {
  const calDate = getCalDate();
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana ?? 1) + 7) % 7;
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
      ${days
        .map((d) => {
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
              ${dayEvents
                .map((e) => {
                  const st = getEventStatus(e);
                  const cor = getDiscColor(e.discId);
                  const borderStyle = cor ? `border-left:3px solid ${esc(cor)};` : '';
                  return `<button type="button" class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" style="margin-bottom:3px;${borderStyle}" title="${esc(e.titulo)}">${esc(e.titulo)}</button>`;
                })
                .join('')}
              <div style="text-align:center;margin-top:4px;">
                <button class="icon-btn" data-action="open-event-modal-date" data-date="${ds}" aria-label="Adicionar sessao em ${ds}" title="Adicionar sessao" style="width:24px;height:24px;">+</button>
              </div>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

// ── Mobile Month View ──
export function renderCalendarMobileMonth() {
  const calDate = getCalDate();
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
      <div class="cal-mobile-day ${isToday ? 'today' : ''} ${dayEvents.length === 0 ? 'empty' : ''}" data-action="select-calendar-day" data-date="${ds}" role="button" tabindex="0" aria-label="${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${dayEvents.length > 0 ? `, ${dayEvents.length} evento(s)` : ', sem eventos'}">
        <div class="cal-mobile-day-header">
          <div class="cal-mobile-date ${isToday ? 'today' : ''}">${d}</div>
          <div class="cal-mobile-dow">${dowName}</div>
          ${dayEvents.length === 0 ? '<span class="cal-mobile-empty">Sem eventos</span>' : ''}
        </div>
        ${
          dayEvents.length > 0
            ? `
          <div class="cal-mobile-events">
            ${dayEvents
              .map((e) => {
                const st = getEventStatus(e);
                const cor = getDiscColor(e.discId);
                const borderStyle = cor ? `border-left:3px solid ${esc(cor)};` : '';
                return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" role="button" tabindex="0" style="white-space:normal;${borderStyle}" title="${esc(e.titulo)}" aria-label="Abrir evento ${esc(e.titulo)}">${esc(e.titulo)}</div>`;
              })
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// ── Mobile Week View ──
export function renderCalendarMobileWeek() {
  const calDate = getCalDate();
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana ?? 1) + 7) % 7;
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
      <div class="cal-mobile-day ${isToday ? 'today' : ''} ${dayEvents.length === 0 ? 'empty' : ''}" data-action="select-calendar-day" data-date="${ds}" role="button" tabindex="0" aria-label="${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${dayEvents.length > 0 ? `, ${dayEvents.length} evento(s)` : ', sem eventos'}">
        <div class="cal-mobile-day-header">
          <div class="cal-mobile-date ${isToday ? 'today' : ''}">${d.getDate()}</div>
          <div class="cal-mobile-dow">${dowName}</div>
          ${dayEvents.length === 0 ? '<span class="cal-mobile-empty">Sem eventos</span>' : ''}
        </div>
        ${
          dayEvents.length > 0
            ? `
          <div class="cal-mobile-events">
            ${dayEvents
              .map((e) => {
                const st = getEventStatus(e);
                const cor = getDiscColor(e.discId);
                const borderStyle = cor ? `border-left:3px solid ${esc(cor)};` : '';
                return `<div class="cal-event-chip ${st}" data-action="open-event-detail" data-event-id="${e.id}" role="button" tabindex="0" style="white-space:normal;${borderStyle}" title="${esc(e.titulo)}" aria-label="Abrir evento ${esc(e.titulo)}">${esc(e.titulo)}</div>`;
              })
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }
  html += '</div>';
  return html;
}
