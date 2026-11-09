import {
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../indexeddb';
import { validateRemoteEnvelope, type RemoteEntity } from './remote-schema';
import { STORE_BY_ENTITY_TYPE } from './entity-stores';

export type CursorSafety = 'SAFE' | 'REBASELINE_REQUIRED';

export function assessCursorSafety(
  local: { epoch: number; cursor: number },
  remote: { epoch: number; historyFloor: number; head: number },
): CursorSafety {
  if (
    !Number.isInteger(local.epoch) ||
    local.epoch < 0 ||
    !Number.isInteger(local.cursor) ||
    local.cursor < 0 ||
    !Number.isInteger(remote.epoch) ||
    remote.epoch < 0 ||
    !Number.isInteger(remote.historyFloor) ||
    remote.historyFloor < 0 ||
    !Number.isInteger(remote.head) ||
    remote.head < 0
  ) {
    return 'REBASELINE_REQUIRED';
  }
  if (local.epoch !== remote.epoch) return 'REBASELINE_REQUIRED';
  if (local.cursor > remote.head) return 'REBASELINE_REQUIRED';
  if (local.cursor < remote.historyFloor) return 'REBASELINE_REQUIRED';
  return 'SAFE';
}

export type RebaselinePreview = {
  kind: 'PREVIEW';
  created: number;
  changed: number;
  deleted: number;
  conflicts: number;
};

type StoredPreview = {
  profileId: string;
  snapshot: readonly RemoteEntity[];
  counts: RebaselinePreview;
};

const previews = new Map<string, StoredPreview>();
const committed = new Set<string>();

function previewId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `rebaseline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function entityKey(entity: Pick<RemoteEntity, 'entityType' | 'entityId'>): string {
  return `${entity.entityType}:${entity.entityId}`;
}

type TombstoneRow = {
  profileId: string;
  entityType: string;
  entityId: string;
};

async function localTombstones(profileId: string): Promise<TombstoneRow[]> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.tombstones, 'readonly');
  const index = transaction.objectStore(STORES.tombstones).index('by_profile');
  return requestResult(index.getAll(profileId)) as Promise<TombstoneRow[]>;
}

export async function prepareRebaseline(
  profileId: string,
  remoteSnapshot: readonly RemoteEntity[],
): Promise<{ kind: 'PREVIEW'; previewId: string; preview: RebaselinePreview } | { kind: 'INVALID'; reason: string }> {
  if (!profileId.trim()) return { kind: 'INVALID', reason: 'PROFILE_REQUIRED' };
  if (!Array.isArray(remoteSnapshot)) return { kind: 'INVALID', reason: 'SNAPSHOT_REQUIRED' };
  for (const entity of remoteSnapshot) {
    const validation = validateRemoteEnvelope(entity);
    if (!validation.ok) return { kind: 'INVALID', reason: validation.reason };
  }

  const tombstones = await localTombstones(profileId).catch(() => [] as TombstoneRow[]);
  const tombstoneKeys = new Set(tombstones.map((row) => `${row.entityType}:${row.entityId}`));
  const pending = await getPendingOutbox(profileId).catch(() => []);
  const pendingConflicts = pending.filter((operation) =>
    remoteSnapshot.some(
      (entity) =>
        entity.entityId === operation.entityId &&
        entity.revision > (operation.remoteBaseRevision ?? operation.baseRevision ?? 0),
    ),
  ).length;
  const resurrection = remoteSnapshot.filter(
    (entity) => !entity.deleted && tombstoneKeys.has(entityKey(entity)),
  ).length;
  const deleted = remoteSnapshot.filter((entity) => entity.deleted).length;
  const created = remoteSnapshot.filter(
    (entity) => !entity.deleted && !tombstoneKeys.has(entityKey(entity)),
  ).length;
  const changed = Math.max(0, remoteSnapshot.length - created - deleted - resurrection);
  const counts: RebaselinePreview = {
    kind: 'PREVIEW',
    created,
    changed,
    deleted,
    conflicts: pendingConflicts + resurrection,
  };
  const id = previewId();
  previews.set(id, { profileId, snapshot: remoteSnapshot, counts });
  return { kind: 'PREVIEW', previewId: id, preview: counts };
}

export async function commitRebaseline(
  profileId: string,
  acceptedPreviewId: string,
): Promise<'LOCAL_COMMITTED' | 'FAILED'> {
  if (!profileId.trim() || !acceptedPreviewId.trim()) return 'FAILED';
  if (committed.has(acceptedPreviewId)) return 'LOCAL_COMMITTED';
  const stored = previews.get(acceptedPreviewId);
  if (!stored || stored.profileId !== profileId) return 'FAILED';

  const database = await openV2Database(profileId).catch(() => null);
  if (!database) return 'FAILED';
  const storeNames = [
    ...new Set(
      stored.snapshot
        .map((entity) => STORE_BY_ENTITY_TYPE[entity.entityType])
        .filter((name): name is string => typeof name === 'string'),
    ),
  ];
  const transaction = database.transaction(
    [STORES.meta, STORES.tombstones, STORES.outbox, ...storeNames],
    'readwrite',
  );
  try {
    const meta = transaction.objectStore(STORES.meta);
    const already = await requestResult(meta.get(`rebaseline-committed:${acceptedPreviewId}`));
    if (already) {
      await transactionDone(transaction);
      committed.add(acceptedPreviewId);
      previews.delete(acceptedPreviewId);
      return 'LOCAL_COMMITTED';
    }

    const pending = (await requestResult(
      transaction
        .objectStore(STORES.outbox)
        .index('by_profile_status')
        .getAll([profileId, 'PENDING']),
    )) as Array<{ entityType: string; entityId: string }>;
    const pendingKeys = new Set(pending.map((row) => `${row.entityType}:${row.entityId}`));
    const tombstones = transaction.objectStore(STORES.tombstones);
    const tombstoneRows = (await requestResult(
      tombstones.index('by_profile').getAll(profileId),
    )) as Array<{ entityType?: unknown; entityId?: unknown; epoch?: unknown }>;
    const tombstoneEpoch = new Map<string, number>();
    for (const row of tombstoneRows) {
      if (typeof row.entityType !== 'string' || typeof row.entityId !== 'string') continue;
      const epoch =
        typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
      const key = `${row.entityType}:${row.entityId}`;
      tombstoneEpoch.set(key, Math.max(tombstoneEpoch.get(key) ?? -1, epoch));
    }
    let applied = 0;
    let preserved = 0;
    for (const entity of stored.snapshot) {
      const key = `${entity.entityType}:${entity.entityId}`;
      if (pendingKeys.has(key)) {
        preserved += 1;
        continue;
      }
      const storeName = STORE_BY_ENTITY_TYPE[entity.entityType];
      if (!entity.deleted) {
        if (!storeName || !entity.payload) continue;
        // A live remote snapshot must never resurrect an entity that a newer
        // local tombstone explicitly deleted.
        if ((tombstoneEpoch.get(key) ?? -1) >= entity.epoch) {
          preserved += 1;
          continue;
        }
        transaction.objectStore(storeName).put({
          ...entity.payload,
          profileId,
          id: entity.entityId,
        });
        applied += 1;
        continue;
      }
      if ((tombstoneEpoch.get(key) ?? -1) > entity.epoch) {
        preserved += 1;
        continue;
      }
      tombstones.put({
        profileId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        operationId: `rebaseline:${acceptedPreviewId}:${entity.entityId}`,
        baseRevision: null,
        epoch: entity.epoch,
        deleted: true,
        deletedAt: new Date().toISOString(),
        snapshot: entity.payload ?? {},
      });
      if (storeName) transaction.objectStore(storeName).delete([profileId, entity.entityId]);
      applied += 1;
    }
    meta.put({
      key: `rebaseline:${profileId}`,
      value: {
        previewId: acceptedPreviewId,
        counts: stored.counts,
        applied,
        preserved,
        committedAt: new Date().toISOString(),
      },
    });
    meta.put({
      key: `rebaseline-committed:${acceptedPreviewId}`,
      value: { committedAt: new Date().toISOString() },
    });
    await transactionDone(transaction);
    committed.add(acceptedPreviewId);
    previews.delete(acceptedPreviewId);
    return 'LOCAL_COMMITTED';
  } catch {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    return 'FAILED';
  }
}
