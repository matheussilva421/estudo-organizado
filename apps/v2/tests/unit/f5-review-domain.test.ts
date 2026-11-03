import { describe, expect, it } from 'vitest';
import {
  applyReviewSuggestion,
  calculateWeakPointProjections,
  createDefaultReviewPolicy,
  createReviewTopicLink,
  effectiveReviewPolicy,
  estimateReviewDuration,
  generateReviewSuggestion,
  matchBoardEvidence,
  nextReviewPolicy,
  parseBoardEvidence,
  previewReviewPolicyImpact,
  previewPriorityReversal,
  rankContextPriorities,
  recordReviewExecution,
  reconcileReviewCommitments,
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

  it('F5-T31 caps overlapping board sources instead of summing incompatible evidence', () => {
    const t = topic();
    const first = parseBoardEvidence({ id: 'b1', profileId, title: t.label, text: t.label });
    const second = parseBoardEvidence({ id: 'b2', profileId, title: t.label, text: t.label });
    const weak = calculateWeakPointProjections({
      profileId, topics: [t], executions: [], sessions: [session()], policy, today,
    });
    const priority = rankContextPriorities({
      profileId, editalId: 'edital-1', topics: [t], weakPoints: weak, evidence: [first, second],
      matches: [
        { id: 'm1', profileId, evidenceId: 'b1', topicLinkId: t.id, canonicalTopicKey: t.canonicalTopicKey, editalId: 'edital-1', assuntoId: t.assuntoId, decision: 'ACCEPTED', score: 1, reason: 'exact', localRevision: 1 },
        { id: 'm2', profileId, evidenceId: 'b2', topicLinkId: t.id, canonicalTopicKey: t.canonicalTopicKey, editalId: 'edital-1', assuntoId: t.assuntoId, decision: 'ACCEPTED', score: 1, reason: 'exact', localRevision: 1 },
      ],
      today, policy, generatedAt: '2026-11-02T12:00:00.000Z',
    });
    const board = priority.rows[0]?.factors.find((factor) => factor.name === 'board');
    expect(board?.value).toBeLessThanOrEqual(1);
    expect(board?.explanation).toContain('2 fonte');
  });

  it('F5-T43 preserves incompatible fake-device commitment variants without LWW', () => {
    const commitment = applyReviewSuggestion({
      suggestion: generateReviewSuggestion({ topic: topic(), policy, today }),
      id: 'commitment-device',
      source: 'MANUAL',
      at: '2026-11-01T10:00:00.000Z',
    });
    const local = { ...commitment, currentDueDate: '2026-11-10', localRevision: 2 };
    const incoming = { ...commitment, currentDueDate: '2026-11-20', status: 'PARTIALLY_FULFILLED' as const, localRevision: 2 };
    const result = reconcileReviewCommitments(local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind === 'CONFLICT') {
      expect(result.conflict.local.currentDueDate).toBe('2026-11-10');
      expect(result.conflict.incoming.currentDueDate).toBe('2026-11-20');
      expect(result.conflict.status).toBe('OPEN');
    }
  });

  it('does not turn INSUFFICIENT_DATA into a deficiency priority', () => {
    const weak = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [],
      sessions: [session({ measurements: [{ id: 'tiny', sessionId: 'session-1', allocationId: 'allocation-1', questions: 1, correctAnswers: 0 }] })],
      policy,
      today,
    });
    const priority = rankContextPriorities({
      profileId, editalId: 'edital-1', topics: [topic()], weakPoints: weak, evidence: [], matches: [], today, policy, generatedAt: '2026-11-02T12:00:00.000Z',
    });
    expect(priority.rows[0]?.insufficient).toBe(true);
    expect(priority.rows[0]?.factors.find((factor) => factor.name === 'deficiency')?.value).toBe(0);
  });

  it('F5-T15/T25/T45 preserves conflicting evidence, versions policy and keeps CivilDate stable', () => {
    const conflicted = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [execution({ assessment: 'FORGOT', coverage: 'PARTIAL' })],
      sessions: [session()],
      policy,
      today,
    })[0]!;
    expect(conflicted.accuracy).toBe(0.7);
    expect(conflicted.retention.forgot).toBe(1);
    const changed = nextReviewPolicy(policy, { goodMultiplier: 3 });
    expect(changed.version).toBe(policy.version + 1);
    expect(policy.goodMultiplier).toBe(2.5);
    const acrossDst = generateReviewSuggestion({
      topic: topic(),
      policy: changed,
      today: '2026-03-07',
    });
    expect(acrossDst.dueDate).toBe('2026-03-10');
  });

  it('F5-T35/T44 does not resurrect tombstones into authoritative projections', () => {
    const hiddenTopic = topic({ tombstone: true });
    const hiddenExecution = execution({ tombstone: true });
    const projections = calculateWeakPointProjections({
      profileId,
      topics: [hiddenTopic],
      executions: [hiddenExecution],
      sessions: [session()],
      policy,
      today,
    });
    expect(projections).toEqual([]);
    const visible = calculateWeakPointProjections({
      profileId,
      topics: [topic()],
      executions: [hiddenExecution],
      sessions: [session()],
      policy,
      today,
    })[0]!;
    expect(visible.retention.good).toBe(0);
  });

  it('F5-T16 previews and applies a per-subject override without touching facts', () => {
    const other = {
      ...topic({ id: 'topic-2' }),
      canonicalTopicKey: 'disc-1::assunto-2',
      assuntoId: 'assunto-2',
      label: 'Direitos fundamentais',
    };
    const current = { ...policy, overrides: {} };
    const next = nextReviewPolicy(current, {
      overrides: {
        [topic().canonicalTopicKey]: {
          canonicalTopicKey: topic().canonicalTopicKey,
          initialIntervalDays: 10,
          note: 'Assunto com maior retenção',
          updatedAt: '2026-11-01T12:00:00.000Z',
        },
      },
    });
    const effective = effectiveReviewPolicy(next, topic().canonicalTopicKey);
    expect(effective.initialIntervalDays).toBe(10);
    expect(effective.goodMultiplier).toBe(current.goodMultiplier);
    const impact = previewReviewPolicyImpact({
      current,
      next,
      topics: [topic(), other],
      executions: [],
      today,
    });
    expect(impact.kind).toBe('READY');
    expect(impact.changedCount).toBe(1);
    expect(impact.rows.find((row) => row.canonicalTopicKey === other.canonicalTopicKey)?.changed).toBe(false);
    expect(next.version).toBe(current.version + 1);
    expect(current.overrides).toEqual({});
  });

  it('F5-T16 rejects unsafe override values instead of silently ignoring them', () => {
    expect(() =>
      nextReviewPolicy(policy, {
        overrides: {
          [topic().canonicalTopicKey]: {
            canonicalTopicKey: topic().canonicalTopicKey,
            initialIntervalDays: 0,
            updatedAt: '2026-11-01T12:00:00.000Z',
          },
        },
      }),
    ).toThrowError(/INVALID_OVERRIDE/);
    expect(() =>
      nextReviewPolicy(policy, {
        overrides: {
          [topic().canonicalTopicKey]: {
            canonicalTopicKey: 'outro-assunto',
            updatedAt: '2026-11-01T12:00:00.000Z',
          },
        },
      }),
    ).toThrowError(/INVALID_OVERRIDE/);
    expect(() =>
      nextReviewPolicy(policy, {
        overrides: {
          [topic().canonicalTopicKey]: {
            canonicalTopicKey: topic().canonicalTopicKey,
            minIntervalDays: 1000,
            updatedAt: '2026-11-01T12:00:00.000Z',
          },
        },
      }),
    ).toThrowError(/INVALID_OVERRIDE/);
  });

  it('F5-T07 bounds estimated duration and ignores impossible samples', () => {
    expect(
      estimateReviewDuration({ durationsMinutes: [1, 30, 13 * 60], policy }),
    ).toMatchObject({ minutes: 16, source: 'HISTORY', samples: 2 });
    const capped = estimateReviewDuration({
      durationsMinutes: [500, 600],
      policy,
    });
    expect(capped.minutes).toBe(180);
    expect(capped.minutes).toBeLessThanOrEqual(180);
  });

  it('F5-T43 preserves assessment versus reschedule divergences without LWW', () => {
    const base = applyReviewSuggestion({
      suggestion: generateReviewSuggestion({ topic: topic(), policy, today }),
      id: 'commitment-t43',
      source: 'MANUAL',
      at: '2026-11-01T10:00:00.000Z',
    });
    const local = { ...base, status: 'PARTIALLY_FULFILLED' as const, localRevision: 4 };
    const incoming = { ...base, currentDueDate: '2026-11-20', localRevision: 5 };
    const result = reconcileReviewCommitments(local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind === 'CONFLICT') {
      expect(result.conflict.local.status).toBe('PARTIALLY_FULFILLED');
      expect(result.conflict.incoming.currentDueDate).toBe('2026-11-20');
      expect(result.conflict.local.localRevision).toBe(4);
      expect(result.conflict.incoming.localRevision).toBe(5);
    }
  });
});
