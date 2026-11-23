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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { encodeDocId, encodeRecordData } from '../../src/js/sync/v1-next/contracts.js';
import {
  applyRemoteOperation,
  fetchGenerationRecords,
  subscribeGeneration,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';

const PROJECT_ID = 'demo-estudo-v1-remote';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emulatorSeparator = emulatorHost.lastIndexOf(':');
const EMULATOR = { host: emulatorHost.slice(0, emulatorSeparator),
  port: Number(emulatorHost.slice(emulatorSeparator + 1)) };
const UID = 'A';
const GENERATION = 'g1';
const ROOT = 'users/A/v1SyncNamespaces/g1';
const COLLECTIONS = [
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
];
const digest = value => createHash('sha256').update(value ?? 'null').digest('hex');
const EMPTY_COUNTS = Object.fromEntries(COLLECTIONS.map(name => [name, 0]));

let env;
let ownerDb;

function eventItem(id = 'e1', title = 'Sintético') {
  return {
    key: `evento:${id}`,
    entityType: 'evento',
    entityId: id,
    path: ['eventos', 0],
    data: { id, titulo: title },
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
  const deleted = action === 'delete';
  const dataText = deleted ? 'null' : encodeRecordData(item);
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
    data: deleted ? null : item.data,
    dataText,
    opDigest: digest(dataText),
    status: 'pending',
  };
}

function entityRecord(op) {
  return {
    schemaVersion: 1,
    generationId: op.generationId,
    collection: op.collection,
    entityType: op.entityType,
    entityId: op.entityId,
    baseRevision: op.baseRevision,
    revision: op.revision,
    opId: op.opId,
    opDigest: op.opDigest,
    deleted: op.action === 'delete',
    data: op.dataText,
    updatedAt: serverTimestamp(),
  };
}

function receiptRecord(op) {
  const { data: _data, ...receipt } = entityRecord(op);
  return receipt;
}

function entityRef(db, op, generationId = op.generationId) {
  return doc(db, 'users', UID, 'v1SyncNamespaces', generationId,
    op.collection, encodeDocId(op.entityKey));
}

function receiptRef(db, op, generationId = op.generationId) {
  return doc(db, 'users', UID, 'v1SyncNamespaces', generationId, 'operations', op.opId);
}

function makeSdk(counters = { reads: 0, writes: 0 }) {
  return {
    collection,
    doc,
    getDoc: async ref => {
      counters.reads += 1;
      return getDoc(ref);
    },
    getDocs: async ref => {
      counters.reads += 1;
      return getDocs(ref);
    },
    getDocsFromServer: async ref => {
      counters.reads += 1;
      return getDocsFromServer(ref);
    },
    onSnapshot,
    runTransaction: async (db, callback) => runTransaction(db, transaction => callback({
      get: ref => {
        counters.reads += 1;
        return transaction.get(ref);
      },
      set: (ref, value) => {
        counters.writes += 1;
        transaction.set(ref, value);
      },
    })),
    serverTimestamp,
  };
}

function listenerParts(optionsOrNext, nextOrError, maybeError) {
  if (typeof optionsOrNext === 'function') {
    return { options: null, next: optionsOrNext, onError: nextOrError };
  }
  return { options: optionsOrNext, next: nextOrError, onError: maybeError };
}

function cacheThenServerSdk(baseSdk) {
  const listenerOptions = [];
  return {
    listenerOptions,
    sdk: {
      ...baseSdk,
      onSnapshot: (ref, optionsOrNext, nextOrError, maybeError) => {
        const { options, next, onError } = listenerParts(
          optionsOrNext,
          nextOrError,
          maybeError,
        );
        listenerOptions.push(options);
        let forcedCache = false;
        let serverStripped = false;
        const forward = snapshot => {
          if (!forcedCache) {
            forcedCache = true;
            next({
              metadata: { fromCache: true, hasPendingWrites: false },
              docs: snapshot.docs,
              docChanges: () => [],
            });
          }
          if (snapshot.metadata?.fromCache) return;
          const serverSnapshot = serverStripped ? snapshot : {
            metadata: snapshot.metadata,
            docs: snapshot.docs,
            docChanges: () => [],
          };
          serverStripped = true;
          next(serverSnapshot);
        };
        return options ?
          onSnapshot(ref, options, forward, onError) :
          onSnapshot(ref, forward, onError);
      },
    },
  };
}

function wire(db, counters, auth = { currentUser: { uid: UID } }) {
  return wireFirestores({ db, auth, firestore: makeSdk(counters) });
}

async function asAdmin(work) {
  return env.withSecurityRulesDisabled(async context => work(context.firestore()));
}

async function activate({
  generationId = GENERATION,
  state = 'active',
  counts = EMPTY_COUNTS,
  manifestPatch = {},
} = {}) {
  await asAdmin(async db => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', UID, 'v1SyncControl', 'current'), {
      schemaVersion: 1,
      generationId,
      updatedAt: serverTimestamp(),
    });
    const nextManifest = {
      schemaVersion: 1,
      generationId,
      migrationId: 'migration-1',
      state,
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: 'b'.repeat(64),
      counts: { total, byCollection: counts },
      updatedAt: serverTimestamp(),
      ...manifestPatch,
    };
    for (const [field, value] of Object.entries(nextManifest)) {
      if (value === undefined) delete nextManifest[field];
    }
    batch.set(doc(db, 'users', UID, 'v1SyncNamespaces', generationId), nextManifest);
    await batch.commit();
  });
}

