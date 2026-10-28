import { inspectBackup, type BackupInspection } from './format';

export type RestoreKind = 'SAFE' | 'INVALID' | 'REBASELINE_REQUIRED';

export type RestorePreview = {
  kind: RestoreKind;
  reason?: string;
};

/**
 * Read-only restore preview. It never opens IndexedDB and never writes.
 * A backup without causal deletion history, or with an older epoch, cannot be
 * restored as SAFE because it could reintroduce a deleted record.
 */
export async function previewRestore(
  input: unknown,
  currentEpoch: number,
): Promise<RestorePreview> {
  let inspected: BackupInspection;
  try {
    inspected = await inspectBackup(input);
  } catch {
    return { kind: 'INVALID', reason: 'INVALID_PAYLOAD' };
  }
  if (!inspected.ok) {
    return { kind: 'INVALID', reason: inspected.reason };
  }

  const { manifest, payload } = inspected.snapshot;
  const { tombstones } = payload;
  const hasDeletionHistory = tombstones.length > 0;

  if (manifest.hasDeletionHistory !== hasDeletionHistory) {
    return { kind: 'INVALID', reason: 'DELETION_HISTORY_INCONSISTENT' };
  }
  if (!manifest.hasDeletionHistory || tombstones.length === 0) {
    return { kind: 'REBASELINE_REQUIRED', reason: 'DELETION_HISTORY_MISSING' };
  }
  if (typeof currentEpoch !== 'number' || !Number.isInteger(currentEpoch) || currentEpoch < 0) {
    return { kind: 'INVALID', reason: 'CURRENT_EPOCH_INVALID' };
  }

  const backupEpoch = tombstones.reduce(
    (latest, tombstone) => Math.max(latest, tombstone.epoch),
    0,
  );
  if (backupEpoch > currentEpoch) {
    return { kind: 'INVALID', reason: 'BACKUP_EPOCH_IN_FUTURE' };
  }
  if (backupEpoch < currentEpoch) {
    return { kind: 'REBASELINE_REQUIRED', reason: 'BACKUP_EPOCH_STALE' };
  }
  return { kind: 'SAFE' };
}

export { verifyBackup } from './format';
