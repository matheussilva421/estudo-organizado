import type { CivilDate, PlanBlock, PlanningScenario } from './planning';
import {
  addCivilDays,
  compareCivilDate,
  isCivilDate,
  resolveZonedInterval,
  weekdayIndex,
} from './planning-time';

/**
 * Shared availability and official capacity.
 *
 * Precedence is fixed by the spec: a date exception beats a special period,
 * which beats the weekly routine. Capacity is global per profile and only
 * ACTIVE scenarios reserve it. Windows are resolved against their IANA zone,
 * so a DST transition changes the real minutes without inventing wall time.
 */

export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export type TimeWindow = { start: string; end: string };

export type WeeklyAvailability = {
  timeZone: string;
  days: Partial<Record<Weekday, TimeWindow[]>>;
};

export type AvailabilityException = {
  exceptionId: string;
  kind: 'DATE' | 'PERIOD';
  startDate: CivilDate;
  endDate?: CivilDate;
  /** A declared day without study. */
  closed?: boolean;
  windows?: TimeWindow[] | null;
  /** Capacity in minutes when the exception does not describe windows. */
  minutesOverride?: number | null;
  note?: string;
};

export type FixedCommitment = {
  commitmentId: string;
  civilDate: CivilDate;
  start: string;
  end: string;
  timeZone: string;
  academic?: boolean;
};

export type CapacityInput = {
  date: CivilDate;
  zone: string;
  weekly: WeeklyAvailability;
  exceptions: AvailabilityException[];
  reservations: PlanBlock[];
  fixedCommitments?: FixedCommitment[];
};

export type DailyCapacity = {
  availableMinutes: number;
  reservedMinutes: number;
  remainingMinutes: number;
  conflictBlockIds: string[];
  /** Blocks explicitly left without a slot, never dropped. */
  unallocatedBlockIds: string[];
  diagnostics: string[];
};

export type InstantRange = { start: number; end: number };

export type AvailabilityResolution = {
  availableMinutes: number;
  windows: InstantRange[];
  source: 'DATE_EXCEPTION' | 'PERIOD_EXCEPTION' | 'WEEKLY' | 'CLOSED' | 'AMBIGUOUS';
  diagnostics: string[];
};

const WEEKDAYS: Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function mergeRanges(ranges: InstantRange[]): InstantRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: InstantRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function totalMinutes(ranges: InstantRange[]): number {
  return Math.round(ranges.reduce((sum, range) => sum + (range.end - range.start), 0) / 60_000);
}

function weekdayOf(date: CivilDate): Weekday {
  return WEEKDAYS[weekdayIndex(date)] as Weekday;
}

function coversDate(exception: AvailabilityException, date: CivilDate): boolean {
  if (!isCivilDate(exception.startDate)) return false;
  if (exception.kind === 'DATE') return exception.startDate === date;
  const end =
    exception.endDate && isCivilDate(exception.endDate)
      ? exception.endDate
      : exception.startDate;
  if (compareCivilDate(exception.startDate, end) > 0) return false;
  return compareCivilDate(exception.startDate, date) <= 0 && compareCivilDate(date, end) <= 0;
}

type WindowResolution = { ok: true; range: InstantRange } | { ok: false; code: string };

function resolveWindow(
  window: TimeWindow,
  date: CivilDate,
  zone: string,
): WindowResolution {
  const resolved = resolveZonedInterval({
    date,
    start: window.start,
    end: window.end,
    zone,
  });
  if (!resolved.ok) return { ok: false, code: resolved.code };
  return {
    ok: true,
    range: {
      start: Date.parse(resolved.startInstant),
      end: Date.parse(resolved.endInstant),
    },
  };
}

/**
 * Resolves how many minutes a civil date really offers. Collisions at the same
 * precedence are reported instead of being decided arbitrarily.
 */
