import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

function createIndexedDBMock() {
  const persisted = new Map();
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: () => ({
        get: (key) => {
          const req = {};
          queueMicrotask(() => {
            req.result = persisted.get(key) || null;
            req.onsuccess?.({ target: req });
          });
          return req;
        },
        put: (value, key) => {
          const req = {};
          queueMicrotask(() => {
            persisted.set(key, structuredClone(value));
            req.onsuccess?.({ target: req });
          });
          return req;
        }
      }),
      onerror: null
    })),
    persisted
  };

  return {
    open: vi.fn(() => {
      const req = {};
      queueMicrotask(() => {
        req.result = fakeDb;
        req.onsuccess?.({ target: req });
      });
      return req;
    }),
    fakeDb
  };
}

async function importFreshStore(indexedDBMock = createIndexedDBMock()) {
  vi.resetModules();
  globalThis.indexedDB = indexedDBMock;
  const store = await import('../../src/js/store.js?v=8.30');
  await store.initDB();
  return store;
}

describe('persistence contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes legacy partial state with required persistence branches', async () => {
    const store = await importFreshStore();

    store.setState({
      schemaVersion: 3,
      editais: [{ id: 'ed_legacy', nome: 'Legacy', disciplinas: [] }],
      config: { cfSyncEnabled: true }
    });

    expect(store.state.habitos).toMatchObject({
      questoes: [],
      revisao: [],
      videoaula: [],
      paginas: []
    });
    expect(store.state.config.firestoreSync).toMatchObject(store.DEFAULT_FIRESTORE_SYNC_CONFIG);
    expect(store.state.config.entitySync).toMatchObject(store.DEFAULT_ENTITY_SYNC_CONFIG);
    expect(store.state.driveFileId).toBeNull();
  });

  it('persists local backup timestamp and emits save status events on immediate save', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T21:00:00.000Z'));
    const store = await importFreshStore();
    const statuses = [];
    document.addEventListener('app:saveStatus', (event) => statuses.push(event.detail.status));

    store.setState(createBaseState({
      eventos: [{ id: 'ev_persist', titulo: 'Persistido', status: 'agendado' }]
    }));

    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });

    expect(statuses).toEqual(['saving', 'saved']);
    expect(store.state.config.localBackupAt).toBe('2026-04-29T21:00:00.000Z');
  });

  it('can skip local backup timestamp for remote shadow writes', async () => {
    const store = await importFreshStore();
    store.setState(createBaseState({ config: { localBackupAt: '2026-04-28T10:00:00.000Z' } }));

    await store.saveStateToDB({
      skipCloudSync: true,
      prepareEntityMetadata: false,
      touchLocalBackup: false
    });

    expect(store.state.config.localBackupAt).toBe('2026-04-28T10:00:00.000Z');
  });
});
