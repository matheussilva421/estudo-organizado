import { beforeEach, describe, expect, it, vi } from 'vitest';

import { describe, expect, it } from 'vitest';
import { mergeEntityDocsIntoState } from '../../src/js/sync/entity-state-builder.js';

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
  vi.doMock('../../src/js/store.js?v=8.32', () => ({
    get state() {
      return state;
    },
    DEFAULT_SCHEMA_VERSION: 9,
    createExportableState: vi.fn((sourceState) => structuredClone(sourceState)),
    setState: vi.fn((nextState) => {
      state = nextState;
    }),
    saveStateToDB: vi.fn(() => Promise.resolve()),
  }));

  vi.doMock('../../src/js/firebase/firebase-client.js?v=8.32', () => ({
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
  vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.32', () => snapshotOutbox);

  entityOutbox = {
    getPendingFirestoreEntityBatch: vi.fn(() =>
      Promise.resolve({ status: 'pending', docs: [{ key: 'config/main', payload: {} }] })
    ),
    markFirestoreEntityBatchSynced: vi.fn(() => Promise.resolve()),
    queueFirestoreEntityBatchFromState: vi.fn(() => Promise.resolve(true)),
  };
  vi.doMock('../../src/js/sync/firestore-entity-outbox.js?v=8.32', () => entityOutbox);

  repository = {
    readFirestoreSnapshot: vi.fn(() => Promise.resolve(null)),
    watchFirestoreSnapshot: vi.fn(),
    writeFirestoreSnapshot: vi.fn(() => Promise.resolve({ updatedAt: '2026-04-29T20:00:00.000Z' })),
    readFirestoreEntityDocuments: vi.fn(() => Promise.resolve([])),
    writeFirestoreEntityDocuments: vi.fn(() => Promise.resolve({ count: 1 })),
  };
  vi.doMock('../../src/js/sync/firestore-repository.js?v=8.32', () => repository);

  vi.doMock('../../src/js/sync/sync-center.js?v=8.32', () => ({
    canAutoSyncFirestore: vi.fn(() => true),
    mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote })),
  }));

  syncEngine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.32');
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

  it('does not queue entity docs again while queueing the snapshot fallback in entity primary mode', async () => {
    entityOutbox.queueFirestoreEntityBatchFromState.mockClear();

    const result = await syncEngine.queueFirestoreSnapshotFromState(state, { manual: true });

    expect(result).toBe(true);
    expect(entityOutbox.queueFirestoreEntityBatchFromState).not.toHaveBeenCalled();
  });
});

describe('mergeEntityDocsIntoState', () => {
  it('merges different entities without collision', () => {
    const localState = {
      eventos: [{ id: 'ev_1', titulo: 'Local', _sync: { revision: 1, updatedAt: '2026-04-29T20:00:00.000Z' } }],
      editais: [],
      config: { entityTombstones: [] },
    };
    const remoteDocs = [
      {
        key: 'eventos/ev_2',
        collection: 'eventos',
        id: 'ev_2',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 1,
        payload: { id: 'ev_2', titulo: 'Remoto', _sync: { revision: 1, updatedAt: '2026-04-29T21:00:00.000Z' } },
      },
    ];

    const { mergedState, collisions } = mergeEntityDocsIntoState(localState, remoteDocs);

    expect(collisions).toHaveLength(0);
    expect(mergedState.eventos).toHaveLength(2);
    expect(mergedState.eventos.find((e) => e.id === 'ev_1').titulo).toBe('Local');
    expect(mergedState.eventos.find((e) => e.id === 'ev_2').titulo).toBe('Remoto');
  });

  it('detects collision when same entity has different revisions', () => {
    const localState = {
      eventos: [{ id: 'ev_1', titulo: 'Local', _sync: { revision: 3, updatedAt: '2026-04-29T22:00:00.000Z' } }],
      editais: [],
      config: { entityTombstones: [] },
    };
    const remoteDocs = [
      {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 2,
        payload: { id: 'ev_1', titulo: 'Remoto', _sync: { revision: 2, updatedAt: '2026-04-29T21:00:00.000Z' } },
      },
    ];

    const { mergedState, collisions } = mergeEntityDocsIntoState(localState, remoteDocs);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe('eventos/ev_1');
    expect(collisions[0].localRevision).toBe(3);
    expect(collisions[0].remoteRevision).toBe(2);
    expect(mergedState.eventos).toHaveLength(1);
    expect(mergedState.eventos[0].titulo).toBe('Local');
  });

  it('applies tombstone idempotently', () => {
    const localState = {
      eventos: [{ id: 'ev_1', titulo: 'Para deletar' }],
      editais: [],
      config: { entityTombstones: [] },
    };
    const remoteDocs = [
      {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 2,
        deletedAt: '2026-04-29T21:00:00.000Z',
        payload: null,
      },
    ];

    const { mergedState } = mergeEntityDocsIntoState(localState, remoteDocs);

    expect(mergedState.eventos).toHaveLength(0);
    expect(mergedState.config.entityTombstones).toHaveLength(1);
    expect(mergedState.config.entityTombstones[0].key).toBe('eventos/ev_1');
  });

  it('skips tombstone when local revision is equal or higher', () => {
    const localState = {
      eventos: [],
      editais: [],
      config: {
        entityTombstones: [
          { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', deletedAt: '2026-04-29T20:00:00.000Z', revision: 3 },
        ],
      },
    };
    const remoteDocs = [
      {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 2,
        deletedAt: '2026-04-29T19:00:00.000Z',
        payload: null,
      },
    ];

    const { mergedState } = mergeEntityDocsIntoState(localState, remoteDocs);

    expect(mergedState.config.entityTombstones[0].revision).toBe(3);
  });

  it('merges entities across nested collections', () => {
    const localState = {
      editais: [
        {
          id: 'ed_1',
          nome: 'Edital Local',
          disciplinas: [
            { id: 'disc_1', nome: 'Disciplina Local', assuntos: [], aulas: [] },
          ],
        },
      ],
      eventos: [],
      config: { entityTombstones: [] },
    };
    const remoteDocs = [
      {
        key: 'editais/ed_1/disciplinas/disc_2',
        collection: 'disciplinas',
        id: 'disc_2',
        updatedAt: '2026-04-29T21:00:00.000Z',
        revision: 1,
        payload: { id: 'disc_2', nome: 'Disciplina Remota', assuntos: [], aulas: [] },
      },
    ];

    const { mergedState, collisions } = mergeEntityDocsIntoState(localState, remoteDocs);

    expect(collisions).toHaveLength(0);
    expect(mergedState.editais[0].disciplinas).toHaveLength(2);
    expect(mergedState.editais[0].disciplinas.find((d) => d.id === 'disc_1').nome).toBe('Disciplina Local');
    expect(mergedState.editais[0].disciplinas.find((d) => d.id === 'disc_2').nome).toBe('Disciplina Remota');
  });
});