export function resolveDailyAvailability(
  input: Pick<CapacityInput, 'date' | 'weekly' | 'exceptions' | 'zone'>,
): AvailabilityResolution {
  const diagnostics: string[] = [];
  const dateMatches = input.exceptions.filter(
    (exception) => exception.kind === 'DATE' && coversDate(exception, input.date),
  );
  const periodMatches = input.exceptions.filter(
    (exception) => exception.kind === 'PERIOD' && coversDate(exception, input.date),
  );
  const source: AvailabilityResolution['source'] =
    dateMatches.length > 0
      ? 'DATE_EXCEPTION'
      : periodMatches.length > 0
        ? 'PERIOD_EXCEPTION'
        : 'WEEKLY';
  const chosen = dateMatches.length > 0 ? dateMatches : periodMatches;

  if (chosen.length > 1) {
    diagnostics.push('AMBIGUOUS_EXCEPTION');
    return { availableMinutes: 0, windows: [], source: 'AMBIGUOUS', diagnostics };
  }

  const zone = input.weekly.timeZone || input.zone;
  const exception = chosen[0];
  if (exception) {
    if (exception.closed === true) {
      return { availableMinutes: 0, windows: [], source: 'CLOSED', diagnostics };
    }
    if (exception.windows && exception.windows.length > 0) {
      const ranges: InstantRange[] = [];
      for (const window of exception.windows) {
        const resolved = resolveWindow(window, input.date, zone);
        if (!resolved.ok) {
          diagnostics.push(`INVALID_WINDOW:${resolved.code}`);
          continue;
        }
        ranges.push(resolved.range);
      }
      const merged = mergeRanges(ranges);
      const minutes = totalMinutes(merged);
      const capped =
        typeof exception.minutesOverride === 'number'
          ? Math.min(minutes, Math.max(0, exception.minutesOverride))
          : minutes;
      return { availableMinutes: capped, windows: merged, source, diagnostics };
    }
    if (typeof exception.minutesOverride === 'number') {
      const minutes = Math.max(0, exception.minutesOverride);
      const start = Date.parse(`${input.date}T00:00:00.000Z`);
      return {
        availableMinutes: minutes,
        windows: [{ start, end: start + minutes * 60_000 }],
        source,
        diagnostics,
      };
    }
    return { availableMinutes: 0, windows: [], source: 'CLOSED', diagnostics };
  }

  const weekday = weekdayOf(input.date);
  const ranges: InstantRange[] = [];
  for (const window of input.weekly.days[weekday] ?? []) {
    const resolved = resolveWindow(window, input.date, zone);
    if (!resolved.ok) {
      diagnostics.push(`INVALID_WINDOW:${resolved.code}`);
      continue;
    }
    ranges.push(resolved.range);
  }
  const merged = mergeRanges(ranges);
  return { availableMinutes: totalMinutes(merged), windows: merged, source, diagnostics };
}

/** Official capacity is reserved only by blocks of ACTIVE scenarios. */
export function selectOfficialReservations(
  scenarios: PlanningScenario[],
  blocks: PlanBlock[],
  profileId?: string,
): PlanBlock[] {
  const active = new Set(
    scenarios
      .filter((scenario) => scenario.status === 'ACTIVE')
      .filter((scenario) => profileId === undefined || scenario.profileId === profileId)
      .map((scenario) => `${scenario.profileId}::${scenario.id}`),
  );
  return blocks.filter(
    (block) =>
      (profileId === undefined || block.profileId === profileId) &&
      active.has(`${block.profileId}::${block.scenarioId}`),
  );
}

function blockRange(block: PlanBlock, fallbackZone: string): InstantRange | null {
  if (!block.localStart || !block.localEnd || !block.civilDate) return null;
  const resolved = resolveWindow(
    { start: block.localStart, end: block.localEnd },
    block.civilDate,
    block.timeZone ?? fallbackZone,
  );
  return resolved.ok ? resolved.range : null;
}

/** Real day boundaries of one civil date in a zone. */
export function dayBounds(date: CivilDate, zone: string): InstantRange | null {
  const start = resolveDayStart(date, zone);
  const next = resolveDayStart(addCivilDays(date, 1), zone);
  if (!start.ok || !next.ok) return null;
  return { start: start.range.start, end: next.range.start };
}

/** Some zones skip 00:00 on a transition day; 01:00 is the safe fallback. */
function resolveDayStart(date: CivilDate, zone: string): WindowResolution {
  const midnight = resolveWindow({ start: '00:00', end: '00:01' }, date, zone);
  if (midnight.ok) return midnight;
  return resolveWindow({ start: '01:00', end: '01:01' }, date, zone);
}

function clipRange(range: InstantRange, bounds: InstantRange): InstantRange | null {
  const start = Math.max(range.start, bounds.start);
  const end = Math.min(range.end, bounds.end);
  return end > start ? { start, end } : null;
}

