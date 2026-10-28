import type { OutboxOperation, RemoteMutationPort } from '../../application/sync-types';

export type FlushResult = {
  confirmedIds: string[];
  conflicts: string[];
  conflictRevisions: Record<string, number>;
  pending: string[];
  proof: Record<string, number>;
};

export async function flushPending(
  operations: OutboxOperation[],
  remote: RemoteMutationPort,
): Promise<FlushResult> {
  const confirmedIds: string[] = [];
  const conflicts: string[] = [];
  const conflictRevisions: Record<string, number> = {};
  const pending: string[] = [];
  const proof: Record<string, number> = {};

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
    } catch {
      const lookup = await remote.lookup(operation.operationId).catch(() => 'UNKNOWN' as const);
      if (lookup !== 'APPLIED') {
        pending.push(operation.operationId);
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

  return { confirmedIds, conflicts, conflictRevisions, pending, proof };
}
