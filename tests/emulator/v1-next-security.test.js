import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { createBaseState } from '../helpers/state-builders.js';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import {
  encodeDocId,
  encodeRecordData,
} from '../../src/js/sync/v1-next/contracts.js';
import {
  applyRemoteOperation,
  fetchGenerationRecords,
  getCurrentGeneration,
  subscribeGeneration,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';
import {
  clearActiveV1Context,
  setActiveV1Context,
} from '../../src/js/sync/v1-next/local.js';

const PROJECT_ID = 'demo-estudo-v1-t11-security';
const UID = 'A';
const GENERATION = 'g1';
const ROOT = `users/${UID}/v1SyncNamespaces/${GENERATION}`;
const COLLECTIONS = [
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
];
const EMPTY_COUNTS = Object.fromEntries(COLLECTIONS.map(name => [name, 0]));
const digest = value => createHash('sha256').update(value ?? 'null').digest('hex');
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emulatorSeparator = emulatorHost.lastIndexOf(':');
const EMULATOR = {
  host: emulatorHost.slice(0, emulatorSeparator),
  port: Number(emulatorHost.slice(emulatorSeparator + 1)),
};

let env;
let ownerDb;

function eventItem(id = 'e1', title = 'Base') {
  return {
    key: `evento:${id}`,
    entityType: 'evento',
    entityId: id,
    path: ['eventos', 0],
    data: { id, titulo: title, data: '2026-11-24', status: 'agendado', tempoAcumulado: 0 },
  };
}

function operation({
  opId = 'op1',
  baseRevision = 0,
  action = 'upsert',
  item = eventItem(),
  uid = UID,
  generationId = GENERATION,
} = {}) {
  const dataText = action === 'delete' ? 'null' : encodeRecordData(item);
  return {
    opId,
    uid,
    generationId,
    entityKey: item.key,
    entityType: item.entityType,
    entityId: item.entityId,
    collection: 'eventos',
    path: item.path,
    baseRevision,
    revision: baseRevision + 1,
    action,
    baseRecord: null,
    data: action === 'delete' ? null : item.data,
    dataText,
    opDigest: digest(dataText),
    status: 'pending',
  };
}

function commandSdk(counters = { reads: 0, writes: 0, documents: 0 }) {
  return {
    collection,
    doc,
    getDoc: async ref => {
      counters.reads += 1;
      const snapshot = await getDoc(ref);
      counters.documents += snapshot.exists() ? 1 : 0;
      return snapshot;
    },
    getDocs: async ref => {
      counters.reads += 1;
      const snapshot = await getDocs(ref);
      counters.documents += snapshot.size;
      return snapshot;
    },
    getDocsFromServer: async ref => {
      counters.reads += 1;
      const snapshot = await getDocsFromServer(ref);
      counters.documents += snapshot.size;
      return snapshot;
    },
    onSnapshot,
    runTransaction: async (db, callback) => runTransaction(db, transaction => callback({
      get: ref => {
        counters.reads += 1;
        return transaction.get(ref);
      },
      set: (ref, value) => {
        counters.writes += 1;
        return transaction.set(ref, value);
      },
    })),
    serverTimestamp,
  };
}

function wire(db, counters, auth = { currentUser: { uid: UID } }) {
  wireFirestores({ db, auth, firestore: commandSdk(counters) });
}

async function asAdmin(work) {
  return env.withSecurityRulesDisabled(async context => work(context.firestore()));
}

async function activate({
  uid = UID,
  generationId = GENERATION,
  state = 'active',
  counts = EMPTY_COUNTS,
} = {}) {
  await asAdmin(async db => {
    const batch = writeBatch(db);
    const common = { schemaVersion: 1, generationId, updatedAt: serverTimestamp() };
    batch.set(doc(db, 'users', uid, 'v1SyncControl', 'current'), common);
    batch.set(doc(db, 'users', uid, 'v1SyncNamespaces', generationId), {
      ...common,
      migrationId: `migration_${generationId}`,
      state,
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: 'b'.repeat(64),
      counts: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        byCollection: counts,
      },
    });
    await batch.commit();
  });
}

