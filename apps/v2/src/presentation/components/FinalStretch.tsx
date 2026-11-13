import { useState } from 'react';
import type { PlanningScenario } from '../../domain/planning';
import type {
  ExamDateChange,
  ExamDateChangePreview,
  FinalStretchClosing,
  TransitionPreview,
} from '../../domain/planning-final-stretch';

type Props = {
  scenario: PlanningScenario | null;
  examPreview: ExamDateChangePreview | null;
  transitionPreview: TransitionPreview | null;
  closePreview: FinalStretchClosing | null;
  onPreviewExamChange: (change: ExamDateChange) => void;
  onConfirmExamChange: () => void;
  onCancelExamChange: () => void;
  onPreviewTransition: (examDate: string) => void;
  onConfirmTransition: () => void;
  onCancelTransition: () => void;
  onPreviewClose: (outcome: 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED') => void;
  onConfirmClose: () => void;
  onCancelClose: () => void;
  locked: boolean;
};

export function FinalStretch({
  scenario,
  examPreview,
  transitionPreview,
  closePreview,
  onPreviewExamChange,
  onConfirmExamChange,
  onCancelExamChange,
  onPreviewTransition,
  onConfirmTransition,
  onCancelTransition,
  onPreviewClose,
  onConfirmClose,
  onCancelClose,
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
              disabled={locked || Boolean(transitionPreview)}
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
            <div data-testid="transition-preview" role="status" aria-live="polite">
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
            <input
              type="date"
              value={nextDate}
              disabled={locked || Boolean(examPreview)}
              onChange={(event) => setNextDate(event.target.value)}
            />
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
              disabled={locked || closeOutcome === '' || Boolean(closePreview)}
              onClick={() => closeOutcome && onPreviewClose(closeOutcome)}
            >
              Revisar encerramento
            </button>
            <label>
              Desfecho
              <select
                value={closeOutcome}
                disabled={locked || Boolean(closePreview)}
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
          {closePreview ? (
            <div
              className="planning-preview"
              data-testid="final-stretch-close-preview"
              role="status"
              aria-live="polite"
            >
              <p>
                Prévia: encerrar com desfecho <strong>{closePreview.outcome}</strong> em{' '}
                {closePreview.closedAt}. A Reta Final ficará CLOSED e será preservada no
                histórico; nenhum bloco será apagado. Nada foi gravado.
              </p>
              <div className="planning-actions">
                <button
                  type="button"
                  data-action="confirm-close-final-stretch"
                  onClick={onConfirmClose}
                  disabled={locked}
                >
                  Confirmar encerramento
                </button>
                <button type="button" onClick={onCancelClose} disabled={locked}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          {examPreview ? (
            <div data-testid="exam-change-preview" role="status" aria-live="polite">
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
