import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('firestore-sync-engine.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  describe('getFirestoreSyncStatus()', () => {
    it('returns status with configured=false when Firebase not configured', async () => {
      vi.doMock('../firebase/firebase-client.js?v=8.32', () => ({
        completeGoogleRedirectSignIn: vi.fn(),
        getFirebaseConfigStatus: vi.fn(() => ({ projectId: null, authDomain: null })),
        initFirebaseServices: vi.fn(() => ({ configured: false, db: null })),
        observeFirebaseAuth: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOutFirebase: vi.fn(),
      }));
      vi.doMock('../store.js?v=8.32', () => ({
        state: { config: { firestoreSync: { enabled: false, mode: 'shadow' } } },
        setState: vi.fn(),
        saveStateToDB: vi.fn(),
      }));
      vi.doMock('./firestore-schema.js?v=8.32', () => ({
        createDefaultFirestoreSyncConfig: vi.fn((overrides = {}) => ({ enabled: false, mode: 'shadow', ...overrides })),
      }));
      vi.doMock('./firestore-outbox.js?v=8.32', () => ({
        clearFirestoreConflict: vi.fn(),
        enqueueFirestoreSnapshot: vi.fn(),
        getPendingFirestoreSnapshot: vi.fn(),
        markFirestoreSnapshotFailed: vi.fn(),
        markFirestoreSnapshotSynced: vi.fn(),
        saveFirestoreConflict: vi.fn(),
        saveFirestoreMeta: vi.fn(),
      }));
      vi.doMock('./firestore-repository.js?v=8.32', () => ({
        readFirestoreSnapshot: vi.fn(),
        watchFirestoreSnapshot: vi.fn(),
        writeFirestoreSnapshot: vi.fn(),
      }));
      vi.doMock('./sync-center.js?v=8.32', () => ({
        canAutoSyncFirestore: vi.fn(),
        mergeStudyStates: vi.fn(),
      }));
      vi.doMock('./entity-state-builder.js?v=8.32', () => ({
        applyEntityDocsToState: vi.fn(),
        replaceEntityInStateByRecord: vi.fn(),
      }));
      vi.doMock('./firestore-entity-outbox.js?v=8.32', () => ({
        getPendingFirestoreEntityBatch: vi.fn(),
        markFirestoreEntityBatchSynced: vi.fn(),
        queueFirestoreEntityBatchFromState: vi.fn(),
      }));
      vi.doMock('./entity-shadow-verifier.js?v=8.32', () => ({
        compareSnapshotManifestToEntityDocs: vi.fn(),
      }));
      vi.doMock('./entity-metadata.js?v=8.32', () => ({
        visitTrackedEntities: vi.fn(() => []),
      }));

      const engine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.32');
      const status = engine.getFirestoreSyncStatus();
      expect(status.configured).toBe(false);
      expect(status.signedIn).toBe(false);
    });
  });

  describe('queueFirestoreSnapshotFromState()', () => {
    it('returns false when sync not enabled', async () => {
      vi.doMock('../firebase/firebase-client.js?v=8.32', () => ({
        completeGoogleRedirectSignIn: vi.fn(),
        getFirebaseConfigStatus: vi.fn(() => ({ projectId: null, authDomain: null })),
        initFirebaseServices: vi.fn(() => ({ configured: false, db: null })),
        observeFirebaseAuth: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOutFirebase: vi.fn(),
      }));
      vi.doMock('../store.js?v=8.32', () => ({
        state: { config: { firestoreSync: { enabled: false, mode: 'shadow' } } },
        setState: vi.fn(),
        saveStateToDB: vi.fn(),
      }));
      vi.doMock('./firestore-schema.js?v=8.32', () => ({
        createDefaultFirestoreSyncConfig: vi.fn((overrides = {}) => ({ enabled: false, mode: 'shadow', ...overrides })),
        createFirestoreSnapshotEnvelope: vi.fn(() => ({ version: 1 })),
        getEnvelopeUpdatedAt: vi.fn(),
        isRemoteNewer: vi.fn(),
        applyEnvelopeToLocalState: vi.fn(),
      }));
      vi.doMock('./firestore-outbox.js?v=8.32', () => ({
        clearFirestoreConflict: vi.fn(),
        enqueueFirestoreSnapshot: vi.fn(),
        getPendingFirestoreSnapshot: vi.fn(() => null),
        markFirestoreSnapshotFailed: vi.fn(),
        markFirestoreSnapshotSynced: vi.fn(),
        saveFirestoreConflict: vi.fn(),
        saveFirestoreMeta: vi.fn(),
      }));
      vi.doMock('./firestore-repository.js?v=8.32', () => ({
        readFirestoreSnapshot: vi.fn(),
        watchFirestoreSnapshot: vi.fn(),
        writeFirestoreSnapshot: vi.fn(),
      }));
      vi.doMock('./sync-center.js?v=8.32', () => ({
        canAutoSyncFirestore: vi.fn(),
        mergeStudyStates: vi.fn(),
      }));
      vi.doMock('./entity-state-builder.js?v=8.32', () => ({
        applyEntityDocsToState: vi.fn(),
        replaceEntityInStateByRecord: vi.fn(),
      }));
      vi.doMock('./firestore-entity-outbox.js?v=8.32', () => ({
        getPendingFirestoreEntityBatch: vi.fn(),
        markFirestoreEntityBatchSynced: vi.fn(),
        queueFirestoreEntityBatchFromState: vi.fn(),
      }));
      vi.doMock('./entity-shadow-verifier.js?v=8.32', () => ({
        compareSnapshotManifestToEntityDocs: vi.fn(),
      }));
      vi.doMock('./entity-metadata.js?v=8.32', () => ({
        visitTrackedEntities: vi.fn(() => []),
      }));

      const engine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.32');
      const result = await engine.queueFirestoreSnapshotFromState({});
      expect(result).toBe(false);
    });
  });
});
