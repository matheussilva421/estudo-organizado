import type { CivilDate } from './planning';

/**
 * Civil dates and zoned local intervals.
 *
 * The device time zone is never consulted: `CivilDate` stays a calendar
 * string and every wall clock is resolved against an explicit IANA zone.
 */

export type TimeResolutionError =
  | 'NONEXISTENT_TIME'
  | 'AMBIGUOUS_TIME'
  | 'INVALID_INTERVAL'
  | 'INVALID_ZONE';

export type ZonedIntervalInput = {
  date: CivilDate;
  start: string;
  end: string;
  zone: string;
  offsetChoice?: string;
};

export type ZonedIntervalResult =
  | { ok: true; startInstant: string; endInstant: string }
  | { ok: false; code: TimeResolutionError };

export class CivilDateError extends Error {
  readonly code = 'INVALID_CIVIL_DATE';

  constructor(value: unknown) {
    super(`invalid civil date: ${String(value)}`);
    this.name = 'CivilDateError';
  }
}

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Validates a real Gregorian date. Leap years and month lengths are checked,
 * and nothing about time or zone is inferred.
 */
export function validateCivilDate(value: string): CivilDate {
  if (typeof value !== 'string') throw new CivilDateError(value);
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (!match) throw new CivilDateError(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) throw new CivilDateError(value);
  if (day < 1 || day > daysInMonth(year, month)) throw new CivilDateError(value);
  return value;
}

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string') return false;
  try {
    validateCivilDate(value);
    return true;
  } catch {
    return false;
  }
}

