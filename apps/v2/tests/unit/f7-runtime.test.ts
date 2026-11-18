import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileRecord } from '../../src/application/profile-service';
import type { GoogleAuthPort, GoogleIdentity } from '../../src/application/google-auth-types';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { F7Runtime, resolveIsolatedBackupEndpoint } from '../../src/platform/f7-runtime';
import { GOOGLE_AUTH_ERROR_KEY } from '../../src/platform/firebase/auth';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import { collectF7Backup } from '../../src/platform/backup/collect';
import { encryptSnapshot } from '../../src/platform/backup/crypto';

const profileId = 'profile-runtime';
const identityA: GoogleIdentity = { uid: 'uid-a', email: 'a@example.com' };
const identityB: GoogleIdentity = { uid: 'uid-b', email: 'b@example.com' };
const emulatorEnv = {
  VITE_V2_REMOTE_ENABLED: 'true',
  VITE_V2_FIREBASE_PROJECT_ID: 'demo-estudo-v2',
  VITE_V2_FIREBASE_AUTH_DOMAIN: 'demo-estudo-v2.firebaseapp.com',
  VITE_V2_FIREBASE_APP_ID: '1:demo:web:demo',
  VITE_V2_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_V2_FIRESTORE_EMULATOR_PORT: '8080',
  VITE_V2_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
};

describe('F7 runtime isolation', () => {
  it('rejects V1 and non-HTTPS backup endpoints', () => {
    expect(resolveIsolatedBackupEndpoint('https://eo-v2-f7-backup.test.workers.dev')).toBe(
      'https://eo-v2-f7-backup.test.workers.dev',
    );
    expect(
      resolveIsolatedBackupEndpoint('https://estudo-organizado.matheussilva421.workers.dev'),
    ).toBe('');
    expect(
      resolveIsolatedBackupEndpoint('https://worker.example/app-de-estudos-14564'),
    ).toBe('');
    expect(resolveIsolatedBackupEndpoint('http://worker.example')).toBe('');
  });
});

function fakeAuth(initial: GoogleIdentity | null, next = initial): GoogleAuthPort {
  let current = initial;
  return {
    async signIn() {
      if (!next) throw new Error('sem conta');
      current = next;
      return next;
    },
    async signOut() {
      current = null;
    },
    async current() {
      return current;
    },
    async getIdToken() {
      return current ? 'token' : null;
    },
    subscribe() {
      return () => undefined;
    },
  };
}

async function seedProfile(record: Partial<ProfileRecord> = {}): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.profiles, 'readwrite');
  tx.objectStore(STORES.profiles).put({
    profileId,
    uid: identityA.uid,
    remoteLibraryId: 'library-a',
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
    ...record,
  });
  await transactionDone(tx);
}

