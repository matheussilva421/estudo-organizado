import type { OutboxOperation, OutboxPayload } from '../../application/sync-types';
import {
  cursorKey,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../indexeddb';
import { reconcileRemoteEntity } from './conflict-reconciliation';
import type { RemoteChange, RemoteEntity } from './remote-schema';
import { STORE_BY_ENTITY_TYPE } from './entity-stores';

export type ApplyRemoteOutcome =
  | 'APPLIED'
  | 'CONFLICT'
  | 'UNCHANGED'
  | 'RECOVERY_REQUIRED'
  | 'FAILED';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function conflictFor(
  transaction: IDBTransaction,
  profileId: string,
  change: RemoteChange,
  entity: RemoteEntity,
  local: unknown,
  pending: readonly OutboxOperation[],
): void {
  const operation = pending[0];
  const conflictId = operation?.operationId ??
    `remote:${entity.entityType}:${entity.entityId}:${entity.revision}`;
  // Every pending operation of this entity is superseded by the decision. If a
  // later operation stayed PENDING, the next flush could overwrite the remote
  // revision silently (last-writer-wins) without user consent.
  const outbox = transaction.objectStore(STORES.outbox);
  const latest = [...pending].sort((left, right) => {
    const leftBase = typeof left.baseRevision === 'number' ? left.baseRevision : -1;
    const rightBase = typeof right.baseRevision === 'number' ? right.baseRevision : -1;
    if (leftBase !== rightBase) return leftBase - rightBase;
    return (left.sequence ?? 0) - (right.sequence ?? 0);
  }).at(-1);
  const localKind: 'upsert' | 'delete' = latest?.kind === 'delete' ? 'delete' : 'upsert';
  for (const queued of pending) {
    outbox.put({ ...queued, status: 'CONFLICT' });
  }
  transaction.objectStore(STORES.conflicts).put({
    conflictId,
    profileId,
    operationId: operation?.operationId ?? `remote:${change.sequence}`,
    entityType: entity.entityType,
    entityId: entity.entityId,
    localPayload: localKind === 'delete' ? null : local,
    localKind,
    remotePayload: entity.payload,
    baseRevision: operation?.baseRevision ?? null,
    remoteRevision: entity.revision,
    remoteEpoch: entity.epoch,
    deleted: entity.deleted,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  });
}

function tombstoneFor(
  transaction: IDBTransaction,
  profileId: string,
  change: RemoteChange,
  entity: RemoteEntity,
  local: unknown,
): void {
  const store = transaction.objectStore(STORES.tombstones);
  store.put({
    profileId,
    entityType: entity.entityType,
    entityId: entity.entityId,
    operationId: `remote:${change.sequence}`,
    baseRevision: null,
    epoch: entity.epoch,
    deleted: true,
    deletedAt: new Date().toISOString(),
    snapshot: local ?? {},
  });
}

/**
 * Applies one remote envelope and advances the cursor in the same IndexedDB
 * transaction. A conflict or tombstone is persisted without overwriting local
 * academic data; a malformed or cross-profile envelope is refused.
 */
export async function applyRemoteChange(
  profileId: string,
  binding: { uid: string; libraryId: string },
  change: RemoteChange,
  entity: RemoteEntity | null,
): Promise<ApplyRemoteOutcome> {
  if (!entity || entity.entityId !== change.entityId) return 'FAILED';
  if (entity.revision < change.revision) return 'FAILED';
  const storeName = STORE_BY_ENTITY_TYPE[entity.entityType];
  if (!storeName) return 'FAILED';

  if (!entity.deleted) {
    if (!isRecord(entity.payload)) return 'FAILED';
    if (entity.payload.id !== entity.entityId) return 'FAILED';
    if (entity.payload.profileId !== profileId) return 'FAILED';
  }

  const database = await openV2Database(profileId).catch(() => null);
  if (!database) return 'FAILED';
  const transaction = database.transaction(
    [storeName, STORES.profiles, STORES.outbox, STORES.conflicts, STORES.tombstones, STORES.meta],
    'readwrite',
  );

  try {
    const store = transaction.objectStore(storeName);
    const meta = transaction.objectStore(STORES.meta);
    const profile = (await requestResult(
      transaction.objectStore(STORES.profiles).get(profileId),
    )) as { uid?: string | null; remoteLibraryId?: string | null } | undefined;
    if (!profile || profile.uid !== binding.uid || profile.remoteLibraryId !== binding.libraryId) {
      transaction.abort();
      return 'FAILED';
    }
    const storedCursor = (await requestResult(meta.get(cursorKey(profileId)))) as
      | { value?: { uid: string; libraryId: string; epoch: number; cursor: number } }
      | undefined;
    const current = storedCursor?.value;
    if (current) {
      if (current.uid !== binding.uid || current.libraryId !== binding.libraryId) {
        transaction.abort();
        return 'FAILED';
      }
      if (current.epoch > change.epoch) {
        transaction.abort();
        return 'FAILED';
      }
      if (current.epoch < change.epoch) {
        transaction.abort();
        return 'RECOVERY_REQUIRED';
      }
      if (current.cursor >= change.sequence) {
        await transactionDone(transaction);
        return 'UNCHANGED';
      }
      if (current.cursor + 1 !== change.sequence) {
        transaction.abort();
        return 'RECOVERY_REQUIRED';
      }
    } else if (change.sequence !== 1) {
      transaction.abort();
      return 'RECOVERY_REQUIRED';
    }
    const key = [profileId, entity.entityId];
    const local = (await requestResult(store.get(key))) as OutboxPayload | undefined;
    const pending = (await requestResult(
      transaction
        .objectStore(STORES.outbox)
        .index('by_profile_entity')
        .getAll([profileId, entity.entityType, entity.entityId]),
    )) as OutboxOperation[];
    const active = pending.filter((operation) => operation.status === 'PENDING');

    let outcome: ApplyRemoteOutcome = 'UNCHANGED';
    if (entity.deleted) {
      if (local !== undefined || active.length > 0) {
        conflictFor(transaction, profileId, change, entity, local ?? null, active);
        outcome = 'CONFLICT';
      } else {
        const currentTombstone = (await requestResult(
          transaction.objectStore(STORES.tombstones).get([
            profileId,
            entity.entityType,
            entity.entityId,
          ]),
        )) as { epoch?: unknown } | undefined;
        const currentEpoch =
          currentTombstone && typeof currentTombstone.epoch === 'number'
            ? currentTombstone.epoch
            : -1;
        if (currentEpoch <= entity.epoch) {
          tombstoneFor(transaction, profileId, change, entity, local ?? null);
        }
        store.delete(key);
        outcome = 'APPLIED';
      }
    } else {
      const reconciled = reconcileRemoteEntity(local ?? null, entity, active);
      if (reconciled.kind === 'CONFLICT') {
        conflictFor(transaction, profileId, change, entity, local ?? null, active);
        outcome = 'CONFLICT';
      } else if (reconciled.kind === 'APPLY') {
        if (!isRecord(reconciled.next)) {
          transaction.abort();
          return 'FAILED';
        }
        store.put({ ...reconciled.next, profileId, id: entity.entityId });
        outcome = 'APPLIED';
      }
    }

    meta.put({
      key: cursorKey(profileId),
      value: {
        profileId,
        uid: binding.uid,
        libraryId: binding.libraryId,
        epoch: change.epoch,
        cursor: change.sequence,
        updatedAt: new Date().toISOString(),
      },
    });
    await transactionDone(transaction);
    return outcome;
  } catch {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    return 'FAILED';
  }
}
