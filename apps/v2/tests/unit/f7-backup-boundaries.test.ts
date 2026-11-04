// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import type { F7BackupSnapshot } from '../../src/platform/backup/f7-format';
import { inspectF7Backup } from '../../src/platform/backup/f7-format';
import { collectF7Backup } from '../../src/platform/backup/collect';
import { decryptBackup, encryptSnapshot, type EncryptedBackup } from '../../src/platform/backup/crypto';
import { createKvBackupPort, KV_MAX_VALUE_BYTES } from '../../src/platform/backup/kv-client';
import { PersonalBackupScheduler } from '../../src/platform/backup/scheduler';
import { digestPayload } from '../../src/platform/sync/firebase-remote';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-boundary';
const uid = 'uid-a';

async function largeSnapshot(): Promise<F7BackupSnapshot> {
  const payload = {
    editais: [{ profileId, id: 'edital-1', title: 'TJPB', blob: 'x'.repeat(26 * 1024 * 1024) }],
  };
  return {
    manifest: {
      formatVersion: 3,
      profileId,
      recordCount: 1,
      checksum: await digestPayload(payload),
      epoch: 1,
      deletionHistoryComplete: true,
    },
    payload,
  };
}

async function seed(): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction([STORES.profiles, STORES.editais], 'readwrite');
  tx.objectStore(STORES.profiles).put({
    profileId,
    uid,
    remoteLibraryId: 'library-a',
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: 'edital-1',
    localRevision: 1,
  });
  tx.objectStore(STORES.editais).put({ profileId, id: 'edital-1', title: 'TJPB', status: 'ACTIVE', localRevision: 1 });
  await transactionDone(tx);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 backup boundaries', () => {
  it('f7_complete_archive_over_25mib_exports_locally', async () => {
    const original = await largeSnapshot();
    const envelope = await encryptSnapshot(original, 'senha');
    const decrypted = await decryptBackup(envelope, 'senha');
    expect((decrypted.payload.editais?.[0] as { blob: string }).blob).toHaveLength(26 * 1024 * 1024);
    expect(new TextEncoder().encode(envelope.ciphertext).length).toBeGreaterThan(KV_MAX_VALUE_BYTES);
  }, 30_000);

  it('f7_large_archive_never_truncated_for_kv', async () => {
    const original = await largeSnapshot();
    const envelope = await encryptSnapshot(original, 'senha');
    let fetched = false;
    const kv = createKvBackupPort('https://worker.example', async () => 'token', {
      fetch: async () => {
        fetched = true;
        return new Response('{}', { status: 200 });
      },
    });
    await expect(kv.put({ uid, id: 'large', encrypted: envelope })).resolves.toBe('QUOTA');
    expect(fetched).toBe(false);
    expect((original.payload.editais?.[0] as { blob: string }).blob).toHaveLength(26 * 1024 * 1024);
  }, 30_000);

  it('f7_backup_readback_equals_original_manifest', async () => {
    const original = await largeSnapshot();
    const envelope = await encryptSnapshot(original, 'senha');
    const decrypted = await decryptBackup(envelope, 'senha');
    expect(decrypted.manifest.checksum).toBe(original.manifest.checksum);
    expect(decrypted.manifest.recordCount).toBe(original.manifest.recordCount);
  }, 30_000);

  it('f7_corrupt_encrypted_backup_never_changes_active_database', async () => {
    await seed();
    const original = await largeSnapshot();
    const envelope = await encryptSnapshot(original, 'senha');
    const bytes = Uint8Array.from(atob(envelope.ciphertext.slice(0, 256)), (char) => char.charCodeAt(0));
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    const corrupt: EncryptedBackup = {
      ...envelope,
      ciphertext: btoa(String.fromCharCode(...bytes)),
    };
    await expect(decryptBackup(corrupt, 'senha')).rejects.toBeDefined();
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readonly');
    const stored = (await requestResult(tx.objectStore(STORES.editais).get([profileId, 'edital-1']))) as
      | { title?: string }
      | undefined;
    expect(stored?.title).toBe('TJPB');
  }, 30_000);

  it('f7_repeated_export_without_changes_is_stable', async () => {
    await seed();
    const first = await collectF7Backup(profileId);
    const second = await collectF7Backup(profileId);
    expect(second.manifest.checksum).toBe(first.manifest.checksum);
    expect(second.manifest.recordCount).toBe(first.manifest.recordCount);
    await expect(inspectF7Backup(second)).resolves.toMatchObject({ kind: 'VALID' });
  });

  it('f7_failed_retention_does_not_drop_last_valid_version', async () => {
    let now = 0;
    let index = 0;
    const remote = {
      async put() {
        return 'VERIFIED' as const;
      },
      async get() {
        return null;
      },
      async list() {
        return [];
      },
      async deleteVerifiedOldVersion() {
        return false;
      },
    };
    const scheduler = new PersonalBackupScheduler({
      remote,
      now: () => now,
      getRecoverySecret: async () => 'secret',
      getUid: async () => uid,
      collect: async () => ({
        manifest: {
          formatVersion: 3,
          profileId,
          recordCount: 1,
          checksum: String(index++).padStart(64, 'a'),
          epoch: 1,
          deletionHistoryComplete: true,
        },
        payload: { editais: [{ id: 'edital-1' }] },
      }),
      encrypt: async () => ({
        format: 'eo-v2-encrypted-v1',
        alg: 'AES-256-GCM',
        iv: 'iv',
        ciphertext: 'ciphertext',
        wrappedKey: 'wrapped',
        kdf: { name: 'PBKDF2', salt: 'salt', iterations: 210_000, hash: 'SHA-256' },
      }),
    });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      now += 24 * 60 * 60_000 + 1;
      await expect(scheduler.request(profileId, 'MANUAL')).resolves.toBe('VERIFIED');
    }
    expect(scheduler.state(profileId).versions).toHaveLength(8);
  });
});
