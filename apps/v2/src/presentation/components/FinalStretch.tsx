import { useState } from 'react';
import type { PlanningScenario } from '../../domain/planning';
import type { ExamDateChange } from '../../domain/planning-final-stretch';

type Props = {
  scenario: PlanningScenario | null;
  onChangeExamDate: (change: ExamDateChange) => void;
  onTransition: (examDate: string) => void;
  onClose: (outcome: 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED') => void;
  locked: boolean;
};

export function FinalStretch({ scenario, onChangeExamDate, onTransition, onClose, locked }: Props) {
  const [nextDate, setNextDate] = useState('');
  const [transitionDate, setTransitionDate] = useState('');
  const [closeOutcome, setCloseOutcome] = useState<'' | 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED'>('');
  const isFinalStretch = scenario?.kind === 'FINAL_STRETCH';
  const isCycle = scenario?.kind === 'CYCLE';

  return (
    <section className="panel" aria-labelledby="final-stretch-title" data-testid="final-stretch">
      <h2 id="final-stretch-title">Reta Final</h2>
      {isCycle ? (
        <div data-testid="cycle-transition">
          <p>
            Transição assistida: confirmar a data cria uma Reta Final preservando o Ciclo atual.
          </p>
          <label>
            Data da prova
            <input
              type="date"
              value={transitionDate}
              onChange={(event) => setTransitionDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            data-action="preview-transition"
            disabled={locked || !transitionDate}
            onClick={() => onTransition(transitionDate)}
          >
            Propor Reta Final
          </button>
        </div>
      ) : !isFinalStretch ? (
        <p className="empty-state">Selecione um cenário do Ciclo ou de Reta Final.</p>
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
            <button
              type="button"
              data-action="close-final-stretch"
              disabled={locked || closeOutcome === ''}
              onClick={() => closeOutcome && onClose(closeOutcome)}
            >
              Encerrar Reta Final
            </button>
            <label>
              Desfecho
              <select
                value={closeOutcome}
                onChange={(event) =>
                  setCloseOutcome(event.target.value as '' | 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED')
                }
              >
                <option value="">Escolha o desfecho</option>
                <option value="OCCURRED">Prova ocorreu</option>
                <option value="RESCHEDULED">Prova remarcada</option>
                <option value="UNDEFINED">Indefinida</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
