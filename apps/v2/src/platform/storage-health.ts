export type StorageWarning = 'NONE' | 'LOW_SPACE' | 'UNAVAILABLE';

export type StorageHealth = {
  persistent: boolean | null;
  estimatedUsage: number | null;
  estimatedQuota: number | null;
  warning: StorageWarning;
};

export type PersistenceResult = 'GRANTED' | 'DENIED' | 'UNSUPPORTED';

function storageManager(): StorageManager | null {
  if (typeof navigator === 'undefined' || !navigator.storage) return null;
  return navigator.storage;
}

/**
 * Storage estimates are estimates, not exact free space. The UI must never
 * promise that an in-memory write survives closing the app.
 */
export async function getStorageHealth(): Promise<StorageHealth> {
  const storage = storageManager();
  if (!storage || typeof storage.estimate !== 'function') {
    return {
      persistent: null,
      estimatedUsage: null,
      estimatedQuota: null,
      warning: 'UNAVAILABLE',
    };
  }
  const persistent =
    typeof storage.persisted === 'function'
      ? await storage.persisted().catch(() => null)
      : null;
  const estimate = await storage.estimate().catch(() => null);
  const estimatedUsage =
    estimate && typeof estimate.usage === 'number' && Number.isFinite(estimate.usage)
      ? estimate.usage
      : null;
  const estimatedQuota =
    estimate && typeof estimate.quota === 'number' && Number.isFinite(estimate.quota)
      ? estimate.quota
      : null;
  const warning: StorageWarning =
    estimatedUsage !== null && estimatedQuota !== null && estimatedQuota > 0 &&
    estimatedUsage / estimatedQuota >= 0.9
      ? 'LOW_SPACE'
      : 'NONE';
  return { persistent, estimatedUsage, estimatedQuota, warning };
}

export async function requestBestEffortPersistence(): Promise<PersistenceResult> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') return 'UNSUPPORTED';
  try {
    return (await storage.persist()) ? 'GRANTED' : 'DENIED';
  } catch {
    return 'DENIED';
  }
}
