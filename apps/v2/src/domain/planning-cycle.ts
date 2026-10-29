import type {
  CivilDate,
  CycleContentRef,
  CycleSnapshot,
  PlanBlock,
  PlanningScenario,
} from './planning';
import {
  evaluateDailyCapacity,
  type AvailabilityException,
  type FixedCommitment,
  type WeeklyAvailability,
} from './planning-capacity';
import { addCivilDays, compareCivilDate, enumerateCivilDates, isCivilDate } from './planning-time';

/**
 * Cycle without an exam date.
 *
 * The cursor only moves through explicit commands. Nothing here reads the
 * clock, so a device date change can never "advance" a study plan, and a
 * projection is never study time actually performed.
 */

export type CycleContent = CycleContentRef;

export type CycleDecision =
  | { type: 'CONTINUE' }
  | { type: 'ADVANCE' }
  | { type: 'DEFER'; reason?: string }
  | { type: 'SKIP_WITH_REASON'; reason: string }
  | { type: 'REOPEN'; contentIndex: number }
  | { type: 'NEW_ROUND' };

export type CycleHistoryEntry = {
  round: number;
  decision: string;
  fromIndex: number;
  toIndex: number;
  reason?: string;
};

export type CyclePendingItem = {
  contentIndex: number;
  editalDisciplineId: string;
  assuntoId?: string | null;
  aulaId?: string | null;
  reason: string;
};

export type CycleState = CycleSnapshot & {
  profileId: string;
  scenarioId: string;
  localRevision: number;
};

export class CycleValidationError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'CycleValidationError';
    this.code = code;
  }
}

export function createCycleState(input: {
  profileId: string;
  scenarioId: string;
  content: CycleContent[];
}): CycleState {
  if (!input.profileId.trim() || !input.scenarioId.trim()) {
    throw new CycleValidationError('IDENTIFIER_REQUIRED');
  }
  return {
    profileId: input.profileId,
    scenarioId: input.scenarioId,
    content: input.content.map((item) => ({ ...item })),
    cursorIndex: 0,
    round: 1,
    localRevision: 1,
    pendings: [],
    history: [],
  };
}

function withHistory(state: CycleState, entry: CycleHistoryEntry): CycleHistoryEntry[] {
  const history = [...state.history, entry];
  // History is consultable, never unbounded in memory.
  return history.slice(-200);
}

export function currentCycleContent(state: CycleState): CycleContent | null {
  return state.content[state.cursorIndex] ?? null;
}

/**
 * Pure transition. Every branch returns a new object: the previous state is
 * the audit base and is never mutated.
 */
export function advanceCycle(state: CycleState, decision: CycleDecision): CycleState {
  const lastIndex = state.content.length - 1;
  const base = {
    ...state,
    content: state.content,
    localRevision: state.localRevision + 1,
  };

  switch (decision.type) {
    case 'CONTINUE': {
      const nextIndex = Math.min(state.cursorIndex + 1, Math.max(lastIndex, 0));
      return {
        ...base,
        cursorIndex: nextIndex,
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: nextIndex,
        }),
      };
    }
    case 'ADVANCE': {
      // The next discipline starts after the current block of content.
      const currentDiscipline = state.content[state.cursorIndex]?.editalDisciplineId;
      let nextIndex = Math.min(state.cursorIndex + 1, Math.max(lastIndex, 0));
      while (
        currentDiscipline &&
        nextIndex < state.content.length &&
        state.content[nextIndex]?.editalDisciplineId === currentDiscipline
      ) {
        nextIndex += 1;
      }
      nextIndex = Math.min(nextIndex, Math.max(lastIndex, 0));
      return {
        ...base,
        cursorIndex: nextIndex,
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: nextIndex,
        }),
      };
    }
    case 'DEFER': {
      const item = state.content[state.cursorIndex];
      if (!item) throw new CycleValidationError('CONTENT_REQUIRED');
      return {
        ...base,
        pendings: [
          ...state.pendings,
          {
            contentIndex: state.cursorIndex,
            editalDisciplineId: item.editalDisciplineId,
            assuntoId: item.assuntoId ?? null,
            aulaId: item.aulaId ?? null,
            reason: decision.reason?.trim() || 'DEFERRED',
          },
        ],
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: state.cursorIndex,
          reason: decision.reason,
        }),
      };
    }
    case 'SKIP_WITH_REASON': {
      if (!decision.reason || !decision.reason.trim()) {
        throw new CycleValidationError('REASON_REQUIRED');
      }
      const nextIndex = Math.min(state.cursorIndex + 1, Math.max(lastIndex, 0));
      return {
        ...base,
        cursorIndex: nextIndex,
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: nextIndex,
          reason: decision.reason.trim(),
        }),
      };
    }
    case 'REOPEN': {
      if (
        !Number.isInteger(decision.contentIndex) ||
        decision.contentIndex < 0 ||
        decision.contentIndex > lastIndex
      ) {
        throw new CycleValidationError('INVALID_CONTENT_INDEX');
      }
      return {
        ...base,
        cursorIndex: decision.contentIndex,
        pendings: state.pendings.filter((item) => item.contentIndex !== decision.contentIndex),
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: decision.contentIndex,
        }),
      };
    }
    case 'NEW_ROUND': {
      return {
        ...base,
        cursorIndex: 0,
        round: state.round + 1,
        history: withHistory(state, {
          round: state.round,
          decision: decision.type,
          fromIndex: state.cursorIndex,
          toIndex: 0,
        }),
      };
    }
    default:
      throw new CycleValidationError('INVALID_DECISION');
  }
}

