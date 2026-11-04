import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation, OutboxPayload } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import {
  reconcileRemoteEntity,
  resolveRemoteConflict,
} from '../../src/platform/sync/conflict-reconciliation';
import type { RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  deleteV2DatabaseForTests,
  getConflicts,
  markConflict,
  openV2Database,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-conflict';
const uid = 'uid-a';
const libraryId = 'library-a';

function remote(overrides: Partial<RemoteEntity> = {}): RemoteEntity {
  return {
    entityId: 'edital-1',
    entityType: 'edital',
    schemaVersion: 1,
    revision: 2,
    deleted: false,
    payload: { id: 'edital-1', profileId, title: 'B', status: 'ACTIVE', localRevision: 2 },
    epoch: 1,
    ...overrides,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-conflict',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: 1,
    payload: { id: 'edital-1', profileId, title: 'A', status: 'ACTIVE', localRevision: 1 },
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
  const profile: ProfileRecord = {
    profileId,
    uid,
    remoteLibraryId: libraryId,
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
  };
  tx.objectStore(STORES.profiles).put(profile);
  tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 sync conflicts', () => {
  it('f7_independent_entity_changes_merge', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    const result = reconcileRemoteEntity(
      local,
      remote({
        payload: {
          id: 'edital-1',
          profileId,
          title: 'A',
          status: 'ARCHIVED',
          localRevision: 1,
        },
      }),
      [],
    );
    expect(result).toEqual({
      kind: 'APPLY',
      next: { id: 'edital-1', profileId, title: 'A', localRevision: 1, status: 'ARCHIVED' },
    });
  });

  it('f7_same_field_offline_conflict_retains_both_versions', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    const result = reconcileRemoteEntity(local, remote(), []);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind === 'CONFLICT') {
      expect(result.conflict.local).toEqual(local);
      expect(result.conflict.remote).toEqual(remote().payload);
      expect(result.conflict.reason).toContain('FIELD_CONFLICT');
    }
  });

  it('f7_delete_vs_edit_needs_decision', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    expect(reconcileRemoteEntity(local, remote({ deleted: true, payload: null }), []).kind).toBe(
      'CONFLICT',
    );
    expect(
      reconcileRemoteEntity(local, remote(), [operation({ kind: 'delete' })]).kind,
    ).toBe('CONFLICT');
  });

  it('f7_stale_resolution_rejected', async () => {
    const record = operation();
    await seed(record);
    await markConflict(profileId, record, 2, { payload: remote().payload, deleted: false });
    const [conflict] = await getConflicts(profileId);
    expect(conflict).toBeDefined();
    await expect(resolveRemoteConflict(conflict!.conflictId, 'LOCAL', 1)).resolves.toBe('STALE');
    await expect(resolveRemoteConflict(conflict!.conflictId, 'LOCAL', 2)).resolves.toBe(
      'LOCAL_COMMITTED',
    );
    await expect(resolveRemoteConflict(conflict!.conflictId, 'REMOTE', 2)).resolves.toBe('STALE');
  });

  it('f7_conflict_in_one_entity_does_not_block_other_entities', async () => {
    const first = operation();
    const second = operation({ operationId: 'op-2', entityId: 'edital-2' });
    await seed(first);
    await seed(second);
    await markConflict(profileId, first, 2, { payload: remote().payload, deleted: false });
    await markConflict(profileId, second, 2, { payload: remote({ entityId: 'edital-2' }).payload, deleted: false });
    const conflicts = await getConflicts(profileId);
    expect(conflicts).toHaveLength(2);
    await resolveRemoteConflict(conflicts[0]!.conflictId, 'REMOTE', 2);
    expect((await getConflicts(profileId)).filter((item) => item.status === 'OPEN')).toHaveLength(1);
  });
});
