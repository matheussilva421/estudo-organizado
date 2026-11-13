import { useEffect, useState } from 'react';
import {
  type AvailabilityException,
  type PlanningAvailability,
  type Weekday,
} from '../../domain/planning-capacity';

const ORDER: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const LABELS: Record<Weekday, string> = {
  MON: 'Segunda',
  TUE: 'Terça',
  WED: 'Quarta',
  THU: 'Quinta',
  FRI: 'Sexta',
  SAT: 'Sábado',
  SUN: 'Domingo',
};

type DayDraft = { enabled: boolean; start: string; end: string };

function draftFrom(availability: PlanningAvailability): Record<Weekday, DayDraft> {
  const draft = {} as Record<Weekday, DayDraft>;
  for (const day of ORDER) {
    const window = availability.weekly.days[day]?.[0];
    draft[day] = {
      enabled: Boolean(window),
      start: window?.start ?? '08:00',
      end: window?.end ?? '11:00',
    };
  }
  return draft;
}

type Props = {
  availability: PlanningAvailability;
  revision: number | null;
  plannedMinutes: number;
  availableMinutes: number;
  globalPlannedMinutes: number;
  scenarioBudgets: Array<{
    id: string;
    label: string;
    minutes: number;
    status: string;
  }>;
  locked: boolean;
  onSave: (next: PlanningAvailability, expectedRevision: number | null) => Promise<void>;
  onNotice: (message: string | null) => void;
};

