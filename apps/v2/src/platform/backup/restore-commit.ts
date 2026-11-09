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

/** Academic and durable local stores that a portable backup may restore. */
const RESTORABLE_STORES: readonly string[] = [
  STORES.subjects,
  STORES.editais,
  STORES.editalDisciplines,
  STORES.assuntos,
  STORES.aulas,
  STORES.lessonTopicLinks,
  STORES.planningScenarios,
  STORES.planningBlocks,
  STORES.planningDrafts,
  STORES.planningCheckpoints,
  STORES.planningPriorityProfiles,
  STORES.planningAvailability,
  STORES.planningImports,
  STORES.sessions,
  STORES.sessionAudit,
  STORES.sessionHabits,
  STORES.habitOccurrences,
  STORES.sessionEmergencyReceipts,
  STORES.reviewTopics,
  STORES.reviewPolicies,
  STORES.reviewCommitments,
  STORES.reviewExecutions,
  STORES.reviewBoardEvidence,
  STORES.reviewMatches,
  STORES.reviewPriorities,
  STORES.reviewSettings,
  STORES.tombstones,
];

/** Entity type used by tombstones/conflicts for a restorable store. */
const ENTITY_TYPE_BY_STORE: Readonly<Record<string, string>> = {
  [STORES.subjects]: 'subject',
  [STORES.editais]: 'edital',
  [STORES.editalDisciplines]: 'edital-discipline',
  [STORES.assuntos]: 'assunto',
  [STORES.aulas]: 'aula',
  [STORES.lessonTopicLinks]: 'lesson-topic-link',
  [STORES.planningScenarios]: 'planning-scenario',
  [STORES.planningBlocks]: 'plan-block',
  [STORES.sessions]: 'study-session',
  [STORES.habitOccurrences]: 'habit-occurrence',
  [STORES.reviewTopics]: 'review-topic',
  [STORES.reviewPolicies]: 'review-policy',
  [STORES.reviewCommitments]: 'review-commitment',
  [STORES.reviewExecutions]: 'review-execution',
  [STORES.reviewBoardEvidence]: 'review-board-evidence',
  [STORES.reviewMatches]: 'review-match',
  [STORES.reviewPriorities]: 'review-priority',
};

const previews = new Map<string, StoredRestore>();
const committed = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function previewId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function keyFields(store: IDBObjectStore): string[] {
  const keyPath = store.keyPath;
  if (Array.isArray(keyPath)) return keyPath.filter((item): item is string => typeof item === 'string');
  return typeof keyPath === 'string' ? [keyPath] : [];
}

/** Builds the actual IndexedDB key, injecting the target profile. */
function keyFor(
  store: IDBObjectStore,
  profileId: string,
  row: Record<string, unknown>,
): IDBValidKey | null {
  const fields = keyFields(store);
  if (fields.length === 0) return null;
  const values = fields.map((field) => (field === 'profileId' ? profileId : row[field]));
  if (values.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    return null;
  }
  return values.length === 1 ? (values[0] as string) : (values as string[]);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tombstoneKey(entityType: unknown, entityId: unknown): string | null {
  if (typeof entityType !== 'string' || typeof entityId !== 'string') return null;
  if (!entityType.trim() || !entityId.trim()) return null;
  return `${entityType}:${entityId}`;
}

type TombstoneIndex = Map<string, number>;

function addTombstone(index: TombstoneIndex, row: Record<string, unknown>): void {
  const key = tombstoneKey(row.entityType, row.entityId);
  if (!key) return;
  const epoch = typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
  const current = index.get(key);
  if (current === undefined || epoch > current) index.set(key, epoch);
}

function snapshotTombstones(snapshot: F7BackupSnapshot): Record<string, unknown>[] {
  const rows = snapshot.payload[STORES.tombstones];
  if (!Array.isArray(rows)) return [];
  return rows.filter(isRecord);
}

async function currentTombstones(
  database: IDBDatabase,
  profileId: string,
): Promise<TombstoneIndex> {
  const transaction = database.transaction(STORES.tombstones, 'readonly');
  const rows = (await requestResult(
    transaction.objectStore(STORES.tombstones).index('by_profile').getAll(profileId),
  )) as unknown[];
  const index: TombstoneIndex = new Map();
  for (const row of rows) if (isRecord(row)) addTombstone(index, row);
  return index;
}

async function localEpoch(profileId: string): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const row = (await requestResult(
    transaction.objectStore(STORES.meta).get(`epoch:${profileId}`),
  )) as { epoch?: unknown } | undefined;
  return row && typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
}

