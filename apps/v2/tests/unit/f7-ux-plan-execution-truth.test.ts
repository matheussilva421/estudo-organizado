import { describe, expect, it } from 'vitest';
import { buildHomeSummary } from '../../src/application/experience-queries';
import type { ContentSnapshot } from '../../src/application/content-service';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';
import type { StudySession } from '../../src/domain/session';
import { createDefaultReviewReminderSettings } from '../../src/domain/review';

const content: ContentSnapshot = {
  subjects: [],
  editais: [],
  links: [],
  assuntos: [],
  aulas: [],
  lessonTopics: [],
};

const scenario: PlanningScenario = {
  id: 'scenario-1',
  profileId: 'local-default',
  editalId: 'edital-1',
  kind: 'CYCLE',
  name: 'Ciclo',
  status: 'ACTIVE',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'balanced',
  priorityProfileRevision: 1,
  referenceZone: 'America/Fortaleza',
};

const block: PlanBlock = {
  id: 'block-1',
  profileId: 'local-default',
  editalId: 'edital-1',
  scenarioId: 'scenario-1',
  editalDisciplineId: 'link-1',
  plannedMinutes: 60,
  allocation: 'CONFIRMED_DAY',
  civilDate: '2026-11-01',
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-1',
  label: 'Bloco atrasado',
};

function reminders() {
  return {
    overdue: [],
    dueToday: [],
    upcoming: [],
    message: '',
    settings: createDefaultReviewReminderSettings('local-default'),
    dismissedIds: [],
    quietActive: false,
    externalNotificationPromise: false as const,
  };
}

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId: 'local-default',
    state: 'COMPLETED',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: '2026-11-09',
    planBlockIds: ['block-1'],
    editalIds: ['edital-1'],
    intervals: [
      {
        id: 'interval-1',
        kind: 'FOCUS',
        verifiedMs: 1_800_000,
        contextId: null,
        checkpoint: null,
        recoveryFlag: false,
        startedAt: '2026-11-02T10:00:00.000Z',
        endedAt: '2026-11-02T10:30:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('F7-UX block execution truth', () => {
  it('does not treat a completed session link as fulfilled block', () => {
    const summary = buildHomeSummary(
      {
        profileId: 'local-default',
        content,
        scenarios: [scenario],
        blocks: [block],
        sessions: [session()],
        reminders: reminders(),
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      '2026-11-10',
    );
    expect(summary.priorities).toContainEqual(
      expect.objectContaining({ id: 'block-late-block-1', entityId: 'block-1' }),
    );
  });

  it('removes the late block only after explicit CONCLUDED reconciliation', () => {
    const summary = buildHomeSummary(
      {
        profileId: 'local-default',
        content,
        scenarios: [scenario],
        blocks: [block],
        sessions: [
          session({
            planReconciliation: {
              blockId: 'block-1',
              choice: 'CONCLUDED',
              planningBaseRevision: 1,
              reconciledAt: '2026-11-02T11:00:00.000Z',
            },
          }),
        ],
        reminders: reminders(),
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      '2026-11-10',
    );
    expect(summary.priorities.some((item) => item.id === 'block-late-block-1')).toBe(false);
  });

  it('keeps a partial reconciliation pending and recognizes a session-only database as nonempty', () => {
    const summary = buildHomeSummary(
      {
        profileId: 'local-default',
        content,
        scenarios: [],
        blocks: [],
        sessions: [
          session({
            planReconciliation: {
              blockId: 'block-1',
              choice: 'PARTIAL',
              planningBaseRevision: 1,
              reconciledAt: '2026-11-02T11:00:00.000Z',
            },
          }),
        ],
        reminders: reminders(),
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      '2026-11-10',
    );
    expect(summary.empty).toBe(false);
    expect(summary.counts.completedLast7Days).toBe(1);
  });
});
