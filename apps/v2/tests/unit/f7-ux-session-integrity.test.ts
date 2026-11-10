import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';

const profileId = 'profile-f7-ux-session';
const baseInstant = Date.parse('2026-11-02T10:00:00.000Z');
let nowMs = 0;

const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: nowMs,
    wallInstant: new Date(baseInstant + nowMs).toISOString(),
  }),
};

async function setup() {
  const coordinator = new LocalSessionCoordinator();
  const repository = new LocalSessionRepository();
  const service = new StudySessionService(repository, clock, {
    recoveryPolicy: { maxUnobservedGapMs: 60_000, maxWallClockDriftMs: 5_000 },
  });
  const acquired = await coordinator.acquireAuthority('session-1', profileId, 'tab-a', null, 'op-auth');
  if (acquired.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
  const started = await service.startSession({
    scope: { profileId, operationId: 'op-start', baseRevision: null },
    sessionId: 'session-1',
    origin: 'TIMER',
    authority: acquired.value,
  });
  if (started.kind !== 'LOCAL_COMMITTED') throw new Error('session not started');
  return { service, repository, authority: acquired.value };
}

async function checkpointAt(
  service: StudySessionService,
  repository: LocalSessionRepository,
  authority: Parameters<StudySessionService['checkpointSession']>[0]['authority'],
  verifiedMs: number,
  operationId: string,
): Promise<void> {
  const current = await repository.load(profileId, 'session-1');
  const result = await service.checkpointSession({
    scope: { profileId, operationId, baseRevision: current!.localRevision },
    sessionId: 'session-1',
    authority,
    intervalId: 'session-1~interval~1',
    verifiedMs,
    checkpoint: clock.observe(),
  });
  expect(result.kind).toBe('LOCAL_COMMITTED');
}

beforeEach(async () => {
  nowMs = 0;
  await deleteV2DatabaseForTests();
});

describe('F7-UX session time integrity', () => {
  it('does not credit an unobserved gap when pausing', async () => {
    const { service, repository, authority } = await setup();
    nowMs = 10 * 60_000;
    await checkpointAt(service, repository, authority, 10 * 60_000, 'op-cp');

    nowMs = 70 * 60_000;
    const current = await repository.load(profileId, 'session-1');
    const paused = await service.pauseSession({
      scope: { profileId, operationId: 'op-pause', baseRevision: current!.localRevision },
      sessionId: 'session-1',
      authority,
      checkpoint: {
        intervalId: 'session-1~interval~1',
        verifiedMs: 70 * 60_000,
        checkpoint: clock.observe(),
        endedAt: clock.observe().wallInstant,
      },
    });
    expect(paused.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('PAUSED');
    const interval = loaded?.intervals.find((item) => item.id === 'session-1~interval~1');
    expect(interval?.verifiedMs).toBe(10 * 60_000);
    expect(interval?.recoveryFlag).toBe(true);
    const preview = await service.getRecoveryPreview(profileId, 'session-1');
    expect(preview?.uncertainIntervals.length).toBeGreaterThanOrEqual(1);
  });

  it('does not complete a session by laundering an unobserved gap', async () => {
    const { service, repository, authority } = await setup();
    nowMs = 10 * 60_000;
    await checkpointAt(service, repository, authority, 10 * 60_000, 'op-cp');

    nowMs = 90 * 60_000;
    const current = await repository.load(profileId, 'session-1');
    const completed = await service.completeSession({
      scope: { profileId, operationId: 'op-complete', baseRevision: current!.localRevision },
      sessionId: 'session-1',
      authority,
      checkpoint: {
        intervalId: 'session-1~interval~1',
        verifiedMs: 90 * 60_000,
        checkpoint: clock.observe(),
        endedAt: clock.observe().wallInstant,
      },
    });
    expect(completed.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.intervals[0]?.verifiedMs).toBe(10 * 60_000);
    expect(loaded?.intervals[0]?.recoveryFlag).toBe(true);
  });

  it('manual correction closes the recovery episode without repeating credits', async () => {
    const { service, repository, authority } = await setup();
    nowMs = 10 * 60_000;
    await checkpointAt(service, repository, authority, 10 * 60_000, 'op-cp');
    nowMs = 70 * 60_000;

    const beforePending = await repository.load(profileId, 'session-1');
    const pending = await service.recoverSession({
      scope: { profileId, operationId: 'op-keep', baseRevision: beforePending!.localRevision },
      sessionId: 'session-1',
      decision: 'KEEP_PENDING',
      authority,
    });
    expect(pending.kind).toBe('LOCAL_COMMITTED');

    const beforeCorrect = await repository.load(profileId, 'session-1');
    const corrected = await service.recoverSession({
      scope: { profileId, operationId: 'op-correct', baseRevision: beforeCorrect!.localRevision },
      sessionId: 'session-1',
      decision: 'CORRECT_MANUALLY',
      manualAdjustmentMs: 5 * 60_000,
      authority,
    });
    expect(corrected.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.manualDeclaredMs).toBe(5 * 60_000);
    expect(loaded?.state).toBe('PAUSED');
    const preview = await service.getRecoveryPreview(profileId, 'session-1');
    expect(preview?.uncertainIntervals).toHaveLength(0);

    // A second correction is only reachable through a new gap; the panel that
    // produced the first one is gone because the session left recovery.
    expect(loaded?.state).not.toBe('RECOVERY_REQUIRED');
    expect(preview?.uncertainIntervals).toHaveLength(0);
  });

  it('rejects allocations that point at another session', async () => {
    const { service, repository, authority } = await setup();
    nowMs = 30 * 60_000;
    const current = await repository.load(profileId, 'session-1');
    const edited = await service.editSessionFacts({
      scope: { profileId, operationId: 'op-alloc', baseRevision: current!.localRevision },
      sessionId: 'session-1',
      authority,
      patch: {
        allocations: [
          {
            sessionId: 'session-other',
            allocationId: 'allocation-1',
            editalDisciplineId: 'disc-1',
            assuntoId: 'assunto-1',
            durationMs: 30 * 60_000,
          },
        ],
      },
      reason: 'MANUAL_DETAILS',
    });
    expect(edited.kind).toBe('INVALID');
    if (edited.kind === 'INVALID') expect(edited.code).toBe('INVALID_ALLOCATION');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.allocations ?? []).toHaveLength(0);
  });
});