export async function prepareF7Restore(
  snapshot: F7BackupSnapshot,
  targetProfileId: string,
): Promise<{ kind: 'PREVIEW'; preview: RestorePreviewF7 } | { kind: 'INVALID'; reason: string }> {
  if (!targetProfileId.trim()) return { kind: 'INVALID', reason: 'PROFILE_REQUIRED' };
  const inspected = await inspectF7Backup(snapshot);
  if (inspected.kind === 'INVALID') return { kind: 'INVALID', reason: inspected.reason };

  const currentEpoch = await localEpoch(targetProfileId).catch(() => 0);
  const database = await openV2Database(targetProfileId);
  const tombstones = await currentTombstones(database, targetProfileId).catch(() => new Map());
  for (const row of snapshotTombstones(snapshot)) addTombstone(tombstones, row);

  const stores = RESTORABLE_STORES.filter(
    (name) => name !== STORES.tombstones && database.objectStoreNames.contains(name),
  );
  const transaction = database.transaction(stores, 'readonly');
  let toCreate = 0;
  let toUpdate = 0;
  let conflicts = 0;

  for (const name of stores) {
    const rows = snapshot.payload[name];
    if (!Array.isArray(rows)) continue;
    const store = transaction.objectStore(name);
    const entityType = ENTITY_TYPE_BY_STORE[name];
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const key = keyFor(store, targetProfileId, row);
      if (key === null) continue;
      const entityId = typeof row.id === 'string' ? row.id : '';
      if (entityType && entityId && tombstones.has(`${entityType}:${entityId}`)) {
        conflicts += 1;
        continue;
      }
      const current = await requestResult(store.get(key));
      if (current === undefined) toCreate += 1;
      else if (!sameValue(current, row)) toUpdate += 1;
    }
  }

  const preview: RestorePreviewF7 = {
    id: previewId(),
    profileId: targetProfileId,
    toCreate,
    toUpdate,
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
  const stores = RESTORABLE_STORES.filter(
    (name) =>
      name === STORES.tombstones ||
      (Array.isArray(stored.snapshot.payload[name]) && database.objectStoreNames.contains(name)),
  );
  const transaction = database.transaction([STORES.meta, ...stores], 'readwrite');

  try {
    const meta = transaction.objectStore(STORES.meta);
    const already = await requestResult(meta.get(`restore-committed:${previewIdValue}`));
    if (already) {
      await transactionDone(transaction);
      committed.add(previewIdValue);
      previews.delete(previewIdValue);
      return 'LOCAL_COMMITTED';
    }

    const tombstones = new Map<string, number>();
    const currentRows = (await requestResult(
      transaction.objectStore(STORES.tombstones).index('by_profile').getAll(stored.targetProfileId),
    )) as unknown[];
    for (const row of currentRows) if (isRecord(row)) addTombstone(tombstones, row);

    const incomingTombstones = snapshotTombstones(stored.snapshot);
    for (const row of incomingTombstones) {
      const key = tombstoneKey(row.entityType, row.entityId);
      if (!key) continue;
      const epoch = typeof row.epoch === 'number' && Number.isInteger(row.epoch) ? row.epoch : 0;
      if ((tombstones.get(key) ?? -1) > epoch) continue;
      transaction.objectStore(STORES.tombstones).put({
        ...row,
        profileId: stored.targetProfileId,
      });
      tombstones.set(key, epoch);
    }

    let applied = 0;
    for (const name of stores) {
      if (name === STORES.tombstones) continue;
      const rows = stored.snapshot.payload[name];
      if (!Array.isArray(rows)) continue;
      const store = transaction.objectStore(name);
      const entityType = ENTITY_TYPE_BY_STORE[name];
      for (const row of rows) {
        if (!isRecord(row)) continue;
        const key = keyFor(store, stored.targetProfileId, row);
        if (key === null) continue;
        const entityId = typeof row.id === 'string' ? row.id : '';
        if (entityType && entityId && tombstones.has(`${entityType}:${entityId}`)) continue;
        store.put({ ...row, profileId: stored.targetProfileId });
        applied += 1;
      }
    }

    meta.put({
      key: `restore:${stored.targetProfileId}`,
      value: {
        previewId: previewIdValue,
        checksum: stored.snapshot.manifest.checksum,
        preview: stored.preview,
        applied,
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