export function parseCivilDate(value: CivilDate): { year: number; month: number; day: number } {
  validateCivilDate(value);
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function formatCivilDate(parts: { year: number; month: number; day: number }): CivilDate {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${month}-${day}`;
}

export function addCivilDays(value: CivilDate, days: number): CivilDate {
  const parts = parseCivilDate(value);
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);
  const shifted = new Date(base + days * DAY_MS);
  return formatCivilDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function compareCivilDate(left: CivilDate, right: CivilDate): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function enumerateCivilDates(start: CivilDate, end: CivilDate): CivilDate[] {
  const dates: CivilDate[] = [];
  if (compareCivilDate(start, end) > 0) return dates;
  let cursor = start;
  while (compareCivilDate(cursor, end) <= 0) {
    dates.push(cursor);
    cursor = addCivilDays(cursor, 1);
  }
  return dates;
}

/** ISO weekday index: 0 = Sunday ... 6 = Saturday. */
export function weekdayIndex(value: CivilDate): number {
  const parts = parseCivilDate(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function parseLocalTime(value: string): { hour: number; minute: number } | null {
  const match = LOCAL_TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(zone, formatter);
  return formatter;
}

export function isValidTimeZone(zone: unknown): boolean {
  if (typeof zone !== 'string' || zone.trim().length === 0) return false;
  try {
    formatterFor(zone);
    return true;
  } catch {
    return false;
  }
}

function offsetMinutesAt(instantMs: number, zone: string): number {
  const parts = formatterFor(zone).formatToParts(new Date(instantMs));
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instantMs) / 60_000);
}

function parseOffsetChoice(choice: string | undefined): number | null | 'ALL' {
  if (choice === undefined || choice === null || choice === '') return 'ALL';
  if (typeof choice !== 'string') return null;
  const trimmed = choice.trim();
  const clock = /^([+-])(\d{2}):(\d{2})$/.exec(trimmed);
  if (clock) {
    const sign = clock[1] === '-' ? -1 : 1;
    return sign * (Number(clock[2]) * 60 + Number(clock[3]));
  }
  const minutes = /^([+-]?\d{1,4})$/.exec(trimmed);
  if (minutes) return Number(minutes[1]);
  return null;
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number };

type WallResolution =
  | { ok: true; instantMs: number; offset: number }
  | { ok: false; code: TimeResolutionError };

function resolveWallTime(wall: Wall, zone: string, offsetChoice: string | undefined): WallResolution {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0);
  const candidates = new Set<number>();
  for (const probe of [asUtc, asUtc - DAY_MS, asUtc + DAY_MS]) {
    const offset = offsetMinutesAt(probe, zone);
    const candidate = asUtc - offset * 60_000;
    const back = offsetMinutesAt(candidate, zone);
    const check = new Date(candidate + back * 60_000);
    const matches =
      check.getUTCFullYear() === wall.year &&
      check.getUTCMonth() + 1 === wall.month &&
      check.getUTCDate() === wall.day &&
      check.getUTCHours() === wall.hour &&
      check.getUTCMinutes() === wall.minute;
    if (matches) candidates.add(candidate);
  }

  const unique = [...candidates];
  if (unique.length === 0) return { ok: false, code: 'NONEXISTENT_TIME' };
  if (unique.length === 1) {
    const instantMs = unique[0] as number;
    return { ok: true, instantMs, offset: Math.round((asUtc - instantMs) / 60_000) };
  }

  const wanted = parseOffsetChoice(offsetChoice);
  if (wanted === 'ALL') return { ok: false, code: 'AMBIGUOUS_TIME' };
  if (wanted === null) return { ok: false, code: 'AMBIGUOUS_TIME' };
  for (const instantMs of unique) {
    const offset = Math.round((asUtc - instantMs) / 60_000);
    if (offset === wanted) return { ok: true, instantMs, offset };
  }
  return { ok: false, code: 'AMBIGUOUS_TIME' };
}

/**
 * Resolves a local wall-clock interval against an IANA zone.
 *
 * - A nonexistent local time (spring-forward gap) is rejected.
 * - An ambiguous local time (fall-back fold) requires an explicit offset.
 * - `end <= start` means the interval crosses midnight into the next civil day.
 */
export function resolveZonedInterval(input: ZonedIntervalInput): ZonedIntervalResult {
  if (!isValidTimeZone(input.zone)) return { ok: false, code: 'INVALID_ZONE' };
  if (!isCivilDate(input.date)) return { ok: false, code: 'INVALID_INTERVAL' };
  const start = parseLocalTime(input.start);
  const end = parseLocalTime(input.end);
  if (!start || !end) return { ok: false, code: 'INVALID_INTERVAL' };

  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  if (startMinutes === endMinutes) return { ok: false, code: 'INVALID_INTERVAL' };
  const crossesMidnight = endMinutes < startMinutes;

  const parts = parseCivilDate(input.date);
  const endDate = crossesMidnight ? addCivilDays(input.date, 1) : input.date;
  const endParts = parseCivilDate(endDate);

  const startResolution = resolveWallTime(
    { ...parts, hour: start.hour, minute: start.minute },
    input.zone,
    input.offsetChoice,
  );
  if (!startResolution.ok) return startResolution;
  const endResolution = resolveWallTime(
    { ...endParts, hour: end.hour, minute: end.minute },
    input.zone,
    input.offsetChoice,
  );
  if (!endResolution.ok) return endResolution;

  if (endResolution.instantMs <= startResolution.instantMs) {
    return { ok: false, code: 'INVALID_INTERVAL' };
  }

  return {
    ok: true,
    startInstant: new Date(startResolution.instantMs).toISOString(),
    endInstant: new Date(endResolution.instantMs).toISOString(),
  };
}

/** Minutes between two local times, allowing the interval to cross midnight. */
export function localIntervalMinutes(start: string, end: string): number | null {
  const from = parseLocalTime(start);
  const to = parseLocalTime(end);
  if (!from || !to) return null;
  const fromMinutes = from.hour * 60 + from.minute;
  const toMinutes = to.hour * 60 + to.minute;
  const raw = toMinutes - fromMinutes;
  return raw > 0 ? raw : raw + 24 * 60;
}
