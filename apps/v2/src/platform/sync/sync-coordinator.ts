import type {
  OutboxOperation,
  RemoteMutationPort,
  SyncHealth,
} from '../../application/sync-types';
import type { ProfileRecord } from '../../application/profile-service';
import { flushPending, type FlushResult } from './flush';
import { withSafeFlushLock, type LockPort } from './coordination';
import { confirmRemoteOperation } from './ack';
import { digestPayload } from './firebase-remote';
import {
  applyRetryPlan,
  getEligibleOutbox,
  markConflict,
} from '../indexeddb';
import { LocalProfileRepository } from '../local-profile-repository';

export type FlushReason = 'LOCAL_COMMIT' | 'RECONNECT' | 'RESUME' | 'MANUAL';

export type SyncCoordinatorOptions = {
  remote: RemoteMutationPort;
  locks: LockPort | null;
  now?: () => number;
  getEligible?: (profileId: string, now: number) => Promise<OutboxOperation[]>;
  getProfile?: (profileId: string) => Promise<ProfileRecord>;
  confirm?: typeof confirmRemoteOperation;
  applyRetry?: typeof applyRetryPlan;
  persistConflict?: typeof markConflict;
  digest?: (payload: unknown) => Promise<string>;
};

function health(
  localCommitted: boolean,
  remoteCommitted: boolean,
  pendingCount: number,
  mode: string,
): SyncHealth {
  return {
    localCommitted,
    remoteCommitted,
    // A verified pull cursor is required before claiming convergence; T09 owns
    // that proof, so a flush alone never turns this into true.
    converged: false,
    pendingCount: Math.max(0, pendingCount),
    mode,
  };
}

/**
 * One flush coordinator per profile. The lock is the cross-tab barrier; the
 * remote proof is the only reason to write a local ACK.
 */
export class SyncCoordinator {
  private readonly remote: RemoteMutationPort;
  private readonly locks: LockPort | null;
  private readonly now: () => number;
  private readonly getEligible: (profileId: string, now: number) => Promise<OutboxOperation[]>;
  private readonly getProfile: (profileId: string) => Promise<ProfileRecord>;
  private readonly confirm: typeof confirmRemoteOperation;
  private readonly applyRetry: typeof applyRetryPlan;
  private readonly persistConflict: typeof markConflict;
  private readonly digest: (payload: unknown) => Promise<string>;
  private readonly stopped = new Set<string>();

  constructor(options: SyncCoordinatorOptions) {
    this.remote = options.remote;
    this.locks = options.locks;
    this.now = options.now ?? (() => Date.now());
    this.getEligible = options.getEligible ?? getEligibleOutbox;
    this.getProfile = options.getProfile ?? ((profileId) => new LocalProfileRepository().getProfile(profileId));
    this.confirm = options.confirm ?? confirmRemoteOperation;
    this.applyRetry = options.applyRetry ?? applyRetryPlan;
    this.persistConflict = options.persistConflict ?? markConflict;
    this.digest = options.digest ?? digestPayload;
  }

  stop(profileId: string): void {
    this.stopped.add(profileId);
  }

  async requestFlush(profileId: string, reason: FlushReason): Promise<SyncHealth> {
    if (this.stopped.has(profileId)) {
      return health(true, false, await this.pendingCount(profileId), 'STOPPED');
    }
    const lockName = `estudo-organizado-v2:flush:${profileId}`;
    const outcome = await withSafeFlushLock(lockName, () => this.run(profileId, reason), this.locks);
    if (outcome.kind === 'BLOCKED') {
      return health(true, false, await this.pendingCount(profileId), 'PAUSED_LOCK');
    }
    return outcome.value;
  }

  private async pendingCount(profileId: string): Promise<number> {
    try {
      return (await this.getEligible(profileId, this.now())).length;
    } catch {
      return 0;
    }
  }

  private async run(profileId: string, _reason: FlushReason): Promise<SyncHealth> {
    const operations = await this.getEligible(profileId, this.now());
    if (operations.length === 0) return health(true, false, 0, 'READY');

    const result: FlushResult = await flushPending(operations, this.remote, {
      now: this.now(),
      canSend: () => true,
    });

    let confirmed = 0;
    let conflicts = 0;
    for (const operationId of result.confirmedIds) {
      const operation = operations.find((candidate) => candidate.operationId === operationId);
      if (!operation) continue;
      const profile = await this.getProfile(profileId).catch(() => null);
      // A logout or UID switch between send and ACK must never confirm the old
      // account's operation in the new session.
      if (
        !profile ||
        !profile.uid ||
        profile.uid !== operation.deliveryUid ||
        profile.remoteLibraryId !== operation.remoteLibraryId
      ) {
        continue;
      }
      const revision = result.proof[operationId];
      if (typeof revision !== 'number') continue;
      const digest = await this.digest(operation.payload);
      const ack = await this.confirm(profileId, operationId, {
        uid: operation.deliveryUid ?? '',
        remoteLibraryId: operation.remoteLibraryId ?? '',
        entityId: operation.entityId,
        revision,
        operationDigest: digest,
      });
      if (ack === 'CONFIRMED' || ack === 'ALREADY_CONFIRMED') confirmed += 1;
    }

    for (const operationId of result.conflicts) {
      const operation = operations.find((candidate) => candidate.operationId === operationId);
      if (!operation) continue;
      const remoteRevision = result.conflictRevisions[operationId] ?? 0;
      if (remoteRevision >= 1) {
        await this.persistConflict(profileId, operation, remoteRevision);
        conflicts += 1;
      }
    }

    if (result.failures.length > 0) {
      await this.applyRetry(profileId, result.failures);
    }

    const pendingCount = result.pending.length + result.blocked.length + conflicts;
    const remoteCommitted = confirmed > 0;
    return health(true, remoteCommitted, pendingCount, pendingCount > 0 ? 'SYNCING' : 'READY');
  }
}
