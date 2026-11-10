import type { AnalyticsSummary, HomeSummary } from './experience-queries';
import type { ContentSnapshot } from './content-service';
import type { StudySession } from '../domain/session';
import { sessionTotalFocusMs } from '../domain/session-accounting';

export type WidgetQueryScope = 'ALL' | 'REVIEWS' | 'PLANNING' | 'CONTENT' | 'INTEGRITY';

export type WidgetMetricSpec =
  | 'STUDY_TIME'
  | 'QUESTIONS'
  | 'QUESTION_ACCURACY'
  | 'REVIEWS_DUE'
  | 'PLANNED_MINUTES'
  | 'PLANNED_BLOCKS'
  | 'STUDY_TIME_BY_EXAM';

export type WidgetDataInput = {
  summary: HomeSummary;
  analytics: AnalyticsSummary;
  content: ContentSnapshot;
  sessions?: StudySession[];
};

export type WidgetMetricResult = {
  metric: WidgetMetricSpec | string;
  status: 'READY' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE';
  value: number | null;
  unit: 'minutes' | 'count' | 'percent' | 'blocks' | 'exams';
  numerator: number | null;
  denominator: number | null;
  sampleSize: number;
  provenance: string;
  warnings: string[];
};

function base(input: WidgetDataInput, metric: string): Omit<WidgetMetricResult, 'status' | 'value' | 'unit' | 'numerator' | 'denominator' | 'warnings'> {
  return {
    metric,
    sampleSize: input.analytics.sessions.inPeriod,
    provenance: `${input.analytics.source}; escopo ${input.analytics.scope}; período ${input.analytics.period.from} a ${input.analytics.period.to}.`,
  };
}

/**
 * Read-only widget projection. Every unavailable state stays explicit; no
 * query creates a fact, starts a session or writes to the presentation state.
 */
