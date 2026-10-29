import type { CivilDate, PlanBlock, PlanningScenario } from '../domain/planning';
import {
  evaluateDailyCapacity,
  selectOfficialReservations,
  type AvailabilityException,
  type FixedCommitment,
  type WeeklyAvailability,
} from '../domain/planning-capacity';
import { compareCivilDate, enumerateCivilDates, isCivilDate } from '../domain/planning-time';

/**
 * Calendar queries are pure derivations of the committed plan. Nothing here
 * writes: the UI may render as often as it wants without creating state.
 */

export type CalendarAvailability = {
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  fixedCommitments?: FixedCommitment[];
};

export type CalendarQuery = {
  profileId: string;
  rangeStart: CivilDate;
  rangeEnd: CivilDate;
  /** true: only ACTIVE scenarios; false: also consultable history. */
  activeOnly: boolean;
  blocks: PlanBlock[];
  scenarios: PlanningScenario[];
  availability?: CalendarAvailability;
};

export type CalendarDay = {
  civilDate: CivilDate;
  blocks: PlanBlock[];
  availableMinutes: number;
  reservedMinutes: number;
  unallocatedIds: string[];
  conflicts: string[];
};

const EMPTY_WEEKLY: WeeklyAvailability = { timeZone: 'UTC', days: {} };

export function queryCalendar(input: CalendarQuery): CalendarDay[] {
  if (!isCivilDate(input.rangeStart) || !isCivilDate(input.rangeEnd)) return [];
  if (compareCivilDate(input.rangeStart, input.rangeEnd) > 0) return [];

  const scenarios = input.scenarios.filter(
    (scenario) => scenario.profileId === input.profileId,
  );
  const activeIds = new Set(
    scenarios.filter((scenario) => scenario.status === 'ACTIVE').map((scenario) => scenario.id),
  );

  const visible = input.blocks.filter(
    (block) =>
      block.profileId === input.profileId &&
      (input.activeOnly ? activeIds.has(block.scenarioId) : true) &&
      typeof block.civilDate === 'string' &&
      isCivilDate(block.civilDate) &&
      compareCivilDate(block.civilDate, input.rangeStart) >= 0 &&
      compareCivilDate(block.civilDate, input.rangeEnd) <= 0,
  );

  // Capacity is always derived from ACTIVE scenarios only, even when the user
  // is consulting closed history in the same range.
  const official = selectOfficialReservations(scenarios, input.blocks, input.profileId);
  const availability = input.availability;

  return enumerateCivilDates(input.rangeStart, input.rangeEnd).map((civilDate) => {
    const dayBlocks = visible
      .filter((block) => block.civilDate === civilDate)
      .sort((left, right) => {
        const leftStart = left.localStart ?? '';
        const rightStart = right.localStart ?? '';
        if (leftStart !== rightStart) return leftStart < rightStart ? -1 : 1;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      });

    const capacity = availability
      ? evaluateDailyCapacity({
          date: civilDate,
          zone: availability.zone,
          weekly: availability.weekly ?? EMPTY_WEEKLY,
          exceptions: availability.exceptions,
          reservations: official.filter((block) => block.civilDate === civilDate),
          fixedCommitments: availability.fixedCommitments,
        })
      : null;

    return {
      civilDate,
      blocks: dayBlocks,
      availableMinutes: capacity?.availableMinutes ?? 0,
      reservedMinutes: capacity?.reservedMinutes ?? 0,
      unallocatedIds: capacity?.unallocatedBlockIds ?? [],
      conflicts: capacity?.diagnostics ?? [],
    };
  });
}

export type CalendarRangeSummary = {
  days: number;
  blocks: number;
  availableMinutes: number;
  reservedMinutes: number;
  conflictIds: string[];
  unallocatedIds: string[];
};

export function summarizeCalendar(days: CalendarDay[]): CalendarRangeSummary {
  return {
    days: days.length,
    blocks: days.reduce((sum, day) => sum + day.blocks.length, 0),
    availableMinutes: days.reduce((sum, day) => sum + day.availableMinutes, 0),
    reservedMinutes: days.reduce((sum, day) => sum + day.reservedMinutes, 0),
    conflictIds: [...new Set(days.flatMap((day) => day.conflicts))],
    unallocatedIds: [...new Set(days.flatMap((day) => day.unallocatedIds))],
  };
}

/** Blocks of one scenario, already scoped to the profile. */
export function scenarioBlocks(
  blocks: PlanBlock[],
  profileId: string,
  scenarioId: string,
): PlanBlock[] {
  return blocks
    .filter((block) => block.profileId === profileId && block.scenarioId === scenarioId)
    .sort((left, right) => (left.civilDate ?? '').localeCompare(right.civilDate ?? '') || (left.id < right.id ? -1 : 1));
}
