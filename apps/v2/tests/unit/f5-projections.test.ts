import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';

const profileId = 'profile-f5-projections';
const today = '2026-11-01';

function service(repository = new LocalReviewRepository()): ReviewService {
  return new ReviewService(
    repository,
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => `${today}T12:00:00.000Z`, zone: 'America/Fortaleza' },
  );
}

async function seedTopic(
  review: ReviewService,
  assunto = 'assunto-1',
  label = 'Controle de constitucionalidade',
): Promise<string> {
  await review.createTopic(
    profileId,
    {
      editalId: 'edital-1',
      editalDisciplineId: 'disc-1',
      assuntoId: assunto,
      label,
    },
    `op-topic-${assunto}`,
  );
  const topic = (await review.listTopics(profileId)).find(
    (item) => item.assuntoId === assunto,
  );
  if (!topic) throw new Error('topic missing');
  return topic.canonicalTopicKey;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5-T41 materialized weak-point projections', () => {
  it('publishes a versioned READY projection with batch and row evidence', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await seedTopic(review);
    const built = await review.rebuildWeakPointsProjection(profileId, { batchSize: 1 });
    if (built.kind !== 'LOCAL_COMMITTED') throw new Error(JSON.stringify(built));
    expect(built.value.batches).toBe(1);
    expect(built.value.rows).toBe(1);
    expect(built.value.projection.algorithmVersion).toBe(1);
    expect(built.value.projection.status).toBe('READY');
    const status = await review.weakPointProjectionStatus(profileId);
    expect(status.kind).toBe('READY');
    expect(status.projection?.generationId).toBe(built.value.projection.generationId);
    expect(status.projection?.payload).toHaveLength(1);
  });

  it('marks the cache STALE when a new F5 execution changes its dependencies', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    const key = await seedTopic(review);
    await review.rebuildWeakPointsProjection(profileId);
    expect((await review.weakPointProjectionStatus(profileId)).kind).toBe('READY');
    await review.recordExecution(
      profileId,
      {
        canonicalTopicKey: key,
        civilDate: today,
        assessment: 'FORGOT',
        coverage: 'UNKNOWN',
        provenance: 'fixture',
      },
      'op-new-execution',
    );
    const stale = await review.weakPointProjectionStatus(profileId);
    expect(stale.kind).toBe('STALE');
    expect(stale.reason).toBe('INPUTS_CHANGED');
    expect(stale.fingerprint).not.toBe(stale.projection?.fingerprint);
  });

  it('does not invalidate weak points for an unrelated board-evidence change', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await seedTopic(review);
    await review.rebuildWeakPointsProjection(profileId);
    await review.saveBoardEvidence(
      profileId,
      { title: 'Banca TJPB', text: 'Controle de constitucionalidade cai muito.' },
      'op-board',
    );
    const status = await review.weakPointProjectionStatus(profileId);
    expect(status.kind).toBe('READY');
  });

  it('publishes no partial projection when inputs change during a batch build', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    const key = await seedTopic(review);
    await seedTopic(review, 'assunto-2', 'Direitos fundamentais');
    const built = await review.rebuildWeakPointsProjection(profileId, {
      batchSize: 1,
      onBatch: async (batch) => {
        if (batch !== 1) return;
        await review.recordExecution(
          profileId,
          {
            canonicalTopicKey: key,
            civilDate: today,
            assessment: 'PARTIAL',
            coverage: 'UNKNOWN',
            provenance: 'interleaved',
          },
          'op-interleaved',
        );
      },
    });
    expect(built).toEqual({ kind: 'BLOCKED', reason: 'INPUTS_CHANGED_DURING_BUILD' });
    const status = await review.weakPointProjectionStatus(profileId);
    expect(status.kind).toBe('MISSING');
  });

  it('refuses an older generation through the publication CAS', async () => {
    const repository = new LocalReviewRepository();
    const review = service(repository);
    await review.ensurePolicy(profileId, 'op-policy');
    await seedTopic(review);
    const first = await review.rebuildWeakPointsProjection(profileId);
    if (first.kind !== 'LOCAL_COMMITTED') throw new Error('first build missing');
    const old = first.value.projection;
    const second = await review.rebuildWeakPointsProjection(profileId);
    if (second.kind !== 'LOCAL_COMMITTED') throw new Error('second build missing');
    const stale = await repository.publishProjection({
      record: { ...old, generationId: 'old-generation' },
      expectedGenerationId: old.generationId,
      expectedFingerprint: old.fingerprint,
    });
    expect(stale).toEqual({ kind: 'CONFLICT', code: 'STALE_GENERATION' });
  });

  it('does not let a build that started earlier overwrite a newer publication', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await seedTopic(review);
    const initial = await review.rebuildWeakPointsProjection(profileId);
    expect(initial.kind).toBe('LOCAL_COMMITTED');
    const older = await review.rebuildWeakPointsProjection(profileId, {
      batchSize: 1,
      onBatch: async (batch) => {
        if (batch !== 1) return;
        const newer = await review.rebuildWeakPointsProjection(profileId);
        expect(newer.kind).toBe('LOCAL_COMMITTED');
      },
    });
    expect(older).toEqual({ kind: 'CONFLICT', code: 'STALE_GENERATION' });
  });

  it('produces the same rows with batch size 1 and a single batch', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    await seedTopic(review);
    await seedTopic(review, 'assunto-2', 'Direitos fundamentais');
    await seedTopic(review, 'assunto-3', 'Organização administrativa');
    const small = await review.rebuildWeakPointsProjection(profileId, { batchSize: 1 });
    if (small.kind !== 'LOCAL_COMMITTED') throw new Error('small build missing');
    const large = await review.rebuildWeakPointsProjection(profileId, { batchSize: 100 });
    if (large.kind !== 'LOCAL_COMMITTED') throw new Error('large build missing');
    expect(large.value.rows).toBe(3);
    expect(JSON.stringify(large.value.projection.payload)).toBe(
      JSON.stringify(small.value.projection.payload),
    );
  });
});
