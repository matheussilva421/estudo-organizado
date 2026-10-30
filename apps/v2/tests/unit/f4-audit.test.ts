import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests, openV2Database, requestResult, STORES } from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';

const profileId = 'profile-f4';
const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: 90 * 60_000,
    wallInstant: '2026-10-30T11:30:00.000Z',
  }),
};

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
  if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
  await service.startSession({
    scope: { profileId, operationId: 'op-start', baseRevision: null },
    sessionId: 'session-1',
    origin: 'TIMER',
    authority: authority.value,
  });
  return { repository, service, authority: authority.value };
}

async function counts() {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [STORES.sessions, STORES.outbox, STORES.sessionAudit],
    'readonly',
  );
  return {
    sessions: await requestResult(transaction.objectStore(STORES.sessions).count()),
    outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
    audit: await requestResult(transaction.objectStore(STORES.sessionAudit).count()),
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 session audit', () => {
  it('edit_90_to_70_preserves_original_measurement_and_new_revision', async () => {
    const { service, authority } = await setup();
    await service.checkpointSession({
      scope: { profileId, operationId: 'op-checkpoint', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      intervalId: 'session-1~interval~1',
      verifiedMs: 90 * 60_000,
      checkpoint: clock.observe(),
    });
    const current = await service.loadSession(profileId, 'session-1');
    if (!current) throw new Error('session missing');
    const intervals = current.intervals.map((interval) => ({
      ...interval,
      verifiedMs: 70 * 60_000,
    }));
    const edited = await service.editSessionFacts({
      scope: { profileId, operationId: 'op-edit', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      patch: { intervals },
      reason: 'correção',
    });
    expect(edited.kind).toBe('LOCAL_COMMITTED');
    const revisions = await service.listSessionRevisions(profileId, 'session-1');
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.before.intervals[0]?.verifiedMs).toBe(90 * 60_000);
    expect(revisions[0]?.after.intervals[0]?.verifiedMs).toBe(70 * 60_000);
    expect(revisions[0]?.newRevision).toBe(2);
  });

  it('correction_source_is_not_measured', async () => {
    const { service, authority } = await setup();
    await service.editSessionFacts({
      scope: { profileId, operationId: 'op-edit', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      patch: { note: 'corrigido' },
    });
    const revisions = await service.listSessionRevisions(profileId, 'session-1');
    expect(revisions[0]?.source).toBe('CORRECTED');
  });

  it('delete_creates_tombstone_not_physical_removal', async () => {
    const { service, repository, authority } = await setup();
    const deleted = await service.deleteSession({
      scope: { profileId, operationId: 'op-delete', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      reason: 'duplicada',
    });
    expect(deleted.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.tombstone).toBe(true);
    expect(loaded?.deletedReason).toBe('duplicada');
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, audit: 1 });
  });

  it('stale_edit_conflicts', async () => {
    const { service, authority } = await setup();
    const result = await service.editSessionFacts({
      scope: { profileId, operationId: 'op-edit-stale', baseRevision: 99 },
      sessionId: 'session-1',
      authority,
      patch: { note: 'stale' },
    });
    expect(result).toEqual({ kind: 'CONFLICT', code: 'STALE_REVISION' });
    expect(await service.listSessionRevisions(profileId, 'session-1')).toEqual([]);
  });

  it('replay_delete_is_idempotent', async () => {
    const { service, authority } = await setup();
    const input = {
      scope: { profileId, operationId: 'op-delete', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      reason: 'duplicada',
    };
    const first = await service.deleteSession(input);
    const second = await service.deleteSession(input);
    expect(first).toEqual(second);
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, audit: 1 });
  });

  it('archive_f2_reference_does_not_erase_history', async () => {
    const { service, authority } = await setup();
    const current = await service.loadSession(profileId, 'session-1');
    if (!current) throw new Error('session missing');
    await service.editSessionFacts({
      scope: { profileId, operationId: 'op-link-edit', baseRevision: 1 },
      sessionId: 'session-1',
      authority,
      patch: { planBlockIds: ['block-archived'] },
      reason: 'vínculo',
    });
    const revisions = await service.listSessionRevisions(profileId, 'session-1');
    expect(revisions[0]?.before.planBlockIds).toEqual([]);
    expect(revisions[0]?.after.planBlockIds).toEqual(['block-archived']);
  });
});
