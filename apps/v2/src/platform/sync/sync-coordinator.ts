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
import type { PullResult } from './change-feed';
import { canDeliver, type DeliveryBinding } from './delivery-policy';
import {
  assessSyncBudgetDetailed,
  type SyncUsage,
  type SyncUsageLimits,
} from './budget';
import {
  applyRetryPlan,
  clearRecoveryRequired,
  getConflicts,
  getEligibleOutbox,
  getRecoveryRequired,
  markConflict,
  markRecoveryRequired,
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
  pull?: (profileId: string) => Promise<PullResult>;
  budget?: { usage: SyncUsage; limits: SyncUsageLimits };
  persistBudget?: (usage: SyncUsage) => Promise<void>;
  countConflicts?: (profileId: string) => Promise<number>;
};

function health(
  localCommitted: boolean,
  remoteCommitted: boolean,
  pendingCount: number,
  mode: string,
  converged = false,
  conflictCount = 0,
): SyncHealth {
  return {
    localCommitted,
    remoteCommitted,
    converged,
    pendingCount: Math.max(0, pendingCount),
    mode,
    ...(conflictCount > 0 ? { conflictCount } : {}),
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
  private readonly pull: ((profileId: string) => Promise<PullResult>) | null;
  private readonly budget: SyncCoordinatorOptions['budget'];
  private readonly persistBudget: SyncCoordinatorOptions['persistBudget'];
  private readonly countConflicts: (profileId: string) => Promise<number>;
  private readonly stopped = new Set<string>();
  private readonly recoveryRequired = new Set<string>();

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
    this.pull = options.pull ?? null;
    this.budget = options.budget;
    this.persistBudget = options.persistBudget;
    this.countConflicts =
      options.countConflicts ??
      (async (profileId) => {
        const conflicts = await getConflicts(profileId);
        return conflicts.filter((conflict) => conflict.status === 'OPEN').length;
      });
  }

  stop(profileId: string): void {
    this.stopped.add(profileId);
  }

  async clearRecovery(profileId: string): Promise<void> {
    this.recoveryRequired.delete(profileId);
    await clearRecoveryRequired(profileId);
  }

  async requestFlush(profileId: string, reason: FlushReason): Promise<SyncHealth> {
    if (this.stopped.has(profileId)) {
      const pending = await this.pendingCount(profileId);
      return pending < 0
        ? health(true, false, 0, 'FAILED')
        : health(true, false, pending, 'STOPPED');
    }
    const recovery = await getRecoveryRequired(profileId).catch(() => null);
    if (recovery || this.recoveryRequired.has(profileId)) {
      this.recoveryRequired.add(profileId);
      const pending = await this.pendingCount(profileId);
      const conflicts = await this.openConflictCount(profileId);
      return health(
        true,
        false,
        (pending < 0 ? 0 : pending) + conflicts,
        'RECOVERY_REQUIRED',
        false,
        conflicts,
      );
    }
    const lockName = `estudo-organizado-v2:flush:${profileId}`;
    const outcome = await withSafeFlushLock(lockName, () => this.run(profileId, reason), this.locks);
    if (outcome.kind === 'BLOCKED') {
      const pending = await this.pendingCount(profileId);
      return pending < 0
        ? health(true, false, 0, 'FAILED')
        : health(true, false, pending, 'PAUSED_LOCK');
    }
    return outcome.value;
  }

  private async pendingCount(profileId: string): Promise<number> {
    try {
      return (await this.getEligible(profileId, this.now())).length;
    } catch {
      return -1;
    }
  }

  private async run(profileId: string, _reason: FlushReason): Promise<SyncHealth> {
    if (this.stopped.has(profileId)) {
      return health(true, false, 0, 'STOPPED');
    }
    const recovery = await getRecoveryRequired(profileId).catch(() => null);
    if (recovery || this.recoveryRequired.has(profileId)) {
      this.recoveryRequired.add(profileId);
      const pending = await this.pendingCount(profileId);
      const conflicts = await this.openConflictCount(profileId);
      return health(
        true,
        false,
        (pending < 0 ? 0 : pending) + conflicts,
        'RECOVERY_REQUIRED',
        false,
        conflicts,
      );
    }

    // The cursor safety check happens before the first write. A pull may apply
    // remote changes and persist conflicts; running it first also guarantees
    // that stale cursors cannot be bypassed by a flush.
    let prePull: PullResult | null = null;
    if (this.pull) {
      prePull = await this.pull(profileId).catch(() => 'FAILED' as const);
      if (this.stopped.has(profileId)) {
        return health(true, false, 0, 'STOPPED');
      }
      if (prePull === 'RECOVERY_REQUIRED') {
        await this.requireRecovery(profileId, 'UNSAFE_CURSOR');
        const pending = await this.pendingCount(profileId);
        const conflicts = await this.openConflictCount(profileId);
        return health(
          true,
          false,
          (pending < 0 ? 0 : pending) + conflicts,
          'RECOVERY_REQUIRED',
          false,
          conflicts,
        );
      }
    }

    const operations = await this.getEligible(profileId, this.now()).catch(() => null);
    if (operations === null) return health(true, false, 0, 'FAILED');
    if (operations.length === 0) {
      const conflicts = await this.openConflictCount(profileId);
      return health(
        true,
        false,
        conflicts,
        conflicts > 0 ? 'CONFLICT' : 'READY',
        conflicts === 0 && prePull === 'CONVERGED',
        conflicts,
      );
    }

    const profile = await this.getProfile(profileId).catch(() => null);
    if (!profile) {
      return health(true, false, operations.length, 'PAUSED_AUTH');
    }
    if (this.budget) {
      const assessment = assessSyncBudgetDetailed(this.budget.usage, this.budget.limits, {
        reads: operations.length * 3,
        writes: operations.filter((operation) => operation.kind === 'upsert').length,
        deletes: operations.filter((operation) => operation.kind === 'delete').length,
      });
      if (assessment.kind === 'PAUSE') {
        return health(true, false, operations.length, 'PAUSED_QUOTA');
      }
    }
    const result: FlushResult = await flushPending(operations, this.remote, {
      now: this.now(),
      canSend: (operation) => {
        const binding: DeliveryBinding = {
          operationId: operation.operationId,
          profileId: operation.profileId,
          deliveryUid: operation.deliveryUid ?? null,
          remoteLibraryId: operation.remoteLibraryId ?? null,
          attempts: operation.attempts ?? 0,
          nextRetryAt: operation.nextRetryAt ?? null,
        };
        return canDeliver(operation, binding, profile);
      },
      shouldAbort: () => this.stopped.has(profileId),
    });

    let confirmed = 0;
    let ackFailures = 0;
    if (this.stopped.has(profileId)) {
      return health(true, false, 0, 'STOPPED');
    }
    for (const operationId of result.confirmedIds) {
      if (this.stopped.has(profileId)) break;
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
      else ackFailures += 1;
    }

    for (const operationId of result.conflicts) {
      const operation = operations.find((candidate) => candidate.operationId === operationId);
      if (!operation) continue;
      const remoteRevision = result.conflictRevisions[operationId] ?? 0;
      if (remoteRevision >= 1) {
        await this.persistConflict(
          profileId,
          operation,
          remoteRevision,
          result.conflictRemotes[operationId],
          result.conflictEpochs[operationId],
        );
      }
    }

    if (result.failures.length > 0) {
      await this.applyRetry(profileId, result.failures);
    }

    const openConflicts = await this.openConflictCount(profileId);
    const pendingCount =
      result.pending.length + result.blocked.length + openConflicts + ackFailures;
    const remoteCommitted = confirmed > 0;
    if (this.budget) {
      this.budget.usage.reads += operations.length * 3;
      this.budget.usage.writes += confirmed;
      this.budget.usage.deletes += operations.filter(
        (operation) => operation.kind === 'delete' && result.confirmedIds.includes(operation.operationId),
      ).length;
      this.budget.usage.bytesOut += operations.reduce(
        (total, operation) =>
          total + new TextEncoder().encode(JSON.stringify(operation.payload)).length,
        0,
      );
      await this.persistBudget?.(this.budget.usage);
    }
    const mode = openConflicts > 0 ? 'CONFLICT' : pendingCount > 0 ? 'SYNCING' : 'READY';
    return health(
      true,
      remoteCommitted,
      pendingCount,
      mode,
      prePull === 'CONVERGED' && pendingCount === 0,
      openConflicts,
    );
  }

  private async openConflictCount(profileId: string): Promise<number> {
    return this.countConflicts(profileId).catch(() => 0);
  }

  private async requireRecovery(profileId: string, reason: string): Promise<void> {
    this.recoveryRequired.add(profileId);
    await markRecoveryRequired(profileId, reason).catch(() => undefined);
  }
}
