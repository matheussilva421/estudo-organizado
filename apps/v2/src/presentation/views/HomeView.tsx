import { useEffect, useState } from 'react';
import { StudyScene } from '../components/StudyScene';
import {
  DEFAULT_HOME_INDICATORS,
  HOME_INDICATORS,
  HOME_MODE_OPTIONS,
  orderPrioritiesForMode,
  selectHomeIndicators,
  type AnalyticsSummary,
  type HomeIndicatorId,
  type HomeMode,
  type HomeSummary,
} from '../../application/experience-queries';
import { queryWidgetMetric, type WidgetMetricSpec } from '../../application/widget-queries';
import {
  applyDashboardTemplate,
  dashboardWidgetsForTemplate,
  moveDashboardWidget,
  resolveDashboardLayout,
  updateDashboardDevice,
  type DashboardDevice,
  type DashboardState,
  type DashboardTemplate,
  type DashboardWidgetId,
} from '../dashboard-layout';
import {
  evaluateWidgetExpression,
  parseWidgetExpression,
} from '../../domain/widget-expression';
import type { SyncHealth } from '../../application/sync-types';
import type { StudySession } from '../../domain/session';
import type { UxEvidence } from '../ux-evidence';
import {
  applyScopeToGroup,
  effectiveWidgetFilter,
  EMPTY_WIDGET_FILTERS,
  setWidgetScope,
  type WidgetScope,
} from '../widget-filters';
import { routeHref } from '../routing';
import {
  PRIORITY_CATEGORY_LABELS,
  priorityTone,
  routeForTarget,
} from './priority-display';

type Props = {
  profileId: string;
  summary: HomeSummary;
  analytics: AnalyticsSummary;
  health: SyncHealth;
  evidence: UxEvidence[];
  sessions: StudySession[];
  ready: boolean;
  loadError: string | null;
  experienceError: boolean;
  finalStretch?: { examDate: string | null; name: string } | null;
  plannedTodayMinutes?: number;
  onRetry: () => void;
};

const MODE_KEY = 'estudo-organizado:v2:home-mode';
const INDICATORS_KEY = 'estudo-organizado:v2:home-indicators';
const DASHBOARD_KEY = 'estudo-organizado:v2:home-dashboard';
const CUSTOM_WIDGETS_KEY = 'estudo-organizado:v2:home-custom-widgets';
const ONBOARDING_KEY = 'estudo-organizado:v2:home-onboarding-dismissed';

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  'next-action': 'Próxima ação',
  agenda: 'Agenda de estudos',
  'study-time': 'Tempo estudado',
  reviews: 'Revisões',
  questions: 'Questões e desempenho',
  planning: 'Planejado × executado',
  exams: 'Concursos e provas',
};

const WIDGET_ICON_PATHS: Record<DashboardWidgetId, string> = {
  'next-action': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  agenda: 'M4 6h16v14H4zM8 3v5M16 3v5M4 10h16M8 14l2 2 4-4',
  exams: 'M12 4 3 8l9 4 9-4-9-4zM6 11v5c0 2 12 2 12 0v-5',
  'study-time': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  reviews: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  questions: 'M9 9a3 3 0 1 1 4 2.8c-.7.4-1 1-1 1.8v.4M12 17.5h.01',
  planning: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 15h3M13 15h3',
};

function MiniBars({ days }: { days: AnalyticsSummary['byDay'] }) {
  const recent = days.slice(-7);
  if (!recent.some((day) => day.focusMs > 0)) return null;
  const max = Math.max(1, ...recent.map((day) => day.focusMs));
  return (
    <div className="mini-bars" aria-hidden="true">
      {recent.length === 0 ? (
        <span className="mini-bars-empty" />
      ) : (
        recent.map((day) => (
          <span
            key={day.id}
            style={{ height: Math.max(6, Math.round((day.focusMs / max) * 100)) + '%' }}
          />
        ))
      )}
    </div>
  );
}

const TEMPLATE_LABELS: Record<DashboardTemplate, string> = {
  FOCUS: 'Foco Diário',
  PERFORMANCE: 'Desempenho',
  FINAL_STRETCH: 'Reta Final',
  CUSTOM: 'Personalizado',
};

type CustomWidget = { id: string; label: string; formula: string };

function profilePreferenceKey(base: string, profileId: string): string {
  return `${base}:${profileId}`;
}

function readMode(profileId: string): HomeMode {
  try {
    const stored =
      window.localStorage.getItem(profilePreferenceKey(MODE_KEY, profileId)) ??
      window.localStorage.getItem(MODE_KEY);
    return HOME_MODE_OPTIONS.some((option) => option.id === stored)
      ? (stored as HomeMode)
      : 'DAILY';
  } catch {
    return 'DAILY';
  }
}

function readIndicators(profileId: string): HomeIndicatorId[] {
  try {
    const stored =
      window.localStorage.getItem(profilePreferenceKey(INDICATORS_KEY, profileId)) ??
      window.localStorage.getItem(INDICATORS_KEY);
    if (stored === null) return DEFAULT_HOME_INDICATORS;
    const parsed = stored.split(',').filter((item) => item.length > 0);
    return HOME_INDICATORS.filter((indicator) => parsed.includes(indicator.id)).map(
      (indicator) => indicator.id,
    );
  } catch {
    return DEFAULT_HOME_INDICATORS;
  }
}