async function operationCount(uid = UID, generationId = GENERATION) {
  let count = 0;
  await asAdmin(async db => {
    const snapshot = await getDocs(collection(
      db,
      'users',
      uid,
      'v1SyncNamespaces',
      generationId,
      'operations',
    ));
    count = snapshot.size;
  });
  return count;
}

async function waitFor(predicate, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Emulator listener timeout');
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR.host,
      port: EMULATOR.port,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await activate();
  await activate({ uid: 'B' });
  ownerDb = env.authenticatedContext(UID).firestore();
});

afterAll(async () => {
  clearActiveV1Context();
  await env?.cleanup();
});

describe('T11 V1 security and generation isolation', () => {
  it('requires Auth and exact UID/generation before any write', async () => {
    const counters = { reads: 0, writes: 0, documents: 0 };
    wire(ownerDb, counters, { currentUser: null });
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_AUTH_REQUIRED',
    });
    expect(counters).toEqual({ reads: 0, writes: 0, documents: 0 });

    wire(ownerDb, counters);
    await expect(applyRemoteOperation(operation({ uid: 'B' }))).rejects.toMatchObject({
      code: 'V1_REMOTE_UID_MISMATCH',
    });
    await expect(applyRemoteOperation(operation({ generationId: 'unknown' })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_GENERATION_INVALID' });
    expect(counters.writes).toBe(0);
    expect(await operationCount()).toBe(0);
  });

  it('rejects a rotated pointer and a cross-account namespace without leakage', async () => {
    wire(ownerDb, { reads: 0, writes: 0, documents: 0 });
    await applyRemoteOperation(operation());
    await activate({ generationId: 'g2' });
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_GENERATION_INVALID',
    });
    expect(await operationCount()).toBe(1);

    const foreignDb = env.authenticatedContext('B').firestore();
    wire(foreignDb, { reads: 0, writes: 0, documents: 0 }, {
      currentUser: { uid: 'B' },
    });
    await expect(applyRemoteOperation(operation({ uid: UID, opId: 'cross' })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_UID_MISMATCH' });
    expect(await operationCount()).toBe(1);
    expect(await operationCount('B', GENERATION)).toBe(0);
    await expect(getDoc(doc(foreignDb, ROOT, 'eventos', encodeDocId('evento:e1'))))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('serializes CAS so one base revision wins and keeps tombstones terminal', async () => {
    wire(ownerDb, { reads: 0, writes: 0, documents: 0 });
    const results = await Promise.all([
      applyRemoteOperation(operation({ opId: 'left', item: eventItem('e1', 'Left') })),
      applyRemoteOperation(operation({ opId: 'right', item: eventItem('e1', 'Right') })),
    ]);
    expect(results.filter(result => result.acknowledged)).toHaveLength(1);
    expect(results.filter(result => result.conflict)).toHaveLength(1);
    expect(await operationCount()).toBe(1);

    await applyRemoteOperation(operation({ opId: 'delete', baseRevision: 1, action: 'delete' }));
    await expect(applyRemoteOperation(operation({ opId: 'delete', baseRevision: 1,
      action: 'delete' }))).resolves.toMatchObject({
      acknowledged: true,
      revision: 2,
    });
    const revive = await applyRemoteOperation(operation({
      opId: 'revive',
      baseRevision: 2,
      item: eventItem('e1', 'Resurrect'),
    }));
    expect(revive).toMatchObject({
      acknowledged: false,
      conflict: { code: 'tombstone', remoteDeleted: true, remoteRevision: 2 },
    });
    expect(await operationCount()).toBe(2);
  });

  it('replays a lost ACK once and exposes fetched data plus listener deltas', async () => {
    const counters = { reads: 0, writes: 0, documents: 0 };
    wire(ownerDb, counters);
    const original = operation({ opId: 'replay' });
    await applyRemoteOperation(original);
    const writesAfterCommit = counters.writes;
    await expect(applyRemoteOperation(original)).resolves.toMatchObject({
      acknowledged: true,
      revision: 1,
    });
    expect(counters.writes).toBe(writesAfterCommit);

    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    const fetched = await fetchGenerationRecords(UID, GENERATION);
    expect(fetched.records).toEqual([eventItem('e1', 'Base')]);
    expect(await getCurrentGeneration(UID)).toMatchObject({
      uid: UID,
      generationId: GENERATION,
      manifest: { state: 'active' },
    });

    const deltas = [];
    const errors = [];
    const unsubscribe = subscribeGeneration(UID, GENERATION, {
      onDelta: delta => deltas.push(delta),
      onError: error => errors.push(error),
    });
    await waitFor(() => deltas.some(delta => delta.baseline && delta.entityId === 'e1'));
    await applyRemoteOperation(operation({
      opId: 'delta',
      baseRevision: 1,
      item: eventItem('e1', 'Delta'),
    }));
    await waitFor(() => deltas.some(delta => !delta.baseline && delta.entityId === 'e1' &&
      JSON.parse(delta.record.data).data.titulo === 'Delta'));
    unsubscribe();
    expect(errors).toEqual([]);
    expect(await operationCount()).toBe(2);
  });

  it('preserves synthetic 57/86 references and rejects an incomplete 140-block batch', async () => {
    const day = '2026-11-24';
    const block = { id: 'b', discId: 'd', minutos: 30, topicos: [], ordem: 0,
      dataPlanejada: day, data: day };
    const blocks = Array.from({ length: 140 }, (_, ordem) => ({ ...block, id: `b${ordem}`,
      ordem, topicos: [{ assId: `a${ordem}` }] }));
    const eventos = Array.from({ length: 90 }, (_, index) => ({
      id: `e${index}`,
      titulo: `Sintético ${index}`,
      data: day,
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'd',
      assId: 'a',
      ...(index < 57 ? { aulaId: `missing-a-${index}` } : {}),
      ...(index < 86 ? { rfBlocoId: `missing-rf-${index}` } : {}),
    }));
    const state = createBaseState({
      schemaVersion: 12,
      planejamento: {
        tipo: 'reta_final',
        ativo: true,
        planId: 'plan_t11',
        revision: 4,
        schemaVersionRetaFinal: 2,
        retaFinal: { dataFinal: day, blocos: blocks },
      },
      eventos,
      editais: [{ id: 'ed', nome: 'Sintético', disciplinas: [
        { id: 'd', nome: 'Disciplina', assuntos: [], aulas: [] },
      ] }],
    });
    const converted = convertBackupV12(state);
    expect(converted.manifestDraft.historicalUnresolvedReferences)
      .toEqual({ aulaId: 57, rfBlocoId: 86 });
    expect(converted.manifestDraft.counts.byCollection.retaFinalBlocos).toBe(140);

    const retaFinal = await import('../../src/js/sync/v1-next/reta-final.js');
    const revision = retaFinal.preparePlanRevision({
      planId: 'plan_t11',
      baseRevision: 4,
      opId: 'atomic_140',
      blocks,
      metadata: { notes: { b7: 'preservada' }, removedBlockIds: [] },
    });
    expect(revision.batches).toHaveLength(4);
    expect(retaFinal.resolveVisiblePlanRevision(revision.manifest, revision.batches))
      .toMatchObject({ revision: 5, blocks });
    expect(() => retaFinal.resolveVisiblePlanRevision(
      revision.manifest,
      revision.batches.slice(1),
    )).toThrow('Revisão ainda não possui todos os lotes.');
    const corrupt = structuredClone(revision.batches);
    corrupt[0].data.blocks[0].minutos += 1;
    expect(() => retaFinal.resolveVisiblePlanRevision(revision.manifest, corrupt))
      .toThrow(/digest|confer/i);
    setActiveV1Context(UID, GENERATION);
  });
});
