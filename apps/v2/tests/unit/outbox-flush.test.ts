import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation, RemoteMutationPort } from '../../src/application/sync-types';
import { DOMAIN_SCHEMA_VERSION } from '../../src/domain/versions';
import { FakeRemotePort } from '../../src/platform/sync/fake-remote';
import { flushPending } from '../../src/platform/sync/flush';
import {
  deleteV2DatabaseForTests,
  getConflicts,
  markConflict,
  markConfirmed,
  openV2Database,
  STORES,
} from '../../src/platform/indexeddb';

const profileId = 'profile-a';

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  const entityId = overrides.entityId ?? 'subject-1';
  return {
    operationId: overrides.operationId ?? 'op-1',
    profileId,
    entityType: 'subject',
    entityId,
    kind: 'upsert',
    baseRevision: null,
    payload: { id: entityId, profileId, title: 'Direito', localRevision: 1 },
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    status: 'PENDING',
    ...overrides,
  };
}

async function seedOutbox(item: OutboxOperation): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.outbox, 'readwrite');
  transaction.objectStore(STORES.outbox).put(item);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('outbox flush', () => {
  it('timeout_after_commit_requires_readback_and_is_idempotent', async () => {
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId, simulateTimeoutAfterApply: true });
    const first = operation();
    const result = await flushPending([first], remote);

    expect(result.confirmedIds).toEqual(['op-1']);
    expect(result.pending).toEqual([]);
    expect(await remote.lookup('op-1')).toBe('APPLIED');
    expect(await remote.lookupRevision('op-1')).toBe(1);

    const replay = await remote.apply(first);
    expect(replay).toEqual({ kind: 'ALREADY_APPLIED', remoteRevision: 1 });
  });

  it('ack_future_or_missing_operation_is_rejected', async () => {
    await expect(markConfirmed(profileId, ['missing'], { missing: 1 })).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
    await seedOutbox(operation());
    await expect(markConfirmed(profileId, ['op-1'], { 'op-1': 0 })).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  it('network_failure_keeps_outbox', async () => {
    const remote: RemoteMutationPort = {
      apply: () => Promise.reject(new Error('offline')),
      lookup: () => Promise.resolve('UNKNOWN'),
    };
    const result = await flushPending([operation()], remote);

    expect(result.confirmedIds).toEqual([]);
    expect(result.pending).toEqual(['op-1']);
  });

  it('concurrent_conflicting_edit_preserves_both_versions', async () => {
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    await flushPending([operation()], remote);

    const stale = operation({
      operationId: 'op-2',
      baseRevision: 0,
      payload: { id: 'subject-1', profileId, title: 'Direito Civil', localRevision: 2 },
    });
    const result = await flushPending([stale], remote);

    expect(result.conflicts).toEqual(['op-2']);
    await seedOutbox(stale);
    await markConflict(profileId, stale, 1);
    const conflicts = await getConflicts(profileId);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.localPayload).toMatchObject({ title: 'Direito Civil' });
    expect(conflicts[0]?.remoteRevision).toBe(1);
  });
});
