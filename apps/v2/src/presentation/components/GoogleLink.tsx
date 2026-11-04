export type GoogleLinkStatus = 'LOCAL_ONLY' | 'LINKING' | 'READY' | 'PAUSED_AUTH';

export type GoogleLinkProps = {
  status: GoogleLinkStatus;
  email?: string | null;
  onPreview?: () => void;
  onConfirm?: () => void;
  onLogout?: () => void;
};

/**
 * Account linking is opt-in. Rendering this component never starts a request,
 * and every remote action requires an explicit handler.
 */
export function GoogleLink({ status, email, onPreview, onConfirm, onLogout }: GoogleLinkProps) {
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
      {email ? <p data-google-email>{email}</p> : null}
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
      </div>
    </section>
  );
}
