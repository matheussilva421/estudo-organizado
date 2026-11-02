import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests, openV2Database, requestResult, STORES } from '../../src/platform/indexeddb';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f5';
const today = '2026-11-01';

function service(): ReviewService {
  return new ReviewService(
    new LocalReviewRepository(),
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => `${today}T12:00:00.000Z`, zone: 'America/Fortaleza' },
  );
}

function topicInput() {
  return {
    editalId: 'edital-1',
    editalDisciplineId: 'disc-1',
    assuntoId: 'assunto-1',
    label: 'Controle de constitucionalidade',
  };
}

function session(): StudySession {
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
      { sessionId: 'session-1', allocationId: 'allocation-1', editalDisciplineId: 'disc-1', assuntoId: 'assunto-1', durationMs: 30 * 60_000 },
    ],
    measurements: [
      { id: 'measurement-1', sessionId: 'session-1', allocationId: 'allocation-1', questions: 10, correctAnswers: 7 },
    ],
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5 review service integration', () => {
  it('creates policy, topic, suggestion and commitment without duplicate writes', async () => {
    const review = service();
    const policy = await review.ensurePolicy(profileId, 'op-policy');
    expect(policy.autoApprove).toBe(false);
    const created = await review.createTopic(profileId, topicInput(), 'op-topic');
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const suggestions = await review.generateSuggestions(profileId, today);
    expect(suggestions).toHaveLength(1);
    const applied = await review.applySuggestion(profileId, suggestions[0]!, 'op-apply');
    expect(applied.kind).toBe('LOCAL_COMMITTED');
    const commitments = await review.listCommitments(profileId);
    expect(commitments).toHaveLength(1);
    expect(commitments[0]?.originalDueDate).toBe(suggestions[0]!.dueDate);
  });

  it('replays an identical operation and rejects a divergent payload', async () => {
    const repository = new LocalReviewRepository();
    const review = new ReviewService(repository, new LocalSessionRepository(), new LocalPlanningRepository(), { now: () => `${today}T12:00:00.000Z` });
    const topic = await review.createTopic(profileId, topicInput(), 'op-replay');
    expect(topic.kind).toBe('LOCAL_COMMITTED');
    const replay = await review.createTopic(profileId, topicInput(), 'op-replay');
    expect(replay.kind).toBe('LOCAL_COMMITTED');
    const divergent = await review.createTopic(
      profileId,
      { ...topicInput(), assuntoId: 'assunto-2', label: 'Outro assunto' },
      'op-replay',
    );
    expect(divergent.kind).toBe('INVALID');
  });

  it('F5-T05/T06 replays execution idempotently and rejects a divergent retry', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    const applied = await review.applySuggestion(profileId, suggestion, 'op-apply');
    if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
    const first = await review.recordExecution(
      profileId,
      {
        commitmentId: applied.value.id,
        canonicalTopicKey: applied.value.canonicalTopicKey,
        civilDate: today,
        assessment: 'GOOD',
        coverage: 'PARTIAL',
        provenance: 'fixture',
      },
      'op-execution-replay',
    );
    const replay = await review.recordExecution(
      profileId,
      {
        commitmentId: applied.value.id,
        canonicalTopicKey: applied.value.canonicalTopicKey,
        civilDate: today,
        assessment: 'GOOD',
        coverage: 'PARTIAL',
        provenance: 'fixture',
      },
      'op-execution-replay',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');
    expect(replay).toEqual(first);
    const divergent = await review.recordExecution(
      profileId,
      {
        commitmentId: applied.value.id,
        canonicalTopicKey: applied.value.canonicalTopicKey,
        civilDate: today,
        assessment: 'FORGOT',
        coverage: 'PARTIAL',
        provenance: 'fixture',
      },
      'op-execution-replay',
    );
    expect(divergent).toEqual({ kind: 'INVALID', code: 'OPERATION_ID_REUSED' });
  });

  it('rejects a semantically duplicate commitment', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    expect((await review.applySuggestion(profileId, suggestion, 'op-one')).kind).toBe('LOCAL_COMMITTED');
    const duplicate = await review.applySuggestion(profileId, suggestion, 'op-two');
    expect(duplicate).toEqual({ kind: 'CONFLICT', code: 'DUPLICATE_COMMITMENT' });
  });

  it('F5-T42 prevents duplicate commitments under concurrent apply attempts', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    const results = await Promise.all([
      review.applySuggestion(profileId, suggestion, 'op-concurrent-a'),
      review.applySuggestion(profileId, suggestion, 'op-concurrent-b'),
    ]);
    expect(results.filter((item) => item.kind === 'LOCAL_COMMITTED')).toHaveLength(1);
    expect(results.filter((item) => item.kind === 'CONFLICT')).toHaveLength(1);
    expect(await review.listCommitments(profileId)).toHaveLength(1);
  });

  it('updates commitment coverage and marks F5 outbox rows as blocked', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    const applied = await review.applySuggestion(profileId, suggestion, 'op-apply');
    if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
    const execution = await review.recordExecution(
      profileId,
      {
        commitmentId: applied.value.id,
        canonicalTopicKey: applied.value.canonicalTopicKey,
        civilDate: today,
        assessment: 'GOOD',
        coverage: 'FULL',
        provenance: 'fixture',
      },
      'op-execution',
    );
    expect(execution.kind).toBe('LOCAL_COMMITTED');
    if (execution.kind !== 'LOCAL_COMMITTED') return;
    expect(execution.value.commitment?.status).toBe('FULFILLED');
    const commits = await review.listCommitments(profileId);
    expect(commits[0]?.status).toBe('FULFILLED');
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.outbox, 'readonly');
    const outbox = (await requestResult(transaction.objectStore(STORES.outbox).getAll())) as { entityType: string; deliveryMode?: string }[];
    const reviewRows = outbox.filter((row) => row.entityType.startsWith('review-'));
    expect(reviewRows.length).toBeGreaterThan(0);
    expect(reviewRows.every((row) => row.deliveryMode === 'BLOCKED')).toBe(true);
  });

  it('aggregates a saved F4 session and exposes insufficient/sufficient states', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const sessions = new LocalSessionRepository();
    const created = await sessions.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-session', baseRevision: null },
      sessionId: 'session-1',
      session: session(),
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const weak = await review.weakPoints(profileId, today);
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ questions: 10, correctAnswers: 7, status: 'DESCRIPTIVE_ONLY' });
  });

  it('imports board evidence, confirms a match and ranks priorities per edital', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const board = await review.saveBoardEvidence(
      profileId,
      { title: 'Banca TJ', text: 'Controle de constitucionalidade cai muito.' },
      'op-board',
    );
    if (board.kind !== 'LOCAL_COMMITTED') throw new Error('board missing');
    const match = await review.matchBoardEvidence(profileId, board.value.id, 'edital-1');
    expect(match.candidates).toHaveLength(1);
    const confirmed = await review.confirmMatch(
      profileId,
      {
        evidenceId: board.value.id,
        topicLinkId: match.candidates[0]!.topic.id,
        canonicalTopicKey: match.candidates[0]!.topic.canonicalTopicKey,
        editalId: 'edital-1',
        assuntoId: 'assunto-1',
        decision: 'ACCEPTED',
        score: 1,
        reason: 'exact',
      },
      'op-match',
    );
    expect(confirmed.kind).toBe('LOCAL_COMMITTED');
    const priorities = await review.previewPriorities(profileId, 'edital-1', today);
    expect(priorities.rows).toHaveLength(1);
    expect(priorities.rows[0]?.factors.some((factor) => factor.name === 'board')).toBe(true);
  });

  it('F5-T02 auto-approves only while opt-in is enabled and can be revoked', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const enabled = await review.updatePolicy(profileId, { autoApprove: true }, 'op-enable');
    expect(enabled.kind).toBe('LOCAL_COMMITTED');
    const applied = await review.applyAutoApproved(profileId, 'op-auto');
    expect(applied.kind).toBe('LOCAL_COMMITTED');
    if (applied.kind === 'LOCAL_COMMITTED') expect(applied.value).toHaveLength(1);
    expect((await review.listCommitments(profileId)).length).toBe(1);
    await review.updatePolicy(profileId, { autoApprove: false }, 'op-disable');
    expect(await review.applyAutoApproved(profileId, 'op-auto-2')).toEqual({
      kind: 'INVALID',
      code: 'AUTO_APPROVE_DISABLED',
    });
  });

  it('F5-T46 groups local reminders without promising background delivery', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    const applied = await review.applySuggestion(profileId, suggestion, 'op-apply');
    if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
    await review.reschedule(profileId, applied.value.id, today, 'op-reschedule');
    const reminders = await review.reminders(profileId, today);
    expect(reminders.dueToday).toHaveLength(1);
    expect(reminders.externalNotificationPromise).toBe(false);
  });

  it('F5-T18/T19 previews global capacity, commits F3 once and links the review', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
    const applied = await review.applySuggestion(profileId, suggestion, 'op-apply');
    if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
    const planning = new LocalPlanningRepository();
    const scenario = {
      id: 'scenario-1',
      profileId,
      editalId: 'edital-1',
      kind: 'CYCLE' as const,
      name: 'Ciclo TJPB',
      status: 'ACTIVE' as const,
      localRevision: 1,
      schemaVersion: 1,
      priorityProfileId: 'priority-1',
      priorityProfileRevision: 1,
      referenceZone: 'America/Fortaleza',
    };
    const created = await planning.commit({
      scope: { profileId, operationId: 'op-scenario', baseRevision: null },
      scenarioId: scenario.id,
      baseRevision: null,
      changes: { scenario },
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const preview = await review.previewPlacement(profileId, applied.value.id, '2026-11-02');
    expect(preview.kind).toBe('READY');
    if (preview.kind !== 'READY') return;
    const placed = await review.applyPlacement(profileId, applied.value.id, preview, 'op-place');
    expect(placed.kind).toBe('LOCAL_COMMITTED');
    if (placed.kind === 'LOCAL_COMMITTED') {
      expect(placed.value.planBlockId).toBe(preview.block.id);
    }
    const blocks = await planning.listBlocks(profileId, 'scenario-1');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.label).toBe('Controle de constitucionalidade');
  });

  it('F5-T35/T36/T37 previews export safely and refuses cross-profile import', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await review.createTopic(profileId, topicInput(), 'op-topic');
    const raw = await review.exportData(profileId);
    const preview = review.previewImport(profileId, raw);
    expect(preview.kind).toBe('READY');
    if (preview.kind === 'READY') expect(preview.counts.topics).toBe(1);
    expect(review.previewImport('other-profile', raw)).toEqual({
      kind: 'CONFLICT',
      reason: 'PROFILE_MISMATCH_REQUIRES_REMAP',
    });
    expect(review.previewImport(profileId, '{bad json')).toEqual({
      kind: 'INVALID',
      reason: 'INVALID_JSON',
    });
    if (preview.kind === 'READY') {
      const first = await review.applyImport(profileId, preview, 'op-import');
      expect(first.kind).toBe('LOCAL_COMMITTED');
      const second = await review.applyImport(profileId, preview, 'op-import-2');
      expect(second).toEqual({ kind: 'LOCAL_COMMITTED', value: { applied: 0, partial: false } });
      expect((await review.listTopics(profileId)).length).toBe(1);
    }
  });

  it('aborts a review transaction without leaving a committed row', async () => {
    const repository = new LocalReviewRepository({ fault: 'abort' });
    const review = new ReviewService(repository, new LocalSessionRepository(), new LocalPlanningRepository());
    const result = await review.createTopic(profileId, topicInput(), 'op-abort');
    expect(result.kind).toBe('FAILED');
    expect(await review.listTopics(profileId)).toEqual([]);
  });
});
