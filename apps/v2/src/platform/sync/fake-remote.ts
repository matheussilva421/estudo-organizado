import type {
  OutboxOperation,
  RemoteMutationPort,
  RemoteMutationResult,
} from '../../application/sync-types';

export type FakeRemotePortOptions = {
  uid: string;
  profileId: string;
  simulateTimeoutAfterApply?: boolean;
};

export class RemoteScopeError extends Error {
  readonly code = 'REMOTE_SCOPE';

  constructor(message = 'remote operation is outside the simulated uid/profile scope') {
    super(message);
    this.name = 'RemoteScopeError';
  }
}

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';

  constructor(operationId: string) {
    super(`remote commit timed out after applying ${operationId}`);
    this.name = 'TimeoutError';
  }
}

type RemoteEntity = {
  payload: OutboxOperation['payload'];
  revision: number;
};

type AppliedOperation = {
  profileId: string;
  entityId: string;
  remoteRevision: number;
};

function requireIdentifier(value: string, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new RemoteScopeError(`${label} is required for the simulated remote scope`);
  }
  return normalized;
}

function entityKey(profileId: string, entityId: string): string {
  return JSON.stringify([profileId, entityId]);
}

/**
 * Deterministic in-memory remote used only for contract tests.
 *
 * The port owns one profile under the constructor uid. `signInAs` simulates a
 * later auth session so tests can prove that another uid cannot write here.
 */
export class FakeRemotePort implements RemoteMutationPort {
  readonly profileId: string;

  private readonly ownerUid: string;
  private readonly simulateTimeoutAfterApply: boolean;
  private activeUid: string;
  private readonly entities = new Map<string, RemoteEntity>();
  private readonly tombstones = new Map<string, number>();
  private readonly appliedOperations = new Map<string, AppliedOperation>();

  constructor(options: FakeRemotePortOptions) {
    this.profileId = requireIdentifier(options.profileId, 'profileId');
    this.ownerUid = requireIdentifier(options.uid, 'uid');
    this.activeUid = this.ownerUid;
    this.simulateTimeoutAfterApply = options.simulateTimeoutAfterApply === true;
  }

  signInAs(uid: string): void {
    this.activeUid = requireIdentifier(uid, 'uid');
  }

  async apply(operation: OutboxOperation): Promise<RemoteMutationResult> {
    const operationProfileId = requireIdentifier(operation.profileId, 'profileId');
    this.assertScope(operationProfileId);

    const operationId = requireIdentifier(operation.operationId, 'operationId');
    const entityId = requireIdentifier(operation.entityId, 'entityId');

    const previous = this.appliedOperations.get(operationId);
    if (previous) {
      if (previous.profileId !== this.profileId || previous.entityId !== entityId) {
        throw new RemoteScopeError('operationId was already applied to another entity');
      }
      return { kind: 'ALREADY_APPLIED', remoteRevision: previous.remoteRevision };
    }

    const key = entityKey(this.profileId, entityId);
    const current = this.entities.get(key);
    const currentRevision = current?.revision ?? this.tombstones.get(key) ?? 0;
    const baseRevision = operation.baseRevision ?? 0;

    if (baseRevision !== currentRevision) {
      return { kind: 'CONFLICT', remoteRevision: currentRevision };
    }

    if (operation.kind === 'delete') {
      if (!current) {
        this.recordApplied(operationId, entityId, currentRevision);
        return this.result(operationId, currentRevision);
      }
      const remoteRevision = currentRevision + 1;
      this.entities.delete(key);
      this.tombstones.set(key, remoteRevision);
      this.recordApplied(operationId, entityId, remoteRevision);
      return this.result(operationId, remoteRevision);
    }

    const remoteRevision = currentRevision + 1;
    this.entities.set(key, {
      payload: structuredClone(operation.payload),
      revision: remoteRevision,
    });
    this.tombstones.delete(key);
    this.recordApplied(operationId, entityId, remoteRevision);
    return this.result(operationId, remoteRevision);
  }

  async lookup(operationId: string): Promise<'APPLIED' | 'MISSING' | 'UNKNOWN'> {
    const normalized = typeof operationId === 'string' ? operationId.trim() : '';
    if (!normalized) return 'MISSING';
    return this.appliedOperations.has(normalized) ? 'APPLIED' : 'MISSING';
  }

  private assertScope(profileId: string): void {
    if (profileId !== this.profileId) {
      throw new RemoteScopeError('operation profile does not match the simulated profile');
    }
    if (this.activeUid !== this.ownerUid) {
      throw new RemoteScopeError('active uid does not own the simulated profile');
    }
  }

  private recordApplied(operationId: string, entityId: string, remoteRevision: number): void {
    this.appliedOperations.set(operationId, {
      profileId: this.profileId,
      entityId,
      remoteRevision,
    });
  }

  private result(operationId: string, remoteRevision: number): RemoteMutationResult {
    if (this.simulateTimeoutAfterApply) throw new TimeoutError(operationId);
    return { kind: 'APPLIED', remoteRevision };
  }
}
