import { afterEach, describe, expect, it, vi } from 'vitest';

describe('firestore-outbox.js', () => {
  it('exports all queue and meta functions', async () => {
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.37');

    expect(typeof outbox.enqueueFirestoreSnapshot).toBe('function');
    expect(typeof outbox.getPendingFirestoreSnapshot).toBe('function');
    expect(typeof outbox.markFirestoreSnapshotSynced).toBe('function');
    expect(typeof outbox.markFirestoreSnapshotFailed).toBe('function');
    expect(typeof outbox.saveFirestoreMeta).toBe('function');
    expect(typeof outbox.getFirestoreMeta).toBe('function');
    expect(typeof outbox.saveFirestoreConflict).toBe('function');
    expect(typeof outbox.clearFirestoreConflict).toBe('function');
  });

  it('returns false when IndexedDB not available', async () => {
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.37');
    // Without a real db connection, these should return false/null
    expect(await outbox.enqueueFirestoreSnapshot({})).toBe(false);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(await outbox.markFirestoreSnapshotSynced()).toBe(false);
    expect(await outbox.markFirestoreSnapshotFailed(new Error('test'))).toBe(false);
    expect(await outbox.saveFirestoreMeta({})).toBe(false);
    expect(await outbox.getFirestoreMeta()).toBeNull();
    expect(await outbox.saveFirestoreConflict({})).toBe(false);
    expect(await outbox.clearFirestoreConflict()).toBe(false);
  });
});

describe('firestore-outbox expected identity', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('keeps a newer outbox entry when the expected identity does not match', async () => {
    const records = new Map([
      [
        'latest_snapshot',
        { id: 'latest_snapshot', queuedAt: '2026-10-20T10:00:00.000Z', envelope: { sentAt: 's1' } },
      ],
    ]);
    const store = {
      get(key) {
        const request = {};
        queueMicrotask(() => {
          request.result = records.get(key) ?? null;
          request.onsuccess?.();
        });
        return request;
      },
      delete(key) {
        const request = {};
        queueMicrotask(() => {
          records.delete(key);
          request.onsuccess?.();
        });
        return request;
      },
    };
    const transaction = { objectStore: () => store };
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => transaction,
    };
    vi.resetModules();
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      db,
      FIRESTORE_CONFLICT_STORE: 'conflicts',
      FIRESTORE_META_STORE: 'meta',
      FIRESTORE_OUTBOX_STORE: 'outbox',
    }));
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.37');

    expect(
      await outbox.markFirestoreSnapshotSynced({
        queuedAt: '2026-10-20T09:00:00.000Z',
        sentAt: 'old',
      })
    ).toBe(false);
    expect(records.get('latest_snapshot').queuedAt).toBe('2026-10-20T10:00:00.000Z');

    expect(
      await outbox.markFirestoreSnapshotSynced({
        queuedAt: '2026-10-20T10:00:00.000Z',
        sentAt: 's1',
      })
    ).toBe(true);
    expect(records.has('latest_snapshot')).toBe(false);

    records.set('latest_snapshot', {
      id: 'latest_snapshot',
      queuedAt: '2026-10-20T11:00:00.000Z',
      envelope: { sentAt: 's2' },
    });
    expect(
      await outbox.markFirestoreSnapshotSynced({ queuedAt: null, sentAt: null })
    ).toBe(false);
    expect(records.get('latest_snapshot').queuedAt).toBe('2026-10-20T11:00:00.000Z');
  });
});
