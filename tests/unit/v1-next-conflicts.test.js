// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createDisciplina, createEdital, createEvento } from '../helpers/state-builders.js';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import {
  classifyRevisions,
  compareRevisions,
  encodeRecordData,
  mergeIndependentRecords,
} from '../../src/js/sync/v1-next/contracts.js';
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

function eventItem(id, overrides = {}) {
  return {
    key: `evento:${id}`,
    entityType: 'evento',
    entityId: id,
    path: ['eventos', 0],
    data: createEvento({ id, ...overrides }),
  };
}

function remoteRecord(item, revision, overrides = {}) {
  const data = encodeRecordData(item);
  return {
    schemaVersion: 1,
    generationId: 'gen_conflicts',
    entityType: item.entityType,
    entityId: String(item.entityId),
    collection: 'eventos',
    revision,
    baseRevision: revision - 1,
    opId: `remote_${revision}`,
    opDigest: sha256Utf8(data),
    deleted: false,
    data,
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
    ...overrides,
  };
}

function receiptFor(operation, overrides = {}) {
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
    ...overrides,
  };
}

function createDatabase() {
  const idb = createTransactionalIdb({
    stores: Object.fromEntries(STORES.map((name) => [name, {}])),
    keyPaths: KEY_PATHS,
    version: 8,
  });
  globalThis.indexedDB = idb.indexedDB;
  return idb;
}

async function importLocal() {
  vi.resetModules();
  return import('../../src/js/sync/v1-next/local.js');
}

function manifestFor(state) {
  const draft = convertBackupV12(state).manifestDraft;
  return {
    schemaVersion: 1,
    generationId: 'gen_conflicts',
    migrationId: 'migration_conflicts',
    state: 'verified',
    revision: 0,
    sourceSha256: 'a'.repeat(64),
    businessDigest: draft.businessDigest,
    counts: draft.counts,
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
  };
}

