import {
  cursorKey,
  openV2Database,
  recoveryKey,
  requestResult,
  STORES,
  transactionDone,
} from '../indexeddb';
import type { ProfileRecord } from '../../application/profile-service';
import { inspectF7Backup, type F7BackupSnapshot } from '../backup/f7-format';
import { digestPayload } from './firebase-remote';
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

export type RebaselineCheckpoint = {
  uid: string;
  libraryId: string;
  epoch: number;
  head: number;
  historyFloor: number;
  historyMode: 'SNAPSHOT_ONLY';
  snapshotChecksum: string;
};

export type RebaselineContext = {
  checkpoint: RebaselineCheckpoint;
  backupChecksum: string;
  backupRecordCount: number;
};

export type RebaselinePreview = {
  kind: 'PREVIEW';
  created: number;
  changed: number;
  deleted: number;
  conflicts: number;
  checkpoint?: RebaselineCheckpoint;
  backupChecksum?: string;
  backupRecordCount?: number;
};

type StoredPreview = {
  profileId: string;
  snapshot: readonly RemoteEntity[];
  counts: RebaselinePreview;
  context?: RebaselineContext;
};

const previews = new Map<string, StoredPreview>();
const committed = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function previewId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `rebaseline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function entityKey(entity: Pick<RemoteEntity, 'entityType' | 'entityId'>): string {
  return `${entity.entityType}:${entity.entityId}`;
}

function referentialProblem(snapshot: readonly RemoteEntity[]): string | null {
  const live = snapshot.filter((entity) => !entity.deleted && isRecord(entity.payload));
  const ids = (type: string): Set<string> =>
    new Set(
      live
        .filter((entity) => entity.entityType === type)
        .map((entity) => entity.entityId),
    );
  const editais = ids('edital');
  const subjects = ids('subject');
  const links = ids('edital-discipline');
  const assuntos = ids('assunto');
  const aulas = ids('aula');
  const scenarios = ids('planning-scenario');
  const scenarioEdital = new Map<string, string>();
  for (const entity of live) {
    if (entity.entityType === 'planning-scenario' && isRecord(entity.payload)) {
      const editalId = (entity.payload as Record<string, unknown>).editalId;
      if (typeof editalId === 'string') scenarioEdital.set(entity.entityId, editalId);
    }
  }
  const has = (set: Set<string>, value: unknown): boolean =>
    typeof value === 'string' && set.has(value);
  for (const entity of live) {
    const payload = entity.payload as Record<string, unknown>;
    if (entity.entityType === 'edital-discipline') {
      if (!has(editais, payload.editalId) || !has(subjects, payload.subjectId)) {
        return `HIERARCHY:${entity.entityId}`;
      }
    } else if (entity.entityType === 'assunto') {
      if (!has(links, payload.editalDisciplineId)) return `HIERARCHY:${entity.entityId}`;
      if (payload.parentId !== null && payload.parentId !== undefined && !has(assuntos, payload.parentId)) {
        return `HIERARCHY:${entity.entityId}`;
      }
    } else if (entity.entityType === 'aula') {
      if (!has(links, payload.editalDisciplineId)) return `HIERARCHY:${entity.entityId}`;
    } else if (entity.entityType === 'lesson-topic-link') {
      if (!has(aulas, payload.aulaId) || !has(assuntos, payload.assuntoId)) {
        return `HIERARCHY:${entity.entityId}`;
      }
    } else if (entity.entityType === 'planning-scenario') {
      if (!has(editais, payload.editalId)) return `HIERARCHY:${entity.entityId}`;
    } else if (entity.entityType === 'plan-block') {
      if (
        !has(scenarios, payload.scenarioId) ||
        !has(editais, payload.editalId) ||
        scenarioEdital.get(String(payload.scenarioId)) !== payload.editalId ||
        (payload.editalDisciplineId !== 'unmapped' && !has(links, payload.editalDisciplineId))
      ) {
        return `HIERARCHY:${entity.entityId}`;
      }
    }
  }
  return null;
}

function sortedEntities(snapshot: readonly RemoteEntity[]): RemoteEntity[] {
  return [...snapshot].sort((left, right) =>
    entityKey(left) < entityKey(right) ? -1 : entityKey(left) > entityKey(right) ? 1 : 0,
  );
}

export async function recoverySnapshotChecksum(
  snapshot: readonly RemoteEntity[],
  checkpoint: Pick<RebaselineCheckpoint, 'epoch' | 'head' | 'historyFloor' | 'historyMode'>,
): Promise<string> {
  return digestPayload({
    entities: sortedEntities(snapshot),
    epoch: checkpoint.epoch,
    head: checkpoint.head,
    historyFloor: checkpoint.historyFloor,
    historyMode: checkpoint.historyMode,
  });
}

function validCheckpoint(checkpoint: unknown): checkpoint is RebaselineCheckpoint {
  if (!checkpoint || typeof checkpoint !== 'object') return false;
  const value = checkpoint as Partial<RebaselineCheckpoint>;
  return (
    typeof value.uid === 'string' && value.uid.trim().length > 0 &&
    typeof value.libraryId === 'string' && value.libraryId.trim().length > 0 &&
    Number.isInteger(value.epoch) && (value.epoch as number) >= 0 &&
    Number.isInteger(value.head) && (value.head as number) >= 0 &&
    Number.isInteger(value.historyFloor) && (value.historyFloor as number) >= 0 &&
    value.historyMode === 'SNAPSHOT_ONLY' &&
    typeof value.snapshotChecksum === 'string' &&
    /^[a-fA-F0-9]{64}$/.test(value.snapshotChecksum)
  );
}

export type RecoveryBackupRecord = {
  profileId: string;
  previewId: string;
  checksum: string;
  recordCount: number;
  deletionHistoryComplete: boolean;
  snapshot: F7BackupSnapshot;
};

function backupKey(id: string): string {
  return `recovery-backup:${id}`;
}

/** Stores the verified pre-recovery copy in IndexedDB with a read-back. */
export async function saveRecoveryBackup(
  profileId: string,
  id: string,
  snapshot: F7BackupSnapshot,
): Promise<void> {
  const inspected = await inspectF7Backup(snapshot);
  if (inspected.kind === 'INVALID') throw new Error(`recovery backup is ${inspected.kind}`);
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readwrite');
  transaction.objectStore(STORES.meta).put({
    key: backupKey(id),
    value: {
      profileId,
      previewId: id,
      checksum: snapshot.manifest.checksum,
      recordCount: snapshot.manifest.recordCount,
      deletionHistoryComplete: snapshot.manifest.deletionHistoryComplete,
      snapshot,
    } satisfies RecoveryBackupRecord,
  });
  await transactionDone(transaction);
  const read = database.transaction(STORES.meta, 'readonly');
  const stored = (await requestResult(
    read.objectStore(STORES.meta).get(backupKey(id)),
  )) as { value?: RecoveryBackupRecord } | undefined;
  if (
    !stored?.value ||
    stored.value.checksum !== snapshot.manifest.checksum ||
    stored.value.recordCount !== snapshot.manifest.recordCount
  ) {
    throw new Error('recovery backup read-back failed');
  }
}

export async function readRecoveryBackup(
  profileId: string,
  id: string,
): Promise<F7BackupSnapshot | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const stored = (await requestResult(
    transaction.objectStore(STORES.meta).get(backupKey(id)),
  )) as { value?: RecoveryBackupRecord } | undefined;
  if (!stored?.value || stored.value.profileId !== profileId) return null;
  const inspected = await inspectF7Backup(stored.value.snapshot);
  return inspected.kind === 'INVALID' ? null : inspected.snapshot;
}

export type RecoveryVerification = {
  previewId: string;
  snapshotChecksum: string;
  epoch: number;
  head: number;
  verifiedAt: string;
};

export function recoveryVerifiedKey(profileId: string): string {
  return `rebaseline-verified:${profileId}`;
}

export async function getRecoveryVerification(
  profileId: string,
): Promise<RecoveryVerification | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const stored = (await requestResult(
    transaction.objectStore(STORES.meta).get(recoveryVerifiedKey(profileId)),
  )) as { value?: RecoveryVerification } | undefined;
  return stored?.value ?? null;
}

async function readProfile(profileId: string): Promise<ProfileRecord | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.profiles, 'readonly');
  const profile = (await requestResult(
    transaction.objectStore(STORES.profiles).get(profileId),
  )) as ProfileRecord | undefined;
  return profile ?? null;
}

export async function prepareRebaseline(
  profileId: string,
  remoteSnapshot: readonly RemoteEntity[],
  context?: RebaselineContext,
): Promise<{ kind: 'PREVIEW'; previewId: string; preview: RebaselinePreview } | { kind: 'INVALID'; reason: string }> {
  if (!profileId.trim()) return { kind: 'INVALID', reason: 'PROFILE_REQUIRED' };
  if (!Array.isArray(remoteSnapshot)) return { kind: 'INVALID', reason: 'SNAPSHOT_REQUIRED' };
  for (const entity of remoteSnapshot) {
    const validation = validateRemoteEnvelope(entity);
    if (!validation.ok) return { kind: 'INVALID', reason: validation.reason };
  }
  const hierarchy = referentialProblem(remoteSnapshot);
  if (hierarchy) return { kind: 'INVALID', reason: hierarchy };
  if (context) {
    if (!validCheckpoint(context.checkpoint)) return { kind: 'INVALID', reason: 'CHECKPOINT_INVALID' };
    if (typeof context.backupChecksum !== 'string' || !/^[a-fA-F0-9]{64}$/.test(context.backupChecksum)) {
      return { kind: 'INVALID', reason: 'BACKUP_CHECKSUM' };
    }
    if (!Number.isInteger(context.backupRecordCount) || context.backupRecordCount < 0) {
      return { kind: 'INVALID', reason: 'BACKUP_COUNT' };
    }
    const checksum = await recoverySnapshotChecksum(remoteSnapshot, context.checkpoint);
    if (checksum.toLowerCase() !== context.checkpoint.snapshotChecksum.toLowerCase()) {
      return { kind: 'INVALID', reason: 'SNAPSHOT_CHECKSUM' };
    }
  }

  const database = await openV2Database(profileId);
  const tombstoneTx = database.transaction(STORES.tombstones, 'readonly');
  const tombstones = (await requestResult(
    tombstoneTx.objectStore(STORES.tombstones).index('by_profile').getAll(profileId),
  )) as Array<{ entityType?: unknown; entityId?: unknown }>;
  const tombstoneKeys = new Set(
    tombstones
      .filter((row) => typeof row.entityType === 'string' && typeof row.entityId === 'string')
      .map((row) => `${row.entityType}:${row.entityId}`),
  );
  const outboxTx = database.transaction(STORES.outbox, 'readonly');
  const pending = (await requestResult(
    outboxTx.objectStore(STORES.outbox).index('by_profile_status').getAll([profileId, 'PENDING']),
  )) as Array<{ entityType?: unknown; entityId?: unknown; remoteBaseRevision?: unknown; baseRevision?: unknown }>;
  const pendingConflicts = pending.filter((operation) =>
    remoteSnapshot.some(
      (entity) =>
        entity.entityId === operation.entityId &&
        entity.revision > Number(operation.remoteBaseRevision ?? operation.baseRevision ?? 0),
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
    ...(context
      ? {
        checkpoint: context.checkpoint,
        backupChecksum: context.backupChecksum,
        backupRecordCount: context.backupRecordCount,
      }
      : {}),
  };
  const id = previewId();
  previews.set(id, {
    profileId,
    snapshot: sortedEntities(remoteSnapshot),
    counts,
    ...(context ? { context } : {}),
  });
  return { kind: 'PREVIEW', previewId: id, preview: counts };
}

async function verifyAndClearRecovery(
  profileId: string,
  acceptedPreviewId: string,
  context: RebaselineContext,
): Promise<boolean> {
  const database = await openV2Database(profileId).catch(() => null);
  if (!database) return false;
  const read = database.transaction([STORES.meta, STORES.profiles], 'readonly');
  const profile = (await requestResult(
    read.objectStore(STORES.profiles).get(profileId),
  )) as ProfileRecord | undefined;
  if (
    !profile ||
    profile.uid !== context.checkpoint.uid ||
    profile.remoteLibraryId !== context.checkpoint.libraryId
  ) {
    return false;
  }
  const cursor = (await requestResult(
    read.objectStore(STORES.meta).get(cursorKey(profileId)),
  )) as { value?: { epoch?: number; cursor?: number } } | undefined;
  if (
    cursor?.value?.epoch !== context.checkpoint.epoch ||
    cursor?.value?.cursor !== context.checkpoint.head
  ) {
    return false;
  }
  const receipt = (await requestResult(
    read.objectStore(STORES.meta).get(`rebaseline:${profileId}`),
  )) as { value?: { previewId?: string; checkpoint?: RebaselineCheckpoint } } | undefined;
  if (
    receipt?.value?.previewId !== acceptedPreviewId ||
    receipt.value.checkpoint?.snapshotChecksum !== context.checkpoint.snapshotChecksum
  ) {
    return false;
  }
  const write = database.transaction(STORES.meta, 'readwrite');
  try {
    const store = write.objectStore(STORES.meta);
    store.put({
      key: recoveryVerifiedKey(profileId),
      value: {
        previewId: acceptedPreviewId,
        snapshotChecksum: context.checkpoint.snapshotChecksum,
        epoch: context.checkpoint.epoch,
        head: context.checkpoint.head,
        verifiedAt: new Date().toISOString(),
      } satisfies RecoveryVerification,
    });
    store.delete(recoveryKey(profileId));
    await transactionDone(write);
    return true;
  } catch {
    try { write.abort(); } catch { /* already aborted */ }
    return false;
  }
}

export async function commitRebaseline(
  profileId: string,
  acceptedPreviewId: string,
): Promise<'LOCAL_COMMITTED' | 'FAILED'> {
  if (!profileId.trim() || !acceptedPreviewId.trim()) return 'FAILED';
  if (committed.has(acceptedPreviewId)) return 'LOCAL_COMMITTED';
  const stored = previews.get(acceptedPreviewId);
  if (!stored || stored.profileId !== profileId) return 'FAILED';

  if (stored.context) {
    const profile = await readProfile(profileId).catch(() => null);
    if (
      !profile ||
      profile.uid !== stored.context.checkpoint.uid ||
      profile.remoteLibraryId !== stored.context.checkpoint.libraryId
    ) {
      return 'FAILED';
    }
    const backup = await readRecoveryBackup(profileId, acceptedPreviewId).catch(() => null);
    if (
      !backup ||
      backup.manifest.checksum !== stored.context.backupChecksum ||
      backup.manifest.recordCount !== stored.context.backupRecordCount
    ) {
      return 'FAILED';
    }
  }

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
      const verified = stored.context
        ? await verifyAndClearRecovery(profileId, acceptedPreviewId, stored.context)
        : true;
      if (!verified) return 'FAILED';
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
      const epoch = typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
      const key = `${row.entityType}:${row.entityId}`;
      tombstoneEpoch.set(key, Math.max(tombstoneEpoch.get(key) ?? -1, epoch));
    }
    let applied = 0;
    let preserved = 0;
    for (const entity of stored.snapshot) {
      const key = entityKey(entity);
      if (pendingKeys.has(key)) {
        preserved += 1;
        continue;
      }
      const storeName = STORE_BY_ENTITY_TYPE[entity.entityType];
      if (!entity.deleted) {
        if (!storeName || !entity.payload) continue;
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
      if ((tombstoneEpoch.get(key) ?? -1) >= entity.epoch) {
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
      tombstoneEpoch.set(key, entity.epoch);
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
        ...(stored.context ? { checkpoint: stored.context.checkpoint } : {}),
        committedAt: new Date().toISOString(),
      },
    });
    if (stored.context) {
      let maxTombstoneEpoch = stored.context.checkpoint.epoch;
      for (const epoch of tombstoneEpoch.values()) {
        maxTombstoneEpoch = Math.max(maxTombstoneEpoch, epoch);
      }
      meta.put({
        key: `epoch:${profileId}`,
        epoch: maxTombstoneEpoch,
      });
      meta.put({
        key: cursorKey(profileId),
        value: {
          profileId,
          uid: stored.context.checkpoint.uid,
          libraryId: stored.context.checkpoint.libraryId,
          epoch: stored.context.checkpoint.epoch,
          cursor: stored.context.checkpoint.head,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    meta.put({
      key: `rebaseline-committed:${acceptedPreviewId}`,
      value: { committedAt: new Date().toISOString() },
    });
    await transactionDone(transaction);
    const verified = stored.context
      ? await verifyAndClearRecovery(profileId, acceptedPreviewId, stored.context)
      : true;
    if (!verified) return 'FAILED';
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
