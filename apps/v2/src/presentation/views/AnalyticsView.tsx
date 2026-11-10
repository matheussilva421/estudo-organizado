import { useMemo, useState } from 'react';
import type {
  AnalyticsComparison,
  AnalyticsSummary,
} from '../../application/experience-queries';
import { formatFocusDuration } from '../../application/experience-queries';
import {
  buildAnalyticsEvidence,
  createAnalyticsSnapshot,
  exportAnalyticsReport,
  validateChartSpec,
  type AnalyticsSnapshot,
} from '../../application/analytics-metrics';

type Props = {
  analytics: AnalyticsSummary;
  comparison: AnalyticsComparison;
  stale?: boolean;
  days: number;
  onDaysChange: (days: number) => void;
};

const STATUS_LABELS: Record<AnalyticsSummary['status'], string> = {
  READY: 'Dados conciliados no período',
  INSUFFICIENT_DATA: 'Dados insuficientes no período',
  PARTIAL: 'Dados parciais',
};

function readSnapshots(profileId: string): AnalyticsSnapshot[] {
  try {
    const raw = window.localStorage.getItem(`estudo-organizado:v2:analytics-snapshots:${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalyticsSnapshot[];
    return Array.isArray(parsed) ? parsed.slice(-8) : [];
  } catch {
    return [];
  }
}

function downloadReport(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsView({ analytics, comparison, stale = false, days, onDaysChange }: Props) {
  const evidence = useMemo(() => buildAnalyticsEvidence(analytics), [analytics]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('bar');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['focus-time', 'planned-time']);
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>(() => readSnapshots(analytics.profileId));
  const [openedSnapshot, setOpenedSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const selectedRows = evidence.filter((row) => selectedMetrics.includes(row.id));
  const validation = validateChartSpec({
    chartType,
    series: selectedRows.map((row) => ({ id: row.id, unit: row.unit })),
  });
  const maxChartValue = Math.max(1, ...selectedRows.map((row) => row.value ?? 0));
  const lineRows = selectedRows.filter((row) => row.value !== null);
  const linePoints = lineRows.map((row, index) => ({
    x: lineRows.length === 1 ? 300 : 20 + (index * 560) / (lineRows.length - 1),
    y: 120 - ((row.value ?? 0) / maxChartValue) * 90,
  }));
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

      <section className="panel analytics-editor" aria-labelledby="analytics-editor-title">
        <header className="section-header">
          <div>
            <h3 id="analytics-editor-title">Editor de análise</h3>
            <p className="muted">Métricas, séries e tabela usam o mesmo conjunto de fatos.</p>
          </div>
          <label className="settings-inline">
            Período
            <select id="analytics-period" value={days} onChange={(event) => onDaysChange(Number(event.target.value))}>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </label>
        </header>
        <fieldset className="analytics-metrics-picker">
          <legend>Métricas exibidas</legend>
          {evidence.map((metric) => (
            <label key={metric.id} className="indicator-option">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric.id)}
                onChange={() =>
                  setSelectedMetrics((current) =>
                    current.includes(metric.id)
                      ? current.filter((id) => id !== metric.id)
                      : [...current, metric.id],
                  )
                }
              />
              {metric.label} ({metric.unit})
            </label>
          ))}
        </fieldset>
        <div className="settings-row">
          <label htmlFor="analytics-chart-type">Apresentação</label>
          <select id="analytics-chart-type" value={chartType} onChange={(event) => setChartType(event.target.value as 'line' | 'bar')}>
            <option value="bar">Barras</option>
            <option value="line">Linha</option>
          </select>
        </div>
        {validation.ok ? (
          <div className="analytics-chart" data-testid="f7-analytics-chart" role="img" aria-label={`Métricas selecionadas: ${selectedRows.map((row) => row.label).join(', ')}`}>
            {chartType === 'bar' ? selectedRows.map((row) => (
              <div className="bar-row" key={row.id}>
                <span className="bar-label">{row.label}</span>
                <span className="bar-track">
                  <span className="bar-fill analytics-bar" style={{ width: ((row.value ?? 0) / maxChartValue) * 100 + '%' }} />
                </span>
                <span className="bar-value">{row.value === null ? '—' : `${row.value} ${row.unit}`}</span>
              </div>
            )) : (
              <>
                {lineRows.length === 0 ? <p className="empty-state">Sem valores para desenhar no período; a tabela mantém “—”.</p> : null}
                <svg className="analytics-line-chart" viewBox="0 0 600 140" aria-hidden="true">
                  <line x1="20" y1="120" x2="580" y2="120" className="chart-axis" />
                  <polyline points={linePoints.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-polyline" />
                  {linePoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="5" className="chart-point" />)}
                </svg>
                <div className="chart-legend">
                  {selectedRows.map((row) => <span key={row.id}>{row.label}: {row.value === null ? '—' : `${row.value} ${row.unit}`}</span>)}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="inline-notice" role="alert" data-testid="f7-chart-blocked">
            Gráfico bloqueado: {validation.message}
          </p>
        )}
        <details open>
          <summary>Tabela equivalente ({selectedRows.length})</summary>
          <div className="table-scroll">
          <table className="data-table" data-testid="f7-analytics-table">
            <caption>Os mesmos valores do gráfico, com unidade e denominador.</caption>
            <thead><tr><th scope="col">Métrica</th><th scope="col">Valor</th><th scope="col">Numerador</th><th scope="col">Denominador</th></tr></thead>
            <tbody>
              {selectedRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value === null ? '—' : `${row.value} ${row.unit}`}</td>
                  <td>{row.numerator} {row.numeratorLabel}</td>
                  <td>{row.denominator === null ? '—' : `${row.denominator} ${row.denominatorLabel ?? ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </details>
        <p className="source-note">Metodologia {evidence[0]?.methodVersion ?? 'f7-ux-v1'}; ressalvas permanecem visíveis e não podem ser desativadas.</p>
        <div className="session-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              const snapshot = createAnalyticsSnapshot(analytics, new Date().toISOString());
              const next = [...snapshots, snapshot].slice(-8);
              try {
                window.localStorage.setItem(
                  `estudo-organizado:v2:analytics-snapshots:${analytics.profileId}`,
                  JSON.stringify(next),
                );
                setSnapshots(next);
                setArchiveError(null);
              } catch {
                setArchiveError('Não foi possível arquivar neste navegador. O snapshot não foi declarado como persistido.');
              }
            }}
          >
            Arquivar relatório imutável
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              const report = exportAnalyticsReport(createAnalyticsSnapshot(analytics, new Date().toISOString()), 'CSV');
              downloadReport(report.content, report.filename, report.mime);
            }}
          >
            Exportar CSV
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              const report = exportAnalyticsReport(createAnalyticsSnapshot(analytics, new Date().toISOString()), 'JSON');
              downloadReport(report.content, report.filename, report.mime);
            }}
          >
            Exportar JSON
          </button>
        </div>
        <p className="muted">Exportação é relatório, não backup. Nenhum token ou rascunho é incluído.</p>
        {archiveError ? <p className="inline-notice" role="alert" data-testid="analytics-archive-error">{archiveError}</p> : null}
      </section>

      <section className="panel" aria-labelledby="analytics-archive-title">
        <header className="section-header">
          <h3 id="analytics-archive-title">Arquivo histórico local</h3>
          <span className="muted">{snapshots.length} snapshot(s)</span>
        </header>
        {snapshots.length === 0 ? (
          <p className="empty-state">Nenhum snapshot arquivado. A fonte atual não foi substituída.</p>
        ) : (
          <ul className="dashboard-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.createdAt}>
                <span>{snapshot.createdAt} · método {snapshot.methodology.version}</span>
                <button type="button" className="button-ghost" onClick={() => setOpenedSnapshot(snapshot)}>Abrir</button>
              </li>
            ))}
          </ul>
        )}
        {openedSnapshot ? (
          <div className="inline-notice" role="status" data-testid="opened-analytics-snapshot">
            <strong>Snapshot somente leitura.</strong> Criado em {openedSnapshot.createdAt}, método {openedSnapshot.methodology.version}, período {openedSnapshot.summary.period.from} a {openedSnapshot.summary.period.to}.
            <button type="button" className="button-ghost" onClick={() => setOpenedSnapshot(null)}>Fechar snapshot</button>
            <div className="table-scroll">
              <table className="data-table">
                <caption>Valores congelados com o snapshot</caption>
                <thead><tr><th scope="col">Métrica</th><th scope="col">Valor</th><th scope="col">Denominador</th></tr></thead>
                <tbody>
                  {openedSnapshot.table.map((row) => (
                    <tr key={row.metricId}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value === null ? '—' : `${row.value} ${row.unit}`}</td>
                      <td>{row.denominator ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

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
          <strong className="kpi-value">
            {analytics.sessions.inPeriod > 0 ? formatFocusDuration(analytics.sessions.focusMs) : '—'}
          </strong>
          <span className="kpi-note">{analytics.sessions.inPeriod} sessão(ões) concluída(s) no período</span>
        </article>
        <article className="kpi-card">
          <span className="kpi-label">Tempo planejado</span>
          <strong className="kpi-value">
            {analytics.planned.activeScenarios > 0 ? `${analytics.planned.minutes} min` : '—'}
          </strong>
          <span className="kpi-note">
            {analytics.planned.blocks} bloco(s) em {analytics.planned.activeScenarios} cenário(s) ativo(s)
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-label">Questões registradas</span>
          <strong className="kpi-value">{analytics.questions.total === 0 ? '—' : analytics.questions.total}</strong>
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

