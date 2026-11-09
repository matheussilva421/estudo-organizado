import { beforeEach, describe, expect, it } from 'vitest';
import type { ProfileRecord } from '../../src/application/profile-service';
import { pullRemoteChanges, type RemoteChangePort } from '../../src/platform/sync/change-feed';
import type { RemoteChange, RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  getSyncCursor,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-feed';
const uid = 'uid-a';
const libraryId = 'library-a';

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    profileId,
    uid,
    remoteLibraryId: libraryId,
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
    ...overrides,
  };
}

function change(sequence: number, overrides: Partial<RemoteChange> = {}): RemoteChange {
  return { sequence, entityId: `edital-${sequence}`, revision: sequence, deleted: false, epoch: 1, ...overrides };
}

function entity(sequence: number, overrides: Partial<RemoteEntity> = {}): RemoteEntity {
  return {
    entityId: `edital-${sequence}`,
    entityType: 'edital',
    schemaVersion: 1,
    revision: sequence,
    deleted: false,
    payload: {
      id: `edital-${sequence}`,
      profileId,
      title: `Edital ${sequence}`,
      status: 'ACTIVE',
      localRevision: 1,
    },
    epoch: 1,
    ...overrides,
  };
}

async function seedProfile(record: ProfileRecord): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.profiles, 'readwrite');
  tx.objectStore(STORES.profiles).put(record);
  await transactionDone(tx);
}

async function editalRow(id = 'edital-1'): Promise<Record<string, unknown> | undefined> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.editais, 'readonly');
  return (await requestResult(tx.objectStore(STORES.editais).get([profileId, id]))) as
    | Record<string, unknown>
    | undefined;
}

async function seedEdital(title: string, id = 'edital-1'): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.editais, 'readwrite');
  tx.objectStore(STORES.editais).put({
    profileId,
    id,
    title,
    status: 'ACTIVE',
    localRevision: 1,
  });
  await transactionDone(tx);
}

async function rows(storeName: string): Promise<Record<string, unknown>[]> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(storeName, 'readonly');
  return (await requestResult(tx.objectStore(storeName).getAll())) as Record<string, unknown>[];
}

class FakeFeed implements RemoteChangePort {
  readonly calls: Array<{ epoch: number; cursor: number; limit: number }> = [];
  readonly changes: RemoteChange[];
  readonly entities = new Map<string, RemoteEntity>();

  constructor(changes: RemoteChange[]) {
    this.changes = changes;
    for (const item of changes) {
      this.entities.set(
        item.entityId,
        entity(item.sequence, {
          revision: item.revision,
          deleted: item.deleted,
          payload: item.deleted ? null : entity(item.sequence).payload,
        }),
      );
    }
  }

  async listAfter(_uid: string, _libraryId: string, epoch: number, cursor: number, limit: number) {
    this.calls.push({ epoch, cursor, limit });
    return {
      changes: this.changes.filter((item) => item.sequence > cursor).slice(0, limit),
      head: this.changes.at(-1)?.sequence ?? 0,
      epoch: 1,
    };
  }

