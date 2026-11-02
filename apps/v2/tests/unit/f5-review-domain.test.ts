import { describe, expect, it } from 'vitest';
import {
  applyReviewSuggestion,
  calculateWeakPointProjections,
  createDefaultReviewPolicy,
  createReviewTopicLink,
  estimateReviewDuration,
  generateReviewSuggestion,
  matchBoardEvidence,
  parseBoardEvidence,
  previewPriorityReversal,
  rankContextPriorities,
  recordReviewExecution,
  rescheduleCommitment,
  isReviewProjectionCurrent,
  type ReviewExecution,
  type ReviewTopicLink,
} from '../../src/domain/review';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f5';
const today = '2026-11-01';
const policy = createDefaultReviewPolicy(profileId);

function topic(overrides: Partial<ReviewTopicLink> = {}): ReviewTopicLink {
  return {
    ...createReviewTopicLink({
      id: 'topic-1',
      profileId,
      editalId: 'edital-1',
      editalDisciplineId: 'disc-1',
      assuntoId: 'assunto-1',
      label: 'Controle de constitucionalidade',
    }),
    ...overrides,
  };
}

function execution(overrides: Partial<ReviewExecution> = {}): ReviewExecution {
  return {
    id: 'execution-1',
    profileId,
    canonicalTopicKey: topic().canonicalTopicKey,
    civilDate: '2026-10-01',
    assessment: 'GOOD',
    coverage: 'FULL',
    source: 'F5',
    localRevision: 1,
    provenance: 'fixture',
    ...overrides,
  };
}

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'COMPLETED',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: today,
    planBlockIds: [],
    editalIds: ['edital-1'],
    intervals: [],
    allocations: [
      {
        sessionId: 'session-1',
        allocationId: 'allocation-1',
        editalDisciplineId: 'disc-1',
        assuntoId: 'assunto-1',
        durationMs: 30 * 60_000,
      },
    ],
    measurements: [
      { id: 'measurement-1', sessionId: 'session-1', allocationId: 'allocation-1', questions: 10, correctAnswers: 7 },
    ],
    ...overrides,
  };
}

