import { beforeEach, describe, expect, it } from 'vitest';
import type { GoogleAuthPort, GoogleIdentity } from '../../src/application/google-auth-types';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { F7Runtime } from '../../src/platform/f7-runtime';
import { collectF7Backup } from '../../src/platform/backup/collect';
import {
  deleteV2DatabaseForTests,
  getRecoveryRequired,
  getSyncCursor,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import type { RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  commitRebaseline,
  prepareRebaseline,
  recoverySnapshotChecksum,
  saveRecoveryBackup,
} from '../../src/platform/sync/rebaseline';

const profileId = 'profile-recovery';
const uid = 'uid-a';
const libraryId = 'library-a';
const identityA: GoogleIdentity = { uid, email: 'a@example.com' };
const identityB: GoogleIdentity = { uid: 'uid-b', email: 'b@example.com' };

function auth(identity: GoogleIdentity | null): GoogleAuthPort {
  return {
    async signIn() {
      if (!identity) throw new Error('sem sessão');
      return identity;
    },
    async signOut() {},
    async current() {
      return identity;
    },
    async getIdToken() {
      return identity ? 'token' : null;
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function remoteEntity(overrides: Partial<RemoteEntity> = {}): RemoteEntity {
  return {
    entityId: 'subject-remote',
    entityType: 'subject',
    schemaVersion: 1,
    revision: 1,
    deleted: false,
    epoch: 2,
    payload: {
      id: 'subject-remote',
      profileId,
      title: 'Remoto',
      status: 'ACTIVE',
      localRevision: 1,
    },
    ...overrides,
  };
}

const recoverySnapshot = {
  kind: 'OK' as const,
  entities: [remoteEntity()],
  epoch: 2,
  head: 5,
  historyFloor: 5,
  historyMode: 'SNAPSHOT_ONLY' as const,
  capturedAt: '2026-11-10T10:00:00.000Z',
};

async function seed(): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(
    [
      STORES.profiles,
      STORES.meta,
      STORES.outbox,
      STORES.conflicts,
      STORES.tombstones,
      STORES.subjects,
    ],
    'readwrite',
  );
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
  tx.objectStore(STORES.meta).put({
    key: `recovery-required:${profileId}`,
    value: { reason: 'RESTORE_COMMITTED', at: '2026-11-10T09:00:00.000Z' },
  });
  tx.objectStore(STORES.meta).put({ key: `epoch:${profileId}`, epoch: 1 });
  tx.objectStore(STORES.subjects).put({
    profileId,
    id: 'subject-local',
    title: 'Local',
    status: 'ACTIVE',
    localRevision: 1,
  });
  tx.objectStore(STORES.outbox).put({
    operationId: 'op-restore-blocked',
    profileId,
    entityType: 'subject',
    entityId: 'subject-local',
    kind: 'upsert',
    baseRevision: 0,
    payload: { id: 'subject-local', profileId, title: 'Local', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryMode: 'BLOCKED',
    blockedReason: 'RESTORE',
    deliveryUid: uid,
    remoteLibraryId: libraryId,
  } satisfies OutboxOperation);
  tx.objectStore(STORES.conflicts).put({
    conflictId: 'conflict-1',
    profileId,
    operationId: 'op-conflict',
    entityType: 'subject',
    entityId: 'subject-local',
    localPayload: { id: 'subject-local', profileId, title: 'Local', localRevision: 1 },
    remotePayload: { id: 'subject-local', profileId, title: 'Remoto', localRevision: 2 },
    baseRevision: 0,
    remoteRevision: 2,
    deleted: false,
    status: 'OPEN',
    createdAt: '2026-11-10T09:00:00.000Z',
  });
  tx.objectStore(STORES.tombstones).put({
    profileId,
    entityType: 'subject',
    entityId: 'subject-deleted',
    operationId: 'delete-1',
    baseRevision: 1,
    epoch: 1,
    deleted: true,
    deletedAt: '2026-11-10T09:00:00.000Z',
    snapshot: {},
  });
  await transactionDone(tx);
}

function runtime(authPort: GoogleAuthPort): F7Runtime {
  return new F7Runtime(profileId, {}, {
    auth: authPort,
    recoverySnapshot: async () => recoverySnapshot,
  });
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 recovery', () => {
  it('f7_recovery_prepares_backup_snapshot_and_commit_clears_only_after_verification', async () => {
    await seed();
    const subject = runtime(auth(identityA));
    await subject.init();
    const prepared = await subject.prepareRecovery();
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    expect(prepared.preview.checkpoint).toMatchObject({ epoch: 2, head: 5 });
    expect(prepared.preview.outboxPending).toBe(1);
    expect(prepared.preview.openConflicts).toBe(1);
    expect(prepared.preview.tombstones).toBe(1);

    const backup = await subject.exportRecoveryBackup(prepared.preview.previewId);
    expect(backup?.manifest.checksum).toBe(prepared.preview.backupChecksum);
    expect(backup?.payload[STORES.outbox]?.length).toBe(1);
    expect(backup?.payload[STORES.conflicts]?.length).toBe(1);
    expect(backup?.payload[STORES.tombstones]?.length).toBe(1);

    await expect(subject.commitRecovery(prepared.preview.previewId)).resolves.toBe('RECOVERED');
    await expect(getRecoveryRequired(profileId)).resolves.toBeNull();
    await expect(getSyncCursor(profileId)).resolves.toMatchObject({ epoch: 2, cursor: 5 });
    const db = await openV2Database(profileId);
    const subjectTx = db.transaction(STORES.subjects, 'readonly');
    await expect(
      requestResult(subjectTx.objectStore(STORES.subjects).get([profileId, 'subject-remote'])),
    ).resolves.toMatchObject({ title: 'Remoto' });
    const outboxTx = db.transaction(STORES.outbox, 'readonly');
    await expect(
      requestResult(outboxTx.objectStore(STORES.outbox).get('op-restore-blocked')),
    ).resolves.toMatchObject({ deliveryMode: 'BLOCKED', blockedReason: 'RESTORE' });
    subject.dispose();
  });

  it('f7_recovery_blocks_a_switched_identity', async () => {
    await seed();
    const subject = runtime(auth(identityB));
    await subject.init();
    await expect(subject.prepareRecovery()).resolves.toMatchObject({
      kind: 'BLOCKED',
      reason: 'IDENTITY_MISMATCH',
    });
    await expect(getRecoveryRequired(profileId)).resolves.not.toBeNull();
    subject.dispose();
  });

  it('f7_recovery_blocks_a_stale_snapshot_and_keeps_the_marker', async () => {
    await seed();
    const subject = new F7Runtime(profileId, {}, {
      auth: auth(identityA),
      recoverySnapshot: async () => ({ kind: 'STALE', reason: 'HEAD_CHANGED_DURING_CAPTURE' }),
    });
    await subject.init();
    await expect(subject.prepareRecovery()).resolves.toMatchObject({
      kind: 'STALE',
      reason: 'HEAD_CHANGED_DURING_CAPTURE',
    });
    await expect(getRecoveryRequired(profileId)).resolves.not.toBeNull();
    await expect(subject.commitRecovery('missing-preview')).resolves.toBe('FAILED');
    subject.dispose();
  });

  it('f7_recovery_backup_contains_the_full_local_snapshot', async () => {
    await seed();
    const backup = await collectF7Backup(profileId);
    expect(backup.manifest.recordCount).toBeGreaterThan(0);
    expect(backup.payload[STORES.subjects]).toHaveLength(1);
    expect(backup.payload[STORES.outbox]).toHaveLength(1);
    expect(backup.payload[STORES.conflicts]).toHaveLength(1);
    expect(backup.payload[STORES.tombstones]).toHaveLength(1);
  });

  it('f7_recovery_rejects_a_snapshot_checksum_mismatch', async () => {
    await seed();
    const base = {
      uid,
      libraryId,
      epoch: 2,
      head: 5,
      historyFloor: 5,
      historyMode: 'SNAPSHOT_ONLY' as const,
    };
    const checksum = await recoverySnapshotChecksum(recoverySnapshot.entities, base);
    const result = await prepareRebaseline(profileId, recoverySnapshot.entities, {
      checkpoint: { ...base, snapshotChecksum: checksum === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64) },
      backupChecksum: 'a'.repeat(64),
      backupRecordCount: 0,
    });
    expect(result).toMatchObject({ kind: 'INVALID', reason: 'SNAPSHOT_CHECKSUM' });
  });

  it('f7_recovery_commit_without_backup_keeps_the_marker', async () => {
    await seed();
    const base = {
      uid,
      libraryId,
      epoch: 2,
      head: 5,
      historyFloor: 5,
      historyMode: 'SNAPSHOT_ONLY' as const,
    };
    const checksum = await recoverySnapshotChecksum(recoverySnapshot.entities, base);
    const prepared = await prepareRebaseline(profileId, recoverySnapshot.entities, {
      checkpoint: { ...base, snapshotChecksum: checksum },
      backupChecksum: 'b'.repeat(64),
      backupRecordCount: 2,
    });
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    await expect(commitRebaseline(profileId, prepared.previewId)).resolves.toBe('FAILED');
    await expect(getRecoveryRequired(profileId)).resolves.not.toBeNull();
  });

  it('f7_recovery_repeating_the_same_preview_is_idempotent', async () => {
    await seed();
    const base = {
      uid,
      libraryId,
      epoch: 2,
      head: 5,
      historyFloor: 5,
      historyMode: 'SNAPSHOT_ONLY' as const,
    };
    const checksum = await recoverySnapshotChecksum(recoverySnapshot.entities, base);
    const backup = await collectF7Backup(profileId);
    const prepared = await prepareRebaseline(profileId, recoverySnapshot.entities, {
      checkpoint: { ...base, snapshotChecksum: checksum },
      backupChecksum: backup.manifest.checksum,
      backupRecordCount: backup.manifest.recordCount,
    });
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    await saveRecoveryBackup(profileId, prepared.previewId, backup);
    await expect(commitRebaseline(profileId, prepared.previewId)).resolves.toBe('LOCAL_COMMITTED');
    await expect(commitRebaseline(profileId, prepared.previewId)).resolves.toBe('LOCAL_COMMITTED');
    await expect(getRecoveryRequired(profileId)).resolves.toBeNull();
  });

  it('f7_recovery_invalidates_a_preview_when_the_remote_head_changes', async () => {
    await seed();
    let current = { ...recoverySnapshot };
    const subject = new F7Runtime(profileId, {}, {
      auth: auth(identityA),
      recoverySnapshot: async () => current,
    });
    await subject.init();
    const prepared = await subject.prepareRecovery();
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    current = { ...current, head: 6, historyFloor: 6 };
    await expect(subject.commitRecovery(prepared.preview.previewId)).resolves.toBe('FAILED');
    await expect(getRecoveryRequired(profileId)).resolves.not.toBeNull();
    subject.dispose();
  });

  it('f7_recovery_accepts_an_incomplete_deletion_history_backup_and_sets_the_epoch', async () => {
    await seed();
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.meta, 'readwrite');
    tx.objectStore(STORES.meta).delete(`epoch:${profileId}`);
    await transactionDone(tx);
    const subject = runtime(auth(identityA));
    await subject.init();
    const prepared = await subject.prepareRecovery();
    expect(prepared.kind).toBe('PREVIEW');
    if (prepared.kind !== 'PREVIEW') return;
    expect(prepared.preview.backupDeletionHistoryComplete).toBe(false);
    await expect(subject.commitRecovery(prepared.preview.previewId)).resolves.toBe('RECOVERED');
    const check = db.transaction(STORES.meta, 'readonly');
    const epoch = (await requestResult(
      check.objectStore(STORES.meta).get(`epoch:${profileId}`),
    )) as { epoch?: number } | undefined;
    expect(epoch?.epoch).toBe(2);
    subject.dispose();
  });
});