  async readEntity(_uid: string, _libraryId: string, id: string): Promise<RemoteEntity | null> {
    return this.entities.get(id) ?? null;
  }
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 change feed', () => {
  it('f7_reconnect_fetches_only_missing_changes', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1), change(2), change(3)]);
    const applied: number[] = [];
    const apply = async (item: RemoteChange) => {
      applied.push(item.sequence);
    };
    await expect(pullRemoteChanges(profileId, feed, 2, { apply })).resolves.toBe('MORE');
    await expect(pullRemoteChanges(profileId, feed, 2, { apply })).resolves.toBe('CONVERGED');
    expect(applied).toEqual([1, 2, 3]);
    expect(feed.calls.map((call) => call.cursor)).toEqual([0, 2]);
    expect((await getSyncCursor(profileId))?.cursor).toBe(3);
  });

  it('f7_cursor_does_not_advance_on_local_abort', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1), change(2), change(3)]);
    const apply = async (item: RemoteChange) => {
      if (item.sequence === 2) throw new Error('local abort');
    };
    await expect(pullRemoteChanges(profileId, feed, 3, { apply })).resolves.toBe('FAILED');
    expect((await getSyncCursor(profileId))?.cursor).toBe(1);
  });

  it('f7_remote_data_does_not_generate_echo_outbox', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1)]);
    await pullRemoteChanges(profileId, feed, 2, { apply: async () => undefined });
    await expect(getPendingOutbox(profileId)).resolves.toEqual([]);
  });

  it('f7_uid_switch_drops_late_pull_result', async () => {
    await seedProfile(profile());
    const gate = { resolve: () => undefined as void };
    const feed: RemoteChangePort = {
      async listAfter() {
        await new Promise<void>((resolve) => {
          gate.resolve = resolve;
        });
        return { changes: [change(1)], head: 1, epoch: 1 };
      },
      async readEntity() {
        return entity(1);
      },
    };
    const pending = pullRemoteChanges(profileId, feed, 2, { apply: async () => undefined });
    await seedProfile(profile({ uid: 'uid-b', remoteLibraryId: 'library-b' }));
    gate.resolve();
    await expect(pending).resolves.toBe('FAILED');
    expect(await getSyncCursor(profileId)).toBeNull();
  });

  it('f7_uid_switch_during_entity_read_write_is_dropped', async () => {
    await seedProfile(profile());
    let release = () => undefined as void;
    let started = () => undefined as void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const feed: RemoteChangePort = {
      async listAfter() {
        return { changes: [change(1)], head: 1, epoch: 1 };
      },
      async readEntity() {
        started();
        await gate;
        return entity(1);
      },
    };
    const pending = pullRemoteChanges(profileId, feed, 2);
    await reading;
    await seedProfile(profile({ uid: 'uid-b', remoteLibraryId: 'library-b' }));
    release();
    await expect(pending).resolves.toBe('FAILED');
    expect(await getSyncCursor(profileId)).toBeNull();
  });

  it('f7_deleted_record_stays_deleted', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1, { deleted: true })]);
    const observed: { value: RemoteEntity | null } = { value: null };
    await pullRemoteChanges(profileId, feed, 2, {
      apply: async (_item, value) => {
        observed.value = value;
      },
    });
    expect(observed.value?.deleted).toBe(true);
    expect(observed.value?.payload).toBeNull();
    expect((await getSyncCursor(profileId))?.cursor).toBe(1);
  });

  it('f7_default_apply_writes_the_remote_entity_and_cursor', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1)]);
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('CONVERGED');
    await expect(editalRow()).resolves.toMatchObject({
      id: 'edital-1',
      title: 'Edital 1',
      profileId,
    });
    await expect(getSyncCursor(profileId)).resolves.toMatchObject({
      uid,
      libraryId,
      cursor: 1,
    });
  });

  it('f7_default_apply_records_a_tombstone_for_a_remote_delete', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1, { deleted: true })]);
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('CONVERGED');
    await expect(editalRow()).resolves.toBeUndefined();
    const tombstones = await rows(STORES.tombstones);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toMatchObject({
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      epoch: 1,
    });
  });

  it('f7_default_apply_preserves_local_data_on_a_conflict', async () => {
    await seedProfile(profile());
    await seedEdital('LOCAL');
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.outbox, 'readwrite');
    tx.objectStore(STORES.outbox).put({
      operationId: 'op-local',
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      kind: 'upsert',
      baseRevision: 0,
      payload: { id: 'edital-1', profileId, title: 'LOCAL', status: 'ACTIVE', localRevision: 1 },
      schemaVersion: 1,
      status: 'PENDING',
      deliveryUid: uid,
      remoteLibraryId: libraryId,
    });
    await transactionDone(tx);

    const feed = new FakeFeed([change(1)]);
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('CONVERGED');
    await expect(editalRow()).resolves.toMatchObject({ title: 'LOCAL' });
    const conflicts = await rows(STORES.conflicts);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      localPayload: expect.objectContaining({ title: 'LOCAL' }),
      remotePayload: expect.objectContaining({ title: 'Edital 1' }),
      status: 'OPEN',
    });
  });

  it('f7_default_apply_rejects_an_entity_from_another_profile', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1)]);
    feed.entities.set('edital-1', {
      ...entity(1),
      payload: {
        id: 'edital-1',
        profileId: 'other-profile',
        title: 'OTHER',
        status: 'ACTIVE',
        localRevision: 1,
      },
    });
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('FAILED');
    await expect(editalRow()).resolves.toBeUndefined();
    await expect(getSyncCursor(profileId)).resolves.toBeNull();
  });

  it('f7_pull_returns_more_when_the_head_is_ahead', async () => {
    await seedProfile(profile());
    const feed: RemoteChangePort = {
      async listAfter() {
        return { changes: [change(1)], head: 5, epoch: 1 };
      },
      async readEntity() {
        return entity(1);
      },
    };
    await expect(pullRemoteChanges(profileId, feed, 10)).resolves.toBe('MORE');
    await expect(getSyncCursor(profileId)).resolves.toMatchObject({ cursor: 1 });
  });

  it('f7_pull_rejects_a_sequence_gap_before_applying', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1), change(3)]);
    await expect(pullRemoteChanges(profileId, feed, 10)).resolves.toBe('RECOVERY_REQUIRED');
    await expect(editalRow('edital-1')).resolves.toBeUndefined();
    await expect(getSyncCursor(profileId)).resolves.toBeNull();
  });

  it('f7_pull_rejects_an_entity_that_does_not_match_the_change', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1)]);
    feed.entities.set('edital-1', entity(1, { entityId: 'edital-2' }));
    await expect(pullRemoteChanges(profileId, feed, 10)).resolves.toBe('FAILED');
    await expect(editalRow('edital-1')).resolves.toBeUndefined();
    await expect(getSyncCursor(profileId)).resolves.toBeNull();
  });

  it('f7_epoch_change_forces_recovery', async () => {
    await seedProfile(profile());
    await pullRemoteChanges(profileId, new FakeFeed([change(1)]), 2);
    const changedEpoch: RemoteChangePort = {
      async listAfter() {
        return { changes: [], head: 2, epoch: 2 };
      },
      async readEntity() {
        return null;
      },
    };
    await expect(pullRemoteChanges(profileId, changedEpoch, 2)).resolves.toBe(
      'RECOVERY_REQUIRED',
    );
    await expect(getSyncCursor(profileId)).resolves.toMatchObject({ epoch: 1, cursor: 1 });
  });

  it('f7_replaying_the_same_page_is_idempotent', async () => {
    await seedProfile(profile());
    const feed = new FakeFeed([change(1)]);
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('CONVERGED');
    await expect(pullRemoteChanges(profileId, feed, 2)).resolves.toBe('CONVERGED');
    await expect(editalRow()).resolves.toMatchObject({ title: 'Edital 1' });
    await expect(getSyncCursor(profileId)).resolves.toMatchObject({ cursor: 1 });
  });
});
