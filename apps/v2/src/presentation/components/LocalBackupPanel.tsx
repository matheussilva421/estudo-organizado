import { useRef, useState } from 'react';

export type LocalBackupPanelProps = {
  status: string;
  cloudAvailable: boolean;
  recoverySecretConfigured: boolean;
  onExport: () => Promise<void>;
  onRestoreFile: (file: File) => Promise<string>;
  onCreate: () => Promise<string>;
  onRecoverySecret: () => void;
};

export function LocalBackupPanel({
  status,
  cloudAvailable,
  recoverySecretConfigured,
  onExport,
  onRestoreFile,
  onCreate,
  onRecoverySecret,
}: LocalBackupPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (task: () => Promise<string | void>): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result) setMessage(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha na operação de backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="local-backup-title">
      <header className="section-header">
        <h3 id="local-backup-title">Backup local e restauração</h3>
      </header>
      <p className="muted">
        O arquivo JSON é portátil e funciona offline. A restauração mostra uma prévia e só aplica
        após confirmação; o vínculo Google atual não é sobrescrito.
      </p>
      <p className="muted" role="status" data-local-backup-status>{status}</p>
      <div className="button-row">
        <button type="button" className="button-ghost" disabled={busy} onClick={() => void run(onExport)}>
          Exportar arquivo local
        </button>
        <button
          type="button"
          className="button-ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Restaurar arquivo local
        </button>
        <button type="button" className="button-ghost" disabled={busy} onClick={onRecoverySecret}>
          Configurar chave de recuperação
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={busy || !cloudAvailable || !recoverySecretConfigured}
          onClick={() => void run(onCreate)}
        >
          Criar backup na nuvem
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void run(() => onRestoreFile(file));
        }}
      />
      {message ? (
        <p className="inline-notice" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
