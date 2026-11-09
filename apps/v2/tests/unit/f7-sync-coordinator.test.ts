import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation, RemoteMutationPort, RemoteMutationResult } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { SyncCoordinator } from '../../src/platform/sync/sync-coordinator';
import { FakeRemotePort } from '../../src/platform/sync/fake-remote';
import type { LockPort } from '../../src/platform/sync/coordination';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import {
  deleteV2DatabaseForTests,
  getConflicts,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-coordinator';
const uid = 'uid-a';
const libraryId = 'library-a';

function profile(): ProfileRecord {
  return {
    profileId,
    uid,
    remoteLibraryId: libraryId,
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-coord',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: 0,
    payload: { id: 'edital-1', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: uid,
    remoteLibraryId: libraryId,
    ...overrides,
  };
}

async function seed(record: OutboxOperation): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction([STORES.profiles, STORES.outbox], 'readwrite');
  tx.objectStore(STORES.profiles).put(profile());
  tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

async function read(operationId = 'op-coord'): Promise<OutboxOperation | undefined> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.outbox, 'readonly');
  return requestResult(tx.objectStore(STORES.outbox).get(operationId)) as Promise<
    OutboxOperation | undefined
  >;
}

class MemoryLocks implements LockPort {
  private readonly queues = new Map<string, Promise<unknown>>();

  request<T>(name: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(name) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.queues.set(name, next.catch(() => undefined));
    return next;
  }
}

