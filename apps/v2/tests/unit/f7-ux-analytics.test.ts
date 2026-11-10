import { describe, expect, it } from 'vitest';
import type { AnalyticsSummary } from '../../src/application/experience-queries';
import {
  buildAnalyticsEvidence,
  createAnalyticsSnapshot,
  exportAnalyticsReport,
  validateChartSpec,
} from '../../src/application/analytics-metrics';

function summary(): AnalyticsSummary {
  return {
    status: 'READY',
    profileId: 'local-default',
    period: { from: '2026-10-12', to: '2026-11-10' },
    scope: 'catálogo local sintético',
    source: 'F4 sessões concluídas',
    sessions: { completed: 3, inPeriod: 3, undated: 0, recovery: 0, focusMs: 7_200_000, manualMs: 0 },
    questions: { total: 20, correct: 15, accuracy: 0.75, sessionsWithData: 2 },
    planned: { blocks: 2, minutes: 120, activeScenarios: 1 },
    byEdital: [{ id: 'e1', label: '=cmd|teste', focusMs: 3_600_000, sessions: 1 }],
    byDiscipline: [],
    byDay: [{ id: '2026-11-10', label: '2026-11-10', focusMs: 3_600_000, sessions: 1 }],
    sharedSessions: 0,
    unassignedSessions: 1,
    warnings: [],
    fingerprint: 'abc12345',
  };
}

describe('F7-UX analytics provenance', () => {
  it('exposes numerator, denominator, unit and methodology', () => {
    const evidence = buildAnalyticsEvidence(summary());
    expect(evidence.find((metric) => metric.id === 'accuracy')).toMatchObject({
      value: 75,
      unit: 'percent',
      numerator: 15,
      denominator: 20,
      numeratorLabel: 'acertos',
      denominatorLabel: 'questões registradas',
    });
    expect(evidence.find((metric) => metric.id === 'focus-time')).toMatchObject({ value: 120, unit: 'minutes' });
    expect(evidence.find((metric) => metric.id === 'planned-time')).toMatchObject({ value: 120, unit: 'minutes' });
    expect(evidence.find((metric) => metric.id === 'accuracy')?.methodVersion).toBe('f7-ux-v1');
  });

  it('does not convert an empty period into zero-valued metrics', () => {
    const empty = summary();
    empty.sessions = { completed: 0, inPeriod: 0, undated: 0, recovery: 0, focusMs: 0, manualMs: 0 };
    empty.questions = { total: 0, correct: 0, accuracy: null, sessionsWithData: 0 };
    empty.planned = { blocks: 0, minutes: 0, activeScenarios: 0 };
    const evidence = buildAnalyticsEvidence(empty);
    expect(evidence.find((metric) => metric.id === 'focus-time')?.value).toBeNull();
    expect(evidence.find((metric) => metric.id === 'questions')?.value).toBeNull();
    expect(evidence.find((metric) => metric.id === 'planned-time')?.value).toBeNull();
  });

  it('suppresses a percentage below the minimum sample across chart and table', () => {
    const lowSample = summary();
    lowSample.questions = { total: 2, correct: 1, accuracy: 0.5, sessionsWithData: 1 };
    expect(buildAnalyticsEvidence(lowSample).find((metric) => metric.id === 'accuracy')?.value).toBeNull();
  });

  it('rejects incompatible chart units and missing denominators', () => {
    expect(validateChartSpec({ chartType: 'line', series: [{ id: 'focus-time', unit: 'minutes' }, { id: 'accuracy', unit: 'percent' }] })).toMatchObject({ ok: false });
    expect(validateChartSpec({ chartType: 'bar', series: [{ id: 'accuracy', unit: 'percent' }] }, { requireDenominator: true })).toMatchObject({ ok: false });
    expect(validateChartSpec({ chartType: 'bar', series: [{ id: 'focus-time', unit: 'minutes' }] })).toMatchObject({ ok: true });
  });
});

describe('F7-UX historical reports and safe export', () => {
  it('freezes the historical snapshot against source mutation', () => {
    const source = summary();
    const snapshot = createAnalyticsSnapshot(source, '2026-11-10T12:00:00.000Z');
    source.sessions.focusMs = 1;
    expect(snapshot.summary.sessions.focusMs).toBe(7_200_000);
    expect(snapshot.methodology.version).toBe('f7-ux-v1');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.summary.sessions)).toBe(true);
    expect(Object.isFrozen(snapshot.table[0])).toBe(true);
  });

  it('exports methodology and combines chart/table values without CSV injection', () => {
    const snapshot = createAnalyticsSnapshot(summary(), '2026-11-10T12:00:00.000Z');
    const csv = exportAnalyticsReport(snapshot, 'CSV');
    expect(csv.content).toContain('metodologia');
    expect(csv.content).toContain("'=cmd|teste");
    expect(csv.content).not.toMatch(/(^|,)=cmd/m);
    const json = JSON.parse(exportAnalyticsReport(snapshot, 'JSON').content) as {
      methodology: { version: string };
      table: unknown[];
      chart: unknown[];
    };
    expect(json.methodology.version).toBe('f7-ux-v1');
    expect(json.table).toHaveLength(json.chart.length);
    expect(JSON.stringify(json)).not.toMatch(/token|draft|payload/i);
  });
});
