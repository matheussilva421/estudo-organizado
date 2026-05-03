import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

function createIndexedDBMock() {
  const persisted = new Map();
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => {
      let pendingWrites = 0;
      const tx = {
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
            pendingWrites += 1;
            const req = {};
            queueMicrotask(() => {
              persisted.set(key, structuredClone(value));
              req.onsuccess?.({ target: req });
              pendingWrites -= 1;
              if (pendingWrites === 0) {
                queueMicrotask(() => tx.oncomplete?.());
              }
            });
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      return tx;
    }),
    persisted,
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
    fakeDb,
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
      config: { cfSyncEnabled: true },
    });

    expect(store.state.habitos).toMatchObject({
      questoes: [],
      revisao: [],
      videoaula: [],
      paginas: [],
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

    store.setState(
      createBaseState({
        eventos: [{ id: 'ev_persist', titulo: 'Persistido', status: 'agendado' }],
      })
    );

    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });

    expect(statuses).toEqual(['saving', 'saved']);
    expect(store.state.config.localBackupAt).toBe('2026-04-29T21:00:00.000Z');
  });

  it('can skip local backup timestamp for remote shadow writes', async () => {
    const store = await importFreshStore();
    const statuses = [];
    const savedEvents = [];
    document.addEventListener('app:saveStatus', (event) => statuses.push(event.detail.status));
    document.addEventListener('stateSaved', (event) => savedEvents.push(event.detail));
    store.setState(createBaseState({ config: { localBackupAt: '2026-04-28T10:00:00.000Z' } }));

    await store.saveStateToDB({
      skipCloudSync: true,
      prepareEntityMetadata: false,
      touchLocalBackup: false,
    });

    expect(store.state.config.localBackupAt).toBe('2026-04-28T10:00:00.000Z');
    expect(statuses).toEqual([]);
    expect(savedEvents).toEqual([
      expect.objectContaining({
        touchLocalBackup: false,
        metadataOnly: true,
      }),
    ]);
  });

  it('emits stateSaved only after the IndexedDB transaction commits', async () => {
    const order = [];
    const persisted = new Map();
    const indexedDBMock = {
      open: vi.fn(() => {
        const req = {};
        const fakeDb = {
          objectStoreNames: { contains: () => true },
          createObjectStore: vi.fn(),
          transaction: vi.fn(() => {
            let pendingWrites = 0;
            const tx = {
              objectStore: () => ({
                get: (key) => {
                  const getReq = {};
                  queueMicrotask(() => {
                    getReq.result = persisted.get(key) || null;
                    getReq.onsuccess?.({ target: getReq });
                  });
                  return getReq;
                },
                put: (value, key) => {
                  pendingWrites += 1;
                  const putReq = {};
                  queueMicrotask(() => {
                    persisted.set(key, structuredClone(value));
                    order.push(`put:${key}`);
                    putReq.onsuccess?.({ target: putReq });
                    pendingWrites -= 1;
                    if (pendingWrites === 0) {
                      queueMicrotask(() => {
                        order.push('transaction:complete');
                        tx.oncomplete?.();
                      });
                    }
                  });
                  return putReq;
                },
              }),
              oncomplete: null,
              onerror: null,
              onabort: null,
            };
            return tx;
          }),
        };
        queueMicrotask(() => {
          req.result = fakeDb;
          req.onsuccess?.({ target: req });
        });
        return req;
      }),
    };
    const store = await importFreshStore(indexedDBMock);
    document.addEventListener('stateSaved', () => order.push('stateSaved'), { once: true });

    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });

    expect(order.indexOf('transaction:complete')).toBeGreaterThan(-1);
    expect(order.indexOf('stateSaved')).toBeGreaterThan(order.indexOf('transaction:complete'));
  });
});
