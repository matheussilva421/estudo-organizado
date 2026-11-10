import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';

const profileId = 'profile-f7-ux-started';
const today = '2026-11-01';

function repository(): LocalReviewRepository {
  return new LocalReviewRepository();
}

function service(reviewRepository = repository()): ReviewService {
  return new ReviewService(
    reviewRepository,
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => `${today}T12:00:00.000Z`, zone: 'America/Fortaleza' },
  );
}

async function commitmentFor(reviewService: ReviewService): Promise<string> {
  await reviewService.ensurePolicy(profileId, 'op-policy');
  await reviewService.createTopic(
    profileId,
    {
      editalId: 'edital-1',
      editalDisciplineId: 'disc-1',
      assuntoId: 'assunto-1',
      label: 'Controle de constitucionalidade',
    },
    'op-topic',
  );
  const suggestion = (await reviewService.generateSuggestions(profileId, today))[0]!;
  const applied = await reviewService.applySuggestion(profileId, suggestion, 'op-apply');
  if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
  return applied.value.id;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7-UX explicit review start', () => {
  it('records a durable start without executing the review', async () => {
    const reviewRepository = repository();
    const review = service(reviewRepository);
    const commitmentId = await commitmentFor(review);

    const started = await review.startReview(profileId, commitmentId, 'op-start');
    expect(started.kind).toBe('LOCAL_COMMITTED');
    if (started.kind !== 'LOCAL_COMMITTED') return;
    expect(started.value.startedAt).toBeDefined();
    expect(started.value.status).toBe('PENDING');
    expect(started.value.history.some((entry) => entry.type === 'STARTED')).toBe(true);
    expect(await reviewRepository.listExecutions(profileId)).toHaveLength(0);
    expect((await review.listCommitments(profileId))[0]?.status).toBe('PENDING');
  });

  it('is idempotent when started twice', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const first = await review.startReview(profileId, commitmentId, 'op-start-1');
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const second = await review.startReview(profileId, commitmentId, 'op-start-2');
    expect(second.kind).toBe('LOCAL_COMMITTED');
    if (first.kind !== 'LOCAL_COMMITTED' || second.kind !== 'LOCAL_COMMITTED') return;
    expect(second.value.startedAt).toBe(first.value.startedAt);
    expect(second.value.localRevision).toBe(first.value.localRevision);
    expect(
      second.value.history.filter((entry) => entry.type === 'STARTED'),
    ).toHaveLength(1);
  });

  it('refuses to start a concluded commitment', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const commitment = (await review.listCommitments(profileId)).find(
      (item) => item.id === commitmentId,
    )!;
    const executed = await review.recordExecution(
      profileId,
      {
        commitmentId,
        canonicalTopicKey: commitment.canonicalTopicKey,
        civilDate: today,
        assessment: 'GOOD',
        coverage: 'FULL',
        provenance: 'test',
      },
      'op-execute',
    );
    expect(executed.kind).toBe('LOCAL_COMMITTED');
    const started = await review.startReview(profileId, commitmentId, 'op-start');
    expect(started.kind).toBe('INVALID');
    if (started.kind === 'INVALID') expect(started.code).toBe('INVALID_TRANSITION');
  });
});

