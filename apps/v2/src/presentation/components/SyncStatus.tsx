import type { SyncHealth } from '../../application/sync-types';
import {
  semanticStateLabel,
  syncStatusLabel,
  type SemanticState,
} from '../ui-state';
import type { BackupHealth } from './BackupControls';

type SyncStatusProps = {
  health: SyncHealth;
  backupHealth?: BackupHealth;
  onSyncNow?: () => void;
};

export function SyncStatus({ health, backupHealth, onSyncNow }: SyncStatusProps) {
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
      {backupHealth ? (
        <p className="muted" data-backup-status={backupHealth.status}>
          {backupHealth.status === 'VERIFIED' ? 'Backup confirmado' : 'Backup não confirmado'}
        </p>
      ) : null}
      {onSyncNow ? (
        <button type="button" className="button-ghost" onClick={onSyncNow}>
          Sincronizar agora
        </button>
      ) : null}
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
