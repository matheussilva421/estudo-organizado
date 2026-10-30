import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import {
  notifySessionChange,
  subscribeSessionChanges,
} from '../../src/platform/local-events';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';

function baseSession(): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'DRAFT',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 session coordination', () => {
  it('two_tabs_only_one_authority', async () => {
    const coordinator = new LocalSessionCoordinator();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');

    const second = await coordinator.acquireAuthority(
      'session-2',
      profileId,
      'tab-b',
      null,
      'op-b',
    );
    expect(second).toEqual({ kind: 'CONFLICT', code: 'AUTHORITY_HELD' });
  });

  it('two_distinct_sessions_one_active_timer_per_profile', async () => {
    const coordinator = new LocalSessionCoordinator();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');

    const sameTabOtherSession = await coordinator.acquireAuthority(
      'session-2',
      profileId,
      'tab-a',
      null,
      'op-a-2',
    );
    expect(sameTabOtherSession).toEqual({ kind: 'CONFLICT', code: 'SESSION_MISMATCH' });
  });

  it('old_holder_rejected_after_assisted_transfer', async () => {
    const coordinator = new LocalSessionCoordinator();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');
    if (first.kind !== 'LOCAL_COMMITTED') return;

    const transferred = await coordinator.transferAuthority(
      'session-1',
      profileId,
      'tab-a',
      'tab-b',
      first.value.generation,
      'op-transfer',
    );
    expect(transferred.kind).toBe('LOCAL_COMMITTED');
    if (transferred.kind !== 'LOCAL_COMMITTED') return;
    expect(transferred.value.generation).toBe(first.value.generation + 1);
    expect(await coordinator.validateAuthority(first.value)).toBe(false);
    expect(await coordinator.validateAuthority(transferred.value)).toBe(true);

    const stale = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a-stale',
    );
    expect(stale).toEqual({ kind: 'CONFLICT', code: 'AUTHORITY_HELD' });
  });

  it('broadcast_cannot_grant_authority', async () => {
    const coordinator = new LocalSessionCoordinator();
    const events: string[] = [];
    const unsubscribe = subscribeSessionChanges(profileId, (change) => {
      events.push(change.sessionId);
    });
    notifySessionChange(profileId, 'session-1');
    unsubscribe();
    expect(events).toEqual(['session-1']);
    expect(await coordinator.getAuthority(profileId)).toBeNull();
  });

  it('expired_lease_does_not_authorize_unsafe_takeover', async () => {
    let now = Date.parse('2026-10-30T10:00:00.000Z');
    const coordinator = new LocalSessionCoordinator({
      now: () => new Date(now).toISOString(),
      leaseMs: 1_000,
    });
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');
    now += 5_000;
    const second = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-b',
      null,
      'op-b',
    );
    expect(second).toEqual({ kind: 'CONFLICT', code: 'AUTHORITY_HELD' });
  });

  it('released_authority_allows_a_new_holder', async () => {
    const coordinator = new LocalSessionCoordinator();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(first.kind).toBe('LOCAL_COMMITTED');
    if (first.kind !== 'LOCAL_COMMITTED') return;
    const released = await coordinator.releaseAuthority(
      'session-1',
      profileId,
      'tab-a',
      first.value.generation,
      'op-release',
    );
    expect(released.kind).toBe('LOCAL_COMMITTED');
    const next = await coordinator.acquireAuthority(
      'session-2',
      profileId,
      'tab-b',
      null,
      'op-b',
    );
    expect(next.kind).toBe('LOCAL_COMMITTED');
  });

  it('authority_operations_are_idempotent_and_reject_payload_reuse', async () => {
    const coordinator = new LocalSessionCoordinator();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    const replay = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(replay).toEqual(first);
    const reused = await coordinator.acquireAuthority(
      'session-2',
      profileId,
      'tab-a',
      null,
      'op-a',
    );
    expect(reused).toEqual({ kind: 'INVALID', code: 'INVALID_OPERATION_ID_REUSED' });
  });

  it('repository_rejects_stale_authority', async () => {
    const coordinator = new LocalSessionCoordinator();
    const repository = new LocalSessionRepository();
    const first = await coordinator.acquireAuthority(
      'session-1',
      profileId,
      'tab-a',
      null,
      'op-auth-a',
    );
    if (first.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');

    const created = await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      sessionId: 'session-1',
      authority: first.value,
      session: baseSession(),
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');

    const transferred = await coordinator.transferAuthority(
      'session-1',
      profileId,
      'tab-a',
      'tab-b',
      first.value.generation,
      'op-transfer',
    );
    if (transferred.kind !== 'LOCAL_COMMITTED') throw new Error('authority not transferred');

    const stale = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-transition-stale', baseRevision: 1 },
      sessionId: 'session-1',
      authority: first.value,
      nextState: 'RUNNING',
    });
    expect(stale).toEqual({ kind: 'CONFLICT', code: 'STALE_AUTHORITY' });

    const valid = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-transition-valid', baseRevision: 1 },
      sessionId: 'session-1',
      authority: transferred.value,
      nextState: 'RUNNING',
    });
    expect(valid.kind).toBe('LOCAL_COMMITTED');
  });
});
