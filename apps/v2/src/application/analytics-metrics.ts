import type { AnalyticsSummary } from './experience-queries';

export type AnalyticsMetricEvidence = {
  id: string;
  label: string;
  value: number | null;
  unit: 'minutes' | 'percent' | 'count';
  numerator: number;
  denominator: number | null;
  numeratorLabel: string;
  denominatorLabel: string | null;
  source: string;
  methodVersion: string;
};

export type ChartSeriesSpec = { id: string; unit: string };
export type ChartSpec = { chartType: 'line' | 'bar'; series: ChartSeriesSpec[] };

export type AnalyticsSnapshot = Readonly<{
  schemaVersion: 1;
  createdAt: string;
  methodology: Readonly<{ version: string; description: string; source: string }>;
  summary: AnalyticsSummary;
  chart: ReadonlyArray<ChartRow>;
  table: ReadonlyArray<ChartRow>;
}>;

export type ChartRow = {
  metricId: string;
  label: string;
  value: number | null;
  unit: string;
  numerator: number;
  denominator: number | null;
};

const METHOD_VERSION = 'f7-ux-v1';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function buildAnalyticsEvidence(summary: AnalyticsSummary): AnalyticsMetricEvidence[] {
  return [
    {
      id: 'focus-time',
      label: 'Tempo de foco executado',
      value: summary.sessions.inPeriod > 0 ? Math.round(summary.sessions.focusMs / 60_000) : null,
      unit: 'minutes',
      numerator: summary.sessions.focusMs,
      denominator: null,
      numeratorLabel: 'milissegundos verificados',
      denominatorLabel: null,
      source: summary.source,
      methodVersion: METHOD_VERSION,
    },
    {
      id: 'planned-time',
      label: 'Tempo planejado',
      value: summary.planned.activeScenarios > 0 ? summary.planned.minutes : null,
      unit: 'minutes',
      numerator: summary.planned.minutes,
      denominator: null,
      numeratorLabel: 'minutos planejados',
      denominatorLabel: null,
      source: 'F3 blocos de cenários ativos',
      methodVersion: METHOD_VERSION,
    },
    {
      id: 'questions',
      label: 'Questões registradas',
      value: summary.questions.total > 0 ? summary.questions.total : null,
      unit: 'count',
      numerator: summary.questions.total,
      denominator: null,
      numeratorLabel: 'questões registradas',
      denominatorLabel: null,
      source: 'F4 medições de sessões concluídas',
      methodVersion: METHOD_VERSION,
    },
    {
      id: 'accuracy',
      label: 'Aproveitamento',
      value:
        summary.questions.accuracy === null || summary.questions.total < 10
          ? null
          : Math.round(summary.questions.accuracy * 1000) / 10,
      unit: 'percent',
      numerator: summary.questions.correct,
      denominator: summary.questions.total || null,
      numeratorLabel: 'acertos',
      denominatorLabel: summary.questions.total > 0 ? 'questões registradas' : null,
      source: 'F4 medições de sessões concluídas',
      methodVersion: METHOD_VERSION,
    },
  ];
}

export function validateChartSpec(
  spec: ChartSpec,
  options: { requireDenominator?: boolean } = {},
): { ok: true } | { ok: false; code: string; message: string } {
  if (spec.series.length === 0) return { ok: false, code: 'EMPTY_SERIES', message: 'Adicione ao menos uma série.' };
  const units = new Set(spec.series.map((series) => series.unit));
  if (units.size > 1) {
    return { ok: false, code: 'INCOMPATIBLE_UNITS', message: 'Séries com unidades diferentes não podem dividir o mesmo eixo.' };
  }
  if (options.requireDenominator) {
    const denominatorless = spec.series.find((series) => series.id === 'accuracy');
    if (denominatorless) return { ok: false, code: 'MISSING_DENOMINATOR', message: 'A série exige denominador explícito.' };
  }
  return { ok: true };
}

export function createAnalyticsSnapshot(summary: AnalyticsSummary, createdAt: string): AnalyticsSnapshot {
  const copy = deepFreeze(structuredClone(summary));
  const evidence = buildAnalyticsEvidence(copy);
  const table: ChartRow[] = evidence.map((metric) => ({
    metricId: metric.id,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    numerator: metric.numerator,
    denominator: metric.denominator,
  }));
  for (const group of [
    ['edital', copy.byEdital],
    ['disciplina', copy.byDiscipline],
    ['dia', copy.byDay],
  ] as const) {
    for (const bucket of group[1]) {
      table.push({
        metricId: `bucket:${group[0]}:${bucket.id}`,
        label: bucket.label,
        value: Math.round(bucket.focusMs / 60_000),
        unit: 'minutes',
        numerator: bucket.focusMs,
        denominator: null,
      });
    }
  }
  return deepFreeze({
    schemaVersion: 1 as const,
    createdAt,
    methodology: Object.freeze({
      version: METHOD_VERSION,
      description: 'Contagens e durações derivadas de fatos F2–F5; método congelado com o snapshot.',
      source: copy.source,
    }),
    summary: copy,
    chart: table.map((row) => ({ ...row })),
    table: table.map((row) => ({ ...row })),
  });
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function exportAnalyticsReport(
  snapshot: AnalyticsSnapshot,
  format: 'CSV' | 'JSON',
): { filename: string; mime: string; content: string } {
  const date = snapshot.createdAt.slice(0, 10);
  if (format === 'JSON') {
    return {
      filename: `analise-${date}.json`,
      mime: 'application/json',
      content: JSON.stringify({
        schemaVersion: snapshot.schemaVersion,
        createdAt: snapshot.createdAt,
        scope: snapshot.summary.scope,
        period: snapshot.summary.period,
        methodology: snapshot.methodology,
        chart: snapshot.chart,
        table: snapshot.table,
      }, null, 2),
    };
  }
  const lines = [
    ['metodologia', snapshot.methodology.version].map(csvCell).join(','),
    ['descricao', snapshot.methodology.description].map(csvCell).join(','),
    ['fonte', snapshot.methodology.source].map(csvCell).join(','),
    '',
    ['rotulo', 'valor', 'unidade', 'numerador', 'denominador'].join(','),
    ...snapshot.table.map((row) =>
      [row.label, row.value, row.unit, row.numerator, row.denominator]
        .map(csvCell)
        .join(','),
    ),
  ];
  return {
    filename: `analise-${date}.csv`,
    mime: 'text/csv;charset=utf-8',
    content: lines.join('\r\n'),
  };
}
