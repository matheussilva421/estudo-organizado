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
});
