/**
 * Calendar Day Panel Module
 * Renders the selected-day panel with event list and add-session button.
 */
import { state } from '../../store.js?v=8.37';
import { esc, getEventStatus } from '../../utils.js?v=8.37';
import { filterEventsBySelectedEdital } from '../../edital-filter.js?v=8.37';
import { getVisibleSlotOverridesByDate } from './calendar-events.js?v=8.37';

export function renderSelectedDayPanel(selectedDayStr) {
  const events = [
    ...filterEventsBySelectedEdital(state.eventos || [], { allowAll: false }).filter(
      (event) => event.data === selectedDayStr
    ),
    ...(getVisibleSlotOverridesByDate()[selectedDayStr] || []),
  ]
    .sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
  return `
    <div class="cal-day-panel" data-testid="calendar-day-panel">
      <div class="cal-day-panel-header">
        <div>
          <div class="section-label">Dia selecionado</div>
          <h3>${selectedDayStr.split('-').reverse().join('/')}</h3>
        </div>
        <button type="button" class="btn btn-primary btn-sm cal-day-add" data-action="open-event-modal-date" data-date="${selectedDayStr}">
          <i class="fa fa-plus"></i> Adicionar sessão
        </button>
      </div>
      ${
        events.length === 0
          ? '<div class="cal-day-empty">Nada agendado para este dia.</div>'
          : `<div class="cal-day-event-list">
              ${events
                .map(
                  (event) => `
                    <button type="button" class="cal-day-event" data-testid="calendar-day-panel-event" ${
                      event.isSlotOverride
                        ? 'disabled'
                        : `data-action="open-event-detail" data-event-id="${esc(event.id)}"`
                    }>
                      <span>${esc(event.titulo || 'Evento')}</span>
                      <small>${getEventStatus(event)}</small>
                    </button>`
                )
                .join('')}
            </div>`
      }
    </div>
  `;
}
