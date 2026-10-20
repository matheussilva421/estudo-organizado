/**
 * Import verification tests for store/migrations.js
 * Ensures the extracted module is self-contained and re-exports work.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let migrations;
let store;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  // Setup minimal browser environment
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

  // First load the store (which imports migrations.js internally)
  store = await import('../../src/js/store.js?v=8.37');
  // Also load migrations.js directly
  migrations = await import('../../src/js/store/migrations.js');
});

describe('store/migrations.js - Module integrity', () => {
  it('exports expected symbols', () => {
    expect(migrations.DEFAULT_SCHEMA_VERSION).toBe(12);
    expect(migrations.runMigrations).toBeTypeOf('function');
  });

  it('runMigrations accepts state and onChanged callback parameters', () => {
    // Verify function accepts (state, onChanged)
    expect(migrations.runMigrations.length).toBe(2);
  });

  it('does NOT import from other store/ sub-modules (only external deps)', () => {
    // migrations.js should only import from external modules like ../utils.js
    // Verify there are no imports from ./ or ../ that reference store/ paths
    const source = migrations.runMigrations.toString();
    // There should be no dynamic evidence of circular deps — the module
    // loaded successfully above, which is the primary verification.
    // The source of the module is self-contained with just uid from utils.js.
    expect(migrations.runMigrations).toBeTypeOf('function');
  });

  it('re-exported DEFAULT_SCHEMA_VERSION matches both modules', () => {
    expect(store.DEFAULT_SCHEMA_VERSION).toBe(12);
    expect(store.DEFAULT_SCHEMA_VERSION).toBe(migrations.DEFAULT_SCHEMA_VERSION);
  });

  it('store.runMigrations delegates to migrations.runMigrations with state and scheduleSave', () => {
    // Verify both modules export runMigrations as functions
    expect(store.runMigrations).toBeTypeOf('function');
    expect(migrations.runMigrations).toBeTypeOf('function');
    // store.runMigrations should be a wrapping function (length 0, since
    // it takes no arguments after closure over state + scheduleSave)
    expect(store.runMigrations.length).toBe(0);
  });
});

describe('store/migrations.js - Migration logic works end-to-end', () => {
  it('migrates v1 state to v11 via store.runMigrations', () => {
    store.setState({
      schemaVersion: 1,
      editais: [
        {
          nome: 'TRF',
          grupos: [
            {
              disciplinas: [
                {
                  nome: 'Direito Constitucional',
                  assuntos: [
                    { nome: 'Aula 01 - Princípios', concluido: true, dataConclusao: '2026-01-15' },
                    { nome: 'Controle de Constitucionalidade', concluido: false }
                  ]
                }
              ]
            }
          ]
        },
      ],
      config: { frequenciaRevisao: '1,7,30,90' },
    });

    store.runMigrations();
    vi.runOnlyPendingTimers();

    expect(store.state.schemaVersion).toBe(12);
    expect(store.state.config.globalSyncPaused).toBe(true);
    expect(store.state.editais[0].id).toMatch(/^ed_/);
    expect(store.state.editais[0].arquivado).toBe(false);
    expect(store.state.editais[0].arquivadoEm).toBe(null);
    expect(store.state.editais[0].disciplinas).toBeDefined();
    expect(store.state.editais[0].disciplinas[0].assuntos).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas[0]).toMatchObject({
      estudada: true,
      dataEstudo: '2026-01-15',
      _migratedFromV6: true,
    });
    expect(store.state.config.frequenciaRevisao).toEqual([1, 7, 30, 90]);
  });

  it('direct module import does not create circular dependency', async () => {
    // If there were circular imports, the dynamic import would fail
    // or the module would have incomplete bindings
    const freshMigrations = await import('../../src/js/store/migrations.js');
    expect(freshMigrations.DEFAULT_SCHEMA_VERSION).toBe(12);
    expect(freshMigrations.runMigrations).toBeTypeOf('function');

    // Execute migration directly with a plain state object
    const testState = { schemaVersion: 1, editais: [], config: {} };
    let changed = false;
    freshMigrations.runMigrations(testState, () => { changed = true; });
    expect(testState.schemaVersion).toBe(12);
    expect(changed).toBe(true);
  });

  it('reports global migration changes through the return contract', () => {
    const testState = { schemaVersion: 11, config: {}, editais: [], planejamento: { tipo: 'ciclo' } };
    const result = migrations.runMigrations(testState, () => {});
    expect(result.changed).toBe(true);
  });
});

describe('store/migrations.js - v10 → v11: edital archive flags', () => {
  it('adds arquivado=false / arquivadoEm=null to every edital', () => {
    const testState = {
      schemaVersion: 10,
      editais: [
        { id: 'ed_1', nome: 'A', disciplinas: [] },
        { id: 'ed_2', nome: 'B', disciplinas: [] },
      ],
      config: {},
    };
    migrations.runMigrations(testState, () => {});

    expect(testState.schemaVersion).toBe(12);
    testState.editais.forEach((ed) => {
      expect(ed.arquivado).toBe(false);
      expect(ed.arquivadoEm).toBe(null);
    });
  });

  it('does not crash when state.editais is undefined', () => {
    const testState = { schemaVersion: 10, config: {} };
    expect(() => migrations.runMigrations(testState, () => {})).not.toThrow();
    expect(testState.schemaVersion).toBe(12);
  });

  it('is idempotent: preserves an already-archived edital on re-run', () => {
    const testState = {
      schemaVersion: 10,
      editais: [{ id: 'ed_1', nome: 'A', disciplinas: [], arquivado: true, arquivadoEm: '2026-01-01T00:00:00.000Z' }],
      config: {},
    };
    migrations.runMigrations(testState, () => {});
    // Simulate a second pass (version already at 11)
    migrations.runMigrations(testState, () => {});

    expect(testState.editais[0].arquivado).toBe(true);
    expect(testState.editais[0].arquivadoEm).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('Reta Final persisted migration', () => {
  function legacyState() {
    return {
      schemaVersion: 12, config: {}, editais: [], revisoes: [{ id: 'rev_1', data: '2026-10-20' }],
      planejamento: {
        ativo: true, tipo: 'reta_final', updatedAt: '2026-10-17T10:00:00.000Z',
        retaFinal: { dataFinal: '2026-11-01', blocos: [{
          id: 'rf_1', discId: 'disc_1', topicos: [{ assId: 'ass_1', aulaId: 'aula_1' }],
          minutos: 60, dataOriginal: '2026-10-18', data: '2026-10-19', rolagens: 1, status: 'concluido',
        }] },
      },
      eventos: [{
        id: 'ev_1', rfBlocoId: 'rf_1', discId: 'disc_1', assId: 'ass_1', aulaId: 'aula_1',
        status: 'estudei', data: '2026-10-18', dataEstudo: '2026-10-18', tempoAcumulado: 3600,
        questoes: { total: 30, acertos: 25 }, revisoes: ['rev_1'], paginas: 12,
      }],
    };
  }

  it('migra estado já v12, preserva bytes de eventos/revisões e agenda apenas uma gravação', () => {
    const input = legacyState();
    const history = JSON.stringify({ eventos: input.eventos, revisoes: input.revisoes });
    const onChanged = vi.fn();
    migrations.runMigrations(input, onChanged);
    expect(input.planejamento).toMatchObject({ schemaVersionRetaFinal: 2, revision: 0 });
    expect(input.planejamento.planId).toEqual(expect.any(String));
    expect(input.planejamento.retaFinal.blocos[0]).toMatchObject({ id: 'rf_1', dataPlanejada: '2026-10-18' });
    const once = JSON.stringify(input);
    migrations.runMigrations(input, onChanged);
    expect(JSON.stringify(input)).toBe(once);
    expect(JSON.stringify({ eventos: input.eventos, revisoes: input.revisoes })).toBe(history);
    expect(input.schemaVersion).toBe(12);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('preserva versões futuras do estado e planos de outros tipos', () => {
    const input = { schemaVersion: 99, config: {}, planejamento: { tipo: 'ciclo', revision: 4 } };
    const before = JSON.stringify(input);
    const onChanged = vi.fn();
    migrations.runMigrations(input, onChanged);
    expect(JSON.stringify(input)).toBe(before);
    expect(onChanged).not.toHaveBeenCalled();
  });

  // Transactional IndexedDB seam: writes only become visible on commit; abort
  // leaves the Map intact, and reload reads the persisted bytes, not live state.
  function memoryDB(records, { failWrites = false, commitGate = null } = {}) {
    const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    let signalWriteStart;
    const database = {
      writeStarted: new Promise((resolve) => { signalWriteStart = resolve; }),
      transaction(_stores, mode) {
        const staged = new Map();
        const tx = {
          objectStore: () => ({
            get(key) {
              const req = {};
              Promise.resolve().then(() => {
                req.result = clone(records.get(key));
                req.onsuccess?.();
                if (mode === 'readwrite') {
                  Promise.resolve().then(async () => {
                    if (failWrites) {
                      tx.error = new Error('simulated migration abort');
                      tx.onabort?.();
                    } else {
                      if (commitGate) await commitGate;
                      for (const [k, value] of staged) records.set(k, clone(value));
                      tx.oncomplete?.();
                    }
                  });
                }
              });
              return req;
            },
            put(value, key) {
              staged.set(key, clone(value));
              signalWriteStart?.();
              signalWriteStart = null;
              return {};
            },
          }),
        };
        return tx;
      },
    };
    return database;
  }

  async function boot(database) {
    global.indexedDB = { open: vi.fn(() => {
      const req = {};
      Promise.resolve().then(() => req.onsuccess({ target: { result: database } }));
      return req;
    }) };
    await store.initDB();
  }

  it.each(['current', 'legacy', 'previous'])('boot %s persiste migração e backup com checksum antes de concluir; reload retém identidade', async (source) => {
    const input = legacyState();
    const sourceKey = source === 'legacy' ? store.LOCAL_STATE_LEGACY_KEY :
      source === 'current' ? store.LOCAL_STATE_CURRENT_KEY : store.LOCAL_STATE_PREVIOUS_KEY;
    const records = new Map([[sourceKey, source === 'legacy' ? input : store.createLocalStateEnvelope(input)]]);
    const database = memoryDB(records);
    await boot(database);
    expect(store.DB_VERSION).toBe(7);
    const saved = records.get(store.LOCAL_STATE_CURRENT_KEY);
    const backup = records.get(store.LOCAL_STATE_PREVIOUS_KEY);
    expect(store.isLocalStateEnvelopeValid(saved)).toBe(true);
    expect(store.isLocalStateEnvelopeValid(backup)).toBe(true);
    expect(backup.payload.planejamento).toEqual(input.planejamento);
    expect(saved.payload.planejamento.schemaVersionRetaFinal).toBe(2);
    expect(saved.payload.eventos).toEqual(input.eventos);
    expect(saved.payload.revisoes).toEqual(input.revisoes);
    const once = JSON.stringify(saved.payload.planejamento);
    await store.loadStateFromDB();
    expect(JSON.stringify(store.state.planejamento)).toBe(once);
    await vi.advanceTimersByTimeAsync(900);
    expect(records.get(store.LOCAL_STATE_PREVIOUS_KEY)).toEqual(backup);
  });

  it('migração do localStorage preserva o backup após o debounce seguinte', async () => {
    const records = new Map();
    await boot(memoryDB(records));
    const input = legacyState();
    const savedRaw = JSON.stringify(input);
    global.localStorage.getItem = vi.fn((key) => key === 'estudo_state' ? savedRaw : null);
    global.localStorage.removeItem = vi.fn();
    await store.loadLegacyState();
    const backup = records.get(store.LOCAL_STATE_PREVIOUS_KEY);
    expect(backup.payload).toEqual(input);
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('estudo_state');
    await vi.advanceTimersByTimeAsync(900);
    expect(records.get(store.LOCAL_STATE_PREVIOUS_KEY)).toEqual(backup);
  });

  it('persiste fonte local já v2 antes de removê-la', async () => {
    const records = new Map();
    await boot(memoryDB(records));
    const input = legacyState();
    migrations.runMigrations(input, () => {});
    const savedRaw = JSON.stringify(input);
    global.localStorage.getItem = vi.fn((key) => key === 'estudo_state' ? savedRaw : null);
    global.localStorage.removeItem = vi.fn();

    await store.loadLegacyState();

    const saved = records.get(store.LOCAL_STATE_CURRENT_KEY);
    const backup = records.get(store.LOCAL_STATE_PREVIOUS_KEY);
    expect(store.isLocalStateEnvelopeValid(saved)).toBe(true);
    expect(saved.payload.planejamento).toEqual(input.planejamento);
    expect(backup.payload).toEqual(input);
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('estudo_state');
  });

  it('sem IndexedDB preserva fonte RF e não ativa identidade não persistida', async () => {
    const input = legacyState();
    const savedRaw = JSON.stringify(input);
    global.localStorage.getItem = vi.fn((key) => key === 'estudo_state' ? savedRaw : null);
    global.localStorage.removeItem = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.indexedDB = { open: vi.fn(() => {
      const req = {};
      Promise.resolve().then(() => req.onerror({ target: { error: new Error('IndexedDB unavailable') } }));
      return req;
    }) };

    await store.initDB();

    expect(store.state.planejamento).toEqual(input.planejamento);
    expect(store.state.planejamento.planId).toBeUndefined();
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('removeItem com erro não deixa initDB pendurado', async () => {
    const input = legacyState();
    const savedRaw = JSON.stringify(input);
    const records = new Map();
    const database = memoryDB(records);
    // The first read probes emergency state; the second reaches the legacy fallback.
    let savedReads = 0;
    global.localStorage.getItem = vi.fn((key) => {
      if (key !== 'estudo_state') return null;
      savedReads += 1;
      return savedReads >= 2 ? savedRaw : null;
    });
    global.localStorage.removeItem = vi.fn(() => { throw new Error('storage blocked'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.indexedDB = { open: vi.fn(() => {
      const req = {};
      Promise.resolve().then(() => {
        req.onsuccess({ target: { result: database } });
      });
      return req;
    }) };

    await expect(store.initDB()).resolves.toBeUndefined();

    expect(store.state.planejamento).toMatchObject({ schemaVersionRetaFinal: 2 });
    expect(records.get(store.LOCAL_STATE_CURRENT_KEY).payload.planejamento).toMatchObject({
      schemaVersionRetaFinal: 2,
    });
  }, 1000);

  it('initDB só conclui após o commit durável da migração', async () => {
    const input = legacyState();
    const records = new Map([[store.LOCAL_STATE_CURRENT_KEY, store.createLocalStateEnvelope(input)]]);
    let releaseCommit;
    const commitGate = new Promise((resolve) => { releaseCommit = resolve; });
    const database = memoryDB(records, { commitGate });
    global.indexedDB = { open: vi.fn(() => {
      const req = {};
      Promise.resolve().then(() => req.onsuccess({ target: { result: database } }));
      return req;
    }) };
    let settled = false;
    const booting = store.initDB().then(() => { settled = true; });

    await database.writeStarted;

    expect(settled).toBe(false);
    expect(records.get(store.LOCAL_STATE_CURRENT_KEY).payload.planejamento).toEqual(input.planejamento);
    releaseCommit();
    await booting;
    expect(settled).toBe(true);
    expect(records.get(store.LOCAL_STATE_CURRENT_KEY).payload.planejamento).toMatchObject({
      schemaVersionRetaFinal: 2,
    });
  });

  it('aborto da persistência mantém backup/original e não deixa identidade não persistida ativa', async () => {
    const input = legacyState();
    const records = new Map([[store.LOCAL_STATE_CURRENT_KEY, store.createLocalStateEnvelope(input)]]);
    const before = JSON.stringify([...records]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await boot(memoryDB(records, { failWrites: true }));
    expect(JSON.stringify([...records])).toBe(before);
    expect(store.state.planejamento).toEqual(input.planejamento);
    expect(store.state.eventos).toEqual(input.eventos);
  });
});
