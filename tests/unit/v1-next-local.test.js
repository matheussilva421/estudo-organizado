import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createDisciplina, createEdital, createEvento } from '../helpers/state-builders.js';
import { createTransactionalIdb, namedError } from './reta-final-draft-idb-helper.js';
import { encodeRecordData, validateRecord } from '../../src/js/sync/v1-next/contracts.js';
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

function academicState(overrides = {}) {
  return createBaseState({ schemaVersion: 12, ...overrides });
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

function materializeOperation(operation) {
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
    data: operation.action === 'delete' ? null : operation.dataText,
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
  };
}

async function importLocal() {
  vi.resetModules();
  return import('../../src/js/sync/v1-next/local.js');
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
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  globalThis.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('v1-next local persistence', () => {
  it('preserves academic state and outbox together and isolates UID and generation', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const stateA = academicState({ eventos: [createEvento({ id: 'ev_a', titulo: 'A' })] });
    const stateB = academicState({ eventos: [createEvento({ id: 'ev_b', titulo: 'B' })] });
    const stateA2 = academicState({ eventos: [createEvento({ id: 'ev_a2', titulo: 'A2' })] });

    await local.commitLocalChange({ uid: 'uid_a', generationId: 'gen_a', nextState: stateA });
    await local.commitLocalChange({ uid: 'uid_b', generationId: 'gen_b', nextState: stateB });
    await local.commitLocalChange({ uid: 'uid_a', generationId: 'gen_a2', nextState: stateA2 });
    await local.setLocalGenerationVerified('uid_a', 'gen_a', true);

    expect((await local.readLocalGeneration('uid_a', 'gen_a')).state.eventos[0].id).toBe('ev_a');
    expect((await local.readLocalGeneration('uid_a', 'gen_a')).verified).toBe(true);
    expect((await local.readLocalGeneration('uid_b', 'gen_b')).verified).toBe(false);
    expect((await local.readLocalGeneration('uid_b', 'gen_b')).state.eventos[0].id).toBe('ev_b');
    expect((await local.readLocalGeneration('uid_a', 'gen_a2')).state.eventos[0].id).toBe('ev_a2');
    const pendingA = await local.getPendingOperations('uid_a', 'gen_a');
    const pendingB = await local.getPendingOperations('uid_b', 'gen_b');
    expect(pendingA.every((operation) => operation.uid === 'uid_a' && operation.generationId === 'gen_a'))
      .toBe(true);
    expect(pendingB.every((operation) => operation.uid === 'uid_b' && operation.generationId === 'gen_b'))
      .toBe(true);
    expect(pendingA.some((operation) => operation.entityId === 'ev_b')).toBe(false);
    expect(idb.storeNames()).toContain('v1_local_state');
  });

  it('fails closed for invalid scope and rolls back state plus outbox on quota failure', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const first = academicState({ eventos: [createEvento({ id: 'ev_atomic', titulo: 'Antes' })] });
    await local.commitLocalChange({ uid: 'uid_atomic', generationId: 'gen_atomic', nextState: first });
    const before = await local.readLocalGeneration('uid_atomic', 'gen_atomic');
    const beforeOps = await local.getPendingOperations('uid_atomic', 'gen_atomic');
    const next = academicState({ eventos: [createEvento({ id: 'ev_atomic', titulo: 'Depois' })] });
    idb.failNextWriteInStore('v1_sync_outbox', namedError('QuotaExceededError'));

    await expect(local.commitLocalChange({
      uid: 'uid_atomic',
      generationId: 'gen_atomic',
      nextState: next,
    })).rejects.toMatchObject({ name: 'QuotaExceededError' });

    expect(await local.readLocalGeneration('uid_atomic', 'gen_atomic')).toStrictEqual(before);
    expect(await local.getPendingOperations('uid_atomic', 'gen_atomic')).toStrictEqual(beforeOps);
    await expect(local.readLocalGeneration('', 'gen_atomic')).rejects.toThrow();
    await expect(local.readLocalGeneration('uid_atomic', '../gen')).rejects.toThrow();
  });

  it('recovers pending operations after a module reload', async () => {
    createDatabase();
    const firstImport = await importLocal();
    await firstImport.commitLocalChange({
      uid: 'uid_reload',
      generationId: 'gen_reload',
      nextState: academicState({ eventos: [createEvento({ id: 'ev_reload' })] }),
    });

    const reloaded = await importLocal();
    const pending = await reloaded.getPendingOperations('uid_reload', 'gen_reload');
    expect(pending.find((operation) => operation.entityId === 'ev_reload'))
      .toMatchObject({ entityType: 'evento', entityId: 'ev_reload', status: 'pending' });
  });

  it('cancels a base-zero creation before ACK and emits a valid delete after ACK', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const uid = 'uid_create_delete';
    const generationId = 'gen_create_delete';
    const entityId = 'ev_create_delete';
    const initial = academicState({ eventos: [createEvento({ id: entityId, titulo: 'Novo' })] });

    await local.commitLocalChange({ uid, generationId, nextState: initial });
    const created = (await local.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === entityId);
    expect(created).toMatchObject({ action: 'upsert', baseRevision: 0, revision: 1 });

    await local.commitLocalChange({
      uid,
      generationId,
      nextState: academicState({ eventos: [] }),
    });

    const metaKey = local.v1EntityMetaKey(uid, generationId, `evento:${entityId}`);
    expect((await local.getPendingOperations(uid, generationId))
      .filter((operation) => operation.entityId === entityId)).toEqual([]);
    expect(idb.getRecord('v1_sync_outbox', created.opId)).toBeUndefined();
    expect(idb.getRecord('v1_entity_meta', metaKey)).toBeUndefined();
    expect((await local.readLocalGeneration(uid, generationId)).state.eventos)
      .not.toContainEqual(expect.objectContaining({ id: entityId }));

    await local.commitLocalChange({ uid, generationId, nextState: initial });
    const recreated = (await local.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === entityId);
    await local.ackLocalOperation(recreated.opId, receiptFor(recreated));

    await local.commitLocalChange({
      uid,
      generationId,
      nextState: academicState({ eventos: [] }),
    });
    const finalOperation = (await local.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === entityId);
    expect(finalOperation).toMatchObject({ action: 'delete', baseRevision: 1, revision: 2 });
    expect(validateRecord(materializeOperation(finalOperation))).toBe(true);
    expect(idb.getRecord('v1_sync_outbox', finalOperation.opId)).toMatchObject({
      action: 'delete',
      baseRevision: 1,
      revision: 2,
    });
  });

  it('allocates opIds against the complete outbox across UIDs and generations', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const eventA = 'ev_op_scope_a';
    const eventB = 'ev_op_scope_b';

    await local.commitLocalChange({
      uid: 'uid_a',
      generationId: 'gen_a',
      nextState: academicState({ eventos: [createEvento({ id: eventA })] }),
    });
    await local.commitLocalChange({
      uid: 'uid_b',
      generationId: 'gen_b',
      nextState: academicState({ eventos: [createEvento({ id: eventB })] }),
    });
    const operationA = (await local.getPendingOperations('uid_a', 'gen_a'))
      .find((operation) => operation.entityId === eventA);
    const randomUUID = vi.fn()
      .mockReturnValueOnce(operationA.opId.slice('op_'.length))
      .mockReturnValueOnce('uid-b-generation-fresh');
    vi.stubGlobal('crypto', { randomUUID });

    await local.commitLocalChange({
      uid: 'uid_b',
      generationId: 'gen_b',
      nextState: academicState({
        eventos: [createEvento({ id: eventB }), createEvento({ id: 'ev_op_b_new' })],
      }),
    });

    const operationB = (await local.getPendingOperations('uid_b', 'gen_b'))
      .find((operation) => operation.entityId === 'ev_op_b_new');
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(operationB.opId).toBe('op_uid-b-generation-fresh');
    expect(idb.getRecord('v1_sync_outbox', operationA.opId)).toMatchObject({
      uid: 'uid_a',
      entityId: eventA,
    });
    expect(idb.getRecord('v1_sync_outbox', operationB.opId)).toMatchObject({
      uid: 'uid_b',
      entityId: 'ev_op_b_new',
    });
  });

  it('cancels an unacknowledged creation through the central save path', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const store = await import('../../src/js/store.js?v=8.37');
    const uid = 'uid_central_cancel';
    const generationId = 'gen_central_cancel';
    const entityId = 'ev_central_cancel';
    await store.initDB();
    store.setActiveV1Context(uid, generationId);

    store.setState(academicState({ eventos: [createEvento({ id: entityId })] }));
    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });
    const created = (await store.getPendingOperations(uid, generationId))
      .find((operation) => operation.entityId === entityId);

    store.setState(academicState({ eventos: [] }));
    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });

    const metaKey = local.v1EntityMetaKey(uid, generationId, `evento:${entityId}`);
    expect((await store.getPendingOperations(uid, generationId))
      .filter((operation) => operation.entityId === entityId)).toEqual([]);
    expect(idb.getRecord('v1_sync_outbox', created.opId)).toBeUndefined();
    expect(idb.getRecord('v1_entity_meta', metaKey)).toBeUndefined();
    expect((await store.readLocalGeneration(uid, generationId)).state.eventos).toEqual([]);
  });

  it('derives every academic entity family with stable T1 paths and digests', async () => {
    createDatabase();
    const local = await importLocal();
    const state = academicState({
      editais: [createEdital({
        id: 'ed_family',
        metadataDesconhecida: { fonte: 'sintetica' },
        disciplinas: [createDisciplina({
          id: 'disc_family',
          assuntos: [{ id: 'assunto_family', nome: 'Assunto' }],
          aulas: [{ id: 'aula_family', nome: 'Aula' }],
        })],
      })],
      eventos: [createEvento({ id: 'ev_family' })],
    });
    state.habitos.questoes.push({ id: 'habit_family', data: '2026-11-23', quantidade: 10 });
    state.planejamento.retaFinal = {
      blocos: [{ id: 'block_family', data: '2026-11-24', status: 'pendente' }],
    };

    await local.commitLocalChange({
      uid: 'uid_family',
      generationId: 'gen_family',
      nextState: state,
    });
    const operations = await local.getPendingOperations('uid_family', 'gen_family');
    const byKey = new Map(operations.map((operation) => [operation.entityKey, operation]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      'edital:ed_family',
      'disciplina:disc_family',
      'evento:ev_family',
      'habito.questoes:habit_family',
      'retaFinalBloco:block_family',
      'meta:$root',
    ]));
    expect(byKey.get('edital:ed_family')).toMatchObject({
      collection: 'editais',
      path: ['editais', 0],
      data: { metadataDesconhecida: { fonte: 'sintetica' }, disciplinas: [null] },
    });
    expect(byKey.get('disciplina:disc_family')).toMatchObject({
      collection: 'disciplinas',
      path: ['editais', 0, 'disciplinas', 0],
      data: {
        assuntos: [{ id: 'assunto_family', nome: 'Assunto' }],
        aulas: [{ id: 'aula_family', nome: 'Aula' }],
      },
    });
    expect(byKey.get('habito.questoes:habit_family').path)
      .toEqual(['habitos', 'questoes', 0]);
    expect(byKey.get('retaFinalBloco:block_family').path)
      .toEqual(['planejamento', 'retaFinal', 'blocos', 0]);
    for (const operation of operations.filter((candidate) => candidate.action === 'upsert')) {
      expect(operation.dataText).toBe(encodeRecordData({
        key: operation.entityKey,
        entityType: operation.entityType,
        entityId: operation.entityId,
        path: operation.path,
        data: operation.data,
      }));
      expect(operation.opDigest).toBe(sha256Utf8(operation.dataText));
    }
  });

  it('coalesces only the same entity and base while preserving FIFO and delete priority', async () => {
    createDatabase();
    const local = await importLocal();
    const base = academicState({
      eventos: [createEvento({ id: 'ev_coalesce', titulo: 'Um' }), createEvento({ id: 'ev_fifo', titulo: 'Dois' })],
    });
    await local.commitLocalChange({ uid: 'uid_queue', generationId: 'gen_queue', nextState: base });
    const initial = await local.getPendingOperations('uid_queue', 'gen_queue');
    const target = initial.find((operation) => operation.entityId === 'ev_coalesce');
    const unrelated = initial.find((operation) => operation.entityId === 'ev_fifo');
    await local.commitLocalChange({
      uid: 'uid_queue',
      generationId: 'gen_queue',
      nextState: academicState({
        eventos: [createEvento({ id: 'ev_coalesce', titulo: 'Dois' }), createEvento({ id: 'ev_fifo', titulo: 'Dois' })],
      }),
    });
    let pending = await local.getPendingOperations('uid_queue', 'gen_queue');
    expect(pending.filter((operation) => operation.entityId === 'ev_coalesce')).toHaveLength(1);
    expect(pending.find((operation) => operation.entityId === 'ev_coalesce')).toMatchObject({
      opId: target.opId,
      baseRevision: target.baseRevision,
      revision: target.revision,
      sequence: target.sequence,
    });
    expect(pending.find((operation) => operation.entityId === 'ev_fifo')).toMatchObject({
      opId: unrelated.opId,
      sequence: unrelated.sequence,
    });
    expect(pending.map((operation) => operation.sequence)).toEqual(
      pending.map((operation) => operation.sequence).slice().sort((a, b) => a - b),
    );
    const coalesced = pending.find((operation) => operation.entityId === 'ev_coalesce');
    await local.ackLocalOperation(coalesced.opId, receiptFor(coalesced));

    await local.commitLocalChange({
      uid: 'uid_queue',
      generationId: 'gen_queue',
      nextState: academicState({ eventos: [createEvento({ id: 'ev_fifo', titulo: 'Dois' })] }),
    });
    pending = await local.getPendingOperations('uid_queue', 'gen_queue');
    const deleted = pending.find((operation) => operation.entityId === 'ev_coalesce');
    expect(deleted.action).toBe('delete');
    expect(deleted).toMatchObject({ baseRevision: 1, revision: 2 });
    expect(deleted.opId).not.toBe(target.opId);
    expect(validateRecord(materializeOperation(deleted))).toBe(true);

    await local.commitLocalChange({
      uid: 'uid_queue',
      generationId: 'gen_queue',
      nextState: academicState({
        eventos: [createEvento({ id: 'ev_coalesce', titulo: 'Tentativa' }), createEvento({ id: 'ev_fifo', titulo: 'Dois' })],
      }),
    });
    pending = await local.getPendingOperations('uid_queue', 'gen_queue');
    expect(pending.find((operation) => operation.entityId === 'ev_coalesce').action).toBe('delete');
  });

  it('rejects a foreign ACK and persists an identical receipt', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    await local.commitLocalChange({
      uid: 'uid_ack',
      generationId: 'gen_ack',
      nextState: academicState({ eventos: [createEvento({ id: 'ev_ack' })] }),
    });
    const operation = (await local.getPendingOperations('uid_ack', 'gen_ack'))
      .find((candidate) => candidate.entityId === 'ev_ack');
    await expect(local.ackLocalOperation(operation.opId, receiptFor(operation, { generationId: 'gen_other' })))
      .rejects.toThrow();
    await expect(local.ackLocalOperation(operation.opId, receiptFor(operation, { uid: 'uid_other' })))
      .rejects.toThrow();
    expect((await local.getPendingOperations('uid_ack', 'gen_ack'))[0].status).toBe('pending');

    const receipt = receiptFor(operation);
    await local.ackLocalOperation(operation.opId, receipt);
    expect((await local.getPendingOperations('uid_ack', 'gen_ack'))
      .some((candidate) => candidate.opId === operation.opId)).toBe(false);
    expect(idb.getRecord('v1_sync_outbox', operation.opId)).toMatchObject({
      status: 'acked',
      receipt,
    });
    await expect(local.ackLocalOperation(operation.opId, receipt)).resolves.toBeUndefined();
  });

  it('publishes an ACK only after its IndexedDB transaction commits', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    await local.commitLocalChange({
      uid: 'uid_ack_gate',
      generationId: 'gen_ack_gate',
      nextState: academicState({ eventos: [createEvento({ id: 'ev_ack_gate' })] }),
    });
    const operation = (await local.getPendingOperations('uid_ack_gate', 'gen_ack_gate'))
      .find((candidate) => candidate.entityId === 'ev_ack_gate');
    let release;
    idb.holdNextCommit(new Promise((resolve) => { release = resolve; }));
    const acknowledgement = local.ackLocalOperation(operation.opId, receiptFor(operation));
    await Promise.resolve();
    expect((await local.getPendingOperations('uid_ack_gate', 'gen_ack_gate'))
      .some((candidate) => candidate.opId === operation.opId)).toBe(true);
    release();
    await acknowledgement;
    expect((await local.getPendingOperations('uid_ack_gate', 'gen_ack_gate'))
      .some((candidate) => candidate.opId === operation.opId)).toBe(false);
  });

  it('does not enqueue unchanged or excluded operational fields', async () => {
    createDatabase();
    const local = await importLocal();
    const state = academicState({
      eventos: [createEvento({ id: 'ev_timer', _timerStart: 123 })],
      config: { syncPerformance: { writes: 9 } },
    });
    await local.commitLocalChange({ uid: 'uid_timer', generationId: 'gen_timer', nextState: state });
    const first = await local.getPendingOperations('uid_timer', 'gen_timer');
    expect(first.find((operation) => operation.entityId === 'ev_timer').data._timerStart).toBeUndefined();
    expect(first.some((operation) => JSON.stringify(operation.data).includes('syncPerformance'))).toBe(false);

    for (const operation of first) {
      await local.ackLocalOperation(operation.opId, receiptFor(operation));
    }
    await local.commitLocalChange({ uid: 'uid_timer', generationId: 'gen_timer', nextState: state });
    expect(await local.getPendingOperations('uid_timer', 'gen_timer')).toEqual([]);
  });

  it('derives edits only for the changed entity and preserves unknown business fields', async () => {
    createDatabase();
    const local = await importLocal();
    const edital = createEdital({
      id: 'ed_isolated',
      disciplinas: [createDisciplina({ id: 'disc_isolated' })],
    });
    const base = academicState({
      editais: [edital],
      eventos: [createEvento({ id: 'ev_isolated', extensaoAcademica: { valor: 1 } })],
    });
    await local.commitLocalChange({ uid: 'uid_diff', generationId: 'gen_diff', nextState: base });
    for (const operation of await local.getPendingOperations('uid_diff', 'gen_diff')) {
      await local.ackLocalOperation(operation.opId, receiptFor(operation));
    }

    await local.commitLocalChange({
      uid: 'uid_diff',
      generationId: 'gen_diff',
      nextState: academicState({
        editais: [edital],
        eventos: [{ ...base.eventos[0], titulo: 'Alterado', extensaoAcademica: { valor: 2 } }],
      }),
    });
    const changed = await local.getPendingOperations('uid_diff', 'gen_diff');
    expect(changed.map((operation) => `${operation.entityType}:${operation.entityId}`))
      .toEqual(['evento:ev_isolated']);
    expect(changed[0].data.extensaoAcademica).toEqual({ valor: 2 });
  });

  it('lists and reads conflicts only inside the requested UID and generation', async () => {
    const idb = createDatabase();
    const local = await importLocal();
    const key = `${local.v1ScopeKey('uid_conflict', 'gen_conflict')}\u0000conflict_1`;
    const conflict = {
      key,
      uid: 'uid_conflict',
      generationId: 'gen_conflict',
      conflictId: 'conflict_1',
      base: 1,
      local: 2,
      remote: 3,
    };
    idb.setRecord('v1_sync_conflicts', key, conflict);

    expect(await local.listLocalConflicts('uid_conflict', 'gen_conflict')).toEqual([conflict]);
    expect(await local.readLocalConflict('uid_conflict', 'gen_conflict', 'conflict_1')).toEqual(conflict);
    expect(await local.listLocalConflicts('uid_conflict', 'gen_other')).toEqual([]);
    expect((await local.getLocalSyncStatus('uid_conflict', 'gen_conflict')).conflicts).toBe(1);
  });

  it('keeps the legacy save path when the V1 context is inactive', async () => {
    const idb = createDatabase();
    const store = await import('../../src/js/store.js?v=8.37');
    await store.initDB();
    store.setState(academicState({ eventos: [createEvento({ id: 'ev_legacy' })] }));
    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });
    const local = await importLocal();

    expect(idb.getRecord('app_state', 'main_state_current')).toBeTruthy();
    expect(await local.readLocalGeneration('uid_legacy', 'gen_legacy')).toBeNull();
    expect(await local.getPendingOperations('uid_legacy', 'gen_legacy')).toEqual([]);
    expect(idb.database.objectStoreNames.contains('v1_local_state')).toBe(true);
  });

  it('commits app_state, V1 state and outbox in one transaction when the context is active', async () => {
    const idb = createDatabase();
    const store = await import('../../src/js/store.js?v=8.37');
    await store.initDB();
    store.setActiveV1Context('uid_central', 'gen_central');
    const before = academicState({ eventos: [createEvento({ id: 'ev_central', titulo: 'Antes' })] });
    store.setState(before);
    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });
    store.setState(academicState({
      eventos: [createEvento({ id: 'ev_central', titulo: 'Depois' })],
    }));
    await store.saveStateToDB({ skipCloudSync: true, prepareEntityMetadata: false });
    expect((await store.readLocalGeneration('uid_central', 'gen_central')).state.eventos[0].titulo)
      .toBe('Depois');
    const operation = (await store.getPendingOperations('uid_central', 'gen_central'))
      .find((candidate) => candidate.entityId === 'ev_central');
    expect(operation).toMatchObject({ action: 'upsert', data: { titulo: 'Depois' } });
    const localBefore = await store.readLocalGeneration('uid_central', 'gen_central');
    const operationsBefore = await store.getPendingOperations('uid_central', 'gen_central');
    const savedEnvelopeBefore = idb.getRecord('app_state', 'main_state_current');
    document.dispatchEvent.mockClear();

    store.setState(academicState({
      eventos: [createEvento({ id: 'ev_central', titulo: 'Falha' })],
    }));
    idb.failNextWriteInStore('v1_sync_outbox', namedError('QuotaExceededError'));
    await expect(store.saveStateToDB({
      skipCloudSync: true,
      prepareEntityMetadata: false,
    })).rejects.toMatchObject({ name: 'QuotaExceededError' });

    expect(await store.readLocalGeneration('uid_central', 'gen_central')).toStrictEqual(localBefore);
    expect(await store.getPendingOperations('uid_central', 'gen_central')).toStrictEqual(operationsBefore);
    expect(idb.getRecord('app_state', 'main_state_current')).toStrictEqual(savedEnvelopeBefore);
    expect(document.dispatchEvent.mock.calls.some(([event]) => event.type === 'stateSaved'))
      .toBe(false);
  });
});
