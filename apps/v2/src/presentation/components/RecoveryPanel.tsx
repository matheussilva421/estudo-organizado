import type { F7RecoveryPreview } from '../../platform/f7-runtime';

export type RecoveryUiStatus =
  | 'VERIFICAR'
  | 'VERIFICANDO'
  | 'PREVIEW'
  | 'EXECUTANDO'
  | 'RECUPERADO'
  | 'BLOQUEADO';

type Props = {
  recovery: { reason: string; at: string } | null;
  status: RecoveryUiStatus;
  preview: F7RecoveryPreview | null;
  message?: string | null;
  onPrepare: () => void;
  onExport: () => void;
  onConfirm: () => void;
};

function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

/**
 * Recovery is deliberately a three-step flow: verify the remote snapshot,
 * export the local backup, then apply the verified checkpoint. There is no
 * button that merely clears RECOVERY_REQUIRED.
 */
export function RecoveryPanel({
  recovery,
  status,
  preview,
  message,
  onPrepare,
  onExport,
  onConfirm,
}: Props) {
  if (!recovery && status !== 'RECUPERADO') return null;
  const recoveredView = !recovery && status === 'RECUPERADO';
  const viewStatus = recovery && status === 'RECUPERADO' ? 'VERIFICAR' : status;
  const verifying = viewStatus === 'VERIFICANDO' || viewStatus === 'EXECUTANDO';
  return (
    <section className="google-link" aria-labelledby="recovery-title" data-recovery-panel>
      <h4 id="recovery-title">Recuperação da sincronização</h4>
      {recoveredView ? (
        <p role="status" data-recovery-status="RECUPERADO">
          Sincronização recuperada com snapshot, cursor e backup verificados. As pendências
          bloqueadas continuam preservadas.
        </p>
      ) : (
        <>
          <p className="muted">
            A sincronização está bloqueada porque o cursor local não pode ser provado contra o
            remoto. Nenhuma operação será enviada até a verificação terminar.
          </p>
          <dl className="link-review" data-recovery-cause>
            <div>
              <dt>Causa</dt>
              <dd>{recovery?.reason ?? 'RECOVERY_REQUIRED'}</dd>
            </div>
            <div>
              <dt>Registrada em</dt>
              <dd>{recovery?.at ?? ''}</dd>
            </div>
          </dl>
          {viewStatus === 'VERIFICAR' || viewStatus === 'VERIFICANDO' || viewStatus === 'BLOQUEADO' ? (
            <div className="button-row">
              <button
                type="button"
                className="button-primary"
                onClick={onPrepare}
                disabled={verifying}
                data-recovery-action="verify"
              >
                {viewStatus === 'VERIFICANDO' ? 'Verificando...' : 'Verificar recuperação'}
              </button>
            </div>
          ) : null}
          {(viewStatus === 'PREVIEW' || viewStatus === 'EXECUTANDO') && preview ? (
            <>
              <dl className="link-review" data-recovery-preview>
                <div>
                  <dt>Snapshot remoto</dt>
                  <dd>
                    {preview.counts.created} novo(s), {preview.counts.changed} atualização(ões),{' '}
                    {preview.counts.deleted} exclusão(ões)
                  </dd>
                </div>
                <div>
                  <dt>Conflitos/pendências</dt>
                  <dd>
                    {preview.counts.conflicts} conflito(s), {preview.outboxPending} operação(ões)
                    offline, {preview.tombstones} tombstone(s)
                  </dd>
                </div>
                <div>
                  <dt>Checkpoint</dt>
                  <dd>
                    epoch {preview.checkpoint.epoch}, cursor {preview.checkpoint.head} ·{' '}
                    {shortHash(preview.checkpoint.snapshotChecksum)}
                  </dd>
                </div>
                <div>
                  <dt>Backup local</dt>
                  <dd>
                    {preview.backupRecordCount} registro(s) · {shortHash(preview.backupChecksum)}
                  </dd>
                </div>
              </dl>
              {!preview.backupDeletionHistoryComplete ? (
                <p className="muted" data-recovery-backup-warning>
                  A cópia local contém os tombstones atuais, mas o epoch local não prova todo o
                  histórico de exclusões. O snapshot remoto verificado continua obrigatório.
                </p>
              ) : null}
              <div className="button-row">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={onExport}
                  disabled={verifying}
                  data-recovery-action="export"
                >
                  Exportar cópia de segurança
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={onConfirm}
                  disabled={verifying}
                  data-recovery-action="confirm"
                >
                  {viewStatus === 'EXECUTANDO' ? 'Executando...' : 'Aplicar rebaseline verificado'}
                </button>
              </div>
              <p className="muted">
                O backup acima já foi gravado no IndexedDB. O rebaseline só remove o bloqueio
                depois de aplicar o snapshot e conferir cursor, epoch e identidade.
              </p>
            </>
          ) : null}
          {message ? (
            <p className="muted" role="status" data-recovery-message>
              {message}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
