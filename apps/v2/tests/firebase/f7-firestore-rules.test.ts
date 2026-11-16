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

function change(uid: string, sequence = 1, entityId = 'edital-1', operationId = 'op-1') {
  return { sequence, entityId, revision: 1, deleted: false, epoch: 1, operationId, uid };
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
    const badDigest = writeBatch(db);
    badDigest.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    badDigest.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), {
      ...operation('uid-a'),
      payloadDigest: 'not-a-digest',
    });
    badDigest.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    badDigest.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(badDigest.commit());
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

  it('f7_rules_deny_future_schema_version', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
        ...entity('uid-a'),
        schemaVersion: 99,
      }),
    );
  });

  it('f7_rules_bind_change_id_to_sequence', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a', 2)),
    );
    const initial = writeBatch(db);
    initial.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertSucceeds(initial.commit());

    const next = writeBatch(db);
    next.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
      ...entity('uid-a'),
      revision: 2,
    });
    next.set(doc(db, `users/uid-a/libraries/${library}/operations/op-2`), {
      ...operation('uid-a', 'op-2'),
      revision: 2,
      changeSequence: 2,
    });
    next.set(doc(db, `users/uid-a/libraries/${library}/changes/2`), {
      ...change('uid-a', 2, 'edital-1', 'op-2'),
      revision: 2,
    });
    next.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
      ...head('uid-a'),
      changeSequence: 2,
    });
    await assertSucceeds(next.commit());
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

  it('f7_rules_require_entity_change_and_head_in_the_receipt_transaction', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const missingEntity = writeBatch(db);
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(missingEntity.commit());

    const mismatchedRevision = writeBatch(db);
    mismatchedRevision.set(
      doc(db, `users/uid-a/libraries/${library}/entities/edital-1`),
      { ...entity('uid-a'), revision: 2 },
    );
    mismatchedRevision.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    mismatchedRevision.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    mismatchedRevision.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(mismatchedRevision.commit());
  });

  it('f7_rules_bind_change_fields_to_the_entity_head_and_receipt', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const mismatchedChange = writeBatch(db);
    mismatchedChange.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    mismatchedChange.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    mismatchedChange.set(
      doc(db, `users/uid-a/libraries/${library}/changes/1`),
      { ...change('uid-a'), revision: 2 },
    );
    mismatchedChange.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(mismatchedChange.commit());

    const mismatchedDeletion = writeBatch(db);
    mismatchedDeletion.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    mismatchedDeletion.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    mismatchedDeletion.set(
      doc(db, `users/uid-a/libraries/${library}/changes/1`),
      { ...change('uid-a'), deleted: true },
    );
    mismatchedDeletion.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(mismatchedDeletion.commit());

    const mismatchedEpoch = writeBatch(db);
    mismatchedEpoch.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    mismatchedEpoch.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    mismatchedEpoch.set(
      doc(db, `users/uid-a/libraries/${library}/changes/1`),
      { ...change('uid-a'), epoch: 2 },
    );
    mismatchedEpoch.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(mismatchedEpoch.commit());
  });

  it('f7_rules_reject_a_head_that_jumps_without_its_change', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const initial = writeBatch(db);
    initial.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertSucceeds(initial.commit());

    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
        ...head('uid-a'),
        changeSequence: 5,
      }),
    );
    await assertFails(
      setDoc(doc(db, `users/uid-a/libraries/${library}/changes/5`), change('uid-a', 5)),
    );

    const next = writeBatch(db);
    next.set(doc(db, `users/uid-a/libraries/${library}/changes/5`), change('uid-a', 5));
    next.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
      ...head('uid-a'),
      changeSequence: 5,
    });
    await assertFails(next.commit());

    const sequential = writeBatch(db);
    sequential.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
      ...entity('uid-a'),
      revision: 2,
    });
    sequential.set(doc(db, `users/uid-a/libraries/${library}/operations/op-2`), {
      ...operation('uid-a', 'op-2'),
      revision: 2,
      changeSequence: 2,
    });
    sequential.set(doc(db, `users/uid-a/libraries/${library}/changes/2`), {
      ...change('uid-a', 2, 'edital-1', 'op-2'),
      revision: 2,
    });
    sequential.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
      ...head('uid-a'),
      changeSequence: 2,
    });
    await assertSucceeds(sequential.commit());
  });
  it('f7_rules_deny_entity_revision_regression_or_jump', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();
    const initial = writeBatch(db);
    initial.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    initial.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertSucceeds(initial.commit());

    const regression = writeBatch(db);
    regression.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
      ...entity('uid-a'),
      revision: 1,
    });
    regression.set(doc(db, `users/uid-a/libraries/${library}/operations/op-2`), {
      ...operation('uid-a', 'op-2'),
      changeSequence: 2,
    });
    regression.set(doc(db, `users/uid-a/libraries/${library}/changes/2`), change('uid-a', 2));
    regression.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
      ...head('uid-a'),
      changeSequence: 2,
    });
    await assertFails(regression.commit());

    const jump = writeBatch(db);
    jump.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), {
      ...entity('uid-a'),
      revision: 3,
    });
    jump.set(doc(db, `users/uid-a/libraries/${library}/operations/op-2`), {
      ...operation('uid-a', 'op-2'),
      revision: 3,
      changeSequence: 2,
    });
    jump.set(doc(db, `users/uid-a/libraries/${library}/changes/2`), {
      ...change('uid-a', 2),
      revision: 3,
    });
    jump.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), {
      ...head('uid-a'),
      changeSequence: 2,
    });
    await assertFails(jump.commit());
  });

  it('f7_rules_deny_change_without_matching_entity_or_receipt', async () => {
    const db = testEnv.authenticatedContext('uid-a').firestore();

    const missingEntity = writeBatch(db);
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    missingEntity.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(missingEntity.commit());

    const missingReceipt = writeBatch(db);
    missingReceipt.set(doc(db, `users/uid-a/libraries/${library}/entities/edital-1`), entity('uid-a'));
    missingReceipt.set(doc(db, `users/uid-a/libraries/${library}/changes/1`), change('uid-a'));
    missingReceipt.set(doc(db, `users/uid-a/libraries/${library}/meta/head`), head('uid-a'));
    await assertFails(missingReceipt.commit());

    const mismatchedEntity = writeBatch(db);
    mismatchedEntity.set(
      doc(db, `users/uid-a/libraries/${library}/entities/edital-1`),
      { ...entity('uid-a'), epoch: 1 },
    );
    mismatchedEntity.set(doc(db, `users/uid-a/libraries/${library}/operations/op-1`), operation('uid-a'));
    mismatchedEntity.set(
      doc(db, `users/uid-a/libraries/${library}/changes/1`),
      { ...change('uid-a'), epoch: 2 },
    );
    mismatchedEntity.set(
      doc(db, `users/uid-a/libraries/${library}/meta/head`),
      { ...head('uid-a'), epoch: 2 },
    );
    await assertFails(mismatchedEntity.commit());
  });

});