async function seedRecoveryMarker(): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.meta, 'readwrite');
  tx.objectStore(STORES.meta).put({
    key: `recovery-required:${profileId}`,
    value: { reason: 'RESTORE_COMMITTED', at: new Date().toISOString() },
  });
  await transactionDone(tx);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 runtime composition', () => {
  it('f7_runtime_defaults_to_local_only_without_config', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    expect(runtime.getState()).toMatchObject({
      ready: true,
      cloudAvailable: false,
      syncAvailable: false,
      googleStatus: 'LOCAL_ONLY',
      lastError: null,
    });
    await expect(runtime.previewGoogleLink()).rejects.toThrow('nuvem não está configurada');
    runtime.dispose();
  });

  it('f7_runtime_exports_a_local_snapshot_without_cloud', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    const snapshot = (await runtime.exportBackup()) as {
      manifest: { formatVersion: number };
      payload: Record<string, unknown[]>;
    };
    expect(snapshot.manifest.formatVersion).toBe(3);
    expect(typeof snapshot.payload).toBe('object');
    runtime.dispose();
  });

  it('f7_runtime_requires_a_secret_and_a_cloud_destination_for_backup', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    await expect(runtime.createBackup()).resolves.toBe('FAILED');
    runtime.setRecoverySecret('uma-chave-de-recuperacao-longa');
    expect(runtime.getState().recoverySecretConfigured).toBe(true);
    await expect(runtime.createBackup()).resolves.toBe('FAILED');
    runtime.dispose();
  });

  it('f7_runtime_pauses_when_the_google_account_differs_from_the_bound_profile', async () => {
    await seedProfile();
    const runtime = new F7Runtime(profileId, emulatorEnv, { auth: fakeAuth(identityB) });
    await runtime.init();
    expect(runtime.getState()).toMatchObject({
      googleStatus: 'PAUSED_AUTH',
      syncAvailable: false,
      backupAvailable: false,
      email: null,
      lastError: 'IDENTITY_MISMATCH',
    });
    await expect(runtime.syncNow()).resolves.toMatchObject({ mode: 'PAUSED_AUTH' });
    await expect(runtime.createBackup()).resolves.toBe('FAILED');
    await expect(runtime.previewGoogleLink()).rejects.toThrow('diferente da conta já vinculada');
    runtime.dispose();
  });

  it('f7_runtime_requires_auth_when_the_bound_profile_has_no_session', async () => {
    await seedProfile();
    const runtime = new F7Runtime(profileId, emulatorEnv, { auth: fakeAuth(null) });
    await runtime.init();
    expect(runtime.getState()).toMatchObject({
      googleStatus: 'PAUSED_AUTH',
      lastError: 'AUTH_REQUIRED',
    });
    await expect(runtime.syncNow()).resolves.toMatchObject({ mode: 'PAUSED_AUTH' });
    runtime.dispose();
  });

  it('f7_runtime_allows_relinking_the_same_bound_account', async () => {
    await seedProfile();
    const runtime = new F7Runtime(profileId, emulatorEnv, {
      auth: fakeAuth(identityB, identityA),
    });
    await runtime.init();
    const review = await runtime.previewGoogleLink();
    expect(review).toMatchObject({
      uid: identityA.uid,
      remoteLibraryId: 'library-a',
    });
    expect(runtime.getState().linkReview?.uid).toBe(identityA.uid);
    runtime.dispose();
  });

  it('f7_runtime_surfaces_and_clears_a_sanitized_auth_error', async () => {
    await seedProfile({
      uid: null,
      remoteLibraryId: null,
      syncEnabled: false,
      state: 'LOCAL_ONLY',
    });
    let fail = true;
    const auth: GoogleAuthPort = {
      async signIn() {
        if (fail) {
          sessionStorage.setItem(GOOGLE_AUTH_ERROR_KEY, 'auth/popup-blocked');
          throw new Error('popup blocked');
        }
        sessionStorage.removeItem(GOOGLE_AUTH_ERROR_KEY);
        return identityA;
      },
      async signOut() {},
      async current() {
        return identityA;
      },
      async getIdToken() {
        return 'token';
      },
      subscribe() {
        return () => undefined;
      },
    };
    const runtime = new F7Runtime(profileId, emulatorEnv, { auth });
    await runtime.init();
    expect(runtime.getState().authError).toBeNull();

    await expect(runtime.previewGoogleLink()).rejects.toThrow('popup blocked');
    expect(runtime.getState().authError).toBe('auth/popup-blocked');

    fail = false;
    const review = await runtime.previewGoogleLink();
    expect(review.uid).toBe(identityA.uid);
    expect(runtime.getState().authError).toBeNull();
    runtime.dispose();
  });

  it('f7_runtime_rejects_a_late_uid_callback_after_preview', async () => {
    await seedProfile({
      uid: null,
      remoteLibraryId: null,
      syncEnabled: false,
      state: 'LOCAL_ONLY',
    });
    let current: GoogleIdentity | null = identityA;
    const listeners = new Set<(identity: GoogleIdentity | null) => void>();
    const auth: GoogleAuthPort = {
      async signIn() {
        return identityA;
      },
      async signOut() {
        current = null;
      },
      async current() {
        return current;
      },
      async getIdToken() {
        return 'token';
      },
      subscribe(listener) {
        listeners.add(listener);
        listener(current);
        return () => listeners.delete(listener);
      },
    };
    const runtime = new F7Runtime(profileId, emulatorEnv, { auth });
    await runtime.init();
    const review = await runtime.previewGoogleLink();
    expect(review.uid).toBe(identityA.uid);

    current = identityB;
    for (const listener of listeners) listener(identityB);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(runtime.confirmGoogleLink()).rejects.toThrow('mudou desde a prévia');
    expect((await new LocalProfileRepository().getProfile(profileId)).uid).toBeNull();
    runtime.dispose();
  });

  it('f7_runtime_lists_and_decrypts_a_cloud_backup_for_restore', async () => {
    await seedProfile();
    const secret = 'uma-chave-de-recuperacao-longa';
    const snapshot = await collectF7Backup(profileId);
    const envelope = await encryptSnapshot(snapshot, secret);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/backups')) {
        return new Response(
          JSON.stringify({ items: [{ id: 'v1', createdAt: '2026-11-09T00:00:00.000Z', size: 10 }] }),
          { status: 200 },
        );
      }
      if (url.endsWith('/backups/v1')) {
        return new Response(JSON.stringify(envelope), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    try {
      const runtime = new F7Runtime(
        profileId,
        { ...emulatorEnv, VITE_V2_BACKUP_ENDPOINT: 'https://worker.example' },
        { auth: fakeAuth(identityA) },
      );
      await runtime.init();
      expect(runtime.getState().cloudBackups).toHaveLength(1);
      runtime.setRecoverySecret(secret);
      const prepared = await runtime.prepareCloudRestore('v1');
      expect(prepared.kind).toBe('PREVIEW');
      if (prepared.kind === 'PREVIEW') {
        expect(prepared.preview.profileId).toBe(profileId);
      }
      runtime.dispose();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('f7_runtime_surfaces_a_persisted_recovery_gate', async () => {
    await seedProfile();
    await seedRecoveryMarker();
    const runtime = new F7Runtime(profileId, {}, { auth: fakeAuth(identityA) });
    await runtime.init();
    expect(runtime.getState().health.mode).toBe('RECOVERY_REQUIRED');
    expect(runtime.getState().lastError).toBe('RECOVERY_REQUIRED');
    runtime.dispose();
  });
});
