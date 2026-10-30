import { SessionValidationError, type SessionInterval } from './session';
import {
  addCivilDays,
  enumerateCivilDates,
  isValidTimeZone,
  resolveZonedInterval,
} from './planning-time';

export type SessionAllocation = {
  sessionId: string;
  allocationId: string;
  editalDisciplineId?: string;
  assuntoId?: string;
  aulaId?: string;
  durationMs: number;
};

export type AllocationSummary = {
  allocatedMs: number;
  unallocatedMs: number;
};

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

/**
 * Allocations are slices of the same session, never extra time. The remainder
 * is explicitly unallocated and the sum may never exceed the valid focus.
 */
export function allocateFocus(
  totalValidMs: number,
  allocations: readonly SessionAllocation[],
): AllocationSummary {
  if (
    typeof totalValidMs !== 'number' ||
    !Number.isFinite(totalValidMs) ||
    totalValidMs < 0
  ) {
    fail('INVALID_DURATION', 'totalValidMs must be finite and non-negative');
  }
  if (!Array.isArray(allocations)) {
    fail('INVALID_ALLOCATION', 'allocations must be an array');
  }
  const seen = new Set<string>();
  let allocatedMs = 0;
  for (const allocation of allocations) {
    if (
      !allocation ||
      typeof allocation.sessionId !== 'string' ||
      !allocation.sessionId.trim() ||
      typeof allocation.allocationId !== 'string' ||
      !allocation.allocationId.trim()
    ) {
      fail('INVALID_ALLOCATION', 'allocation identifiers are required');
    }
    if (seen.has(allocation.allocationId)) {
      fail('INVALID_ALLOCATION', 'allocationId must be unique');
    }
    seen.add(allocation.allocationId);
    if (
      typeof allocation.durationMs !== 'number' ||
      !Number.isFinite(allocation.durationMs) ||
      allocation.durationMs < 0
    ) {
      fail('INVALID_ALLOCATION', 'allocation duration must be finite and non-negative');
    }
    allocatedMs += allocation.durationMs;
  }
  if (allocatedMs > totalValidMs) {
    fail('INVALID_ALLOCATION', 'allocations exceed the valid focus');
  }
  return { allocatedMs, unallocatedMs: totalValidMs - allocatedMs };
}

function civilDateAt(instantMs: number, zone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(instantMs));
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

function civilDayStart(date: string, zone: string): number | null {
  const resolved = resolveZonedInterval({
    date,
    start: '00:00',
    end: '00:01',
    zone,
  });
  if (!resolved.ok) return null;
  return Date.parse(resolved.startInstant);
}

/**
 * Splits verified focus by civil day in the recorded IANA zone. Only intervals
 * with trustworthy start/end anchors are assignable; the rest stays explicit.
 */
export function splitVerifiedTimeByCivilDate(
  intervals: readonly SessionInterval[],
  zone: string,
): { byCivilDate: Record<string, number>; unassignableMs: number } {
  if (!isValidTimeZone(zone)) {
    fail('INVALID_TIME_ZONE', 'a valid IANA zone is required');
  }
  if (!Array.isArray(intervals)) {
    fail('INVALID_INTERVAL', 'intervals must be an array');
  }
  const byCivilDate: Record<string, number> = {};
  let unassignableMs = 0;

  for (const interval of intervals) {
    if (!interval || interval.kind !== 'FOCUS') continue;
    if (
      typeof interval.verifiedMs !== 'number' ||
      !Number.isFinite(interval.verifiedMs) ||
      interval.verifiedMs < 0
    ) {
      fail('INVALID_DURATION', 'verifiedMs must be finite and non-negative');
    }
    if (interval.verifiedMs === 0) continue;
    const verifiedMs = interval.verifiedMs;
    if (!interval.startedAt || !interval.endedAt) {
      unassignableMs += verifiedMs;
      continue;
    }
    const startMs = Date.parse(interval.startedAt);
    const endMs = Date.parse(interval.endedAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      unassignableMs += verifiedMs;
      continue;
    }
    const startDate = civilDateAt(startMs, zone);
    const endDate = civilDateAt(endMs - 1, zone);
    if (!startDate || !endDate) {
      unassignableMs += verifiedMs;
      continue;
    }

    let allocated = 0;
    for (const date of enumerateCivilDates(startDate, endDate)) {
      const dayStart = civilDayStart(date, zone);
      const nextDayStart = civilDayStart(addCivilDays(date, 1), zone);
      if (dayStart === null || nextDayStart === null || nextDayStart <= dayStart) {
        continue;
      }
      const overlap = Math.max(
        0,
        Math.min(endMs, nextDayStart) - Math.max(startMs, dayStart),
      );
      if (overlap <= 0) continue;
      const portion = (verifiedMs * overlap) / (endMs - startMs);
      byCivilDate[date] = (byCivilDate[date] ?? 0) + portion;
      allocated += portion;
    }
    if (allocated <= 0) {
      unassignableMs += verifiedMs;
    } else if (allocated < verifiedMs) {
      unassignableMs += verifiedMs - allocated;
    }
  }

  for (const key of Object.keys(byCivilDate)) {
    byCivilDate[key] = Math.round(byCivilDate[key] ?? 0);
  }
  return { byCivilDate, unassignableMs: Math.round(unassignableMs) };
}
