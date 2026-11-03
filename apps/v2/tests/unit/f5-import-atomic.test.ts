import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import {
  deleteV2DatabaseForTests,
  closeV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import {
  createDefaultReviewPolicy,
  createReviewTopicLink,
  type ReviewCommitment,
  type ReviewPolicy,
  type ReviewTopicLink,
} from '../../src/domain/review';

const profileId = 'profile-f5-atomic';
const today = '2026-11-01';

function service(repository = new LocalReviewRepository()): ReviewService {
  return new ReviewService(
    repository,
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => `${today}T12:00:00.000Z`, zone: 'America/Fortaleza' },
  );
}

function topic(id: string, assuntoId = 'assunto-1', label = 'Controle de constitucionalidade'): ReviewTopicLink {
  return {
    ...createReviewTopicLink({
      id,
      profileId,
      editalId: 'edital-1',
      editalDisciplineId: 'disc-1',
      assuntoId,
      label,
      provenance: 'IMPORT',
    }),
  };
}

function commitment(id: string, canonicalTopicKey: string): ReviewCommitment {
  return {
    id,
    profileId,
    canonicalTopicKey,
    topicLinkId: 'topic-a',
    editalId: 'edital-1',
    assuntoId: 'assunto-1',
    label: 'Controle de constitucionalidade',
    originalDueDate: '2026-11-10',
    currentDueDate: '2026-11-10',
    status: 'PENDING',
    coverage: 'UNKNOWN',
    policyVersion: 1,
    source: 'MANUAL',
    localRevision: 1,
    history: [{ type: 'CREATED', at: '2026-11-01T10:00:00.000Z', dueDate: '2026-11-10' }],
  };
}

function importData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const first = topic('topic-a');
  return {
    schemaVersion: 1,
    kind: 'F5_ACADEMIC_DATA',
    profileId,
    generatedAt: '2026-11-02T12:00:00.000Z',
    topics: [first, topic('topic-b', 'assunto-2', 'Direitos fundamentais')],
    policies: [],
    commitments: [],
    executions: [],
    board: [],
    matches: [],
    priorities: [],
    ...overrides,
  };
}