function inferDevice(): DashboardDevice {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 720px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

function readDashboard(profileId: string): DashboardState {
  try {
    const raw = window.localStorage.getItem(`${DASHBOARD_KEY}:${profileId}`);
    if (!raw) return { ...dashboardBase(), devices: {} };
    const parsed = JSON.parse(raw) as Partial<DashboardState>;
    if (!parsed || typeof parsed !== 'object') return { ...dashboardBase(), devices: {} };
    const template = parsed.template && parsed.template in TEMPLATE_LABELS ? parsed.template : 'FOCUS';
    const widgets = Array.isArray(parsed.widgets) ? parsed.widgets : dashboardWidgetsForTemplate(template);
    return {
      template,
      widgets: widgets.filter((widget) => widget && widget.id in WIDGET_LABELS),
      devices: parsed.devices && typeof parsed.devices === 'object' ? parsed.devices : {},
    };
  } catch {
    return { ...dashboardBase(), devices: {} };
  }
}

function dashboardBase(): DashboardState {
  return { template: 'FOCUS', widgets: dashboardWidgetsForTemplate('FOCUS'), devices: {} };
}

function readCustomWidgets(profileId: string): CustomWidget[] {
  try {
    const raw = window.localStorage.getItem(`${CUSTOM_WIDGETS_KEY}:${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomWidget[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (widget) =>
            typeof widget?.id === 'string' &&
            typeof widget.label === 'string' &&
            typeof widget.formula === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function persist(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function persistScalar(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Presentation preference remains in memory when storage is unavailable.
  }
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) return 'Indisponível';
  if (unit === 'percent') return `${value}%`;
  if (unit === 'minutes') return `${value} min`;
  if (unit === 'count') return String(value);
  if (unit === 'blocks') return `${value} bloco(s)`;
  if (unit === 'exams') return `${value} concurso(s)`;
  return String(value);
}

function widgetBelongsToScope(id: DashboardWidgetId, scope: WidgetScope): boolean {
  if (scope === 'ALL') return true;
  if (scope === 'REVIEWS') return ['next-action', 'agenda', 'reviews'].includes(id);
  if (scope === 'PLANNING') return ['next-action', 'agenda', 'study-time', 'planning', 'exams'].includes(id);
  if (scope === 'CONTENT') return ['next-action', 'agenda', 'study-time', 'questions', 'exams'].includes(id);
  return ['next-action', 'agenda'].includes(id);
}

export function HomeView({
  profileId,
  summary,
  analytics,
  health,
  evidence,
  sessions,
  ready,
  loadError,
  experienceError,
  finalStretch = null,
  plannedTodayMinutes = 0,
  onRetry,
}: Props) {
  const [mode, setMode] = useState<HomeMode>(() => readMode(profileId));
  const [visibleIndicators, setVisibleIndicators] = useState<HomeIndicatorId[]>(() =>
    readIndicators(profileId),
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_KEY + ':' + profileId) === '1';
    } catch {
      return false;
    }
  });
  const [dashboard, setDashboard] = useState<DashboardState>(() => readDashboard(profileId));
  const [layoutHistory, setLayoutHistory] = useState<DashboardState[]>([]);
  const [layoutPersistError, setLayoutPersistError] = useState(false);
  const [device, setDevice] = useState<DashboardDevice>(inferDevice);
  const [widgetFilters, setWidgetFilters] = useState(EMPTY_WIDGET_FILTERS);
  const [inspector, setInspector] = useState<DashboardWidgetId | null>(null);
  const [customWidgets, setCustomWidgets] = useState<CustomWidget[]>(() => readCustomWidgets(profileId));
  const [customLabel, setCustomLabel] = useState('Meu indicador');
  const [formula, setFormula] = useState('correct / questions');
  const [orderApplied, setOrderApplied] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 720px)');
    const tablet = window.matchMedia('(min-width: 721px) and (max-width: 1023px)');
    const update = () => setDevice(inferDevice());
    mobile.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      mobile.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);

  const layout = resolveDashboardLayout(dashboard, device);
  const filter = widgetFilters.global;
  const visibleLayoutWidgets = layout.widgets.filter((widget) =>
    widgetBelongsToScope(widget.id, effectiveWidgetFilter(widget.id, widgetFilters).scope),
  );
  const orderedPriorities = orderPrioritiesForMode(summary.priorities, mode);
  const filteredPriorities = orderedPriorities.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'REVIEWS') return item.category.startsWith('REVISAO');
    if (filter === 'PLANNING') return item.target === 'planning';
    if (filter === 'CONTENT') return item.target === 'content';
    return item.category === 'INTEGRIDADE' || item.category === 'DIAGNOSTICO';
  });
  const isSystemPriority = (item: (typeof orderedPriorities)[number]) =>
    item.category === 'INTEGRIDADE' || item.category === 'DIAGNOSTICO';
  // Academic work leads the surface; operational diagnostics stay available in
  // the Attention centre and sync strip instead of repeating on every card.
  const displayPriorities =
    filter === 'ALL'
      ? [
          ...filteredPriorities.filter((item) => !isSystemPriority(item)),
          ...filteredPriorities.filter(isSystemPriority),
        ]
      : filteredPriorities;
  const nextAction =
    displayPriorities[0] ?? (filter === 'ALL' ? summary.nextAction : null);
  // The hero is an academic surface: operational diagnostics must not become
  // the "next study action" when no academic priority is pending.
  const academicNextAction =
    displayPriorities.find((item) => !isSystemPriority(item)) ?? null;
  const indicators = selectHomeIndicators(summary.counts, visibleIndicators);
  const metricInput = { summary, analytics, content: emptyContent(), sessions };
  const metricValues: Partial<Record<WidgetMetricSpec, ReturnType<typeof queryWidgetMetric>>> = {
    STUDY_TIME: queryWidgetMetric(
      'STUDY_TIME',
      metricInput,
      effectiveWidgetFilter('study-time', widgetFilters).scope,
    ),
    QUESTIONS: queryWidgetMetric(
      'QUESTIONS',
      metricInput,
      effectiveWidgetFilter('questions', widgetFilters).scope,
    ),
    QUESTION_ACCURACY: queryWidgetMetric(
      'QUESTION_ACCURACY',
      metricInput,
      effectiveWidgetFilter('questions', widgetFilters).scope,
    ),
    REVIEWS_DUE: queryWidgetMetric(
      'REVIEWS_DUE',
      metricInput,
      effectiveWidgetFilter('reviews', widgetFilters).scope,
    ),
    PLANNED_MINUTES: queryWidgetMetric(
      'PLANNED_MINUTES',
      metricInput,
      effectiveWidgetFilter('planning', widgetFilters).scope,
    ),
    PLANNED_BLOCKS: queryWidgetMetric(
      'PLANNED_BLOCKS',
      metricInput,
      effectiveWidgetFilter('planning', widgetFilters).scope,
    ),
    STUDY_TIME_BY_EXAM: queryWidgetMetric(
      'STUDY_TIME_BY_EXAM',
      metricInput,
      effectiveWidgetFilter('exams', widgetFilters).scope,
    ),
  };

  const expressionMetrics = {
    study_time: {
      value: metricValues.STUDY_TIME?.value ?? null,
      unit: 'minutes',
      sampleSize: metricValues.STUDY_TIME?.sampleSize ?? 0,
      denominator: null,
    },
    planned_time: {
      value: metricValues.PLANNED_MINUTES?.value ?? null,
      unit: 'minutes',
      sampleSize: metricValues.PLANNED_MINUTES?.sampleSize ?? 0,
      denominator: null,
    },
    questions: {
      value: analytics.questions.total,
      unit: 'questions',
      sampleSize: analytics.questions.total,
      denominator: analytics.questions.total || null,
    },
    correct: {
      value: analytics.questions.correct,
      unit: 'questions',
      sampleSize: analytics.questions.total,
      denominator: analytics.questions.total || null,
    },
    reviews: {
      value: metricValues.REVIEWS_DUE?.value ?? null,
      unit: 'count',
      sampleSize: metricValues.REVIEWS_DUE?.sampleSize ?? 0,
      denominator: null,
    },
  };
  const parsedFormula = parseWidgetExpression(formula);
  const formulaPreview = parsedFormula.ok
    ? evaluateWidgetExpression(parsedFormula.ast, expressionMetrics)
    : parsedFormula;

  function changeMode(next: HomeMode): void {
    setMode(next);
    persistScalar(profilePreferenceKey(MODE_KEY, profileId), next);
  }

  function toggleIndicator(id: HomeIndicatorId): void {
    const selected = visibleIndicators.includes(id)
      ? visibleIndicators.filter((item) => item !== id)
      : HOME_INDICATORS.filter(
          (indicator) => indicator.id === id || visibleIndicators.includes(indicator.id),
        ).map((indicator) => indicator.id);
    setVisibleIndicators(selected);
    persistScalar(profilePreferenceKey(INDICATORS_KEY, profileId), selected.join(','));
  }

  function commitDashboard(next: DashboardState): void {
    setLayoutHistory((history) => [...history, dashboard].slice(-10));
    setDashboard(next);
    setLayoutPersistError(!persist(`${DASHBOARD_KEY}:${profileId}`, next));
  }

  function undoLayout(): void {
    const previous = layoutHistory.at(-1);
    if (!previous) return;
    setLayoutHistory((history) => history.slice(0, -1));
    setDashboard(previous);
    setLayoutPersistError(!persist(`${DASHBOARD_KEY}:${profileId}`, previous));
  }

  function changeTemplate(template: DashboardTemplate): void {
    commitDashboard(applyDashboardTemplate(dashboard, template));
    setInspector(null);
  }

  function toggleWidget(id: DashboardWidgetId): void {
    const current = layout.widgets.map((widget) => widget.id);
    const widgetIds = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    commitDashboard(updateDashboardDevice(dashboard, device, { widgetIds }));
  }

  function moveWidget(id: DashboardWidgetId, delta: -1 | 1): void {
    const widgetIds = moveDashboardWidget(layout.widgets.map((widget) => widget.id), id, delta);
    commitDashboard(updateDashboardDevice(dashboard, device, { widgetIds }));
  }

  function saveCustomWidget(): void {
    if (!parsedFormula.ok || !formulaPreview.ok || customLabel.trim().length === 0) return;
    const next = [
      ...customWidgets,
      { id: `custom-${Date.now()}`, label: customLabel.trim().slice(0, 80), formula },
    ];
    setCustomWidgets(next);
    persist(`${CUSTOM_WIDGETS_KEY}:${profileId}`, next);
  }

  function removeCustomWidget(id: string): void {
    const next = customWidgets.filter((widget) => widget.id !== id);
    setCustomWidgets(next);
    persist(`${CUSTOM_WIDGETS_KEY}:${profileId}`, next);
  }

  function renderWidget(id: DashboardWidgetId) {
    if (id === 'next-action') {
      return widgetPriority ? (
        <>
          <h3>{widgetPriority.title}</h3>
          <p>{widgetPriority.detail}</p>
          <p className="priority-meta">
            <span className={`chip chip-${priorityTone(widgetPriority.category)}`}>
              {PRIORITY_CATEGORY_LABELS[widgetPriority.category]}
            </span>
            {widgetPriority.dueDate ? <span className="muted">{widgetPriority.dueDate}</span> : null}
          </p>
          <a
            className="button-primary"
            href={routeHref(routeForTarget(widgetPriority.target, widgetPriority.entityId ?? null))}
          >
            Abrir registro exato
          </a>
        </>
      ) : (
        <>
          <h3>Resumo do período</h3>
          <ul className="dashboard-list" data-testid="home-summary-counts">
            <li><span>Sessões concluídas (7 dias)</span><strong>{summary.counts.completedLast7Days}</strong></li>
            <li><span>Revisões pendentes</span><strong>{summary.counts.reviewsDue}</strong></li>
            <li><span>Editais ativos</span><strong>{summary.counts.activeEditais}</strong></li>
          </ul>
          <a className="button-ghost" href="#/analytics">Ver análises</a>
        </>
      );
    }
    if (id === 'agenda') {
      return (
        <>
          <h3>Agenda e pendências</h3>
          {agendaPriorities.length === 0 ? (
            <p>
              Nenhuma pendência acadêmica nesta visão.{' '}
              {hasSystemDiagnostics ? (
                <a href="#/attention">Revisar diagnósticos na Central de Atenção</a>
              ) : null}
            </p>
          ) : (
            <ol className="dashboard-list">
              {agendaPriorities.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <a href={routeHref(routeForTarget(item.target, item.entityId ?? null))}>Abrir</a>
                </li>
              ))}
            </ol>
          )}
        </>
      );
    }
    if (id === 'exams') {
      return (
        <>
          <h3>Concursos acompanhados</h3>
          <strong className="widget-value">{summary.counts.activeEditais}</strong>
          <p>Editais ativos. Nenhuma data de prova não registrada foi inferida.</p>
          <a href="#/content">Ver conteúdo</a>
        </>
      );
    }
    const metric =
      id === 'study-time' ? metricValues.STUDY_TIME
        : id === 'reviews' ? metricValues.REVIEWS_DUE
          : id === 'questions' ? metricValues.QUESTION_ACCURACY
            : metricValues.PLANNED_MINUTES;
    return (
      <>
        <h3>{WIDGET_LABELS[id]}</h3>
        <strong className={metric?.value == null ? 'widget-value widget-value-empty' : 'widget-value'}>
          {metric?.value == null ? 'Sem dado no período' : formatMetric(metric.value, metric.unit)}
        </strong>
        {id === 'study-time' ? <MiniBars days={analytics.byDay} /> : null}
        <p>{metric?.status === 'READY' ? metric.provenance : metric?.warnings[0] ?? 'Sem dado disponível.'}</p>
        <button type="button" className="button-ghost" onClick={() => setInspector(id)}>
          Ver procedência
        </button>
      </>
    );
  }

  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const focusTodayMinutes = Math.round(
    (analytics.byDay.find((day) => day.id === todayIso)?.focusMs ?? 0) / 60_000,
  );
  const dailyGoalRatio =
    plannedTodayMinutes > 0
      ? Math.min(100, Math.round((focusTodayMinutes / plannedTodayMinutes) * 100))
      : null;
  const pendingReviewItems = summary.priorities.filter(
    (item) =>
      item.category.startsWith('REVISAO') ||
      (item.category === 'ATIVIDADE_FUTURA' && item.target === 'reviews'),
  );
  const nextReview =
    pendingReviewItems
      .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))[0] ?? null;
  const weekStartIso = new Date(
    Date.parse(todayIso + 'T00:00:00Z') - 6 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const weekSeries = analytics.byDay.filter(
    (day) => day.id >= weekStartIso && day.id <= todayIso,
  );
  const weekFocusMinutes = Math.round(
    weekSeries.reduce((sum, day) => sum + day.focusMs, 0) / 60_000,
  );
  const weekMax = Math.max(1, ...weekSeries.map((day) => day.focusMs));
  const examDays = finalStretch?.examDate
    ? Math.round(
        (Date.parse(finalStretch.examDate + 'T00:00:00Z') -
          Date.parse(todayIso + 'T00:00:00Z')) /
          86_400_000,
      )
    : null;
  const heroContext = summary.activeSession
    ? 'ACTIVE'
    : summary.empty
      ? 'ONBOARDING'
      : examDays !== null && examDays >= 0 && examDays <= 45
        ? 'FINAL_STRETCH'
        : academicNextAction
          ? 'DAILY'
          : summary.counts.completedLast7Days > 0
            ? 'PERFORMANCE'
            : 'DAILY';
  const heroTitle =
    heroContext === 'ACTIVE'
      ? 'Sessão em andamento'
      : heroContext === 'ONBOARDING'
        ? 'Comece pelo essencial'
        : heroContext === 'FINAL_STRETCH'
          ? 'Reta Final em foco'
          : heroContext === 'PERFORMANCE'
            ? 'Acompanhe o que já rendeu'
            : (academicNextAction?.title ?? 'Próximo passo');
  const heroDetail =
    heroContext === 'ACTIVE'
      ? 'Continue de onde parou; esta é a mesma sessão do cronômetro.'
      : heroContext === 'ONBOARDING'
        ? 'Adicione um edital ou disciplina e registre a primeira sessão. Nada é inventado.'
        : heroContext === 'FINAL_STRETCH'
          ? `${finalStretch?.name ?? 'Reta Final'} · ${examDays} dia(s) até a prova registrada.`
          : heroContext === 'PERFORMANCE'
            ? 'Tempo, revisões e evidências derivados dos seus dados locais.'
            : (academicNextAction?.detail ?? 'Abra o planejamento para escolher o próximo bloco.');
  const heroHref =
    heroContext === 'ACTIVE'
      ? '#/sessions'
      : heroContext === 'ONBOARDING'
        ? '#/content'
        : heroContext === 'FINAL_STRETCH'
          ? '#/planning'
          : academicNextAction
            ? routeHref(
                routeForTarget(academicNextAction.target, academicNextAction.entityId ?? null),
              )
            : '#/planning';
  const heroCta =
    heroContext === 'ACTIVE'
      ? 'Continuar sessão'
      : heroContext === 'ONBOARDING'
        ? 'Adicionar conteúdo'
        : heroContext === 'FINAL_STRETCH'
          ? 'Abrir planejamento'
          : 'Começar agora';
  const heroShowsAction = heroContext === 'DAILY';
  const academicPriorities = displayPriorities.filter((item) => !isSystemPriority(item));
  const widgetPriority =
    filter === 'ALL'
      ? academicPriorities.find(
          (item) => !(heroShowsAction && item.id === nextAction?.id),
        ) ?? null
      : nextAction;
  const agendaPriorities =
    filter === 'ALL'
      ? academicPriorities.filter((item) => !(heroShowsAction && item.id === nextAction?.id))
      : displayPriorities;
  const hasSystemDiagnostics = displayPriorities.some(isSystemPriority);
  const suggestedFirst = heroContext === 'FINAL_STRETCH' ? 'planning'
    : heroContext === 'PERFORMANCE' ? 'study-time' : null;
  const suggestedOrder: DashboardWidgetId[] | null = suggestedFirst && !summary.activeSession && !loadError && !experienceError &&
    layout.source === 'base' && dashboard.template === 'FOCUS' && filter === 'ALL' &&
    layout.widgets[0]?.id !== suggestedFirst && layout.widgets.some(({ id }) => id === suggestedFirst)
    ? [suggestedFirst, ...layout.widgets.map(({ id }) => id).filter((id) => id !== suggestedFirst)]
    : null;

  return (
    <section
      className="view home-view"
      aria-labelledby="home-title"
      data-testid="f6-home"
      data-studio="home"
      data-home-mode={mode}
      data-dashboard-template={dashboard.template}
      data-dashboard-device={device}
    >
      <header className="view-header">
        <div>
          <p className="eyebrow">Bem-vindo(a)</p>
          <h2 id="home-title">
            Seu espaço de <span className="title-accent">estudos</span>
          </h2>
          <p className="view-subtitle">
            Planeje, estude, revise e acompanhe sua evolução em um só lugar.
          </p>
        </div>
        <a className="badge" href="#/attention" data-home-ready={ready ? 'true' : 'false'}>
          {health.mode === 'READY' ? 'Integridade local visível' : 'Revisar integridade'}
        </a>
      </header>

      <section
        className="home-hero"
        data-testid="home-hero"
        data-context={heroContext}
        aria-labelledby="home-hero-title"
      >
        <div className="home-hero-copy">
          <p className="eyebrow">
            {heroContext === 'ONBOARDING' ? 'Primeiros passos' : 'Próxima ação'}
          </p>
          <h2 id="home-hero-title">{heroTitle}</h2>
          <p>{heroDetail}</p>
        </div>
        <div className="home-hero-actions">
          <a className="button-primary" href={heroHref} data-action="home-next-action">
            {heroCta}
          </a>
          {heroContext === 'ONBOARDING' && !onboardingDismissed ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                try {
                  window.localStorage.setItem(ONBOARDING_KEY + ':' + profileId, '1');
                } catch {
                  // Dismissal stays in memory when storage is unavailable.
                }
                setOnboardingDismissed(true);
              }}
            >
              Dispensar primeiros passos
            </button>
          ) : null}
        </div>
        <div className="home-hero-art">
          {(['neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial'] as const).map((theme) => (
            <img
              key={theme}
              className="hero-scene"
              data-hero-theme={theme}
              src={'/premium/hero-' + theme + '.webp'}
              alt=""
              aria-hidden="true"
            />
          ))}
          <div className="hero-fallback">
            <StudyScene />
          </div>
        </div>
        {suggestedOrder ? (
          <details key={device + ':' + heroContext}>
            <summary>Ver sugestão de ordem</summary>
            <p>Ordem sugerida para {device === 'desktop' ? 'computador' : device === 'mobile' ? 'celular' : 'tablet'}:</p>
            <ol>{suggestedOrder.map((id) => <li key={id}>{WIDGET_LABELS[id]}</li>)}</ol>
            <button type="button" className="button-ghost" onClick={() => {
              commitDashboard(updateDashboardDevice(dashboard, device, { widgetIds: suggestedOrder }));
              setOrderApplied(true);
              window.requestAnimationFrame(() => {
                document.querySelector<HTMLElement>('.dashboard-widget')?.focus();
              });
            }}>Aplicar ordem sugerida</button>
          </details>
        ) : null}
        {orderApplied ? (
          <p className="hint" role="status">
            Ordem atualizada para {device === 'desktop' ? 'computador' : device === 'mobile' ? 'celular' : 'tablet'}.
          </p>
        ) : null}
      </section>
      {heroContext === 'ONBOARDING' && !onboardingDismissed ? (
        <div className="home-onboarding-row">
          <p className="home-onboarding-intro">Em poucos passos, você deixa tudo pronto:</p>
          <ol className="home-onboarding" aria-label="Primeiros passos">
            <li>Cadastre edital e disciplina</li>
            <li>Defina metas e disponibilidade</li>
            <li>Registre a primeira sessão</li>
            <li>Acompanhe as revisões</li>
          </ol>
        </div>
      ) : null}
      <section className="home-showcase" aria-label="Resumo acadêmico">
        <article className="show-card show-goal">
          <header>
            <span className="widget-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="12" r="1" />
              </svg>
            </span>
            <h3>Meta diária</h3>
          </header>
          <div className="goal-ring" data-testid="home-goal-ring">
            <div className="goal-orbit">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="goal-track" cx="50" cy="50" r="42" />
                {dailyGoalRatio !== null ? (
                  <circle
                    className="goal-value"
                    cx="50"
                    cy="50"
                    r="42"
                    strokeDasharray={(dailyGoalRatio / 100) * 263.9 + ' 263.9'}
                  />
                ) : null}
              </svg>
              <span className="goal-ring-value" aria-hidden="true">
                {dailyGoalRatio === null ? '—' : Math.round(dailyGoalRatio) + '%'}
              </span>
            </div>
            <div className="goal-copy">
              <strong>{focusTodayMinutes} min</strong>
              <span>
                {dailyGoalRatio === null
                  ? 'Sem plano para hoje'
                  : 'de ' + plannedTodayMinutes + ' min planejados'}
              </span>
            </div>
          </div>
          <a href="#/planning">Ajustar planejamento</a>
        </article>
        <article className="show-card show-reviews">
          <header>
            <span className="widget-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4 6h16v14H4zM8 3v5M16 3v5M4 10h16M8 14l2 2 4-4" />
              </svg>
            </span>
            <h3>Próximas revisões</h3>
          </header>
          <strong className="show-number">
            {summary.counts.reviewsDue + pendingReviewItems.filter((item) => item.category === 'ATIVIDADE_FUTURA').length}
          </strong>
          <p>
            {nextReview
              ? nextReview.title + (nextReview.dueDate ? ' · ' + nextReview.dueDate : '')
              : 'Nenhuma revisão pendente agora.'}
          </p>
          <svg className="review-calendar-art" viewBox="0 0 80 78" aria-hidden="true">
            <rect className="calendar-sheet" x="8" y="14" width="64" height="58" rx="10" />
            <path className="calendar-line" d="M8 31h64M23 8v14M57 8v14" />
            <path className="calendar-check" d="m27 54 8 8 18-22" />
          </svg>
          <a href="#/reviews">Abrir revisões</a>
        </article>
        <article className="show-card show-evolution">
          <header>
            <span className="widget-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
            </span>
            <h3>Evolução dos estudos</h3>
            <span className="show-range">Últimas 4 semanas</span>
          </header>
          <div
            className="show-chart"
            data-testid="home-week-chart"
            role="img"
            aria-label={
              'Foco por dia: ' +
              weekSeries.map((day) => day.label + ' ' + Math.round(day.focusMs / 60_000) + ' minutos').join(', ')
            }
          >
            {weekSeries.length > 0 ? (
              weekSeries.map((day) => (
                <span key={day.id}>
                  <i style={{ height: Math.max(6, Math.round((day.focusMs / weekMax) * 100)) + '%' }} />
                  <em>{day.label.slice(-2)}</em>
                </span>
              ))
            ) : (
              <div className="show-chart-empty">
                <span>Sem série no período.</span>
                <div className="show-chart-weeks" aria-hidden="true">
                  <span>Sem 1</span>
                  <span>Sem 2</span>
                  <span>Sem 3</span>
                  <span>Sem 4</span>
                </div>
              </div>
            )}
          </div>
          <p>{weekFocusMinutes} min de foco nos últimos 7 dias.</p>
        </article>
      </section>

      {loadError || experienceError ? (
        <div className="inline-notice" role="alert" data-testid="f6-load-error">
          <strong>Não foi possível ler todos os dados locais.</strong>{' '}
          {loadError ?? 'Uma das consultas falhou.'} Erro não é ausência de dados; nenhum zero foi
          inferido.
          <button type="button" className="button-ghost" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}



      <section className="home-resources" aria-labelledby="home-resources-title">
        <header className="section-header">
          <h3 id="home-resources-title">Recursos principais</h3>
          <a href="#/planning">Explorar todos</a>
        </header>
        <div className="resource-grid">
          {[
            { href: '#/planning', label: 'Planejamento', text: 'Organize sua rotina, metas e capacidade de estudo.', path: WIDGET_ICON_PATHS.planning },
            { href: '#/sessions', label: 'Sessões', text: 'Registre e acompanhe seu tempo de estudo.', path: WIDGET_ICON_PATHS['study-time'] },
            { href: '#/reviews', label: 'Revisões', text: 'Mantenha o conteúdo vivo na memória.', path: WIDGET_ICON_PATHS.reviews },
            { href: '#/analytics', label: 'Análises', text: 'Veja sua evolução com gráficos e indicadores.', path: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
          ].map((resource) => (
            <a key={resource.href} className="resource-card" href={resource.href}>
              <span className="widget-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={resource.path} />
                </svg>
              </span>
              <strong>{resource.label}</strong>
              <span>{resource.text}</span>
            </a>
          ))}
        </div>
      </section>

      <details className="home-dashboard-details">
        <summary>Explorar painel e widgets</summary>
      <section className="dashboard-grid" data-columns={layout.columns} aria-label="Widgets da Home">
        {visibleLayoutWidgets.map((widget) => (
          <article
            key={widget.id}
            className="dashboard-widget"
            tabIndex={-1}
            style={{ gridColumn: `span ${Math.min(widget.span, layout.columns)}` }}
            data-widget={widget.id}
          >
            <span className="widget-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={WIDGET_ICON_PATHS[widget.id]} />
              </svg>
            </span>
            {renderWidget(widget.id)}
          </article>
        ))}
        {customWidgets.map((widget) => {
          const parsed = parseWidgetExpression(widget.formula);
          const evaluated = parsed.ok ? evaluateWidgetExpression(parsed.ast, expressionMetrics) : parsed;
          return (
            <article key={widget.id} className="dashboard-widget" data-widget={widget.id} data-testid="custom-widget">
              <h4>{widget.label}</h4>
              <strong className="widget-value">{evaluated.ok ? formatMetric(typeof evaluated.value === 'number' ? evaluated.value : null, evaluated.unit) : 'Indisponível'}</strong>
              <code>{widget.formula}</code>
              <button type="button" className="button-ghost" onClick={() => removeCustomWidget(widget.id)}>
                Remover widget
              </button>
            </article>
          );
        })}
      </section>

      </details>
      <div className="home-counts" aria-label="Resumo do perfil local" data-visible-indicators={indicators.length}>
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

      <section className="home-controls" aria-label="Painel personalizável">
        <div className="settings-row">
          <label htmlFor="home-template">Modelo da Home</label>
          <select
            id="home-template"
            value={dashboard.template}
            onChange={(event) => changeTemplate(event.target.value as DashboardTemplate)}
          >
            {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="home-mode">Modo de apresentação</label>
          <select id="home-mode" value={mode} onChange={(event) => changeMode(event.target.value as HomeMode)}>
            {HOME_MODE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="home-filter">Filtro global</label>
          <select
            id="home-filter"
            value={filter}
            onChange={(event) =>
              setWidgetFilters((state) => ({ ...state, global: event.target.value as WidgetScope }))
            }
          >
            <option value="ALL">Todos os fatos do perfil</option>
            <option value="REVIEWS">Revisões</option>
            <option value="PLANNING">Planejamento</option>
            <option value="CONTENT">Conteúdo</option>
            <option value="INTEGRITY">Integridade e diagnóstico</option>
          </select>
        </div>
        <p className="muted">Ajustes de layout valem para {device}; alterar o filtro não grava fatos.</p>

        <details className="dashboard-editor" open={false}>
          <summary>Personalizar widgets e fontes</summary>
          <div className="dashboard-editor-grid">
            {(Object.keys(WIDGET_LABELS) as DashboardWidgetId[]).map((id) => (
              <label key={id} className="indicator-option">
                <input
                  type="checkbox"
                  checked={layout.widgets.some((widget) => widget.id === id)}
                  onChange={() => toggleWidget(id)}
                />
                {WIDGET_LABELS[id]}
              </label>
            ))}
          </div>
          <ol className="dashboard-order" aria-label="Ordem dos widgets">
            {layout.widgets.map((widget, index) => (
              <li key={widget.id} data-widget={widget.id}>
                <span>{WIDGET_LABELS[widget.id]}</span>
                <button type="button" className="button-ghost" disabled={index === 0} onClick={() => moveWidget(widget.id, -1)}>
                  Mover para cima
                </button>
                <button type="button" className="button-ghost" disabled={index === layout.widgets.length - 1} onClick={() => moveWidget(widget.id, 1)}>
                  Mover para baixo
                </button>
              </li>
            ))}
          </ol>
          {layoutPersistError ? (
            <p className="inline-notice" role="alert" data-testid="home-layout-unsaved">
              Alteração de layout aplicada nesta aba, mas não foi gravada no armazenamento
              local. Ela será perdida ao recarregar; os fatos acadêmicos não foram alterados.
            </p>
          ) : null}
          <button type="button" className="button-ghost" disabled={layoutHistory.length === 0} onClick={undoLayout}>
            Desfazer alteração de layout nesta sessão
          </button>
        </details>

        <details className="widget-builder">
          <summary>Construtor de widget seguro</summary>
          <div className="settings-row">
            <label htmlFor="widget-label">Nome do widget</label>
            <input id="widget-label" value={customLabel} maxLength={80} onChange={(event) => setCustomLabel(event.target.value)} />
          </div>
          <div className="settings-row">
            <label htmlFor="widget-formula">Fórmula controlada</label>
            <input
              id="widget-formula"
              value={formula}
              maxLength={512}
              spellCheck={false}
              onChange={(event) => setFormula(event.target.value)}
            />
          </div>
          <p className="muted">Variáveis: study_time, planned_time, questions, correct, reviews. Use +, -, *, /, comparações e if(condição, valor, alternativa).</p>
          <p className="inline-notice" role="status" data-testid="widget-formula-preview">
            {formulaPreview.ok
              ? `Prévia: ${formatMetric(typeof formulaPreview.value === 'number' ? formulaPreview.value : null, formulaPreview.unit)}`
              : `Fórmula rejeitada: ${formulaPreview.message}`}
          </p>
          <button type="button" className="button-primary" disabled={!parsedFormula.ok || !formulaPreview.ok || customLabel.trim().length === 0} onClick={saveCustomWidget}>
            Salvar widget personalizado
          </button>
        </details>

        <details className="indicator-catalog">
          <summary>Indicadores exibidos ({indicators.length}/{HOME_INDICATORS.length})</summary>
          <fieldset>
            <legend className="sr-only">Indicadores do resumo da Home</legend>
            {HOME_INDICATORS.map((indicator) => (
              <label key={indicator.id} className="indicator-option">
                <input type="checkbox" checked={visibleIndicators.includes(indicator.id)} onChange={() => toggleIndicator(indicator.id)} />
                {indicator.label}
              </label>
            ))}
          </fieldset>
        </details>
      </section>
      {visibleLayoutWidgets.length === 0 ? (
        <p className="empty-state">Nenhum widget pertence ao filtro atual; os dados não foram alterados.</p>
      ) : null}

      {inspector ? (
        <aside className="context-inspector" aria-label="Inspetor do widget" data-testid="context-inspector">
          <header className="section-header">
            <h3>{WIDGET_LABELS[inspector]}: procedência</h3>
            <button type="button" className="button-ghost" onClick={() => setInspector(null)}>Fechar</button>
          </header>
          <p>Consulta somente leitura sobre F2–F5. Nenhuma visualização grava fatos.</p>
          <div className="settings-row">
            <label htmlFor="widget-scope">Escopo local deste widget</label>
            <select
              id="widget-scope"
              value={widgetFilters.local[inspector] ?? ''}
              onChange={(event) =>
                setWidgetFilters((state) =>
                  setWidgetScope(
                    state,
                    inspector,
                    event.target.value === '' ? null : (event.target.value as WidgetScope),
                  ),
                )
              }
            >
              <option value="">Herdar filtro global/grupo</option>
              <option value="REVIEWS">Revisões</option>
              <option value="PLANNING">Planejamento</option>
              <option value="CONTENT">Conteúdo</option>
              <option value="INTEGRITY">Integridade</option>
            </select>
          </div>
          <p className="hint">Escopo efetivo: {effectiveWidgetFilter(inspector, widgetFilters).source} · {effectiveWidgetFilter(inspector, widgetFilters).scope}. Filtros não são aditivos.</p>
          <button
            type="button"
            className="button-ghost"
            onClick={() =>
              setWidgetFilters((state) =>
                applyScopeToGroup(
                  state,
                  'academic-widgets',
                  ['study-time', 'reviews', 'questions', 'planning'],
                  effectiveWidgetFilter(inspector, state).scope,
                ),
              )
            }
          >
            Aplicar escopo aos widgets acadêmicos conectados
          </button>
          <p className="source-note">Fonte: {analytics.source}. Período: {analytics.period.from} a {analytics.period.to}. Impressão: {analytics.fingerprint ?? 'não materializada'}.</p>
        </aside>
      ) : null}

      <section className="panel">
        <header className="section-header">
          <h3>Prioridades explicáveis</h3>
          <span className="muted">{filteredPriorities.length} item(ns)</span>
        </header>
        {filteredPriorities.length === 0 ? (
          <p className="empty-state">Nenhum item neste filtro. O filtro não alterou os dados.</p>
        ) : (
          <ol className="priority-list" data-testid="f6-priorities">
            {filteredPriorities.slice(0, 8).map((item) => (
              <li key={item.id} className="priority-row">
                <span className={`chip chip-${priorityTone(item.category)}`}>
                  {PRIORITY_CATEGORY_LABELS[item.category]}
                </span>
                <div className="priority-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <a className="button-ghost" href={routeHref(routeForTarget(item.target, item.entityId ?? null))}>Abrir</a>
              </li>
            ))}
          </ol>
        )}
        <p className="source-note">{summary.source}</p>
        <p className="source-note" data-testid="f6-global-scope">
          Inclui compromissos e revisões de todos os editais do perfil; os filtros não alteram a Central de Atenção.
        </p>
      </section>

      <section className="panel" aria-labelledby="evidence-title">
        <h3 id="evidence-title">Integridade por evidência</h3>
        <div className="evidence-list">
          {evidence.length === 0 ? <p className="empty-state">Sem evento de integridade.</p> : null}
          {evidence.slice(0, 5).map((item) => (
            <article key={item.id} className={`evidence-item evidence-${item.severity}`} data-evidence={item.id}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
              <small>{item.scope} · {item.proof}</small>
            </article>
          ))}
        </div>
        <a href="#/attention">Abrir Central de Atenção</a>
      </section>

      {summary.empty ? (
        <p className="inline-notice" role="status">
          Sem dados neste perfil. Nada foi inventado nem exigido antes do primeiro edital.
        </p>
      ) : null}
    </section>
  );
}

function emptyContent() {
  return {
    subjects: [],
    editais: [],
    links: [],
    assuntos: [],
    aulas: [],
    lessonTopics: [],
  };
}
