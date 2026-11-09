import type { OutboxOperation } from '../../application/sync-types';
import type { ProfileRecord } from '../../application/profile-service';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from '../indexeddb';
import { digestPayload } from './firebase-remote';

export type RemoteAckProof = {
  uid: string;
  remoteLibraryId: string;
  entityId: string;
  revision: number;
  operationDigest: string;
};

export type AckResult = 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'MISMATCH' | 'FAILED';

function mismatch(): AckResult {
  return 'MISMATCH';
}

function expectedRevision(operation: OutboxOperation): number {
  const base =
    operation.remoteBaseRevision !== undefined && operation.remoteBaseRevision !== null
      ? operation.remoteBaseRevision
      : operation.baseRevision ?? 0;
  return base + 1;
}

function validateProof(
  profile: ProfileRecord,
  operation: OutboxOperation,
  proof: RemoteAckProof,
  digest: string,
): AckResult | null {
  if (operation.profileId !== profile.profileId) return mismatch();
  if (!profile.uid || profile.uid !== proof.uid) return mismatch();
  if (!profile.remoteLibraryId || profile.remoteLibraryId !== proof.remoteLibraryId) {
    return mismatch();
  }
  if (operation.deliveryUid !== proof.uid) return mismatch();
  if (operation.remoteLibraryId !== proof.remoteLibraryId) return mismatch();
  if (operation.entityId !== proof.entityId) return mismatch();
  if (proof.revision !== expectedRevision(operation)) return mismatch();
  if (digest.toLowerCase() !== proof.operationDigest.toLowerCase()) return mismatch();
  if (operation.status === 'CONFIRMED') {
    return operation.remoteRevision === proof.revision ? 'ALREADY_CONFIRMED' : mismatch();
  }
  if (operation.status !== 'PENDING') return mismatch();
  return null;
}

/**
 * Confirms one outbox operation only after a remote proof is correlated with
 * the immutable envelope. A failed transaction never removes the intent.
 *
 * The digest is computed before the readwrite transaction: awaiting Web Crypto
 * inside an IndexedDB transaction would let the transaction auto-commit.
 */
export async function confirmRemoteOperation(
  profileId: string,
  operationId: string,
  proof: RemoteAckProof,
): Promise<AckResult> {
  if (!profileId.trim() || !operationId.trim()) return mismatch();
  if (!proof || typeof proof !== 'object') return mismatch();
  if (typeof proof.uid !== 'string' || !proof.uid.trim()) return mismatch();
  if (typeof proof.remoteLibraryId !== 'string' || !proof.remoteLibraryId.trim()) return mismatch();
  if (typeof proof.entityId !== 'string' || !proof.entityId.trim()) return mismatch();
  if (!Number.isInteger(proof.revision) || proof.revision < 1) return mismatch();
  if (typeof proof.operationDigest !== 'string' || !/^[a-fA-F0-9]{64}$/.test(proof.operationDigest)) {
    return mismatch();
  }

  let database: IDBDatabase;
  try {
    database = await openV2Database(profileId);
  } catch {
    return 'FAILED';
  }

  let profile: ProfileRecord | undefined;
  let operation: OutboxOperation | undefined;
  try {
    const read = database.transaction([STORES.profiles, STORES.outbox], 'readonly');
    profile = (await requestResult(read.objectStore(STORES.profiles).get(profileId))) as
      | ProfileRecord
      | undefined;
    operation = (await requestResult(read.objectStore(STORES.outbox).get(operationId))) as
      | OutboxOperation
      | undefined;
  } catch {
    return 'FAILED';
  }
  if (!profile || !operation) return mismatch();

  let digest: string;
  try {
    digest = await digestPayload(operation.payload);
  } catch {
    return 'FAILED';
  }
  const first = validateProof(profile, operation, proof, digest);
  if (first !== null) return first;

  const transaction = database.transaction(
    [STORES.profiles, STORES.outbox, STORES.meta],
    'readwrite',
  );

  try {
    const currentProfile = (await requestResult(
      transaction.objectStore(STORES.profiles).get(profileId),
    )) as ProfileRecord | undefined;
    const currentOperation = (await requestResult(
      transaction.objectStore(STORES.outbox).get(operationId),
    )) as OutboxOperation | undefined;
    if (!currentProfile || !currentOperation) {
      transaction.abort();
      return mismatch();
    }
    const second = validateProof(currentProfile, currentOperation, proof, digest);
    if (second !== null) {
      transaction.abort();
      return second;
    }

    transaction.objectStore(STORES.outbox).put({
      ...currentOperation,
      status: 'CONFIRMED',
      remoteRevision: proof.revision,
    });
    transaction.objectStore(STORES.meta).put({
      key: `ack:${operationId}`,
      value: {
        uid: proof.uid,
        remoteLibraryId: proof.remoteLibraryId,
        entityId: proof.entityId,
        revision: proof.revision,
        operationDigest: digest,
        confirmedAt: new Date().toISOString(),
      },
    });
    await transactionDone(transaction);
    return 'CONFIRMED';
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // already aborted
    }
    const persistence = toLocalPersistenceError(error);
    return persistence.kind === 'QUOTA' ? 'FAILED' : 'FAILED';
  }
}
