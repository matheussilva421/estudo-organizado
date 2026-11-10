import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';

const profileId = 'profile-f7-ux-policy-diff';

function service(): ReviewService {
  return new ReviewService(
    new LocalReviewRepository(),
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => '2026-11-01T12:00:00.000Z', zone: 'America/Fortaleza' },
  );
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7-UX base policy preview', () => {
  it('does not change the policy until the preview is applied', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    const before = await review.getPolicy(profileId);
    const preview = await review.previewPolicyChange(profileId, {
      defaultDurationMinutes: 25,
    });
    expect(preview.kind).toBe('READY');
    const unchanged = await review.getPolicy(profileId);
    expect(unchanged.version).toBe(before.version);
    if (preview.kind !== 'READY') return;
    expect(preview.nextPolicy.defaultDurationMinutes).toBe(25);
    const applied = await review.applyPolicyChange(profileId, preview, 'op-apply');
    expect(applied.kind).toBe('LOCAL_COMMITTED');
    if (applied.kind === 'LOCAL_COMMITTED') {
      expect(applied.value.version).toBe(before.version + 1);
      expect(applied.value.defaultDurationMinutes).toBe(25);
    }
  });

  it('rejects a preview that went stale after a concurrent change', async () => {
    const review = service();
    await review.ensurePolicy(profileId, 'op-policy');
    const preview = await review.previewPolicyChange(profileId, {
      defaultDurationMinutes: 30,
    });
    expect(preview.kind).toBe('READY');
    if (preview.kind !== 'READY') return;
    const concurrent = await review.updatePolicy(
      profileId,
      { defaultDurationMinutes: 40 },
      'op-concurrent',
    );
    expect(concurrent.kind).toBe('LOCAL_COMMITTED');
    const stale = await review.applyPolicyChange(profileId, preview, 'op-apply-stale');
    expect(stale.kind).toBe('CONFLICT');
    if (stale.kind === 'CONFLICT') expect(stale.code).toBe('STALE_POLICY');
    expect((await review.getPolicy(profileId)).defaultDurationMinutes).toBe(40);
  });
});

