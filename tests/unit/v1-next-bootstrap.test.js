import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento } from '../helpers/state-builders.js';
import { createTransactionalIdb, namedError } from './reta-final-draft-idb-helper.js';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import { encodeRecordData } from '../../src/js/sync/v1-next/contracts.js';
import { sha256Utf8 } from '../../src/js/sync/v1-next/sha256.js';

const STORES = [
  'app_state',
  'firestore_outbox',
  'firestore_meta',
  'firestore_conflicts',
  'entity_meta',
  'firestore_entity_outbox',
  'reta_final_drafts',
  'reta_final_journal',
  'v1_local_state',
  'v1_sync_outbox',
  'v1_entity_meta',
  'v1_sync_conflicts',
  'v1_sync_meta',
];

const KEY_PATHS = {
  firestore_outbox: 'id',
  firestore_meta: 'id',
  firestore_conflicts: 'id',
  entity_meta: 'key',
  firestore_entity_outbox: 'id',
  reta_final_drafts: 'draftId',
  reta_final_journal: 'id',
  v1_local_state: 'key',
  v1_sync_outbox: 'opId',
  v1_entity_meta: 'key',
  v1_sync_conflicts: 'key',
  v1_sync_meta: 'key',
};

function createDatabase() {
  const idb = createTransactionalIdb({
    stores: Object.fromEntries(STORES.map((name) => [name, {}])),
    keyPaths: KEY_PATHS,
    version: 8,
  });
  globalThis.indexedDB = idb.indexedDB;
  return idb;
}

function academicState(title = 'Baseline remota') {
  return createBaseState({
    schemaVersion: 12,
    editais: [{
      id: 'ed_1',
      nome: 'Edital sintético',
      cor: '#0f766e',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Disciplina sintética',
        icone: '📚',
        cor: '#0f766e',
        aulas: [],
        assuntos: [],
      }],
    }],
    eventos: [createEvento({ id: 'ev_1', titulo: title })],
  });
}

function baseline(state, generationId = 'gen_a', overrides = {}) {
  const converted = convertBackupV12(state);
  return {
    generationId,
    manifest: {
      schemaVersion: 1,
      generationId,
      migrationId: 'migration_a',
      state: 'active',
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: converted.manifestDraft.businessDigest,
      counts: converted.manifestDraft.counts,
      updatedAt: { seconds: 1800000000, nanoseconds: 0 },
      ...overrides,
    },
    records: Object.values(converted.records).flat(),
  };
}

function remoteBaseline(state, generationId = 'gen_a', manifestOverrides = {}) {
  const value = baseline(state, generationId, manifestOverrides);
  return {
    generationId,
    control: {
      schemaVersion: 1,
      generationId,
      updatedAt: { seconds: 1800000000, nanoseconds: 0 },
    },
    manifest: value.manifest,
    records: value.records,
  };
}

function remoteRecord({ state, generationId = 'gen_a', revision = 1, opId = 'op_remote' }) {
  const item = convertBackupV12(state).records.eventos.find((record) => record.entityId === 'ev_1');
  const data = encodeRecordData(item);
  return {
    schemaVersion: 1,
    generationId,
    entityType: 'evento',
    entityId: 'ev_1',
    collection: 'eventos',
    revision,
    baseRevision: revision - 1,
    opId,
    opDigest: sha256Utf8(data),
    deleted: false,
    data,
    updatedAt: { seconds: 1800000000 + revision, nanoseconds: 0 },
  };
}

async function importModules() {
  vi.resetModules();
  const local = await import('../../src/js/sync/v1-next/local.js');
  const bootstrap = await import('../../src/js/sync/v1-next/bootstrap.js');
  return { local, bootstrap };
}

function fakeRemote(current, records = current.records) {
  return {
    getCurrentGeneration: vi.fn(async () => current),
    fetchGenerationRecords: vi.fn(async () => ({
      generationId: current.generationId,
      manifest: current.manifest,
      records,
    })),
  };
}

