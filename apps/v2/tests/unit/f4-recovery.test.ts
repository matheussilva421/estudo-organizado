import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';

const profileId = 'profile-f4';
const baseInstant = Date.parse('2026-10-30T10:00:00.000Z');
let nowMs = 0;

const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: nowMs,
    wallInstant: new Date(baseInstant + nowMs).toISOString(),
  }),
};

async function setup(): Promise<{
  service: StudySessionService;
  repository: LocalSessionRepository;
  authority: Awaited<ReturnType<LocalSessionCoordinator['acquireAuthority']>>;
}> {
  const coordinator = new LocalSessionCoordinator();
  const repository = new LocalSessionRepository();
  const service = new StudySessionService(repository, clock, {
    recoveryPolicy: { maxUnobservedGapMs: 60_000, maxWallClockDriftMs: 5_000 },
  });
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
  nowMs = 0;
  await deleteV2DatabaseForTests();
});

describe('F4 assisted recovery', () => {
  it('crash_restores_42min_plus_uncertain_3min', async () => {
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });

    nowMs = 42 * 60_000;
    const checkpoint = await service.checkpointSession({
      scope: { profileId, operationId: 'op-checkpoint', baseRevision: 1 },
      sessionId: 'session-1',
      authority: authority.value,
      intervalId: 'session-1~interval~1',
      verifiedMs: 42 * 60_000,
      checkpoint: clock.observe(),
    });
    expect(checkpoint.kind).toBe('LOCAL_COMMITTED');

    nowMs = 45 * 60_000;
    const preview = await service.getRecoveryPreview(profileId, 'session-1');
    expect(preview?.durableVerifiedMs).toBe(42 * 60_000);
    expect(preview?.uncertainIntervals.length).toBeGreaterThanOrEqual(1);
    expect(preview?.lastCheckpoint?.monotonicMs).toBe(42 * 60_000);

    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
  });

  it('stale_tab_cannot_recover_without_authority', async () => {
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const result = await service.recoverSession({
      scope: { profileId, operationId: 'op-recover-stale', baseRevision: 1 },
      sessionId: 'session-1',
      decision: 'KEEP_PENDING',
      authority: { ...authority.value, generation: 99 },
    });
    expect(result).toEqual({ kind: 'CONFLICT', code: 'STALE_AUTHORITY' });
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
  });

  it('keep_pending_marks_recovery_required', async () => {
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const result = await service.recoverSession({
      scope: { profileId, operationId: 'op-recover', baseRevision: 1 },
      sessionId: 'session-1',
      decision: 'KEEP_PENDING',
      authority: authority.value,
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RECOVERY_REQUIRED');
    expect(loaded?.intervals[0]?.recoveryFlag).toBe(true);
  });

  it('manual_recovery_keeps_manual_provenance', async () => {
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const result = await service.recoverSession({
      scope: { profileId, operationId: 'op-manual-recovery', baseRevision: 1 },
      sessionId: 'session-1',
      decision: 'CORRECT_MANUALLY',
      manualAdjustmentMs: 3 * 60_000,
      authority: authority.value,
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.origin).toBe('TIMER');
    expect(loaded?.manualDeclaredMs).toBe(3 * 60_000);
  });
});
