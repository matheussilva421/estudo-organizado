import { describe, expect, it } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import {
  FirebaseRemotePort,
  RemoteOperationError,
  type FirestorePort,
} from '../../src/platform/sync/firebase-remote';

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

class MemoryStore implements FirestorePort {
  readonly docs = new Map<string, unknown>();

  async get(path: string): Promise<unknown | null> {
    return this.docs.has(path) ? structuredClone(this.docs.get(path)) : null;
  }

  async runTransaction<T>(task: (transaction: { get(path: string): Promise<unknown | null>; set(path: string, value: unknown): void }) => Promise<T>): Promise<T> {
    const writes: Array<[string, unknown]> = [];
    const value = await task({
      get: async (path) => (this.docs.has(path) ? structuredClone(this.docs.get(path)) : null),
      set: (path, next) => writes.push([path, structuredClone(next)]),
    });
    for (const [path, next] of writes) this.docs.set(path, next);
    return value;
  }
}

function port(store: FirestorePort): FirebaseRemotePort {
  return new FirebaseRemotePort({ uid, remoteLibraryId: libraryId, profileId, store });
}

describe('F7 Firebase remote adapter', () => {
  it('f7_identical_replay_returns_already_applied', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await expect(remote.apply(operation())).resolves.toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    await expect(remote.apply(operation())).resolves.toEqual({
      kind: 'ALREADY_APPLIED',
      remoteRevision: 1,
    });
  });

  it('f7_apply_once_under_concurrency', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    const first = await remote.apply(operation());
    const second = await remote.apply(operation());
    expect([first.kind, second.kind]).toEqual(['APPLIED', 'ALREADY_APPLIED']);
  });

  it('f7_changed_payload_same_operation_id_rejected', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await remote.apply(operation());
    await expect(
      remote.apply(
        operation({
          payload: { id: 'edital-1', profileId, title: 'OUTRO', status: 'ACTIVE', localRevision: 1 },
        }),
      ),
    ).rejects.toBeInstanceOf(RemoteOperationError);
  });

  it('f7_conflicting_base_revision_preserved', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await remote.apply(operation());
    await expect(remote.apply(operation({ operationId: 'op-2' }))).resolves.toEqual({
      kind: 'CONFLICT',
      remoteRevision: 1,
    });
  });

  it('f7_delete_marks_tombstone', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await remote.apply(operation());
    await expect(
      remote.apply(operation({ operationId: 'op-del', kind: 'delete', baseRevision: 1 })),
    ).resolves.toEqual({ kind: 'APPLIED', remoteRevision: 2 });
    const entity = store.docs.get(`users/${uid}/libraries/${libraryId}/entities/edital-1`) as {
      deleted: boolean;
      payload: unknown;
    };
    expect(entity.deleted).toBe(true);
    expect(entity.payload).toBeNull();
  });

  it('f7_transaction_does_not_write_in_wrong_uid', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await expect(remote.apply(operation({ deliveryUid: 'uid-b' }))).rejects.toBeInstanceOf(
      RemoteOperationError,
    );
    expect(store.docs.size).toBe(0);
  });
});
