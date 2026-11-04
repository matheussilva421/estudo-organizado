export type BackupHealth = {
  status: 'NONE' | 'PENDING' | 'VERIFIED' | 'FAILED';
  lastVerifiedAt: string | null;
  versions: number;
};

export type BackupControlsProps = {
  health: BackupHealth;
  recoverySecretConfigured: boolean;
  onExport?: () => void;
  onCreate?: () => void;
  onRestore?: () => void;
};

function statusLabel(status: BackupHealth['status']): string {
  if (status === 'VERIFIED') return 'Backup confirmado';
  if (status === 'PENDING') return 'Backup pendente de confirmação';
  if (status === 'FAILED') return 'Falha no backup';
  return 'Nenhum backup verificado';
}

export function BackupControls({
  health,
  recoverySecretConfigured,
  onExport,
  onCreate,
  onRestore,
}: BackupControlsProps) {
  return (
    <section className="backup-controls" aria-label="Backup" data-backup-status={health.status}>
      <h4>{statusLabel(health.status)}</h4>
      <p className="muted" role="status">
        {health.versions > 0
          ? `${health.versions} versão(ões) verificada(s) no destino remoto.`
          : 'A exportação local funciona offline; a nuvem é opcional.'}
      </p>
      <p className="muted">
        {recoverySecretConfigured
          ? 'Chave de recuperação configurada. Guarde-a fora deste dispositivo.'
          : 'Chave de recuperação ainda não configurada. Configure-a antes do primeiro backup na nuvem.'}
      </p>
      <div className="button-row">
        <button type="button" className="button-ghost" onClick={onExport} disabled={!onExport}>
          Exportar backup local
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onCreate}
          disabled={!onCreate || !recoverySecretConfigured}
        >
          Criar backup agora
        </button>
        <button type="button" className="button-ghost" onClick={onRestore} disabled={!onRestore}>
          Restaurar com prévia
        </button>
      </div>
    </section>
  );
}
