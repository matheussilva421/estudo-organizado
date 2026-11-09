import type { GoogleAuthPort, GoogleIdentity } from '../application/google-auth-types';
import type { SyncHealth } from '../application/sync-types';
import { assessSyncHealth } from '../application/sync-policy';
import { GoogleLinkService, type LinkReview } from '../application/google-link-service';
import type { BackupHealth } from '../presentation/components/BackupControls';
import { resolveV2RemoteConfig, V2_APP_NAME, type V2RemoteConfig } from './firebase/config';
import { createFirebaseGoogleAuthPort } from './firebase/auth';
import { LocalProfileRepository } from './local-profile-repository';
import {
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from './indexeddb';
import { collectF7Backup } from './backup/collect';
import { encryptSnapshot } from './backup/crypto';
import { createKvBackupPort } from './backup/kv-client';
import { PersonalBackupScheduler, type BackupSchedulerState } from './backup/scheduler';
import {
  commitF7Restore,
  prepareF7Restore,
  type RestorePreviewF7,
} from './backup/restore-commit';
import type { F7BackupSnapshot } from './backup/f7-format';
import { pullRemoteChanges, type PullResult } from './sync/change-feed';
import { createFirestorePort, FirebaseRemotePort } from './sync/firebase-remote';
import { SyncCoordinator } from './sync/sync-coordinator';
import { AdaptiveSyncScheduler } from './sync/scheduler';
import type { SyncUsage, SyncUsageLimits } from './sync/budget';

const REMOTE_LIBRARY = 'library-main';
const RECOVERY_SECRET_KEY = 'estudo-organizado:v2:recovery-secret';
const SYNC_LIMITS: SyncUsageLimits = {
  reads: 50_000,
  writes: 20_000,
  deletes: 20_000,
  bytesOut: 10 * 1024 * 1024 * 1024,
  periodMs: 24 * 60 * 60_000,
};

export type F7GoogleStatus = 'LOCAL_ONLY' | 'LINKING' | 'READY' | 'PAUSED_AUTH';

export type F7RuntimeState = {
  ready: boolean;
  health: SyncHealth;
  backupHealth: BackupHealth;
  googleStatus: F7GoogleStatus;
  email: string | null;
  cloudAvailable: boolean;
  syncAvailable: boolean;
  backupAvailable: boolean;
  recoverySecretConfigured: boolean;
  lastError: string | null;
};

export type F7RuntimeOptions = {
  auth?: GoogleAuthPort;
  now?: () => number;
};

function localBackupHealth(): BackupHealth {
  return { status: 'NONE', lastVerifiedAt: null, versions: 0 };
}

function initialHealth(): SyncHealth {
  return {
    localCommitted: false,
    remoteCommitted: false,
    converged: false,
    pendingCount: 0,
    mode: 'LOCAL_ONLY',
  };
}

function initialState(): F7RuntimeState {
  return {
    ready: false,
    health: initialHealth(),
    backupHealth: localBackupHealth(),
    googleStatus: 'LOCAL_ONLY',
    email: null,
    cloudAvailable: false,
    syncAvailable: false,
    backupAvailable: false,
    recoverySecretConfigured: false,
    lastError: null,
  };
}

/**
 * Minimal composition root for F7 cloud capabilities. Local mode never imports
 * Firebase; a configured runtime builds Auth, Firestore, sync, pull and backup.
 */
export class F7Runtime {
  private readonly profileId: string;
  private readonly env: Record<string, string | undefined>;
  private readonly profiles = new LocalProfileRepository();
  private readonly authFactory: () => GoogleAuthPort;
  private readonly now: () => number;
  private readonly listeners = new Set<(state: F7RuntimeState) => void>();
  private state: F7RuntimeState = initialState();
  private config: V2RemoteConfig | null = null;
  private auth: GoogleAuthPort | null = null;
  private linkService: GoogleLinkService | null = null;
  private linkReview: LinkReview | null = null;
  private identity: GoogleIdentity | null = null;
  private remote: FirebaseRemotePort | null = null;
  private coordinator: SyncCoordinator | null = null;
  private syncScheduler: AdaptiveSyncScheduler | null = null;
  private backupScheduler: PersonalBackupScheduler | null = null;
  private recoverySecret: string | null = null;
  private unsubAuth: (() => void) | null = null;
  private lastHealth: SyncHealth | null = null;
  private disposed = false;

  constructor(
    profileId: string,
    env: Record<string, string | undefined>,
    options: F7RuntimeOptions = {},
  ) {
    this.profileId = profileId;
    this.env = env;
    this.now = options.now ?? (() => Date.now());
    this.authFactory = options.auth ? () => options.auth! : () => createFirebaseGoogleAuthPort(this.config);
    try {
      this.recoverySecret = globalThis.sessionStorage?.getItem(RECOVERY_SECRET_KEY) ?? null;
    } catch {
      this.recoverySecret = null;
    }
  }

  getState(): F7RuntimeState {
    return this.state;
  }

  subscribe(listener: (state: F7RuntimeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    this.config = resolveV2RemoteConfig(this.env);
    this.auth = this.authFactory();
    this.linkService = new GoogleLinkService({ profiles: this.profiles, now: this.now });
    this.unsubAuth = this.auth.subscribe((identity) => {
      this.identity = identity;
      void this.refresh();
    });
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.disposed) return;
    try {
      const profile = await this.profiles.getProfile(this.profileId);
      const pending = (await getPendingOutbox(this.profileId)).length;
      if (this.config && profile.uid && profile.remoteLibraryId) {
        await this.ensureRemote(profile.uid, profile.remoteLibraryId);
      }
      const health = assessSyncHealth({
        localCommitted: true,
        remoteCommitted: this.lastHealth?.remoteCommitted ?? false,
        verifiedCursor: this.lastHealth?.lastVerifiedCursor ?? null,
        pendingCount: pending,
        mode: this.lastHealth?.mode ?? profile.state,
      });
      const backup = this.backupScheduler?.state(this.profileId) ?? null;
      const backupHealth: BackupHealth = backup
        ? {
            status: backup.lastVerifiedAt ? 'VERIFIED' : 'NONE',
            lastVerifiedAt: backup.lastVerifiedAt
              ? new Date(backup.lastVerifiedAt).toISOString()
              : null,
            versions: backup.versions.length,
          }
        : localBackupHealth();
      const googleStatus: F7GoogleStatus = this.linkReview
        ? 'LINKING'
        : profile.state === 'PAUSED_AUTH'
          ? 'PAUSED_AUTH'
          : profile.uid && profile.syncEnabled
            ? 'READY'
            : 'LOCAL_ONLY';
      this.state = {
        ready: true,
        health: { ...health, pendingCount: pending },
        backupHealth,
        googleStatus,
        email: this.identity?.email ?? null,
        cloudAvailable: this.config !== null,
        syncAvailable: this.coordinator !== null,
        backupAvailable: this.backupScheduler !== null,
        recoverySecretConfigured: this.recoverySecret !== null,
        lastError: null,
      };
      this.emit();
    } catch (error) {
      this.state = {
        ...this.state,
        ready: true,
        lastError: error instanceof Error ? error.message : 'Falha no runtime F7',
      };
      this.emit();
    }
  }

  async syncNow(): Promise<SyncHealth> {
    if (!this.coordinator) return this.state.health;
    this.lastHealth = await this.coordinator.requestFlush(this.profileId, 'MANUAL').catch(() => null);
    await this.refresh();
    return this.state.health;
  }

  notifyLocalCommit(): void {
    this.syncScheduler?.request(this.profileId, 'COMMIT');
    void this.refresh();
  }

  async previewGoogleLink(): Promise<LinkReview> {
    if (!this.auth || !this.linkService || !this.config) {
      throw new Error('A nuvem não está configurada neste ambiente.');
    }
    const identity = await this.auth.signIn();
    this.identity = identity;
    const review = await this.linkService.previewGoogleLink(this.profileId, identity, {
      remoteLibraryId: REMOTE_LIBRARY,
      remoteCount: 0,
      conflictCount: 0,
    });
    this.linkReview = review;
    await this.refresh();
    return review;
  }

  async confirmGoogleLink(): Promise<void> {
    if (!this.linkService || !this.linkReview) {
      throw new Error('Nenhuma prévia de vínculo está pendente.');
    }
    const identity = await this.auth?.current().catch(() => null);
    if (!identity || identity.uid !== this.linkReview.uid) {
      this.linkReview = null;
      throw new Error('A conta Google mudou desde a prévia; refaça o vínculo.');
    }
    await this.linkService.confirmGoogleLink(this.linkReview, true);
    this.linkReview = null;
    this.remote = null;
    this.coordinator = null;
    this.syncScheduler?.dispose();
    this.syncScheduler = null;
    await this.refresh();
  }

  async logout(): Promise<void> {
    if (!this.auth || !this.linkService) return;
    this.coordinator?.stop(this.profileId);
    const profile = await this.profiles.getProfile(this.profileId);
    if (profile.uid) await this.linkService.invalidateRemoteBinding(this.profileId, profile.uid);
    await this.auth.signOut();
    this.identity = null;
    this.remote = null;
    this.coordinator = null;
    this.syncScheduler?.dispose();
    this.syncScheduler = null;
    this.lastHealth = null;
    await this.refresh();
  }

  setRecoverySecret(secret: string): void {
    const normalized = secret.trim();
    this.recoverySecret = normalized || null;
    try {
      if (this.recoverySecret) {
        globalThis.sessionStorage?.setItem(RECOVERY_SECRET_KEY, this.recoverySecret);
      } else {
        globalThis.sessionStorage?.removeItem(RECOVERY_SECRET_KEY);
      }
    } catch {
      // The secret stays in memory when session storage is unavailable.
    }
    this.state = { ...this.state, recoverySecretConfigured: this.recoverySecret !== null };
    this.emit();
  }

  async exportBackup(): Promise<unknown> {
    return collectF7Backup(this.profileId);
  }

  async prepareRestore(
    input: unknown,
  ): Promise<
    { kind: 'PREVIEW'; preview: RestorePreviewF7 } | { kind: 'INVALID'; reason: string }
  > {
    return prepareF7Restore(input as F7BackupSnapshot, this.profileId);
  }

  async commitRestore(previewId: string): Promise<string> {
    const result = await commitF7Restore(previewId, true);
    await this.refresh();
    return result;
  }

  async createBackup(): Promise<string> {
    if (!this.backupScheduler) return 'FAILED';
    if (!this.recoverySecret) return 'FAILED';
    const result = await this.backupScheduler.request(this.profileId, 'MANUAL');
    await this.refresh();
    return result;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubAuth?.();
    this.syncScheduler?.dispose();
    this.backupScheduler?.dispose();
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener(this.state);
  }

  private async ensureRemote(uid: string, remoteLibraryId: string): Promise<void> {
    if (this.remote && this.coordinator) return;
    if (!this.config) return;
    const [appModule, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const appName = `${V2_APP_NAME}:${this.config.projectId}`;
    const existing = appModule.getApps().find((candidate) => candidate.name === appName);
    const app = existing ?? appModule.initializeApp({
          projectId: this.config.projectId,
          authDomain: this.config.authDomain,
          appId: this.config.appId,
          apiKey: this.config.apiKey,
        }, appName);
    const db = firestore.getFirestore(app);
    if (this.config.firestoreEmulator) {
      try {
        firestore.connectFirestoreEmulator(
          db,
          this.config.firestoreEmulator.host,
          this.config.firestoreEmulator.port,
        );
      } catch {
        // HMR can reconnect an already-configured emulator.
      }
    }
    const store = await createFirestorePort(db);
    this.remote = new FirebaseRemotePort({
      uid,
      remoteLibraryId,
      profileId: this.profileId,
      store,
    });
    const pull = async (profileId: string): Promise<PullResult> => {
      let result: PullResult = 'FAILED';
      for (let page = 0; page < 10; page += 1) {
        result = await pullRemoteChanges(profileId, this.remote!, 50);
        if (result !== 'MORE') break;
      }
      return result;
    };
    const budget = await loadSyncBudget(this.profileId);
    this.coordinator = new SyncCoordinator({
      remote: this.remote,
      locks: typeof navigator !== 'undefined' ? navigator.locks ?? null : null,
      pull,
      budget,
      persistBudget: (usage) => saveSyncUsage(this.profileId, usage),
    });
    this.syncScheduler = new AdaptiveSyncScheduler({
      coordinator: this.coordinator,
      isOnline: () => typeof navigator === 'undefined' || navigator.onLine,
      hasAuth: async () => Boolean((await this.profiles.getProfile(this.profileId)).uid),
    });

    const endpoint = (this.env.VITE_V2_BACKUP_ENDPOINT ?? '').trim();
    if (endpoint) {
      const remote = createKvBackupPort(endpoint, () => this.auth?.getIdToken() ?? Promise.resolve(null), {
        expectedUid: uid,
      });
      this.backupScheduler = new PersonalBackupScheduler({
        collect: collectF7Backup,
        encrypt: encryptSnapshot,
        remote,
        getRecoverySecret: async () => this.recoverySecret,
        getUid: async () => (await this.profiles.getProfile(this.profileId)).uid,
        now: this.now,
        loadState: loadBackupState,
        saveState: saveBackupState,
      });
    }
  }
}

async function loadBackupState(profileId: string): Promise<BackupSchedulerState | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const row = (await requestResult(
    transaction.objectStore(STORES.meta).get(`backup-state:${profileId}`),
  )) as { value?: BackupSchedulerState } | undefined;
  return row?.value ?? null;
}

async function saveBackupState(
  profileId: string,
  state: BackupSchedulerState,
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readwrite');
  transaction.objectStore(STORES.meta).put({ key: `backup-state:${profileId}`, value: state });
  await transactionDone(transaction);
}

async function loadSyncBudget(
  profileId: string,
): Promise<{ usage: SyncUsage; limits: SyncUsageLimits }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const row = (await requestResult(
    transaction.objectStore(STORES.meta).get(`sync-usage:${profileId}`),
  )) as { value?: SyncUsage } | undefined;
  const stored = row?.value;
  if (!stored) {
    return {
      usage: { reads: 0, writes: 0, deletes: 0, bytesOut: 0, windowStart: new Date().toISOString() },
      limits: SYNC_LIMITS,
    };
  }
  const started = Date.parse(stored.windowStart);
  if (!Number.isFinite(started) || Date.now() - started >= SYNC_LIMITS.periodMs) {
    return {
      usage: { reads: 0, writes: 0, deletes: 0, bytesOut: 0, windowStart: new Date().toISOString() },
      limits: SYNC_LIMITS,
    };
  }
  return { usage: stored, limits: SYNC_LIMITS };
}

async function saveSyncUsage(profileId: string, usage: SyncUsage): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readwrite');
  transaction.objectStore(STORES.meta).put({ key: `sync-usage:${profileId}`, value: usage });
  await transactionDone(transaction);
}
