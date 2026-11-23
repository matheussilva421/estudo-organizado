// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento } from '../helpers/state-builders.js';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';
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
  firestore_outbox: 'id', firestore_meta: 'id', firestore_conflicts: 'id',
  entity_meta: 'key', firestore_entity_outbox: 'id', reta_final_drafts: 'draftId',
  reta_final_journal: 'id', v1_local_state: 'key', v1_sync_outbox: 'opId',
  v1_entity_meta: 'key', v1_sync_conflicts: 'key', v1_sync_meta: 'key',
};

const UID = 'uid_tombstone';
const GENERATION = 'gen_tombstone';
const EVENT_ID = 'ev_terminal';

function createDatabase() {
  const idb = createTransactionalIdb({
    stores: Object.fromEntries(STORES.map((name) => [name, {}])),
    keyPaths: KEY_PATHS,
    version: 8,
  });
  globalThis.indexedDB = idb.indexedDB;
  return idb;
}

function item(title, overrides = {}) {
  return {
    key: `evento:${EVENT_ID}`,
    entityType: 'evento',
    entityId: EVENT_ID,
    path: ['eventos', 0],
    data: createEvento({ id: EVENT_ID, titulo: title, ...overrides }),
  };
}

function remoteUpsert(value, revision) {
  const data = encodeRecordData(value);
  return {
    schemaVersion: 1,
    generationId: GENERATION,
    entityType: 'evento',
    entityId: EVENT_ID,
    collection: 'eventos',
    revision,
    baseRevision: revision - 1,
    opId: `remote_update_${revision}`,
    opDigest: sha256Utf8(data),
    deleted: false,
    data,
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
  };
}

function remoteDelete(revision) {
  return {
    schemaVersion: 1,
    generationId: GENERATION,
    entityType: 'evento',
    entityId: EVENT_ID,
    collection: 'eventos',
    revision,
    baseRevision: revision - 1,
    opId: `remote_delete_${revision}`,
    opDigest: sha256Utf8('null'),
    deleted: true,
    data: null,
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
  };
}

function receiptFor(operation) {
  return {
    schemaVersion: 1,
    generationId: operation.generationId,
    entityType: operation.entityType,
    entityId: operation.entityId,
    collection: operation.collection,
    revision: operation.revision,
    baseRevision: operation.baseRevision,
    opId: operation.opId,
    opDigest: operation.opDigest,
    deleted: operation.action === 'delete',
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
  };
}

async function importLocal() {
  vi.resetModules();
  return import('../../src/js/sync/v1-next/local.js');
}

async function seed(local) {
  const baseline = createBaseState({
    schemaVersion: 12,
    syncTombstones: [{ col: 'eventos', id: 'historic-a', deletedAt: null }],
    config: {
      ...createBaseState().config,
      entityTombstones: [{ col: 'eventos', id: 'historic-b', deletedAt: null }],
    },
  });
  const draft = convertBackupV12(baseline).manifestDraft;
  await local.installRemoteBaseline({
    uid: UID,
    generationId: GENERATION,
    state: baseline,
    manifest: {
      schemaVersion: 1,
      generationId: GENERATION,
      migrationId: 'migration_tombstone',
      state: 'verified',
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: draft.businessDigest,
      counts: draft.counts,
      updatedAt: { seconds: 1800000000, nanoseconds: 0 },
    },
  });
  const remoteState = createBaseState({
    schemaVersion: 12,
    eventos: [createEvento({ id: EVENT_ID, titulo: 'Base' })],
    syncTombstones: baseline.syncTombstones,
    config: baseline.config,
  });
  const { records } = convertBackupV12(remoteState);
  const root = records.meta.find((record) => record.key === 'meta:$root');
  const rootData = encodeRecordData(root);
  await local.applyRemoteRecord({
    uid: UID,
    generationId: GENERATION,
    record: {
      schemaVersion: 1,
      generationId: GENERATION,
      entityType: 'meta',
      entityId: '$root',
      collection: 'meta',
      revision: 1,
      baseRevision: 0,
      opId: 'remote_root_1',
      opDigest: sha256Utf8(rootData),
      deleted: false,
      data: rootData,
      updatedAt: { seconds: 1800000000, nanoseconds: 0 },
    },
  });
  await local.applyRemoteRecord({ uid: UID, generationId: GENERATION, record: remoteUpsert(item('Base'), 1) });
  await local.commitLocalChange({
    uid: UID,
    generationId: GENERATION,
    nextState: createBaseState({
      schemaVersion: 12,
      eventos: [createEvento({ id: EVENT_ID, titulo: 'Local edit' })],
      syncTombstones: baseline.syncTombstones,
      config: baseline.config,
    }),
  });
  const pending = (await local.getPendingOperations(UID, GENERATION))
    .find((operation) => operation.entityId === EVENT_ID);
  expect(pending).toMatchObject({ baseRevision: 1, revision: 2 });
  return pending;
}

