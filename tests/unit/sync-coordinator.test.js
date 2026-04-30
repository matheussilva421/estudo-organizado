import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sync/sync-coordinator.js', () => {
  let storeModule;
  let firestoreSync;
  let firestoreOutbox;
  let entityOutbox;
  let coordinator;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    storeModule = {
      state: {
        config: {
          firestoreSync: { enabled: true, mode: 'primary' },
        },
        eventos: [],
        editais: [],
        disciplinas: [],
      },
    };
    firestoreSync = {
      flushFirestoreOutbox: vi.fn(() => Promise.resolve(true)),
      getFirestoreSyncStatus: vi.fn(() => ({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: null,
      })),
      queueFirestoreSnapshotFromState: vi.fn(() => Promise.resolve(true)),
      syncFirestoreNow: vi.fn(() => Promise.resolve(true)),
    };
    firestoreOutbox = {
      getPendingFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
    };
    entityOutbox = {
      queueFirestoreEntityBatchFromState: vi.fn(() => Promise.resolve(true)),
      getPendingFirestoreEntityBatch: vi.fn(() => Promise.resolve(null)),
      canRetryEntityBatch: vi.fn(() => true),
    };

    vi.doMock('../../src/js/store.js?v=8.31', () => storeModule);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.31', () => firestoreSync);
    vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.31', () => firestoreOutbox);
    vi.doMock('../../src/js/sync/firestore-entity-outbox.js?v=8.31', () => entityOutbox);

    coordinator = await import('../../src/js/sync/sync-coordinator.js?v=8.31');
  });

  describe('getSyncCoordinatorStatus()', () => {
    it('returns status object with primary and firestore info', () => {
      const status = coordinator.getSyncCoordinatorStatus();
      expect(status.primary).toBe('firebase');
      expect(status.autoSyncEnabled).toBe(true);
      expect(status.firestore).toBeDefined();
    });

    it('reports degraded after repeated automatic failures', async () => {
      firestoreSync.flushFirestoreOutbox.mockResolvedValue(false);

      await coordinator.flushPrimarySyncNow({ manual: false, reason: 'auto-1' });
      await coordinator.flushPrimarySyncNow({ manual: false, reason: 'auto-2' });
      await coordinator.flushPrimarySyncNow({ manual: false, reason: 'auto-3' });

      const status = coordinator.getSyncCoordinatorStatus();
      expect(status.health.state).toBe('degraded');
      expect(status.failureCount).toBe(3);
    });

    it('reports autoSyncEnabled as false when not configured', () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: false,
        signedIn: false,
        enabled: false,
        mode: 'off',
        conflict: null,
      });
      const status = coordinator.getSyncCoordinatorStatus();
      expect(status.autoSyncEnabled).toBe(false);
    });
  });

  describe('schedulePrimarySync()', () => {
    it('returns false when firestore is not configured', () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: false,
        signedIn: false,
        enabled: false,
        mode: 'off',
        conflict: null,
      });
      const result = coordinator.schedulePrimarySync('test');
      expect(result).toBe(false);
    });

    it('returns false when conflict exists', () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: { items: [] },
      });
      const result = coordinator.schedulePrimarySync('test');
      expect(result).toBe(false);
    });

    it('schedules sync with debounce delay', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      const result = coordinator.schedulePrimarySync('local-save');
      expect(result).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app:primarySyncQueued' })
      );
    });

    it('uses custom delay when provided', () => {
      const result = coordinator.schedulePrimarySync('retry', { delayMs: 5000 });
      expect(result).toBe(true);
    });
  });

  describe('flushPrimarySyncNow()', () => {
    it('returns false when conflict exists', async () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: { items: [] },
      });
      const result = await coordinator.flushPrimarySyncNow({ manual: true });
      expect(result).toBe(false);
    });

    it('returns false when not configured', async () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: false,
        signedIn: false,
        enabled: false,
        mode: 'off',
        conflict: null,
      });
      const result = await coordinator.flushPrimarySyncNow({ manual: true });
      expect(result).toBe(false);
    });

    it('runs manual sync when manual flag is true', async () => {
      const result = await coordinator.flushPrimarySyncNow({ manual: true });
      expect(firestoreSync.syncFirestoreNow).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('queues snapshot for auto sync', async () => {
      const result = await coordinator.flushPrimarySyncNow({ manual: false });
      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('queues entity batch when entity sync is enabled', async () => {
      storeModule.state.config.entitySync = { enabled: true, mode: 'primary' };
      await coordinator.flushPrimarySyncNow({ manual: false });
      expect(entityOutbox.queueFirestoreEntityBatchFromState).toHaveBeenCalled();
    });

    it('does not advance snapshot sync when primary entity batch cannot be queued', async () => {
      storeModule.state.config.entitySync = { enabled: true, mode: 'primary' };
      entityOutbox.queueFirestoreEntityBatchFromState.mockResolvedValue(false);

      const result = await coordinator.flushPrimarySyncNow({ manual: false });

      expect(result).toBe(false);
      expect(firestoreSync.queueFirestoreSnapshotFromState).not.toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).not.toHaveBeenCalled();
    });

    it('respects entity retry backoff before flushing primary sync', async () => {
      storeModule.state.config.entitySync = { enabled: true, mode: 'primary' };
      entityOutbox.getPendingFirestoreEntityBatch.mockResolvedValue({
        status: 'pending',
        nextAttemptAt: new Date(Date.now() + 60000).toISOString(),
      });
      entityOutbox.canRetryEntityBatch.mockReturnValue(false);

      const result = await coordinator.flushPrimarySyncNow({ manual: false });

      expect(result).toBe(false);
      expect(entityOutbox.queueFirestoreEntityBatchFromState).not.toHaveBeenCalled();
      expect(firestoreSync.queueFirestoreSnapshotFromState).not.toHaveBeenCalled();
    });

    it('uses force overwrite when force flag is true', async () => {
      const result = await coordinator.flushPrimarySyncNow({ manual: true, force: true });
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ forceOverwrite: true })
      );
      expect(result).toBe(true);
    });
  });

  describe('initSyncCoordinator()', () => {
    it('initializes only once', () => {
      coordinator.initSyncCoordinator();
      coordinator.initSyncCoordinator();
    });

    it('listens for stateSaved events', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      coordinator.initSyncCoordinator();
      document.dispatchEvent(new CustomEvent('stateSaved', { detail: { reason: 'test' } }));
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('schedules immediate sync when browser reconnects', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      coordinator.initSyncCoordinator();

      window.dispatchEvent(new Event('online'));

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'app:primarySyncQueued',
          detail: expect.objectContaining({ reason: 'reconnect', delayMs: 0 }),
        })
      );
    });
  });
});
