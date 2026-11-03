import { useState } from 'react';
import {
  DEFAULT_HOME_INDICATORS,
  HOME_INDICATORS,
  HOME_MODE_OPTIONS,
  orderPrioritiesForMode,
  selectHomeIndicators,
  type HomeIndicatorId,
  type HomeMode,
  type HomeSummary,
} from '../../application/experience-queries';
import { routeHref } from '../routing';
import {
  PRIORITY_CATEGORY_LABELS,
  priorityTone,
  routeForTarget,
} from './priority-display';

type Props = {
  summary: HomeSummary;
  ready: boolean;
  loadError: string | null;
  experienceError: boolean;
  onRetry: () => void;
};

const MODE_KEY = 'estudo-organizado:v2:home-mode';
const INDICATORS_KEY = 'estudo-organizado:v2:home-indicators';

function readMode(): HomeMode {
  try {
    const stored = window.localStorage.getItem(MODE_KEY);
    return HOME_MODE_OPTIONS.some((option) => option.id === stored)
      ? (stored as HomeMode)
      : 'DAILY';
  } catch {
    return 'DAILY';
  }
}

function readIndicators(): HomeIndicatorId[] {
  try {
    const stored = window.localStorage.getItem(INDICATORS_KEY);
    if (stored === null) return DEFAULT_HOME_INDICATORS;
    const parsed = stored.split(',').filter((item) => item.length > 0);
    const valid = HOME_INDICATORS.filter((indicator) => parsed.includes(indicator.id)).map(
      (indicator) => indicator.id,
    );
    return valid;
  } catch {
    return DEFAULT_HOME_INDICATORS;
  }
}

function persist(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Presentation preference stays in memory when storage is unavailable.
  }
}

export function HomeView({ summary, ready, loadError, experienceError, onRetry }: Props) {
  const [mode, setMode] = useState<HomeMode>(readMode);
  const [visibleIndicators, setVisibleIndicators] =
    useState<HomeIndicatorId[]>(readIndicators);
  const orderedPriorities = orderPrioritiesForMode(summary.priorities, mode);
  const nextAction = orderedPriorities[0] ?? summary.nextAction;
  const indicators = selectHomeIndicators(summary.counts, visibleIndicators);

  function changeMode(next: HomeMode): void {
    setMode(next);
    persist(MODE_KEY, next);
  }

  function toggleIndicator(id: HomeIndicatorId): void {
    const selected = visibleIndicators.includes(id)
      ? visibleIndicators.filter((item) => item !== id)
      : HOME_INDICATORS.filter(
          (indicator) => indicator.id === id || visibleIndicators.includes(indicator.id),
        ).map((indicator) => indicator.id);
    setVisibleIndicators(selected);
    persist(INDICATORS_KEY, selected.join(','));
  }

  return (
    <section
      className="view home-view"
      aria-labelledby="home-title"
      data-testid="f6-home"
      data-home-mode={mode}
    >
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

      {loadError || experienceError ? (
        <div className="inline-notice" role="alert" data-testid="f6-load-error">
          <strong>Não foi possível ler todos os dados locais.</strong>{' '}
          {loadError ?? 'Uma das consultas de planejamento, sessões ou revisões falhou.'} Isso é
          erro, não ausência de dados; nenhum indicador zero foi inferido.
          <button type="button" className="button-ghost" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <section className="home-controls" aria-label="Apresentação da Home">
        <div className="settings-row">
          <label htmlFor="home-mode">Modo de apresentação</label>
          <select
            id="home-mode"
            value={mode}
            onChange={(event) => changeMode(event.target.value as HomeMode)}
          >
            {HOME_MODE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="muted">
          {HOME_MODE_OPTIONS.find((option) => option.id === mode)?.description}
        </p>
        <details className="indicator-catalog">
          <summary>
            Indicadores exibidos ({indicators.length}/{HOME_INDICATORS.length})
          </summary>
          <fieldset>
            <legend className="sr-only">Indicadores do resumo da Home</legend>
            {HOME_INDICATORS.map((indicator) => (
              <label key={indicator.id} className="indicator-option">
                <input
                  type="checkbox"
                  checked={visibleIndicators.includes(indicator.id)}
                  onChange={() => toggleIndicator(indicator.id)}
                />
                {indicator.label}
              </label>
            ))}
          </fieldset>
        </details>
      </section>

      <div className="home-hero">
        <article className="card next-action" aria-labelledby="next-action-title">
          <p className="eyebrow">Ação prioritária</p>
          {nextAction ? (
            <>
              <h3 id="next-action-title">{nextAction.title}</h3>
              <p className="card-detail">{nextAction.detail}</p>
              <p className="priority-meta">
                <span className={`chip chip-${priorityTone(nextAction.category)}`}>
                  {PRIORITY_CATEGORY_LABELS[nextAction.category]}
                </span>
                {nextAction.dueDate ? (
                  <span className="muted">Prazo/registro: {nextAction.dueDate}</span>
                ) : null}
              </p>
              <a
                className="button-primary"
                href={routeHref(routeForTarget(nextAction.target))}
                data-action="home-next-action"
              >
                Abrir {nextAction.target === 'sessions' ? 'Sessões' : nextAction.target === 'reviews' ? 'Revisões' : nextAction.target === 'planning' ? 'Planejamento' : nextAction.target === 'content' ? 'Conteúdo' : nextAction.target === 'attention' ? 'Atenção' : 'Configurações'}
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

        <div
          className="home-counts"
          aria-label="Resumo do perfil local"
          data-visible-indicators={indicators.length}
        >
          {indicators.map((indicator) => (
            <div className="count-card" key={indicator.id} data-indicator={indicator.id}>
              <span className="count-value">{indicator.value}</span>
              <span className="count-label">{indicator.label.toLowerCase()}</span>
            </div>
          ))}
          {indicators.length === 0 ? (
            <p className="empty-state">
              Todos os indicadores estão ocultos; prioridades e alertas continuam visíveis.
            </p>
          ) : null}
        </div>
      </div>

      <section className="panel" aria-labelledby="priorities-title">
        <header className="section-header">
          <h3 id="priorities-title">Prioridades explicáveis</h3>
          <span className="muted">{summary.priorities.length} item(ns)</span>
        </header>
        {orderedPriorities.length === 0 ? (
          <p className="empty-state">
            Sem pendências derivadas. Crie conteúdo ou um plano para começar a jornada.
          </p>
        ) : (
          <ol className="priority-list" data-testid="f6-priorities">
            {orderedPriorities.slice(0, 8).map((item) => (
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
        {orderedPriorities.length > 8 ? (
          <p className="muted">
            Mostrando 8 de {orderedPriorities.length}; a central de atenção mantém o restante
            acessível.
          </p>
        ) : null}
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

