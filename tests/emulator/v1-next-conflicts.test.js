import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  encodeDocId,
  encodeRecordData,
  mergeIndependentRecords,
} from '../../src/js/sync/v1-next/contracts.js';
import {
  applyRemoteOperation,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';

const PROJECT_ID = 'demo-estudo-v1-conflicts';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emulatorSeparator = emulatorHost.lastIndexOf(':');
const EMULATOR = { host: emulatorHost.slice(0, emulatorSeparator),
  port: Number(emulatorHost.slice(emulatorSeparator + 1)) };
const UID = 'A';
const GENERATION = 'g1';
const ROOT = `users/${UID}/v1SyncNamespaces/${GENERATION}`;
const COLLECTIONS = [
  'editais', 'disciplinas', 'eventos', 'habitos', 'retaFinalBlocos', 'meta', 'tombstones',
];
const EMPTY_COUNTS = Object.fromEntries(COLLECTIONS.map(name => [name, 0]));
const digest = value => createHash('sha256').update(value ?? 'null').digest('hex');

let env;
let ownerDb;

function eventItem(id = 'e1', overrides = {}) {
  return {
    key: `evento:${id}`,
    entityType: 'evento',
    entityId: id,
    path: ['eventos', 0],
    data: { id, titulo: 'Base', notas: 'Base notes', ...overrides },
  };
}

function operation({
  opId = 'op1',
  baseRevision = 0,
  action = 'upsert',
  item = eventItem(),
  baseRecord = null,
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
    baseRecord,
    data: deleted ? null : item.data,
    dataText,
    opDigest: digest(dataText),
    status: 'pending',
  };
}

function makeSdk() {
  return {
    collection,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer: getDocs,
    onSnapshot: () => () => {},
    runTransaction: async (db, callback) => runTransaction(db, transaction => callback({
      get: ref => transaction.get(ref),
      set: (ref, value) => transaction.set(ref, value),
    })),
    serverTimestamp,
  };
}

function wire(db, uid = UID) {
  return wireFirestores({
    db,
    auth: { currentUser: { uid } },
    firestore: makeSdk(),
  });
}

async function asAdmin(work) {
  return env.withSecurityRulesDisabled(async context => work(context.firestore()));
}

async function activate(uid = UID, generationId = GENERATION) {
  await asAdmin(async db => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'v1SyncControl', 'current'), {
      schemaVersion: 1,
      generationId,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid, 'v1SyncNamespaces', generationId), {
      schemaVersion: 1,
      generationId,
      migrationId: `migration_${uid}`,
      state: 'active',
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: 'b'.repeat(64),
      counts: { total: 0, byCollection: EMPTY_COUNTS },
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  });
}

async function read(path) {
  const snapshot = await getDoc(doc(ownerDb, path));
  return snapshot.exists() ? snapshot.data() : null;
}

async function operationCount(root = ROOT) {
  let count = 0;
  await asAdmin(async db => {
    count = (await getDocs(collection(db, ...root.split('/'), 'operations'))).size;
  });
  return count;
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
  await activate('B');
  ownerDb = env.authenticatedContext(UID).firestore();
  wire(ownerDb);
});

afterAll(async () => {
  await env?.cleanup();
});

describe('V1 conflict CAS and tombstones', () => {
  it('merges independent fields through an explicit rebase and applies exactly one effect', async () => {
    const base = eventItem();
    await applyRemoteOperation(operation({ baseRecord: null }));
    await applyRemoteOperation(operation({
      opId: 'remote_title',
      baseRevision: 1,
      baseRecord: base,
      item: eventItem('e1', { titulo: 'Remote title' }),
    }));
    const local = eventItem('e1', { notas: 'Local notes' });
    const localOperation = operation({
      opId: 'local_notes',
      baseRevision: 1,
      baseRecord: base,
      item: local,
    });
    const conflict = await applyRemoteOperation(localOperation);
    expect(conflict).toMatchObject({
      acknowledged: false,
      conflict: {
        code: 'revision',
        baseRevision: 1,
        remoteRevision: 2,
        baseRecord: base,
        localRecord: local,
        remoteRecord: { revision: 2 },
      },
    });

    const remote = JSON.parse(conflict.conflict.remoteRecord.data);
    const merged = mergeIndependentRecords({ base, local, remote });
    expect(merged).toMatchObject({ merged: true, record: {
      data: { titulo: 'Remote title', notas: 'Local notes' },
    } });
    const rebased = operation({
      ...localOperation,
      opId: localOperation.opId,
      baseRevision: 2,
      baseRecord: remote,
      item: merged.record,
    });
    await expect(applyRemoteOperation(rebased)).resolves.toMatchObject({
      opId: 'local_notes',
      revision: 3,
      acknowledged: true,
    });

    const stored = await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`);
    expect(JSON.parse(stored.data).data).toMatchObject({
      titulo: 'Remote title',
      notas: 'Local notes',
    });
    expect(await operationCount()).toBe(3);
  });

  it('returns a recoverable conflict for the same field without writing either losing version', async () => {
    const base = eventItem();
    await applyRemoteOperation(operation());
    await applyRemoteOperation(operation({
      opId: 'remote_title',
      baseRevision: 1,
      item: eventItem('e1', { titulo: 'Remote title' }),
    }));
    const local = eventItem('e1', { titulo: 'Local title' });
    const result = await applyRemoteOperation(operation({
      opId: 'local_title',
      baseRevision: 1,
      baseRecord: base,
      item: local,
    }));
    expect(result).toMatchObject({
      acknowledged: false,
      conflict: {
        code: 'revision',
        remoteRevision: 2,
        baseRecord: base,
        localRecord: local,
      },
    });
    expect(await operationCount()).toBe(2);
    expect(JSON.parse((await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`)).data).data.titulo)
      .toBe('Remote title');
  });

  it('makes delete terminal for replay and later updates', async () => {
    const original = operation();
    await applyRemoteOperation(original);
    await applyRemoteOperation(operation({
      opId: 'delete',
      baseRevision: 1,
      action: 'delete',
    }));

    await expect(applyRemoteOperation(original)).resolves.toMatchObject({
      acknowledged: true,
      revision: 1,
    });
    const update = await applyRemoteOperation(operation({
      opId: 'late_update',
      baseRevision: 2,
      item: eventItem('e1', { titulo: 'Resurrect?' }),
    }));
    expect(update).toMatchObject({
      acknowledged: false,
      conflict: { code: 'tombstone', remoteDeleted: true, remoteRevision: 2 },
    });
    expect((await read(`${ROOT}/eventos/${encodeDocId('evento:e1')}`)).deleted).toBe(true);
    expect(await operationCount()).toBe(2);
  });

  it('blocks an old generation and keeps another account isolated', async () => {
    await activate(UID, 'g2');
    await expect(applyRemoteOperation(operation({ generationId: GENERATION })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_GENERATION_INVALID' });

    const dbB = env.authenticatedContext('B').firestore();
    wire(dbB, 'B');
    await expect(applyRemoteOperation(operation({ uid: UID, opId: 'cross_uid' })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_UID_MISMATCH' });
    expect(await operationCount(ROOT)).toBe(0);
    expect(await operationCount('users/B/v1SyncNamespaces/g1')).toBe(0);
  });
});
