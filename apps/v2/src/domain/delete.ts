import { ContentValidationError, type Id } from './edital';

export type DeletableEntityType =
  | 'edital'
  | 'edital-discipline'
  | 'assunto'
  | 'aula'
  | 'lesson-topic-link';

/** F2 has no F4 sessions; the UI must say so instead of inventing progress. */
export const EXECUTION_DATA_STATE = 'SEM_DADOS_DE_EXECUCAO' as const;

export type LogicalTombstone = {
  profileId: Id;
  entityType: DeletableEntityType;
  entityId: Id;
  operationId: Id;
  baseRevision: number | null;
  /** Monotonic per-profile generation; a stale backup cannot resurrect data. */
  epoch: number;
  deleted: true;
  deletedAt: string;
  snapshot: Record<string, unknown>;
};

export type DependencyEntry = { entityType: string; count: number };

export type DependencyReport = {
  code: 'DEPENDENT_CONTENT';
  entityType: DeletableEntityType;
  entityId: Id;
  dependents: DependencyEntry[];
};

export function epochKey(profileId: Id): string {
  return `epoch:${profileId}`;
}

export function nextEpoch(current: number | undefined): number {
  if (current === undefined) return 1;
  if (!Number.isInteger(current) || current < 0) {
    throw new ContentValidationError('INVALID_COMMAND', 'epoch must be a non-negative integer');
  }
  return current + 1;
}

export function assertTombstoneScope(tombstone: LogicalTombstone, profileId: Id): void {
  if (tombstone.profileId !== profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'tombstone belongs to another profile');
  }
  if (tombstone.deleted !== true) {
    throw new ContentValidationError('TOMBSTONE_CONFLICT', 'tombstone is not a deletion marker');
  }
}

export function isDeletableEntityType(value: string): value is DeletableEntityType {
  return (
    value === 'edital' ||
    value === 'edital-discipline' ||
    value === 'assunto' ||
    value === 'aula' ||
    value === 'lesson-topic-link'
  );
}
