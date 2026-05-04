import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sync/sync-coordinator.js', () => {
  let storeModule;
  let firestoreSync;
  let firestoreOutbox;
  let coordinator;

  async function flushCoordinatorPromises() {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
    await vi.advanceTimersByTimeAsync(100);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  }

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
      autoPullRemoteWhenNewer: vi.fn(() => Promise.resolve(false)),
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

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => firestoreSync);
    vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.37', () => firestoreOutbox);
    vi.doMock('../../src/js/sync/sync-health.js?v=8.37', async () => {
      const realHealth = await import('../../src/js/sync/sync-health.js?v=8.37');
      return {
        appendSyncHealthEvent: vi.fn(),
        appendSyncPerformanceMetric: vi.fn(),
        deriveSyncHealthState: vi.fn((input) => realHealth.deriveSyncHealthState(input)),
      };
    });
    vi.doMock('../../src/js/sync/sync-planner.js?v=8.37', async () => {
      const realPlanner = await import('../../src/js/sync/sync-planner.js?v=8.37');
      return {
        planNextSyncAction: vi.fn((input) => realPlanner.planNextSyncAction(input)),
        ACTIONS: realPlanner.ACTIONS,
      };
    });
    vi.doMock('../../src/js/sync/sync-yield.js?v=8.37', () => ({
      yieldToUI: vi.fn(() => Promise.resolve()),
    }));

    coordinator = await import('../../src/js/sync/sync-coordinator.js?v=8.37');
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

    it('returns false when entity conflict exists', () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: { type: 'entity-conflict', items: [] },
      });
      const result = coordinator.schedulePrimarySync('test');
      expect(result).toBe(false);
    });

    it('queues snapshot conflict repair after a local save', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: {
          detectedAt: '2026-05-03T17:19:21.463Z',
          remoteUpdatedAt: '2026-05-03T17:18:21.848Z',
        },
      });

      const result = coordinator.schedulePrimarySync('local-save');

      expect(result).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app:primarySyncQueued' })
      );
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
    it('returns false when a real conflict still has a pending snapshot', async () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: { items: [] },
      });
      firestoreOutbox.getPendingFirestoreSnapshot.mockResolvedValue({
        status: 'conflict',
        envelope: {},
      });
      const result = await coordinator.flushPrimarySyncNow({ manual: true });
      expect(result).toBe(false);
    });

    it('repairs stale conflict status when no pending snapshot exists', async () => {
      firestoreSync.getFirestoreSyncStatus
        .mockReturnValueOnce({
          configured: true,
          signedIn: true,
          enabled: true,
          mode: 'primary',
          conflict: { detectedAt: '2026-05-03T16:23:45.100Z' },
        })
        .mockReturnValue({
          configured: true,
          signedIn: true,
          enabled: true,
          mode: 'primary',
          conflict: null,
        });
      firestoreOutbox.getPendingFirestoreSnapshot.mockResolvedValue(null);

      const result = await coordinator.flushPrimarySyncNow({
        manual: false,
        reason: 'foreground',
      });

      expect(result).toBe(true);
      expect(firestoreSync.syncFirestoreNow).toHaveBeenCalled();
      expect(firestoreSync.queueFirestoreSnapshotFromState).not.toHaveBeenCalled();
    });

    it('force pushes the latest local save when a snapshot conflict still has pending data', async () => {
      firestoreSync.getFirestoreSyncStatus.mockReturnValue({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: {
          detectedAt: '2026-05-03T17:19:21.463Z',
          remoteUpdatedAt: '2026-05-03T17:18:21.848Z',
        },
      });
      firestoreOutbox.getPendingFirestoreSnapshot.mockResolvedValue({
        status: 'conflict',
        envelope: {},
      });

      const result = await coordinator.flushPrimarySyncNow({
        manual: false,
        reason: 'local-save',
      });

      expect(result).toBe(true);
      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalledWith(
        storeModule.state,
        expect.objectContaining({ manual: true })
      );
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ forceOverwrite: true })
      );
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

    it('emits a terminal synced status after successful automatic push', async () => {
      const statuses = [];
      document.addEventListener('app:primarySyncStatus', (event) => {
        statuses.push(event.detail.status);
      });

      const result = await coordinator.flushPrimarySyncNow({
        manual: false,
        reason: 'local-save',
      });

      expect(result).toBe(true);
      expect(statuses).toEqual(['syncing', 'synced']);
    });

    it('emits a terminal error status after failed automatic push without retry', async () => {
      firestoreSync.flushFirestoreOutbox.mockResolvedValue(false);
      const statuses = [];
      document.addEventListener('app:primarySyncStatus', (event) => {
        statuses.push(event.detail.status);
      });

      const result = await coordinator.flushPrimarySyncNow({
        manual: false,
        reason: 'local-save',
      });

      expect(result).toBe(false);
      expect(statuses.at(-1)).toBe('error');
    });

    it('uses force overwrite when force flag is true', async () => {
      const result = await coordinator.flushPrimarySyncNow({ manual: true, force: true });
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ forceOverwrite: true })
      );
      expect(result).toBe(true);
    });

    it('auto-pulls remote when newer and no local pending', async () => {
      firestoreSync.autoPullRemoteWhenNewer.mockResolvedValue(true);

      const result = await coordinator.flushPrimarySyncNow({ manual: false });

      expect(firestoreSync.autoPullRemoteWhenNewer).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(firestoreSync.queueFirestoreSnapshotFromState).not.toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).not.toHaveBeenCalled();
    });

    it('skips auto-pull and pushes when local has pending data', async () => {
      firestoreSync.autoPullRemoteWhenNewer.mockResolvedValue(false);

      const result = await coordinator.flushPrimarySyncNow({ manual: false });

      expect(firestoreSync.autoPullRemoteWhenNewer).toHaveBeenCalled();
      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('does not pre-read remote data on local save auto sync', async () => {
      const result = await coordinator.flushPrimarySyncNow({
        manual: false,
        reason: 'local-save',
      });

      expect(firestoreSync.autoPullRemoteWhenNewer).not.toHaveBeenCalled();
      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ forceOverwrite: true })
      );
      expect(result).toBe(true);
    });

    it('resets failure count on successful auto-pull', async () => {
      firestoreSync.flushFirestoreOutbox.mockResolvedValue(false);
      await coordinator.flushPrimarySyncNow({ manual: false, reason: 'fail-1' });
      await coordinator.flushPrimarySyncNow({ manual: false, reason: 'fail-2' });
      expect(coordinator.getSyncCoordinatorStatus().failureCount).toBe(2);

      firestoreSync.flushFirestoreOutbox.mockResolvedValue(true);
      firestoreSync.autoPullRemoteWhenNewer.mockResolvedValue(true);
      const result = await coordinator.flushPrimarySyncNow({ manual: false });

      expect(result).toBe(true);
      const status = coordinator.getSyncCoordinatorStatus();
      expect(status.failureCount).toBe(0);
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

    it('ignores metadata-only stateSaved events from sync persistence', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      coordinator.initSyncCoordinator();

      document.dispatchEvent(
        new CustomEvent('stateSaved', {
          detail: {
            touchLocalBackup: false,
            metadataOnly: true,
          },
        })
      );

      expect(dispatchSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app:primarySyncQueued' })
      );
    });

    it('flushes sync immediately when browser reconnects without active backoff', async () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      coordinator.initSyncCoordinator();

      window.dispatchEvent(new Event('online'));
      await flushCoordinatorPromises();

      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'app:primarySyncQueued',
          detail: expect.objectContaining({ reason: 'reconnect', delayMs: 0 }),
        })
      );
    });

    it('respects snapshot retry backoff when browser reconnects', async () => {
      const nextAttemptAt = new Date(Date.now() + 120000).toISOString();
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      firestoreOutbox.getPendingFirestoreSnapshot.mockResolvedValue({
        status: 'pending',
        nextAttemptAt,
      });
      coordinator.initSyncCoordinator();

      window.dispatchEvent(new Event('online'));
      await flushCoordinatorPromises();

      expect(firestoreSync.flushFirestoreOutbox).not.toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'app:primarySyncQueued',
          detail: expect.objectContaining({ reason: 'reconnect' }),
        })
      );
    });

    it('flushes sync immediately when returning to foreground without backoff', async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      coordinator.initSyncCoordinator();

      document.dispatchEvent(new Event('visibilitychange'));
      await flushCoordinatorPromises();

      expect(firestoreSync.queueFirestoreSnapshotFromState).toHaveBeenCalled();
      expect(firestoreSync.flushFirestoreOutbox).toHaveBeenCalled();
    });
  });
});
