import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import type { F7BackupSnapshot } from '../../src/platform/backup/f7-format';
import { commitF7Restore, prepareF7Restore } from '../../src/platform/backup/restore-commit';
import { digestPayload } from '../../src/platform/sync/firebase-remote';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-restore';
const uid = 'uid-a';
const libraryId = 'library-a';

async function snapshot(overrides: Partial<F7BackupSnapshot['manifest']> = {}): Promise<F7BackupSnapshot> {
  const payload = { editais: [{ profileId, id: 'edital-1', title: 'TJPB' }] };
  return {
    manifest: {
      formatVersion: 3,
      profileId,
      recordCount: 1,
      checksum: await digestPayload(payload),
      epoch: 1,
      deletionHistoryComplete: true,
      ...overrides,
    },
    payload,
  };
}

async function seed(record?: OutboxOperation): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction([STORES.profiles, STORES.outbox, STORES.meta], 'readwrite');
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
  tx.objectStore(STORES.meta).put({ key: `epoch:${profileId}`, epoch: 2 });
  await transactionDone(tx);
}

async function metaKeys(): Promise<string[]> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.meta, 'readonly');
  const rows = (await requestResult(tx.objectStore(STORES.meta).getAll())) as Array<{ key: string }>;
  return rows.map((row) => row.key);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 restore', () => {
  it('f7_restore_is_readonly_until_consent', async () => {
    await seed();
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    await expect(commitF7Restore(prepared.preview.id, false as unknown as true)).resolves.toBe('FAILED');
    expect(await metaKeys()).not.toContain(`restore:${profileId}`);
  });

  it('f7_restore_rejects_checksum_mismatch', async () => {
    await seed();
    const input = await snapshot({ checksum: '0'.repeat(64) });
    await expect(prepareF7Restore(input, profileId)).resolves.toMatchObject({ kind: 'INVALID' });
  });

  it('f7_restore_old_epoch_cannot_resurrect_deleted', async () => {
    await seed();
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.tombstones, 'readwrite');
    tx.objectStore(STORES.tombstones).put({
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      operationId: 'old-delete',
      baseRevision: 1,
      epoch: 2,
      deleted: true,
      deletedAt: new Date().toISOString(),
      snapshot: {},
    });
    await transactionDone(tx);
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind === 'PREVIEW') {
      expect(prepared.preview.requiresRebaseline).toBe(true);
      expect(prepared.preview.conflicts).toBe(1);
      await commitF7Restore(prepared.preview.id, true);
    }
    const check = db.transaction(STORES.tombstones, 'readonly');
    const rows = (await requestResult(check.objectStore(STORES.tombstones).getAll())) as unknown[];
    expect(rows).toHaveLength(1);
  });

  it('f7_restore_pending_outbox_not_replayed_automatically', async () => {
    const record: OutboxOperation = {
      operationId: 'op-restore',
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      kind: 'upsert',
      baseRevision: 0,
      payload: { id: 'edital-1', profileId, title: 'A', status: 'ACTIVE', localRevision: 1 },
      schemaVersion: 1,
      status: 'PENDING',
      deliveryUid: uid,
      remoteLibraryId: libraryId,
    };
    await seed(record);
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    if (prepared.kind === 'PREVIEW') await commitF7Restore(prepared.preview.id, true);
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.outbox, 'readonly');
    const stored = (await requestResult(tx.objectStore(STORES.outbox).get('op-restore'))) as OutboxOperation | undefined;
    expect(stored?.status).toBe('PENDING');
  });

  it('f7_restore_aborted_commit_preserves_original', async () => {
    await seed();
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    if (prepared.kind !== 'PREVIEW') return;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('INSUFFICIENT_SPACE');
    } finally {
      spy.mockRestore();
    }
    expect(await metaKeys()).not.toContain(`restore:${profileId}`);
  });

  it('f7_wrong_uid_restores_only_to_isolated_namespace', async () => {
    await seed();
    const prepared = await prepareF7Restore(await snapshot({ profileId: 'other-profile' }), profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind === 'PREVIEW') await commitF7Restore(prepared.preview.id, true);
    expect(await metaKeys()).toContain(`restore:${profileId}`);
  });

  it('f7_idempotent_restore_on_repeat', async () => {
    await seed();
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    if (prepared.kind !== 'PREVIEW') return;
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');
    expect((await metaKeys()).filter((key) => key === `restore:${profileId}`)).toHaveLength(1);
  });
});