export type CycleProjectionInput = {
  scenario: PlanningScenario;
  state: CycleState;
  startDate: CivilDate;
  horizonDays: number;
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  fixedBlocks: PlanBlock[];
  /** Other scenarios' reservations, so official capacity stays global. */
  capacityReservations?: PlanBlock[];
  fixedCommitments?: FixedCommitment[];
  defaultMinutes?: number;
  operationId: string;
};

export type CycleProjection = {
  blocks: PlanBlock[];
  horizonEnd: CivilDate;
  projectedCount: number;
  unallocatedCount: number;
};

/**
 * Projects the cycle into a renewable window. Fixed blocks are returned
 * unchanged and never moved; only flexible projections are recomputed.
 */
export function projectCycle(input: CycleProjectionInput): CycleProjection {
  if (!isCivilDate(input.startDate)) {
    throw new CycleValidationError('INVALID_DATE');
  }
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1) {
    throw new CycleValidationError('INVALID_HORIZON');
  }
  const horizonEnd = addCivilDays(input.startDate, input.horizonDays - 1);
  const dates = enumerateCivilDates(input.startDate, horizonEnd);
  const blocks: PlanBlock[] = input.fixedBlocks
    .filter((block) => block.scenarioId === input.scenario.id)
    .map((block) => ({ ...block }));

  const remainingByDate = new Map<CivilDate, number>();
  for (const date of dates) {
    const capacity = evaluateDailyCapacity({
      date,
      zone: input.zone,
      weekly: input.weekly,
      exceptions: input.exceptions,
      reservations: input.capacityReservations ?? blocks,
      fixedCommitments: input.fixedCommitments,
    });
    remainingByDate.set(date, capacity.remainingMinutes);
  }

  const queue = input.state.content.slice(input.state.cursorIndex);
  let dateIndex = 0;
  let projectedCount = 0;
  let unallocatedCount = 0;

  for (const [unitIndex, unit] of queue.entries()) {
    const minutes = unit.plannedMinutes ?? input.defaultMinutes ?? 60;
    let placed = false;
    while (dateIndex < dates.length) {
      const date = dates[dateIndex] as CivilDate;
      const remaining = remainingByDate.get(date) ?? 0;
      if (remaining >= minutes) {
        const absoluteIndex = input.state.cursorIndex + unitIndex;
        blocks.push({
          id: `${input.state.scenarioId}~block~${absoluteIndex}`,
          profileId: input.scenario.profileId,
          editalId: input.scenario.editalId,
          scenarioId: input.scenario.id,
          editalDisciplineId: unit.editalDisciplineId,
          assuntoId: unit.assuntoId ?? undefined,
          aulaId: unit.aulaId ?? undefined,
          plannedMinutes: minutes,
          allocation: 'PROJECTED',
          civilDate: date,
          priority: 1,
          localRevision: 1,
          sourceOperationId: input.operationId,
          label: unit.label,
        });
        remainingByDate.set(date, remaining - minutes);
        projectedCount += 1;
        placed = true;
        break;
      }
      dateIndex += 1;
    }
    if (!placed) {
      const absoluteIndex = input.state.cursorIndex + unitIndex;
      blocks.push({
        id: `${input.state.scenarioId}~block~${absoluteIndex}`,
        profileId: input.scenario.profileId,
        editalId: input.scenario.editalId,
        scenarioId: input.scenario.id,
        editalDisciplineId: unit.editalDisciplineId,
        assuntoId: unit.assuntoId ?? undefined,
        aulaId: unit.aulaId ?? undefined,
        plannedMinutes: minutes,
        allocation: 'UNALLOCATED',
        priority: 1,
        localRevision: 1,
        sourceOperationId: input.operationId,
        label: unit.label,
        reason: 'HORIZON_CAPACITY_EXHAUSTED',
      });
      unallocatedCount += 1;
    }
  }

  return {
    blocks: blocks.sort((left, right) => {
      const leftDate = left.civilDate ?? '9999-12-31';
      const rightDate = right.civilDate ?? '9999-12-31';
      return compareCivilDate(leftDate, rightDate) || (left.id < right.id ? -1 : 1);
    }),
    horizonEnd,
    projectedCount,
    unallocatedCount,
  };
}
