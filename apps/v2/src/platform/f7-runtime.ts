import type { GoogleAuthPort, GoogleIdentity } from '../application/google-auth-types';
import type { SyncHealth } from '../application/sync-types';
import { assessSyncHealth } from '../application/sync-policy';
import { GoogleLinkService, type LinkReview } from '../application/google-link-service';
import type { BackupHealth } from '../presentation/components/BackupControls';
import { resolveV2RemoteConfig, V2_APP_NAME, type V2RemoteConfig } from './firebase/config';
import { createFirebaseGoogleAuthPort } from './firebase/auth';
import { LocalProfileRepository } from './local-profile-repository';
import {
  getConflicts,
  getPendingOutbox,
  getRecoveryRequired,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
  type PersistedConflict,
  type RecoveryMarker,
} from './indexeddb';
import { collectF7Backup } from './backup/collect';
import { decryptBackup, encryptSnapshot } from './backup/crypto';
import { createKvBackupPort, type BackupRemotePort } from './backup/kv-client';
import { PersonalBackupScheduler, type BackupSchedulerState } from './backup/scheduler';
import {
  commitF7Restore,
  prepareF7Restore,
  type RestorePreviewF7,
} from './backup/restore-commit';
import type { F7BackupSnapshot } from './backup/f7-format';
import { pullRemoteChanges, type PullResult } from './sync/change-feed';
import {
  createFirestorePort,
  FirebaseRemotePort,
  type RecoverySnapshotResult,
} from './sync/firebase-remote';
import { SyncCoordinator } from './sync/sync-coordinator';
import { AdaptiveSyncScheduler } from './sync/scheduler';
import type { SyncUsage, SyncUsageLimits } from './sync/budget';
import {
  resolveRemoteConflict,
  type ConflictChoice,
} from './sync/conflict-reconciliation';
import {
  commitRebaseline,
  prepareRebaseline,
  readRecoveryBackup,
  recoverySnapshotChecksum,
  saveRecoveryBackup,
  type RebaselineCheckpoint,
  type RebaselinePreview,
} from './sync/rebaseline';

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
  linkReview: LinkReview | null;
  conflicts: PersistedConflict[];
  cloudBackups: Array<{ id: string; createdAt: string; size: number }>;
  cloudAvailable: boolean;
  syncAvailable: boolean;
  backupAvailable: boolean;
  recoverySecretConfigured: boolean;
  recovery: RecoveryMarker | null;
  lastError: string | null;
};

export type F7RuntimeOptions = {
  auth?: GoogleAuthPort;
  now?: () => number;
  /** E2E/test seam; production uses FirebaseRemotePort.captureRecoverySnapshot. */
  recoverySnapshot?: () => Promise<RecoverySnapshotResult>;
};

export type F7RecoveryPreview = {
  previewId: string;
  capturedAt: string;
  counts: RebaselinePreview;
  checkpoint: RebaselineCheckpoint;
  backupChecksum: string;
  backupRecordCount: number;
  backupDeletionHistoryComplete: boolean;
  outboxPending: number;
  openConflicts: number;
  tombstones: number;
};

