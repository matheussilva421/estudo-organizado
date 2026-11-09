import type { OutboxOperation, RemoteMutationPort } from '../../application/sync-types';
import {
  classifyFailure,
  planRetry,
  RETRY_MAX_MS,
  type FailureClass,
} from './retry-policy';
import { digestPayload } from './firebase-remote';

export type FlushResult = {
  confirmedIds: string[];
  conflicts: string[];
  conflictRevisions: Record<string, number>;
  conflictRemotes: Record<string, { payload: unknown | null; deleted: boolean }>;
  pending: string[];
  proof: Record<string, number>;
  failures: FlushFailure[];
  /** Operations the delivery gate refused to send at all. */
  blocked: string[];
};

export type FlushFailure = {
  operationId: string;
  reason: FailureClass;
  attempts: number;
  nextRetryAt: number | null;
};

export type FlushOptions = {
  now?: number;
  jitter?: () => number;
  attemptOf?: (operation: OutboxOperation) => number;
  /**
   * Mandatory delivery authorization. Without it nothing is sent, so a caller
   * that forgets the gate cannot push unconsented content to an adapter.
   */
  canSend: (operation: OutboxOperation) => boolean;
};

export async function flushPending(
  operations: OutboxOperation[],
  remote: RemoteMutationPort,
  options: FlushOptions,
): Promise<FlushResult> {
  const confirmedIds: string[] = [];
  const conflicts: string[] = [];
  const conflictRevisions: Record<string, number> = {};
  const conflictRemotes: Record<string, { payload: unknown | null; deleted: boolean }> = {};
  const pending: string[] = [];
  const proof: Record<string, number> = {};
  const failures: FlushFailure[] = [];
  const blocked: string[] = [];
  const now = options.now ?? Date.now();
  const blockedEntities = new Set<string>();

  for (const operation of operations) {
    if (blockedEntities.has(operation.entityId)) {
      blocked.push(operation.operationId);
      continue;
    }
    // Fail closed: no explicit authorization means no send.
    if (typeof options.canSend !== 'function' || !options.canSend(operation)) {
      blocked.push(operation.operationId);
      continue;
    }
    try {
      const result = await remote.apply(operation);
      if (result.kind === 'CONFLICT') {
        conflicts.push(operation.operationId);
        conflictRevisions[operation.operationId] = result.remoteRevision;
        if (result.remote) conflictRemotes[operation.operationId] = result.remote;
        blockedEntities.add(operation.entityId);
        continue;
      }
      confirmedIds.push(operation.operationId);
      proof[operation.operationId] = result.remoteRevision;
    } catch (error) {
      const expectedDigest = await digestPayload(operation.payload).catch(() => null);
      if (expectedDigest === null) {
        pending.push(operation.operationId);
        continue;
      }
      const lookup = await remote
        .lookup(operation.operationId, operation.entityId, expectedDigest)
        .catch(() => 'UNKNOWN' as const);
      if (lookup !== 'APPLIED') {
        pending.push(operation.operationId);
        const reason = classifyFailure(error);
        if (reason !== 'TRANSIENT') blockedEntities.add(operation.entityId);
        const attempts = (options.attemptOf?.(operation) ?? operation.attempts ?? 0) + 1;
        if (reason === 'TRANSIENT') {
          const plan = planRetry(attempts, now, options.jitter?.() ?? 0);
          failures.push({
            operationId: operation.operationId,
            reason,
            attempts,
            nextRetryAt: plan.nextRetryAt,
          });
        } else {
          // Deterministic/auth/quota keep the intent but leave the retry loop
          // for a later human decision; a cooldown avoids hot spinning.
          failures.push({
            operationId: operation.operationId,
            reason,
            attempts,
            nextRetryAt: now + RETRY_MAX_MS,
          });
        }
        continue;
      }

      const remoteRevision = remote.lookupRevision
        ? await remote.lookupRevision(operation.operationId).catch(() => null)
        : null;
      if (typeof remoteRevision !== 'number') {
        pending.push(operation.operationId);
        continue;
      }
      confirmedIds.push(operation.operationId);
      proof[operation.operationId] = remoteRevision;
    }
  }

  return {
    confirmedIds,
    conflicts,
    conflictRevisions,
    conflictRemotes,
    pending,
    proof,
    failures,
    blocked,
  };
}
