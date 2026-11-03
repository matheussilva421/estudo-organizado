import type { CalendarDay } from '../../application/planning-queries';
import { useEffect, useState } from 'react';

export type CalendarView = 'day' | 'week' | 'month';

type Props = {
  days: CalendarDay[];
  view: CalendarView;
  onView: (view: CalendarView) => void;
  focusId?: string | null;
};

export function PlanningCalendar({ days, view, onView, focusId = null }: Props) {
  const [offset, setOffset] = useState(0);
  const size = view === 'day' ? 1 : view === 'week' ? 7 : 30;
  const maxOffset = Math.max(0, days.length - size);
  const start = Math.min(offset, maxOffset);
  const visible = days.slice(start, start + size);

  useEffect(() => {
    if (!focusId) return;
    const index = days.findIndex((day) =>
      day.blocks.some((block) => block.id === focusId),
    );
    if (index < 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(Math.max(0, Math.min(index, maxOffset)));
  }, [focusId, days, maxOffset]);

  useEffect(() => {
    if (!focusId) return;
    const timer = window.setTimeout(() => {
      const element = document.querySelector('[data-entity-id="' + focusId + '"]');
      if (!(element instanceof HTMLElement)) return;
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusId, start, visible.length]);
  return (
    <section className="panel" aria-labelledby="calendar-title" data-testid="planning-calendar">
      <h2 id="calendar-title">Calendário</h2>
      <div role="group" aria-label="Escopo do calendário" className="planning-views">
        {(['day', 'week', 'month'] as CalendarView[]).map((option) => (
          <button
            key={option}
            type="button"
            data-action={`calendar-${option}`}
            aria-pressed={view === option}
            onClick={() => onView(option)}
          >
            {option === 'day' ? 'Dia' : option === 'week' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
      <div className="planning-actions">
        <button
          type="button"
          data-action="calendar-previous"
          disabled={start === 0}
          onClick={() => setOffset(Math.max(0, start - size))}
        >
          Anterior
        </button>
        <button
          type="button"
          data-action="calendar-next"
          disabled={start + size >= days.length}
          onClick={() => setOffset(Math.min(maxOffset, start + size))}
        >
          Próximo
        </button>
        <span data-testid="calendar-window">
          {visible[0]?.civilDate} → {visible[visible.length - 1]?.civilDate}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="empty-state">Nenhum dia no intervalo selecionado.</p>
      ) : (
        <ul className="planning-calendar-days" data-days={visible.length}>
          {visible.map((day) => (
            <li key={day.civilDate} data-date={day.civilDate}>
              <strong>{day.civilDate}</strong>
              <span>
                {day.reservedMinutes}/{day.availableMinutes} min
              </span>
              {day.unallocatedIds.length > 0 ? (
                <span className="planning-warning">
                  {day.unallocatedIds.length} não alocado(s)
                </span>
              ) : null}
              <ul>
                {day.blocks.map((block) => (
                  <li key={block.id} data-allocation={block.allocation} data-entity-id={block.id}>
                    {block.label ?? block.editalDisciplineId} · {block.plannedMinutes} min
                    {block.civilDate ? ` · ${block.civilDate}` : ''}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
