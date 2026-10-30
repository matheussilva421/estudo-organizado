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
import { summarizeExecutionLinks } from '../../src/domain/planning-execution-contract';

const profileId = 'profile-f4';
const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: 1_000,
    wallInstant: '2026-10-30T10:00:00.000Z',
  }),
};

async function seedLink(status = 'ACTIVE'): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [STORES.planningBlocks, STORES.editalDisciplines],
    'readwrite',
  );
  transaction.objectStore(STORES.editalDisciplines).put({
    id: 'link-1',
    profileId,
    editalId: 'edital-1',
    subjectId: 'subject-1',
    status,
    localRevision: 1,
  });
  transaction.objectStore(STORES.planningBlocks).put({
    id: 'block-1',
    profileId,
    editalId: 'edital-1',
    scenarioId: 'scenario-1',
    editalDisciplineId: 'link-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-plan',
  });
  await transactionDone(transaction);
}

async function setup() {
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
  return { coordinator, repository, service, authority };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 planning links', () => {
  it('standalone_link_later_preserves_session_id', async () => {
    await seedLink();
    const { service, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const started = await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    expect(started.kind).toBe('LOCAL_COMMITTED');
    const linked = await service.linkSessionToPlan({
      scope: { profileId, operationId: 'op-link', baseRevision: 1 },
      sessionId: 'session-1',
      blockIds: ['block-1'],
      authority: authority.value,
    });
    expect(linked.kind).toBe('LOCAL_COMMITTED');
    if (linked.kind !== 'LOCAL_COMMITTED') return;
    expect(linked.value.id).toBe('session-1');
    expect(linked.value.planBlockIds).toEqual(['block-1']);
    expect(linked.value.localRevision).toBe(2);
  });

  it('several_partial_sessions_do_not_auto_complete_block', async () => {
    await seedLink();
    const { coordinator, service, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start-1', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    await service.linkSessionToPlan({
      scope: { profileId, operationId: 'op-link-1', baseRevision: 1 },
      sessionId: 'session-1',
      blockIds: ['block-1'],
      authority: authority.value,
    });
    await coordinator.releaseAuthority(
      'session-1',
      profileId,
      'tab-a',
      authority.value.generation,
      'op-release',
    );
    const second = await coordinator.acquireAuthority(
      'session-2',
      profileId,
      'tab-a',
      null,
      'op-auth-2',
    );
    if (second.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start-2', baseRevision: null },
      sessionId: 'session-2',
      origin: 'TIMER',
      authority: second.value,
    });
    await service.linkSessionToPlan({
      scope: { profileId, operationId: 'op-link-2', baseRevision: 1 },
      sessionId: 'session-2',
      blockIds: ['block-1'],
      authority: second.value,
    });

    const database = await openV2Database(profileId);
    const read = database.transaction(STORES.planningBlocks, 'readonly');
    expect(
      await requestResult(
        read.objectStore(STORES.planningBlocks).get([profileId, 'block-1']),
      ),
    ).toMatchObject({ allocation: 'PROJECTED', localRevision: 1 });
  });

  it('planning_conflict_keeps_session_committed_and_progress_pending', async () => {
    await seedLink();
    const { service, repository, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    await service.linkSessionToPlan({
      scope: { profileId, operationId: 'op-link', baseRevision: 1 },
      sessionId: 'session-1',
      blockIds: ['block-1'],
      authority: authority.value,
    });
    const result = await service.reconcilePlanProgress({
      scope: { profileId, operationId: 'op-reconcile', baseRevision: 2 },
      sessionId: 'session-1',
      blockId: 'block-1',
      choice: 'CONCLUDED',
      planningBaseRevision: 99,
      authority: authority.value,
    });
    expect(result).toEqual({
      kind: 'CONFLICT',
      planApplied: false,
      code: 'STALE_PLANNING_REVISION',
    });
    expect(await repository.load(profileId, 'session-1')).not.toBeNull();
  });

  it('archived_F2_link_requires_reconciliation', async () => {
    await seedLink('ARCHIVED');
    const { service, authority } = await setup();
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.startSession({
      scope: { profileId, operationId: 'op-start', baseRevision: null },
      sessionId: 'session-1',
      origin: 'TIMER',
      authority: authority.value,
    });
    const result = await service.linkSessionToPlan({
      scope: { profileId, operationId: 'op-link', baseRevision: 1 },
      sessionId: 'session-1',
      blockIds: ['block-1'],
      authority: authority.value,
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'CONTENT_RECONCILIATION_REQUIRED' });
  });

  it('one_session_two_editais_still_60min_globally', () => {
    expect(
      summarizeExecutionLinks([
        {
          sessionId: 'session-1',
          editalId: 'edital-1',
          editalDisciplineId: 'link-1',
          durationMinutes: 60,
        },
        {
          sessionId: 'session-1',
          editalId: 'edital-2',
          editalDisciplineId: 'link-2',
          durationMinutes: 60,
        },
      ]).uniqueMinutes,
    ).toBe(60);
  });
});
