import type { CivilDate, PlanBlock, PlanningScenario } from './planning';
import { validateScenario, PlanningValidationError } from './planning';
import {
  projectCycle,
  type CycleState,
} from './planning-cycle';
import type {
  AvailabilityException,
  FixedCommitment,
  WeeklyAvailability,
} from './planning-capacity';
import { addCivilDays, compareCivilDate, isCivilDate } from './planning-time';

/**
 * Final stretch. It exists only with a confirmed exam date, and closing it
 * never claims the exam actually happened.
 */

export type TransitionInput = {
  cycle: PlanningScenario;
  cycleState: CycleState;
  nextScenarioId: string;
  examDate: CivilDate;
  startDate: CivilDate;
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  fixedBlocks: PlanBlock[];
  /** Reservations of other active scenarios. */
  capacityBlocks?: PlanBlock[];
  fixedCommitments?: FixedCommitment[];
  defaultMinutes?: number;
  operationId: string;
};

export type TransitionPreview = {
  newScenario: PlanningScenario;
  blocks: PlanBlock[];
  preservedBlockIds: string[];
  affectedBlockIds: string[];
  unallocatedBlockIds: string[];
  requiresConfirmation: true;
  warnings: string[];
};

function daysBetween(from: CivilDate, to: CivilDate): number {
  let cursor = from;
  let days = 0;
  while (compareCivilDate(cursor, to) < 0 && days < 3650) {
    cursor = addCivilDays(cursor, 1);
    days += 1;
  }
  return compareCivilDate(cursor, to) === 0 ? days : -1;
}

/**
 * Cycle -> Final stretch. The previous cycle is preserved untouched; the
 * preview only proposes the new scenario and its blocks.
 */
export function previewFinalStretchTransition(input: TransitionInput): TransitionPreview {
  if (input.cycle.kind !== 'CYCLE') {
    throw new PlanningValidationError('NOT_A_CYCLE_SCENARIO');
  }
  if (!isCivilDate(input.examDate)) {
    throw new PlanningValidationError('EXAM_DATE_REQUIRED');
  }
  if (!isCivilDate(input.startDate)) {
    throw new PlanningValidationError('INVALID_DATE');
  }

  const warnings: string[] = [];
  const distance = daysBetween(input.startDate, input.examDate);
  const examPassed = distance < 0;
  if (examPassed) {
    // A date in the past is never treated as proof of realization.
    warnings.push('EXAM_DATE_PASSED_REQUIRES_CONFIRMATION');
  }
  const horizonDays = examPassed ? 1 : Math.max(1, distance + 1);

  const newScenario: PlanningScenario = validateScenario({
    ...input.cycle,
    id: input.nextScenarioId,
    kind: 'FINAL_STRETCH',
    name: `Reta Final · ${input.cycle.name}`,
    status: 'DRAFT',
    examDate: input.examDate,
    localRevision: 1,
    createdAt: undefined,
    updatedAt: undefined,
  });

  const cycleFixed = input.fixedBlocks.filter(
    (block) => block.scenarioId === input.cycle.id,
  );
  const carried: PlanBlock[] = cycleFixed
    .filter((block) => block.allocation === 'CONFIRMED_DAY' || block.allocation === 'CONFIRMED_TIME')
    .map((block) => ({
      ...block,
      // Block ids are globally keyed by [profileId, id]; the new scenario must
      // never collide with the cycle blocks it was derived from.
      id: `${newScenario.id}~${block.id}`,
      scenarioId: newScenario.id,
    }));

  const projection = projectCycle({
    scenario: newScenario,
    state: input.cycleState,
    startDate: input.startDate,
    horizonDays,
    zone: input.zone,
    weekly: input.weekly,
    exceptions: input.exceptions,
    fixedBlocks: carried,
    capacityReservations: input.capacityBlocks,
    fixedCommitments: input.fixedCommitments,
    defaultMinutes: input.defaultMinutes,
    operationId: input.operationId,
  });

  const preservedBlockIds = carried
    .filter((block) => block.civilDate && compareCivilDate(block.civilDate, input.examDate) <= 0)
    .map((block) => block.id);
  const affectedBlockIds = input.fixedBlocks
    .filter(
      (block) =>
        block.scenarioId === input.cycle.id &&
        block.allocation === 'PROJECTED',
    )
    .map((block) => block.id);

  return {
    newScenario,
    blocks: projection.blocks,
    preservedBlockIds,
    affectedBlockIds,
    unallocatedBlockIds: projection.blocks
      .filter((block) => block.allocation === 'UNALLOCATED')
      .map((block) => block.id),
    requiresConfirmation: true,
    warnings,
  };
}

export type ExamDateChange =
  | { kind: 'POSTPONE'; nextExamDate: CivilDate }
  | { kind: 'ADVANCE'; nextExamDate: CivilDate }
  | { kind: 'SUSPEND' }
  | { kind: 'CANCEL' }
  | { kind: 'EXPIRE_CHECK' };

export type ExamDateChangeInput = {
  scenario: PlanningScenario;
  blocks: PlanBlock[];
  change: ExamDateChange;
  /** Explicit reference date; the device clock is never trusted. */
  referenceDate: CivilDate;
  operationId: string;
};

export type ExamDateChangePreview = {
  newScenario: PlanningScenario;
  blocks: PlanBlock[];
  preservedBlockIds: string[];
  affectedBlockIds: string[];
  unallocatedBlockIds: string[];
  requiresConfirmation: true;
  warnings: string[];
};

