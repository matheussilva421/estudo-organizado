/**
 * Import verification tests for store/export-state.js and store/normalize-state.js
 * Ensures extracted modules are self-contained and re-exports work through store.js.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

let store;
let normalizeState;
let exportState;

beforeEach(async () => {
  vi.resetModules();

  // Minimal browser environment for store.js
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

  store = await import('../../src/js/store.js?v=8.37');
  normalizeState = await import('../../src/js/store/normalize-state.js');
  exportState = await import('../../src/js/store/export-state.js');
});

describe('store/normalize-state.js - Module integrity', () => {
  it('exports all expected normalization symbols', () => {
    expect(normalizeState.deepClone).toBeTypeOf('function');
    expect(normalizeState.stableStringify).toBeTypeOf('function');
    expect(normalizeState.checksumString).toBeTypeOf('function');
    expect(normalizeState.createLocalStateEnvelope).toBeTypeOf('function');
    expect(normalizeState.isLocalStateEnvelopeValid).toBeTypeOf('function');
    expect(normalizeState.pickRecoverableLocalState).toBeTypeOf('function');
  });

  it('deepClone returns a structurally equal but distinct object', () => {
    const original = { a: 1, b: { c: [2, 3] } };
    const cloned = normalizeState.deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.c).not.toBe(original.b.c);
  });

  it('deepClone handles null/primitive values', () => {
    expect(normalizeState.deepClone(null)).toBe(null);
    expect(normalizeState.deepClone(42)).toBe(42);
    expect(normalizeState.deepClone('hello')).toBe('hello');
  });

  it('createLocalStateEnvelope wraps state with checksum', () => {
    const source = { schemaVersion: 10, eventos: [{ id: 'ev_1' }] };
    const envelope = normalizeState.createLocalStateEnvelope(source, { slot: 'current' });

    expect(envelope.version).toBe(1);
    expect(envelope.slot).toBe('current');
    expect(envelope.schemaVersion).toBe(10);
    expect(envelope.checksum).toEqual(expect.any(String));
    expect(envelope.payload).toEqual(source);
    expect(envelope.payload).not.toBe(source); // deep cloned
  });

  it('isLocalStateEnvelopeValid detects corruption', () => {
    const envelope = normalizeState.createLocalStateEnvelope(
      { schemaVersion: 10, data: 'ok' },
      { slot: 'current' }
    );

    expect(normalizeState.isLocalStateEnvelopeValid(envelope)).toBe(true);

    // Tamper with payload after creation
    envelope.payload.data = 'corrupted';
    expect(normalizeState.isLocalStateEnvelopeValid(envelope)).toBe(false);
  });

  it('isLocalStateEnvelopeValid rejects invalid shapes', () => {
    expect(normalizeState.isLocalStateEnvelopeValid(null)).toBe(false);
    expect(normalizeState.isLocalStateEnvelopeValid({})).toBe(false);
    expect(normalizeState.isLocalStateEnvelopeValid({ version: 2 })).toBe(false);
  });

  it('pickRecoverableLocalState prefers current over previous over legacy over emergency', () => {
    const current = normalizeState.createLocalStateEnvelope(
      { schemaVersion: 10, data: 'curr' },
      { slot: 'current' }
    );
    const previous = normalizeState.createLocalStateEnvelope(
      { schemaVersion: 10, data: 'prev' },
      { slot: 'previous' }
    );
    const legacy = { schemaVersion: 9, data: 'legacy' };
    const emergency = { schemaVersion: 9, data: 'emergency' };

    // All valid - picks current
    let recovered = normalizeState.pickRecoverableLocalState({ current, previous, legacy, emergency });
    expect(recovered.source).toBe('current');
    expect(recovered.state.data).toBe('curr');

    // Current corrupted - picks previous
    current.payload.data = 'corrupted';
    recovered = normalizeState.pickRecoverableLocalState({ current, previous, legacy, emergency });
    expect(recovered.source).toBe('previous');
    expect(recovered.state.data).toBe('prev');

    // Both corrupted - picks legacy
    previous.payload.data = 'also-corrupted';
    recovered = normalizeState.pickRecoverableLocalState({ current, previous, legacy, emergency });
    expect(recovered.source).toBe('legacy');
    expect(recovered.state.data).toBe('legacy');

    // Only emergency left
    recovered = normalizeState.pickRecoverableLocalState({ current, previous, legacy: null, emergency });
    expect(recovered.source).toBe('emergency');
    expect(recovered.state.data).toBe('emergency');

    // Nothing valid
    recovered = normalizeState.pickRecoverableLocalState({ current, previous, legacy: null, emergency: null });
    expect(recovered.source).toBe('empty');
    expect(recovered.state).toBeNull();
  });

  it('does not import from ../store.js', () => {
    const source = read('src/js/store/normalize-state.js');
    expect(source).not.toContain("from '../store.js'");
    expect(source).not.toContain("from '../store.js?v=");
  });

  it('does not use dynamic imports', () => {
    const source = read('src/js/store/normalize-state.js');
    expect(source).not.toContain('import(');
  });

  it('imports DEFAULT_SCHEMA_VERSION from ./migrations.js (not from store.js)', () => {
    const source = read('src/js/store/normalize-state.js');
    expect(source).toContain("from './migrations.js'");
  });
});

describe('store/export-state.js - Module integrity', () => {
  it('exports createExportableState function', () => {
    expect(exportState.createExportableState).toBeTypeOf('function');
  });

  it('strips sync secrets from state', () => {
    const state = {
      schemaVersion: 10,
      config: {
        localBackupAt: '2026-01-01T00:00:00.000Z',
        cfUrl: 'https://sync.example.com',
        cfToken: 'secret-token',
        cfTokenSaved: true,
        cfConflict: { remoteDeviceId: 'dev-a' },
        cfRemoteUpdatedAt: '2026-01-02T00:00:00.000Z',
        cfLastSyncAt: '2026-01-02T12:00:00.000Z',
        _lastUpdated: 1700000000000,
        syncMergeConflicts: [{ id: 'conflict_1' }],
        cfSyncEnabled: true,
        firestoreSync: { enabled: true, mode: 'primary', uid: 'user-1' },
        keepThis: 'value',
      },
      driveFileId: 'drive-file-123',
      lastSync: '2026-01-02T00:00:00.000Z',
      eventos: [{ id: 'ev_1' }],
    };

    const exported = exportState.createExportableState(state);

    expect(exported.config.localBackupAt).toBeUndefined();
    expect(exported.config.cfUrl).toBeUndefined();
    expect(exported.config.cfToken).toBeUndefined();
    expect(exported.config.cfTokenSaved).toBeUndefined();
    expect(exported.config.cfConflict).toBeUndefined();
    expect(exported.config.cfRemoteUpdatedAt).toBeUndefined();
    expect(exported.config.cfLastSyncAt).toBeUndefined();
    expect(exported.config._lastUpdated).toBeUndefined();
    expect(exported.config.syncMergeConflicts).toBeUndefined();
    expect(exported.driveFileId).toBeUndefined();
    expect(exported.lastSync).toBeUndefined();

    expect(exported.config.cfSyncEnabled).toBe(false);
    expect(exported.config.firestoreSync.enabled).toBe(false);
    expect(exported.config.firestoreSync.mode).toBe('shadow');
    expect(exported.config.keepThis).toBe('value');
    expect(exported.eventos[0].id).toBe('ev_1');
  });

  it('does not mutate the source state', () => {
    const source = {
      schemaVersion: 10,
      config: { cfUrl: 'https://sync.example.com', keepThis: 'value' },
      driveFileId: 'drive-123',
      lastSync: '2026-01-01',
    };

    const exported = exportState.createExportableState(source);

    expect(source.config.cfUrl).toBe('https://sync.example.com');
    expect(source.driveFileId).toBe('drive-123');
    expect(source.lastSync).toBe('2026-01-01');
    expect(exported.config.cfUrl).toBeUndefined();
  });

  it('does not import from ../store.js', () => {
    const source = read('src/js/store/export-state.js');
    expect(source).not.toContain("from '../store.js'");
    expect(source).not.toContain("from '../store.js?v=");
  });

  it('does not use dynamic imports', () => {
    const source = read('src/js/store/export-state.js');
    expect(source).not.toContain('import(');
  });

  it('imports deepClone from normalize-state.js and DEFAULT_FIRESTORE_SYNC_CONFIG from indexeddb.js', () => {
    const source = read('src/js/store/export-state.js');
    expect(source).toContain("from './normalize-state.js'");
    expect(source).toContain("from './indexeddb.js'");
  });
});

describe('store.js - Re-export facade', () => {
  it('re-exports normalization symbols from normalize-state.js (same binding)', () => {
    expect(store.createLocalStateEnvelope).toBe(normalizeState.createLocalStateEnvelope);
    expect(store.isLocalStateEnvelopeValid).toBe(normalizeState.isLocalStateEnvelopeValid);
    expect(store.pickRecoverableLocalState).toBe(normalizeState.pickRecoverableLocalState);
  });

  it('exports createExportableState wrapper that defaults to global state', () => {
    store.setState({
      schemaVersion: 10,
      config: { cfUrl: 'https://sync.example.com', keepThis: 'value' },
      driveFileId: 'drive-123',
      eventos: [{ id: 'ev_test' }],
    });

    const exported = store.createExportableState();

    expect(exported.config.cfUrl).toBeUndefined();
    expect(exported.config.keepThis).toBe('value');
    expect(exported.eventos[0].id).toBe('ev_test');
    expect(exported.driveFileId).toBeUndefined();
  });

  it('createExportableState accepts explicit sourceState parameter', () => {
    const customState = {
      schemaVersion: 10,
      config: { cfToken: 'secret' },
    };

    const exported = store.createExportableState(customState);

    expect(exported.config.cfToken).toBeUndefined();
  });

  it('does not use dynamic imports', () => {
    const source = read('src/js/store.js');
    expect(source).not.toContain('import(');
  });

  it('does not have static imports from store/ sub-modules using ../store.js', () => {
    // store.js imports from its sub-modules using relative sub-module paths, not circular
    const source = read('src/js/store.js');
    // Verify it imports from ./store/sub-module paths (not from ./store.js)
    expect(source).toContain("from './store/normalize-state.js'");
    expect(source).toContain("from './store/export-state.js'");
    expect(source).toContain("from './store/indexeddb.js'");
    expect(source).toContain("from './store/migrations.js'");
  });
});
