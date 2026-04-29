import { describe, expect, it, vi } from 'vitest';

describe('firestore-entity-outbox.js', () => {
  it('exports queue and pending helpers', async () => {
    const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');

    expect(outbox.FIRESTORE_ENTITY_OUTBOX_ID).toBe('entity_shadow');
    expect(typeof outbox.queueFirestoreEntityBatchFromState).toBe('function');
    expect(typeof outbox.getPendingFirestoreEntityBatch).toBe('function');
    expect(typeof outbox.markFirestoreEntityBatchSynced).toBe('function');
  });

  it('store declares an entity outbox store', async () => {
    vi.resetModules();
    const store = await import('../../src/js/store.js?v=8.28');

    expect(store.DB_VERSION).toBeGreaterThanOrEqual(5);
    expect(store.FIRESTORE_ENTITY_OUTBOX_STORE).toBe('firestore_entity_outbox');
  });

  describe('canRetryEntityBatch()', () => {
    it('returns false for null batch', async () => {
      const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');
      expect(outbox.canRetryEntityBatch(null)).toBe(false);
    });

    it('returns false when status is not pending', async () => {
      const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');
      expect(outbox.canRetryEntityBatch({ status: 'synced' })).toBe(false);
    });

    it('returns true when no nextAttemptAt', async () => {
      const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');
      expect(outbox.canRetryEntityBatch({ status: 'pending' })).toBe(true);
    });

    it('returns true when nextAttemptAt is in past', async () => {
      const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');
      const past = new Date(Date.now() - 60000).toISOString();
      expect(outbox.canRetryEntityBatch({ status: 'pending', nextAttemptAt: past })).toBe(true);
    });

    it('returns false when nextAttemptAt is in future', async () => {
      const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.28');
      const future = new Date(Date.now() + 60000).toISOString();
      expect(outbox.canRetryEntityBatch({ status: 'pending', nextAttemptAt: future })).toBe(false);
    });
  });
});