/**
 * Replanned exam date. Only future planning changes: confirmed blocks before
 * the new date keep their identity, later projections are reported as
 * affected and the history is never rewritten.
 */
export function previewExamDateChange(input: ExamDateChangeInput): ExamDateChangePreview {
  if (input.scenario.kind !== 'FINAL_STRETCH') {
    throw new PlanningValidationError('NOT_A_FINAL_STRETCH_SCENARIO');
  }
  if (!isCivilDate(input.referenceDate)) {
    throw new PlanningValidationError('INVALID_DATE');
  }

  const warnings: string[] = [];
  const ownBlocks = input.blocks.filter(
    (block) =>
      block.scenarioId === input.scenario.id && block.profileId === input.scenario.profileId,
  );
  const fixed = ownBlocks.filter(
    (block) => block.allocation === 'CONFIRMED_DAY' || block.allocation === 'CONFIRMED_TIME',
  );
  const projected = ownBlocks.filter((block) => block.allocation === 'PROJECTED');

  const base: PlanningScenario = {
    ...input.scenario,
    localRevision: input.scenario.localRevision + 1,
  };

  const currentExam = input.scenario.examDate ?? null;
  if (input.change.kind === 'EXPIRE_CHECK') {
    const expired = currentExam !== null && compareCivilDate(input.referenceDate, currentExam) > 0;
    if (!expired) {
      return {
        newScenario: input.scenario,
        blocks: ownBlocks,
        preservedBlockIds: fixed.map((block) => block.id),
        affectedBlockIds: [],
        unallocatedBlockIds: [],
        requiresConfirmation: true,
        warnings: [],
      };
    }
    warnings.push('EXAM_DATE_PASSED_REQUIRES_CONFIRMATION');
    return {
      newScenario: { ...base, examDate: currentExam },
      blocks: fixed,
      preservedBlockIds: fixed.map((block) => block.id),
      affectedBlockIds: projected.map((block) => block.id),
      unallocatedBlockIds: [],
      requiresConfirmation: true,
      warnings,
    };
  }

  if (input.change.kind === 'SUSPEND' || input.change.kind === 'CANCEL') {
    warnings.push('PROJECTIONS_SUSPENDED');
    return {
      newScenario: {
        ...base,
        status: 'SUSPENDED',
        examDate: null,
      },
      blocks: fixed,
      preservedBlockIds: fixed.map((block) => block.id),
      affectedBlockIds: projected.map((block) => block.id),
      unallocatedBlockIds: [],
      requiresConfirmation: true,
      warnings,
    };
  }

  const nextExamDate = input.change.nextExamDate;
  if (!isCivilDate(nextExamDate)) {
    throw new PlanningValidationError('EXAM_DATE_REQUIRED');
  }
  const movingForward = input.change.kind === 'POSTPONE';
  if (movingForward && currentExam && compareCivilDate(nextExamDate, currentExam) < 0) {
    warnings.push('DATE_DOES_NOT_MATCH_CHANGE');
  }
  if (!movingForward && currentExam && compareCivilDate(nextExamDate, currentExam) > 0) {
    warnings.push('DATE_DOES_NOT_MATCH_CHANGE');
  }

  const kept = fixed.filter(
    (block) => !block.civilDate || compareCivilDate(block.civilDate, nextExamDate) <= 0,
  );
  const lateFixed = fixed.filter(
    (block) => block.civilDate && compareCivilDate(block.civilDate, nextExamDate) > 0,
  );
  const keptProjected = projected.filter(
    (block) => !block.civilDate || compareCivilDate(block.civilDate, nextExamDate) <= 0,
  );
  const droppedProjected = projected.filter(
    (block) => block.civilDate && compareCivilDate(block.civilDate, nextExamDate) > 0,
  );

  if (lateFixed.length > 0) warnings.push('FIXED_BLOCKS_AFTER_NEW_EXAM_DATE');

  return {
    newScenario: {
      ...base,
      examDate: nextExamDate,
      // Changing the date never activates a scenario: activation keeps its own
      // checkpointed command.
      status: input.scenario.status,
    },
    blocks: [...kept, ...keptProjected],
    preservedBlockIds: [...kept, ...keptProjected].map((block) => block.id),
    affectedBlockIds: [...lateFixed, ...droppedProjected].map((block) => block.id),
    unallocatedBlockIds: [],
    requiresConfirmation: true,
    warnings,
  };
}

export type FinalStretchClosing = {
  status: 'CLOSED';
  outcome: 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED';
  closedAt: string;
};

/** Closing is explicit: an expired date never closes a scenario by itself. */
export function closeFinalStretch(input: {
  scenario: PlanningScenario;
  outcome: FinalStretchClosing['outcome'];
  closedAt: string;
}): { scenario: PlanningScenario; closing: FinalStretchClosing } {
  if (input.scenario.kind !== 'FINAL_STRETCH') {
    throw new PlanningValidationError('NOT_A_FINAL_STRETCH_SCENARIO');
  }
  return {
    scenario: {
      ...input.scenario,
      status: 'CLOSED',
      localRevision: input.scenario.localRevision + 1,
    },
    closing: { status: 'CLOSED', outcome: input.outcome, closedAt: input.closedAt },
  };
}
