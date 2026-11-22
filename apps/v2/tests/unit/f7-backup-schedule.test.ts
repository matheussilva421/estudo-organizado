import { beforeEach, describe, expect, it } from 'vitest';
import type { F7BackupSnapshot } from '../../src/platform/backup/f7-format';
import type { EncryptedBackup } from '../../src/platform/backup/crypto';
import type { BackupRemotePort } from '../../src/platform/backup/kv-client';
import { PersonalBackupScheduler } from '../../src/platform/backup/scheduler';

const profileId = 'profile-schedule';
const uid = 'uid-a';
const day = 24 * 60 * 60_000;

function snapshot(checksum: string): F7BackupSnapshot {
  return {
    manifest: {
      formatVersion: 3,
      profileId,
      recordCount: 1,
      checksum,
      epoch: 1,
      deletionHistoryComplete: true,
    },
    payload: { editais: [{ id: 'edital-1' }] },
  };
}

const encrypted: EncryptedBackup = {
  format: 'eo-v2-encrypted-v1',
  alg: 'AES-256-GCM',
  iv: 'iv',
  ciphertext: 'ciphertext',
  wrappedKey: 'wrapped',
  kdf: { name: 'PBKDF2', salt: 'salt', iterations: 210_000, hash: 'SHA-256' },
};

class MemoryRemote implements BackupRemotePort {
  readonly puts: Array<{ uid: string; id: string }> = [];
  readonly deletes: Array<{ id: string; replacementId: string }> = [];
  result: 'VERIFIED' | 'PENDING' | 'QUOTA' | 'FAILED' = 'VERIFIED';
  async put(input: { uid: string; id: string }) {
    this.puts.push({ uid: input.uid, id: input.id });
    return this.result;
  }
  async get() {
    return null;
  }
  async list(): Promise<Array<{ id: string; createdAt: string; size: number }>> {
    return [];
  }
  async deleteVerifiedOldVersion(id: string, replacementId: string) {
    this.deletes.push({ id, replacementId });
    return true;
  }
}

function scheduler(remote: MemoryRemote, checksums: string[], now: () => number) {
  let index = 0;
  return new PersonalBackupScheduler({
    remote,
    now,
    getRecoverySecret: async () => 'secret',
    getUid: async () => uid,
    collect: async () => snapshot(checksums[Math.min(index++, checksums.length - 1)] ?? 'a'.repeat(64)),
    encrypt: async () => encrypted,
  });
}

beforeEach(() => undefined);

