import type { PlanBlock, PlanningScenario } from './planning';
import {
  evaluateDailyCapacity,
  type AvailabilityException,
  type FixedCommitment,
  type WeeklyAvailability,
} from './planning-capacity';
import { addCivilDays, compareCivilDate, enumerateCivilDates, isCivilDate } from './planning-time';
import { rankContent, type PriorityItem, type PriorityProfile } from './planning-priority';

/**
 * Deterministic plan generation. It returns a proposal only: nothing is
 * persisted and nothing is activated until the user confirms it.
 */

export type PlanGenerationInput = {
  scenario: PlanningScenario;
  profile: PriorityProfile;
  items: PriorityItem[];
  startDate: string;
  horizonDays: number;
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  fixedBlocks: PlanBlock[];
  fixedCommitments?: FixedCommitment[];
  defaultMinutes?: number;
  operationId: string;
  /** Optional measured ceiling; generation is never silently truncated. */
  maxBlocks?: number;
};

export type GenerationExplanation = {
  blockId: string;
  contentKey: string;
  detail: string;
};

export type PlanGenerationPreview = {
  blocks: PlanBlock[];
  unallocated: PlanBlock[];
  explanations: GenerationExplanation[];
  inputRevisionSignature: string;
  limits: {
    consideredItems: number;
    acceptedItems: number;
    maxBlocks: number | null;
    blocked: boolean;
  };
};

export class GenerationLimitError extends Error {
  readonly code = 'GENERATION_LIMIT_EXCEEDED';
}

export type RedistributionInput = {
  blocks: PlanBlock[];
  startDate: string;
  horizonDays: number;
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  fixedCommitments?: FixedCommitment[];
  operationId: string;
};

export type RedistributionPreview = {
  blocks: PlanBlock[];
  moved: { blockId: string; from: string | null; to: string }[];
  unchanged: string[];
  stillUnallocatedIds: string[];
};

/**
 * Assisted redistribution: only UNALLOCATED blocks are proposed into days that
 * still have capacity. Confirmed blocks never move and nothing is persisted.
 */
export function previewRedistribution(
  input: RedistributionInput,
): RedistributionPreview {
  if (!isCivilDate(input.startDate)) throw new GenerationLimitError('INVALID_DATE');
  const horizonEnd = addCivilDays(input.startDate, Math.max(1, input.horizonDays) - 1);
  const dates = enumerateCivilDates(input.startDate, horizonEnd);
  const fixed = input.blocks.filter((block) => block.allocation !== 'UNALLOCATED');
  const pending = input.blocks
    .filter((block) => block.allocation === 'UNALLOCATED')
    .sort((left, right) => left.priority - right.priority || (left.id < right.id ? -1 : 1));

  const remaining = new Map<string, number>();
  for (const date of dates) {
    const capacity = evaluateDailyCapacity({
      date,
      zone: input.zone,
      weekly: input.weekly,
      exceptions: input.exceptions,
      reservations: fixed.filter((block) => block.civilDate === date),
      fixedCommitments: input.fixedCommitments,
    });
    remaining.set(date, capacity.remainingMinutes);
  }

  const blocks = input.blocks.map((block) => ({ ...block }));
  const moved: RedistributionPreview['moved'] = [];
  const stillUnallocatedIds: string[] = [];
  let dateIndex = 0;

  for (const block of pending) {
    let placed = false;
    while (dateIndex < dates.length) {
      const date = dates[dateIndex] as string;
      const free = remaining.get(date) ?? 0;
      if (free >= block.plannedMinutes) {
        const index = blocks.findIndex((item) => item.id === block.id);
        if (index >= 0) {
          blocks[index] = {
            ...(blocks[index] as PlanBlock),
            allocation: 'PROJECTED',
            civilDate: date,
            reason: undefined,
            sourceOperationId: input.operationId,
          };
        }
        remaining.set(date, free - block.plannedMinutes);
        moved.push({ blockId: block.id, from: block.civilDate ?? null, to: date });
        placed = true;
        break;
      }
      dateIndex += 1;
    }
    if (!placed) stillUnallocatedIds.push(block.id);
  }

  return {
    blocks: blocks.sort((left, right) => {
      const leftDate = left.civilDate ?? '9999-12-31';
      const rightDate = right.civilDate ?? '9999-12-31';
      return compareCivilDate(leftDate, rightDate) || (left.id < right.id ? -1 : 1);
    }),
    moved,
    unchanged: input.blocks
      .filter((block) => block.allocation !== 'UNALLOCATED')
      .map((block) => block.id),
    stillUnallocatedIds,
  };
}