function rangesOverlap(left: InstantRange, right: InstantRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function coveredBy(windows: InstantRange[], range: InstantRange): number {
  let covered = 0;
  for (const window of windows) {
    const start = Math.max(window.start, range.start);
    const end = Math.min(window.end, range.end);
    if (end > start) covered += end - start;
  }
  return Math.round(covered / 60_000);
}

/**
 * Evaluates one civil date. Overlapping commitments are merged, so the same
 * minute is never deducted twice, and blocks that cannot be placed are
 * reported instead of disappearing.
 */
export function evaluateDailyCapacity(input: CapacityInput): DailyCapacity {
  const resolution = resolveDailyAvailability(input);
  const diagnostics = [...resolution.diagnostics];
  const availableMinutes = resolution.availableMinutes;
  const zone = input.weekly.timeZone || input.zone;
  const bounds = dayBounds(input.date, zone);
  const commitments = (input.fixedCommitments ?? []).filter(
    (commitment) => commitment.civilDate === input.date,
  );

  const commitmentRanges: InstantRange[] = [];
  const conflictBlockIds: string[] = [];
  const unallocatedBlockIds: string[] = [];
  const flexible: PlanBlock[] = [];
  const timed: { block: PlanBlock; range: InstantRange }[] = [];

  for (const commitment of commitments) {
    const resolved = resolveWindow(
      { start: commitment.start, end: commitment.end },
      commitment.civilDate,
      commitment.timeZone,
    );
    if (resolved.ok) {
      const clipped = bounds ? clipRange(resolved.range, bounds) : resolved.range;
      if (clipped) commitmentRanges.push(clipped);
    }
  }

  for (const block of input.reservations) {
    if (block.allocation === 'UNALLOCATED') {
      if (block.civilDate === input.date) unallocatedBlockIds.push(block.id);
      continue;
    }
    const range = blockRange(block, zone);
    if (!range) {
      if (block.civilDate === input.date) flexible.push(block);
      continue;
    }
    // A block that crosses midnight also occupies the following civil date.
    const clipped = bounds ? clipRange(range, bounds) : range;
    if (!clipped) continue;
    timed.push({ block, range: clipped });
  }

  const occupied: InstantRange[] = [
    ...commitmentRanges,
    ...timed.map((item) => item.range),
  ];

  for (const item of timed) {
    const span = totalMinutes([item.range]);
    if (span - coveredBy(resolution.windows, item.range) > 0) {
      conflictBlockIds.push(item.block.id);
      diagnostics.push('OUTSIDE_AVAILABILITY');
    }
    // Overlapping reservations are an explicit conflict, never a silent merge
    // that would free capacity for a second plan.
    const overlapsOther = occupied.some(
      (other) => other !== item.range && rangesOverlap(item.range, other),
    );
    if (overlapsOther) {
      conflictBlockIds.push(item.block.id);
      diagnostics.push('OVERLAP');
    }
  }

  const merged = mergeRanges(occupied);
  let reservedMinutes = totalMinutes(merged);
  let remaining = availableMinutes - reservedMinutes;

  const ordered = [...flexible].sort(
    (left, right) => left.priority - right.priority || (left.id < right.id ? -1 : 1),
  );
  for (const block of ordered) {
    if (block.plannedMinutes <= remaining) {
      remaining -= block.plannedMinutes;
      reservedMinutes += block.plannedMinutes;
    } else {
      // The window cannot hold the whole block: it stays visible, never split
      // silently into an unconfirmed partial commitment.
      conflictBlockIds.push(block.id);
      if (remaining <= 0) unallocatedBlockIds.push(block.id);
    }
  }

  if (reservedMinutes > availableMinutes) diagnostics.push('OVERBOOKED');

  // An overlapping plan is not a valid basis for more generation: until the
  // conflict is resolved the day offers no remaining capacity.
  const hasOverlap = diagnostics.includes('OVERLAP');

  return {
    availableMinutes,
    reservedMinutes,
    remainingMinutes: hasOverlap ? 0 : Math.max(0, availableMinutes - reservedMinutes),
    conflictBlockIds: [...new Set(conflictBlockIds)],
    unallocatedBlockIds: [...new Set(unallocatedBlockIds)],
    diagnostics,
  };
}

/** Minutes of one block attributable to a civil date, used by the calendar. */
export function blockDayMinutes(block: PlanBlock, date: CivilDate, zone?: string): number {
  const effectiveZone = zone ?? block.timeZone ?? 'UTC';
  const range = blockRange(block, effectiveZone);
  if (!range) return block.civilDate === date ? block.plannedMinutes : 0;
  const bounds = dayBounds(date, effectiveZone);
  if (!bounds) return 0;
  const clipped = clipRange(range, bounds);
  return clipped ? Math.round((clipped.end - clipped.start) / 60_000) : 0;
}
