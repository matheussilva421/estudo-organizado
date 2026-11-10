import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { snapshotChecksum, type F7BackupSnapshot } from '../../src/platform/backup/f7-format';
import { commitF7Restore, prepareF7Restore } from '../../src/platform/backup/restore-commit';
import { previewLink } from '../../src/application/sync-policy';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import {
  deleteV2DatabaseForTests,
  getEligibleOutbox,
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
  const manifest = {
    formatVersion: 3 as const,
    profileId,
    recordCount: 1,
    epoch: 1,
    deletionHistoryComplete: true,
    ...overrides,
  };
  const checksum =
    overrides.checksum ??
    (await snapshotChecksum(
      {
        formatVersion: manifest.formatVersion,
        profileId: manifest.profileId,
        recordCount: manifest.recordCount,
        epoch: manifest.epoch,
        deletionHistoryComplete: manifest.deletionHistoryComplete,
      },
      payload,
    ));
  return {
    manifest: { ...manifest, checksum },
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

async function editalRow(): Promise<Record<string, unknown> | undefined> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.editais, 'readonly');
  return (await requestResult(
    tx.objectStore(STORES.editais).get([profileId, 'edital-1']),
  )) as Record<string, unknown> | undefined;
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
    expect(stored?.deliveryMode).toBe('BLOCKED');
    expect(stored?.blockedReason).toBe('RESTORE');
    await expect(getEligibleOutbox(profileId, Date.now())).resolves.toEqual([]);

    const proof = {
      profileId,
      uid,
      remoteLibraryId: libraryId,
      consent: true as const,
      preview: previewLink(profileId, uid, { remoteCount: 0, remoteLibraryId: libraryId }),
    };
    await expect(
      new LocalProfileRepository().adoptLocalOperations(profileId, uid, libraryId, proof),
    ).resolves.toMatchObject({ kind: 'LOCAL_COMMITTED' });
    const afterRelink = db.transaction(STORES.outbox, 'readonly');
    const blocked = (await requestResult(
      afterRelink.objectStore(STORES.outbox).get('op-restore'),
    )) as OutboxOperation | undefined;
    expect(blocked?.deliveryMode).toBe('BLOCKED');
    expect(blocked?.blockedReason).toBe('RESTORE');
  });

  it('f7_restore_invalidates_cursor_and_requires_rebaseline', async () => {
    const record: OutboxOperation = {
      operationId: 'op-cursor',
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
    const db = await openV2Database(profileId);
    const cursorTx = db.transaction(STORES.meta, 'readwrite');
    cursorTx.objectStore(STORES.meta).put({
      key: `sync-cursor:${profileId}`,
      value: {
        profileId,
        uid,
        libraryId,
        epoch: 1,
        cursor: 7,
        updatedAt: new Date().toISOString(),
      },
    });
    await transactionDone(cursorTx);

    const prepared = await prepareF7Restore(await snapshot(), profileId);
    if (prepared.kind === 'PREVIEW') await commitF7Restore(prepared.preview.id, true);
    const keys = await metaKeys();
    expect(keys).not.toContain(`sync-cursor:${profileId}`);
    expect(keys).toContain(`recovery-required:${profileId}`);
  });

  it('f7_restore_local_only_blocks_outbox_without_a_remote_recovery_gate', async () => {
    const record: OutboxOperation = {
      operationId: 'op-local-only',
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
    const db = await openV2Database(profileId);
    const profileTx = db.transaction(STORES.profiles, 'readwrite');
    profileTx.objectStore(STORES.profiles).put({
      profileId,
      uid: null,
      remoteLibraryId: null,
      syncEnabled: false,
      state: 'LOCAL_ONLY',
      primaryEditalId: null,
      localRevision: 1,
    });
    await transactionDone(profileTx);
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    if (prepared.kind === 'PREVIEW') await commitF7Restore(prepared.preview.id, true);
    const tx = db.transaction(STORES.outbox, 'readonly');
    const stored = (await requestResult(
      tx.objectStore(STORES.outbox).get('op-local-only'),
    )) as OutboxOperation | undefined;
    expect(stored).toMatchObject({ deliveryMode: 'BLOCKED', blockedReason: 'RESTORE' });
    expect(await metaKeys()).not.toContain(`recovery-required:${profileId}`);
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

  it('f7_restore_applies_entities_to_the_target_stores', async () => {
    await seed();
    const prepared = await prepareF7Restore(await snapshot(), profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');
    await expect(editalRow()).resolves.toMatchObject({ title: 'TJPB' });
  });

  it('f7_restore_preview_counts_existing_rows_as_updates', async () => {
    await seed();
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readwrite');
    tx.objectStore(STORES.editais).put({
      profileId,
      id: 'edital-1',
      title: 'OLD',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await transactionDone(tx);

    const prepared = await prepareF7Restore(await snapshot(), profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    expect(prepared.preview.toUpdate).toBe(1);
    expect(prepared.preview.toCreate).toBe(0);
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');
    await expect(editalRow()).resolves.toMatchObject({ title: 'TJPB' });
  });

  it('f7_restore_does_not_write_an_orphan_reference', async () => {
    await seed();
    const payload = {
      [STORES.subjects]: [{ profileId, id: 'subject-1', title: 'Disciplina' }],
      [STORES.editalDisciplines]: [
        { profileId, id: 'link-1', editalId: 'missing-edital', subjectId: 'subject-1' },
      ],
    };
    const manifestFields = {
      formatVersion: 3 as const,
      profileId,
      recordCount: 2,
      epoch: 1,
      deletionHistoryComplete: true,
    };
    const snapshot = {
      manifest: { ...manifestFields, checksum: await snapshotChecksum(manifestFields, payload) },
      payload,
    };
    const prepared = await prepareF7Restore(snapshot, profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    expect(prepared.preview.conflicts).toBe(1);
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');
    const db = await openV2Database(profileId);
    const tx = db.transaction([STORES.subjects, STORES.editalDisciplines], 'readonly');
    await expect(
      requestResult(tx.objectStore(STORES.subjects).get([profileId, 'subject-1'])),
    ).resolves.toBeDefined();
    await expect(
      requestResult(tx.objectStore(STORES.editalDisciplines).get([profileId, 'link-1'])),
    ).resolves.toBeUndefined();
  });

  it('f7_restore_propagates_a_tombstoned_parent_to_descendants', async () => {
    await seed();
    const db = await openV2Database(profileId);
    const tombstoneTx = db.transaction(STORES.tombstones, 'readwrite');
    tombstoneTx.objectStore(STORES.tombstones).put({
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      operationId: 'delete-edital',
      baseRevision: 1,
      epoch: 2,
      deleted: true,
      deletedAt: new Date().toISOString(),
      snapshot: {},
    });
    await transactionDone(tombstoneTx);

    const payload = {
      [STORES.editais]: [{ profileId, id: 'edital-1', title: 'TJPB' }],
      [STORES.subjects]: [{ profileId, id: 'subject-1', title: 'Disciplina' }],
      [STORES.editalDisciplines]: [
        { profileId, id: 'link-1', editalId: 'edital-1', subjectId: 'subject-1' },
      ],
      [STORES.assuntos]: [
        { profileId, id: 'assunto-1', editalDisciplineId: 'link-1', parentId: null },
      ],
    };
    const manifestFields = {
      formatVersion: 3 as const,
      profileId,
      recordCount: 4,
      epoch: 1,
      deletionHistoryComplete: true,
    };
    const input = {
      manifest: { ...manifestFields, checksum: await snapshotChecksum(manifestFields, payload) },
      payload,
    };
    const prepared = await prepareF7Restore(input, profileId);
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    expect(prepared.preview.conflicts).toBe(3);
    await expect(commitF7Restore(prepared.preview.id, true)).resolves.toBe('LOCAL_COMMITTED');

    const check = db.transaction(
      [STORES.subjects, STORES.editalDisciplines, STORES.assuntos],
      'readonly',
    );
    await expect(
      requestResult(check.objectStore(STORES.subjects).get([profileId, 'subject-1'])),
    ).resolves.toBeDefined();
    await expect(
      requestResult(check.objectStore(STORES.editalDisciplines).get([profileId, 'link-1'])),
    ).resolves.toBeUndefined();
    await expect(
      requestResult(check.objectStore(STORES.assuntos).get([profileId, 'assunto-1'])),
    ).resolves.toBeUndefined();
  });
});