async function pair(op) {
  await asAdmin(async db => {
    const batch = writeBatch(db);
    batch.set(entityRef(db, op), entityRecord(op));
    batch.set(receiptRef(db, op), receiptRecord(op));
    await batch.commit();
  });
}

async function read(path) {
  const result = await getDoc(doc(ownerDb, path));
  return result.exists() ? result.data() : null;
}

async function operationCount() {
  let count = 0;
  await asAdmin(async db => {
    count = (await getDocs(collection(db, ROOT, 'operations'))).size;
  });
  return count;
}

async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for emulator event');
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
  ownerDb = env.authenticatedContext(UID).firestore();
});

afterAll(async () => {
  await env?.cleanup();
});

describe('V1 remote Firestore transactions', () => {
  it('commits one event plus one receipt with only two writes', async () => {
    const counters = { reads: 0, writes: 0 };
    wire(ownerDb, counters);
    const result = await applyRemoteOperation(operation());
    expect(result).toMatchObject({
      opId: 'op1', entityId: 'e1', revision: 1, acknowledged: true,
    });
    expect(counters).toEqual({ reads: 5, writes: 2 });

    const entity = await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`);
    const receipt = await read(`${ROOT}/operations/op1`);
    expect(entity).toMatchObject({ revision: 1, baseRevision: 0, deleted: false, opId: 'op1' });
    expect(receipt).toEqual(expect.objectContaining({
      schemaVersion: 1,
      generationId: GENERATION,
      collection: 'eventos',
      entityType: 'evento',
      entityId: 'e1',
      revision: 1,
      baseRevision: 0,
      opId: 'op1',
      deleted: false,
    }));
    expect(receipt).not.toHaveProperty('data');
    expect(entity.updatedAt.toMillis()).toBe(receipt.updatedAt.toMillis());

    const byCollection = {};
    for (const name of COLLECTIONS) {
      byCollection[name] = (await getDocs(collection(ownerDb, ROOT, name))).size;
    }
    expect(byCollection).toEqual({ ...EMPTY_COUNTS, eventos: 1 });
    expect(await operationCount()).toBe(1);
  });

  it('lets exactly one transaction win the same base revision', async () => {
    wire(ownerDb, { reads: 0, writes: 0 });
    const results = await Promise.all([
      applyRemoteOperation(operation({ opId: 'left', item: eventItem('e1', 'Left') })),
      applyRemoteOperation(operation({ opId: 'right', item: eventItem('e1', 'Right') })),
    ]);
    expect(results.filter(result => result.acknowledged)).toHaveLength(1);
    expect(results.filter(result => result.conflict)).toHaveLength(1);
    expect(await operationCount()).toBe(1);
    expect((await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`)).revision).toBe(1);
  });

  it('returns the durable receipt on replay and never creates a second effect', async () => {
    const counters = { reads: 0, writes: 0 };
    wire(ownerDb, counters);
    const first = await applyRemoteOperation(operation());
    const writesAfterFirst = counters.writes;
    const replay = await applyRemoteOperation(operation());
    expect(replay).toMatchObject({ opId: 'op1', revision: 1, acknowledged: true });
    expect(counters.writes).toBe(writesAfterFirst);
    expect(await operationCount()).toBe(1);
    expect(replay.receipt.updatedAt.toMillis()).toBe(first.receipt.updatedAt.toMillis());
  });

  it('blocks a g1 replay after the active pointer moves to g2', async () => {
    wire(ownerDb, { reads: 0, writes: 0 });
    await applyRemoteOperation(operation());
    await activate({ generationId: 'g2' });

    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_GENERATION_INVALID',
    });
    expect(await operationCount()).toBe(1);
  });

  it('rejects opId reuse with different content', async () => {
    wire(ownerDb, { reads: 0, writes: 0 });
    await applyRemoteOperation(operation());
    await expect(applyRemoteOperation(operation({
      item: eventItem('e1', 'Different'),
      baseRevision: 1,
    }))).rejects.toMatchObject({ code: 'V1_REMOTE_OP_CONFLICT' });
    expect((await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`)).revision).toBe(1);
  });

  it('acknowledges a retry after a timeout that occurred after the remote commit', async () => {
    const counters = { reads: 0, writes: 0 };
    const normalSdk = makeSdk(counters);
    const timeoutSdk = {
      ...normalSdk,
      runTransaction: async (db, callback) => {
        await runTransaction(db, transaction => callback({
          get: ref => transaction.get(ref),
          set: (ref, value) => transaction.set(ref, value),
        }));
        const timeout = new Error('response lost after durable commit');
        timeout.code = 'deadline-exceeded';
        throw timeout;
      },
    };
    wireFirestores({
      db: ownerDb,
      auth: { currentUser: { uid: UID } },
      firestore: timeoutSdk,
    });
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_TIMEOUT',
    });
    expect(await operationCount()).toBe(1);

    wireFirestores({
      db: ownerDb,
      auth: { currentUser: { uid: UID } },
      firestore: normalSdk,
    });
    await expect(applyRemoteOperation(operation())).resolves.toMatchObject({
      acknowledged: true,
      revision: 1,
    });
    expect(await operationCount()).toBe(1);
  });

  it('fails without writes for lost Auth, another UID or an inactive/unknown generation', async () => {
    const counters = { reads: 0, writes: 0 };
    wire(ownerDb, counters, { currentUser: null });
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_AUTH_REQUIRED',
    });
    expect(counters).toEqual({ reads: 0, writes: 0 });

    wire(ownerDb, counters);
    await expect(applyRemoteOperation(operation({ uid: 'B' }))).rejects.toMatchObject({
      code: 'V1_REMOTE_UID_MISMATCH',
    });
    await expect(applyRemoteOperation(operation({ generationId: 'g2' }))).rejects.toMatchObject({
      code: 'V1_REMOTE_GENERATION_INVALID',
    });
    expect(counters.writes).toBe(0);
    expect(await operationCount()).toBe(0);
  });

  it('returns a recoverable conflict for stale revisions, missing docs and tombstones', async () => {
    wire(ownerDb, { reads: 0, writes: 0 });
    await applyRemoteOperation(operation());
    const stale = await applyRemoteOperation(operation({ opId: 'stale' }));
    expect(stale).toMatchObject({
      acknowledged: false,
      conflict: { baseRevision: 0, remoteRevision: 1 },
    });
    expect(await operationCount()).toBe(1);

    const deleted = operation({ opId: 'delete', baseRevision: 1, action: 'delete' });
    await applyRemoteOperation(deleted);
    const revive = await applyRemoteOperation(operation({ opId: 'revive', baseRevision: 2 }));
    expect(revive).toMatchObject({ acknowledged: false, conflict: { remoteDeleted: true } });
    expect((await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`)).deleted).toBe(true);

    await asAdmin(db => deleteDoc(entityRef(db, operation({ opId: 'gone' }))));
    const missing = await applyRemoteOperation(operation({ opId: 'missing', baseRevision: 2 }));
    expect(missing).toMatchObject({ acknowledged: false, conflict: {
      baseRevision: 2, remoteRevision: 0,
    } });
  });

  it('rejects an opaque business payload even when its digest is internally correct', async () => {
    const invalidItem = { key: 'evento:e1', entityType: 'evento', entityId: 'e1',
      path: ['eventos', 0], data: { id: 'different' } };
    const invalidText = JSON.stringify(invalidItem);
    wire(ownerDb, { reads: 0, writes: 0 });
    const invalidOperation = operation();
    Object.assign(invalidOperation, {
      data: invalidItem.data,
      dataText: invalidText,
      opDigest: digest(invalidText),
    });
    await expect(applyRemoteOperation(invalidOperation)).rejects.toMatchObject({
      code: 'V1_REMOTE_INVALID_OPERATION',
    });
    expect((await getDocs(collection(ownerDb, ROOT, 'eventos'))).size).toBe(0);
  });

  it('keeps numeric T1 IDs in the payload while writing a textual Firestore identity', async () => {
    wire(ownerDb, { reads: 0, writes: 0 });
    const numericItem = eventItem(7, 'Numérico');
    const numeric = operation({ opId: 'numeric', item: numericItem });
    expect(numeric.entityId).toBe(7);
    await expect(applyRemoteOperation(numeric)).resolves.toMatchObject({
      entityId: '7', revision: 1, acknowledged: true,
    });
    const entity = await read(`${ROOT}/eventos/${encodeDocId('evento:7')}`);
    expect(entity.entityId).toBe('7');
    expect(JSON.parse(entity.data).entityId).toBe(7);
  });
});

