import { beforeEach, describe, expect, it } from 'vitest';
import {
  reviewDuration,
  type SessionReviewPolicy,
} from '../../src/domain/session-clock';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';
const policy: SessionReviewPolicy = {
  maxUnobservedGapMs: 60_000,
  anomalousDurationMs: 4 * 60 * 60_000,
};
const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: 1_000,
    wallInstant: '2026-10-30T10:00:00.000Z',
  }),
};

async function setup(): Promise<{
  service: StudySessionService;
  repository: LocalSessionRepository;
  authority: Awaited<ReturnType<LocalSessionCoordinator['acquireAuthority']>>;
}> {
  const coordinator = new LocalSessionCoordinator();
  const repository = new LocalSessionRepository();
  const service = new StudySessionService(repository, clock);
  const authority = await coordinator.acquireAuthority(
    'session-1',
    profileId,
    'tab-a',
    null,
    'op-auth',
  );
  return { service, repository, authority };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 anomaly review', () => {
  it('long_unobserved_interval_requests_review', () => {
    expect(
      reviewDuration({
        durationMs: 5 * 60 * 60_000,
        policy,
        source: 'MEASURED',
      }),
    ).toEqual({ kind: 'REVIEW_REQUIRED' });
  });

  it('eight_hour_legitimate_session_is_not_truncated', () => {
    expect(
      reviewDuration({
        durationMs: 8 * 60 * 60_000,
        policy,
        source: 'MEASURED',
      }),
    ).toEqual({ kind: 'REVIEW_REQUIRED' });
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'nan_negative_infinity_invalid_%s',
    (durationMs) => {
      expect(
        reviewDuration({ durationMs, policy, source: 'MEASURED' }),
      ).toEqual({ kind: 'INVALID', code: 'INVALID_DURATION' });
    },
  );

  it('valid_duration', () => {
    expect(
      reviewDuration({ durationMs: 30 * 60_000, policy, source: 'MANUAL' }),
    ).toEqual({ kind: 'VALID' });
  });

  it('hidden_tab_does_not_pause', async () => {
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const result = await service.flagInactiveSession({
      scope: { profileId, operationId: 'op-inactive', baseRevision: 1 },
      sessionId: 'session-1',
      authority: authority.value,
      observation: clock.observe(),
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
    expect(loaded?.intervals[0]?.recoveryFlag).toBe(true);
  });

  it('manual_confirmation_keeps_manual_source', async () => {
    const coordinator = new LocalSessionCoordinator();
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    const authority = await coordinator.acquireAuthority(
      'manual-1',
      profileId,
      'tab-a',
      null,
      'op-auth-manual',
    );
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const manual: StudySession = {
      id: 'manual-1',
      profileId,
      state: 'RUNNING',
      origin: 'MANUAL',
      localRevision: 1,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      manualDeclaredMs: 8 * 60 * 60_000,
      planBlockIds: [],
      editalIds: [],
      intervals: [],
    };
    const created = await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-manual', baseRevision: null },
      sessionId: 'manual-1',
      authority: authority.value,
      session: manual,
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const result = await service.flagInactiveSession({
      scope: { profileId, operationId: 'op-inactive-manual', baseRevision: 1 },
      sessionId: 'manual-1',
      authority: authority.value,
      observation: clock.observe(),
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'manual-1');
    expect(loaded?.origin).toBe('MANUAL');
    expect(loaded?.manualDeclaredMs).toBe(8 * 60 * 60_000);
  });
});
