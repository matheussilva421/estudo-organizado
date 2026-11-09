import type { ContentEntity, ContentEntityType } from './content-commands';
import type { PlanBlock, PlanningScenario } from '../domain/planning';
import type { StudySession } from '../domain/session';
import type { HabitOccurrence } from '../domain/session-habits';
import type {
  BoardEvidence,
  ContextPriorityProjection,
  ReviewCommitment,
  ReviewExecution,
  ReviewPolicy,
  ReviewTopicLink,
  TopicMatchDecision,
} from '../domain/review';

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

/** F3 planning entities travel in the same outbox, discriminated by type. */
export type PlanningEntityType = 'planning-scenario' | 'plan-block';

export type SessionEntityType = 'study-session';

export type HabitEntityType = 'habit-occurrence';

export type ReviewEntityType =
  | 'review-topic'
  | 'review-policy'
  | 'review-commitment'
  | 'review-execution'
  | 'review-board-evidence'
  | 'review-match'
  | 'review-priority';

export type OutboxEntityType =
  | ContentEntityType
  | PlanningEntityType
  | SessionEntityType
  | HabitEntityType
  | ReviewEntityType;

export type OutboxPayload =
  | ContentEntity
  | PlanningScenario
  | PlanBlock
  | StudySession
  | HabitOccurrence
  | ReviewTopicLink
  | ReviewPolicy
  | ReviewCommitment
  | ReviewExecution
  | BoardEvidence
  | TopicMatchDecision
  | ContextPriorityProjection;

export type OutboxOperation = {
  operationId: string;
  profileId: string;
  entityType: OutboxEntityType;
  entityId: string;
  kind: 'upsert' | 'delete';
  baseRevision: number | null;
  payload: OutboxPayload;
  schemaVersion: number;
  status: OutboxStatus;
  /** Legacy F3/F5 rows remain local until an explicit consent migration. */
  deliveryMode?: 'BLOCKED';
  /**
   * Revision expected at the remote side. Local CAS keeps using
   * `baseRevision`; the adapter compares this value instead, so a conflict
   * resolution can target the remote revision without rewriting history.
   */
  remoteBaseRevision?: number | null;
  /** Causal order inside one entity; the outbox key stays the operationId. */
  sequence?: number;
  /** Revision proved by the remote adapter before a durable ACK. */
  remoteRevision?: number;
  attempts?: number;
  nextRetryAt?: number | null;
  /** Delivery metadata, assigned only after explicit consent. */
  deliveryUid?: string | null;
  remoteLibraryId?: string | null;
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
  | {
      kind: 'CONFLICT';
      remoteRevision: number;
      remote?: { payload: unknown | null; deleted: boolean };
    };

export type RemoteMutationPort = {
  apply(operation: OutboxOperation): Promise<RemoteMutationResult>;
  /** `entityId` guards against an ACK from another entity reusing the id. */
  lookup(
    operationId: string,
    entityId?: string,
    payloadDigest?: string,
  ): Promise<'APPLIED' | 'MISSING' | 'UNKNOWN' | 'MISMATCH'>;
  lookupRevision?(operationId: string): Promise<number | null>;
};

export type SyncHealth = {
  localCommitted: boolean;
  remoteCommitted: boolean;
  converged: boolean;
  pendingCount: number;
  mode: string;
  lastVerifiedCursor?: string;
  /** Open remote conflicts that require an explicit local/remote decision. */
  conflictCount?: number;
};
