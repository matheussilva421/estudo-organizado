import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

let syncEngine;
let store;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
  };

  const modules = await import('../../src/js/store.js?v=8.36');
  store = modules;
  store.setState(createBaseState());

  vi.doMock('../../src/js/firebase/firebase-client.js?v=8.36', () => ({
    completeGoogleRedirectSignIn: vi.fn(() => Promise.resolve(null)),
    getFirebaseConfigStatus: vi.fn(() => ({ projectId: null, authDomain: null })),
    initFirebaseServices: vi.fn(() => ({ configured: false, db: null })),
    observeFirebaseAuth: vi.fn(() => {}),
    signInWithGoogle: vi.fn(() => Promise.resolve(null)),
    signOutFirebase: vi.fn(() => Promise.resolve()),
  }));

  vi.doMock('../../src/js/sync/firestore-repository.js?v=8.36', () => ({
    readFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
    watchFirestoreSnapshot: vi.fn(() => {}),
    writeFirestoreSnapshot: vi.fn(() => Promise.resolve(true)),
  }));

  syncEngine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.36');
});

afterEach(() => {
  vi.resetModules();
});

describe('firestore-sync-engine.js', () => {
  describe('getFirestoreSyncStatus', () => {
    it('returns status object with expected fields', () => {
      const status = syncEngine.getFirestoreSyncStatus();
      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('signedIn');
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('enabled');
    });

    it('reports not configured when Firebase not set up', () => {
      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.configured).toBe(false);
    });

    it('reports not signed in initially', () => {
      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.signedIn).toBe(false);
    });
  });

  describe('initFirestoreSync', () => {
    it('does not throw when Firebase not configured', () => {
      expect(() => syncEngine.initFirestoreSync()).not.toThrow();
    });

    it('emits unconfigured status when Firebase not set up', () => {
      syncEngine.initFirestoreSync();
      const calls = global.document.dispatchEvent.mock.calls;
      const statusCall = calls.find((c) => c[0].type === 'app:firestoreSyncStatus');
      expect(statusCall).toBeDefined();
      expect(statusCall[0].detail.status).toBe('unconfigured');
    });
  });

  describe('enableFirestoreSync', () => {
    it('enables sync with shadow mode by default', async () => {
      const result = await syncEngine.enableFirestoreSync();
      expect(result).toBe(true);

      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.enabled).toBe(true);
      expect(status.mode).toBe('shadow');
    });

    it('enables sync with primary mode when specified', async () => {
      const result = await syncEngine.enableFirestoreSync('primary');
      expect(result).toBe(true);

      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.mode).toBe('primary');
    });

    it('emits enabled status event', async () => {
      await syncEngine.enableFirestoreSync();
      const calls = global.document.dispatchEvent.mock.calls;
      const statusCall = calls.find((c) => c[0].type === 'app:firestoreSyncStatus');
      expect(statusCall).toBeDefined();
      expect(statusCall[0].detail.status).toBe('enabled');
    });

    it('does not emit duplicate unchanged status events', async () => {
      await syncEngine.enableFirestoreSync('shadow');
      await syncEngine.enableFirestoreSync('shadow');

      const statusCalls = global.document.dispatchEvent.mock.calls.filter(
        (c) => c[0].type === 'app:firestoreSyncStatus'
      );
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0][0].detail).toEqual(
        expect.objectContaining({
          status: 'enabled',
          mode: 'shadow',
          enabled: true,
        })
      );
    });
  });

  describe('disableFirestoreSync', () => {
    it('disables sync', async () => {
      await syncEngine.enableFirestoreSync();
      await syncEngine.disableFirestoreSync();

      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.enabled).toBe(false);
    });

    it('clears hasPendingWrites', async () => {
      await syncEngine.enableFirestoreSync();
      store.state.config.firestoreSync.hasPendingWrites = true;
      await syncEngine.disableFirestoreSync();

      expect(store.state.config.firestoreSync.hasPendingWrites).toBe(false);
    });
  });

  describe('queueFirestoreSnapshotFromState', () => {
    it('returns false when sync not enabled', async () => {
      const result = await syncEngine.queueFirestoreSnapshotFromState(store.state);
      expect(result).toBe(false);
    });

    it('returns false when auto-sync not allowed', async () => {
      await syncEngine.enableFirestoreSync('shadow');
      const result = await syncEngine.queueFirestoreSnapshotFromState(store.state, { manual: false });
      expect(result).toBe(false);
    });
  });

  describe('flushFirestoreOutbox', () => {
    it('returns false when sync not enabled', async () => {
      const result = await syncEngine.flushFirestoreOutbox();
      expect(result).toBe(false);
    });

    it('returns true when no pending snapshot', async () => {
      await syncEngine.enableFirestoreSync();
      const result = await syncEngine.flushFirestoreOutbox({ manual: true });
      expect(result).toBe(true);
    });

    it('serializes concurrent flushes via SyncLock', async () => {
      await syncEngine.enableFirestoreSync();
      const p1 = syncEngine.flushFirestoreOutbox({ manual: true });
      const p2 = syncEngine.flushFirestoreOutbox({ manual: true });
      const results = await Promise.all([p1, p2]);
      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe('firestoreSignOut', () => {
    it('clears current user', async () => {
      await syncEngine.firestoreSignOut();
      const status = syncEngine.getFirestoreSyncStatus();
      expect(status.signedIn).toBe(false);
    });
  });

  describe('autoPullRemoteWhenNewer', () => {
    it('returns false when sync not enabled', async () => {
      const result = await syncEngine.autoPullRemoteWhenNewer();
      expect(result).toBe(false);
    });

    it('returns false when mode is not primary', async () => {
      await syncEngine.enableFirestoreSync('shadow');
      const result = await syncEngine.autoPullRemoteWhenNewer();
      expect(result).toBe(false);
    });

    it('returns false when there is pending snapshot', async () => {
      await syncEngine.enableFirestoreSync('primary');
      store.state.config.firestoreSync.hasPendingWrites = true;

      vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.36', () => ({
        getPendingFirestoreSnapshot: vi.fn(() =>
          Promise.resolve({ status: 'pending', envelope: {} })
        ),
      }));

      const result = await syncEngine.autoPullRemoteWhenNewer();
      expect(result).toBe(false);
    });

    it('returns false when remote is not newer', async () => {
      await syncEngine.enableFirestoreSync('primary');
      store.state.config.localBackupAt = new Date().toISOString();

      const result = await syncEngine.autoPullRemoteWhenNewer();
      expect(result).toBe(false);
    });
  });
});
