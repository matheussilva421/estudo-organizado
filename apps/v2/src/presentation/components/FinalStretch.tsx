import { useState } from 'react';
import type { PlanningScenario } from '../../domain/planning';
import type { ExamDateChange } from '../../domain/planning-final-stretch';

type Props = {
  scenario: PlanningScenario | null;
  onChangeExamDate: (change: ExamDateChange) => void;
  locked: boolean;
};

export function FinalStretch({ scenario, onChangeExamDate, locked }: Props) {
  const [nextDate, setNextDate] = useState('');
  const isFinalStretch = scenario?.kind === 'FINAL_STRETCH';

  return (
    <section className="panel" aria-labelledby="final-stretch-title" data-testid="final-stretch">
      <h2 id="final-stretch-title">Reta Final</h2>
      {!isFinalStretch ? (
        <p className="empty-state">Selecione um cenário de Reta Final (com data de prova).</p>
      ) : (
        <div data-exam-date={scenario.examDate ?? ''} data-status={scenario.status}>
          <p>
            Prova: <strong>{scenario.examDate ?? 'não definida'}</strong> · status {scenario.status}
          </p>
          <label>
            Nova data
            <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
          </label>
          <div className="planning-actions">
            <button
              type="button"
              data-action="postpone-exam"
              disabled={locked || !nextDate}
              onClick={() => onChangeExamDate({ kind: 'POSTPONE', nextExamDate: nextDate })}
            >
              Adiar prova
            </button>
            <button
              type="button"
              data-action="suspend-final-stretch"
              disabled={locked}
              onClick={() => onChangeExamDate({ kind: 'SUSPEND' })}
            >
              Suspender
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