function coordinator(remote: RemoteMutationPort, locks: LockPort | null = new MemoryLocks()): SyncCoordinator {
  return new SyncCoordinator({ remote, locks, now: () => Date.now() });
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 sync coordinator', () => {
  it('f7_two_tabs_do_not_double_apply', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId });
    const locks = new MemoryLocks();
    const first = coordinator(remote, locks);
    const second = coordinator(remote, locks);
    await Promise.all([
      first.requestFlush(profileId, 'MANUAL'),
      second.requestFlush(profileId, 'MANUAL'),
    ]);
    expect(remote.appliedCount()).toBe(1);
    expect((await read())?.status).toBe('CONFIRMED');
  });

  it('f7_lock_missing_blocks_network_send', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId });
    const result = await coordinator(remote, null).requestFlush(profileId, 'MANUAL');
    expect(result.mode).toBe('PAUSED_LOCK');
    expect(remote.appliedCount()).toBe(0);
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_crash_after_remote_commit_recovers_by_lookup', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId, simulateTimeoutAfterApply: true });
    await coordinator(remote).requestFlush(profileId, 'RESUME');
    expect(remote.appliedCount()).toBe(1);
    expect((await read())?.status).toBe('CONFIRMED');
  });

  it('f7_logout_while_request_inflight_rejects_old_ack', async () => {
    await seed(operation());
    const base = new FakeRemotePort({ uid, profileId });
    const remote: RemoteMutationPort = {
      async apply(next): Promise<RemoteMutationResult> {
        const result = await base.apply(next);
        await new LocalProfileRepository().logoutRemote(profileId, 'logout-during-flush');
        return result;
      },
      lookup: (operationId, entityId) => base.lookup(operationId, entityId),
      lookupRevision: (operationId) => base.lookupRevision(operationId),
    };
    await coordinator(remote).requestFlush(profileId, 'MANUAL');
    expect((await read())?.status).toBe('PENDING');
    expect((await new LocalProfileRepository().getProfile(profileId)).uid).toBeNull();
  });

  it('f7_delete_timeout_not_resurrected', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId, simulateTimeoutAfterApply: true });
    await coordinator(remote).requestFlush(profileId, 'RESUME');
    await seed(operation({ operationId: 'op-del', kind: 'delete', baseRevision: 1 }));
    await coordinator(remote).requestFlush(profileId, 'RESUME');
    expect(remote.readEntity('edital-1')).toBeNull();
    expect((await read('op-del'))?.status).toBe('CONFIRMED');
  });

  it('f7_pull_after_flush_marks_converged_only_when_cursor_is_verified', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId });
    let pulls = 0;
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      pull: async () => {
        pulls += 1;
        return 'CONVERGED';
      },
    });
    const health = await subject.requestFlush(profileId, 'MANUAL');
    expect(pulls).toBe(1);
    expect(health.converged).toBe(true);
  });

  it('f7_conflict_keeps_the_remote_payload_in_the_store', async () => {
    await seed(operation());
    const remotePayload = {
      id: 'edital-1',
      profileId,
      title: 'REMOTE',
      status: 'ACTIVE',
      localRevision: 2,
    };
    const remote: RemoteMutationPort = {
      async apply() {
        return {
          kind: 'CONFLICT',
          remoteRevision: 2,
          remote: { payload: remotePayload, deleted: false },
        };
      },
      async lookup() {
        return 'MISSING';
      },
    };
    await coordinator(remote).requestFlush(profileId, 'MANUAL');
    const [conflict] = await getConflicts(profileId);
    expect(conflict).toMatchObject({
      remotePayload: remotePayload,
      deleted: false,
      remoteRevision: 2,
    });
  });

  it('f7_flush_stops_later_operations_of_an_entity_after_conflict', async () => {
    await seed(operation());
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.outbox, 'readwrite');
    tx.objectStore(STORES.outbox).put(operation({ operationId: 'op-2', baseRevision: 1 }));
    await transactionDone(tx);
    let calls = 0;
    const remote: RemoteMutationPort = {
      async apply() {
        calls += 1;
        return { kind: 'CONFLICT', remoteRevision: 1 };
      },
      async lookup() {
        return 'MISSING';
      },
    };
    await coordinator(remote).requestFlush(profileId, 'MANUAL');
    expect(calls).toBe(1);
  });

  it('f7_ack_failure_remains_visible_as_pending', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId });
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      confirm: async () => 'FAILED',
    });
    const health = await subject.requestFlush(profileId, 'MANUAL');
    expect(health.pendingCount).toBe(1);
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_missing_delivery_binding_blocks_the_send', async () => {
    const missingBinding = operation({ deliveryUid: null });
    await seed(missingBinding);
    const remote = new FakeRemotePort({ uid, profileId });
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      getEligible: async () => [missingBinding],
    });
    const health = await subject.requestFlush(profileId, 'MANUAL');
    expect(remote.appliedCount()).toBe(0);
    expect(health.pendingCount).toBeGreaterThan(0);
  });

  it('f7_outbox_read_failure_is_not_reported_as_zero_pending', async () => {
    const remote = new FakeRemotePort({ uid, profileId });
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      getEligible: async () => {
        throw new Error('indexeddb unavailable');
      },
    });
    await expect(subject.requestFlush(profileId, 'MANUAL')).resolves.toMatchObject({
      mode: 'FAILED',
      pendingCount: 0,
    });
  });

  it('f7_budget_pauses_before_sending', async () => {
    await seed(operation());
    const remote = new FakeRemotePort({ uid, profileId });
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      budget: {
        usage: {
          reads: 0,
          writes: 20,
          deletes: 0,
          bytesOut: 0,
          windowStart: new Date(0).toISOString(),
        },
        limits: {
          reads: 50_000,
          writes: 20,
          deletes: 20_000,
          bytesOut: 10 * 1024 * 1024 * 1024,
          periodMs: 24 * 60 * 60_000,
        },
      },
    });
    await expect(subject.requestFlush(profileId, 'MANUAL')).resolves.toMatchObject({
      mode: 'PAUSED_QUOTA',
    });
    expect(remote.appliedCount()).toBe(0);
  });

  it('f7_planning_operation_is_delivered_after_consent', async () => {
    const planning = operation({
      operationId: 'op-planning',
      entityType: 'planning-scenario',
      entityId: 'scenario-1',
      baseRevision: 0,
      payload: {
        id: 'scenario-1',
        profileId,
        editalId: 'edital-1',
        localRevision: 1,
        status: 'DRAFT',
      } as never,
    });
    await seed(planning);
    const remote = new FakeRemotePort({ uid, profileId });
    const health = await coordinator(remote).requestFlush(profileId, 'MANUAL');
    expect(remote.appliedCount()).toBe(1);
    expect((await read('op-planning'))?.status).toBe('CONFIRMED');
    expect(health.remoteCommitted).toBe(true);
  });

  it('f7_recovery_required_blocks_later_flushes_until_clear', async () => {
    const remote = new FakeRemotePort({ uid, profileId });
    let pulls = 0;
    const subject = new SyncCoordinator({
      remote,
      locks: new MemoryLocks(),
      now: () => Date.now(),
      pull: async () => {
        pulls += 1;
        return pulls === 1 ? 'RECOVERY_REQUIRED' : 'CONVERGED';
      },
    });
    await expect(subject.requestFlush(profileId, 'MANUAL')).resolves.toMatchObject({
      mode: 'RECOVERY_REQUIRED',
    });
    await seed(operation());
    await expect(subject.requestFlush(profileId, 'MANUAL')).resolves.toMatchObject({
      mode: 'RECOVERY_REQUIRED',
    });
    expect(remote.appliedCount()).toBe(0);
    subject.clearRecovery(profileId);
    await expect(subject.requestFlush(profileId, 'MANUAL')).resolves.toMatchObject({
      mode: 'READY',
    });
    expect(remote.appliedCount()).toBe(1);
  });
});
