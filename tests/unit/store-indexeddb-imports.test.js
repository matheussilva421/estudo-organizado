/**
 * Import verification tests for store/indexeddb.js
 * Ensures the extracted module is self-contained and re-exports work.
 */
/* global global, process, setImmediate */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';

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
    expect(indexeddb.DB_VERSION).toBe(8);
    expect(indexeddb.STORE_NAME).toBe('app_state');
    expect(indexeddb.FIRESTORE_OUTBOX_STORE).toBe('firestore_outbox');
    expect(indexeddb.FIRESTORE_META_STORE).toBe('firestore_meta');
    expect(indexeddb.FIRESTORE_CONFLICT_STORE).toBe('firestore_conflicts');
    expect(indexeddb.ENTITY_META_STORE).toBe('entity_meta');
    expect(indexeddb.FIRESTORE_ENTITY_OUTBOX_STORE).toBe('firestore_entity_outbox');
    expect(indexeddb.V1_LOCAL_STATE_STORE).toBe('v1_local_state');
    expect(indexeddb.V1_SYNC_OUTBOX_STORE).toBe('v1_sync_outbox');
    expect(indexeddb.V1_ENTITY_META_STORE).toBe('v1_entity_meta');
    expect(indexeddb.V1_SYNC_CONFLICT_STORE).toBe('v1_sync_conflicts');
    expect(indexeddb.V1_SYNC_META_STORE).toBe('v1_sync_meta');
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
      'V1_LOCAL_STATE_STORE',
      'V1_SYNC_OUTBOX_STORE',
      'V1_ENTITY_META_STORE',
      'V1_SYNC_CONFLICT_STORE',
      'V1_SYNC_META_STORE',
      'LOCAL_STATE_CURRENT_KEY',
      'LOCAL_STATE_PREVIOUS_KEY',
      'LOCAL_STATE_LEGACY_KEY',
      'RETA_FINAL_DRAFT_STORE',
      'RETA_FINAL_JOURNAL_STORE',
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

  it('store.js exposes the isolated draft persistence helpers', async () => {
    const draftStore = await import('../../src/js/store/reta-final-draft-store.js');

    expect(store.loadRetaFinalDraft).toBe(draftStore.loadRetaFinalDraft);
    expect(store.saveRetaFinalDraft).toBe(draftStore.saveRetaFinalDraft);
    expect(store.discardRetaFinalDraft).toBe(draftStore.discardRetaFinalDraft);
  });

  it('store.js exposes the V1 local persistence interface', () => {
    for (const name of [
      'setActiveV1Context',
      'clearActiveV1Context',
      'getActiveV1Context',
      'readLocalGeneration',
      'commitLocalChange',
      'setLocalGenerationVerified',
      'getPendingOperations',
      'ackLocalOperation',
      'listLocalConflicts',
      'readLocalConflict',
      'getLocalSyncStatus',
    ]) {
      expect(store[name]).toBeTypeOf('function');
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

describe('store/indexeddb.js - falhas durante unload', () => {
  function getWindowHandler(type) {
    return global.window.addEventListener.mock.calls.filter(([event]) => event === type).at(-1)?.[1];
  }

  it('pagehide preserva o backup emergencial e consome a rejeicao do IndexedDB', async () => {
    vi.useRealTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled = [];
    const listener = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      indexeddb.scheduleSave();
      const handler = getWindowHandler('pagehide');

      expect(handler).toBeTypeOf('function');
      expect(() => handler()).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'estudo_state_emergency',
        expect.any(String)
      );
      expect(consoleError).toHaveBeenCalledWith(
        'pagehide IndexedDB emergency save failed:',
        expect.any(Error)
      );
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('beforeunload consome a rejeicao e mantem o fluxo sincrono de aviso', async () => {
    vi.useRealTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled = [];
    const listener = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      indexeddb.scheduleSave();
      expect(indexeddb.saveTimeout).not.toBeNull();
      const handler = getWindowHandler('beforeunload');
      const event = { preventDefault: vi.fn(), returnValue: undefined };

      expect(handler).toBeTypeOf('function');
      const result = handler(event);
      await new Promise((resolve) => setImmediate(resolve));

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(result).toBe(event.returnValue);
      expect(result).toContain('alterações pendentes');
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'estudo_state_emergency',
        expect.any(String)
      );
      expect(consoleError).toHaveBeenCalledWith(
        'beforeunload IndexedDB emergency save failed:',
        expect.any(Error)
      );
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', listener);
    }
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

  it('fails closed with an error status when IndexedDB is unavailable', async () => {
    expect(indexeddb.db).toBeUndefined();

    for (const activeContext of [
      null,
      { uid: 'uid_unavailable', generationId: 'gen_unavailable' },
    ]) {
      document.dispatchEvent.mockClear();
      if (activeContext) {
        store.setActiveV1Context(activeContext.uid, activeContext.generationId);
      } else {
        store.clearActiveV1Context();
      }

      await expect(indexeddb.saveStateToDB({
        skipCloudSync: true,
        prepareEntityMetadata: false,
      })).rejects.toThrow('IndexedDB unavailable');

      const statuses = document.dispatchEvent.mock.calls
        .map(([event]) => event.detail?.status)
        .filter(Boolean);
      expect(statuses).toEqual(['saving', 'error']);
      expect(document.dispatchEvent.mock.calls
        .some(([event]) => event.type === 'stateSaved')).toBe(false);
    }
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

describe('store/indexeddb.js - Task 6 schema upgrade', () => {
  it('opens an existing v7 database, upgrades it to v8, and preserves every legacy record', async () => {
    const v7Stores = {
      app_state: {},
      firestore_outbox: {},
      firestore_meta: {},
      firestore_conflicts: {},
      entity_meta: {},
      firestore_entity_outbox: {},
      reta_final_drafts: {},
      reta_final_journal: {},
    };
    const idb = createTransactionalIdb({
      stores: v7Stores,
      version: 7,
      keyPaths: {
        app_state: null,
        firestore_outbox: 'id',
        firestore_meta: 'id',
        firestore_conflicts: 'id',
        entity_meta: 'key',
        firestore_entity_outbox: 'id',
        reta_final_drafts: 'draftId',
        reta_final_journal: 'id',
      },
    });
    idb.setRecord('app_state', 'legacy_marker', { kept: true });
    idb.setRecord('firestore_outbox', 'legacy_outbox', { id: 'legacy_outbox', kept: true });
    idb.setRecord('firestore_meta', 'legacy_meta', { id: 'legacy_meta', kept: true });
    idb.setRecord('firestore_conflicts', 'legacy_conflict', { id: 'legacy_conflict', kept: true });
    idb.setRecord('entity_meta', 'legacy_entity', { key: 'legacy_entity', kept: true });
    idb.setRecord('firestore_entity_outbox', 'legacy_entity_outbox', {
      id: 'legacy_entity_outbox',
      kept: true,
    });
    idb.setRecord('reta_final_drafts', 'legacy_draft', { draftId: 'legacy_draft', kept: true });
    idb.setRecord('reta_final_journal', 'legacy_journal', { id: 'legacy_journal', kept: true });
    global.indexedDB = idb.indexedDB;

    expect(idb.version).toBe(7);
    await expect(indexeddb.initDB()).resolves.toBeUndefined();

    expect(idb.openVersions).toEqual([8]);
    expect(idb.version).toBe(8);
    expect(idb.createdStores).toEqual([
      { name: 'v1_local_state', keyPath: 'key' },
      { name: 'v1_sync_outbox', keyPath: 'opId' },
      { name: 'v1_entity_meta', keyPath: 'key' },
      { name: 'v1_sync_conflicts', keyPath: 'key' },
      { name: 'v1_sync_meta', keyPath: 'key' },
    ]);
    expect(idb.keyPath('reta_final_drafts')).toBe('draftId');
    expect(idb.keyPath('reta_final_journal')).toBe('id');
    expect(indexeddb.db.objectStoreNames.contains('reta_final_drafts')).toBe(true);
    expect(indexeddb.db.objectStoreNames.contains('reta_final_journal')).toBe(true);
    for (const storeName of ['v1_local_state', 'v1_sync_outbox', 'v1_entity_meta',
      'v1_sync_conflicts', 'v1_sync_meta']) {
      expect(indexeddb.db.objectStoreNames.contains(storeName)).toBe(true);
    }
    expect(idb.getRecord('app_state', 'legacy_marker')).toEqual({ kept: true });
    expect(idb.getRecord('firestore_outbox', 'legacy_outbox')).toMatchObject({ kept: true });
    expect(idb.getRecord('firestore_meta', 'legacy_meta')).toMatchObject({ kept: true });
    expect(idb.getRecord('firestore_conflicts', 'legacy_conflict')).toMatchObject({ kept: true });
    expect(idb.getRecord('entity_meta', 'legacy_entity')).toMatchObject({ kept: true });
    expect(idb.getRecord('firestore_entity_outbox', 'legacy_entity_outbox'))
      .toMatchObject({ kept: true });
    expect(idb.getRecord('reta_final_drafts', 'legacy_draft')).toMatchObject({ kept: true });
    expect(idb.getRecord('reta_final_journal', 'legacy_journal')).toMatchObject({ kept: true });
    expect(store.RETA_FINAL_DRAFT_STORE).toBe('reta_final_drafts');
    expect(store.RETA_FINAL_JOURNAL_STORE).toBe('reta_final_journal');
  });
});
