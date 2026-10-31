import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';

const profileId = 'profile-f4';
const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: 1_000,
    wallInstant: '2026-10-30T10:00:00.000Z',
  }),
};

async function counts(): Promise<{ sessions: number; outbox: number; operations: number }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [STORES.sessions, STORES.outbox, STORES.operations],
    'readonly',
  );
  const operations = (await requestResult(
    transaction.objectStore(STORES.operations).getAll(),
  )) as { entityType?: string }[];
  return {
    sessions: await requestResult(transaction.objectStore(STORES.sessions).count()),
    outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
    operations: operations.filter(
      (operation) =>
        operation.entityType === 'study-session' ||
        operation.entityType === 'session-checkpoint',
    ).length,
  };
}

async function seedPlanningBlock(): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.planningBlocks, 'readwrite');
  transaction.objectStore(STORES.planningBlocks).put({
    id: 'block-1',
    profileId,
    scenarioId: 'scenario-1',
    editalId: 'edital-1',
    status: 'PLANNED',
    localRevision: 1,
  });
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 study session service', () => {
  it('starting_from_block_links_by_opaque_id_without_completing_plan', async () => {
    await seedPlanningBlock();
    const coordinator = new LocalSessionCoordinator();
    const authority = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-auth',
    );
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const service = new StudySessionService(new LocalSessionRepository(), clock);

    const result = await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
      planBlockIds: ['block-1'],
      editalIds: ['edital-1'],
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    if (result.kind !== 'LOCAL_COMMITTED') return;
    expect(result.value.state).toBe('RUNNING');
    expect(result.value.planBlockIds).toEqual(['block-1']);
    expect(result.value.intervals).toHaveLength(1);
    expect(result.value.intervals[0]?.kind).toBe('FOCUS');
    expect(result.value.intervals[0]?.startedAt).toBe('2026-10-30T10:00:00.000Z');
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });

    const database = await openV2Database(profileId);
    const read = database.transaction(STORES.planningBlocks, 'readonly');
    expect(
      await requestResult(
        read.objectStore(STORES.planningBlocks).get([profileId, 'block-1']),
      ),
    ).toMatchObject({ id: 'block-1', status: 'PLANNED', localRevision: 1 });
  });

  it('switch_pauses_old_and_starts_new_in_one_transaction', async () => {
    const coordinator = new LocalSessionCoordinator();
    const authority = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-auth',
    );
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });

    const switched = await service.switchActiveSession({
      scope: { profileId, operationId: 'op-switch', baseRevision: null },
      fromSessionId: 'session-1',
      toSessionId: 'session-2',
      authority: authority.value,
      origin: 'TIMER',
    });
    expect(switched.kind).toBe('LOCAL_COMMITTED');
    const from = await repository.load(profileId, 'session-1');
    const to = await repository.load(profileId, 'session-2');
    expect(from?.state).toBe('PAUSED');
    expect(from?.localRevision).toBe(2);
    expect(to?.state).toBe('RUNNING');
    expect(to?.localRevision).toBe(1);
    expect(await counts()).toEqual({ sessions: 2, outbox: 3, operations: 2 });

    const currentAuthority = await coordinator.getAuthority(profileId);
    expect(currentAuthority?.sessionId).toBe('session-2');
    const paused = await service.pauseSession({
      scope: { profileId, operationId: 'op-pause-2', baseRevision: 1 },
      sessionId: 'session-2',
      authority: { ...authority.value, sessionId: 'session-2' },
    });
    expect(paused.kind).toBe('LOCAL_COMMITTED');
  });

  it('double_complete_is_idempotent', async () => {
    const coordinator = new LocalSessionCoordinator();
    const authority = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-auth',
    );
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const service = new StudySessionService(new LocalSessionRepository(), clock);
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const first = await service.completeSession({
      scope: { profileId, operationId: 'op-complete-1', baseRevision: 1 },
      sessionId: 'session-1',
      authority: authority.value,
    });
    const second = await service.completeSession({
      scope: { profileId, operationId: 'op-complete-2', baseRevision: 2 },
      sessionId: 'session-1',
      authority: authority.value,
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');
    expect(second).toEqual(first);
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, operations: 2 });
  });

  it('resume_creates_new_focus_interval', async () => {
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
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    await service.pauseSession({
      scope: { profileId, operationId: 'op-pause', baseRevision: 1 },
      sessionId: 'session-1',
      authority: authority.value,
    });
    const resumed = await service.resumeSession({
      scope: { profileId, operationId: 'op-resume', baseRevision: 2 },
      sessionId: 'session-1',
      authority: authority.value,
    });
    expect(resumed.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
    expect(loaded?.intervals).toHaveLength(2);
    expect(loaded?.intervals[1]?.kind).toBe('FOCUS');
  });

  it('failed_switch_leaves_original_timer_intact', async () => {
    const coordinator = new LocalSessionCoordinator();
    const authority = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-auth',
    );
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const switched = await service.switchActiveSession({
      scope: { profileId, operationId: 'op-switch-stale', baseRevision: null },
      fromSessionId: 'session-1',
      toSessionId: 'session-2',
      authority: { ...authority.value, generation: 99 },
      origin: 'TIMER',
    });
    expect(switched).toEqual({ kind: 'CONFLICT', code: 'STALE_AUTHORITY' });
    const from = await repository.load(profileId, 'session-1');
    expect(from?.state).toBe('RUNNING');
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });
  });
});
