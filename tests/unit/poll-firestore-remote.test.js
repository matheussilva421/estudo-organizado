import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('poll-firestore-remote (TDD - RED phase)', () => {
  let pollFirestoreRemote;
  let startPolling;
  let stopPolling;
  let mockReadSnapshot;
  let mockSaveStateToDB;
  let mockSetState;
  let mockIsRemoteStateNewer;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    mockReadSnapshot = vi.fn();
    mockSaveStateToDB = vi.fn(() => Promise.resolve());
    mockSetState = vi.fn();
    mockIsRemoteStateNewer = vi.fn(() => true);

    global.document = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.34', () => ({
      state: {
        config: {
          firestoreSync: { enabled: true, mode: 'primary' },
          localBackupAt: '2026-01-01T00:00:00.000Z',
        },
        eventos: [],
        editais: [],
        disciplinas: [],
      },
      setState: mockSetState,
      saveStateToDB: mockSaveStateToDB,
    }));

    vi.doMock('../../src/js/firebase/firebase-client.js?v=8.34', () => ({
      getFirebaseConfigStatus: vi.fn(() => ({ projectId: 'test-project' })),
      initFirebaseServices: vi.fn(() => ({
        configured: true,
        db: { _isMock: true },
        auth: { currentUser: { uid: 'test-uid' } },
      })),
      observeFirebaseAuth: vi.fn((cb) => { cb({ uid: 'test-uid' }); return () => {}; }),
      signInWithGoogle: vi.fn(),
      signOutFirebase: vi.fn(),
      completeGoogleRedirectSignIn: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/firestore-repository.js?v=8.34', () => ({
      readFirestoreSnapshot: mockReadSnapshot,
      writeFirestoreSnapshot: vi.fn(() => Promise.resolve(true)),
    }));

    vi.doMock('../../src/js/sync/firestore-schema.js?v=8.34', () => ({
      isRemoteNewer: vi.fn(() => true),
      applyEnvelopeToLocalState: vi.fn(() => ({
        config: { localBackupAt: '2026-01-02T00:00:00.000Z' },
        eventos: [{ id: 'remote_ev' }],
      })),
      getEnvelopeUpdatedAt: vi.fn((env) => env?.payloadUpdatedAt),
      getLocalContentUpdatedAt: vi.fn((state) => state?.config?.localBackupAt || null),
      createDefaultFirestoreSyncConfig: vi.fn((overrides) => ({
        enabled: false, mode: 'shadow', uid: null, lastPullAt: null,
        lastPushAt: null, remoteUpdatedAt: null, hasPendingWrites: false,
        conflict: null, lastError: null, ...overrides,
      })),
      createFirestoreSnapshotEnvelope: vi.fn(() => ({})),
      createExportableState: vi.fn((state) => state),
      getFirestoreSyncConfig: vi.fn(() => ({})),
      isRemoteStateNewer: vi.fn(() => true),
    }));

    vi.doMock('../../src/js/sync/sync-center.js?v=8.34', () => ({
      canAutoSyncFirestore: vi.fn(() => true),
      isRemoteStateNewer: mockIsRemoteStateNewer,
      isEmptyState: vi.fn(() => false),
      mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote })),
      buildSyncCenterModel: vi.fn(() => ({})),
    }));

    vi.doMock('../../src/js/sync/sync-health.js?v=8.34', () => ({
      deriveSyncHealthState: vi.fn(() => ({ state: 'synced', requiresAction: false, metrics: {} })),
      summarizeSyncMetrics: vi.fn(() => ({ successRate: 1, avgDuration: 0 })),
    }));

    vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.34', () => ({
      clearFirestoreConflict: vi.fn(() => Promise.resolve()),
      enqueueFirestoreSnapshot: vi.fn(() => Promise.resolve()),
      getPendingFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
      markFirestoreSnapshotSynced: vi.fn(() => Promise.resolve()),
      saveFirestoreConflict: vi.fn(() => Promise.resolve()),
      saveFirestoreMeta: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/sync/sync-lock.js?v=8.34', () => ({
      firestoreLock: { acquire: vi.fn(() => Promise.resolve(true)), release: vi.fn() },
    }));

    vi.doMock('../../src/js/sync/sync-yield.js?v=8.34', () => ({
      yieldToUIWithBudget: vi.fn(() => Promise.resolve()),
    }));

    const module = await import('../../src/js/sync/firestore-sync-engine.js?v=8.34');
    pollFirestoreRemote = module.pollFirestoreRemote;
    startPolling = module.startPolling;
    stopPolling = module.stopPolling;

    // Set test user via test hook
    module.__setCurrentUser({ uid: 'test-uid' });
  });

  afterEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  describe('pollFirestoreRemote()', () => {
    it('applies remote state when remote is newer', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js?v=8.34');
      const { setState } = await import('../../src/js/store.js?v=8.34');

      readFirestoreSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      expect(readFirestoreSnapshot).toHaveBeenCalled();
      expect(applyEnvelopeToLocalState).toHaveBeenCalled();
      expect(setState).toHaveBeenCalled();
    });

    it('does not change state when remote is null', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js?v=8.34');
      const { setState } = await import('../../src/js/store.js?v=8.34');

      readFirestoreSnapshot.mockResolvedValue(null);

      await pollFirestoreRemote();

      expect(applyEnvelopeToLocalState).not.toHaveBeenCalled();
      expect(setState).not.toHaveBeenCalled();
    });

    it('does not change state when remote is older than local', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js?v=8.34');

      readFirestoreSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2025-01-01T00:00:00.000Z',
        payload: { eventos: [{ id: 'old_ev' }] },
      });
      mockIsRemoteStateNewer.mockReturnValue(false);

      await pollFirestoreRemote();

      expect(mockIsRemoteStateNewer).toHaveBeenCalled();
      expect(applyEnvelopeToLocalState).not.toHaveBeenCalled();
    });

    it('does not change state when timestamps are equal', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js?v=8.34');

      readFirestoreSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-01T00:00:00.000Z',
        payload: { eventos: [{ id: 'same_ev' }] },
      });
      mockIsRemoteStateNewer.mockReturnValue(false);

      await pollFirestoreRemote();

      expect(applyEnvelopeToLocalState).not.toHaveBeenCalled();
    });

    it('calls saveStateToDB with skipFirestoreSync after applying remote state', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');
      const { saveStateToDB } = await import('../../src/js/store.js?v=8.34');

      readFirestoreSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      expect(saveStateToDB).toHaveBeenCalledWith(
        expect.objectContaining({ skipFirestoreSync: true })
      );
    });
  });

  describe('startPolling() / stopPolling()', () => {
    it('startPolling starts an interval at 30000ms by default', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');

      startPolling();

      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1); // immediate first poll

      await vi.advanceTimersByTimeAsync(30000);
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(2);
    });

    it('startPolling accepts a custom interval', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');

      startPolling(60000);

      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30000);
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1); // not yet

      await vi.advanceTimersByTimeAsync(30000);
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(2); // now at 60s
    });

    it('stopPolling clears the interval', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');

      startPolling(30000);
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1);

      stopPolling();

      await vi.advanceTimersByTimeAsync(30000);
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1); // no more polls
    });

    it('first poll happens immediately on start (no 30s wait)', async () => {
      const { readFirestoreSnapshot } = await import('../../src/js/sync/firestore-repository.js?v=8.34');

      startPolling(30000);

      // Should have polled immediately, not waited 30s
      expect(readFirestoreSnapshot).toHaveBeenCalledTimes(1);
    });
  });
});
