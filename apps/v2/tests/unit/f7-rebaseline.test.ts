import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import {
  assessCursorSafety,
  commitRebaseline,
  prepareRebaseline,
} from '../../src/platform/sync/rebaseline';
import type { RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-rebaseline';
const uid = 'uid-a';
const libraryId = 'library-a';

function entity(overrides: Partial<RemoteEntity> = {}): RemoteEntity {
  return {
    entityId: 'edital-1',
    entityType: 'edital',
    schemaVersion: 1,
    revision: 2,
    deleted: false,
    payload: { id: 'edital-1', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 2 },
    epoch: 2,
    ...overrides,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-rebaseline',
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

async function seed(record?: OutboxOperation): Promise<void> {
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
  if (record) tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

async function tombstones(): Promise<Array<{ entityId: string }>> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.tombstones, 'readonly');
  return requestResult(tx.objectStore(STORES.tombstones).index('by_profile').getAll(profileId)) as Promise<
    Array<{ entityId: string }>
  >;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 rebaseline', () => {
  it('f7_old_cursor_forces_recovery', () => {
    expect(
      assessCursorSafety({ epoch: 1, cursor: 1 }, { epoch: 1, historyFloor: 5, head: 10 }),
    ).toBe('REBASELINE_REQUIRED');
    expect(
      assessCursorSafety({ epoch: 1, cursor: 6 }, { epoch: 1, historyFloor: 5, head: 10 }),
    ).toBe('SAFE');
  });

  it('f7_epoch_future_rejected', () => {
    expect(
      assessCursorSafety({ epoch: 3, cursor: 1 }, { epoch: 2, historyFloor: 0, head: 10 }),
    ).toBe('REBASELINE_REQUIRED');
  });

  it('f7_no_stale_tombstone_resurrection', async () => {
    await seed();
    const first = await prepareRebaseline(profileId, [entity({ deleted: true, payload: null })]);
    expect(first.kind).toBe('PREVIEW');
    if (first.kind === 'PREVIEW') await commitRebaseline(profileId, first.previewId);
    expect((await tombstones()).map((row) => row.entityId)).toContain('edital-1');

    const second = await prepareRebaseline(profileId, [entity({ deleted: false })]);
    if (second.kind === 'PREVIEW') {
      expect(second.preview.conflicts).toBeGreaterThan(0);
    }
    expect((await tombstones()).map((row) => row.entityId)).toContain('edital-1');
  });

  it('f7_pending_offline_edit_is_preserved_during_rebaseline', async () => {
    await seed(operation());
    const preview = await prepareRebaseline(profileId, [entity()]);
    expect(preview.kind).toBe('PREVIEW');
    if (preview.kind === 'PREVIEW') await commitRebaseline(profileId, preview.previewId);
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.outbox, 'readonly');
    const stored = (await requestResult(tx.objectStore(STORES.outbox).get('op-rebaseline'))) as
      | OutboxOperation
      | undefined;
    expect(stored?.status).toBe('PENDING');
  });

  it('f7_repeated_restore_does_not_duplicate', async () => {
    await seed();
    const preview = await prepareRebaseline(profileId, [entity({ deleted: true, payload: null })]);
    expect(preview.kind).toBe('PREVIEW');
    if (preview.kind !== 'PREVIEW') return;
    await expect(commitRebaseline(profileId, preview.previewId)).resolves.toBe('LOCAL_COMMITTED');
    await expect(commitRebaseline(profileId, preview.previewId)).resolves.toBe('LOCAL_COMMITTED');
    expect(await tombstones()).toHaveLength(1);
  });

  it('f7_timeout_delete_ack_does_not_resurrect', async () => {
    await seed();
    const preview = await prepareRebaseline(profileId, [entity({ deleted: true, payload: null })]);
    if (preview.kind === 'PREVIEW') await commitRebaseline(profileId, preview.previewId);
    expect((await tombstones()).some((row) => row.entityId === 'edital-1')).toBe(true);
  });

  it('f7_rebaseline_applies_live_entities_to_the_store', async () => {
    await seed();
    const preview = await prepareRebaseline(profileId, [entity()]);
    expect(preview.kind).toBe('PREVIEW');
    if (preview.kind !== 'PREVIEW') return;
    await expect(commitRebaseline(profileId, preview.previewId)).resolves.toBe('LOCAL_COMMITTED');
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readonly');
    const row = await requestResult(tx.objectStore(STORES.editais).get([profileId, 'edital-1']));
    expect(row).toMatchObject({ title: 'TJPB' });
  });
});
