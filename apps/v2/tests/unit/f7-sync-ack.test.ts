import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { confirmRemoteOperation } from '../../src/platform/sync/ack';
import { digestPayload } from '../../src/platform/sync/firebase-remote';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-ack';
const uid = 'uid-a';
const libraryId = 'library-a';

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

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-ack',
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

async function seed(record: OutboxOperation): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction([STORES.profiles, STORES.outbox], 'readwrite');
  tx.objectStore(STORES.profiles).put(profile());
  tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

async function read(): Promise<OutboxOperation | undefined> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.outbox, 'readonly');
  return requestResult(tx.objectStore(STORES.outbox).get('op-ack')) as Promise<
    OutboxOperation | undefined
  >;
}

async function proofFor(record: OutboxOperation, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    remoteLibraryId: libraryId,
    entityId: record.entityId,
    revision: 1,
    operationDigest: await digestPayload(record.payload),
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 sync ACK', () => {
  it('f7_ack_rejects_uid_mismatch', async () => {
    const record = operation();
    await seed(record);
    await expect(
      confirmRemoteOperation(profileId, record.operationId, await proofFor(record, { uid: 'uid-b' })),
    ).resolves.toBe('MISMATCH');
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_ack_rejects_remote_library_mismatch', async () => {
    const record = operation();
    await seed(record);
    await expect(
      confirmRemoteOperation(
        profileId,
        record.operationId,
        await proofFor(record, { remoteLibraryId: 'library-b' }),
      ),
    ).resolves.toBe('MISMATCH');
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_ack_rejects_future_or_unproven_revision', async () => {
    const record = operation();
    await seed(record);
    await expect(
      confirmRemoteOperation(profileId, record.operationId, await proofFor(record, { revision: 99 })),
    ).resolves.toBe('MISMATCH');
    await expect(
      confirmRemoteOperation(profileId, record.operationId, await proofFor(record, { revision: 0 })),
    ).resolves.toBe('MISMATCH');
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_ack_idempotent_for_same_proof', async () => {
    const record = operation();
    await seed(record);
    const proof = await proofFor(record);
    await expect(confirmRemoteOperation(profileId, record.operationId, proof)).resolves.toBe('CONFIRMED');
    await expect(confirmRemoteOperation(profileId, record.operationId, proof)).resolves.toBe(
      'ALREADY_CONFIRMED',
    );
    expect((await read())?.status).toBe('CONFIRMED');
  });

  it('f7_ack_cannot_confirm_another_entity', async () => {
    const record = operation();
    await seed(record);
    await expect(
      confirmRemoteOperation(
        profileId,
        record.operationId,
        await proofFor(record, { entityId: 'edital-2' }),
      ),
    ).resolves.toBe('MISMATCH');
    expect((await read())?.status).toBe('PENDING');
  });

  it('f7_quota_abort_leaves_outbox_pending', async () => {
    const record = operation();
    await seed(record);
    const proof = await proofFor(record);
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      await expect(confirmRemoteOperation(profileId, record.operationId, proof)).resolves.toBe('FAILED');
    } finally {
      spy.mockRestore();
    }
    expect((await read())?.status).toBe('PENDING');
  });
});
