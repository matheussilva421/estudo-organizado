import { useEffect, useRef, useState } from 'react';
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

const OUTCOME_LABEL: Record<'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED', string> = {
  OCCURRED: 'Prova ocorreu',
  RESCHEDULED: 'Prova remarcada',
  UNDEFINED: 'Desfecho indefinido',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'rascunho',
  ACTIVE: 'ativa',
  INACTIVE: 'inativa',
  SUSPENDED: 'suspensa',
  CLOSED: 'encerrada',
  ARCHIVED: 'arquivada',
};

function formatClosedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

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
  const closeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (closePreview) closeHeadingRef.current?.focus();
  }, [closePreview]);

  function cancelClose(): void {
    onCancelClose();
    requestAnimationFrame(() => closeTriggerRef.current?.focus());
  }

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
            <div data-testid="transition-preview" role="group" aria-label="Prévia da transição para Reta Final">
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
            Prova: <strong>{scenario.examDate ?? 'não definida'}</strong> · situação{' '}
            {STATUS_LABEL[scenario.status] ?? 'desconhecida'}
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
              ref={closeTriggerRef}
              type="button"
              data-action="close-final-stretch"
              aria-expanded={closePreview ? 'true' : 'false'}
              aria-controls={closePreview ? 'final-stretch-close-preview' : undefined}
              disabled={locked || closeOutcome === ''}
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
              id="final-stretch-close-preview"
              data-testid="final-stretch-close-preview"
              role="group"
              aria-labelledby="final-stretch-close-title"
            >
              <h3 id="final-stretch-close-title" ref={closeHeadingRef} tabIndex={-1}>
                Confirmar encerramento da Reta Final
              </h3>
              <p>
                Desfecho <strong>{OUTCOME_LABEL[closePreview.outcome]}</strong>, encerrada em{' '}
                {formatClosedAt(closePreview.closedAt)}. A Reta Final ficará como{' '}
                <strong>encerrada</strong> e será preservada no histórico; nenhum bloco será
                apagado. Nada foi gravado até a confirmação.
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
                <button type="button" onClick={cancelClose} disabled={locked}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          {examPreview ? (
            <div data-testid="exam-change-preview" role="group" aria-label="Prévia da mudança de data da prova">
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
