import { useState } from 'react';
import type { PlanningScenario } from '../../domain/planning';
import type {
  ExamDateChange,
  ExamDateChangePreview,
  TransitionPreview,
} from '../../domain/planning-final-stretch';

type Props = {
  scenario: PlanningScenario | null;
  examPreview: ExamDateChangePreview | null;
  transitionPreview: TransitionPreview | null;
  onPreviewExamChange: (change: ExamDateChange) => void;
  onConfirmExamChange: () => void;
  onCancelExamChange: () => void;
  onPreviewTransition: (examDate: string) => void;
  onConfirmTransition: () => void;
  onCancelTransition: () => void;
  onClose: (outcome: 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED') => void;
  locked: boolean;
};

export function FinalStretch({
  scenario,
  examPreview,
  transitionPreview,
  onPreviewExamChange,
  onConfirmExamChange,
  onCancelExamChange,
  onPreviewTransition,
  onConfirmTransition,
  onCancelTransition,
  onClose,
  locked,
}: Props) {
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
            onClick={() => onPreviewTransition(transitionDate)}
          >
            Propor Reta Final
          </button>
          {transitionPreview ? (
            <div data-testid="transition-preview">
              <p>
                Prévia: {transitionPreview.blocks.length} bloco(s) na nova Reta Final,{' '}
                {transitionPreview.preservedBlockIds.length} preservado(s),{' '}
                {transitionPreview.unallocatedBlockIds.length} não alocado(s). O Ciclo
                atual continua existindo.
              </p>
              {transitionPreview.warnings.length > 0 ? (
                <p className="planning-warning">
                  {transitionPreview.warnings.join(', ')}
                </p>
              ) : null}
              <button
                type="button"
                data-action="confirm-transition"
                onClick={onConfirmTransition}
                disabled={locked}
              >
                Confirmar Reta Final
              </button>
              <button type="button" onClick={onCancelTransition} disabled={locked}>
                Cancelar
              </button>
            </div>
          ) : null}
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
              onClick={() => onPreviewExamChange({ kind: 'POSTPONE', nextExamDate: nextDate })}
            >
              Adiar prova
            </button>
            <button
              type="button"
              data-action="suspend-final-stretch"
              disabled={locked}
              onClick={() => onPreviewExamChange({ kind: 'SUSPEND' })}
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
          {examPreview ? (
            <div data-testid="exam-change-preview">
              <p>
                Prévia: prova em {examPreview.newScenario.examDate ?? 'sem data'} ·{' '}
                {examPreview.affectedBlockIds.length} bloco(s) afetado(s) ·{' '}
                {examPreview.preservedBlockIds.length} preservado(s).
              </p>
              {examPreview.warnings.length > 0 ? (
                <p className="planning-warning">{examPreview.warnings.join(', ')}</p>
              ) : null}
              <button
                type="button"
                data-action="confirm-exam-change"
                onClick={onConfirmExamChange}
                disabled={locked}
              >
                Confirmar mudança
              </button>
              <button type="button" onClick={onCancelExamChange} disabled={locked}>
                Cancelar
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
