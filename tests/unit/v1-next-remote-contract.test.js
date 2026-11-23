// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { encodeDocId, encodeRecordData } from '../../src/js/sync/v1-next/contracts.js';
import {
  applyRemoteOperation,
  fetchGenerationRecords,
  getCurrentGeneration,
  subscribeGeneration,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';

const stamp = { seconds: 1, nanoseconds: 0 };
const manifest = {
  schemaVersion: 1,
  generationId: 'g1',
  migrationId: 'm1',
  state: 'active',
  revision: 0,
  sourceSha256: 'a'.repeat(64),
  businessDigest: 'b'.repeat(64),
  counts: {
    total: 0,
    byCollection: {
      editais: 0, disciplinas: 0, eventos: 0, habitos: 0,
      retaFinalBlocos: 0, meta: 0, tombstones: 0,
    },
  },
  updatedAt: stamp,
};
const control = { schemaVersion: 1, generationId: 'g1', updatedAt: stamp };
const item = {
  key: 'evento:e1', entityType: 'evento', entityId: 'e1',
  path: ['eventos', 0], data: { id: 'e1', titulo: 'Sintético' },
};
const dataText = encodeRecordData(item);
const digest = value => createHash('sha256').update(value ?? 'null').digest('hex');

function operation(overrides = {}) {
  return {
    opId: 'op1', uid: 'A', generationId: 'g1', entityKey: item.key,
    entityType: item.entityType, entityId: item.entityId, collection: 'eventos',
    path: item.path, baseRevision: 0, revision: 1, action: 'upsert',
    data: item.data, dataText, opDigest: digest(dataText), status: 'pending',
    ...overrides,
  };
}

function snapshot(value, id = '') {
  return {
    id,
    metadata: { fromCache: false },
    exists: () => value !== null && value !== undefined,
    data: () => value,
  };
}

function ref(path) {
  return { path };
}

function sdkWith({
  documents = new Map(),
  transaction = null,
  onSnapshot = null,
} = {}) {
  const paths = {
    control: 'users/A/v1SyncControl/current',
    manifest: 'users/A/v1SyncNamespaces/g1',
    receipt: 'users/A/v1SyncNamespaces/g1/operations/op1',
    entity: `users/A/v1SyncNamespaces/g1/eventos/${encodeDocId(item.key)}`,
  };
  const read = async (target) => snapshot(documents.get(target.path), target.path.split('/').at(-1));
  return {
    paths,
    sdk: {
      collection: (_db, ...segments) => ref(segments.join('/')),
      doc: (_db, ...segments) => ref(segments.join('/')),
      getDoc: read,
      getDocs: vi.fn(async (collectionRef) => {
        const prefix = collectionRef.path + '/';
        const docs = [...documents.entries()]
          .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .map(([path, value]) => snapshot(value, path.slice(prefix.length)));
        return { docs };
      }),
      onSnapshot: onSnapshot || vi.fn(() => () => {}),
      runTransaction: transaction || vi.fn(async (_db, work) => work({
        get: read,
        set: () => { throw new Error('unexpected write'); },
      })),
      serverTimestamp: () => ({ __serverTimestamp: true }),
    },
  };
}

function configure(fake, auth = { currentUser: { uid: 'A' } }, isOnline = undefined) {
  return wireFirestores({ db: { name: 'fake-db' }, auth, firestore: fake.sdk, isOnline });
}

describe('V1 remote injected contract', () => {
  it('validates the active control and manifest before returning a generation', async () => {
    const fake = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]) });
    configure(fake);
    const current = await getCurrentGeneration('A');
    expect(current).toMatchObject({ uid: 'A', generationId: 'g1', control, manifest });

    const inactive = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', { ...manifest, state: 'verified' }],
    ]) });
    configure(inactive);
    await expect(getCurrentGeneration('A')).rejects.toMatchObject({
      code: 'V1_REMOTE_GENERATION_INACTIVE',
    });
  });

  it('rejects a malformed operation before opening a transaction', async () => {
    const fake = sdkWith();
    configure(fake);
    const runTransaction = vi.fn();
    fake.sdk.runTransaction = runTransaction;
    await expect(applyRemoteOperation(operation({ dataText: dataText.replace('Sintético', 'Alterado') })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_INVALID_OPERATION' });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('replays only an identical receipt and rejects opId reuse with other content', async () => {
    const receipt = {
      schemaVersion: 1, generationId: 'g1', collection: 'eventos', entityType: 'evento',
      entityId: 'e1', revision: 1, baseRevision: 0, opId: 'op1', opDigest: digest(dataText),
      deleted: false, updatedAt: stamp,
    };
    const documents = new Map([
      ['users/A/v1SyncNamespaces/g1/operations/op1', receipt],
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]);
    const set = vi.fn();
    const fake = sdkWith({
      documents,
      transaction: vi.fn(async (_db, work) => work({ get: async target =>
        snapshot(documents.get(target.path), target.path.split('/').at(-1)), set })),
    });
    configure(fake);
    await expect(applyRemoteOperation(operation())).resolves.toMatchObject({
      opId: 'op1', entityId: 'e1', revision: 1, acknowledged: true,
    });
    expect(set).not.toHaveBeenCalled();

    await expect(applyRemoteOperation(operation({ data: { id: 'e1', titulo: 'Outro' },
      dataText: encodeRecordData({ ...item, data: { id: 'e1', titulo: 'Outro' } }),
      opDigest: digest(encodeRecordData({ ...item, data: { id: 'e1', titulo: 'Outro' } })) })))
      .rejects.toMatchObject({ code: 'V1_REMOTE_OP_CONFLICT' });
  });

  it('surfaces timeout without a false ACK so the durable receipt can be retried', async () => {
    const timeout = Object.assign(new Error('deadline exceeded'), { code: 'deadline-exceeded' });
    const fake = sdkWith({ transaction: vi.fn(async () => { throw timeout; }) });
    configure(fake);
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_TIMEOUT',
    });
  });

  it('surfaces an offline transaction failure without a false ACK', async () => {
    const fake = sdkWith();
    const runTransaction = vi.fn();
    fake.sdk.runTransaction = runTransaction;
    configure(fake, { currentUser: { uid: 'A' } }, () => false);
    await expect(applyRemoteOperation(operation())).rejects.toMatchObject({
      code: 'V1_REMOTE_OFFLINE',
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('shares listeners, emits a validated baseline before deltas and fully unsubscribes', async () => {
    const document = {
      schemaVersion: 1, generationId: 'g1', collection: 'eventos', entityType: 'evento',
      entityId: 'e1', revision: 1, baseRevision: 0, opId: 'op1', opDigest: digest(dataText),
      deleted: false, data: dataText, updatedAt: stamp,
    };
    const unsubscribers = [];
    const registrations = new Map();
    const fake = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]) });
    fake.sdk.onSnapshot = vi.fn((collectionRef, next) => {
      registrations.set(collectionRef.path, next);
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    });
    configure(fake);
    const first = { onDelta: vi.fn(), onError: vi.fn() };
    const second = { onDelta: vi.fn(), onError: vi.fn() };
    const stopFirst = subscribeGeneration('A', 'g1', first);
    const stopSecond = subscribeGeneration('A', 'g1', second);
    await vi.waitFor(() => expect(fake.sdk.onSnapshot).toHaveBeenCalledTimes(7));

    const eventPath = fake.sdk.collection(fake.sdk, 'users/A/v1SyncNamespaces/g1/eventos').path;
    registrations.get(eventPath)({
      metadata: { fromCache: false },
      docs: [snapshot(document, encodeDocId(item.key))],
      docChanges: () => [{ type: 'added', doc: snapshot(document, encodeDocId(item.key)) }],
    });
    expect(first.onDelta).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'eventos', entityId: 'e1', changeType: 'added', baseline: true,
    }));
    expect(second.onDelta).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'eventos', entityId: 'e1', changeType: 'added', baseline: true,
    }));

    stopFirst();
    stopSecond();
    expect(unsubscribers).toHaveLength(7);
    expect(unsubscribers.every(unsubscribe => unsubscribe.mock.calls.length === 1)).toBe(true);
  });

  it('reports listener errors and fails closed on an invalid record', async () => {
    let eventNext;
    const fake = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]) });
    fake.sdk.onSnapshot = vi.fn((collectionRef, next) => {
      if (collectionRef.path.endsWith('/eventos')) eventNext = next;
      return () => {};
    });
    configure(fake);
    const handlers = { onDelta: vi.fn(), onError: vi.fn() };
    subscribeGeneration('A', 'g1', handlers);
    await vi.waitFor(() => expect(fake.sdk.onSnapshot).toHaveBeenCalledTimes(7));
    eventNext({
      metadata: { fromCache: false },
      docs: [],
      docChanges: () => [{ type: 'added', doc: snapshot({ generationId: 'wrong' }, 'bad') }],
    });
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({
      code: 'V1_REMOTE_INVALID_RECORD',
    }));
    expect(handlers.onDelta).not.toHaveBeenCalled();
  });

  it('forwards a Firestore listener error to every active subscriber', async () => {
    let failListener;
    const fake = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]) });
    fake.sdk.onSnapshot = vi.fn((collectionRef, _next, onError) => {
      if (collectionRef.path.endsWith('/eventos')) failListener = onError;
      return () => {};
    });
    configure(fake);
    const first = { onDelta: vi.fn(), onError: vi.fn() };
    const second = { onDelta: vi.fn(), onError: vi.fn() };
    subscribeGeneration('A', 'g1', first);
    subscribeGeneration('A', 'g1', second);
    await vi.waitFor(() => expect(fake.sdk.onSnapshot).toHaveBeenCalledTimes(7));
    failListener(Object.assign(new Error('transport lost'), { code: 'unavailable' }));
    for (const handlers of [first, second]) {
      expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'V1_REMOTE_UNAVAILABLE',
      }));
    }
  });

  it('fails closed while fetching unless manifest counts match every live collection', async () => {
    const fake = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', manifest],
    ]) });
    configure(fake);
    await expect(fetchGenerationRecords('A', 'g1')).resolves.toMatchObject({
      generationId: 'g1', records: [], manifest,
    });

    const mismatched = sdkWith({ documents: new Map([
      ['users/A/v1SyncControl/current', control],
      ['users/A/v1SyncNamespaces/g1', { ...manifest,
        counts: { total: 1, byCollection: { ...manifest.counts.byCollection, eventos: 1 } } }],
    ]) });
    configure(mismatched);
    await expect(fetchGenerationRecords('A', 'g1')).rejects.toMatchObject({
      code: 'V1_REMOTE_MANIFEST_MISMATCH',
    });
  });
});