beforeEach(() => {
  globalThis.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('V1 terminal tombstones', () => {
  it('rejects stale local and merged resolutions and resolves remote to the terminal revision', async () => {
    createDatabase();
    const local = await importLocal();
    const op = await seed(local);
    const scope = { uid: UID, generationId: GENERATION };
    const conflict = { ...scope, conflictId: op.opId };
    await local.markLocalOperationConflict(op.opId, {
      code: 'revision', remoteRevision: 2, remoteRecord: remoteUpsert(item('Remote'), 2),
    });
    await local.applyRemoteRecord({ ...scope, record: remoteDelete(3) });
    for (const choice of ['local', 'merged']) {
      await expect(local.resolveLocalConflict({ ...conflict, choice, record: item('Stale') }))
        .rejects.toThrow(/tombstone/);
    }
    await local.resolveLocalConflict({ ...conflict, choice: 'remote' });
    expect((await local.readLocalGeneration(UID, GENERATION)).state.eventos).toEqual([]);
    expect(await local.getPendingOperations(UID, GENERATION)).toEqual([]);
  });

  it.each([['other_uid', GENERATION], [UID, 'other_generation']])(
    'ignores a foreign tombstone conflict with the same ID in %s/%s', async (uid, generationId) => {
      const idb = createDatabase();
      const local = await importLocal();
      const op = await seed(local);
      const key = local.v1ScopeKey(uid, generationId) + String.fromCharCode(0) + op.opId;
      const foreign = { uid, generationId, key, entityKey: op.entityKey, conflictId: op.opId, status: 'open' };
      idb.setRecord('v1_sync_conflicts', key, foreign);
      await local.applyRemoteRecord({ uid: UID, generationId: GENERATION, record: remoteDelete(2) });
      expect(await local.readLocalConflict(UID, GENERATION, op.opId)).toMatchObject({
        uid: UID, generationId: GENERATION, remoteDeleted: true,
      });
      expect(await local.readLocalConflict(uid, generationId, op.opId)).toEqual(foreign);
    });

  it('wins over a pending edit, preserves both versions and never ACKs the losing update', async () => {
    createDatabase();
    const local = await importLocal();
    const pending = await seed(local);

    await expect(local.applyRemoteRecord({
      uid: UID,
      generationId: GENERATION,
      record: remoteDelete(2),
    })).resolves.toMatchObject({ applied: true, conflict: true });

    const cached = await local.readLocalGeneration(UID, GENERATION);
    expect(cached.state.eventos.some((event) => event.id === EVENT_ID)).toBe(false);
    expect(cached.state.syncTombstones).toEqual([
      expect.objectContaining({ id: 'historic-a' }),
    ]);
    expect(cached.state.config.entityTombstones).toEqual([
      expect.objectContaining({ id: 'historic-b' }),
    ]);
    expect(await local.getPendingOperations(UID, GENERATION)).toEqual([]);
    expect((await local.listLocalConflicts(UID, GENERATION))[0]).toMatchObject({
        opId: pending.opId,
        status: 'open',
        remoteDeleted: true,
        localVersion: expect.objectContaining({ deleted: false }),
        remoteVersion: expect.objectContaining({ deleted: true, data: null }),
    });

    await expect(local.mergeLocalOperationWithRemote(pending.opId, {
      code: 'tombstone', remoteRevision: 2, remoteDeleted: true,
      remoteRecord: remoteDelete(2),
    })).resolves.toMatchObject({ merged: false, reason: 'tombstone' });
    await expect(local.resolveLocalConflict({
      uid: UID,
      generationId: GENERATION,
      conflictId: pending.opId,
      choice: 'local',
    })).rejects.toThrow(/tombstone/i);
  });

  it('does not let an older remote update resurrect a document after the tombstone', async () => {
    createDatabase();
    const local = await importLocal();
    await seed(local);
    await local.applyRemoteRecord({
      uid: UID,
      generationId: GENERATION,
      record: remoteDelete(2),
    });

    await expect(local.applyRemoteRecord({
      uid: UID,
      generationId: GENERATION,
      record: remoteUpsert(item('Old replay'), 1),
    })).resolves.toMatchObject({ applied: false, reason: 'tombstoned' });
    expect((await local.readLocalGeneration(UID, GENERATION)).state.eventos
      .some((event) => event.id === EVENT_ID)).toBe(false);
  });

  it('keeps a stale local commit from recreating the tombstoned entity', async () => {
    createDatabase();
    const local = await importLocal();
    const pending = await seed(local);
    await local.markLocalOperationConflict(pending.opId, {
      code: 'revision', remoteRevision: 2, remoteRecord: remoteDelete(2),
    });
    await local.applyRemoteRecord({
      uid: UID,
      generationId: GENERATION,
      record: remoteDelete(2),
    });

    await local.commitLocalChange({
      uid: UID,
      generationId: GENERATION,
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [createEvento({ id: EVENT_ID, titulo: 'Stale UI' })],
      }),
    });
    expect((await local.readLocalGeneration(UID, GENERATION)).state.eventos
      .some((event) => event.id === EVENT_ID)).toBe(false);
    expect((await local.getPendingOperations(UID, GENERATION))
      .some((operation) => operation.entityId === EVENT_ID)).toBe(false);
    expect(await local.listLocalConflicts(UID, GENERATION)).toEqual([
      expect.objectContaining({ entityId: EVENT_ID, status: 'open' }),
    ]);
  });
});
