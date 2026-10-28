import type { StudySubject } from '../domain/subject';

export type SyncState =
  | 'LOCAL_ONLY'
  | 'LINKING'
  | 'READY'
  | 'SYNCING'
  | 'PENDING_OFFLINE'
  | 'PAUSED_AUTH'
  | 'PAUSED_QUOTA'
  | 'CONFLICT'
  | 'RECOVERY_REQUIRED';

export type OutboxStatus = 'PENDING' | 'CONFIRMED' | 'CONFLICT';

export type OutboxOperation = {
  operationId: string;
  profileId: string;
  entityType: 'subject';
  entityId: string;
  kind: 'upsert' | 'delete';
  baseRevision: number | null;
  payload: StudySubject;
  schemaVersion: number;
  status: OutboxStatus;
};

export type ProfileBinding = {
  profileId: string;
  uid: string | null;
  syncEnabled: boolean;
  state: SyncState;
};

export type RemoteMutationResult =
  | { kind: 'APPLIED'; remoteRevision: number }
  | { kind: 'ALREADY_APPLIED'; remoteRevision: number }
  | { kind: 'CONFLICT'; remoteRevision: number };

export type RemoteMutationPort = {
  apply(operation: OutboxOperation): Promise<RemoteMutationResult>;
  lookup(operationId: string): Promise<'APPLIED' | 'MISSING' | 'UNKNOWN'>;
};

export type SyncHealth = {
  localCommitted: boolean;
  remoteCommitted: boolean;
  converged: boolean;
  pendingCount: number;
  mode: string;
  lastVerifiedCursor?: string;
};