describe('F7 backup scheduler', () => {
  it('f7_daily_backup_only_after_material_change', async () => {
    const remote = new MemoryRemote();
    let now = 0;
    const backup = scheduler(remote, ['a'.repeat(64), 'a'.repeat(64)], () => now);
    await expect(backup.request(profileId, 'OPEN')).resolves.toBe('VERIFIED');
    now += day + 1;
    await expect(backup.request(profileId, 'CHANGE')).resolves.toBe('SKIPPED');
  });

  it('f7_minimum_24h_for_automatic_upload', async () => {
    const remote = new MemoryRemote();
    let now = 0;
    const backup = scheduler(remote, ['a'.repeat(64), 'b'.repeat(64)], () => now);
    await expect(backup.request(profileId, 'OPEN')).resolves.toBe('VERIFIED');
    now += 60 * 60_000;
    await expect(backup.request(profileId, 'CHANGE')).resolves.toBe('SKIPPED');
    now += day;
    await expect(backup.request(profileId, 'CHANGE')).resolves.toBe('VERIFIED');
  });

  it('f7_manual_backup_allowed_anytime', async () => {
    const remote = new MemoryRemote();
    const now = 0;
    const backup = scheduler(remote, ['a'.repeat(64), 'b'.repeat(64)], () => now);
    await backup.request(profileId, 'OPEN');
    await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('VERIFIED');
    expect(remote.puts).toHaveLength(2);
  });

  it('f7_app_closed_does_not_claim_execution', () => {
    const remote = new MemoryRemote();
    const backup = scheduler(remote, ['a'.repeat(64)], () => 0);
    expect(backup.state(profileId).versions).toHaveLength(0);
    expect(remote.puts).toHaveLength(0);
  });

  it('f7_keep_at_most_seven_verified_remote_versions', async () => {
    const remote = new MemoryRemote();
    let now = 0;
    const backup = scheduler(remote, Array.from({ length: 9 }, (_, index) => String(index).padStart(64, 'a')), () => now);
    for (let index = 0; index < 9; index += 1) {
      now += day + 1;
      await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('VERIFIED');
    }
    expect(backup.state(profileId).versions).toHaveLength(7);
    expect(remote.deletes).toHaveLength(2);
    expect(remote.deletes.every((entry) => entry.replacementId !== entry.id)).toBe(true);
    const deletedIds = new Set(remote.deletes.map((entry) => entry.id));
    expect(remote.deletes.every((entry) => !deletedIds.has(entry.replacementId))).toBe(true);
  });

  it('f7_new_backup_failure_does_not_delete_last_good_copy', async () => {
    const remote = new MemoryRemote();
    let now = 0;
    const backup = scheduler(remote, ['a'.repeat(64), 'b'.repeat(64)], () => now);
    await backup.request(profileId, 'MANUAL');
    const before = backup.state(profileId).versions.length;
    remote.result = 'FAILED';
    now += day;
    await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('FAILED');
    expect(backup.state(profileId).versions).toHaveLength(before);
    expect(remote.deletes).toHaveLength(0);
  });

  it('f7_kv_quota_pauses_without_paid_fallback', async () => {
    const remote = new MemoryRemote();
    remote.result = 'QUOTA';
    const backup = scheduler(remote, ['a'.repeat(64)], () => 0);
    await expect(backup.request(profileId, 'OPEN')).resolves.toBe('DEFERRED');
    expect(backup.state(profileId).paused).toBe(true);
    await expect(backup.request(profileId, 'CHANGE')).resolves.toBe('DEFERRED');
  });

  it('f7_scheduler_state_survives_reload', async () => {
    const remote = new MemoryRemote();
    let now = 0;
    let stored: ReturnType<PersonalBackupScheduler['state']> | null = null;
    const make = () =>
      new PersonalBackupScheduler({
        remote,
        now: () => now,
        getRecoverySecret: async () => 'secret',
        getUid: async () => uid,
        collect: async () => snapshot('a'.repeat(64)),
        encrypt: async () => encrypted,
        loadState: async () => stored,
        saveState: async (_profile, state) => {
          stored = state;
        },
      });
    const first = make();
    await expect(first.request(profileId, 'OPEN')).resolves.toBe('VERIFIED');
    expect(remote.puts).toHaveLength(1);
    now += 60 * 60_000;
    const reloaded = make();
    await expect(reloaded.request(profileId, 'CHANGE')).resolves.toBe('SKIPPED');
    expect(remote.puts).toHaveLength(1);
  });

  it('f7_scheduler_hydrates_remote_versions_for_multi_device_retention', async () => {
    const remote = new MemoryRemote();
    remote.list = async () =>
      Array.from({ length: 8 }, (_, index) => ({
        id: `old-${index}`,
        createdAt: new Date(index * 1000).toISOString(),
        size: 1,
      }));
    const backup = new PersonalBackupScheduler({
      remote,
      now: () => 10 * day,
      getRecoverySecret: async () => 'secret',
      getUid: async () => uid,
      collect: async () => snapshot('b'.repeat(64)),
      encrypt: async () => encrypted,
    });
    await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('VERIFIED');
    expect(backup.state(profileId).versions).toHaveLength(7);
    expect(remote.deletes.length).toBeGreaterThan(0);
  });

  it('f7_disposed_scheduler_does_not_upload', async () => {
    const remote = new MemoryRemote();
    const backup = new PersonalBackupScheduler({
      remote,
      now: () => 0,
      getRecoverySecret: async () => 'secret',
      getUid: async () => uid,
      collect: async () => {
        backup.dispose();
        return snapshot('a'.repeat(64));
      },
      encrypt: async () => encrypted,
    });
    await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('FAILED');
    expect(remote.puts).toHaveLength(0);
  });

  it('f7_uid_change_before_upload_fails_closed', async () => {
    const remote = new MemoryRemote();
    let calls = 0;
    const backup = new PersonalBackupScheduler({
      remote,
      now: () => 0,
      getRecoverySecret: async () => 'secret',
      getUid: async () => (++calls === 1 ? uid : 'uid-b'),
      collect: async () => snapshot('a'.repeat(64)),
      encrypt: async () => encrypted,
    });
    await expect(backup.request(profileId, 'MANUAL')).resolves.toBe('FAILED');
    expect(remote.puts).toHaveLength(0);
  });
});
