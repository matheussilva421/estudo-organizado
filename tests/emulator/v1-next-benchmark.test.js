import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, expect, it } from 'vitest';
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
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { createBaseState } from '../helpers/state-builders.js';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import { validateV1Baseline } from '../../src/js/sync/v1-next/bootstrap.js';
import { encodeDocId, encodeRecordData } from '../../src/js/sync/v1-next/contracts.js';
import {
  applyRemoteOperation,
  fetchGenerationRecords,
  getCurrentGeneration,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';
import {
  clearActiveV1Context,
  setActiveV1Context,
} from '../../src/js/sync/v1-next/local.js';
import { preparePlanRevision, publishPlanRevision } from '../../src/js/sync/v1-next/reta-final.js';

const PROJECT_ID = 'demo-estudo-v1-t11-benchmark';
const UID = 'A';
const GENERATION = 'benchmark_g1';
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
const METRICS_PATH = resolve(
  '.superpowers/sdd/2026-11-23-estudo-organizado-v1-sync-definitivo/task-11-metrics.json',
);
const digest = value => createHash('sha256').update(value ?? 'null').digest('hex');
const emulatorHost = globalThis.process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emulatorSeparator = emulatorHost.lastIndexOf(':');
const EMULATOR = {
  host: emulatorHost.slice(0, emulatorSeparator),
  port: Number(emulatorHost.slice(emulatorSeparator + 1)),
};
const timer = work => {
  const started = performance.now();
  return Promise.resolve(work()).then(value => ({
    value,
    latencyMs: Number((performance.now() - started).toFixed(3)),
  }));
};

let env;
let ownerDb;
let fixture;

function emptyCounters() {
  return { reads: 0, writes: 0, documents: 0 };
}

function benchmarkSdk(counters) {
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
      get: async ref => {
        counters.reads += 1;
        const snapshot = await transaction.get(ref);
        counters.documents += snapshot.exists() ? 1 : 0;
        return snapshot;
      },
      set: (ref, value) => {
        counters.writes += 1;
        return transaction.set(ref, value);
      },
    })),
    serverTimestamp,
  };
}

function buildFixture() {
  const day = '2026-11-24';
  const block = {
    id: 'b',
    discId: 'd',
    minutos: 30,
    topicos: [],
    ordem: 0,
    dataPlanejada: day,
    data: day,
  };
  const blocks = Array.from({ length: 140 }, (_, ordem) => ({
    ...block,
    id: `benchmark_b${ordem}`,
    ordem,
    topicos: [{ assId: `a${ordem}` }],
    notas: ordem % 11 === 0 ? 'nota sintética preservada' : '',
  }));
  const eventos = Array.from({ length: 90 }, (_, index) => ({
    id: `benchmark_e${index}`,
    titulo: `Evento sintético ${index}`,
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
      planId: 'benchmark_plan',
      revision: 4,
      schemaVersionRetaFinal: 2,
      retaFinal: { dataFinal: day, blocos: blocks },
    },
    eventos,
    editais: [{ id: 'ed', nome: 'Benchmark', disciplinas: [
      { id: 'd', nome: 'Disciplina', assuntos: Array.from({ length: 140 }, (_, i) => ({ id: `a${i}`, nome: `Tema ${i}` })),
        aulas: Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, nome: `Aula ${i}` })) },
    ] }],
  });
  const converted = convertBackupV12(state);
  return { state, blocks, converted };
}

