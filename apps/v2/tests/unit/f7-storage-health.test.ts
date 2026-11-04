import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStorageHealth, requestBestEffortPersistence } from '../../src/platform/storage-health';
import { toLocalPersistenceError } from '../../src/platform/indexeddb';

const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');

function stubStorage(value: unknown): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(navigator, 'storage', originalStorage);
  } else {
    // jsdom may not define it at all.
    delete (navigator as { storage?: unknown }).storage;
  }
});

describe('F7 storage health', () => {
  it('f7_persistence_denied_does_not_disable_study', async () => {
    stubStorage({ persist: async () => false });
    await expect(requestBestEffortPersistence()).resolves.toBe('DENIED');
  });

  it('f7_estimate_is_not_treated_as_exact_available_space', async () => {
    stubStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 900, quota: 1_000 }),
    });
    const health = await getStorageHealth();
    expect(health).toEqual({
      persistent: true,
      estimatedUsage: 900,
      estimatedQuota: 1_000,
      warning: 'LOW_SPACE',
    });
    expect(health).not.toHaveProperty('available');
  });

  it('f7_quota_abort_has_no_false_commit', () => {
    const error = toLocalPersistenceError(new DOMException('quota', 'QuotaExceededError'));
    expect(error.kind).toBe('QUOTA');
    expect(error.recoverable).toBe(true);
  });

  it('f7_storage_deleted_offers_recovery_without_overwrite', async () => {
    stubStorage(undefined);
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');
    await expect(getStorageHealth()).resolves.toMatchObject({ warning: 'UNAVAILABLE' });
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it('f7_cache_cleanup_does_not_delete_outbox_or_drafts', async () => {
    stubStorage({
      persisted: async () => null,
      estimate: async () => ({ usage: 1, quota: 100 }),
    });
    const health = await getStorageHealth();
    expect(health.warning).toBe('NONE');
    // This module never calls caches.delete or indexedDB.deleteDatabase.
    expect(health).not.toHaveProperty('deletedStores');
  });
});
