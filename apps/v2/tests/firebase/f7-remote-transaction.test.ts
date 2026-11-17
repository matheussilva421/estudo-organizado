import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import type { OutboxOperation } from '../../src/application/sync-types';
import {
  createFirestorePort,
  FirebaseRemotePort,
  RemoteOperationError,
} from '../../src/platform/sync/firebase-remote';

let testEnv: RulesTestEnvironment;
const uid = 'uid-a';
const libraryId = 'library-a';
const profileId = 'profile-a';

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-1',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: 0,
    payload: { id: 'edital-1', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: uid,
    remoteLibraryId: libraryId,
    ...overrides,
  };
}

async function remoteFor(db: ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>) {
  return new FirebaseRemotePort({
    uid,
    remoteLibraryId: libraryId,
    profileId,
    store: await createFirestorePort(db as unknown as Parameters<typeof createFirestorePort>[0]),
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-estudo-v2',
    firestore: {
      host: '127.0.0.1',
      port: 8180,
      rules: readFileSync(resolve('firebase/firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('F7 Firestore remote transaction', () => {
  it('f7_apply_once_idempotently', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const remote = new FirebaseRemotePort({
      uid,
      remoteLibraryId: libraryId,
      profileId,
      store: await createFirestorePort(db as unknown as Parameters<typeof createFirestorePort>[0]),
    });
    await expect(remote.apply(operation())).resolves.toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    await expect(remote.apply(operation())).resolves.toEqual({
      kind: 'ALREADY_APPLIED',
      remoteRevision: 1,
    });

    const entity = await assertSucceeds(
      getDoc(doc(db, `users/${uid}/libraries/${libraryId}/entities/edital-1`)),
    );
    expect(entity.data()?.revision).toBe(1);
    expect(entity.data()?.uid).toBe(uid);
  });

  it('f7_delete_marks_tombstone', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const remote = new FirebaseRemotePort({
      uid,
      remoteLibraryId: libraryId,
      profileId,
      store: await createFirestorePort(db as unknown as Parameters<typeof createFirestorePort>[0]),
    });
    await remote.apply(operation());
    await expect(
      remote.apply(operation({ operationId: 'op-del', kind: 'delete', baseRevision: 1 })),
    ).resolves.toEqual({ kind: 'APPLIED', remoteRevision: 2 });
    const entity = await assertSucceeds(
      getDoc(doc(db, `users/${uid}/libraries/${libraryId}/entities/edital-1`)),
    );
    expect(entity.data()?.deleted).toBe(true);
    expect(entity.data()?.payload).toBeNull();
  });
  it('r2_same_operation_same_payload_concurrent_single_effect', async () => {
    const dbA = testEnv.authenticatedContext(uid).firestore();
    const dbB = testEnv.authenticatedContext(uid).firestore();
    const remoteA = await remoteFor(dbA);
    const remoteB = await remoteFor(dbB);

    const results = await Promise.all([remoteA.apply(operation()), remoteB.apply(operation())]);
    expect(results.map((result) => result.kind).sort()).toEqual(['ALREADY_APPLIED', 'APPLIED']);
    expect(results.every((result) => result.remoteRevision === 1)).toBe(true);

    const entity = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/entities/edital-1')),
    );
    expect(entity.data()?.revision).toBe(1);
    const receipt = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/operations/op-1')),
    );
    expect(receipt.exists()).toBe(true);
    const change = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/changes/1')),
    );
    expect(change.exists()).toBe(true);
    const head = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/meta/head')),
    );
    expect(head.data()?.changeSequence).toBe(1);
    await expect(remoteA.apply(operation())).resolves.toEqual({
      kind: 'ALREADY_APPLIED',
      remoteRevision: 1,
    });
  });

  it('r2_same_operation_different_payload_concurrent_rejects_mismatch', async () => {
    const dbA = testEnv.authenticatedContext(uid).firestore();
    const dbB = testEnv.authenticatedContext(uid).firestore();
    const remoteA = await remoteFor(dbA);
    const remoteB = await remoteFor(dbB);
    const divergent = operation({
      payload: { id: 'edital-1', profileId, title: 'DIVERGENT', status: 'ACTIVE', localRevision: 2 },
    });

    const results = await Promise.allSettled([remoteA.apply(operation()), remoteB.apply(divergent)]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const applied = fulfilled[0]!;
    expect(applied.status).toBe('fulfilled');
    if (applied.status === 'fulfilled') {
      expect(applied.value.kind).toBe('APPLIED');
    }
    const failed = rejected[0]!;
    expect(failed.status).toBe('rejected');
    if (failed.status === 'rejected') {
      expect(failed.reason).toBeInstanceOf(RemoteOperationError);
      expect(String(failed.reason.message)).toContain('different payload');
    }

    const entity = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/entities/edital-1')),
    );
    expect(entity.data()?.revision).toBe(1);
    const receipt = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/operations/op-1')),
    );
    expect(receipt.exists()).toBe(true);
    const secondChange = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/changes/2')),
    );
    expect(secondChange.exists()).toBe(false);
  });

  it('r2_two_operation_ids_same_entity_concurrent_one_wins', async () => {
    const dbA = testEnv.authenticatedContext(uid).firestore();
    const dbB = testEnv.authenticatedContext(uid).firestore();
    const remoteA = await remoteFor(dbA);
    const remoteB = await remoteFor(dbB);
    const opA = operation({
      operationId: 'op-a',
      payload: { id: 'edital-1', profileId, title: 'A', status: 'ACTIVE', localRevision: 2 },
    });
    const opB = operation({
      operationId: 'op-b',
      payload: { id: 'edital-1', profileId, title: 'B', status: 'ACTIVE', localRevision: 2 },
    });

    const results = await Promise.all([remoteA.apply(opA), remoteB.apply(opB)]);
    expect(results.map((result) => result.kind).sort()).toEqual(['APPLIED', 'CONFLICT']);
    const entity = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/entities/edital-1')),
    );
    expect(entity.data()?.revision).toBe(1);
    const head = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/meta/head')),
    );
    expect(head.data()?.changeSequence).toBe(1);
  });

  it('r2_concurrent_after_tombstone_is_single_effect', async () => {
    const dbA = testEnv.authenticatedContext(uid).firestore();
    const dbB = testEnv.authenticatedContext(uid).firestore();
    const remoteA = await remoteFor(dbA);
    const remoteB = await remoteFor(dbB);
    await remoteA.apply(operation());
    await remoteA.apply(operation({ operationId: 'op-del', kind: 'delete', baseRevision: 1 }));

    const opA = operation({
      operationId: 'op-a',
      baseRevision: 2,
      payload: { id: 'edital-1', profileId, title: 'RESTORED', status: 'ACTIVE', localRevision: 3 },
    });
    const opB = operation({ operationId: 'op-b', baseRevision: 2, kind: 'delete' });
    const results = await Promise.all([remoteA.apply(opA), remoteB.apply(opB)]);
    expect(results.map((result) => result.kind).sort()).toEqual(['APPLIED', 'CONFLICT']);

    const entity = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/entities/edital-1')),
    );
    expect(entity.data()?.revision).toBe(3);
    const head = await assertSucceeds(
      getDoc(doc(dbA, 'users/' + uid + '/libraries/' + libraryId + '/meta/head')),
    );
    expect(head.data()?.changeSequence).toBe(3);
  });

});
