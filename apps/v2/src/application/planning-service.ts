import type {
  PlanBlock,
  PlanningOutcome,
  PlanningScenario,
  PlanningScenarioSnapshot,
  PlanningScope,
} from '../domain/planning';
import {
  baseSnapshotForDraft,
  draftSignature,
  mergePlanningDraft,
  type MergeConflict,
} from '../domain/planning-merge';

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
  /** Value the draft was written against; used by the three-way merge. */
  baseValue?: string | number | null;
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

export type PlanningCheckpointInput = {
  profileId: string;
  scenarioId: string;
  checkpointId: string;
  kind: 'MANUAL' | 'AUTO';
  operationId: string;
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
  activateScenario?(input: PlanningActivationInput): Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  createCheckpoint?(
    input: PlanningCheckpointInput,
  ): Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  listCheckpoints?(profileId: string, scenarioId: string): Promise<unknown[]>;
}

export const PLANNING_ENTITY_SCHEMA_VERSION = 1;

export type PlanningActivationInput = {
  profileId: string;
  operationId: string;
  editalId: string;
  scenarioId: string;
  /** Activation is refused outright when no checkpoint is proven. */
  checkpointId?: string | null;
  baseRevision?: number | null;
};

export type DraftCommitPreview = {
  scenarioId: string;
  baseRevision: number;
  currentRevision: number;
  conflicts: MergeConflict[];
  blocks: PlanBlock[];
  changedBlockIds: string[];
  deletedBlockIds: string[];
  canApply: boolean;
  /** True when the draft was written against an older revision. */
  rebased: boolean;
  previewToken: string;
};

export function previewDraftCommit(input: {
  current: PlanningScenarioSnapshot;
  draft: PlanningDraft;
}): DraftCommitPreview {
  const base = baseSnapshotForDraft(input.current, input.draft);
  const merged = mergePlanningDraft({ base, current: input.current, draft: input.draft });
  const mergedIds = new Set(merged.blocks.map((block) => block.id));
  const deletedBlockIds = input.current.blocks
    .filter((block) => !mergedIds.has(block.id))
    .map((block) => block.id);
  const previewToken = `${input.draft.scenarioId}:${input.current.scenario.localRevision}:${
    draftSignature(input.draft.changes)
  }`;
  return {
    scenarioId: input.draft.scenarioId,
    baseRevision: input.draft.baseRevision,
    currentRevision: input.current.scenario.localRevision,
    conflicts: merged.conflicts,
    blocks: merged.blocks,
    changedBlockIds: merged.changes.map((block) => block.id),
    deletedBlockIds,
    // A stale draft is merged three-way; only real field conflicts block it.
    canApply: merged.conflicts.length === 0,
    rebased: input.draft.baseRevision !== input.current.scenario.localRevision,
    previewToken,
  };
}

export async function applyPlanningDraft(
  repository: PlanningRepository,
  input: {
    profileId: string;
    scenarioId: string;
    draft: PlanningDraft;
    approval: { confirmed: boolean; previewToken: string };
  },
): Promise<PlanningOutcome<PlanningScenarioSnapshot>> {
  if (!input.approval.confirmed) {
    return { kind: 'BLOCKED', reason: 'CONFIRMATION_REQUIRED' };
  }
  const current = await repository.loadScenario(input.profileId, input.scenarioId);
  if (!current) return { kind: 'INVALID', code: 'SCENARIO_NOT_FOUND' };
  if (input.draft.profileId !== input.profileId) {
    return { kind: 'INVALID', code: 'PROFILE_MISMATCH' };
  }
  if (input.draft.scenarioId !== input.scenarioId) {
    return { kind: 'INVALID', code: 'SCENARIO_MISMATCH' };
  }
  const preview = previewDraftCommit({ current, draft: input.draft });
  if (!preview.canApply) {
    return { kind: 'CONFLICT', current: preview.conflicts };
  }
  if (preview.previewToken !== input.approval.previewToken) {
    return { kind: 'INVALID', code: 'PREVIEW_TOKEN_MISMATCH' };
  }

  const upsertBlocks = preview.blocks.filter((block) =>
    preview.changedBlockIds.includes(block.id),
  );
  return repository.commit({
    // The token includes the scenario revision and the change signature, so a
    // replay of the same apply is idempotent while an edited draft is a new
    // operation instead of a reused id.
    scope: {
      profileId: input.profileId,
      operationId: `apply-${input.draft.id}-${preview.previewToken}`,
    },
    scenarioId: input.scenarioId,
    baseRevision: current.scenario.localRevision,
    changes: {
      upsertBlocks: upsertBlocks.length > 0 ? upsertBlocks : undefined,
      deleteBlockIds:
        preview.deletedBlockIds.length > 0 ? preview.deletedBlockIds : undefined,
    },
    approvedPreviewToken: preview.previewToken,
  });
}
