import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = 'demo-estudo-v2';
const library = 'library-a';

function entity(uid: string, entityId = 'edital-1') {
  return {
    entityId,
    entityType: 'edital',
    schemaVersion: 1,
    revision: 1,
    deleted: false,
    payload: { id: entityId, profileId: 'profile-a', title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    epoch: 1,
    uid,
  };
}

function operation(uid: string, operationId = 'op-1', entityId = 'edital-1') {
  return {
    operationId,
    entityId,
    payloadDigest: 'a'.repeat(64),
    revision: 1,
    changeSequence: 1,
    uid,
  };
}

function change(uid: string, sequence = 1, entityId = 'edital-1') {
  return { sequence, entityId, revision: 1, deleted: false, epoch: 1, uid };
}

function head(uid: string) {
  return { epoch: 1, changeSequence: 1, uid };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
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

describe('F7 Firestore rules', () => {
  it('f7_rules_deny_unauthenticated', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`)));
    await assertFails(setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a')));
  });

  it('f7_rules_deny_other_uid', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(getDoc(doc(db, `users/uid-b/libraries/${library}/entities/edital-1`)));
    await assertFails(setDoc(doc(db, `users/uid-b/libraries/${library}/entities/edital-1`), entity('uid-b')));
  });

  it('f7_rules_deny_invalid_schema', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
        ...entity('uid-a'),
        schemaVersion: 0,
      }),
    );
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
        ...entity('uid-a'),
        revision: -1,
      }),
    );
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), {
        ...operation('uid-a'),
        payloadDigest: 'not-a-digest',
      }),
    );
  });

  it('f7_rules_deny_a_tombstone_with_payload', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const path = `users/uid-a/libraries/${library}/entities/edital-1`;
    await assertFails(
      setDoc(doc(db, path), {
        ...entity('uid-a'),
        deleted: true,
        payload: { id: 'edital-1', title: 'não deveria existir' },
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, path), {
        ...entity('uid-a'),
        deleted: true,
        payload: null,
      }),
    );
  });

  it('f7_rules_bind_change_id_to_sequence', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a', 2)),
    );
    await assertSucceeds(
      setDoc(doc(db, `users/uid-a/libraries/${library}/changes/2`), change('uid-a', 2)),
    );
  });

  it('f7_rules_deny_forged_revision_or_scope', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-b')),
    );
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
        ...entity('uid-a'),
        entityId: 'edital-2',
      }),
    );
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a', 'op-2')),
    );
    await assertFails(deleteDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`)));
  });

  it('f7_rules_allow_authorized_transaction', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    batch.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    batch.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    batch.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertSucceeds(batch.commit());

    await assertSucceeds(getDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`)));
  });
});
