import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxEntityType, OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { canDeliver, type DeliveryBinding } from '../../src/platform/sync/delivery-policy';
import { applyRemoteChange } from '../../src/platform/sync/apply-remote';
import type { RemoteEntity } from '../../src/platform/sync/remote-schema';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import { previewLink } from '../../src/application/sync-policy';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-delivery-types';
const uid = 'uid-a';
const libraryId = 'library-a';

const ENTITY_TYPES: OutboxEntityType[] = [
  'subject',
  'edital',
  'edital-discipline',
  'assunto',
  'aula',
  'lesson-topic-link',
  'planning-scenario',
  'plan-block',
  'study-session',
  'habit-occurrence',
  'review-topic',
  'review-policy',
  'review-commitment',
  'review-execution',
  'review-board-evidence',
  'review-match',
  'review-priority',
];

function profile(): ProfileRecord {
  return {
    profileId,
    uid,
    remoteLibraryId: libraryId,
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
  };
}

function operation(entityType: OutboxEntityType, index: number): OutboxOperation {
  const entityId = `entity-${index}`;
  return {
    operationId: `op-${index}`,
    profileId,
    entityType,
    entityId,
    kind: 'upsert',
    baseRevision: 0,
    payload: { id: entityId, profileId, localRevision: 1 } as never,
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: uid,
    remoteLibraryId: libraryId,
  };
}

function binding(index: number): DeliveryBinding {
  return {
    operationId: `op-${index}`,
    profileId,
    deliveryUid: uid,
    remoteLibraryId: libraryId,
    attempts: 0,
    nextRetryAt: null,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 delivery for every academic entity type', () => {
  it('f7_all_entity_types_pass_the_delivery_gate', () => {
    ENTITY_TYPES.forEach((entityType, index) => {
      expect(canDeliver(operation(entityType, index), binding(index), profile())).toBe(true);
    });
  });

  it('f7_legacy_blocked_rows_stay_local', () => {
    expect(
      canDeliver(
        { ...operation('planning-scenario', 0), deliveryMode: 'BLOCKED' },
        binding(0),
        profile(),
      ),
    ).toBe(false);
  });

  it('f7_remote_application_routes_every_entity_type_to_its_store', async () => {
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.profiles, 'readwrite');
    tx.objectStore(STORES.profiles).put(profile());
    await transactionDone(tx);

    for (const [index, entityType] of ENTITY_TYPES.entries()) {
      const entityId = `entity-${index}`;
      const entity: RemoteEntity = {
        entityId,
        entityType,
        schemaVersion: 1,
        revision: 1,
        deleted: false,
        payload: { id: entityId, profileId, localRevision: 1 } as never,
        epoch: 1,
      };
      await expect(
        applyRemoteChange(
          profileId,
          { uid, libraryId },
          { sequence: index + 1, entityId, revision: 1, deleted: false, epoch: 1 },
          entity,
        ),
      ).resolves.toBe('APPLIED');
    }
  });

  it('f7_link_consent_clears_the_legacy_blocked_flag', async () => {
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.outbox, 'readwrite');
    tx.objectStore(STORES.outbox).put({
      ...operation('planning-scenario', 0),
      deliveryMode: 'BLOCKED',
      deliveryUid: null,
      remoteLibraryId: null,
    });
    await transactionDone(tx);
    const before = Date.now();
    const preview = previewLink(profileId, uid, { remoteCount: 0, remoteLibraryId: libraryId }, before);
    const profiles = new LocalProfileRepository();
    const result = await profiles.adoptLocalOperations(profileId, uid, libraryId, {
      profileId,
      uid,
      remoteLibraryId: libraryId,
      consent: true,
      preview,
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const read = await openV2Database(profileId);
    const readTx = read.transaction(STORES.outbox, 'readonly');
    const stored = (await requestResult(readTx.objectStore(STORES.outbox).get('op-0'))) as
      | OutboxOperation
      | undefined;
    expect(stored?.deliveryMode).toBeUndefined();
    expect(stored?.deliveryUid).toBe(uid);
  });
});
