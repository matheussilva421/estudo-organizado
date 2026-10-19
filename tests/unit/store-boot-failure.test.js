import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/js/store/migrations.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runMigrations: vi.fn(() => { throw new Error('simulated migration failure'); }),
  };
});

let store;

function memoryDB(records) {
  return {
    transaction() {
      return {
        objectStore: () => ({
          get(key) {
            const req = {};
            Promise.resolve().then(() => {
              req.result = records.get(key);
              req.onsuccess?.();
            });
            return req;
          },
        }),
      };
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  store = await import('../../src/js/store.js?v=8.37');
});

describe('IndexedDB boot failure containment', () => {
  it('loadStateFromDB resolves when the migration path throws', async () => {
    const records = new Map();
    const database = memoryDB(records);
    global.indexedDB = { open: vi.fn(() => {
      const req = {};
      Promise.resolve().then(() => req.onsuccess({ target: { result: database } }));
      return req;
    }) };
    await store.initDB();
    const input = {
      schemaVersion: 12,
      config: {},
      editais: [],
      eventos: [],
      revisoes: [],
      planejamento: null,
    };
    records.set(store.LOCAL_STATE_CURRENT_KEY, store.createLocalStateEnvelope(input));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(store.loadStateFromDB()).resolves.toBeUndefined();
  }, 1000);
});
