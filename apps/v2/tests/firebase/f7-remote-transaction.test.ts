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
import { createFirestorePort, FirebaseRemotePort } from '../../src/platform/sync/firebase-remote';

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
  it('f7_apply_once_under_concurrency', async () => {
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
});
