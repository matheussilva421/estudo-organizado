import type { PersistedConflict } from '../../platform/indexeddb';

export type SyncConflictChoice = 'LOCAL' | 'REMOTE';

type Props = {
  conflicts: readonly PersistedConflict[];
  busyId?: string | null;
  onResolve: (conflict: PersistedConflict, choice: SyncConflictChoice) => void;
};

function summary(conflict: PersistedConflict): string {
  const remote = conflict.deleted ? 'excluído no remoto' : 'alterado no remoto';
  return `${conflict.entityType} ${conflict.entityId} — ${remote} (revisão ${conflict.remoteRevision})`;
}

/**
 * Remote conflicts keep both versions until the user decides. Choosing local
 * re-sends the local version against the exact remote revision; choosing
 * remote applies the stored remote payload locally.
 */
export function SyncConflictsPanel({ conflicts, busyId, onResolve }: Props) {
  if (conflicts.length === 0) return null;
  return (
    <section className="google-link" aria-labelledby="sync-conflicts-title" data-sync-conflicts>
      <h4 id="sync-conflicts-title">Conflitos de sincronização</h4>
      <p className="muted">
        Nenhuma versão foi sobrescrita. Escolha local ou remoto para cada item; as demais
        operações da mesma entidade ficam bloqueadas até essa decisão.
      </p>
      <ul className="warning-list">
        {conflicts.map((conflict) => (
          <li key={conflict.conflictId}>
            <strong>{summary(conflict)}</strong>
            <div className="button-row">
              <button
                type="button"
                className="button-primary"
                disabled={busyId === conflict.conflictId}
                onClick={() => onResolve(conflict, 'LOCAL')}
              >
                Manter versão local
              </button>
              <button
                type="button"
                className="button-ghost"
                disabled={busyId === conflict.conflictId}
                onClick={() => onResolve(conflict, 'REMOTE')}
              >
                Usar versão remota
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
