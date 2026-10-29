import type { PlanBlock, PlanningScenarioSnapshot } from './planning';
import type { DraftBlockField, PlanningDraft, PlanningDraftChange } from '../application/planning-service';

/**
 * Three-way merge of a planning draft against base and current snapshots.
 * Independent fields merge; the same field on the same block never does, and
 * a delete racing an edit stays a conflict instead of choosing a winner.
 */

export type MergeConflict = {
  blockId: string;
  field: DraftBlockField | 'BLOCK';
  base: unknown;
  current: unknown;
  incoming: unknown;
};

export type MergePreview = {
  kind: 'MERGEABLE' | 'CONFLICT';
  blocks: PlanBlock[];
  changes: PlanBlock[];
  conflicts: MergeConflict[];
  capacityImpact: { deltaMinutes: number; touchedBlockIds: string[] };
};

function blockById(snapshot: PlanningScenarioSnapshot, blockId: string): PlanBlock | null {
  return snapshot.blocks.find((block) => block.id === blockId) ?? null;
}

export function readBlockField(block: PlanBlock, field: DraftBlockField): unknown {
  return (block as unknown as Record<string, unknown>)[field];
}

function applyField(block: PlanBlock, field: DraftBlockField, value: unknown): PlanBlock {
  return { ...block, [field]: value === null ? undefined : value } as PlanBlock;
}

export function baseSnapshotForDraft(
  current: PlanningScenarioSnapshot,
  draft: PlanningDraft,
): PlanningScenarioSnapshot {
  // Reconstruct the base the draft was written against from the recorded
  // baseValue of each change; unchanged blocks simply match current.
  const blocks = current.blocks.map((block) => ({ ...block }));
  for (const change of draft.changes) {
    if (change.baseValue === undefined) continue;
    const index = blocks.findIndex((block) => block.id === change.blockId);
    if (index < 0) continue;
    blocks[index] = applyField(blocks[index] as PlanBlock, change.field, change.baseValue);
  }
  return { scenario: current.scenario, blocks };
}

export function mergePlanningDraft(input: {
  base: PlanningScenarioSnapshot;
  current: PlanningScenarioSnapshot;
  draft: PlanningDraft;
}): MergePreview {
  const { base, current, draft } = input;
  const result = current.blocks.map((block) => ({ ...block }));
  const conflicts: MergeConflict[] = [];
  const changed = new Set<string>();
  const conflicted = new Set<string>();
  let deltaMinutes = 0;

  const deletions = new Set(draft.deletedBlockIds ?? []);

  for (const change of draft.changes) {
    const baseBlock = blockById(base, change.blockId);
    const currentBlock = blockById(current, change.blockId);
    if (!currentBlock) {
      // A block removed in current while the draft edited it is a conflict.
      if (deletions.has(change.blockId)) continue;
      conflicted.add(change.blockId);
      conflicts.push({
        blockId: change.blockId,
        field: change.field,
        base: readBlockField(baseBlock ?? ({ } as PlanBlock), change.field),
        current: undefined,
        incoming: change.value,
      });
      continue;
    }
    if (deletions.has(change.blockId)) {
      conflicted.add(change.blockId);
      conflicts.push({
        blockId: change.blockId,
        field: 'BLOCK',
        base: true,
        current: 'EDITED',
        incoming: 'DELETED',
      });
      continue;
    }
    const baseValue = change.baseValue ?? readBlockField(baseBlock ?? currentBlock, change.field);
    const currentValue = readBlockField(currentBlock, change.field);
    const incoming = change.value;

    if (valuesEqual(currentValue, incoming)) continue;
    if (!valuesEqual(currentValue, baseValue) && !valuesEqual(baseValue, incoming)) {
      conflicted.add(change.blockId);
      conflicts.push({
        blockId: change.blockId,
        field: change.field,
        base: baseValue,
        current: currentValue,
        incoming,
      });
      continue;
    }

    const index = result.findIndex((block) => block.id === change.blockId);
    if (index < 0) continue;
    const before = result[index] as PlanBlock;
    const after = applyField(before, change.field, incoming);
    result[index] = after;
    changed.add(change.blockId);
    if (change.field === 'plannedMinutes') {
      deltaMinutes += Number(incoming ?? 0) - Number(readBlockField(before, 'plannedMinutes') ?? 0);
    }
  }

  for (const blockId of deletions) {
    const currentBlock = blockById(current, blockId);
    if (!currentBlock) continue;
    if (changed.has(blockId) || conflicted.has(blockId)) continue;
    const index = result.findIndex((block) => block.id === blockId);
    if (index >= 0) {
      deltaMinutes -= currentBlock.plannedMinutes;
      result.splice(index, 1);
      changed.add(blockId);
    }
  }

  for (const incoming of draft.newBlocks ?? []) {
    if (current.blocks.some((block) => block.id === incoming.id)) {
      conflicted.add(incoming.id);
      conflicts.push({
        blockId: incoming.id,
        field: 'BLOCK',
        base: null,
        current: 'EXISTS',
        incoming: 'NEW',
      });
      continue;
    }
    result.push({ ...incoming });
    changed.add(incoming.id);
    deltaMinutes += incoming.plannedMinutes;
  }

  return {
    kind: conflicts.length > 0 ? 'CONFLICT' : 'MERGEABLE',
    blocks: result,
    changes: result.filter((block) => changed.has(block.id)),
    conflicts,
    capacityImpact: { deltaMinutes, touchedBlockIds: [...changed] },
  };
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null && right === undefined) return true;
  if (left === undefined && right === null) return true;
  return false;
}

export function draftSignature(changes: PlanningDraftChange[]): string {
  return changes
    .map(
      (change) =>
        `${change.blockId}.${change.field}=${String(change.value)}@${String(change.baseValue ?? '')}`,
    )
    .sort()
    .join('|');
}
