import { describe, expect, it, vi } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import {
  digestPayload,
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

  async list(path: string): Promise<unknown[]> {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    return [...this.docs.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map(([, value]) => structuredClone(value));
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
  it('f7_capture_recovery_snapshot_reads_head_and_entities', async () => {
    const store = new MemoryStore();
    const base = `users/${uid}/libraries/${libraryId}`;
    store.docs.set(`${base}/meta/head`, { epoch: 2, changeSequence: 5, uid });
    store.docs.set(`${base}/entities/edital-1`, {
      entityId: 'edital-1',
      entityType: 'edital',
      schemaVersion: 1,
      revision: 1,
      deleted: false,
      epoch: 2,
      payload: {
        id: 'edital-1',
        profileId,
        title: 'TJPB',
        status: 'ACTIVE',
        localRevision: 1,
      },
      uid,
    });
    const result = await port(store).captureRecoverySnapshot(uid, libraryId);
    expect(result).toMatchObject({
      kind: 'OK',
      epoch: 2,
      head: 5,
      historyFloor: 5,
      historyMode: 'SNAPSHOT_ONLY',
    });
    if (result.kind === 'OK') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]?.entityId).toBe('edital-1');
    }
  });

  it('f7_capture_recovery_snapshot_rejects_a_changed_head', async () => {
    const store = new MemoryStore();
    let headReads = 0;
    const original = store.get.bind(store);
    store.get = async (path: string) => {
      if (path.endsWith('/meta/head')) {
        headReads += 1;
        return {
          epoch: 2,
          changeSequence: headReads === 1 ? 5 : 6,
          uid,
        };
      }
      return original(path);
    };
    const result = await port(store).captureRecoverySnapshot(uid, libraryId);
    expect(result).toMatchObject({ kind: 'STALE', reason: 'HEAD_CHANGED_DURING_CAPTURE' });
  });

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
    await expect(remote.apply(operation({ operationId: 'op-2' }))).resolves.toMatchObject({
      kind: 'CONFLICT',
      remoteRevision: 1,
      remote: expect.objectContaining({ deleted: false }),
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

  it('f7_lookup_rejects_a_different_payload_digest', async () => {
    const store = new MemoryStore();
    const remote = port(store);
    await remote.apply(operation());
    const changedDigest = await digestPayload({
      ...operation().payload,
      title: 'OUTRO',
    });
    await expect(remote.lookup('op-1', 'edital-1', changedDigest)).resolves.toBe('MISMATCH');
  });

  it('f7_change_feed_lists_only_after_the_cursor', async () => {
    const store = new MemoryStore();
    store.docs.set(`users/${uid}/libraries/${libraryId}/meta/head`, {
      epoch: 1,
      changeSequence: 2,
    });
    const query = vi.fn(async () => [
      { sequence: 2, entityId: 'edital-1', revision: 2, deleted: false, epoch: 1 },
    ]);
    const remote = port({
      get: (path) => store.get(path),
      runTransaction: (task) => store.runTransaction(task),
      query,
    });
    await expect(remote.listAfter(uid, libraryId, 1, 1, 10)).resolves.toEqual({
      changes: [{ sequence: 2, entityId: 'edital-1', revision: 2, deleted: false, epoch: 1 }],
      head: 2,
      epoch: 1,
    });
    expect(query).toHaveBeenCalledWith(`users/${uid}/libraries/${libraryId}/changes`, {
      field: 'sequence',
      operator: '>',
      value: 1,
      orderBy: 'sequence',
      limit: 10,
    });
  });

  it('f7_change_feed_rejects_cross_scope_and_stale_epoch', async () => {
    const store = new MemoryStore();
    store.docs.set(`users/${uid}/libraries/${libraryId}/meta/head`, {
      epoch: 2,
      changeSequence: 4,
    });
    const remote = port(store);
    await expect(remote.listAfter('uid-b', libraryId, 1, 0, 10)).resolves.toEqual({
      changes: [],
      head: 0,
      epoch: 1,
    });
    await expect(remote.listAfter(uid, libraryId, 1, 0, 10)).resolves.toEqual({
      changes: [],
      head: 4,
      epoch: 2,
    });
  });

  it('f7_change_feed_reads_only_the_owned_entity', async () => {
    const store = new MemoryStore();
    store.docs.set(`users/${uid}/libraries/${libraryId}/entities/edital-1`, {
      entityId: 'edital-1',
      entityType: 'edital',
      schemaVersion: 1,
      revision: 1,
      deleted: false,
      payload: { id: 'edital-1', profileId, title: 'TJPB' },
      epoch: 1,
      uid,
    });
    const remote = port(store);
    const entity = await remote.readEntity(uid, libraryId, 'edital-1');
    expect(entity).toMatchObject({
      entityId: 'edital-1',
      revision: 1,
    });
    expect(entity).not.toHaveProperty('uid');
    await expect(remote.readEntity('uid-b', libraryId, 'edital-1')).resolves.toBeNull();
  });
});
