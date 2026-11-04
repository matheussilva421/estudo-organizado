import type { ProfileRecord } from '../../application/profile-service';
import {
  getSyncCursor,
  openV2Database,
  requestResult,
  setSyncCursor,
  STORES,
  transactionDone,
} from '../indexeddb';
import {
  compareRemoteChanges,
  validateRemoteChange,
  validateRemoteEnvelope,
  type RemoteChange,
  type RemoteEntity,
} from './remote-schema';

export type RemoteChangePage = {
  changes: RemoteChange[];
  head: number;
  epoch: number;
};

export type RemoteChangePort = {
  listAfter(
    uid: string,
    libraryId: string,
    epoch: number,
    cursor: number,
    limit: number,
  ): Promise<RemoteChangePage>;
  readEntity(uid: string, libraryId: string, id: string): Promise<RemoteEntity | null>;
};

export type ApplyRemoteChange = (
  change: RemoteChange,
  entity: RemoteEntity | null,
) => Promise<void>;

export type PullResult = 'CONVERGED' | 'MORE' | 'RECOVERY_REQUIRED' | 'FAILED';

export type PullOptions = {
  apply?: ApplyRemoteChange;
  getProfile?: (profileId: string) => Promise<ProfileRecord>;
};

async function readProfile(profileId: string): Promise<ProfileRecord | null> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.profiles, 'readonly');
  const profile = (await requestResult(
    transaction.objectStore(STORES.profiles).get(profileId),
  )) as ProfileRecord | undefined;
  return profile ?? null;
}

/** Conservative local staging; T10 owns domain merge semantics. */
async function stageRemoteChange(
  profileId: string,
  change: RemoteChange,
  entity: RemoteEntity | null,
): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readwrite');
  try {
    transaction.objectStore(STORES.meta).put({
      key: `remote-change:${change.sequence}:${change.entityId}`,
      value: { profileId, change, entity },
    });
    await transactionDone(transaction);
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    throw error;
  }
}

/**
 * Pulls one bounded page and advances the cursor only after each local apply.
 * A late response from a previous uid/library is dropped before it can write.
 */
export async function pullRemoteChanges(
  profileId: string,
  port: RemoteChangePort,
  limit: number,
  options: PullOptions = {},
): Promise<PullResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return 'FAILED';
  const profile = await (options.getProfile ?? readProfile)(profileId).catch(() => null);
  if (!profile || !profile.uid || !profile.remoteLibraryId) return 'FAILED';
  const binding = { uid: profile.uid, libraryId: profile.remoteLibraryId };

  const cursor = await getSyncCursor(profileId).catch(() => null);
  if (cursor && (cursor.uid !== binding.uid || cursor.libraryId !== binding.libraryId)) {
    // A cursor from another account is never reused.
    return 'RECOVERY_REQUIRED';
  }
  const epoch = cursor?.epoch ?? 0;
  const from = cursor?.cursor ?? 0;

  let page: RemoteChangePage;
  try {
    page = await port.listAfter(binding.uid, binding.libraryId, epoch, from, limit);
  } catch {
    return 'FAILED';
  }

  // Re-check the binding after the await; a logout/UID switch must drop it.
  const current = await (options.getProfile ?? readProfile)(profileId).catch(() => null);
  if (!current || current.uid !== binding.uid || current.remoteLibraryId !== binding.libraryId) {
    return 'FAILED';
  }

  if (page.epoch !== epoch) {
    if (epoch !== 0 && from > 0) return 'RECOVERY_REQUIRED';
  }
  const effectiveEpoch = page.epoch;
  const changes = page.changes
    .filter((change) => change.sequence > from)
    .sort(compareRemoteChanges)
    .slice(0, limit);

  let appliedCursor = from;
  for (const change of changes) {
    const validation = validateRemoteChange(change);
    if (!validation.ok) return 'FAILED';
    let entity: RemoteEntity | null;
    try {
      entity = await port.readEntity(binding.uid, binding.libraryId, change.entityId);
    } catch {
      return 'FAILED';
    }
    if (entity) {
      const entityValidation = validateRemoteEnvelope(entity);
      if (!entityValidation.ok) return 'FAILED';
    }
    try {
      await (options.apply ?? ((next, value) => stageRemoteChange(profileId, next, value)))(
        change,
        entity,
      );
      await setSyncCursor(profileId, {
        uid: binding.uid,
        libraryId: binding.libraryId,
        epoch: effectiveEpoch,
        cursor: change.sequence,
      });
      appliedCursor = change.sequence;
    } catch {
      return 'FAILED';
    }
  }

  const hasMore = changes.length >= limit && page.head > appliedCursor;
  return hasMore ? 'MORE' : 'CONVERGED';
}
