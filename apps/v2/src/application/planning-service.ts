import type {
  PlanBlock,
  PlanningOutcome,
  PlanningScenario,
  PlanningScenarioSnapshot,
  PlanningScope,
} from '../domain/planning';

export type {
  PlanBlock,
  PlanningOutcome,
  PlanningScenario,
  PlanningScenarioSnapshot,
  PlanningScope,
};

/** Editable block fields; the merge and draft layers share this vocabulary. */
export type DraftBlockField =
  | 'civilDate'
  | 'localStart'
  | 'localEnd'
  | 'timeZone'
  | 'plannedMinutes'
  | 'priority'
  | 'allocation'
  | 'editalDisciplineId'
  | 'assuntoId'
  | 'aulaId'
  | 'label';

export type PlanningDraftChange = {
  blockId: string;
  field: DraftBlockField;
  value: string | number | null;
};

/**
 * Local staging area of one scenario. It is never the committed plan: the
 * draft survives reloads, failures and conflicts, and only an explicit apply
 * reaches the scenario records.
 */
export type PlanningDraft = {
  id: string;
  profileId: string;
  scenarioId: string;
  baseRevision: number;
  changes: PlanningDraftChange[];
  newBlocks?: PlanBlock[];
  deletedBlockIds?: string[];
  lastSavedAt: string;
};

export type PlanningCheckpointRequest = {
  checkpointId: string;
  kind: 'MANUAL' | 'AUTO';
  manifest?: Record<string, unknown>;
};

export type PlanningCommitChanges = {
  scenario?: PlanningScenario;
  upsertBlocks?: PlanBlock[];
  deleteBlockIds?: string[];
};

export type PlanningCommit = {
  scope: PlanningScope;
  scenarioId: string;
  baseRevision: number | null;
  changes: PlanningCommitChanges;
  approvedPreviewToken?: string;
  checkpoint?: PlanningCheckpointRequest;
  summary?: string;
};

export type PlanningOperationRecord = {
  operationId: string;
  profileId: string;
  entityType: 'planning-commit';
  entityId: string;
  command: unknown;
  outcome: PlanningOutcome<PlanningScenarioSnapshot>;
  committedAt: string;
};

/**
 * The only write path of F3 planning. Implementations must validate the base
 * revision inside a single IndexedDB transaction and persist entities, the
 * operation record and the outbox intents together.
 */
export interface PlanningRepository {
  commit(input: PlanningCommit): Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  loadScenario(profileId: string, scenarioId: string): Promise<PlanningScenarioSnapshot | null>;
  listScenarios(profileId: string, editalId?: string): Promise<PlanningScenario[]>;
  saveDraft(draft: PlanningDraft): Promise<PlanningOutcome<PlanningDraft>>;
  loadDraft(profileId: string, scenarioId: string): Promise<PlanningDraft | null>;
}

export const PLANNING_ENTITY_SCHEMA_VERSION = 1;