export function PlanningAvailabilityPanel({
  availability,
  revision,
  plannedMinutes,
  availableMinutes,
  globalPlannedMinutes,
  scenarioBudgets,
  locked,
  onSave,
  onNotice,
}: Props) {
  const [days, setDays] = useState(() => draftFrom(availability));
  const [weeklyGoal, setWeeklyGoal] = useState(
    String(availability.goals?.weeklyMinutes ?? 0),
  );
  const [exceptions, setExceptions] = useState<AvailabilityException[]>(
    availability.exceptions,
  );
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(draftFrom(availability));
    setWeeklyGoal(String(availability.goals?.weeklyMinutes ?? 0));
    setExceptions(availability.exceptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(availability)]);

  function addClosedDate(): void {
    if (!newDate) {
      onNotice('Escolha uma data para fechar.');
      return;
    }
    if (exceptions.some((item) => item.kind === 'DATE' && item.startDate === newDate)) {
      onNotice('Essa data já está fechada.');
      return;
    }
    setExceptions([
      ...exceptions,
      {
        exceptionId: `closed-${newDate}`,
        kind: 'DATE',
        startDate: newDate,
        closed: true,
        note: 'Dia fechado pelo usuário',
      },
    ]);
    setNewDate('');
    onNotice(null);
  }

  async function save(): Promise<void> {
    if (locked || saving) return;
    const nextDays: PlanningAvailability['weekly']['days'] = {};
    for (const day of ORDER) {
      const draft = days[day];
      if (!draft.enabled) continue;
      if (!draft.start || !draft.end || draft.start >= draft.end) {
        onNotice(`Horário inválido em ${LABELS[day]}: o início deve ser anterior ao fim.`);
        return;
      }
      // The editor exposes the first window; additional shifts are preserved
      // so saving the panel does not silently delete a second turn.
      nextDays[day] = [
        { start: draft.start, end: draft.end },
        ...(availability.weekly.days[day]?.slice(1) ?? []),
      ];
    }
    const goal = Number(weeklyGoal);
    if (!Number.isFinite(goal) || goal < 0) {
      onNotice('A meta semanal precisa ser um número não negativo.');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          zone: availability.zone,
          weekly: { timeZone: availability.zone, days: nextDays },
          exceptions,
          goals: { ...availability.goals, weeklyMinutes: goal },
        },
        revision,
      );
    } finally {
      setSaving(false);
    }
  }

  const progress =
    weeklyGoal && Number(weeklyGoal) > 0
      ? Math.min(100, Math.round((plannedMinutes / Number(weeklyGoal)) * 100))
      : null;
  const remainingMinutes = availableMinutes - globalPlannedMinutes;
  const overloadMinutes = Math.max(0, globalPlannedMinutes - availableMinutes);
  const plannedShare =
    availableMinutes > 0
      ? Math.round((globalPlannedMinutes / availableMinutes) * 100)
      : null;
  const meterFill =
    availableMinutes > 0
      ? Math.min(100, (globalPlannedMinutes / availableMinutes) * 100)
      : 0;
  const overloaded = overloadMinutes > 0;

  return (
    <section className="panel" aria-labelledby="availability-title" data-testid="planning-availability">
      <h3 id="availability-title">Disponibilidade e metas</h3>
      <p className="hint">
        Capacidade real usada pelo wizard, calendário e encaixe de revisões. Alterar
        aqui invalida prévias antigas; nada é gravado em blocos até confirmar.
      </p>
      <div className="planning-form">
        {ORDER.map((day) => (
          <fieldset key={day} className="settings-row" data-day={day}>
            <legend>{LABELS[day]}</legend>
            <label>
              <input
                type="checkbox"
                checked={days[day].enabled}
                disabled={locked}
                onChange={(event) =>
                  setDays((current) => ({
                    ...current,
                    [day]: { ...current[day], enabled: event.target.checked },
                  }))
                }
              />
              Ativo
            </label>
            <label>
              Abre
              <input
                type="time"
                aria-label={`Abre ${LABELS[day]}`}
                aria-invalid={
                  days[day].enabled && days[day].start >= days[day].end
                }
                value={days[day].start}
                disabled={locked || !days[day].enabled}
                onChange={(event) =>
                  setDays((current) => ({
                    ...current,
                    [day]: { ...current[day], start: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              Fecha
              <input
                type="time"
                aria-label={`Fecha ${LABELS[day]}`}
                aria-invalid={
                  days[day].enabled && days[day].start >= days[day].end
                }
                value={days[day].end}
                disabled={locked || !days[day].enabled}
                onChange={(event) =>
                  setDays((current) => ({
                    ...current,
                    [day]: { ...current[day], end: event.target.value },
                  }))
                }
              />
            </label>
          </fieldset>
        ))}
        <label>
          Meta semanal (min)
          <input
            type="number"
            min="0"
            value={weeklyGoal}
            disabled={locked}
            onChange={(event) => setWeeklyGoal(event.target.value)}
            data-testid="planning-weekly-goal"
          />
        </label>
      </div>
      <p data-testid="planning-goal-progress">
        Meta semanal: {Number(weeklyGoal) || 0} min · planejado nos próximos 7 dias:
        {' '}{plannedMinutes} min
        {progress === null ? ' · sem meta declarada' : ` · ${progress}%`}
      </p>
      <section className="capacity-diagnosis" data-testid="planning-capacity-comparison">
        <header>
          <strong>Capacidade comparada — próximos 7 dias</strong>
          <span data-testid="planning-capacity-share" data-overloaded={overloaded ? 'true' : 'false'}>
            {plannedShare === null
              ? 'Sem janela declarada'
              : overloaded
                ? `${plannedShare}% da janela · excesso de ${overloadMinutes} min`
                : `${plannedShare}% ocupado`}
          </span>
        </header>
        <div
          className={`capacity-meter${overloaded ? ' capacity-meter-overloaded' : ''}`}
          role="img"
          aria-label={
            availableMinutes > 0
              ? `Capacidade semanal: ${globalPlannedMinutes} de ${availableMinutes} min planejados; ${
                  overloaded
                    ? `excesso de ${overloadMinutes} min acima da janela`
                    : `${remainingMinutes} min livres`
                }`
              : 'Nenhuma capacidade declarada para os próximos sete dias'
          }
        >
          <span
            style={{
              width: `${meterFill}%`,
            }}
          />
        </div>
        <p data-testid="planning-capacity-balance">
          Janela disponível: {availableMinutes} min · planejado global: {globalPlannedMinutes} min ·
          {overloaded
            ? `excesso: ${overloadMinutes} min acima da janela`
            : `saldo: ${remainingMinutes} min`}
        </p>
        {scenarioBudgets.length > 0 ? (
          <ul className="capacity-scenarios">
            {scenarioBudgets.map((scenario) => (
              <li key={scenario.id}>
                <span>{scenario.label}</span>
                <span>{scenario.minutes} min · {scenario.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Nenhum cenário ativo reserva capacidade neste período.</p>
        )}
      </section>
      <div className="planning-actions">
        <label>
          Fechar um dia
          <input
            type="date"
            value={newDate}
            disabled={locked}
            onChange={(event) => setNewDate(event.target.value)}
          />
        </label>
        <button type="button" onClick={addClosedDate} disabled={locked}>
          Fechar dia
        </button>
      </div>
      {exceptions.length > 0 ? (
        <ul data-testid="planning-exceptions">
          {exceptions.map((exception) => (
            <li key={exception.exceptionId}>
              {exception.kind === 'DATE' ? 'Data' : 'Período'} {exception.startDate}
              {exception.endDate ? ` → ${exception.endDate}` : ''}
              {exception.closed ? ' · fechado' : ''}
              {exception.note ? ` · ${exception.note}` : ''}
              <button
                type="button"
                className="button-ghost"
                disabled={locked}
                onClick={() =>
                  setExceptions((current) =>
                    current.filter((item) => item.exceptionId !== exception.exceptionId),
                  )
                }
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nenhuma exceção declarada.</p>
      )}
      <div className="planning-actions">
        <button
          type="button"
          onClick={() => void save()}
          disabled={locked || saving}
          data-testid="planning-availability-save"
        >
          {saving ? 'Salvando…' : 'Gravar disponibilidade'}
        </button>
      </div>
    </section>
  );
}