beforeEach(() => {
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  globalThis.navigator = { onLine: false };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('V1 next first access bootstrap', () => {
  it('initializes Firebase and T4 before waiting for the restored Auth identity', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const events = [];
    const remote = fakeRemote(remoteBaseline(academicState('Auth restaurada')));
    const getCurrentGeneration = remote.getCurrentGeneration;
    remote.getCurrentGeneration = vi.fn(async (uid) => {
      events.push(`generation:${uid}`);
      return getCurrentGeneration(uid);
    });
    const storage = {
      getItem: vi.fn((key) => key === 'estudo_v1_sync_enabled' ? 'true' :
        key === 'estudo_v1_sync_uid' ? 'uid_from_storage' : null),
    };

    const result = await bootstrap.bootstrapConfiguredV1Generation({
      windowRef: {},
      storage,
      initFirebaseServices: vi.fn(() => {
        events.push('services');
        return { configured: true, db: { name: 'db' }, auth: { currentUser: null } };
      }),
      wireFirestores: vi.fn(() => {
        events.push('wire');
      }),
      firestoreSdk: {},
      observeFirebaseAuth: vi.fn((callback) => {
        events.push('observe');
        globalThis.queueMicrotask(() => callback({ uid: 'uid_restored' }));
        return vi.fn();
      }),
      remoteApi: remote,
      online: true,
      local,
    });

    expect(result).toMatchObject({ enabled: true, status: 'ready', source: 'network' });
    expect(events).toEqual([
      'services',
      'wire',
      'observe',
      'generation:uid_restored',
    ]);
    expect(remote.getCurrentGeneration).not.toHaveBeenCalledWith('uid_from_storage');
  });

  it('blocks instead of falling back to a storage UID when Auth has no user', async () => {
    const { bootstrap } = await importModules();
    const observeFirebaseAuth = vi.fn((callback) => {
      globalThis.queueMicrotask(() => callback(null));
      return vi.fn();
    });

    const result = await bootstrap.bootstrapConfiguredV1Generation({
      windowRef: {},
      storage: {
        getItem: vi.fn((key) => key === 'estudo_v1_sync_enabled' ? 'true' :
          key === 'estudo_v1_sync_uid' ? 'uid_from_storage' : null),
      },
      initFirebaseServices: vi.fn(() => ({
        configured: true,
        db: { name: 'db' },
        auth: { currentUser: null },
      })),
      wireFirestores: vi.fn(),
      firestoreSdk: {},
      observeFirebaseAuth,
      online: true,
    });

    expect(result).toEqual({
      enabled: true,
      status: 'blocked',
      reason: 'V1_AUTH_REQUIRED',
    });
    expect(observeFirebaseAuth).toHaveBeenCalledOnce();
  });

  it('opens a verified UID generation from cache without touching the network', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const remote = fakeRemote(remoteBaseline(academicState('Cache verificada')));
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_cache',
      online: true,
      remoteApi: remote,
    });
    remote.getCurrentGeneration.mockClear();
    remote.fetchGenerationRecords.mockClear();

    const result = await bootstrap.bootstrapV1Generation({
      uid: 'uid_cache',
      online: false,
      remoteApi: remote,
    });

    expect(result).toMatchObject({
      status: 'ready',
      generationId: 'gen_a',
      source: 'cache',
    });
    expect(result.state.eventos[0].titulo).toBe('Cache verificada');
    expect(remote.getCurrentGeneration).not.toHaveBeenCalled();
    expect(remote.fetchGenerationRecords).not.toHaveBeenCalled();
    expect(local.getActiveV1Context()).toEqual({ uid: 'uid_cache', generationId: 'gen_a' });
  });

  it('does not reuse a cache owned by another UID or select an unpointed generation', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const remote = fakeRemote(remoteBaseline(academicState('UID A')));
    await local.commitLocalChange({
      uid: 'uid_a',
      generationId: 'gen_other',
      nextState: academicState('Geração vizinha'),
    });
    await bootstrap.bootstrapV1Generation({ uid: 'uid_a', online: true, remoteApi: remote });

    const otherUid = await bootstrap.bootstrapV1Generation({
      uid: 'uid_b',
      online: false,
      remoteApi: fakeRemote(remoteBaseline(academicState('UID B'), 'gen_b')),
    });
    const pointed = await bootstrap.bootstrapV1Generation({
      uid: 'uid_a',
      online: false,
      remoteApi: remote,
    });

    expect(otherUid).toEqual({ status: 'requires-network' });
    expect(pointed).toMatchObject({ status: 'ready', generationId: 'gen_a' });
    expect(pointed.state.eventos[0].titulo).toBe('UID A');
  });

  it('requires network when only legacy local state exists offline', async () => {
    const idb = createDatabase();
    idb.setRecord('app_state', 'main_state', { eventos: [{ id: 'legacy' }] });
    const { local, bootstrap } = await importModules();

    const result = await bootstrap.bootstrapV1Generation({ uid: 'uid_offline', online: false });

    expect(result).toEqual({ status: 'requires-network' });
    expect(idb.getRecord('app_state', 'main_state')).toEqual({ eventos: [{ id: 'legacy' }] });
    expect(await local.readV1GenerationPointer('uid_offline')).toBeNull();
  });

  it('downloads, validates, reconstructs and atomically installs the first baseline', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const remote = fakeRemote(remoteBaseline(academicState('Primeiro acesso')));

    const result = await bootstrap.bootstrapV1Generation({
      uid: 'uid_online',
      online: true,
      remoteApi: remote,
    });

    expect(result).toMatchObject({ status: 'ready', source: 'network' });
    expect(result.state.eventos[0].titulo).toBe('Primeiro acesso');
    expect(await local.getPendingOperations('uid_online', 'gen_a')).toEqual([]);
    expect(await local.readV1GenerationPointer('uid_online')).toMatchObject({
      generationId: 'gen_a',
      status: 'ready',
      verified: true,
    });
  });

  it('accepts a verified manifest while first installing a generation', async () => {
    createDatabase();
    const { bootstrap } = await importModules();
    const current = remoteBaseline(
      academicState('Manifesto verificado'),
      'gen_verified',
      { state: 'verified' },
    );

    const result = await bootstrap.bootstrapV1Generation({
      uid: 'uid_verified',
      online: true,
      remoteApi: fakeRemote(current),
    });

    expect(result).toMatchObject({
      status: 'ready',
      generationId: 'gen_verified',
      source: 'network',
    });
  });

  it('keeps legacy data and exposes no pointer after a partial baseline write fails', async () => {
    const idb = createDatabase();
    idb.setRecord('app_state', 'main_state', { eventos: [{ id: 'legacy-safe' }] });
    const { local, bootstrap } = await importModules();
    idb.failNextWriteInStore('v1_local_state', namedError('QuotaExceededError'));

    const result = await bootstrap.bootstrapV1Generation({
      uid: 'uid_partial',
      online: true,
      remoteApi: fakeRemote(remoteBaseline(academicState('Não pode aparecer'))),
    });

    expect(result.status).toBe('blocked');
    expect(await local.readV1GenerationPointer('uid_partial')).toBeNull();
    expect(await local.readLocalGeneration('uid_partial', 'gen_a')).toBeNull();
    expect(idb.getRecord('app_state', 'main_state')).toEqual({ eventos: [{ id: 'legacy-safe' }] });
  });

  it.each([
    ['business digest', { businessDigest: 'b'.repeat(64) }],
    ['counts', { counts: { total: 99, byCollection: {
      editais: 99, disciplinas: 0, eventos: 0, habitos: 0, retaFinalBlocos: 0, meta: 0,
      tombstones: 0,
    } } }],
    ['state', { state: 'staging' }],
  ])('rejects a baseline with invalid %s', async (_name, overrides) => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const current = remoteBaseline(academicState(), 'gen_invalid', overrides);

    const result = await bootstrap.bootstrapV1Generation({
      uid: 'uid_invalid',
      online: true,
      remoteApi: fakeRemote(current),
    });

    expect(result.status).toBe('blocked');
    expect(await local.readV1GenerationPointer('uid_invalid')).toBeNull();
  });

  it('blocks a revoked generation and rejects local uploads while preserving pending work', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const remote = fakeRemote(remoteBaseline(academicState('Antes da revogação')));
    await bootstrap.bootstrapV1Generation({ uid: 'uid_revoked', online: true, remoteApi: remote });
    const cached = await local.readLocalGeneration('uid_revoked', 'gen_a');
    await local.commitLocalChange({
      uid: 'uid_revoked',
      generationId: 'gen_a',
      nextState: {
        ...cached.state,
        eventos: [createEvento({ id: 'ev_1', titulo: 'Pendente local' })],
      },
    });
    const pendingBefore = await local.getPendingOperations('uid_revoked', 'gen_a');
    const revokedRemote = {
      getCurrentGeneration: vi.fn(async () => {
        throw Object.assign(new Error('inactive'), {
          code: 'V1_REMOTE_GENERATION_INACTIVE',
        });
      }),
    };

    const result = await bootstrap.revalidateV1Generation({
      uid: 'uid_revoked',
      online: true,
      remoteApi: revokedRemote,
    });

    expect(result.status).toBe('blocked');
    expect((await local.readV1GenerationPointer('uid_revoked')).status).toBe('blocked');
    expect(local.getActiveV1Context()).toBeNull();
    await expect(local.commitLocalChange({
      uid: 'uid_revoked',
      generationId: 'gen_a',
      nextState: cached.state,
    })).rejects.toThrow(/blocked|active/i);
    expect(await local.getPendingOperations('uid_revoked', 'gen_a')).toEqual(pendingBefore);
  });

  it('revalidates an online cache in the background without delaying the cached open', async () => {
    createDatabase();
    const { bootstrap } = await importModules();
    const current = remoteBaseline(academicState('Cache revalidada'));
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_background',
      online: true,
      remoteApi: fakeRemote(current),
    });
    const remote = fakeRemote(current);
    const onBackgroundResult = vi.fn();

    const cached = await bootstrap.bootstrapV1Generation({
      uid: 'uid_background',
      online: true,
      remoteApi: remote,
      onBackgroundResult,
    });

    expect(cached).toMatchObject({ status: 'ready', source: 'cache' });
    expect(remote.getCurrentGeneration).not.toHaveBeenCalled();
    await expect(cached.backgroundValidation).resolves.toMatchObject({ status: 'ready' });
    expect(remote.getCurrentGeneration).toHaveBeenCalledWith('uid_background');
    expect(onBackgroundResult).toHaveBeenCalledWith({ status: 'ready', generationId: 'gen_a' });
  });

  it('surfaces a generation revoked during background revalidation', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const current = remoteBaseline(academicState('Será revogada'));
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_background_revoked',
      online: true,
      remoteApi: fakeRemote(current),
    });
    const onBackgroundResult = vi.fn();
    const revoked = {
      getCurrentGeneration: vi.fn(async () => {
        throw Object.assign(new Error('inactive'), {
          code: 'V1_REMOTE_GENERATION_INACTIVE',
        });
      }),
    };

    const cached = await bootstrap.bootstrapV1Generation({
      uid: 'uid_background_revoked',
      online: true,
      remoteApi: revoked,
      onBackgroundResult,
    });

    expect(cached).toMatchObject({ status: 'ready', source: 'cache' });
    await expect(cached.backgroundValidation).resolves.toMatchObject({
      status: 'blocked',
      reason: 'V1_REMOTE_GENERATION_INACTIVE',
    });
    expect(onBackgroundResult).toHaveBeenCalledWith({
      status: 'blocked',
      reason: 'V1_REMOTE_GENERATION_INACTIVE',
    });
    expect((await local.readV1GenerationPointer('uid_background_revoked')).status).toBe('blocked');
  });

  it('applies a validated delta idempotently without creating outbox work', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const initial = academicState('Base');
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_delta',
      online: true,
      remoteApi: fakeRemote(remoteBaseline(initial)),
    });
    const nextRemote = academicState('Remoto');
    const record = remoteRecord({ state: nextRemote });
    const delta = { collection: 'eventos', entityId: 'ev_1', record, changeType: 'modified' };

    await bootstrap.reconcileRemoteDelta(delta);
    await bootstrap.reconcileRemoteDelta(delta);

    expect((await local.readLocalGeneration('uid_delta', 'gen_a')).state.eventos[0].titulo)
      .toBe('Remoto');
    expect(await local.getPendingOperations('uid_delta', 'gen_a')).toEqual([]);
  });

  it('preserves a pending local entity when the remote delta arrives', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const initial = academicState('Base');
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_pending',
      online: true,
      remoteApi: fakeRemote(remoteBaseline(initial)),
    });
    const localState = academicState('Edição local pendente');
    await local.commitLocalChange({
      uid: 'uid_pending',
      generationId: 'gen_a',
      nextState: localState,
    });
    const pendingBefore = await local.getPendingOperations('uid_pending', 'gen_a');
    const record = remoteRecord({
      state: academicState('Remoto não deve vencer'),
      revision: 2,
      opId: 'op_remote_2',
    });

    await bootstrap.reconcileRemoteDelta({ collection: 'eventos', entityId: 'ev_1', record });
    await bootstrap.reconcileRemoteDelta({ collection: 'eventos', entityId: 'ev_1', record });

    expect((await local.readLocalGeneration('uid_pending', 'gen_a')).state.eventos[0].titulo)
      .toBe('Edição local pendente');
    expect(await local.getPendingOperations('uid_pending', 'gen_a')).toEqual(pendingBefore);
  });

  it('does not treat a removed document as generation revocation', async () => {
    createDatabase();
    const { local, bootstrap } = await importModules();
    const initial = academicState('Remoção isolada');
    await bootstrap.bootstrapV1Generation({
      uid: 'uid_removed',
      online: true,
      remoteApi: fakeRemote(remoteBaseline(initial)),
    });
    const before = await local.readLocalGeneration('uid_removed', 'gen_a');
    const pointerBefore = await local.readV1GenerationPointer('uid_removed');

    await bootstrap.reconcileRemoteDelta({
      collection: 'eventos',
      entityId: 'ev_1',
      record: null,
      changeType: 'removed',
    });

    expect(await local.readV1GenerationPointer('uid_removed')).toEqual(pointerBefore);
    expect(await local.readLocalGeneration('uid_removed', 'gen_a')).toEqual(before);
    expect(local.getActiveV1Context()).toEqual({ uid: 'uid_removed', generationId: 'gen_a' });
  });

  it('runs the gate before storage schema work and never loads legacy before readiness', async () => {
    const { bootstrap } = await importModules();
    const events = [];

    const result = await bootstrap.runV1FirstAccessLifecycle({
      gate: vi.fn((status) => events.push(`gate:${status.status}`)),
      openStorage: vi.fn(async () => events.push('storage')),
      prepare: vi.fn(async () => {
        events.push('prepare');
        return { enabled: true, status: 'requires-network' };
      }),
      initDB: vi.fn(async () => events.push('initDB')),
      applyState: vi.fn(() => events.push('apply')),
      release: vi.fn(() => events.push('release')),
    });

    expect(result).toMatchObject({ status: 'requires-network' });
    expect(events).toEqual([
      'gate:preparing',
      'storage',
      'prepare',
      'gate:requires-network',
    ]);
  });

  it('loads IndexedDB only after a ready generation and applies the verified state', async () => {
    const { bootstrap } = await importModules();
    const events = [];
    const readyState = academicState('Pronto');

    const result = await bootstrap.runV1FirstAccessLifecycle({
      gate: vi.fn((status) => events.push(`gate:${status.status}`)),
      openStorage: vi.fn(async () => events.push('storage')),
      prepare: vi.fn(async () => {
        events.push('prepare');
        return { enabled: true, status: 'ready', generationId: 'gen_a', state: readyState };
      }),
      initDB: vi.fn(async () => events.push('initDB')),
      applyState: vi.fn(() => events.push('apply')),
      release: vi.fn(() => events.push('release')),
    });

    expect(result).toMatchObject({ status: 'ready', generationId: 'gen_a' });
    expect(events).toEqual([
      'gate:preparing',
      'storage',
      'prepare',
      'initDB',
      'apply',
      'release',
    ]);
  });

  it('accepts only an explicit test flag and never enables production by default', async () => {
    const { bootstrap } = await importModules();
    expect(bootstrap.isV1SyncEnabled()).toBe(false);
    globalThis.window.__ESTUDO_V1_SYNC_TEST__ = { enabled: 'true' };
    expect(bootstrap.isV1SyncEnabled()).toBe(false);
    globalThis.window.__ESTUDO_V1_SYNC_TEST__ = { enabled: true, uid: 'uid_configured' };
    expect(bootstrap.isV1SyncEnabled()).toBe(true);
    expect(await bootstrap.bootstrapConfiguredV1Generation({
      remoteApi: fakeRemote(remoteBaseline(academicState('Configurado'))),
      local: (await import('../../src/js/sync/v1-next/local.js')),
      online: false,
    })).toMatchObject({ enabled: true, status: 'requires-network' });
  });

  it('fails closed when the configured test UID is absent', async () => {
    const { bootstrap } = await importModules();
    globalThis.localStorage.getItem.mockImplementation((key) =>
      key === 'estudo_v1_sync_enabled' ? 'true' : null);

    expect(await bootstrap.bootstrapConfiguredV1Generation())
      .toMatchObject({ enabled: true, status: 'blocked' });
  });
});
