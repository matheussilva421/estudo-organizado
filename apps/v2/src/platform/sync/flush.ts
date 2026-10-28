import type { OutboxOperation, RemoteMutationPort } from '../../application/sync-types';
import {
  classifyFailure,
  planRetry,
  RETRY_MAX_MS,
  type FailureClass,
} from './retry-policy';

export type FlushResult = {
  confirmedIds: string[];
  conflicts: string[];
  conflictRevisions: Record<string, number>;
  pending: string[];
  proof: Record<string, number>;
  failures: FlushFailure[];
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
};

export async function flushPending(
  operations: OutboxOperation[],
  remote: RemoteMutationPort,
  options: FlushOptions = {},
): Promise<FlushResult> {
  const confirmedIds: string[] = [];
  const conflicts: string[] = [];
  const conflictRevisions: Record<string, number> = {};
  const pending: string[] = [];
  const proof: Record<string, number> = {};
  const failures: FlushFailure[] = [];
  const now = options.now ?? Date.now();

  for (const operation of operations) {
    try {
      const result = await remote.apply(operation);
      if (result.kind === 'CONFLICT') {
        conflicts.push(operation.operationId);
        conflictRevisions[operation.operationId] = result.remoteRevision;
        continue;
      }
      confirmedIds.push(operation.operationId);
      proof[operation.operationId] = result.remoteRevision;
    } catch (error) {
      const lookup = await remote
        .lookup(operation.operationId, operation.entityId)
        .catch(() => 'UNKNOWN' as const);
      if (lookup !== 'APPLIED') {
        pending.push(operation.operationId);
        const reason = classifyFailure(error);
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

  return { confirmedIds, conflicts, conflictRevisions, pending, proof, failures };
}