describe('F5 review domain', () => {
  it('F5-T01 generates the same suggestion for the same inputs without writing', () => {
    const input = { topic: topic(), policy, today };
    const first = generateReviewSuggestion(input);
    const second = generateReviewSuggestion(input);
    expect(second).toEqual(first);
    expect(first.dueDate).toBe('2026-11-04');
    expect(first.durationSource).toBe('FALLBACK');
  });

  it('F5-T04 creates an auditable standalone execution without F4 time/questions', () => {
    const result = recordReviewExecution({
      id: 'execution-standalone',
      profileId,
      canonicalTopicKey: topic().canonicalTopicKey,
      civilDate: today,
      assessment: 'UNRATED',
      coverage: 'PARTIAL',
      provenance: 'manual',
    });
    expect(result.commitment).toBeNull();
    expect(result.execution.source).toBe('F5');
    expect(result.execution.sessionId).toBeUndefined();
  });

  it('F5-T07 rejects a second FULL conclusion of the same commitment', () => {
    const commitment = applyReviewSuggestion({
      suggestion: generateReviewSuggestion({ topic: topic(), policy, today }),
      id: 'commitment-1',
      source: 'MANUAL',
      at: '2026-11-01T10:00:00.000Z',
    });
    const first = recordReviewExecution({
      id: 'execution-1',
      profileId,
      canonicalTopicKey: commitment.canonicalTopicKey,
      commitment,
      civilDate: today,
      assessment: 'GOOD',
      coverage: 'FULL',
      provenance: 'fixture',
    });
    expect(first.commitment?.status).toBe('FULFILLED');
    expect(() =>
      recordReviewExecution({
        id: 'execution-2',
        profileId,
        canonicalTopicKey: commitment.canonicalTopicKey,
        commitment: first.commitment,
        civilDate: today,
        assessment: 'GOOD',
        coverage: 'FULL',
        provenance: 'fixture',
      }),
    ).toThrowError(/COVERAGE_ALREADY_FULFILLED/);
  });

  it('F5-T08/T09 keeps PARTIAL and UNKNOWN coverage from completing the commitment', () => {
    const commitment = applyReviewSuggestion({
      suggestion: generateReviewSuggestion({ topic: topic(), policy, today }),
      id: 'commitment-1',
      source: 'MANUAL',
      at: '2026-11-01T10:00:00.000Z',
    });
    const partial = recordReviewExecution({
      id: 'execution-partial',
      profileId,
      canonicalTopicKey: commitment.canonicalTopicKey,
      commitment,
      civilDate: today,
      assessment: 'PARTIAL',
      coverage: 'PARTIAL',
      provenance: 'fixture',
    });
    expect(partial.commitment?.status).toBe('PARTIALLY_FULFILLED');
    const unknown = recordReviewExecution({
      id: 'execution-unknown',
      profileId,
      canonicalTopicKey: commitment.canonicalTopicKey,
      commitment: partial.commitment,
      civilDate: today,
      assessment: 'UNRATED',
      coverage: 'UNKNOWN',
      provenance: 'fixture',
    });
    expect(unknown.commitment?.status).toBe('PARTIALLY_FULFILLED');
  });

  it('F5-T10 does not merge homonymous topics without an explicit canonical key', () => {
    const first = topic();
    const second = topic({
      id: 'topic-2',
      editalId: 'edital-2',
      editalDisciplineId: 'disc-2',
      assuntoId: 'assunto-2',
      canonicalTopicKey: 'disc-2::assunto-2',
    });
    expect(first.canonicalTopicKey).not.toBe(second.canonicalTopicKey);
    const shared = topic({ id: 'topic-3', canonicalTopicKey: first.canonicalTopicKey });
    expect(shared.canonicalTopicKey).toBe(first.canonicalTopicKey);
  });

  it('F5-T11/T12/T14 explains forgotten, good and unrated intervals', () => {
    const made = generateReviewSuggestion({ topic: topic(), policy, today });
    const forgot = generateReviewSuggestion({
      topic: topic(),
      policy,
      today,
      stage: 3,
      lastExecution: execution({ assessment: 'FORGOT' }),
    });
    const good = generateReviewSuggestion({
      topic: topic(),
      policy,
      today,
      stage: 3,
      lastExecution: execution({ assessment: 'GOOD' }),
    });
    const unrated = generateReviewSuggestion({
      topic: topic(),
      policy,
      today,
      lastExecution: execution({ assessment: 'UNRATED' }),
    });
    expect(made.intervalDays).toBe(3);
    expect(forgot.intervalDays).toBeLessThan(good.intervalDays);
    expect(unrated.intervalDays).toBe(4);
  });

  it('F5-T13 anchors the next suggestion on the real execution date', () => {
    const late = generateReviewSuggestion({
      topic: topic(),
      policy,
      today,
      lastExecution: execution({ civilDate: '2026-10-20', assessment: 'PARTIAL' }),
    });
    expect(late.dueDate).toBe('2026-10-25');
  });

  it('F5-T17 uses only review durations and falls back honestly', () => {
    expect(estimateReviewDuration({ durationsMinutes: [], policy })).toMatchObject({
      minutes: 20,
      source: 'FALLBACK',
      samples: 0,
    });
    expect(estimateReviewDuration({ durationsMinutes: [30, 40, 50], policy })).toMatchObject({
      minutes: 40,
      source: 'HISTORY',
      samples: 3,
    });
  });

  it('F5-T21/T22 aggregates F4 measurements once and leaves unallocated evidence out', () => {
    const projections = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [session()],
      policy,
      today,
    });
    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({ questions: 10, correctAnswers: 7, status: 'DESCRIPTIVE_ONLY' });
    const unallocated = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [session({ measurements: [{ id: 'm2', sessionId: 'session-1', questions: 10, correctAnswers: 7 }] })],
      policy,
      today,
    });
    expect(unallocated[0]?.questions).toBe(0);
  });

  it('F5-T23/T24 separates insufficient, descriptive and comparable trends', () => {
    const small = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [execution({ assessment: 'FORGOT', coverage: 'PARTIAL' })],
      sessions: [session({ measurements: [{ id: 'm', sessionId: 'session-1', allocationId: 'allocation-1', questions: 2, correctAnswers: 1 }] })],
      policy,
      today,
    });
    expect(small[0]?.status).toBe('INSUFFICIENT_DATA');
    const trend = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [
        session({ id: 'old', recordedAtCivilDate: '2026-01-01', measurements: [{ id: 'm-old', sessionId: 'old', allocationId: 'allocation-1', questions: 10, correctAnswers: 2 }] }),
        session({ id: 'new', recordedAtCivilDate: '2026-10-31', measurements: [{ id: 'm-new', sessionId: 'new', allocationId: 'allocation-1', questions: 10, correctAnswers: 9 }] }),
      ],
      policy,
      today,
    });
    expect(trend[0]?.status).toBe('TREND_SUPPORTED');
    expect(trend[0]?.trend).toBe('IMPROVING');
  });

  it('F5-T26 exposes conflicted F4 evidence instead of scoring it as reconciled', () => {
    const projections = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [session()],
      policy,
      today,
      uncertainTopicKeys: new Set([topic().canonicalTopicKey]),
    });
    expect(projections[0]?.conflicts).toContain('F4_CONFLICT:session-1');
  });

  it('F5-T27/T28 parses qualitative and quantitative board sources honestly', () => {
    const qualitative = parseBoardEvidence({
      id: 'board-1',
      profileId,
      title: 'Banca TJ',
      text: 'Controle de constitucionalidade cai muito.',
    });
    expect(qualitative.kind).toBe('QUALITATIVE');
    expect(qualitative.sampleSize).toBeUndefined();
    const quantitative = parseBoardEvidence({
      id: 'board-2',
      profileId,
      title: 'Banca TJ',
      text: '10 de 50 questões',
      sampleSize: 10,
      denominator: 50,
    });
    expect(quantitative.kind).toBe('QUANTITATIVE');
    expect(quantitative.sampleSize).toBe(10);
  });

  it('F5-T29/T30 flags ambiguous matching and preserves edital context', () => {
    const evidence = parseBoardEvidence({
      id: 'board-1',
      profileId,
      title: 'Controle de constitucionalidade',
      text: 'Controle de constitucionalidade',
    });
    const second = topic({ id: 'topic-2', editalId: 'edital-2', editalDisciplineId: 'disc-2', assuntoId: 'assunto-2' });
    const match = matchBoardEvidence({ evidence, topics: [topic(), second] });
    expect(match.ambiguous).toBe(true);
    expect(match.candidates).toHaveLength(2);
    const scoped = matchBoardEvidence({ evidence, topics: [topic(), second], editalId: 'edital-1' });
    expect(scoped.candidates).toHaveLength(1);
  });

  it('F5-T33 ranks each edital separately from the same facts', () => {
    const first = topic();
    const second = topic({ id: 'topic-2', editalId: 'edital-2', editalDisciplineId: 'disc-2', assuntoId: 'assunto-2', label: 'Outro assunto' });
    const weak = calculateWeakPointProjections({
      profileId,
      topics: [first, second],
      executions: [],
      sessions: [session()],
      policy,
      today,
    });
    const evidence = parseBoardEvidence({ id: 'b', profileId, title: first.label, text: first.label });
    const rowsA = rankContextPriorities({
      profileId,
      editalId: 'edital-1',
      topics: [first, second],
      weakPoints: weak,
      evidence: [evidence],
      matches: [{
        id: 'm', profileId, evidenceId: 'b', topicLinkId: first.id, canonicalTopicKey: first.canonicalTopicKey, editalId: 'edital-1', assuntoId: first.assuntoId, decision: 'ACCEPTED', score: 1, reason: 'exact', localRevision: 1,
      }],
      today,
      policy,
      generatedAt: '2026-11-01T10:00:00.000Z',
    });
    expect(rowsA.rows).toHaveLength(1);
    expect(rowsA.rows[0]?.canonicalTopicKey).toBe(first.canonicalTopicKey);
  });

  it('F5-T39 rejects executable HTML and unsafe URLs', () => {
    expect(() => parseBoardEvidence({ id: 'b', profileId, title: 'x', text: '<script>alert(1)</script>' })).toThrowError(/UNSAFE_EVIDENCE/);
    expect(() => parseBoardEvidence({ id: 'b', profileId, title: 'x', text: 'ok', uri: 'javascript:alert(1)' })).toThrowError(/UNSAFE_URL/);
  });

  it('preserves the original due date when rescheduling', () => {
    const commitment = applyReviewSuggestion({
      suggestion: generateReviewSuggestion({ topic: topic(), policy, today }),
      id: 'commitment-1',
      source: 'MANUAL',
      at: '2026-11-01T10:00:00.000Z',
    });
    const moved = rescheduleCommitment({ commitment, dueDate: '2026-11-20', at: '2026-11-02T10:00:00.000Z' });
    expect(moved.originalDueDate).toBe('2026-11-04');
    expect(moved.currentDueDate).toBe('2026-11-20');
  });

  it('F5-T14/T34 rejects stale projections and reversal after newer decisions', () => {
    const first = calculateWeakPointProjections({
      profileId, topics: [topic()], executions: [], sessions: [session()], policy, today,
    })[0]!;
    const changed = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [session({ measurements: [{ id: 'm2', sessionId: 'session-1', allocationId: 'allocation-1', questions: 10, correctAnswers: 2 }] })],
      policy,
      today,
    })[0]!;
    expect(
      isReviewProjectionCurrent(first, {
        fingerprint: changed.fingerprint,
        policyVersion: policy.version,
      }),
    ).toBe(false);
    const basePriority = rankContextPriorities({
      profileId, editalId: 'edital-1', topics: [topic()], weakPoints: [first], evidence: [], matches: [], today, policy, generatedAt: '2026-11-01T10:00:00.000Z',
    });
    const newer = rankContextPriorities({
      profileId, editalId: 'edital-1', topics: [topic()], weakPoints: [changed], evidence: [], matches: [], today, policy, generatedAt: '2026-11-02T10:00:00.000Z',
    });
    const reversal = previewPriorityReversal({ current: newer, previous: basePriority });
    expect(reversal.kind).toBe('CONFLICT');
    expect(reversal.affectedCanonicalTopicKeys).toContain(topic().canonicalTopicKey);
  });
});
