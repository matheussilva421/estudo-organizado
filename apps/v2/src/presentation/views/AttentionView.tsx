import type { HomeSummary } from '../../application/experience-queries';
import type { SyncHealth } from '../../application/sync-types';
import { routeHref } from '../routing';
import { PRIORITY_CATEGORY_LABELS, priorityTone, routeForTarget } from './priority-display';

type Props = {
  summary: HomeSummary;
  health: SyncHealth;
  pendingOutbox: number;
  upgradeBlocked: boolean;
};

export function AttentionView({ summary, health, pendingOutbox, upgradeBlocked }: Props) {
  const academic = summary.priorities.filter(
    (item) => item.category !== 'INTEGRIDADE' && item.category !== 'ORIENTACAO',
  );
  const integrity = summary.priorities.filter((item) => item.category === 'INTEGRIDADE');

  return (
    <section className="view attention-view" aria-labelledby="attention-title" data-testid="f6-attention">
      <header className="view-header">
        <div>
          <p className="eyebrow">Central local</p>
          <h2 id="attention-title">Atenção e integridade</h2>
          <p className="view-subtitle">
            Aviso transitório, pendência acadêmica e risco de dados são categorias distintas.
          </p>
        </div>
      </header>

      <section className="panel" aria-labelledby="attention-academic-title">
        <header className="section-header">
          <h3 id="attention-academic-title">Pendências acadêmicas</h3>
          <span className="muted">{academic.length} item(ns)</span>
        </header>
        {academic.length === 0 ? (
          <p className="empty-state">Nenhuma pendência acadêmica derivada dos dados locais.</p>
        ) : (
          <ul className="priority-list">
            {academic.map((item) => (
              <li key={item.id} className="priority-row">
                <span className={`chip chip-${priorityTone(item.category)}`}>
                  {PRIORITY_CATEGORY_LABELS[item.category]}
                </span>
                <div className="priority-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <a className="button-ghost" href={routeHref(routeForTarget(item.target))}>
                  Resolver
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="attention-integrity-title" data-testid="f6-integrity">
        <header className="section-header">
          <h3 id="attention-integrity-title">Integridade em três dimensões</h3>
        </header>
        <dl className="integrity-grid">
          <div data-integrity="local">
            <dt>Commit local</dt>
            <dd>{health.localCommitted ? 'Confirmado neste dispositivo' : 'Sem dados locais'}</dd>
          </div>
          <div data-integrity="remote">
            <dt>Remoto</dt>
            <dd>
              {health.remoteCommitted
                ? 'Enviado; convergência ainda não verificada'
                : 'Não enviado — F7 não implementada'}
            </dd>
          </div>
          <div data-integrity="backup">
            <dt>Backup/recuperação</dt>
            <dd>Não verificado — nenhuma prova técnica nesta fase</dd>
          </div>
        </dl>
        <ul className="integrity-notes">
          <li>Outbox pendente: {pendingOutbox} operação(ões). Isso não prova ACK remoto.</li>
          <li>
            Armazenamento local:{' '}
            {upgradeBlocked
              ? 'bloqueado por outra aba; edições suspensas sem apagar dados.'
              : 'disponível; dados não são backup.'}
          </li>
          <li>Dispensar um aviso não conclui revisão nem altera compromisso.</li>
        </ul>
        {integrity.length > 0 ? (
          <ul className="warning-list">
            {integrity.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> — {item.detail}{' '}
                <a href={routeHref(routeForTarget(item.target))}>ver detalhes</a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="attention-notify-title">
        <header className="section-header">
          <h3 id="attention-notify-title">Notificações externas</h3>
        </header>
        <p className="muted">
          A F6 mantém a central local. Notificações exigem opt-in explícito e permissão do
          navegador; não há promessa de disparo com a PWA fechada, push remoto ou sincronização
          entre dispositivos.
        </p>
        <a className="button-ghost" href={routeHref({ module: 'reviews', entityId: null, query: {}, invalid: false })}>
          Abrir preferências de revisão (F5)
        </a>
      </section>
    </section>
  );
}

