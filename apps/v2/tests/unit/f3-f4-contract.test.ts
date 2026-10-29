import { describe, expect, it } from 'vitest';
import { summarizeExecutionLinks, type ExecutionLinkFixture } from '../../src/domain/planning-execution-contract';

const session: ExecutionLinkFixture = {
  sessionId: 'session-60',
  plannedBlockId: 'block-a',
  editalId: 'edital-tjpb',
  editalDisciplineId: 'link-tjpb',
  assuntoId: 'assunto-1',
  durationMinutes: 60,
};

describe('F3/F4 execution contract', () => {
  it('one_session_serving_two_editais_counts_sixty_minutes', () => {
    const links: ExecutionLinkFixture[] = [
      session,
      {
        ...session,
        editalId: 'edital-dpe',
        editalDisciplineId: 'link-dpe',
        assuntoId: 'assunto-dpe',
      },
    ];
    const summary = summarizeExecutionLinks(links);
    expect(summary.uniqueMinutes).toBe(60);
    expect(summary.sessionCount).toBe(1);
    expect(new Set(links.map((item) => item.sessionId)).size).toBe(1);
    expect(Object.keys(summary.coverageByEdital).sort()).toEqual(['edital-dpe', 'edital-tjpb']);
  });

  it('partial_sessions_and_standalone_study_are_summed_once', () => {
    const summary = summarizeExecutionLinks([
      { ...session, sessionId: 's1', durationMinutes: 25 },
      { ...session, sessionId: 's2', durationMinutes: 35 },
      {
        sessionId: 's3',
        plannedBlockId: null,
        editalId: 'edital-tjpb',
        editalDisciplineId: 'link-tjpb',
        durationMinutes: 40,
      },
    ]);
    expect(summary.uniqueMinutes).toBe(100);
    expect(summary.sessionCount).toBe(3);
  });

  it('inconsistent_duplicates_are_reported_and_not_double_counted', () => {
    const summary = summarizeExecutionLinks([
      session,
      { ...session, durationMinutes: 90 },
    ]);
    expect(summary.uniqueMinutes).toBe(60);
    expect(summary.inconsistentSessionIds).toEqual(['session-60']);
  });
});