function signatureOf(input: PlanGenerationInput): string {
  // A stable digest of everything that can change the proposal.
  const material = [
    input.scenario.id,
    `p${input.profile.id}@${input.profile.revision}`,
    input.startDate,
    String(input.horizonDays),
    input.zone,
    input.operationId,
    String(input.items.length),
    input.items
      .map((item) => `${item.contentKey}:${item.plannedMinutes ?? ''}:${item.pending ? 1 : 0}`)
      .join('|'),
  ].join('#');
  let hash = 2166136261;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.profile.id}@${input.profile.revision}:${(hash >>> 0).toString(16)}`;
}

export function generatePlanPreview(input: PlanGenerationInput): PlanGenerationPreview {
  if (!isCivilDate(input.startDate)) throw new GenerationLimitError('INVALID_DATE');
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1) {
    throw new GenerationLimitError('INVALID_HORIZON');
  }

  const maxBlocks = input.maxBlocks ?? null;
  const considered = input.items.length;
  const ranked = rankContent({
    profile: input.profile,
    items: input.items,
    referenceDate: input.scenario.examDate ?? input.startDate,
  });

  const horizonEnd = addCivilDays(input.startDate, input.horizonDays - 1);
  const dates = enumerateCivilDates(input.startDate, horizonEnd);
  const remainingByDate = new Map<string, number>();
  const fixed = input.fixedBlocks.filter(
    (block) => block.scenarioId === input.scenario.id,
  );
  // Official capacity is shared: blocks of every other active scenario also
  // reserve time, even though only this scenario's blocks are part of the
  // generated proposal.
  const capacityReservations = input.fixedBlocks;
  for (const date of dates) {
    const capacity = evaluateDailyCapacity({
      date,
      zone: input.zone,
      weekly: input.weekly,
      exceptions: input.exceptions,
      reservations: capacityReservations,
      fixedCommitments: input.fixedCommitments,
    });
    remainingByDate.set(date, capacity.remainingMinutes);
  }

  const blocks: PlanBlock[] = fixed.map((block) => ({ ...block }));
  const unallocated: PlanBlock[] = [];
  const explanations: GenerationExplanation[] = [];
  let dateIndex = 0;

  ranked.forEach((item, index) => {
    const minutes = item.plannedMinutes ?? input.defaultMinutes ?? 60;
    const blockId = `${input.scenario.id}~gen~${index}`;
    const base = {
      id: blockId,
      profileId: input.scenario.profileId,
      editalId: input.scenario.editalId,
      scenarioId: input.scenario.id,
      editalDisciplineId: item.editalDisciplineId,
      assuntoId: item.assuntoId,
      aulaId: item.aulaId,
      plannedMinutes: minutes,
      priority: Math.max(1, ranked.length - index),
      localRevision: 1,
      sourceOperationId: input.operationId,
      label: item.label,
    };

    let placed = false;
    while (dateIndex < dates.length) {
      const date = dates[dateIndex] as string;
      const remaining = remainingByDate.get(date) ?? 0;
      if (remaining >= minutes) {
        blocks.push({
          ...base,
          allocation: 'PROJECTED',
          civilDate: date,
        });
        remainingByDate.set(date, remaining - minutes);
        explanations.push({
          blockId,
          contentKey: item.contentKey,
          detail: `${item.explanation} | placed ${date}`,
        });
        placed = true;
        break;
      }
      dateIndex += 1;
    }

    if (!placed) {
      unallocated.push({
        ...base,
        allocation: 'UNALLOCATED',
        reason: 'NO_CAPACITY_IN_HORIZON',
      });
      explanations.push({
        blockId,
        contentKey: item.contentKey,
        detail: `${item.explanation} | unallocated: no capacity in horizon`,
      });
    }
  });

  const blocked = maxBlocks !== null && blocks.length + unallocated.length > maxBlocks;
  if (blocked) {
    throw new GenerationLimitError(
      `GENERATION_LIMIT_EXCEEDED: ${blocks.length + unallocated.length} > ${maxBlocks}`,
    );
  }

  return {
    blocks: blocks.sort((left, right) => {
      const leftDate = left.civilDate ?? '9999-12-31';
      const rightDate = right.civilDate ?? '9999-12-31';
      return compareCivilDate(leftDate, rightDate) || (left.id < right.id ? -1 : 1);
    }),
    unallocated: unallocated.sort((left, right) => (left.id < right.id ? -1 : 1)),
    explanations,
    inputRevisionSignature: signatureOf(input),
    limits: {
      consideredItems: considered,
      acceptedItems: blocks.length,
      maxBlocks,
      blocked: false,
    },
  };
}
