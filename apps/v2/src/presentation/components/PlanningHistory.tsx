import type { PlanningCheckpointRecord } from '../../domain/planning-history';

type Props = {
  checkpoints: PlanningCheckpointRecord[];
  onRestore: (checkpointId: string) => void;
  locked: boolean;
};

export function PlanningHistory({ checkpoints, onRestore, locked }: Props) {
  const [latest, previous] = [...checkpoints]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 2);
  const revisionDelta =
    latest && previous
      ? latest.manifest.scenarioRevision - previous.manifest.scenarioRevision
      : 0;
  const blockDelta =
    latest && previous ? latest.manifest.blockCount - previous.manifest.blockCount : 0;

  return (
    <section className="panel" aria-labelledby="history-title" data-testid="planning-history">
      <h2 id="history-title">Checkpoints e histórico</h2>
      {checkpoints.length === 0 ? (
        <p className="empty-state">Nenhum checkpoint criado.</p>
      ) : (
        <>
        {latest && previous ? (
          <section className="history-comparison" data-testid="planning-history-comparison">
            <header>
              <strong>Comparação antes de restaurar</strong>
              <span>
                revisão {revisionDelta >= 0 ? '+' : ''}{revisionDelta} · blocos{' '}
                {blockDelta >= 0 ? '+' : ''}{blockDelta}
              </span>
            </header>
            <div className="history-comparison-grid">
              {[latest, previous].map((checkpoint, index) => (
                <article key={checkpoint.checkpointId}>
                  <span className="eyebrow">
                    {index === 0 ? 'Mais recente' : 'Anterior'}
                  </span>
                  <strong>{checkpoint.kind} · rev {checkpoint.manifest.scenarioRevision}</strong>
                  <span>{checkpoint.manifest.blockCount} blocos</span>
                  <span>{checkpoint.createdAt}</span>
                  <code>{checkpoint.manifest.digest.slice(0, 12)}</code>
                </article>
              ))}
            </div>
            <p className="hint">
              Restaurar cria uma compensação sobre a revisão atual; não apaga o journal.
            </p>
          </section>
        ) : null}
        <ul>
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.checkpointId} data-checkpoint={checkpoint.checkpointId}>
              <span>{checkpoint.kind}</span>
              <span> rev {checkpoint.manifest.scenarioRevision}</span>
              <span> · {checkpoint.manifest.blockCount} blocos</span>
              <button type="button" disabled={locked} onClick={() => onRestore(checkpoint.checkpointId)}>
                Restaurar
              </button>
            </li>
          ))}
        </ul>
        </>
      )}
    </section>
  );
}