export type F7RecoveryPrepareResult =
  | { kind: 'PREVIEW'; preview: F7RecoveryPreview }
  | { kind: 'BLOCKED' | 'STALE' | 'INVALID'; reason: string };

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
    linkReview: null,
    conflicts: [],
    cloudBackups: [],
    cloudAvailable: false,
    syncAvailable: false,
    backupAvailable: false,
    recoverySecretConfigured: false,
    recovery: null,
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
  private readonly recoverySnapshotFactory?: () => Promise<RecoverySnapshotResult>;
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
  private backupRemote: BackupRemotePort | null = null;
  private recoverySecret: string | null = null;
  private unsubAuth: (() => void) | null = null;
  private lastHealth: SyncHealth | null = null;
  private previewSeq = 0;
  private readonly recoveryCheckpoints = new Map<string, RebaselineCheckpoint>();
  private disposed = false;

  constructor(
    profileId: string,
    env: Record<string, string | undefined>,
    options: F7RuntimeOptions = {},
  ) {
    this.profileId = profileId;
    this.env = env;
    this.now = options.now ?? (() => Date.now());
    this.recoverySnapshotFactory = options.recoverySnapshot;
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
    this.syncScheduler?.request(this.profileId, 'OPEN');
    if (this.backupScheduler) {
      void this.backupScheduler
        .request(this.profileId, 'OPEN')
        .then(() => this.refresh())
        .catch(() => undefined);
    }
  }

  async refresh(): Promise<void> {
    if (this.disposed) return;
    try {
      const profile = await this.profiles.getProfile(this.profileId);
      const [pendingRows, savedConflicts, recovery] = await Promise.all([
        getPendingOutbox(this.profileId),
        getConflicts(this.profileId).catch(() => [] as PersistedConflict[]),
        getRecoveryRequired(this.profileId).catch(() => null),
      ]);
      const openConflicts = savedConflicts.filter((conflict) => conflict.status === 'OPEN');
      const pending = pendingRows.length + openConflicts.length;
      const identity = await this.currentIdentity();
      this.identity = identity;
      const identityMismatch = Boolean(profile.uid && identity && identity.uid !== profile.uid);
      const identityMissing = Boolean(profile.uid && !identity);
      if (identityMismatch || identityMissing) {
        this.linkReview = null;
        this.remote = null;
        this.coordinator = null;
        this.syncScheduler?.dispose();
        this.syncScheduler = null;
        this.backupScheduler = null;
        this.backupRemote = null;
      }
      if (!identityMismatch && !identityMissing && this.config && profile.uid && profile.remoteLibraryId) {
        await this.ensureRemote(profile.uid, profile.remoteLibraryId);
      }
      const health = assessSyncHealth({
        localCommitted: true,
        remoteCommitted: this.lastHealth?.remoteCommitted ?? false,
        verifiedCursor: this.lastHealth?.lastVerifiedCursor ?? null,
        pendingCount: pending,
        mode:
          identityMismatch || identityMissing
            ? 'PAUSED_AUTH'
            : recovery
              ? 'RECOVERY_REQUIRED'
              : openConflicts.length > 0 && this.lastHealth?.mode !== 'PAUSED_QUOTA'
                ? 'CONFLICT'
                : this.lastHealth?.mode ?? profile.state,
        conflictCount: openConflicts.length,
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
      const googleStatus: F7GoogleStatus = identityMismatch || identityMissing
        ? 'PAUSED_AUTH'
        : this.linkReview
        ? 'LINKING'
        : profile.state === 'PAUSED_AUTH'
          ? 'PAUSED_AUTH'
          : profile.uid && profile.syncEnabled
            ? 'READY'
            : 'LOCAL_ONLY';
      this.state = {
        ready: true,
        health,
        backupHealth,
        googleStatus,
        email: identityMismatch ? null : this.identity?.email ?? null,
        linkReview: this.linkReview,
        conflicts: openConflicts,
        cloudBackups: backup?.versions ?? [],
        cloudAvailable: this.config !== null,
        syncAvailable: this.coordinator !== null && !identityMismatch && !identityMissing,
        backupAvailable: this.backupScheduler !== null && !identityMismatch && !identityMissing,
        recoverySecretConfigured: this.recoverySecret !== null,
        recovery: recovery ?? null,
        lastError: identityMismatch
          ? 'IDENTITY_MISMATCH'
          : identityMissing
            ? 'AUTH_REQUIRED'
            : recovery
              ? 'RECOVERY_REQUIRED'
              : null,
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
    const profile = await this.profiles.getProfile(this.profileId);
    const identity = await this.currentIdentity();
    if (profile.uid && identity?.uid !== profile.uid) {
      return { ...this.state.health, mode: 'PAUSED_AUTH' };
    }
    if (!this.coordinator) return this.state.health;
    this.lastHealth = await this.coordinator.requestFlush(this.profileId, 'MANUAL').catch(() => null);
    await this.refresh();
    return this.state.health;
  }

  notifyLocalCommit(): void {
    this.syncScheduler?.request(this.profileId, 'COMMIT');
    if (this.backupScheduler) {
      void this.backupScheduler
        .request(this.profileId, 'CHANGE')
        .then(() => this.refresh())
        .catch(() => undefined);
    }
    void this.refresh();
  }

  async previewGoogleLink(): Promise<LinkReview> {
    if (!this.auth || !this.linkService || !this.config) {
      throw new Error('A nuvem não está configurada neste ambiente.');
    }
    const profile = await this.profiles.getProfile(this.profileId);
    const generation = this.previewSeq + 1;
    this.previewSeq = generation;
    const identity = await this.auth.signIn();
    if (generation !== this.previewSeq) {
      throw new Error('A prévia de vínculo foi cancelada por outra sessão.');
    }
    if (profile.uid && identity.uid !== profile.uid) {
      this.linkReview = null;
      await this.refresh();
      throw new Error('A conta Google é diferente da conta já vinculada. Saia desta conta antes.');
    }
    this.identity = identity;
    const review = await this.linkService.previewGoogleLink(this.profileId, identity, {
      remoteLibraryId: profile.remoteLibraryId ?? REMOTE_LIBRARY,
      remoteCount: 0,
      conflictCount: 0,
    });
    if (generation !== this.previewSeq) {
      throw new Error('A prévia de vínculo expirou; tente novamente.');
    }
    this.linkReview = review;
    await this.refresh();
    return review;
  }

  async confirmGoogleLink(): Promise<void> {
    if (!this.linkService || !this.linkReview) {
      throw new Error('Nenhuma prévia de vínculo está pendente.');
    }
    const identity = await this.currentIdentity();
    if (!identity || identity.uid !== this.linkReview.uid) {
      this.linkReview = null;
      throw new Error('A conta Google mudou desde a prévia; refaça o vínculo.');
    }
    await this.linkService.confirmGoogleLink(this.linkReview, true);
    this.linkReview = null;
    this.previewSeq += 1;
    this.remote = null;
    this.coordinator = null;
    this.syncScheduler?.dispose();
    this.syncScheduler = null;
    this.backupScheduler?.dispose();
    this.backupScheduler = null;
    this.backupRemote = null;
    await this.refresh();
  }

  async logout(): Promise<void> {
    if (!this.auth || !this.linkService) return;
    this.previewSeq += 1;
    this.linkReview = null;
    this.coordinator?.stop(this.profileId);
    const profile = await this.profiles.getProfile(this.profileId);
    if (profile.uid) await this.linkService.invalidateRemoteBinding(this.profileId, profile.uid);
    await this.auth.signOut();
    this.identity = null;
    this.remote = null;
    this.coordinator = null;
    this.syncScheduler?.dispose();
    this.syncScheduler = null;
    this.backupScheduler?.dispose();
    this.backupScheduler = null;
    this.backupRemote = null;
    this.lastHealth = null;
    await this.refresh();
  }

  async resolveConflict(
    conflictId: string,
    choice: ConflictChoice,
  ): Promise<'LOCAL_COMMITTED' | 'STALE' | 'FAILED'> {
    const conflict = this.state.conflicts.find(
      (candidate) => candidate.conflictId === conflictId && candidate.status === 'OPEN',
    );
    if (!conflict) return 'STALE';
    const result = await resolveRemoteConflict(
      conflictId,
      choice,
      conflict.remoteRevision,
    );
    if (result === 'LOCAL_COMMITTED') {
      this.syncScheduler?.resume(this.profileId);
      this.notifyLocalCommit();
    }
    await this.refresh();
    return result;
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

  async prepareCloudRestore(
    backupId: string,
  ): Promise<
    { kind: 'PREVIEW'; preview: RestorePreviewF7 } | { kind: 'INVALID'; reason: string }
  > {
    if (!this.backupRemote) return { kind: 'INVALID', reason: 'CLOUD_BACKUP_UNAVAILABLE' };
    if (!this.recoverySecret) return { kind: 'INVALID', reason: 'RECOVERY_SECRET_REQUIRED' };
    const [profile, identity] = await Promise.all([
      this.profiles.getProfile(this.profileId),
      this.currentIdentity(),
    ]);
    if (profile.uid && identity?.uid !== profile.uid) {
      return { kind: 'INVALID', reason: 'IDENTITY_MISMATCH' };
    }
    const envelope = await this.backupRemote.get(backupId).catch(() => null);
    if (!envelope) return { kind: 'INVALID', reason: 'BACKUP_NOT_FOUND' };
    const afterFetch = await this.currentIdentity();
    if (profile.uid && afterFetch?.uid !== profile.uid) {
      return { kind: 'INVALID', reason: 'IDENTITY_MISMATCH' };
    }
    let snapshot: F7BackupSnapshot;
    try {
      snapshot = await decryptBackup(envelope, this.recoverySecret);
    } catch (error) {
      return {
        kind: 'INVALID',
        reason: error instanceof Error ? error.message : 'BACKUP_DECRYPT_FAILED',
      };
    }
    const afterDecrypt = await this.currentIdentity();
    if (profile.uid && afterDecrypt?.uid !== profile.uid) {
      return { kind: 'INVALID', reason: 'IDENTITY_MISMATCH' };
    }
    return prepareF7Restore(snapshot, this.profileId);
  }

  async prepareRecovery(): Promise<F7RecoveryPrepareResult> {
    const marker = await getRecoveryRequired(this.profileId).catch(() => null);
    if (!marker) return { kind: 'BLOCKED', reason: 'RECOVERY_NOT_REQUIRED' };
    const [profile, identity] = await Promise.all([
      this.profiles.getProfile(this.profileId),
      this.currentIdentity(),
    ]);
    if (!profile.uid || !profile.remoteLibraryId) {
      return { kind: 'BLOCKED', reason: 'PROFILE_NOT_LINKED' };
    }
    if (!identity || identity.uid !== profile.uid) {
      return { kind: 'BLOCKED', reason: 'IDENTITY_MISMATCH' };
    }

    let captured: RecoverySnapshotResult;
    try {
      captured = this.recoverySnapshotFactory
        ? await this.recoverySnapshotFactory()
        : this.remote
          ? await this.remote.captureRecoverySnapshot(profile.uid, profile.remoteLibraryId)
          : { kind: 'UNSUPPORTED', reason: 'REMOTE_UNAVAILABLE' };
    } catch {
      return { kind: 'BLOCKED', reason: 'SNAPSHOT_READ_FAILED' };
    }
    if (captured.kind !== 'OK') {
      return {
        kind: captured.kind === 'STALE' ? 'STALE' : captured.kind === 'UNSUPPORTED' ? 'BLOCKED' : 'INVALID',
        reason: captured.reason,
      };
    }
    const afterCapture = await this.currentIdentity();
    if (!afterCapture || afterCapture.uid !== profile.uid) {
      return { kind: 'BLOCKED', reason: 'IDENTITY_CHANGED' };
    }

    const backup = await collectF7Backup(this.profileId);
    const baseCheckpoint = {
      uid: profile.uid,
      libraryId: profile.remoteLibraryId,
      epoch: captured.epoch,
      head: captured.head,
      historyFloor: captured.historyFloor,
      historyMode: captured.historyMode,
    } as const;
    const snapshotChecksum = await recoverySnapshotChecksum(
      captured.entities,
      baseCheckpoint,
    );
    const prepared = await prepareRebaseline(this.profileId, captured.entities, {
      checkpoint: { ...baseCheckpoint, snapshotChecksum },
      backupChecksum: backup.manifest.checksum,
      backupRecordCount: backup.manifest.recordCount,
    });
    if (prepared.kind === 'INVALID') return { kind: 'INVALID', reason: prepared.reason };
    try {
      await saveRecoveryBackup(this.profileId, prepared.previewId, backup);
    } catch {
      return { kind: 'BLOCKED', reason: 'BACKUP_WRITE_FAILED' };
    }
    const checkpoint = { ...baseCheckpoint, snapshotChecksum };
    this.recoveryCheckpoints.set(prepared.previewId, checkpoint);
    const [pending, conflicts, tombstones] = await Promise.all([
      getPendingOutbox(this.profileId).catch(() => []),
      getConflicts(this.profileId).catch(() => []),
      countTombstones(this.profileId).catch(() => 0),
    ]);
    return {
      kind: 'PREVIEW',
      preview: {
        previewId: prepared.previewId,
        capturedAt: captured.capturedAt,
        counts: prepared.preview,
        checkpoint,
        backupChecksum: backup.manifest.checksum,
        backupRecordCount: backup.manifest.recordCount,
        backupDeletionHistoryComplete: backup.manifest.deletionHistoryComplete,
        outboxPending: pending.length,
        openConflicts: conflicts.filter((conflict) => conflict.status === 'OPEN').length,
        tombstones,
      },
    };
  }

  async exportRecoveryBackup(previewId: string): Promise<F7BackupSnapshot | null> {
    if (!previewId.trim()) return null;
    return readRecoveryBackup(this.profileId, previewId);
  }

  async commitRecovery(previewId: string): Promise<'RECOVERED' | 'FAILED'> {
    const [profile, identity] = await Promise.all([
      this.profiles.getProfile(this.profileId),
      this.currentIdentity(),
    ]);
    if (
      !profile.uid ||
      !profile.remoteLibraryId ||
      !identity ||
      identity.uid !== profile.uid
    ) {
      return 'FAILED';
    }
    const marker = await getRecoveryRequired(this.profileId).catch(() => null);
    if (!marker) return 'FAILED';
    const checkpoint = this.recoveryCheckpoints.get(previewId);
    if (!checkpoint) return 'FAILED';
    let recheck: RecoverySnapshotResult;
    try {
      recheck = this.recoverySnapshotFactory
        ? await this.recoverySnapshotFactory()
        : this.remote
          ? await this.remote.captureRecoverySnapshot(profile.uid, profile.remoteLibraryId!)
          : { kind: 'UNSUPPORTED', reason: 'REMOTE_UNAVAILABLE' };
    } catch {
      return 'FAILED';
    }
    if (
      recheck.kind !== 'OK' ||
      recheck.epoch !== checkpoint.epoch ||
      recheck.head !== checkpoint.head
    ) {
      return 'FAILED';
    }
    const recheckChecksum = await recoverySnapshotChecksum(recheck.entities, checkpoint);
    if (recheckChecksum !== checkpoint.snapshotChecksum) return 'FAILED';

    this.coordinator?.stop(this.profileId);
    await this.coordinator?.drain(this.profileId);
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
    const run = () => commitRebaseline(this.profileId, previewId);
    const result = locks
      ? await locks.request(
        `estudo-organizado-v2:flush:${this.profileId}`,
        run,
      )
      : await run();
    if (result !== 'LOCAL_COMMITTED') return 'FAILED';

    this.coordinator = null;
    this.remote = null;
    this.lastHealth = null;
    this.syncScheduler?.dispose();
    this.syncScheduler = null;
    this.recoveryCheckpoints.delete(previewId);
    await this.refresh();
    return 'RECOVERED';
  }

  async commitRestore(previewId: string): Promise<string> {
    // Stop new sends before the restore invalidates the outbox; the coordinator
    // also aborts an in-flight flush before ACK and drains it before committing.
    this.coordinator?.stop(this.profileId);
    await this.coordinator?.drain(this.profileId);
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
    const result = locks
      ? await locks.request(
        `estudo-organizado-v2:flush:${this.profileId}`,
        () => commitF7Restore(previewId, true),
      )
      : await commitF7Restore(previewId, true);
    if (result === 'LOCAL_COMMITTED') {
      // The restored snapshot no longer matches the old cursor/outbox. Drop
      // remote authority objects so the persisted recovery gate is consulted
      // before any new flush.
      this.coordinator?.stop(this.profileId);
      this.coordinator = null;
      this.remote = null;
      this.lastHealth = null;
      this.syncScheduler?.dispose();
      this.syncScheduler = null;
      this.backupScheduler = null;
      this.backupRemote = null;
    } else {
      // A failed/stale restore must not leave a permanently stopped coordinator.
      this.coordinator = null;
      this.remote = null;
    }
    await this.refresh();
    if (result === 'LOCAL_COMMITTED' && this.backupScheduler) {
      void this.backupScheduler
        .request(this.profileId, 'CHANGE')
        .then(() => this.refresh())
        .catch(() => undefined);
    }
    return result;
  }

  async createBackup(): Promise<string> {
    const profile = await this.profiles.getProfile(this.profileId);
    const identity = await this.currentIdentity();
    if (profile.uid && identity?.uid !== profile.uid) return 'FAILED';
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

  private async currentIdentity(): Promise<GoogleIdentity | null> {
    if (!this.auth) return null;
    return this.auth.current().catch(() => null);
  }

  private async ensureRemote(uid: string, remoteLibraryId: string): Promise<void> {
    if (this.remote && this.coordinator) return;
    if (!this.config) return;
    const identity = await this.currentIdentity();
    if (!identity || identity.uid !== uid) return;
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
      onHealth: () => {
        void this.refresh();
      },
    });

    const endpoint = (this.env.VITE_V2_BACKUP_ENDPOINT ?? '').trim();
    if (endpoint) {
      const remote = createKvBackupPort(endpoint, () => this.auth?.getIdToken() ?? Promise.resolve(null), {
        expectedUid: uid,
        getCurrentUid: async () => (await this.currentIdentity())?.uid ?? null,
      });
      this.backupRemote = remote;
      this.backupScheduler = new PersonalBackupScheduler({
        collect: collectF7Backup,
        encrypt: encryptSnapshot,
        remote,
        getRecoverySecret: async () => this.recoverySecret,
        getUid: async () => (await this.profiles.getProfile(this.profileId)).uid,
        verifyIdentity: async (profileId, expectedUid) => {
          const [current, bound] = await Promise.all([
            this.currentIdentity(),
            this.profiles.getProfile(profileId),
          ]);
          return current?.uid === expectedUid && bound.uid === expectedUid && bound.syncEnabled;
        },
        now: this.now,
        loadState: (id) => loadBackupState(id, uid, remoteLibraryId),
        saveState: (id, state) => saveBackupState(id, uid, remoteLibraryId, state),
      });
      await this.backupScheduler.hydrate(this.profileId);
    }
  }
}

async function loadBackupState(
  profileId: string,
  uid: string,
  libraryId: string,
): Promise<BackupSchedulerState | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const store = transaction.objectStore(STORES.meta);
  const binding = (await requestResult(
    store.get(`backup-binding:${profileId}`),
  )) as { value?: { uid?: string; libraryId?: string } } | undefined;
  if (binding?.value?.uid !== uid || binding?.value?.libraryId !== libraryId) return null;
  const row = (await requestResult(
    store.get(`backup-state:${profileId}`),
  )) as { value?: BackupSchedulerState } | undefined;
  return row?.value ?? null;
}

async function countTombstones(profileId: string): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.tombstones, 'readonly');
  return requestResult(
    transaction.objectStore(STORES.tombstones).index('by_profile').count(profileId),
  ) as Promise<number>;
}

async function saveBackupState(
  profileId: string,
  uid: string,
  libraryId: string,
  state: BackupSchedulerState,
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readwrite');
  const store = transaction.objectStore(STORES.meta);
  store.put({ key: `backup-binding:${profileId}`, value: { uid, libraryId } });
  store.put({ key: `backup-state:${profileId}`, value: state });
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
