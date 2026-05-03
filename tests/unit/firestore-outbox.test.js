import { describe, expect, it } from 'vitest';

describe('firestore-outbox.js', () => {
  it('exports all queue and meta functions', async () => {
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.33');

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
    const outbox = await import('../../src/js/sync/firestore-outbox.js?v=8.33');
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
