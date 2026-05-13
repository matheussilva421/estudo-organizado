/**
 * Import verification tests for store/indexeddb.js
 * Ensures the extracted module is self-contained and re-exports work.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

let store;
let indexeddb;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  // Setup minimal browser environment — needed because indexeddb.js
  // registers window event listeners at module top level
  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.window = {
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

  // First load the store (which imports indexeddb.js internally)
  store = await import('../../src/js/store.js?v=8.37');
  // Also load indexeddb.js directly
  indexeddb = await import('../../src/js/store/indexeddb.js');
});

describe('store/indexeddb.js - Module integrity', () => {
  it('exports expected IndexedDB symbols', () => {
    // Constants
    expect(indexeddb.DB_NAME).toBe('EstudoOrganizadoDB');
    expect(indexeddb.DB_VERSION).toBe(6);
    expect(indexeddb.STORE_NAME).toBe('app_state');
    expect(indexeddb.FIRESTORE_OUTBOX_STORE).toBe('firestore_outbox');
    expect(indexeddb.FIRESTORE_META_STORE).toBe('firestore_meta');
    expect(indexeddb.FIRESTORE_CONFLICT_STORE).toBe('firestore_conflicts');
    expect(indexeddb.ENTITY_META_STORE).toBe('entity_meta');
    expect(indexeddb.FIRESTORE_ENTITY_OUTBOX_STORE).toBe('firestore_entity_outbox');
    expect(indexeddb.LOCAL_STATE_CURRENT_KEY).toBe('main_state_current');
    expect(indexeddb.LOCAL_STATE_PREVIOUS_KEY).toBe('main_state_previous');
    expect(indexeddb.LOCAL_STATE_LEGACY_KEY).toBe('main_state');

    expect(indexeddb.DEFAULT_FIRESTORE_SYNC_CONFIG).toBeDefined();
    expect(indexeddb.DEFAULT_FIRESTORE_SYNC_CONFIG.enabled).toBe(false);
    expect(indexeddb.DEFAULT_FIRESTORE_SYNC_CONFIG.mode).toBe('shadow');

    // Functions
    expect(indexeddb.initDB).toBeTypeOf('function');
    expect(indexeddb.loadStateFromDB).toBeTypeOf('function');
    expect(indexeddb.loadLegacyState).toBeTypeOf('function');
    expect(indexeddb.saveStateToDB).toBeTypeOf('function');
    expect(indexeddb.clearData).toBeTypeOf('function');
    expect(indexeddb.scheduleSave).toBeTypeOf('function');
    expect(indexeddb.describeSaveFailure).toBeTypeOf('function');
    expect(indexeddb.runMigrations).toBeTypeOf('function');

    // Infrastructure
    expect(indexeddb.SyncQueue).toBeDefined();
    expect(indexeddb.SyncQueue.isProcessing).toBe(false);
    expect(indexeddb.saveTimeout).toBeNull();
  });

  it('re-exported symbols from store.js match indexeddb.js (same binding)', () => {
    const reExportedSymbols = [
      'DB_NAME',
      'DB_VERSION',
      'STORE_NAME',
      'FIRESTORE_OUTBOX_STORE',
      'FIRESTORE_META_STORE',
      'FIRESTORE_CONFLICT_STORE',
      'ENTITY_META_STORE',
      'FIRESTORE_ENTITY_OUTBOX_STORE',
      'LOCAL_STATE_CURRENT_KEY',
      'LOCAL_STATE_PREVIOUS_KEY',
      'LOCAL_STATE_LEGACY_KEY',
      'DEFAULT_FIRESTORE_SYNC_CONFIG',
    ];

    for (const sym of reExportedSymbols) {
      expect(store[sym]).toBe(indexeddb[sym]);
    }

    // Functions: re-exports should be the same function reference
    const reExportedFunctions = [
      'initDB',
      'loadStateFromDB',
      'loadLegacyState',
      'saveStateToDB',
      'clearData',
      'scheduleSave',
      'describeSaveFailure',
      'runMigrations',
    ];

    for (const sym of reExportedFunctions) {
      expect(store[sym]).toBe(indexeddb[sym]);
    }
  });

  it('store.js re-exports "db" as live binding from indexeddb.js', () => {
    // "db" is a mutable let — verify it's the same binding
    expect(store.db).toBeUndefined();
    expect(indexeddb.db).toBeUndefined();
    // Both should reference the same variable (live binding)
    expect(store.db).toBe(indexeddb.db);
  });

  it('store.js re-exports saveTimeout as live binding', () => {
    expect(store.saveTimeout).toBeNull();
    expect(store.saveTimeout).toBe(indexeddb.saveTimeout);
  });

  it('direct module import does not create circular dependency', async () => {
    // If there were circular imports that deadlock, the dynamic import would fail
    const freshIndexeddb = await import('../../src/js/store/indexeddb.js');
    expect(freshIndexeddb.DB_NAME).toBe('EstudoOrganizadoDB');
    expect(freshIndexeddb.initDB).toBeTypeOf('function');
    expect(freshIndexeddb.saveStateToDB).toBeTypeOf('function');
  });

  it('indexeddb.js source does not import from ../store.js in a way that deadlocks', () => {
    // The primary verification is that imports succeed above.
    // IndexedDB imports data-envelope helpers directly to avoid facade cycles.
    const source = read('src/js/store/indexeddb.js');
    // Verify initDB exists (sanity check on the read)
    expect(source).toContain('export function initDB');
    expect(source).toContain('export function saveStateToDB');
    expect(source).toContain('export function clearData');
    expect(source).toContain("from './normalize-state.js'");
    expect(source).not.toContain("from '../store.js'");
    expect(source).not.toContain("from '../store.js?v=8.37'");
  });

  it('indexeddb.js does NOT use dynamic imports', () => {
    const source = read('src/js/store/indexeddb.js');
    expect(source).not.toContain('import(');
    expect(source).not.toMatch(/import\s*\(/);
  });
});

describe('store/indexeddb.js - Data pipeline functions work end-to-end', () => {
  it('describeSaveFailure works for known error types', () => {
    const quotaErr = { target: { error: { name: 'QuotaExceededError', message: 'quota' } } };
    expect(indexeddb.describeSaveFailure(quotaErr)).toContain('Espaço de armazenamento insuficiente');

    const invalidErr = { target: { error: { name: 'InvalidStateError', message: 'closed' } } };
    expect(indexeddb.describeSaveFailure(invalidErr)).toContain('IndexedDB indisponível');

    const unknownErr = { target: { error: { name: 'SomeError', message: 'something' } } };
    expect(indexeddb.describeSaveFailure(unknownErr)).toBe('SomeError: something');
  });

  it('describeSaveFailure handles null/undefined gracefully', () => {
    const result = indexeddb.describeSaveFailure(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('SyncQueue processes tasks sequentially', async () => {
    indexeddb.SyncQueue.clear();
    const order = [];

    await indexeddb.SyncQueue.add(async () => {
      order.push(1);
    });
    await indexeddb.SyncQueue.add(async () => {
      order.push(2);
    });

    // Advance timers to flush any pending async state
    await vi.runAllTimersAsync();

    expect(order).toEqual([1, 2]);
    expect(indexeddb.SyncQueue.tasks).toHaveLength(0);
  });
});