async function seed() {
  const records = Object.entries(fixture.converted.records).flatMap(([collectionName, items]) =>
    items.map(item => ({ collectionName, item })));
  const byCollection = Object.fromEntries(COLLECTIONS.map(name => [name, 0]));
  for (const { collectionName } of records) byCollection[collectionName] += 1;
  const manifest = {
    schemaVersion: 1,
    generationId: GENERATION,
    migrationId: 'benchmark_migration',
    state: 'active',
    revision: 0,
    sourceSha256: 'a'.repeat(64),
    businessDigest: fixture.converted.manifestDraft.businessDigest,
    counts: {
      total: records.length,
      byCollection,
    },
    updatedAt: serverTimestamp(),
  };

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (let offset = 0; offset < records.length; offset += 400) {
      const batch = writeBatch(db);
      for (const [index, { collectionName, item }] of records.slice(offset, offset + 400)
        .entries()) {
        const data = encodeRecordData(item);
        batch.set(doc(db, ROOT, collectionName, encodeDocId(item.key)), {
          schemaVersion: 1,
          generationId: GENERATION,
          collection: collectionName,
          entityType: item.entityType,
          entityId: String(item.entityId),
          baseRevision: 0,
          revision: 1,
          opId: `seed_${offset + index}`,
          opDigest: digest(data),
          deleted: false,
          data,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    const activation = writeBatch(db);
    activation.set(doc(db, `users/${UID}/v1SyncControl/current`), {
      schemaVersion: 1,
      generationId: GENERATION,
      updatedAt: serverTimestamp(),
    });
    activation.set(doc(db, ROOT), manifest);
    activation.set(doc(db, 'users', UID, 'snapshots', 'main'), {
      version: 1,
      deviceId: 'synthetic-benchmark',
      payloadUpdatedAt: new Date().toISOString(),
      payload: fixture.state,
    });
    await activation.commit();
  });
  return { manifest, records: records.length };
}

function editOperation(previous, collectionName, changes, opId) {
  const item = { ...previous, data: { ...previous.data, ...changes } };
  const dataText = encodeRecordData(item);
  return {
    uid: UID, generationId: GENERATION, opId, entityKey: item.key,
    entityType: item.entityType, entityId: item.entityId, collection: collectionName,
    path: item.path, baseRevision: 1, revision: 2, action: 'upsert',
    baseRecord: previous, data: item.data, dataText, opDigest: digest(dataText), status: 'pending',
  };
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
  await env.clearFirestore();
  fixture = buildFixture();
  await seed();
  ownerDb = env.authenticatedContext(UID).firestore();
});

afterAll(async () => {
  clearActiveV1Context();
  await env?.cleanup();
});

it('records measured Emulator counters for V1 incremental sync against a legacy snapshot baseline', async () => {
  const bootstrapCounters = emptyCounters();
  wireFirestores({
    db: ownerDb,
    auth: { currentUser: { uid: UID } },
    firestore: benchmarkSdk(bootstrapCounters),
  });
  const bootstrap = await timer(async () => {
    const current = await getCurrentGeneration(UID);
    const fetched = await fetchGenerationRecords(UID, current.generationId);
    return { fetched, verified: validateV1Baseline(fetched) };
  });
  expect(bootstrap.value.fetched.records.length).toBe(238);
  expect(bootstrap.value.verified.state.eventos).toEqual(fixture.state.eventos);
  expect(bootstrap.value.verified.state.planejamento.retaFinal.blocos).toEqual(fixture.blocks);

  const editCounters = emptyCounters();
  wireFirestores({
    db: ownerDb,
    auth: { currentUser: { uid: UID } },
    firestore: benchmarkSdk(editCounters),
  });
  const edit = editOperation(fixture.converted.records.eventos[0], 'eventos',
    { titulo: 'Edição isolada do benchmark' }, 'benchmark_edit');
  const v1Edit = await timer(() => applyRemoteOperation(edit));
  expect(v1Edit.value).toMatchObject({ acknowledged: true, revision: 2 });

  const remoteRecord = await getDoc(doc(
    ownerDb,
    ROOT,
    'eventos',
    encodeDocId(edit.entityKey),
  ));
  const v1RecordBytes = Buffer.byteLength(JSON.stringify(remoteRecord.data()), 'utf8');

  const legacyCounters = emptyCounters();
  const legacyRef = doc(ownerDb, 'users', UID, 'snapshots', 'main');
  const legacyStarted = performance.now();
  const legacyRead = await getDoc(legacyRef);
  legacyCounters.reads += 1;
  legacyCounters.documents += legacyRead.exists() ? 1 : 0;
  const legacyPayload = {
    ...legacyRead.data(),
    payloadUpdatedAt: new Date().toISOString(),
  };
  legacyPayload.payload.eventos[0].titulo = edit.data.titulo;
  const legacyBytes = Buffer.byteLength(JSON.stringify(legacyPayload), 'utf8');
  await setDoc(legacyRef, legacyPayload);
  const legacyLatency = Number((performance.now() - legacyStarted).toFixed(3));
  legacyCounters.writes += 1;

  setActiveV1Context(UID, GENERATION);
  const retaFinalCounters = emptyCounters();
  wireFirestores({
    db: ownerDb,
    auth: { currentUser: { uid: UID } },
    firestore: benchmarkSdk(retaFinalCounters),
  });
  const nextBlocks = fixture.blocks.slice().reverse().map((block, ordem) => ({
    ...block,
    ordem,
    dataPlanejada: '2026-11-26',
    notas: `replanejado ${ordem}`,
  }));
  const prepared = preparePlanRevision({
    planId: 'benchmark_plan',
    baseRevision: 0,
    opId: 'benchmark_reta_final',
    blocks: nextBlocks,
    metadata: { operations: ['benchmark'], removedBlockIds: [] },
  });
  const retaFinalPublish = await timer(() => publishPlanRevision({
    planId: 'benchmark_plan',
    baseRevision: 0,
    opId: 'benchmark_reta_final',
    blocks: nextBlocks,
    metadata: { operations: ['benchmark'], removedBlockIds: [] },
  }));
  expect(retaFinalPublish.value).toMatchObject({ status: 'published', revision: 1 });

  const largest = fixture.converted.records.disciplinas.reduce((left, right) =>
    Buffer.byteLength(encodeRecordData(left)) >= Buffer.byteLength(encodeRecordData(right)) ? left : right);
  const disciplineCounters = emptyCounters();
  wireFirestores({ db: ownerDb, auth: { currentUser: { uid: UID } }, firestore: benchmarkSdk(disciplineCounters) });
  const disciplineEdit = editOperation(largest, 'disciplinas', { nome: 'Disciplina editada' }, 'edit_discipline');
  const disciplineAck = await timer(() => applyRemoteOperation(disciplineEdit));
  expect(disciplineAck.value).toMatchObject({ acknowledged: true, revision: 2 });

  const metrics = {
    generatedAt: new Date().toISOString(),
    environment: {
      backend: `Firestore Emulator ${emulatorHost}`,
      projectId: PROJECT_ID,
      data: 'synthetic-private-safe fixture',
    },
    dataset: {
      documents: bootstrap.value.fetched.manifest.counts.total,
      events: 90,
      retaFinalBlocks: 140,
      largestDiscipline: {
        disciplineId: largest.entityId,
        events: fixture.state.eventos.filter(event => event.discId === largest.entityId).length,
        retaFinalBlocks: nextBlocks.filter(block => block.discId === largest.entityId).length,
      },
      historicalUnresolvedReferences: fixture.converted.manifestDraft
        .historicalUnresolvedReferences,
    },
    largestDisciplineEdit: {
      ...disciplineCounters,
      latencyMsToAckMs: disciplineAck.latencyMs,
      dataJsonBytes: Buffer.byteLength(disciplineEdit.dataText),
      lessons: largest.data.aulas.length,
      subjects: largest.data.assuntos.length,
    },
    v1Bootstrap: {
      latencyMs: bootstrap.latencyMs,
      reads: bootstrapCounters.reads,
      documents: bootstrapCounters.documents,
      writes: bootstrapCounters.writes,
    },
    v1IncrementalEdit: {
      latencyMsToAckMs: v1Edit.latencyMs,
      reads: editCounters.reads,
      documents: editCounters.documents,
      writes: editCounters.writes,
      recordJsonBytes: v1RecordBytes,
      fullBaselineRewrite: false,
    },
    legacySnapshotBaseline: {
      latencyMsToAckMs: legacyLatency,
      reads: legacyCounters.reads,
      documents: legacyCounters.documents,
      writes: legacyCounters.writes,
      snapshotJsonBytes: legacyBytes,
      fullBaselineRewrite: true,
    },
    retaFinal140Blocks: {
      latencyMsToPublishMs: retaFinalPublish.latencyMs,
      reads: retaFinalCounters.reads,
      documents: retaFinalCounters.documents,
      writes: retaFinalCounters.writes,
      batches: prepared.batches.length,
      blocks: nextBlocks.length,
    },
    methodology: {
      counters: 'SDK helper calls and snapshot document counts at the V1 repository boundary',
      bytes: 'UTF-8 byte length of JSON payloads before SDK encoding, not Firestore wire overhead',
      latency: 'One local Emulator run per scenario, wall clock to helper completion or ACK',
      largestDiscipline: 'Largest synthetic discipline by codec JSON UTF-8 bytes; edit of existing document',
      legacy: 'One legacy snapshots/main read plus one full synthetic snapshot write',
      limitations: [
        'Emulator locality is not production network latency or billing.',
        'Transaction retries may repeat helper calls; Firestore usage meters are not inspected.',
        'The legacy comparison is a representative full-document write, not every legacy code path.',
      ],
    },
  };
  await mkdir(dirname(METRICS_PATH), { recursive: true });
  await writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

  expect(metrics.v1IncrementalEdit.reads).toBeLessThan(10);
  expect(metrics.v1IncrementalEdit.documents).toBeLessThan(10);
  expect(metrics.v1IncrementalEdit.writes).toBe(2);
  expect(metrics.v1IncrementalEdit.writes).toBeLessThan(metrics.dataset.documents);
  expect(metrics.v1IncrementalEdit.fullBaselineRewrite).toBe(false);
  expect(metrics.legacySnapshotBaseline.snapshotJsonBytes)
    .toBeGreaterThan(metrics.v1IncrementalEdit.recordJsonBytes);
  expect(metrics.retaFinal140Blocks.batches).toBe(4);
  expect(metrics.dataset.largestDiscipline).toEqual({
    disciplineId: 'd',
    events: 90,
    retaFinalBlocks: 140,
  });
  expect(metrics.dataset.documents).toBe(238);
});
