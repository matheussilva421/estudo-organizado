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

  it('keeps a write enqueued between the pending read and the expected-identity mark', async () => {
    const records = new Map([
      [
        'latest_snapshot',
        { id: 'latest_snapshot', queuedAt: '2026-10-20T10:00:00.000Z', envelope: { sentAt: 's1' } },
      ],
    ]);
    let transaction;
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
      put(entry) {
        const request = {};
        queueMicrotask(() => {
          records.set(entry.id, entry);
          request.onsuccess?.();
          transaction.oncomplete?.();
        });
        return request;
      },
    };
    transaction = { objectStore: () => store, oncomplete: null, onerror: null };
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

    // Real sequence: read pending A, enqueue B, then mark with A's identity.
    const pendingA = await outbox.getPendingFirestoreSnapshot();
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      deviceId: 'web-device1',
      sentAt: 's2',
      payloadUpdatedAt: '2026-10-21T00:00:00.000Z',
      payload: { eventos: [] },
    });
    const pendingB = await outbox.getPendingFirestoreSnapshot();

    expect(pendingB.queuedAt).not.toBe(pendingA.queuedAt);
    expect(
      await outbox.markFirestoreSnapshotSynced({
        queuedAt: pendingA.queuedAt,
        sentAt: pendingA.envelope.sentAt,
      })
    ).toBe(false);
    expect(records.get('latest_snapshot').envelope.sentAt).toBe('s2');

    expect(
      await outbox.markFirestoreSnapshotSynced({
        queuedAt: pendingB.queuedAt,
        sentAt: pendingB.envelope.sentAt,
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

describe('firestore-outbox pending envelope replacement', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('replaces only the matching queuedAt/sentAt and preserves attempts and queue identity', async () => {
    const records = new Map([
      [
        'latest_snapshot',
        {
          id: 'latest_snapshot',
          status: 'pending',
          attempts: 1,
          queuedAt: 'q1',
          nextAttemptAt: 'n1',
          lastError: 'too large',
          envelope: { sentAt: 's1', payload: { config: { manualSyncHistory: [1] } } },
        },
      ],
    ]);
    let transaction;
    const store = {
      get(key) {
        const request = {};
        queueMicrotask(() => {
          request.result = records.get(key) ?? null;
          request.onsuccess?.();
        });
        return request;
      },
      put(entry) {
        const request = {};
        queueMicrotask(() => {
          records.set(entry.id, entry);
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
    transaction = { objectStore: () => store, oncomplete: null, onerror: null };
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => transaction,
    };
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      db,
      FIRESTORE_CONFLICT_STORE: 'conflicts',
      FIRESTORE_META_STORE: 'meta',
      FIRESTORE_OUTBOX_STORE: 'outbox',
    }));
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.37');

    const compact = { sentAt: 's2', payload: { config: {} } };
    expect(
      await outbox.replacePendingFirestoreSnapshotEnvelope(compact, {
        queuedAt: 'q1',
        sentAt: 's1',
      }),
    ).toBe(true);
    const updated = records.get('latest_snapshot');
    expect(updated).toMatchObject({
      queuedAt: 'q1',
      attempts: 1,
      nextAttemptAt: 'n1',
      status: 'pending',
    });
    expect(updated.envelope).toBe(compact);
    expect(updated.lastError).toBeNull();

    expect(
      await outbox.replacePendingFirestoreSnapshotEnvelope(
        { sentAt: 's3' },
        { queuedAt: 'q1', sentAt: 's1' },
      ),
    ).toBe(false);
    expect(records.get('latest_snapshot').envelope).toBe(compact);

    records.delete('latest_snapshot');
    expect(
      await outbox.replacePendingFirestoreSnapshotEnvelope(
        { sentAt: 's4' },
        { queuedAt: 'q1', sentAt: 's2' },
      ),
    ).toBe(false);
  });
});

describe('firestore-outbox enqueue compare-and-set', () => {
  afterEach(() => {
    vi.resetModules();
  });

  async function boot(records) {
    const store = {
      get(key) {
        const request = {};
        queueMicrotask(() => {
          request.result = records.get(key) ?? null;
          request.onsuccess?.();
        });
        return request;
      },
      put(entry) {
        const request = {};
        queueMicrotask(() => {
          records.set(entry.id, entry);
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
    const transaction = { objectStore: () => store, oncomplete: null, onerror: null };
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => transaction,
    };
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      db,
      FIRESTORE_CONFLICT_STORE: 'conflicts',
      FIRESTORE_META_STORE: 'meta',
      FIRESTORE_OUTBOX_STORE: 'outbox',
    }));
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.37');
    return { outbox, records };
  }

  it('coalesces into the observed operation and preserves its identity', async () => {
    const records = new Map([
      [
        'latest_snapshot',
        {
          id: 'latest_snapshot',
          status: 'pending',
          attempts: 2,
          queuedAt: 'q1',
          nextAttemptAt: 'n1',
          lastError: 'previous',
          envelope: { sentAt: 's1' },
        },
      ],
    ]);
    const { outbox } = await boot(records);

    expect(
      await outbox.enqueueFirestoreSnapshot(
        { sentAt: 's2' },
        { expected: { queuedAt: 'q1', sentAt: 's1' } },
      ),
    ).toBe(true);
    expect(records.get('latest_snapshot')).toMatchObject({
      queuedAt: 'q1',
      attempts: 2,
      nextAttemptAt: 'n1',
      status: 'pending',
      lastError: null,
    });
    expect(records.get('latest_snapshot').envelope.sentAt).toBe('s2');
  });

  it('refuses to replace an operation that changed since the read', async () => {
    const records = new Map([
      [
        'latest_snapshot',
        {
          id: 'latest_snapshot',
          status: 'pending',
          attempts: 0,
          queuedAt: 'q1',
          envelope: { sentAt: 's1' },
        },
      ],
    ]);
    const { outbox } = await boot(records);

    expect(
      await outbox.enqueueFirestoreSnapshot(
        { sentAt: 's2' },
        { expected: { queuedAt: 'q0', sentAt: 's0' } },
      ),
    ).toBe(false);
    expect(records.get('latest_snapshot').envelope.sentAt).toBe('s1');
  });

  it('creates the operation only when none was observed', async () => {
    const records = new Map();
    const { outbox } = await boot(records);

    expect(
      await outbox.enqueueFirestoreSnapshot(
        { sentAt: 's1' },
        { expected: { queuedAt: null, sentAt: null } },
      ),
    ).toBe(true);
    expect(records.get('latest_snapshot')).toMatchObject({
      status: 'pending',
      attempts: 0,
      envelope: { sentAt: 's1' },
    });
  });
});
