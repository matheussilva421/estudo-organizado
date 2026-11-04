import { openV2Database, requestResult, STORES } from '../indexeddb';
import { digestPayload } from '../sync/firebase-remote';
import type { F7BackupSnapshot } from './f7-format';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitize(storeName: string, record: unknown): unknown {
  if (!isRecord(record)) return record;
  if (storeName === STORES.profiles) {
    return {
      ...record,
      uid: null,
      remoteLibraryId: null,
      syncEnabled: false,
      state: 'LOCAL_ONLY',
    };
  }
  if (storeName === STORES.outbox) {
    return { ...record, deliveryUid: null, remoteLibraryId: null };
  }
  return record;
}

function belongsToProfile(storeName: string, record: unknown, profileId: string): boolean {
  if (!isRecord(record)) return false;
  if (storeName === STORES.meta) {
    const key = typeof record.key === 'string' ? record.key : '';
    if (key === `epoch:${profileId}`) return true;
    if (key === `rebaseline:${profileId}`) return true;
    return false;
  }
  return record.profileId === profileId;
}

/**
 * Reads every existing profile-scoped store in one readonly transaction. The
 * manifest is computed after the transaction so no crypto await can close it.
 */
export async function collectF7Backup(profileId: string): Promise<F7BackupSnapshot> {
  if (!profileId.trim()) throw new Error('profileId is required');
  const database = await openV2Database(profileId);
  const existing = new Set(Array.from(database.objectStoreNames));
  const names = Object.values(STORES).filter((name) => existing.has(name));
  const transaction = database.transaction(names, 'readonly');
  const payload: Record<string, unknown[]> = {};
  let recordCount = 0;

  for (const name of names) {
    const rows = (await requestResult(transaction.objectStore(name).getAll())) as unknown[];
    const selected = rows
      .filter((row) => belongsToProfile(name, row, profileId))
      .map((row) => sanitize(name, row));
    payload[name] = selected;
    recordCount += selected.length;
  }

  const meta = payload[STORES.meta] ?? [];
  const epochRow = meta.find(
    (row) => isRecord(row) && row.key === `epoch:${profileId}`,
  ) as { epoch?: unknown } | undefined;
  const epoch =
    epochRow && typeof epochRow.epoch === 'number' && Number.isInteger(epochRow.epoch)
      ? epochRow.epoch
      : 0;
  const checksum = await digestPayload(payload);
  return {
    manifest: {
      formatVersion: 3,
      profileId,
      recordCount,
      checksum,
      epoch,
      deletionHistoryComplete: true,
    },
    payload,
  };
}
