import type { SyncHealth } from '../../application/sync-types';
import {
  semanticStateLabel,
  syncStatusLabel,
  type SemanticState,
} from '../ui-state';

type SyncStatusProps = {
  health: SyncHealth;
};

export function SyncStatus({ health }: SyncStatusProps) {
  const state: SemanticState = !health.localCommitted
    ? 'EMPTY'
    : health.pendingCount > 0
      ? 'PENDING'
      : 'LOCAL_COMMITTED';
  return (
    <section
      className="sync-status"
      aria-label="Estado da sincronização"
      data-semantic-state={state}
    >
      <p role="status" className="sync-label">
        {syncStatusLabel(health)}
      </p>
      <p className="sr-only">{semanticStateLabel(state)}</p>
      <dl className="sync-confirmations">
        <div>
          <dt>Local</dt>
          <dd>{health.localCommitted ? 'confirmado' : 'sem dados'}</dd>
        </div>
        <div>
          <dt>Remoto</dt>
          <dd>{health.remoteCommitted ? 'confirmado' : 'não enviado'}</dd>
        </div>
        <div>
          <dt>Convergência</dt>
          <dd>{health.converged ? 'verificada' : 'não verificada'}</dd>
        </div>
      </dl>
    </section>
  );
}