export function queryWidgetMetric(
  metric: WidgetMetricSpec | string,
  input: WidgetDataInput,
  scope: WidgetQueryScope = 'ALL',
): WidgetMetricResult {
  const common = base(input, metric);
  const outOfScope = (unit: WidgetMetricResult['unit']): WidgetMetricResult => ({
    ...common,
    status: 'UNAVAILABLE',
    value: null,
    unit,
    numerator: null,
    denominator: null,
    warnings: [`Fora do escopo ${scope}; nenhum valor foi transportado de outro recorte.`],
  });
  if (scope === 'INTEGRITY') return outOfScope('count');
  switch (metric) {
    case 'STUDY_TIME': {
      if (scope === 'REVIEWS') return outOfScope('minutes');
      const scopedSessions = (input.sessions ?? []).filter((session) => {
        if (session.profileId !== input.analytics.profileId || session.state !== 'COMPLETED' || session.tombstone) {
          return false;
        }
        const date = session.recordedAtCivilDate;
        if (
          typeof date !== 'string' ||
          date < input.analytics.period.from ||
          date > input.analytics.period.to
        ) {
          return false;
        }
        if (scope === 'PLANNING') return (session.planBlockIds ?? []).length > 0;
        if (scope === 'CONTENT') {
          return (session.allocations ?? []).length > 0 || (session.measurements ?? []).length > 0;
        }
        return true;
      });
      const value =
        scope === 'ALL'
          ? input.analytics.sessions.inPeriod === 0
            ? null
            : Math.round(input.analytics.sessions.focusMs / 60_000)
          : scopedSessions.length === 0
            ? null
            : Math.round(scopedSessions.reduce((sum, session) => sum + sessionTotalFocusMs(session), 0) / 60_000);
      return {
        ...common,
        status:
          (scope === 'ALL' ? input.analytics.sessions.inPeriod === 0 : scopedSessions.length === 0)
            ? 'INSUFFICIENT_DATA'
            : input.analytics.status === 'PARTIAL'
              ? 'PARTIAL'
              : 'READY',
        value,
        unit: 'minutes',
        numerator: input.analytics.sessions.focusMs,
        denominator: null,
        warnings:
          (scope === 'ALL' ? input.analytics.sessions.inPeriod === 0 : scopedSessions.length === 0)
            ? [`Sem sessões no escopo ${scope}; ausência não é zero.`]
            : input.analytics.warnings,
      };
    }
    case 'QUESTIONS':
      if (scope !== 'ALL' && scope !== 'CONTENT') return outOfScope('count');
      return {
        ...common,
        status: input.analytics.questions.total > 0 ? 'READY' : 'UNAVAILABLE',
        value: input.analytics.questions.total > 0 ? input.analytics.questions.total : null,
        unit: 'count',
        numerator: input.analytics.questions.total,
        denominator: null,
        warnings: input.analytics.questions.total > 0 ? [] : ['Sem medições de questões no período.'],
      };
    case 'QUESTION_ACCURACY':
      if (scope !== 'ALL' && scope !== 'CONTENT') return outOfScope('percent');
      if (input.analytics.questions.total <= 0 || input.analytics.questions.accuracy === null) {
        return {
          ...common,
          status: 'UNAVAILABLE',
          value: null,
          unit: 'percent',
          numerator: input.analytics.questions.correct,
          denominator: null,
          warnings: ['Denominador de questões ausente.'],
        };
      }
      return {
        ...common,
        status: input.analytics.questions.total < 10 ? 'INSUFFICIENT_DATA' : 'READY',
        value:
          input.analytics.questions.total < 10
            ? null
            : Math.round(input.analytics.questions.accuracy * 1000) / 10,
        unit: 'percent',
        numerator: input.analytics.questions.correct,
        denominator: input.analytics.questions.total,
        warnings: input.analytics.questions.total < 10 ? ['Amostra pequena; use como diagnóstico.'] : [],
      };
    case 'REVIEWS_DUE':
      if (scope !== 'ALL' && scope !== 'REVIEWS') return outOfScope('count');
      return {
        ...common,
        status: 'READY',
        value: input.summary.counts.reviewsDue,
        unit: 'count',
        numerator: input.summary.counts.reviewsDue,
        denominator: null,
        warnings: [],
      };
    case 'PLANNED_MINUTES':
      if (scope !== 'ALL' && scope !== 'PLANNING') return outOfScope('minutes');
      return {
        ...common,
        status: input.analytics.planned.activeScenarios > 0 ? 'READY' : 'UNAVAILABLE',
        value: input.analytics.planned.activeScenarios > 0 ? input.analytics.planned.minutes : null,
        unit: 'minutes',
        numerator: input.analytics.planned.minutes,
        denominator: null,
        warnings: [],
      };
    case 'PLANNED_BLOCKS':
      if (scope !== 'ALL' && scope !== 'PLANNING') return outOfScope('blocks');
      return {
        ...common,
        status: input.analytics.planned.activeScenarios > 0 ? 'READY' : 'UNAVAILABLE',
        value: input.analytics.planned.activeScenarios > 0 ? input.analytics.planned.blocks : null,
        unit: 'blocks',
        numerator: input.analytics.planned.blocks,
        denominator: null,
        warnings: [],
      };
    case 'STUDY_TIME_BY_EXAM':
      if (scope === 'REVIEWS') return outOfScope('exams');
      return {
        ...common,
        status:
          input.analytics.byEdital.length === 0
            ? 'UNAVAILABLE'
            : input.analytics.sharedSessions > 0
              ? 'PARTIAL'
              : 'READY',
        value: input.analytics.byEdital.length > 0 ? input.analytics.byEdital.length : null,
        unit: 'exams',
        numerator: input.analytics.byEdital.length,
        denominator: null,
        warnings:
          input.analytics.sharedSessions > 0
            ? [`Sessões compartilhadas: ${input.analytics.sharedSessions}. Elas não foram somadas em cada edital.`]
            : [],
      };
    default:
      return {
        ...common,
        status: 'UNAVAILABLE',
        value: null,
        unit: 'count',
        numerator: null,
        denominator: null,
        warnings: ['Métrica não reconhecida; nenhum zero foi inferido.'],
      };
  }
}

export const WIDGET_METRIC_OPTIONS: Array<{ id: WidgetMetricSpec; label: string; unit: string }> = [
  { id: 'STUDY_TIME', label: 'Tempo de foco executado', unit: 'minutos' },
  { id: 'QUESTIONS', label: 'Questões registradas', unit: 'questões' },
  { id: 'QUESTION_ACCURACY', label: 'Aproveitamento em questões', unit: '%' },
  { id: 'REVIEWS_DUE', label: 'Revisões vencidas ou de hoje', unit: 'itens' },
  { id: 'PLANNED_MINUTES', label: 'Tempo planejado', unit: 'minutos' },
  { id: 'PLANNED_BLOCKS', label: 'Blocos planejados', unit: 'blocos' },
  { id: 'STUDY_TIME_BY_EXAM', label: 'Cobertura por concurso', unit: 'concursos' },
];
