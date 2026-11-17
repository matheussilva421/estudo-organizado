import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { KNOWN_REMOTE_ENTITY_TYPES } from '../../src/platform/sync/remote-schema';

let testEnv: RulesTestEnvironment;
type TestFirestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;
const projectId = 'demo-estudo-v2';
const library = 'library-a';
const uid = 'uid-a';

function entity(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'edital-1',
    entityType: 'edital',
    schemaVersion: 1,
    revision: 1,
    deleted: false,
    payload: { id: 'edital-1', profileId: 'profile-a', title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    epoch: 1,
    uid,
    ...overrides,
  };
}

function operation(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op-1',
    entityId: 'edital-1',
    payloadDigest: 'a'.repeat(64),
    revision: 1,
    changeSequence: 1,
    uid,
    ...overrides,
  };
}

function change(overrides: Record<string, unknown> = {}) {
  return {
    sequence: 1,
    entityId: 'edital-1',
    revision: 1,
    deleted: false,
    epoch: 1,
    operationId: 'op-1',
    uid,
    ...overrides,
  };
}

function head(overrides: Record<string, unknown> = {}) {
  return { epoch: 1, changeSequence: 1, uid, ...overrides };
}

const entityPath = 'users/' + uid + '/libraries/' + library + '/entities/edital-1';
const operationPath = 'users/' + uid + '/libraries/' + library + '/operations/op-1';
const changePath = 'users/' + uid + '/libraries/' + library + '/changes/1';
const headPath = 'users/' + uid + '/libraries/' + library + '/meta/head';
const parentPath = 'users/' + uid + '/libraries/' + library;

function initialBatch(db: TestFirestore) {
  const batch = writeBatch(db);
  batch.set(doc(db, entityPath), entity());
  batch.set(doc(db, operationPath), operation());
  batch.set(doc(db, changePath), change());
  batch.set(doc(db, headPath), head());
  return batch;
}

function revisionTwoBatch(
  db: TestFirestore,
  overrides: { entity?: Record<string, unknown>; operation?: Record<string, unknown>; change?: Record<string, unknown>; head?: Record<string, unknown> } = {},
) {
  const batch = writeBatch(db);
  batch.set(doc(db, entityPath), entity({ revision: 2, ...overrides.entity }));
  batch.set(
    doc(db, 'users/' + uid + '/libraries/' + library + '/operations/op-2'),
    operation({ operationId: 'op-2', revision: 2, changeSequence: 2, ...overrides.operation }),
  );
  batch.set(
    doc(db, 'users/' + uid + '/libraries/' + library + '/changes/2'),
    change({ sequence: 2, revision: 2, operationId: 'op-2', ...overrides.change }),
  );
  batch.set(doc(db, headPath), head({ changeSequence: 2, ...overrides.head }));
  return batch;
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

describe('F7 security residuals', () => {
  it('r1_denies_entity_create_without_audit_trail', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, entityPath), entity()));
    const snapshot = await assertSucceeds(getDoc(doc(db, entityPath)));
    expect(snapshot.exists()).toBe(false);
  });

  it('r1_denies_entity_update_without_audit_trail', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    await assertFails(
      setDoc(doc(db, entityPath), entity({ revision: 2, payload: { id: 'edital-1', profileId: 'profile-a', title: 'UPDATE' } })),
    );
    const entityAfter = await assertSucceeds(getDoc(doc(db, entityPath)));
    expect(entityAfter.data()?.revision).toBe(1);
    const headAfter = await assertSucceeds(getDoc(doc(db, headPath)));
    expect(headAfter.data()?.changeSequence).toBe(1);
    const opAfter = await assertSucceeds(
      getDoc(doc(db, 'users/' + uid + '/libraries/' + library + '/operations/op-2')),
    );
    expect(opAfter.exists()).toBe(false);
    const changeAfter = await assertSucceeds(
      getDoc(doc(db, 'users/' + uid + '/libraries/' + library + '/changes/2')),
    );
    expect(changeAfter.exists()).toBe(false);
  });

  it('r1_denies_isolated_tombstone', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    await assertFails(setDoc(doc(db, entityPath), entity({ revision: 2, deleted: true, payload: null })));
    const entityAfter = await assertSucceeds(getDoc(doc(db, entityPath)));
    expect(entityAfter.data()?.revision).toBe(1);
    expect(entityAfter.data()?.deleted).toBe(false);
  });

  it('r1_allows_full_audited_transaction', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    await assertSucceeds(revisionTwoBatch(db).commit());
  });

  it('r3_entity_type_is_immutable', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    await assertFails(revisionTwoBatch(db, { entity: { entityType: 'disciplina' } }).commit());
  });

  it('r4_denies_parent_library_write', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, parentPath), { owner: uid, schemaVersion: 1 }));
  });

  it('r4_allows_owner_read_and_denies_other_uid', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), parentPath), { owner: uid, schemaVersion: 1 });
    });
    const owner = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(owner, parentPath)));
    const other = testEnv.authenticatedContext('uid-b').firestore();
    await assertFails(getDoc(doc(other, parentPath)));
  });
  it('r1_denies_stale_head_reuse', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    const batch = writeBatch(db);
    batch.set(doc(db, entityPath), entity({ revision: 2 }));
    batch.set(
      doc(db, 'users/' + uid + '/libraries/' + library + '/operations/op-2'),
      operation({ operationId: 'op-2', revision: 2, changeSequence: 2 }),
    );
    batch.set(
      doc(db, 'users/' + uid + '/libraries/' + library + '/changes/2'),
      change({ sequence: 2, revision: 2, operationId: 'op-2' }),
    );
    // The head remains at sequence 1: getAfter alone must not accept a stale head.
    await assertFails(batch.commit());
  });

  it('r1_denies_orphan_change_without_entity_write', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(initialBatch(db).commit());
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'users/' + uid + '/libraries/' + library + '/operations/op-2'),
      operation({ operationId: 'op-2', revision: 1, changeSequence: 2 }),
    );
    batch.set(
      doc(db, 'users/' + uid + '/libraries/' + library + '/changes/2'),
      change({ sequence: 2, revision: 1, operationId: 'op-2' }),
    );
    batch.set(doc(db, headPath), head({ changeSequence: 2 }));
    await assertFails(batch.commit());
  });

  it('r4_denies_parent_library_update_and_delete', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), parentPath), { owner: uid, schemaVersion: 1 });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, parentPath), { owner: uid, schemaVersion: 2 }));
    await assertFails(deleteDoc(doc(db, parentPath)));
  });

  it('r3_unknown_entity_type_is_denied', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, entityPath), entity({ entityType: 'future-type' }));
    batch.set(doc(db, operationPath), operation());
    batch.set(doc(db, changePath), change());
    batch.set(doc(db, headPath), head());
    await assertFails(batch.commit());
  });

  it('r3_known_entity_type_is_allowed', async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, entityPath), entity({ entityType: 'study-session' }));
    batch.set(doc(db, operationPath), operation());
    batch.set(doc(db, changePath), change());
    batch.set(doc(db, headPath), head());
    await assertSucceeds(batch.commit());
  });

  it('r3_rules_allowlist_matches_known_entity_types', () => {
    const rules = readFileSync(resolve('firebase/firestore.rules'), 'utf8');
    for (const entityType of KNOWN_REMOTE_ENTITY_TYPES) {
      expect(rules).toContain("'" + entityType + "'");
    }
  });

});
