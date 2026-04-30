import { beforeEach, describe, expect, it, vi } from 'vitest';

const baseState = () => ({
  schemaVersion: 7,
  editais: [],
  eventos: [],
  habitos: {
    questoes: [],
    revisao: [],
    discursiva: [],
    simulado: [],
    leitura: [],
    informativo: [],
    sumula: [],
    videoaula: [],
    paginas: [],
  },
  config: {
    firestoreSync: {
      enabled: true,
      mode: 'primary',
      hasPendingWrites: false,
      conflict: null,
    },
    entitySync: {
      enabled: true,
      mode: 'primary',
    },
  },
});

let state;
let repository;
let entityOutbox;
let snapshotOutbox;
let syncEngine;

async function importEngine() {
  vi.doMock('../../src/js/store.js?v=8.29', () => ({
    get state() {
      return state;
    },
    setState: vi.fn((nextState) => {
      state = nextState;
    }),
    saveStateToDB: vi.fn(() => Promise.resolve()),
  }));

  vi.doMock('../../src/js/firebase/firebase-client.js?v=8.29', () => ({
    completeGoogleRedirectSignIn: vi.fn(() => Promise.resolve(null)),
    getFirebaseConfigStatus: vi.fn(() => ({ projectId: 'test', authDomain: 'test.local' })),
    initFirebaseServices: vi.fn(() => ({ configured: true, db: { name: 'db' } })),
    observeFirebaseAuth: vi.fn(() => {}),
    signInWithGoogle: vi.fn(() =>
      Promise.resolve({ user: { uid: 'user-1', email: 'user@example.com' } })
    ),
    signOutFirebase: vi.fn(() => Promise.resolve()),
  }));

  snapshotOutbox = {
    clearFirestoreConflict: vi.fn(() => Promise.resolve()),
    enqueueFirestoreSnapshot: vi.fn(() => Promise.resolve(true)),
    getPendingFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
    markFirestoreSnapshotFailed: vi.fn(() => Promise.resolve()),
    markFirestoreSnapshotSynced: vi.fn(() => Promise.resolve()),
    saveFirestoreConflict: vi.fn(() => Promise.resolve()),
    saveFirestoreMeta: vi.fn(() => Promise.resolve()),
  };
  vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.29', () => snapshotOutbox);

  entityOutbox = {
    getPendingFirestoreEntityBatch: vi.fn(() =>
      Promise.resolve({ status: 'pending', docs: [{ key: 'config/main', payload: {} }] })
    ),
    markFirestoreEntityBatchSynced: vi.fn(() => Promise.resolve()),
    queueFirestoreEntityBatchFromState: vi.fn(() => Promise.resolve(true)),
  };
  vi.doMock('../../src/js/sync/firestore-entity-outbox.js?v=8.29', () => entityOutbox);

  repository = {
    readFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
    watchFirestoreSnapshot: vi.fn(),
    writeFirestoreSnapshot: vi.fn(() => Promise.resolve({ updatedAt: '2026-04-29T20:00:00.000Z' })),
    readFirestoreEntityDocuments: vi.fn(() => Promise.resolve([])),
    writeFirestoreEntityDocuments: vi.fn(() => Promise.resolve({ count: 1 })),
  };
  vi.doMock('../../src/js/sync/firestore-repository.js?v=8.29', () => repository);

  vi.doMock('../../src/js/sync/sync-center.js?v=8.29', () => ({
    canAutoSyncFirestore: vi.fn(() => true),
    mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote })),
  }));

  syncEngine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.29');
  await syncEngine.firestoreSignIn();
}

beforeEach(async () => {
  vi.resetModules();
  state = baseState();
  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
  };
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, params = {}) {
      super(type);
      this.detail = params.detail;
    }
  };

  await importEngine();
});

describe('Firestore entity primary regressions', () => {
  it('keeps entity sync in primary mode after manual primary sync', async () => {
    const result = await syncEngine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(repository.writeFirestoreEntityDocuments).toHaveBeenCalled();
    expect(state.config.entitySync.mode).toBe('primary');
  });

  it('initializes empty primary entity remote without queueing a legacy snapshot', async () => {
    const result = await syncEngine.mergeFromFirestore();

    expect(result).toBe(true);
    expect(entityOutbox.queueFirestoreEntityBatchFromState).toHaveBeenCalledWith(state, {
      manual: true,
    });
    expect(repository.writeFirestoreEntityDocuments).toHaveBeenCalled();
    expect(snapshotOutbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(state.config.entitySync.mode).toBe('primary');
  });

  it('updates sync metadata after pulling newer primary entity docs', async () => {
    repository.readFirestoreEntityDocuments.mockResolvedValue([
      {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 2,
        payload: {
          id: 'ev_1',
          titulo: 'Remoto',
          _sync: { updatedAt: '2026-04-29T21:00:00.000Z', revision: 2 },
        },
      },
    ]);
    state.config.firestoreSync.hasPendingWrites = true;

    const result = await syncEngine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(snapshotOutbox.saveFirestoreMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        remoteUpdatedAt: '2026-04-29T21:00:00.000Z',
      })
    );
    expect(state.eventos[0].titulo).toBe('Remoto');
    expect(state.config.firestoreSync.remoteUpdatedAt).toBe('2026-04-29T21:00:00.000Z');
    expect(state.config.firestoreSync.lastPullAt).toBeTruthy();
    expect(state.config.firestoreSync.hasPendingWrites).toBe(false);
    expect(state.config.firestoreSync.conflict).toBeNull();
  });
});
