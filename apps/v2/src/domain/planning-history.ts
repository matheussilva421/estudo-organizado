import type { PlanBlock, PlanningScenarioSnapshot } from './planning';

/**
 * History, checkpoints and compensation.
 *
 * Undo never restores an old state by deleting later work: it compensates the
 * difference, keeps the journal and refuses to rewrite real execution facts.
 */

export type CheckpointManifest = {
  blockIds: string[];
  blockCount: number;
  scenarioRevision: number;
  digest: string;
};

export type PlanningCheckpointRecord = {
  checkpointId: string;
  profileId: string;
  scenarioId: string;
  kind: 'MANUAL' | 'AUTO';
  createdAt: string;
  operationId: string;
  manifest: CheckpointManifest;
  snapshot?: PlanningScenarioSnapshot;
};

export type ExecutionFact = {
  sessionId: string;
  plannedBlockId?: string | null;
  durationMinutes: number;
};

export type CompensationInput = {
  direction: 'UNDO' | 'REDO';
  target: PlanningScenarioSnapshot;
  current: PlanningScenarioSnapshot;
  executionFacts?: ExecutionFact[];
  draftBlockIds?: string[];
};

export type CompensationConflict = {
  blockId: string;
  reason: 'EXECUTION_LINKED' | 'DRAFT_DEPENDS';
};

export type CompensationPreview = {
  kind: 'APPLICABLE' | 'BLOCKED';
  blocks: PlanBlock[];
  restoredBlockIds: string[];
  removedBlockIds: string[];
  addedBlockIds: string[];
  conflicts: CompensationConflict[];
  warnings: string[];
};

function byId(blocks: PlanBlock[]): Map<string, PlanBlock> {
  return new Map(blocks.map((block) => [block.id, block]));
}

/**
 * Diffs two snapshots and blocks any compensation that would rewrite a block
 * already referenced by a real (simulated F4) session or by an open draft.
 */
export function previewCompensation(input: CompensationInput): CompensationPreview {
  const currentBlocks = byId(input.current.blocks);
  const targetBlocks = byId(input.target.blocks);
  const executionBlockIds = new Set(
    (input.executionFacts ?? [])
      .map((fact) => fact.plannedBlockId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const draftBlockIds = new Set(input.draftBlockIds ?? []);

  const restoredBlockIds: string[] = [];
  const removedBlockIds: string[] = [];
  const addedBlockIds: string[] = [];
  const conflicts: CompensationConflict[] = [];
  const warnings: string[] = [];

  for (const [id, target] of targetBlocks) {
    const current = currentBlocks.get(id);
    if (!current) {
      addedBlockIds.push(id);
      if (executionBlockIds.has(id)) conflicts.push({ blockId: id, reason: 'EXECUTION_LINKED' });
      continue;
    }
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      restoredBlockIds.push(id);
      if (executionBlockIds.has(id)) conflicts.push({ blockId: id, reason: 'EXECUTION_LINKED' });
      if (draftBlockIds.has(id)) conflicts.push({ blockId: id, reason: 'DRAFT_DEPENDS' });
    }
  }
  for (const [id] of currentBlocks) {
    if (targetBlocks.has(id)) continue;
    removedBlockIds.push(id);
    if (executionBlockIds.has(id)) conflicts.push({ blockId: id, reason: 'EXECUTION_LINKED' });
    if (draftBlockIds.has(id)) conflicts.push({ blockId: id, reason: 'DRAFT_DEPENDS' });
  }

  if (conflicts.some((item) => item.reason === 'EXECUTION_LINKED')) {
    warnings.push('EXECUTION_FACTS_ARE_IMMUTABLE');
  }
  if (conflicts.some((item) => item.reason === 'DRAFT_DEPENDS')) {
    warnings.push('OPEN_DRAFT_DEPENDS_ON_THESE_BLOCKS');
  }

  return {
    kind: conflicts.length > 0 ? 'BLOCKED' : 'APPLICABLE',
    blocks: input.target.blocks.map((block) => ({ ...block })),
    restoredBlockIds,
    removedBlockIds,
    addedBlockIds,
    conflicts,
    warnings,
  };
}

export type RetentionInput = {
  checkpoints: PlanningCheckpointRecord[];
  draftScenarioIds?: string[];
  openConflictIds?: string[];
  tombstoneKeys?: string[];
};

/**
 * Manual checkpoints are never dropped. Automatic ones are only candidates for
 * consolidation when nothing references the scenario any more.
 */
export function planRetention(input: RetentionInput): {
  kept: string[];
  consolidationCandidates: string[];
} {
  const draftScenarios = new Set(input.draftScenarioIds ?? []);
  const kept: string[] = [];
  const consolidationCandidates: string[] = [];
  for (const checkpoint of input.checkpoints) {
    if (checkpoint.kind === 'MANUAL') {
      kept.push(checkpoint.checkpointId);
      continue;
    }
    if (draftScenarios.has(checkpoint.scenarioId)) {
      kept.push(checkpoint.checkpointId);
      continue;
    }
    consolidationCandidates.push(checkpoint.checkpointId);
  }
  return { kept, consolidationCandidates };
}

export function checkpointDigest(snapshot: PlanningScenarioSnapshot): string {
  const material = [
    snapshot.scenario.id,
    String(snapshot.scenario.localRevision),
    ...snapshot.blocks.map((block) => `${block.id}:${String(block.localRevision)}`),
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