async function count(store: string): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(store, 'readonly');
  return requestResult(transaction.objectStore(store).count());
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5-T38 atomic academic import', () => {
  it('publishes nothing when the second entity write fails', async () => {
    const repository = new LocalReviewRepository({ fault: 'abort', importFaultAfter: 2 });
    const review = service(repository);
    const preview = review.previewImport(profileId, JSON.stringify(importData()));
    if (preview.kind !== 'READY') throw new Error('preview missing');
    const result = await review.applyImport(profileId, preview, 'op-import-abort');
    expect(result.kind).toBe('FAILED');
    expect(await review.listTopics(profileId)).toHaveLength(0);
    expect(await count(STORES.operations)).toBe(0);
    expect(await count(STORES.outbox)).toBe(0);
    expect(await count(STORES.importReceipts)).toBe(0);
  });

  it('aborts the whole transaction on quota without a partial receipt', async () => {
    const repository = new LocalReviewRepository({ fault: 'quota', importFaultAfter: 2 });
    const review = service(repository);
    const preview = review.previewImport(profileId, JSON.stringify(importData()));
    if (preview.kind !== 'READY') throw new Error('preview missing');
    const result = await review.applyImport(profileId, preview, 'op-import-quota');
    expect(result).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await review.listTopics(profileId)).toHaveLength(0);
    expect(await count(STORES.operations)).toBe(0);
    expect(await count(STORES.importReceipts)).toBe(0);
  });

  it('rejects a conflicting entity before publishing any new row', async () => {
    const repository = new LocalReviewRepository();
    const review = service(repository);
    const existing = topic('topic-a');
    const seeded = await repository.commit({
      type: 'SAVE_TOPIC',
      scope: { profileId, operationId: 'seed-topic', baseRevision: null },
      topic: existing,
    });
    expect(seeded.kind).toBe('LOCAL_COMMITTED');
    const conflicting = { ...existing, label: 'Rótulo divergente' };
    const data = importData({ topics: [conflicting, topic('topic-c', 'assunto-3', 'Organização')] });
    const preview = review.previewImport(profileId, JSON.stringify(data));
    if (preview.kind !== 'READY') throw new Error('preview missing');
    const result = await review.applyImport(profileId, preview, 'op-import-conflict');
    expect(result).toEqual({ kind: 'CONFLICT', code: 'IMPORT_CONFLICT' });
    const topics = await review.listTopics(profileId);
    expect(topics.map((item) => item.id)).toEqual(['topic-a']);
    expect(topics[0]?.label).toBe('Controle de constitucionalidade');
    expect(await count(STORES.operations)).toBe(1);
  });

  it('recovers after an interrupted write and replays the same operation', async () => {
    const failing = new LocalReviewRepository({ fault: 'abort', importFaultAfter: 2 });
    const first = service(failing);
    const preview = first.previewImport(profileId, JSON.stringify(importData()));
    if (preview.kind !== 'READY') throw new Error('preview missing');
    expect((await first.applyImport(profileId, preview, 'op-import-retry')).kind).toBe('FAILED');
    await closeV2DatabaseForTests();

    const recovered = service();
    expect(await recovered.listTopics(profileId)).toHaveLength(0);
    expect(await count(STORES.operations)).toBe(0);
    expect(await count(STORES.importReceipts)).toBe(0);
    const retry = recovered.previewImport(profileId, JSON.stringify(importData()));
    if (retry.kind !== 'READY') throw new Error('retry preview missing');
    const applied = await recovered.applyImport(profileId, retry, 'op-import-retry');
    expect(applied).toMatchObject({ kind: 'LOCAL_COMMITTED', value: { applied: 2, duplicate: 0 } });
    expect(await recovered.listTopics(profileId)).toHaveLength(2);

    const replay = await recovered.applyImport(profileId, retry, 'op-import-retry');
    expect(replay).toEqual(applied);
    expect(await recovered.listTopics(profileId)).toHaveLength(2);
    expect(await count(STORES.operations)).toBe(1);
  });

  it('is idempotent when the same package is imported under a new operation', async () => {
    const review = service();
    const first = review.previewImport(profileId, JSON.stringify(importData()));
    if (first.kind !== 'READY') throw new Error('preview missing');
    const firstResult = await review.applyImport(profileId, first, 'op-import-first');
    expect(firstResult).toMatchObject({ kind: 'LOCAL_COMMITTED', value: { applied: 2 } });

    const second = review.previewImport(profileId, JSON.stringify(importData()));
    if (second.kind !== 'READY') throw new Error('second preview missing');
    const secondResult = await review.applyImport(profileId, second, 'op-import-second');
    expect(secondResult).toMatchObject({ kind: 'LOCAL_COMMITTED', value: { applied: 0, duplicate: 2 } });
    expect(await review.listTopics(profileId)).toHaveLength(2);
  });

  it('keeps policy, commitment and topics invisible together when a later write aborts', async () => {
    const policy: ReviewPolicy = { ...createDefaultReviewPolicy(profileId) };
    const data = importData({
      policies: [policy],
      commitments: [commitment('commitment-a', topic('topic-a').canonicalTopicKey)],
    });
    const repository = new LocalReviewRepository({ fault: 'abort', importFaultAfter: 2 });
    const review = service(repository);
    const preview = review.previewImport(profileId, JSON.stringify(data));
    if (preview.kind !== 'READY') throw new Error('preview missing');
    expect((await review.applyImport(profileId, preview, 'op-import-multi')).kind).toBe('FAILED');
    expect(await review.listTopics(profileId)).toHaveLength(0);
    expect(await count(STORES.reviewPolicies)).toBe(0);
    expect(await review.listCommitments(profileId)).toHaveLength(0);
  });
});
