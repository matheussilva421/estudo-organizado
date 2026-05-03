import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

describe('no-feedback-loop (TDD - RED phase)', () => {
  let pollFirestoreRemote;
  let startPolling;
  let stopPolling;
  let schedulePrimarySync;
  let initSyncCoordinator;
  let mockSaveStateToDB;
  let mockReadSnapshot;
  let mockQueueSnapshot;
  let mockFlushOutbox;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    mockSaveStateToDB = vi.fn(() => Promise.resolve());
    mockReadSnapshot = vi.fn(() => Promise.resolve(null));
    mockQueueSnapshot = vi.fn(() => Promise.resolve(true));
    mockFlushOutbox = vi.fn(() => Promise.resolve(true));

    vi.doMock('../../src/js/store.js?v=8.36', () => ({
      state: createBaseState({
        config: {
          firestoreSync: { enabled: true, mode: 'primary' },
          localBackupAt: '2026-01-01T00:00:00.000Z',
        },
      }),
      setState: vi.fn(),
      saveStateToDB: mockSaveStateToDB,
    }));

    vi.doMock('../../src/js/firebase/firebase-client.js?v=8.36', () => ({
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

    vi.doMock('../../src/js/sync/firestore-repository.js?v=8.36', () => ({
      readFirestoreSnapshot: mockReadSnapshot,
      writeFirestoreSnapshot: vi.fn(() => Promise.resolve(true)),
    }));

    vi.doMock('../../src/js/sync/firestore-schema.js?v=8.36', () => ({
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
    }));

    vi.doMock('../../src/js/sync/sync-center.js?v=8.36', () => ({
      canAutoSyncFirestore: vi.fn(() => true),
      isRemoteStateNewer: vi.fn(() => true),
      isEmptyState: vi.fn(() => false),
      mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote })),
      buildSyncCenterModel: vi.fn(() => ({})),
    }));

    vi.doMock('../../src/js/sync/sync-health.js?v=8.36', () => ({
      deriveSyncHealthState: vi.fn(() => ({ state: 'synced', requiresAction: false, metrics: {} })),
      summarizeSyncMetrics: vi.fn(() => ({ successRate: 1, avgDuration: 0 })),
      appendSyncHealthEvent: vi.fn(),
      appendSyncPerformanceMetric: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.36', () => ({
      clearFirestoreConflict: vi.fn(() => Promise.resolve()),
      enqueueFirestoreSnapshot: mockQueueSnapshot,
      getPendingFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
      markFirestoreSnapshotSynced: vi.fn(() => Promise.resolve()),
      saveFirestoreConflict: vi.fn(() => Promise.resolve()),
      saveFirestoreMeta: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/sync/sync-lock.js?v=8.36', () => ({
      firestoreLock: { acquire: vi.fn(() => Promise.resolve(true)), release: vi.fn() },
    }));

    vi.doMock('../../src/js/sync/sync-yield.js?v=8.36', () => ({
      yieldToUIWithBudget: vi.fn(() => Promise.resolve()),
      yieldToUI: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/sync/sync-planner.js?v=8.36', () => ({
      planNextSyncAction: vi.fn(() => ({ action: 'none' })),
      ACTIONS: { NONE: 'none', PULL: 'pull', PUSH: 'push' },
    }));

    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.36', async () => {
      const actual = await vi.importActual('../../src/js/sync/firestore-sync-engine.js?v=8.36');
      return {
        ...actual,
        pollFirestoreRemote: vi.fn(actual.pollFirestoreRemote),
        startPolling: vi.fn(actual.startPolling),
        stopPolling: vi.fn(actual.stopPolling),
        queueFirestoreSnapshotFromState: vi.fn(actual.queueFirestoreSnapshotFromState),
        flushFirestoreOutbox: vi.fn(actual.flushFirestoreOutbox),
        syncFirestoreNow: vi.fn(actual.syncFirestoreNow),
      };
    });

    const engine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.36');
    pollFirestoreRemote = engine.pollFirestoreRemote;
    startPolling = engine.startPolling;
    stopPolling = engine.stopPolling;
    mockQueueSnapshot = engine.queueFirestoreSnapshotFromState;
    mockFlushOutbox = engine.flushFirestoreOutbox;

    // Set test user
    engine.__setCurrentUser({ uid: 'test-uid' });

    const coord = await import('../../src/js/sync/sync-coordinator.js?v=8.36');
    schedulePrimarySync = coord.schedulePrimarySync;
    initSyncCoordinator = coord.initSyncCoordinator;
  });

  afterEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  describe('poll-pull does not trigger push cycle', () => {
    it('after poll-pull applies remote state, saveStateToDB is called with skipFirestoreSync: true', async () => {
      mockReadSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      expect(mockSaveStateToDB).toHaveBeenCalledWith(
        expect.objectContaining({ skipFirestoreSync: true })
      );
    });

    it('after poll-pull, subsequent stateSaved event does NOT trigger a push', async () => {
      mockReadSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      document.dispatchEvent(
        new CustomEvent('stateSaved', {
          detail: { reason: 'poll-pull', skipFirestoreSync: true },
        })
      );

      expect(mockQueueSnapshot).not.toHaveBeenCalled();
    });

    it('after a manual push, polling-pull reads the just-pushed state and does NOT re-push', async () => {
      const { isRemoteStateNewer } = await import('../../src/js/sync/sync-center.js?v=8.36');

      mockReadSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'just_pushed_ev' }] },
      });
      isRemoteStateNewer.mockReturnValue(false);

      await pollFirestoreRemote();

      expect(mockQueueSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('debounce prevents multiple pushes', () => {
    it('stateSaved event with skipFirestoreSync does NOT trigger push', async () => {
      // After poll-pull, saveStateToDB is called with skipFirestoreSync: true
      // The coordinator should check this flag and NOT queue a push
      mockReadSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      // saveStateToDB was called with skipFirestoreSync: true
      const saveCall = mockSaveStateToDB.mock.calls[0]?.[0];
      expect(saveCall?.skipFirestoreSync).toBe(true);
    });
  });

  describe('polling prevents feedback loops', () => {
    it('polling does NOT call queueFirestoreSnapshotFromState', async () => {
      mockReadSnapshot.mockResolvedValue({
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: { eventos: [{ id: 'remote_ev' }] },
      });

      await pollFirestoreRemote();

      // Poll-pull should NOT trigger a push
      expect(mockQueueSnapshot).not.toHaveBeenCalled();
    });

    it('stopPolling prevents further polls', async () => {
      startPolling(30000);
      expect(mockReadSnapshot).toHaveBeenCalledTimes(1); // immediate poll

      stopPolling();

      await vi.advanceTimersByTimeAsync(30000);
      expect(mockReadSnapshot).toHaveBeenCalledTimes(1); // no more polls
    });
  });
});
