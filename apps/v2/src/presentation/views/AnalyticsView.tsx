import type {
  AnalyticsComparison,
  AnalyticsSummary,
} from '../../application/experience-queries';
import { formatFocusDuration } from '../../application/experience-queries';

type Props = {
  analytics: AnalyticsSummary;
  comparison: AnalyticsComparison;
  stale?: boolean;
};

const STATUS_LABELS: Record<AnalyticsSummary['status'], string> = {
  READY: 'Dados conciliados no período',
  INSUFFICIENT_DATA: 'Dados insuficientes no período',
  PARTIAL: 'Dados parciais',
};

export function AnalyticsView({ analytics, comparison, stale = false }: Props) {
  const lowSample = analytics.questions.total > 0 && analytics.questions.total < 10;
  const accuracy =
    analytics.questions.accuracy === null || lowSample
      ? null
      : Math.round(analytics.questions.accuracy * 1000) / 10;
  const maxEditalFocus = Math.max(1, ...analytics.byEdital.map((bucket) => bucket.focusMs));
  const maxDisciplineFocus = Math.max(
    1,
    ...analytics.byDiscipline.map((bucket) => bucket.focusMs),
  );
  const maxDayFocus = Math.max(1, ...analytics.byDay.map((bucket) => bucket.focusMs));

  return (
    <section
      className="view analytics-view"
      aria-labelledby="analytics-title"
      data-testid="f6-analytics"
      data-analytics-status={analytics.status}
      data-analytics-stale={stale ? 'true' : undefined}
    >
      <header className="view-header">
        <div>
          <p className="eyebrow">Análise</p>
          <h2 id="analytics-title">Indicadores conciliados</h2>
          <p className="view-subtitle">
            Planejado, executado e medido ficam separados. Cada número informa período, escopo e
            origem.
          </p>
        </div>
        <span className={`badge badge-${stale ? 'partial' : analytics.status.toLowerCase()}`}>
          {stale ? 'Atualização falhou; números podem estar desatualizados' : STATUS_LABELS[analytics.status]}
        </span>
      </header>

      {stale ? (
        <div className="inline-notice" role="alert" data-testid="f6-analytics-stale">
          A última leitura dos dados locais falhou. Os números abaixo são a última foto
          conhecida e não devem ser tratados como atualizados; tente novamente pela Home.
        </div>
      ) : null}

      <dl className="scope-grid">
        <div>
          <dt>Período</dt>
          <dd>{analytics.period.from} a {analytics.period.to}</dd>
        </div>
        <div>
          <dt>Escopo</dt>
          <dd>{analytics.scope}</dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>{analytics.source}</dd>
        </div>
        <div>
          <dt>Impressão</dt>
          <dd>{analytics.fingerprint ?? 'não materializada'}</dd>
        </div>
      </dl>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span className="kpi-label">Tempo de foco executado</span>
          <strong className="kpi-value">{formatFocusDuration(analytics.sessions.focusMs)}</strong>
          <span className="kpi-note">{analytics.sessions.inPeriod} sessão(ões) concluída(s) no período</span>
        </article>
        <article className="kpi-card">
          <span className="kpi-label">Tempo planejado</span>
          <strong className="kpi-value">{analytics.planned.minutes} min</strong>
          <span className="kpi-note">
            {analytics.planned.blocks} bloco(s) em {analytics.planned.activeScenarios} cenário(s) ativo(s)
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-label">Questões registradas</span>
          <strong className="kpi-value">{analytics.questions.total}</strong>
          <span className="kpi-note">
            {analytics.questions.total === 0
              ? 'Sem medições: ausência, não zero de desempenho.'
              : `${analytics.questions.correct} acerto(s) em ${analytics.questions.sessionsWithData} sessão(ões) com dados.`}
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-label">Aproveitamento</span>
          <strong className="kpi-value">{accuracy === null ? '—' : `${accuracy}%`}</strong>
          <span className="kpi-note">
            {analytics.questions.total === 0
              ? 'Sem medições: ausência, não zero de desempenho.'
              : lowSample
                ? 'Amostra pequena (' +
                  analytics.questions.total +
                  ' questões); aproveitamento não exibido como tendência.'
                : 'Denominador: questões efetivamente registradas.'}
          </span>
        </article>
      </div>

      <section className="panel" aria-labelledby="analytics-comparison-title">
        <header className="section-header">
          <h3 id="analytics-comparison-title">Comparação com o período anterior</h3>
        </header>
        <p>
          Período anterior: {formatFocusDuration(comparison.previousFocusMs)} em{' '}
          {comparison.previousSessions} sessão(ões). Variação de foco:{' '}
          {comparison.focusDeltaPct === null
            ? '—'
            : (Math.round(comparison.focusDeltaPct * 10) / 10).toFixed(1) + '%'}.
        </p>
        <p className="hint">{comparison.note}</p>
      </section>

      {analytics.status !== 'READY' ? (
        <p className="inline-notice" role="status">
          {analytics.status === 'INSUFFICIENT_DATA'
            ? 'Não há sessões concluídas no período. Os valores de planejamento continuam visíveis como plano, não como execução.'
            : 'Há dados parciais; os totais abaixo são diagnósticos e não uma conciliação integral.'}
        </p>
      ) : null}

      {analytics.warnings.length > 0 ? (
        <ul className="warning-list" aria-label="Ressalvas dos indicadores">
          {analytics.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="table-grid">
        <section className="panel" aria-labelledby="analytics-edital-title">
          <header className="section-header">
            <h3 id="analytics-edital-title">Por edital</h3>
            <span className="muted">
              {analytics.sharedSessions > 0
                ? 'Sessões compartilhadas fora dos subtotais'
                : 'Subtotais aditivos neste recorte'}
            </span>
          </header>
          {analytics.byEdital.length === 0 ? (
            <p className="empty-state">Sem sessões atribuídas a um único edital.</p>
          ) : (
            <>
            <div
              className="bar-chart"
              role="img"
              aria-label="Tempo executado por edital no período"
            >
              {analytics.byEdital.map((bucket) => (
                <div className="bar-row" key={bucket.id}>
                  <span className="bar-label">{bucket.label}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width:
                          (Math.max(0, bucket.focusMs) / maxEditalFocus) * 100 + '%',
                      }}
                    />
                  </span>
                  <span className="bar-value">{formatFocusDuration(bucket.focusMs)}</span>
                </div>
              ))}
            </div>
            <table className="data-table">
              <caption className="sr-only">Tempo executado por edital no período</caption>
              <thead>
                <tr>
                  <th scope="col">Edital</th>
                  <th scope="col">Tempo</th>
                  <th scope="col">Sessões</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byEdital.map((bucket) => (
                  <tr key={bucket.id}>
                    <th scope="row">{bucket.label}</th>
                    <td>{formatFocusDuration(bucket.focusMs)}</td>
                    <td>{bucket.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </section>

        <section className="panel" aria-labelledby="analytics-discipline-title">
          <header className="section-header">
            <h3 id="analytics-discipline-title">Por disciplina</h3>
            <span className="muted">Somente alocações explícitas</span>
          </header>
          {analytics.byDiscipline.length === 0 ? (
            <p className="empty-state">Sem alocações por disciplina no período.</p>
          ) : (
            <>
            <div
              className="bar-chart"
              role="img"
              aria-label="Tempo alocado por disciplina no período"
            >
              {analytics.byDiscipline.map((bucket) => (
                <div className="bar-row" key={bucket.id}>
                  <span className="bar-label">{bucket.label}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width:
                          (Math.max(0, bucket.focusMs) / maxDisciplineFocus) * 100 + '%',
                      }}
                    />
                  </span>
                  <span className="bar-value">{formatFocusDuration(bucket.focusMs)}</span>
                </div>
              ))}
            </div>
            <table className="data-table">
              <caption className="sr-only">Tempo alocado por disciplina no período</caption>
              <thead>
                <tr>
                  <th scope="col">Disciplina</th>
                  <th scope="col">Tempo alocado</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byDiscipline.map((bucket) => (
                  <tr key={bucket.id}>
                    <th scope="row">{bucket.label}</th>
                    <td>{formatFocusDuration(bucket.focusMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </section>
      </div>

      <div className="table-grid">
        <section className="panel" aria-labelledby="analytics-day-title">
          <header className="section-header">
            <h3 id="analytics-day-title">Série por dia</h3>
            <span className="muted">Somente dias com sessão concluída e datada no período</span>
          </header>
          {analytics.byDay.length === 0 ? (
            <p className="empty-state">Sem sessões datadas no período.</p>
          ) : (
            <>
              <div className="bar-chart" role="img" aria-label="Tempo executado por dia no período">
                {analytics.byDay.map((bucket) => (
                  <div className="bar-row" key={bucket.id}>
                    <span className="bar-label">{bucket.label}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: (Math.max(0, bucket.focusMs) / maxDayFocus) * 100 + '%' }}
                      />
                    </span>
                    <span className="bar-value">{formatFocusDuration(bucket.focusMs)}</span>
                  </div>
                ))}
              </div>
              <table className="data-table">
                <caption className="sr-only">Tempo executado por dia no período</caption>
                <thead>
                  <tr>
                    <th scope="col">Dia (AAAA-MM-DD)</th>
                    <th scope="col">Tempo</th>
                    <th scope="col">Sessões</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byDay.map((bucket) => (
                    <tr key={bucket.id}>
                      <th scope="row">{bucket.label}</th>
                      <td>{formatFocusDuration(bucket.focusMs)}</td>
                      <td>{bucket.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="panel" aria-labelledby="analytics-state-title">
          <header className="section-header">
            <h3 id="analytics-state-title">Distribuição por estado</h3>
            <span className="muted">Contagens não aditivas; cada linha tem base própria</span>
          </header>
          <table className="data-table">
            <caption className="sr-only">Distribuição das sessões por estado de dados</caption>
            <thead>
              <tr>
                <th scope="col">Estado</th>
                <th scope="col">Sessões</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Concluídas no período (base: período)</th>
                <td>{analytics.sessions.inPeriod}</td>
              </tr>
              <tr>
                <th scope="row">Com intervalos recuperados (subconjunto do período)</th>
                <td>{analytics.sessions.recovery}</td>
              </tr>
              <tr>
                <th scope="row">Sem data civil (todas as concluídas)</th>
                <td>{analytics.sessions.undated}</td>
              </tr>
              <tr>
                <th scope="row">Compartilhadas entre editais (subconjunto do período)</th>
                <td>{analytics.sharedSessions}</td>
              </tr>
              <tr>
                <th scope="row">Sem edital vinculado (subconjunto do período)</th>
                <td>{analytics.unassignedSessions}</td>
              </tr>
            </tbody>
          </table>
          <p className="hint">As linhas se sobrepõem e não formam um total aditivo.</p>
        </section>
      </div>
    </section>
  );
}

