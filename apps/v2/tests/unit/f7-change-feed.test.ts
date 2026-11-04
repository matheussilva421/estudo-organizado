import { beforeEach, describe, expect, it } from 'vitest';
import type { ProfileRecord } from '../../src/application/profile-service';
import { pullRemoteChanges, type RemoteChangePort } from '../../src/platform/sync/change-feed';
import type { RemoteChange, RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  getSyncCursor,
  openV2Database,
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
});
