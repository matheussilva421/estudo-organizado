import { describe, expect, it } from 'vitest';
import { analyticsFingerprint } from '../../src/application/experience-cache';
import type { AnalyticsInput } from '../../src/application/experience-queries';
import type { StudySession } from '../../src/domain/session';

const baseSession: StudySession = {
  id: 'session-1',
  profileId: 'local-default',
  state: 'COMPLETED',
  origin: 'TIMER',
  localRevision: 1,
  schemaVersion: 1,
  referenceZone: 'America/Fortaleza',
  recordedAtCivilDate: '2026-11-10',
  planBlockIds: [],
  editalIds: [],
  intervals: [
    {
      id: 'interval-1',
      kind: 'FOCUS',
      verifiedMs: 1_800_000,
      contextId: null,
      checkpoint: null,
      recoveryFlag: false,
      startedAt: '2026-11-10T10:00:00.000Z',
      endedAt: '2026-11-10T10:30:00.000Z',
    },
  ],
  measurements: [
    { id: 'measurement-1', sessionId: 'session-1', questions: 10, correctAnswers: 7 },
  ],
  allocations: [{ sessionId: 'session-1', allocationId: 'a1', durationMs: 1_800_000 }],
};

function input(session: StudySession): AnalyticsInput {
  return {
    profileId: 'local-default',
    content: { subjects: [], editais: [], links: [], assuntos: [], aulas: [], lessonTopics: [] },
    scenarios: [],
    blocks: [],
    sessions: [session],
  };
}

describe('F7-UX analytics cache provenance', () => {
  it('invalidates when measurements change', () => {
    const first = analyticsFingerprint(input(baseSession), '2026-11-10');
    const second = analyticsFingerprint(
      input({
        ...baseSession,
        measurements: [
          { id: 'measurement-1', sessionId: 'session-1', questions: 11, correctAnswers: 7 },
        ],
      }),
      '2026-11-10',
    );
    expect(second).not.toBe(first);
  });

  it('invalidates when allocations change', () => {
    const first = analyticsFingerprint(input(baseSession), '2026-11-10');
    const second = analyticsFingerprint(
      input({
        ...baseSession,
        allocations: [
          { sessionId: 'session-1', allocationId: 'a1', durationMs: 1_200_000 },
        ],
      }),
      '2026-11-10',
    );
    expect(second).not.toBe(first);
  });
});
