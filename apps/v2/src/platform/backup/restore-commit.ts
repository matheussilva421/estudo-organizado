import { inspectF7Backup, type F7BackupSnapshot } from './f7-format';
import {
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../indexeddb';

export type RestorePreviewF7 = {
  id: string;
  profileId: string;
  toCreate: number;
  toUpdate: number;
  conflicts: number;
  requiresRebaseline: boolean;
  sourceEpoch: number;
};

type StoredRestore = {
  targetProfileId: string;
  snapshot: F7BackupSnapshot;
  preview: RestorePreviewF7;
};

const previews = new Map<string, StoredRestore>();
const committed = new Set<string>();

function previewId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function localEpoch(profileId: string): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const row = (await requestResult(
    transaction.objectStore(STORES.meta).get(`epoch:${profileId}`),
  )) as { epoch?: unknown } | undefined;
  return row && typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
}

async function tombstoneKeys(profileId: string): Promise<Set<string>> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.tombstones, 'readonly');
  const rows = (await requestResult(
    transaction.objectStore(STORES.tombstones).index('by_profile').getAll(profileId),
  )) as Array<{ entityType: string; entityId: string }>;
  return new Set(rows.map((row) => `${row.entityType}:${row.entityId}`));
}

export async function prepareF7Restore(
  snapshot: F7BackupSnapshot,
  targetProfileId: string,
): Promise<{ kind: 'PREVIEW'; preview: RestorePreviewF7 } | { kind: 'INVALID'; reason: string }> {
  if (!targetProfileId.trim()) return { kind: 'INVALID', reason: 'PROFILE_REQUIRED' };
  const inspected = await inspectF7Backup(snapshot);
  if (inspected.kind === 'INVALID') return { kind: 'INVALID', reason: inspected.reason };

  const currentEpoch = await localEpoch(targetProfileId).catch(() => 0);
  const tombstones = await tombstoneKeys(targetProfileId).catch(() => new Set<string>());
  const records = Object.values(snapshot.payload).reduce((total, rows) => total + rows.length, 0);
  const conflicts = Object.entries(snapshot.payload).reduce((total, [store, rows]) => {
    if (store !== STORES.editais) return total;
    return total + rows.filter((row) => {
      if (row === null || typeof row !== 'object') return false;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : '';
      return id ? tombstones.has(`edital:${id}`) : false;
    }).length;
  }, 0);
  const preview: RestorePreviewF7 = {
    id: previewId(),
    profileId: targetProfileId,
    toCreate: records,
    toUpdate: 0,
    conflicts,
    requiresRebaseline:
      inspected.kind === 'REBASELINE_REQUIRED' || snapshot.manifest.epoch < currentEpoch,
    sourceEpoch: snapshot.manifest.epoch,
  };
  previews.set(preview.id, { targetProfileId, snapshot, preview });
  return { kind: 'PREVIEW', preview };
}

export async function commitF7Restore(
  previewIdValue: string,
  consent: true,
): Promise<'LOCAL_COMMITTED' | 'STALE' | 'INSUFFICIENT_SPACE' | 'FAILED'> {
  if (consent !== true) return 'FAILED';
  if (committed.has(previewIdValue)) return 'LOCAL_COMMITTED';
  const stored = previews.get(previewIdValue);
  if (!stored) return 'STALE';

  const database = await openV2Database(stored.targetProfileId).catch(() => null);
  if (!database) return 'FAILED';
  const transaction = database.transaction([STORES.meta, STORES.tombstones], 'readwrite');
  try {
    const meta = transaction.objectStore(STORES.meta);
    const already = await requestResult(meta.get(`restore-committed:${previewIdValue}`));
    if (already) {
      await transactionDone(transaction);
      committed.add(previewIdValue);
      previews.delete(previewIdValue);
      return 'LOCAL_COMMITTED';
    }
    meta.put({
      key: `restore:${stored.targetProfileId}`,
      value: {
        previewId: previewIdValue,
        snapshot: stored.snapshot,
        preview: stored.preview,
        restoredAt: new Date().toISOString(),
      },
    });
    meta.put({
      key: `restore-committed:${previewIdValue}`,
      value: { restoredAt: new Date().toISOString() },
    });
    await transactionDone(transaction);
    committed.add(previewIdValue);
    previews.delete(previewIdValue);
    return 'LOCAL_COMMITTED';
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return 'INSUFFICIENT_SPACE';
    }
    return 'FAILED';
  }
}
