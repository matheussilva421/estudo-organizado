import { useEffect, useRef, useState } from 'react';
import type { PlanningCheckpointRecord } from '../../domain/planning-history';

type Props = {
  checkpoints: PlanningCheckpointRecord[];
  currentRevision: number;
  currentBlockCount: number;
  onRestore: (checkpointId: string) => Promise<void> | void;
  locked: boolean;
};

const KIND_LABEL: Record<PlanningCheckpointRecord['kind'], string> = {
  MANUAL: 'Checkpoint manual',
  AUTO: 'Checkpoint automático',
};

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function signed(value: number): string {
  return (value >= 0 ? '+' : '') + value;
}

export function PlanningHistory({
  checkpoints,
  currentRevision,
  currentBlockCount,
  onRestore,
  locked,
}: Props) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const target = checkpoints.find((item) => item.checkpointId === targetId) ?? null;
  const ordered = [...checkpoints].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const revisionDelta = target ? target.manifest.scenarioRevision - currentRevision : 0;
  const blockDelta = target ? target.manifest.blockCount - currentBlockCount : 0;

  useEffect(() => {
    if (target) headingRef.current?.focus();
  }, [target]);

  function close(): void {
    setTargetId(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  async function confirm(): Promise<void> {
    if (!target || busy) return;
    setBusy(true);
    try {
      await onRestore(target.checkpointId);
    } finally {
      setBusy(false);
      setTargetId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="history-title" data-testid="planning-history">
      <h2 id="history-title">Checkpoints e histórico</h2>
      {checkpoints.length === 0 ? (
        <p className="empty-state">Nenhum checkpoint criado.</p>
      ) : (
        <>
          {target ? (
            <section
              className="history-comparison"
              data-testid="planning-history-comparison"
              role="group"
              aria-labelledby="history-compare-title"
            >
              <header>
                <strong id="history-compare-title" ref={headingRef} tabIndex={-1}>
                  Confirmar restauração do checkpoint selecionado
                </strong>
                <span>
                  revisão {signed(revisionDelta)} · blocos {signed(blockDelta)}
                </span>
              </header>
              <div className="history-comparison-grid">
                <article>
                  <span className="eyebrow">Checkpoint alvo</span>
                  <strong>
                    {KIND_LABEL[target.kind]} · rev {target.manifest.scenarioRevision}
                  </strong>
                  <span>{target.manifest.blockCount} bloco(s)</span>
                  <span>{formatWhen(target.createdAt)}</span>
                  <code>{target.manifest.digest.slice(0, 12)}</code>
                </article>
                <article>
                  <span className="eyebrow">Revisão atual</span>
                  <strong>Cenário em edição · rev {currentRevision}</strong>
                  <span>{currentBlockCount} bloco(s)</span>
                  <span>Estado que será compensado</span>
                  <code>não sobrescrito</code>
                </article>
              </div>
              <p className="hint">
                O alvo comparado é exatamente o checkpoint que será restaurado. Restaurar cria
                uma compensação sobre a revisão atual; não apaga o journal nem checkpoints.
              </p>
              <div className="planning-actions">
                <button
                  type="button"
                  data-action="confirm-restore-checkpoint"
                  onClick={() => void confirm()}
                  disabled={locked || busy}
                >
                  {busy ? 'Restaurando…' : 'Confirmar restauração'}
                </button>
                <button type="button" onClick={close} disabled={locked || busy}>
                  Cancelar
                </button>
              </div>
            </section>
          ) : (
            <p className="hint">
              Escolha um checkpoint para comparar com a revisão atual antes de restaurar.
            </p>
          )}
          <ul>
            {ordered.map((checkpoint) => (
              <li key={checkpoint.checkpointId} data-checkpoint={checkpoint.checkpointId}>
                <span>{KIND_LABEL[checkpoint.kind]}</span>
                <span> · rev {checkpoint.manifest.scenarioRevision}</span>
                <span> · {checkpoint.manifest.blockCount} bloco(s)</span>
                <span> · {formatWhen(checkpoint.createdAt)}</span>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={checkpoint.checkpointId === targetId ? 'true' : undefined}
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget;
                    setTargetId(checkpoint.checkpointId);
                  }}
                >
                  Comparar e restaurar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

