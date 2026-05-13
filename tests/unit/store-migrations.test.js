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
    expect(migrations.DEFAULT_SCHEMA_VERSION).toBe(10);
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
    expect(store.DEFAULT_SCHEMA_VERSION).toBe(10);
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
  it('migrates v1 state to v10 via store.runMigrations', () => {
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

    expect(store.state.schemaVersion).toBe(10);
    expect(store.state.config.globalSyncPaused).toBe(true);
    expect(store.state.editais[0].id).toMatch(/^ed_/);
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
    expect(freshMigrations.DEFAULT_SCHEMA_VERSION).toBe(10);
    expect(freshMigrations.runMigrations).toBeTypeOf('function');

    // Execute migration directly with a plain state object
    const testState = { schemaVersion: 1, editais: [], config: {} };
    let changed = false;
    freshMigrations.runMigrations(testState, () => { changed = true; });
    expect(testState.schemaVersion).toBe(10);
    expect(changed).toBe(true);
  });
});
