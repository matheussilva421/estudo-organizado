export type CloudBackupVersion = {
  id: string;
  createdAt: string;
  size: number;
};

type Props = {
  versions: readonly CloudBackupVersion[];
  available: boolean;
  recoverySecretConfigured: boolean;
  busyId?: string | null;
  onRestore: (id: string) => void;
};

function dateLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('pt-BR') : value;
}

/**
 * Lists the encrypted versions already confirmed in the remote destination and
 * starts a local restore preview. Nothing is downloaded or decrypted until the
 * user clicks a version.
 */
export function CloudBackupPanel({
  versions,
  available,
  recoverySecretConfigured,
  busyId,
  onRestore,
}: Props) {
  return (
    <section className="google-link" aria-labelledby="cloud-backups-title" data-cloud-backups>
      <h4 id="cloud-backups-title">Versões na nuvem</h4>
      {!available ? (
        <p className="muted">Destino de backup não configurado neste ambiente.</p>
      ) : versions.length === 0 ? (
        <p className="muted">Nenhuma versão remota verificada neste dispositivo.</p>
      ) : (
        <ul className="warning-list">
          {versions.map((version) => (
            <li key={version.id}>
              <strong>{dateLabel(version.createdAt)}</strong> —{' '}
              {Math.max(0, Math.round(version.size / 1024))} KB
              <div className="button-row">
                <button
                  type="button"
                  className="button-ghost"
                  disabled={!recoverySecretConfigured || busyId === version.id}
                  onClick={() => onRestore(version.id)}
                >
                  {busyId === version.id ? 'Abrindo prévia...' : 'Restaurar esta versão'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {available && !recoverySecretConfigured ? (
        <p className="muted">
          Informe a chave de recuperação para baixar e abrir uma versão remota.
        </p>
      ) : null}
    </section>
  );
}