describe('V1 remote baseline and listeners', () => {
  it('reads back all T1 records and fails closed on absent or mismatched manifest data', async () => {
    const op = operation();
    await pair(op);
    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    wire(ownerDb, { reads: 0, writes: 0 });
    const result = await fetchGenerationRecords(UID, GENERATION);
    expect(result.generationId).toBe(GENERATION);
    expect(result.manifest).toMatchObject({ state: 'active', counts: { total: 1 } });
    expect(result.records).toEqual([eventItem()]);

    await activate({ counts: { ...EMPTY_COUNTS, eventos: 2 } });
    // The receipt written by pair() proves this generation evolved after the
    // immutable migration baseline. Its live records stay individually
    // hash/revision validated; the stale baseline count is not current truth.
    await expect(fetchGenerationRecords(UID, GENERATION)).resolves.toMatchObject({
      evolved: true,
      records: [eventItem()],
    });

    await activate({ counts: EMPTY_COUNTS, manifestPatch: { businessDigest: undefined } });
    await expect(fetchGenerationRecords(UID, GENERATION)).rejects.toMatchObject({
      code: 'V1_REMOTE_INVALID_MANIFEST',
    });
  });

  it('rejects a fetched record from another generation', async () => {
    const op = operation();
    await asAdmin(async db => {
      const batch = writeBatch(db);
      batch.set(entityRef(db, op), { ...entityRecord(op), generationId: 'g2' });
      await batch.commit();
    });
    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    wire(ownerDb, { reads: 0, writes: 0 });

    await expect(fetchGenerationRecords(UID, GENERATION)).rejects.toMatchObject({
      code: 'V1_REMOTE_INVALID_RECORD',
    });
  });

  it('delivers a complete server baseline after cache even without docChanges', async () => {
    await pair(operation({ opId: 'baseline' }));
    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    const baseSdk = makeSdk({ reads: 0, writes: 0 });
    const { sdk, listenerOptions } = cacheThenServerSdk(baseSdk);
    wireFirestores({
      db: ownerDb,
      auth: { currentUser: { uid: UID } },
      firestore: sdk,
    });
    const deltas = [];
    const errors = [];
    const unsubscribe = subscribeGeneration(UID, GENERATION, {
      onDelta: delta => deltas.push(delta),
      onError: error => errors.push(error),
    });
    await waitFor(() => listenerOptions.length === COLLECTIONS.length);
    expect(listenerOptions).toEqual(Array.from({ length: COLLECTIONS.length }, () => ({
      includeMetadataChanges: true,
    })));
    await waitFor(() => deltas.some(delta => delta.baseline && delta.entityId === 'e1'));

    const second = operation({ opId: 'second', item: eventItem('e2', 'Segundo') });
    await pair(second);
    await waitFor(() => deltas.some(delta => !delta.baseline && delta.entityId === 'e2'));
    unsubscribe();
    const countAtUnsubscribe = deltas.length;

    await pair(operation({ opId: 'third', item: eventItem('e3', 'Terceiro') }));
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(deltas).toHaveLength(countAtUnsubscribe);
    expect(deltas.find(delta => delta.entityId === 'e1')).toMatchObject({
      collection: 'eventos', baseline: true, changeType: 'added',
    });
    expect(errors).toEqual([]);
  });

  it('deduplicates only when opId, revision and opDigest all match', async () => {
    await pair(operation());
    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    wire(ownerDb, { reads: 0, writes: 0 });
    const deltas = [];
    const errors = [];
    const unsubscribe = subscribeGeneration(UID, GENERATION, {
      onDelta: delta => deltas.push(delta),
      onError: error => errors.push(error),
    });
    await waitFor(() => deltas.some(delta => delta.baseline && delta.entityId === 'e1'));

    const changed = operation({ item: eventItem('e1', 'Outro') });
    await asAdmin(async db => {
      const batch = writeBatch(db);
      batch.set(entityRef(db, changed), entityRecord(changed));
      await batch.commit();
    });
    await waitFor(() => deltas.some(delta => !delta.baseline &&
      delta.entityId === 'e1' && JSON.parse(delta.record.data).data.titulo === 'Outro'));
    unsubscribe();
    expect(errors).toEqual([]);
  });

  it('rejects a listener record from another generation', async () => {
    await pair(operation());
    await activate({ counts: { ...EMPTY_COUNTS, eventos: 1 } });
    wire(ownerDb, { reads: 0, writes: 0 });
    const deltas = [];
    const errors = [];
    const unsubscribe = subscribeGeneration(UID, GENERATION, {
      onDelta: delta => deltas.push(delta),
      onError: error => errors.push(error),
    });
    await waitFor(() => deltas.some(delta => delta.baseline && delta.entityId === 'e1'));

    const foreign = operation({ item: eventItem('e1', 'Outra geração') });
    await asAdmin(async db => {
      const batch = writeBatch(db);
      batch.set(entityRef(db, foreign), { ...entityRecord(foreign), generationId: 'g2' });
      await batch.commit();
    });
    await waitFor(() => errors.length > 0);
    unsubscribe();
    expect(errors[0]).toMatchObject({ code: 'V1_REMOTE_INVALID_RECORD' });
    expect(deltas).toHaveLength(1);
  });
});
