import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sync-coordinator.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  describe('getSyncCoordinatorStatus()', () => {
    it('returns status with primary source and timer state', async () => {
      vi.doMock('../store.js?v=8.32', () => ({
        state: { config: { firestoreSync: { enabled: false, mode: 'shadow' } } },
      }));
      vi.doMock('./firestore-sync-engine.js?v=8.32', () => ({
        flushFirestoreOutbox: vi.fn(),
        getFirestoreSyncStatus: vi.fn(() => ({
          configured: false,
          signedIn: false,
          enabled: false,
          mode: 'shadow',
          conflict: null,
        })),
        queueFirestoreSnapshotFromState: vi.fn(),
        syncFirestoreNow: vi.fn(),
      }));
      vi.doMock('./firestore-outbox.js?v=8.32', () => ({
        getPendingFirestoreSnapshot: vi.fn(() => null),
      }));
      vi.doMock('./firestore-entity-outbox.js?v=8.32', () => ({
        queueFirestoreEntityBatchFromState: vi.fn(),
      }));

      const coordinator = await import('../../src/js/sync/sync-coordinator.js?v=8.32');
      const status = coordinator.getSyncCoordinatorStatus();

      expect(status.primary).toBe('firebase');
      expect(status.autoSyncEnabled).toBe(false);
      expect(status.timerActive).toBe(false);
    });
  });

  describe('schedulePrimarySync()', () => {
    it('returns false when conflict exists', async () => {
      vi.doMock('../store.js?v=8.32', () => ({
        state: { config: { firestoreSync: { enabled: true, mode: 'primary', conflict: { type: 'diverge' } } } },
      }));
      vi.doMock('./firestore-sync-engine.js?v=8.32', () => ({
        flushFirestoreOutbox: vi.fn(),
        getFirestoreSyncStatus: vi.fn(() => ({
          configured: true,
          signedIn: true,
          enabled: true,
          mode: 'primary',
          conflict: { type: 'diverge' },
        })),
        queueFirestoreSnapshotFromState: vi.fn(),
        syncFirestoreNow: vi.fn(),
      }));
      vi.doMock('./firestore-outbox.js?v=8.32', () => ({
        getPendingFirestoreSnapshot: vi.fn(() => null),
      }));
      vi.doMock('./firestore-entity-outbox.js?v=8.32', () => ({
        queueFirestoreEntityBatchFromState: vi.fn(),
      }));

      const coordinator = await import('../../src/js/sync/sync-coordinator.js?v=8.32');
      const result = coordinator.schedulePrimarySync('test');
      expect(result).toBe(false);
    });

    it('returns false when not configured for primary', async () => {
      vi.doMock('../store.js?v=8.32', () => ({
        state: { config: { firestoreSync: { enabled: false, mode: 'shadow' } } },
      }));
      vi.doMock('./firestore-sync-engine.js?v=8.32', () => ({
        flushFirestoreOutbox: vi.fn(),
        getFirestoreSyncStatus: vi.fn(() => ({
          configured: false,
          signedIn: false,
          enabled: false,
          mode: 'shadow',
          conflict: null,
        })),
        queueFirestoreSnapshotFromState: vi.fn(),
        syncFirestoreNow: vi.fn(),
      }));
      vi.doMock('./firestore-outbox.js?v=8.32', () => ({
        getPendingFirestoreSnapshot: vi.fn(() => null),
      }));
      vi.doMock('./firestore-entity-outbox.js?v=8.32', () => ({
        queueFirestoreEntityBatchFromState: vi.fn(),
      }));

      const coordinator = await import('../../src/js/sync/sync-coordinator.js?v=8.32');
      const result = coordinator.schedulePrimarySync('test');
      expect(result).toBe(false);
    });
  });
});
