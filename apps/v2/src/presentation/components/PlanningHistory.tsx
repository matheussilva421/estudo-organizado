import type { PlanningCheckpointRecord } from '../../domain/planning-history';

type Props = {
  checkpoints: PlanningCheckpointRecord[];
  onRestore: (checkpointId: string) => void;
  locked: boolean;
};

export function PlanningHistory({ checkpoints, onRestore, locked }: Props) {
  return (
    <section className="panel" aria-labelledby="history-title" data-testid="planning-history">
      <h2 id="history-title">Checkpoints e histórico</h2>
      {checkpoints.length === 0 ? (
        <p className="empty-state">Nenhum checkpoint criado.</p>
      ) : (
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
      )}
    </section>
  );
}
