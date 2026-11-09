import type { OutboxOperation, OutboxPayload } from '../../application/sync-types';
import type { ProfileRecord } from '../../application/profile-service';
import {
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
  type PersistedConflict,
} from '../indexeddb';
import type { RemoteEntity } from './remote-schema';
import { STORE_BY_ENTITY_TYPE } from './entity-stores';

export type ReconcileResult =
  | { kind: 'APPLY'; next: OutboxPayload }
  | { kind: 'UNCHANGED' }
  | { kind: 'CONFLICT'; conflict: { local: unknown; remote: unknown; reason: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const SYNC_METADATA = new Set(['localRevision']);

function comparable(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const copy = { ...value };
  for (const key of SYNC_METADATA) delete copy[key];
  return copy;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function conflict(local: unknown, remote: unknown, reason: string): ReconcileResult {
  return { kind: 'CONFLICT', conflict: { local, remote, reason } };
}

/**
 * Conservative entity reconciliation. Only disjoint fields are merged; any
 * same-field divergence or delete-vs-edit keeps both alternatives for a human
 * decision. Timestamps are never used as a merge authority.
 */
export function reconcileRemoteEntity(
  local: OutboxPayload | null,
  remote: RemoteEntity,
  pending: readonly OutboxOperation[],
): ReconcileResult {
  const pendingDelete = pending.some(
    (operation) => operation.entityId === remote.entityId && operation.kind === 'delete',
  );

  if (remote.deleted) {
    if (local === null && !pendingDelete) return { kind: 'UNCHANGED' };
    return conflict(local, null, 'DELETE_VS_EDIT');
  }
  if (local === null) {
    if (pendingDelete) return conflict(null, remote.payload, 'DELETE_VS_EDIT');
    return remote.payload === null ? { kind: 'UNCHANGED' } : { kind: 'APPLY', next: remote.payload };
  }
  if (pendingDelete) return conflict(null, remote.payload, 'DELETE_VS_EDIT');
  if (remote.payload === null) return conflict(local, null, 'REMOTE_PAYLOAD_MISSING');

  if (sameValue(local, remote.payload)) return { kind: 'UNCHANGED' };
  if (!isRecord(local) || !isRecord(remote.payload)) {
    return conflict(local, remote.payload, 'NON_OBJECT_CONFLICT');
  }

  const localRecord = local as Record<string, unknown>;
  const remoteRecord = remote.payload as Record<string, unknown>;
  const next: Record<string, unknown> = { ...localRecord };
  const divergent: string[] = [];
  for (const [key, value] of Object.entries(remoteRecord)) {
    if (SYNC_METADATA.has(key)) continue;
    if (!(key in localRecord)) {
      next[key] = value;
      continue;
    }
    if (!sameValue(localRecord[key], value)) divergent.push(key);
  }
  if (divergent.length > 0) {
    return conflict(local, remote.payload, `FIELD_CONFLICT:${divergent.sort().join(',')}`);
  }
  return { kind: 'APPLY', next: next as OutboxPayload };
}

export type ConflictChoice = 'LOCAL' | 'REMOTE';

function newOperationId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `conflict-op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revisionOf(value: unknown): number | null {
  if (!isRecord(value)) return null;
  return typeof value.localRevision === 'number' && Number.isInteger(value.localRevision)
    ? value.localRevision
    : null;
}

/**
 * Resolves one persisted conflict against the exact remote revision seen by the
 * preview. A newer remote revision or an already resolved row is STALE.
 */
export async function resolveRemoteConflict(
  conflictId: string,
  choice: ConflictChoice,
  baseRemoteRevision: number,
): Promise<'LOCAL_COMMITTED' | 'STALE' | 'FAILED'> {
  if (!conflictId.trim() || !Number.isInteger(baseRemoteRevision) || baseRemoteRevision < 1) {
    return 'STALE';
  }
  const database = await openV2Database('conflict-resolution').catch(() => null);
  if (!database) return 'FAILED';

  const read = database.transaction([STORES.conflicts, STORES.profiles], 'readonly');
  const conflict = (await requestResult(
    read.objectStore(STORES.conflicts).get(conflictId),
  )) as PersistedConflict | undefined;
  if (!conflict || conflict.status !== 'OPEN') return 'STALE';
  if (conflict.remoteRevision !== baseRemoteRevision) return 'STALE';
  const profile = (await requestResult(
    read.objectStore(STORES.profiles).get(conflict.profileId),
  )) as ProfileRecord | undefined;
  if (!profile) return 'STALE';

  const storeName = STORE_BY_ENTITY_TYPE[conflict.entityType];
  if (!storeName) return 'FAILED';
  const transaction = database.transaction(
    [STORES.conflicts, STORES.outbox, STORES.tombstones, storeName],
    'readwrite',
  );
  try {
    const current = (await requestResult(
      transaction.objectStore(STORES.conflicts).get(conflictId),
    )) as PersistedConflict | undefined;
    if (!current || current.status !== 'OPEN' || current.remoteRevision !== baseRemoteRevision) {
      transaction.abort();
      return 'STALE';
    }

    if (choice === 'LOCAL') {
      const localRow = await requestResult(
        transaction.objectStore(storeName).get([current.profileId, current.entityId]),
      );
      const expected = revisionOf(current.localPayload);
      const currentRevision = revisionOf(localRow);
      if (localRow !== undefined && expected !== null && currentRevision !== expected) {
        transaction.abort();
        return 'STALE';
      }
      const operationId = newOperationId();
      const deleting = current.localPayload === null;
      const operation: OutboxOperation = {
        operationId,
        profileId: current.profileId,
        entityType: current.entityType as OutboxOperation['entityType'],
        entityId: current.entityId,
        kind: deleting ? 'delete' : 'upsert',
        baseRevision: current.remoteRevision,
        remoteBaseRevision: current.remoteRevision,
        payload: deleting
          ? ({ id: current.entityId, profileId: current.profileId } as OutboxPayload)
          : (current.localPayload as OutboxPayload),
        schemaVersion: 1,
        status: 'PENDING',
        deliveryUid: profile.uid,
        remoteLibraryId: profile.remoteLibraryId,
      };
      transaction.objectStore(STORES.outbox).put(operation);
      transaction.objectStore(STORES.conflicts).put({
        ...current,
        status: 'RESOLVED',
        resolution: 'LOCAL',
        resolvedByOperationId: operationId,
      });
    } else {
      if (current.deleted) {
        transaction.objectStore(STORES.tombstones).put({
          profileId: current.profileId,
          entityType: current.entityType,
          entityId: current.entityId,
          operationId: `conflict:${current.conflictId}`,
          baseRevision: current.remoteRevision,
          epoch: 0,
          deleted: true,
          deletedAt: new Date().toISOString(),
          snapshot: current.localPayload ?? {},
        });
        transaction.objectStore(storeName).delete([current.profileId, current.entityId]);
      } else if (isRecord(current.remotePayload)) {
        transaction.objectStore(storeName).put({
          ...current.remotePayload,
          profileId: current.profileId,
          id: current.entityId,
        });
      } else {
        transaction.abort();
        return 'STALE';
      }
      transaction.objectStore(STORES.conflicts).put({
        ...current,
        status: 'RESOLVED',
        resolution: 'REMOTE',
      });
    }
    await transactionDone(transaction);
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
