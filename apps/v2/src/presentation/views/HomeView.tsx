import type { HomeSummary } from '../../application/experience-queries';
import { routeHref } from '../routing';
import {
  PRIORITY_CATEGORY_LABELS,
  priorityTone,
  routeForTarget,
} from './priority-display';

type Props = {
  summary: HomeSummary;
  ready: boolean;
};

export function HomeView({ summary, ready }: Props) {
  return (
    <section className="view home-view" aria-labelledby="home-title" data-testid="f6-home">
      <header className="view-header">
        <div>
          <p className="eyebrow">Experiência integrada</p>
          <h2 id="home-title">Painel inicial</h2>
          <p className="view-subtitle">
            Próxima ação, compromissos e integridade derivados dos dados locais.
          </p>
        </div>
        <span className="badge" data-home-ready={ready ? 'true' : 'false'}>
          {ready ? 'Dados locais carregados' : 'Carregando dados locais'}
        </span>
      </header>

      <div className="home-hero">
        <article className="card next-action" aria-labelledby="next-action-title">
          <p className="eyebrow">Ação prioritária</p>
          {summary.nextAction ? (
            <>
              <h3 id="next-action-title">{summary.nextAction.title}</h3>
              <p className="card-detail">{summary.nextAction.detail}</p>
              <p className="priority-meta">
                <span className={`chip chip-${priorityTone(summary.nextAction.category)}`}>
                  {PRIORITY_CATEGORY_LABELS[summary.nextAction.category]}
                </span>
                {summary.nextAction.dueDate ? (
                  <span className="muted">Prazo/registro: {summary.nextAction.dueDate}</span>
                ) : null}
              </p>
              <a
                className="button-primary"
                href={routeHref(routeForTarget(summary.nextAction.target))}
                data-action="home-next-action"
              >
                Abrir {summary.nextAction.target === 'sessions' ? 'Sessões' : summary.nextAction.target === 'reviews' ? 'Revisões' : summary.nextAction.target === 'planning' ? 'Planejamento' : summary.nextAction.target === 'content' ? 'Conteúdo' : summary.nextAction.target === 'attention' ? 'Atenção' : 'Configurações'}
              </a>
            </>
          ) : (
            <>
              <h3 id="next-action-title">Nenhuma pendência crítica agora</h3>
              <p className="card-detail">
                Você pode organizar conteúdo, planejar ou registrar uma sessão. Nada foi criado
                automaticamente.
              </p>
              <a className="button-primary" href={routeHref({ module: 'content', entityId: null, query: {}, invalid: false })}>
                Abrir conteúdo
              </a>
            </>
          )}
        </article>

        <div className="home-counts" aria-label="Resumo do perfil local">
          <div className="count-card">
            <span className="count-value">{summary.counts.activeEditais}</span>
            <span className="count-label">editais ativos</span>
          </div>
          <div className="count-card">
            <span className="count-value">{summary.counts.subjects}</span>
            <span className="count-label">disciplinas</span>
          </div>
          <div className="count-card">
            <span className="count-value">{summary.counts.plannedToday}</span>
            <span className="count-label">blocos planejados hoje</span>
          </div>
          <div className="count-card">
            <span className="count-value">{summary.counts.completedLast7Days}</span>
            <span className="count-label">sessões concluídas (7 dias)</span>
          </div>
          <div className="count-card">
            <span className="count-value">{summary.counts.reviewsDue}</span>
            <span className="count-label">revisões vencidas/hoje</span>
          </div>
        </div>
      </div>

      <section className="panel" aria-labelledby="priorities-title">
        <header className="section-header">
          <h3 id="priorities-title">Prioridades explicáveis</h3>
          <span className="muted">{summary.priorities.length} item(ns)</span>
        </header>
        {summary.priorities.length === 0 ? (
          <p className="empty-state">
            Sem pendências derivadas. Crie conteúdo ou um plano para começar a jornada.
          </p>
        ) : (
          <ol className="priority-list" data-testid="f6-priorities">
            {summary.priorities.slice(0, 8).map((item) => (
              <li key={item.id} className="priority-row">
                <span className={`chip chip-${priorityTone(item.category)}`}>
                  {PRIORITY_CATEGORY_LABELS[item.category]}
                </span>
                <div className="priority-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="muted">
          <a href={routeHref({ module: 'attention', entityId: null, query: {}, invalid: false })}>
            Ver a central de atenção
          </a>
        </p>
        <p className="source-note">{summary.source}</p>
      </section>

      {summary.empty ? (
        <p className="inline-notice" role="status">
          Perfil sem dados. O onboarding é contextual: nada é inventado nem exigido antes de você
          criar o primeiro edital.
        </p>
      ) : null}
    </section>
  );
}

