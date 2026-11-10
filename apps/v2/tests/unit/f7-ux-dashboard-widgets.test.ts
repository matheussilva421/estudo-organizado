import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_STATE,
  moveDashboardWidget,
  resolveDashboardLayout,
  updateDashboardDevice,
} from '../../src/presentation/dashboard-layout';
import {
  evaluateWidgetExpression,
  parseWidgetExpression,
} from '../../src/domain/widget-expression';
import { queryWidgetMetric } from '../../src/application/widget-queries';
import type { AnalyticsSummary, HomeSummary } from '../../src/application/experience-queries';
import type { ContentSnapshot } from '../../src/application/content-service';

const content: ContentSnapshot = {
  subjects: [],
  editais: [],
  links: [],
  assuntos: [],
  aulas: [],
  lessonTopics: [],
};

const summary: HomeSummary = {
  activeSession: null,
  nextAction: null,
  priorities: [],
  counts: {
    activeEditais: 1,
    subjects: 1,
    plannedToday: 2,
    completedLast7Days: 3,
    reviewsDue: 4,
  },
  empty: false,
  source: 'fixture',
};

const analytics: AnalyticsSummary = {
  status: 'READY',
  profileId: 'local-default',
  period: { from: '2026-10-12', to: '2026-11-10' },
  scope: 'fixture',
  source: 'fixture',
  sessions: { completed: 3, inPeriod: 3, undated: 0, recovery: 0, focusMs: 7_200_000, manualMs: 0 },
  questions: { total: 20, correct: 15, accuracy: 0.75, sessionsWithData: 2 },
  planned: { blocks: 2, minutes: 120, activeScenarios: 1 },
  byEdital: [],
  byDiscipline: [],
  byDay: [],
  sharedSessions: 0,
  unassignedSessions: 0,
  warnings: [],
};

describe('F7-UX dashboard layouts', () => {
  it('offers approved templates and keeps per-device overrides immutable', () => {
    expect(DEFAULT_DASHBOARD_STATE.template).toBe('FOCUS');
    const mobile = resolveDashboardLayout(DEFAULT_DASHBOARD_STATE, 'mobile');
    expect(mobile.columns).toBe(1);
    expect(mobile.widgets.map((widget) => widget.id)).toEqual([
      'next-action',
      'agenda',
      'study-time',
      'reviews',
    ]);

    const next = updateDashboardDevice(DEFAULT_DASHBOARD_STATE, 'mobile', {
      widgetIds: ['reviews', 'next-action'],
    });
    expect(resolveDashboardLayout(next, 'mobile').widgets.map((widget) => widget.id)).toEqual([
      'reviews',
      'next-action',
    ]);
    expect(DEFAULT_DASHBOARD_STATE.devices.mobile).toBeUndefined();
  });

  it('moves widgets with a keyboard-safe command and ignores invalid ids', () => {
    const moved = moveDashboardWidget(['next-action', 'agenda', 'reviews'], 'agenda', -1);
    expect(moved).toEqual(['agenda', 'next-action', 'reviews']);
    expect(moveDashboardWidget(moved, 'missing', 1)).toEqual(moved);
  });
});

describe('F7-UX safe widget expressions', () => {
  const metrics = {
    study_time: { value: 120, unit: 'minutes' as const, sampleSize: 3, denominator: null },
    planned_time: { value: 180, unit: 'minutes' as const, sampleSize: 3, denominator: null },
    questions: { value: 20, unit: 'questions' as const, sampleSize: 20, denominator: 20 },
    correct: { value: 15, unit: 'questions' as const, sampleSize: 20, denominator: 20 },
    empty: { value: null, unit: 'score' as const, sampleSize: 0, denominator: null },
  };

  it('parses arithmetic and conditions without eval or Function', () => {
    const parsed = parseWidgetExpression('if(correct > 10, correct / questions, empty)');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.source).not.toMatch(/eval|Function|window|fetch/i);
    expect(evaluateWidgetExpression(parsed.ast, metrics)).toMatchObject({
      ok: true,
      value: 0.75,
      unit: 'ratio',
    });
  });

  it('rejects JavaScript, mismatched units, zero denominators and null as zero', () => {
    expect(parseWidgetExpression('alert(1)')).toMatchObject({ ok: false });
    expect(parseWidgetExpression('globalThis.metric')).toMatchObject({ ok: false });
    expect(evaluateWidgetExpression(parseWidgetExpression('study_time + questions').ok ? (parseWidgetExpression('study_time + questions') as { ast: unknown }).ast : null, metrics)).toMatchObject({ ok: false });
    expect(evaluateWidgetExpression(parseWidgetExpression('questions / 0').ok ? (parseWidgetExpression('questions / 0') as { ast: unknown }).ast : null, metrics)).toMatchObject({ ok: false });
    expect(evaluateWidgetExpression(parseWidgetExpression('empty + 0').ok ? (parseWidgetExpression('empty + 0') as { ast: unknown }).ast : null, metrics)).toMatchObject({ ok: false });
  });
});

describe('F7-UX widget data contract', () => {
  it('returns provenance, units and unavailable instead of invented zero', () => {
    const accuracy = queryWidgetMetric('QUESTION_ACCURACY', { summary, analytics, content });
    expect(accuracy).toMatchObject({
      status: 'READY',
      unit: 'percent',
      value: 75,
      numerator: 15,
      denominator: 20,
    });
    expect(accuracy.provenance).toMatch(/fixture|F4|sess/i);

    const unknown = queryWidgetMetric('UNKNOWN' as never, { summary, analytics, content });
    expect(unknown).toMatchObject({ status: 'UNAVAILABLE', value: null });
  });

  it('does not double count shared exams and does not mutate snapshots', () => {
    const shared = { ...analytics, sharedSessions: 2, byEdital: [{ id: 'e1', label: 'E1', focusMs: 60_000, sessions: 1 }] };
    const frozen = Object.freeze({ summary, analytics: shared, content });
    const result = queryWidgetMetric('STUDY_TIME_BY_EXAM', frozen);
    expect(result).toMatchObject({ status: 'PARTIAL', value: 1 });
    expect(result.warnings.join(' ')).toMatch(/compartilhadas/i);
  });
});
