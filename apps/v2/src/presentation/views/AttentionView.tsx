import { useMemo, useState } from 'react';
import type { HomeSummary, PriorityCategory } from '../../application/experience-queries';
import type { SyncHealth } from '../../application/sync-types';
import type { BackupHealth } from '../components/BackupControls';
import {
  ATTENTION_DISMISSIBLE_CATEGORIES,
  buildAttentionOccurrences,
  projectAttentionItems,
} from '../../application/attention-projection';
import { routeHref } from '../routing';
import { routeForTarget } from './priority-display';

type Props = {
  summary: HomeSummary;
  health: SyncHealth;
  backupHealth?: BackupHealth;
  pendingOutbox: number;
  upgradeBlocked: boolean;
  dismissedKeys: ReadonlySet<string>;
  onDismiss: (key: string) => void;
};

export function AttentionView({
  summary,
  health,
  backupHealth,
  pendingOutbox,
  upgradeBlocked,
  dismissedKeys,
  onDismiss,
}: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'UNSUPPORTED'>(
    () => (typeof Notification === 'undefined' ? 'UNSUPPORTED' : Notification.permission),
  );

  const occurrences = useMemo(
    () =>
      buildAttentionOccurrences({
        summary,
        health,
        pendingOutbox,
        upgradeBlocked,
        backupStatus: backupHealth?.status ?? 'NONE',
      }),
    [summary, health, pendingOutbox, upgradeBlocked, backupHealth?.status],
  );

  const projected = projectAttentionItems(occurrences, { dismissedKeys });
  const priorityCategoryByKey = new Map<string, PriorityCategory>(
    summary.priorities.map((item) => [`priority:${item.id}`, item.category] as const),
  );
  const academicItems = projected.items.filter((item) => {
    const category = priorityCategoryByKey.get(item.id);
    return category !== undefined && !ATTENTION_DISMISSIBLE_CATEGORIES.includes(category) && category !== 'INTEGRIDADE';
  });
  const diagnosticItems = projected.items.filter((item) => !academicItems.includes(item));
  const permissionLabel =
    permission === 'UNSUPPORTED'
      ? 'não suportada neste navegador'
      : permission === 'granted'
        ? 'concedida'
        : permission === 'denied'
          ? 'negada'
          : 'ainda não solicitada';

  async function requestNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }

  function dismiss(key: string): void {
    onDismiss(key);
  }

  function renderOccurrence(item: (typeof projected.items)[number]) {
    const target = item.target ?? 'attention';
    return (
      <li key={item.id} className={`priority-row attention-${item.severity}`} data-causal-id={item.id}>
        <span className={`chip ${item.severity === 'critical' ? 'chip-late' : item.severity === 'warning' ? 'chip-integrity' : 'chip-hint'}`}>
          {item.severity === 'critical' ? 'Crítico' : item.severity === 'warning' ? 'Atenção' : 'Informativo'}
        </span>
        <div className="priority-copy">
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
          <small>Evidências: {item.evidence.join(', ')}</small>
        </div>
        <div className="attention-actions">
          <a className="button-ghost" href={routeHref(routeForTarget(target, item.entityId ?? null))}>Abrir origem</a>
          {item.dismissible ? (
            <button type="button" className="button-ghost" onClick={() => dismiss(item.id)}>
              Dispensar aviso
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <section className="view attention-view" aria-labelledby="attention-title" data-testid="f6-attention">
      <header className="view-header">
        <div>
          <p className="eyebrow">Prioridades por evidência</p>
          <h2 id="attention-title">Central de Atenção</h2>
          <p className="view-subtitle">
            Cada ocorrência tem uma identidade causal. Dispensar um aviso não altera o fato de origem.
          </p>
        </div>
        <span className="badge" data-attention-badge={projected.badgeCount}>
          {projected.badgeCount} ocorrência(s)
        </span>
      </header>

      <div data-testid="f7-attention-items">
        <section className="panel" aria-labelledby="attention-academic-title">
          <header className="section-header">
            <h3 id="attention-academic-title">Pendências acadêmicas</h3>
            <span className="muted">{academicItems.length} entrada(s) causal(is)</span>
          </header>
          {academicItems.length === 0 ? (
            <p className="empty-state">Nenhuma pendência acadêmica acionável agora.</p>
          ) : (
            <ul className="priority-list">{academicItems.map(renderOccurrence)}</ul>
          )}
        </section>

        <section className="panel" aria-labelledby="attention-diagnostic-title" data-testid="f6-diagnostics">
          <header className="section-header">
            <h3 id="attention-diagnostic-title">Diagnóstico e integridade</h3>
            <span className="muted">{diagnosticItems.length} entrada(s) causal(is)</span>
          </header>
          {diagnosticItems.length === 0 ? (
            <p className="empty-state">Sem diagnóstico pendente.</p>
          ) : (
            <ul className="priority-list">{diagnosticItems.map(renderOccurrence)}</ul>
          )}
        </section>
      </div>

      <section className="panel" aria-labelledby="attention-integrity-title" data-testid="f6-integrity">
        <header className="section-header">
          <h3 id="attention-integrity-title">Evidência técnica</h3>
        </header>
        <dl className="integrity-grid">
          <div data-integrity="local">
            <dt>Commit local</dt>
            <dd>{health.localCommitted ? 'Confirmado neste dispositivo' : 'Sem dados locais'}</dd>
          </div>
          <div data-integrity="remote">
            <dt>ACK remoto</dt>
            <dd>{health.remoteCommitted ? 'Confirmado; não é convergência integral' : 'Sem prova remota'}</dd>
          </div>
          <div data-integrity="convergence">
            <dt>Convergência</dt>
            <dd>{health.converged ? `Verificada no cursor ${health.lastVerifiedCursor}` : 'Não verificada'}</dd>
          </div>
          <div data-integrity="backup">
            <dt>Backup/recuperação</dt>
            <dd>
              {backupHealth?.status === 'VERIFIED'
                ? 'Backup confirmado no destino; restauração não executada'
                : backupHealth?.status === 'FAILED'
                  ? 'Falha no backup; cópia anterior preservada'
                  : 'Não verificado'}
            </dd>
          </div>
        </dl>
        <ul className="integrity-notes">
          <li>Outbox pendente: {pendingOutbox} operação(ões). Pendente não prova ACK.</li>
          <li>Conflitos remotos: {health.conflictCount ?? 0}. Nenhuma versão é sobrescrita sem decisão.</li>
          <li>Armazenamento: {upgradeBlocked ? 'bloqueado por outra aba; edições suspensas.' : 'disponível; dados locais não são backup.'}</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="attention-notify-title">
        <header className="section-header">
          <h3 id="attention-notify-title">Notificações externas</h3>
        </header>
        <p className="muted">
          A central funciona offline. Avisos externos exigem opt-in e permissão; não há promessa de push com a PWA fechada.
        </p>
        <p className="muted" data-testid="f6-notification-permission">Permissão: {permissionLabel}.</p>
        <button
          type="button"
          className="button-ghost"
          disabled={permission === 'UNSUPPORTED' || permission === 'granted'}
          onClick={() => void requestNotifications()}
        >
          Autorizar avisos externos
        </button>
        <a className="button-ghost" href="#/reviews">Abrir preferências de revisão</a>
      </section>
    </section>
  );
}