async function seedBaseEvent(local, { id = 'ev_conflict', title = 'Base' } = {}) {
  const uid = 'uid_conflicts';
  const generationId = 'gen_conflicts';
  const baseline = createBaseState({ schemaVersion: 12 });
  await local.installRemoteBaseline({
    uid,
    generationId,
    state: baseline,
    manifest: manifestFor(baseline),
  });
  await local.applyRemoteRecord({
    uid,
    generationId,
    record: remoteRecord(eventItem(id, { titulo: title, notas: 'Base notes' }), 1),
  });
  return { uid, generationId, state: baseline };
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

describe('V1 revision classification and field merge', () => {
  it('keeps the T4 comparator and exposes the T7 classification', () => {
    expect([compareRevisions(1, 2), compareRevisions(2, 2), compareRevisions(3, 2)])
      .toEqual([-1, 0, 1]);
    expect(classifyRevisions(1, 1)).toBe('equal');
    expect(classifyRevisions(1, 2)).toBe('advanced');
    expect(classifyRevisions(2, 1)).toBe('conflict');
    expect(classifyRevisions(2, 2, { remoteDeleted: true })).toBe('conflict');
  });

  it('merges only independent fields and rejects the whole record on one divergent field', () => {
    const base = eventItem('ev_merge', { titulo: 'Base', notas: 'Base notes' });
    const local = eventItem('ev_merge', { titulo: 'Local title', notas: 'Base notes' });
    const remote = eventItem('ev_merge', { titulo: 'Base', notas: 'Remote notes' });
    expect(mergeIndependentRecords({ base, local, remote })).toMatchObject({
      merged: true,
      record: { data: { titulo: 'Local title', notas: 'Remote notes' } },
    });

    const divergent = eventItem('ev_merge', { titulo: 'Remote title', notas: 'Base notes' });
    expect(mergeIndependentRecords({ base, local, remote: divergent })).toMatchObject({
      merged: false,
      conflicts: [expect.objectContaining({ path: ['data', 'titulo'] })],
    });
  });
});

describe('V1 local conflict protocol', () => {
  it('reconstructs parent and root records while preserving nested disciplines', async () => {
    createDatabase();
    const local = await importLocal();
    const scope = { uid: 'uid_composite', generationId: 'gen_conflicts' };
    const child = createDisciplina({ id: 'disc_child' });
    const baseline = createBaseState({ schemaVersion: 12, editais: [createEdital({
      id: 'ed_parent', nome: 'Base', disciplinas: [child],
    })] });
    await local.installRemoteBaseline({ ...scope, state: baseline, manifest: manifestFor(baseline) });
    const edited = structuredClone(baseline);
    edited.editais[0].nome = 'Changed';
    edited.extraRootField = 'Root delta';
    const { records } = convertBackupV12(edited);
    for (const record of [records.editais[0], records.meta.find(r => r.key === 'meta:$root')]) {
      await local.applyRemoteRecord({ ...scope, record: remoteRecord(record, 1, {
        collection: record.entityType === 'edital' ? 'editais' : 'meta',
      }) });
    }
    expect((await local.readLocalGeneration(scope.uid, scope.generationId)).state)
      .toMatchObject({ editais: [{ nome: 'Changed', disciplinas: [child] }], extraRootField: 'Root delta' });
  });

  it('rebases an advanced independent edit, updates local state and ACKs the exact revision', async () => {
    createDatabase();
    const local = await importLocal();
    const { uid, generationId } = await seedBaseEvent(local);
    await local.commitLocalChange({
      uid,
      generationId,
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [createEvento({ id: 'ev_conflict', titulo: 'Local title', notas: 'Base notes' })],
      }),
    });
    const pending = (await local.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === 'ev_conflict');
    expect(pending).toMatchObject({ baseRevision: 1, revision: 2 });
    expect(pending.baseRecord).toMatchObject({ data: { titulo: 'Base', notas: 'Base notes' } });

    const remote = remoteRecord(
      eventItem('ev_conflict', { titulo: 'Base', notas: 'Remote notes' }),
      2,
    );
    const merge = await local.mergeLocalOperationWithRemote(pending.opId, {
      code: 'revision',
      remoteRevision: 2,
      remoteRecord: remote,
    });
    expect(merge).toMatchObject({
      merged: true,
      operation: {
        opId: pending.opId,
        baseRevision: 2,
        revision: 3,
        data: { titulo: 'Local title', notas: 'Remote notes' },
      },
    });
    expect((await local.readLocalGeneration(uid, generationId)).state.eventos[0])
      .toMatchObject({ titulo: 'Local title', notas: 'Remote notes' });
    expect(await local.listLocalConflicts(uid, generationId)).toEqual([]);

    await local.ackLocalOperation(pending.opId, receiptFor(merge.operation));
    expect((await local.getLocalSyncStatus(uid, generationId))).toMatchObject({
      pending: 0,
      conflicts: 0,
      acked: 1,
    });
  });

  it('persists full recoverable versions, isolates the entity and resolves idempotently', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const { uid, generationId } = await seedBaseEvent(local);
    await local.commitLocalChange({
      uid,
      generationId,
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [
          createEvento({ id: 'ev_conflict', titulo: 'Local title', notas: 'Base notes' }),
          createEvento({ id: 'ev_healthy', titulo: 'Healthy' }),
        ],
      }),
    });
    const operations = await local.getPendingOperations(uid, generationId);
    const pending = operations.find((operation) => operation.entityId === 'ev_conflict');
    const remote = remoteRecord(
      eventItem('ev_conflict', { titulo: 'Remote title', notas: 'Base notes' }),
      2,
    );
    expect(await local.mergeLocalOperationWithRemote(pending.opId, {
      code: 'revision',
      remoteRevision: 2,
      remoteRecord: remote,
    })).toMatchObject({ merged: false });
    await local.markLocalOperationConflict(pending.opId, {
      code: 'revision',
      remoteRevision: 2,
      remoteRecord: remote,
    });

    const conflicts = await local.listLocalConflicts(uid, generationId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      uid,
      generationId,
      entityType: 'evento',
      entityId: 'ev_conflict',
      opId: pending.opId,
      base: 1,
      local: 2,
      remote: 2,
      status: 'open',
      baseVersion: { data: { titulo: 'Base', notas: 'Base notes' } },
      localVersion: { data: { titulo: 'Local title', notas: 'Base notes' } },
      remoteVersion: { data: { titulo: 'Remote title', notas: 'Base notes' } },
    });
    expect((await local.getPendingOperations(uid, generationId))
      .every((operation) => operation.entityId !== 'ev_conflict')).toBe(true);
    expect((await local.getPendingOperations(uid, generationId))
      .some((operation) => operation.entityId === 'ev_healthy')).toBe(true);

    const resolved = await local.resolveLocalConflict({
      uid,
      generationId,
      conflictId: pending.opId,
      choice: 'local',
    });
    expect(resolved).toMatchObject({
      status: 'pending',
      operation: { baseRevision: 2, revision: 3, data: { titulo: 'Local title' } },
    });
    const repeated = await local.resolveLocalConflict({
      uid,
      generationId,
      conflictId: pending.opId,
      choice: 'local',
    });
    expect(repeated).toMatchObject({ idempotent: true, status: 'pending' });
    const revived = (await local.getPendingOperations(uid, generationId))
      .filter((operation) => operation.opId === pending.opId);
    expect(revived).toHaveLength(1);
    expect(idb.getRecord('v1_sync_conflicts', conflicts[0].key)).toMatchObject({
      status: 'resolved',
      resolution: { choice: 'local' },
    });
    await local.ackLocalOperation(pending.opId, receiptFor(revived[0]));
    expect(idb.getRecord('v1_sync_outbox', pending.opId)).toMatchObject({
      status: 'acked',
      baseRevision: 2,
      revision: 3,
    });
  });

  it('does not share pending operations or conflicts across accounts', async () => {
    createDatabase();
    const local = await importLocal();
    const { uid } = await seedBaseEvent(local);
    await local.commitLocalChange({
      uid,
      generationId: 'gen_conflicts',
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [createEvento({ id: 'ev_conflict', titulo: 'Local title' })],
      }),
    });
    await local.commitLocalChange({
      uid: 'uid_other',
      generationId: 'gen_other',
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [createEvento({ id: 'ev_other', titulo: 'Other' })],
      }),
    });
    expect((await local.getPendingOperations('uid_other', 'gen_other'))[0].entityId)
      .toBe('ev_other');
    expect(await local.listLocalConflicts('uid_other', 'gen_other')).toEqual([]);
    expect((await local.getPendingOperations(uid, 'gen_conflicts'))[0].uid).toBe(uid);
  });

  it('accepts one explicit merged revision and rejects a different second resolution', async () => {
    createDatabase();
    const local = await importLocal();
    const { uid, generationId } = await seedBaseEvent(local);
    await local.commitLocalChange({
      uid,
      generationId,
      nextState: createBaseState({
        schemaVersion: 12,
        eventos: [createEvento({ id: 'ev_conflict', titulo: 'Local title', notas: 'Base notes' })],
      }),
    });
    const pending = (await local.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === 'ev_conflict');
    await local.markLocalOperationConflict(pending.opId, {
      code: 'revision',
      remoteRevision: 2,
      remoteRecord: remoteRecord(
        eventItem('ev_conflict', { titulo: 'Remote title', notas: 'Base notes' }),
        2,
      ),
    });
    const merged = eventItem('ev_conflict', {
      titulo: 'Manual merge',
      notas: 'Base notes',
    });
    const first = await local.resolveLocalConflict({
      uid,
      generationId,
      conflictId: pending.opId,
      choice: 'merged',
      record: merged,
    });
    expect(first).toMatchObject({
      status: 'pending',
      operation: { baseRevision: 2, revision: 3, data: merged.data },
    });
    await expect(local.resolveLocalConflict({
      uid,
      generationId,
      conflictId: pending.opId,
      choice: 'merged',
      record: merged,
    })).resolves.toMatchObject({ idempotent: true, status: 'pending' });
    await expect(local.resolveLocalConflict({
      uid,
      generationId,
      conflictId: pending.opId,
      choice: 'local',
    })).rejects.toThrow(/resolved differently/);
    await local.ackLocalOperation(pending.opId, receiptFor(first.operation));
    expect(await local.getLocalSyncStatus(uid, generationId)).toMatchObject({
      pending: 0,
      conflicts: 0,
      acked: 1,
    });
  });
});
