import type { F7BackupSnapshot } from './f7-format';
import type { EncryptedBackup } from './crypto';
import type { BackupRemotePort } from './kv-client';

export type BackupPolicy = {
  minIntervalMs: number;
  maxRemoteVersions: number;
};

export type BackupReason = 'OPEN' | 'CHANGE' | 'MANUAL';
export type BackupResult = 'VERIFIED' | 'SKIPPED' | 'DEFERRED' | 'FAILED';

export type BackupVersion = { id: string; createdAt: string; size: number };

export type BackupSchedulerState = {
  lastVerifiedAt: number | null;
  lastDigest: string | null;
  versions: BackupVersion[];
  paused: boolean;
};

export type PersonalBackupSchedulerOptions = {
  collect: (profileId: string) => Promise<F7BackupSnapshot>;
  encrypt: (snapshot: F7BackupSnapshot, recoverySecret: string) => Promise<EncryptedBackup>;
  remote: BackupRemotePort;
  getRecoverySecret: (profileId: string) => Promise<string | null>;
  getUid: (profileId: string) => Promise<string | null>;
  now?: () => number;
  policy?: Partial<BackupPolicy>;
  loadState?: (profileId: string) => Promise<BackupSchedulerState | null>;
  saveState?: (profileId: string, state: BackupSchedulerState) => Promise<void>;
};

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  minIntervalMs: 24 * 60 * 60_000,
  maxRemoteVersions: 7,
};

/**
 * Personal backup policy: automatic copies require a material change and at
 * most one per 24h; manual copies are always allowed. A failed/quota upload
 * never removes the last verified copy.
 */
export class PersonalBackupScheduler {
  private readonly collect: PersonalBackupSchedulerOptions['collect'];
  private readonly encrypt: PersonalBackupSchedulerOptions['encrypt'];
  private readonly remote: BackupRemotePort;
  private readonly getRecoverySecret: PersonalBackupSchedulerOptions['getRecoverySecret'];
  private readonly getUid: PersonalBackupSchedulerOptions['getUid'];
  private readonly now: () => number;
  private readonly policy: BackupPolicy;
  private readonly loadState: PersonalBackupSchedulerOptions['loadState'];
  private readonly saveState: PersonalBackupSchedulerOptions['saveState'];
  private readonly states = new Map<string, BackupSchedulerState>();
  private disposed = false;

  constructor(options: PersonalBackupSchedulerOptions) {
    this.collect = options.collect;
    this.encrypt = options.encrypt;
    this.remote = options.remote;
    this.getRecoverySecret = options.getRecoverySecret;
    this.getUid = options.getUid;
    this.now = options.now ?? (() => Date.now());
    this.policy = { ...DEFAULT_BACKUP_POLICY, ...options.policy };
    this.loadState = options.loadState;
    this.saveState = options.saveState;
  }

  state(profileId: string): BackupSchedulerState {
    return (
      this.states.get(profileId) ?? {
        lastVerifiedAt: null,
        lastDigest: null,
        versions: [],
        paused: false,
      }
    );
  }

  dispose(): void {
    this.disposed = true;
  }

  async request(profileId: string, reason: BackupReason): Promise<BackupResult> {
    if (this.disposed) return 'FAILED';
    if (!this.states.has(profileId)) {
      const loaded = this.loadState ? await this.loadState(profileId).catch(() => null) : null;
      const initial = loaded ?? {
        lastVerifiedAt: null,
        lastDigest: null,
        versions: [],
        paused: false,
      };
      const remoteVersions = await this.remote.list().catch(() => []);
      const byId = new Map(initial.versions.map((version) => [version.id, version]));
      for (const version of remoteVersions) byId.set(version.id, version);
      initial.versions = [...byId.values()].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      this.states.set(profileId, initial);
    }
    const state = this.state(profileId);
    this.states.set(profileId, state);
    const now = this.now();
    if (reason !== 'MANUAL') {
      if (state.paused) return 'DEFERRED';
      if (state.lastVerifiedAt !== null && now - state.lastVerifiedAt < this.policy.minIntervalMs) {
        return 'SKIPPED';
      }
    }

    const [secret, uid] = await Promise.all([
      this.getRecoverySecret(profileId).catch(() => null),
      this.getUid(profileId).catch(() => null),
    ]);
    if (!secret || !uid) return 'FAILED';

    let snapshot: F7BackupSnapshot;
    try {
      snapshot = await this.collect(profileId);
    } catch {
      return 'FAILED';
    }
    const digest = snapshot.manifest.checksum;
    if (reason !== 'MANUAL' && state.lastDigest === digest) return 'SKIPPED';

    let encrypted: EncryptedBackup;
    try {
      encrypted = await this.encrypt(snapshot, secret);
    } catch {
      return 'FAILED';
    }
    const id = `backup-${digest.slice(0, 16)}-${now}`;
    const result = await this.remote.put({ uid, id, encrypted }).catch(() => 'FAILED' as const);
    if (result === 'QUOTA' || result === 'PENDING') {
      state.paused = true;
      await this.save(profileId, state);
      return 'DEFERRED';
    }
    if (result !== 'VERIFIED') return 'FAILED';

    state.paused = false;
    state.lastVerifiedAt = now;
    state.lastDigest = digest;
    state.versions.push({
      id,
      createdAt: new Date(now).toISOString(),
      size: new TextEncoder().encode(JSON.stringify(encrypted)).length,
    });

    while (state.versions.length > this.policy.maxRemoteVersions) {
      const oldest = state.versions[0];
      if (!oldest) break;
      const deleted = await this.remote.deleteVerifiedOldVersion(oldest.id).catch(() => false);
      if (!deleted) break;
      state.versions.shift();
    }
    await this.save(profileId, state);
    return 'VERIFIED';
  }

  private async save(profileId: string, state: BackupSchedulerState): Promise<void> {
    if (!this.saveState) return;
    await this.saveState(profileId, state).catch(() => undefined);
  }
}
