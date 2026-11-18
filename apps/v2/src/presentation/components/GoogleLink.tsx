import type { LinkReview } from '../../application/google-link-service';

export type GoogleLinkStatus = 'LOCAL_ONLY' | 'LINKING' | 'READY' | 'PAUSED_AUTH';

export type GoogleLinkProps = {
  status: GoogleLinkStatus;
  authError?: string | null;
  email?: string | null;
  review?: LinkReview | null;
  onPreview?: () => void;
  onConfirm?: () => void;
  onLogout?: () => void;
};

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-blocked':
      return 'O navegador bloqueou o popup. Permita popups para este site e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'A origem não está autorizada no Firebase. Use o domínio de staging.';
    case 'auth/network-request-failed':
      return 'Falha de rede ao falar com o Google. Verifique a conexão e tente novamente.';
    default:
      return 'Não foi possível concluir o login Google. Tente novamente.';
  }
}

/**
 * Account linking is opt-in. Rendering this component never starts a request,
 * and every remote action requires an explicit handler.
 */
export function GoogleLink({
  status,
  authError,
  email,
  review,
  onPreview,
  onConfirm,
  onLogout,
}: GoogleLinkProps) {
  const label =
    status === 'READY'
      ? 'Conta Google vinculada'
      : status === 'LINKING'
        ? 'Revisar vínculo Google'
        : status === 'PAUSED_AUTH'
          ? 'Sessão Google expirada'
          : 'Estudo local';
  return (
    <section className="google-link" aria-label="Conta Google" data-google-status={status}>
      <h4>{label}</h4>
      <p className="muted">
        {status === 'LOCAL_ONLY'
          ? 'O estudo continua disponível sem conta. Sincronização e backup na nuvem só são habilitados após consentimento.'
          : status === 'LINKING'
            ? 'Confira o perfil, o UID e a biblioteca remota antes de confirmar. Nada é mesclado automaticamente.'
            : status === 'PAUSED_AUTH'
              ? 'As pendências locais foram preservadas. Entre novamente para retomar a sincronização.'
              : 'Sincronização e backup usam esta conta somente após a vinculação consentida.'}
      </p>
      {authError ? (
        <p className="inline-notice" role="alert" data-google-auth-error>
          {authErrorMessage(authError)} Código: <code>{authError}</code>.
        </p>
      ) : null}
      {email ? <p data-google-email>{email}</p> : null}
      {review ? (
        <dl className="link-review" data-link-review>
          <div>
            <dt>Conta</dt>
            <dd>{review.email ?? review.uid}</dd>
          </div>
          <div>
            <dt>UID</dt>
            <dd>{review.uid}</dd>
          </div>
          <div>
            <dt>Biblioteca remota</dt>
            <dd>{review.remoteLibraryId}</dd>
          </div>
          <div>
            <dt>Itens remotos</dt>
            <dd>{review.remoteCount} (contagem não verificada neste dispositivo)</dd>
          </div>
        </dl>
      ) : null}
      <div className="button-row">
        {status === 'LOCAL_ONLY' || status === 'PAUSED_AUTH' ? (
          <button type="button" className="button-primary" onClick={onPreview} disabled={!onPreview}>
            {status === 'PAUSED_AUTH' ? 'Entrar novamente' : 'Entrar com Google'}
          </button>
        ) : null}
        {status === 'LINKING' ? (
          <button type="button" className="button-primary" onClick={onConfirm} disabled={!onConfirm}>
            Confirmar vínculo
          </button>
        ) : null}
        {status === 'READY' ? (
          <button type="button" className="button-ghost" onClick={onLogout} disabled={!onLogout}>
            Sair desta conta
          </button>
        ) : null}
        {status === 'PAUSED_AUTH' && onLogout ? (
          <button type="button" className="button-ghost" onClick={onLogout}>
            Sair desta conta
          </button>
        ) : null}
      </div>
    </section>
  );
}
