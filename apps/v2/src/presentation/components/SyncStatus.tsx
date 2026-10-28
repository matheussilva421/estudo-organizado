import type { SyncHealth } from '../../application/sync-types';
import { syncStatusLabel } from '../ui-state';

type SyncStatusProps = {
  health: SyncHealth;
};

export function SyncStatus({ health }: SyncStatusProps) {
  return (
    <section className="sync-status" aria-label="Estado da sincronização">
      <p role="status" className="sync-label">
        {syncStatusLabel(health)}
      </p>
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
