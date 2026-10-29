import type { CalendarDay } from '../../application/planning-queries';

export type CalendarView = 'day' | 'week' | 'month';

type Props = {
  days: CalendarDay[];
  view: CalendarView;
  onView: (view: CalendarView) => void;
};

export function PlanningCalendar({ days, view, onView }: Props) {
  const visible = view === 'day' ? days.slice(0, 1) : view === 'week' ? days.slice(0, 7) : days;
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
                  <li key={block.id} data-allocation={block.allocation}>
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
