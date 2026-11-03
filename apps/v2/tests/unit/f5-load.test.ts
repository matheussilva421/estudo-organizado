import { describe, expect, it } from 'vitest';
import {
  calculateWeakPointProjections,
  createDefaultReviewPolicy,
  createReviewTopicLink,
  type ReviewExecution,
  type ReviewTopicLink,
} from '../../src/domain/review';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f5-load';
const today = '2026-11-01';

describe('F5-T07/T19 proportional load evidence', () => {
  it('projects 300 topics and 3000 executions within the declared local budget', () => {
    const topics: ReviewTopicLink[] = Array.from({ length: 300 }, (_, index) =>
      createReviewTopicLink({
        id: `topic-${index}`,
        profileId,
        editalId: 'edital-1',
        editalDisciplineId: 'disc-1',
        assuntoId: `assunto-${index}`,
        label: `Assunto ${index}`,
      }),
    );
    const executions: ReviewExecution[] = Array.from({ length: 3000 }, (_, index) => ({
      id: `execution-${index}`,
      profileId,
      canonicalTopicKey: topics[index % topics.length]!.canonicalTopicKey,
      civilDate: index % 2 === 0 ? '2026-10-20' : '2026-09-20',
      assessment: index % 3 === 0 ? 'FORGOT' : index % 3 === 1 ? 'PARTIAL' : 'GOOD',
      coverage: 'FULL',
      source: 'F5',
      localRevision: 1,
      provenance: 'load',
    }));
    const sessions: StudySession[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `session-${index}`,
      profileId,
      state: 'COMPLETED',
      origin: 'TIMER',
      localRevision: 1,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      recordedAtCivilDate: index % 2 === 0 ? '2026-10-20' : '2026-08-20',
      planBlockIds: [],
      editalIds: ['edital-1'],
      intervals: [],
      allocations: [
        {
          sessionId: `session-${index}`,
          allocationId: `allocation-${index}`,
          editalDisciplineId: 'disc-1',
          assuntoId: `assunto-${index % 300}`,
          durationMs: 30 * 60_000,
        },
      ],
      measurements: [
        {
          id: `measurement-${index}`,
          sessionId: `session-${index}`,
          allocationId: `allocation-${index}`,
          questions: 10,
          correctAnswers: index % 10,
        },
      ],
    }));
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    const rows = calculateWeakPointProjections({
      profileId,
      topics,
      executions,
      sessions,
      policy: createDefaultReviewPolicy(profileId),
      today,
    });
    const elapsed = performance.now() - started;
    const memoryDelta = process.memoryUsage().heapUsed - before;
    console.log(
      `F5 load: elapsed=${elapsed.toFixed(1)}ms heapDelta=${(memoryDelta / 1024 / 1024).toFixed(1)}MiB`,
    );
    expect(rows).toHaveLength(300);
    expect(elapsed).toBeLessThan(2500);
    expect(memoryDelta).toBeLessThan(128 * 1024 * 1024);
  });
});
