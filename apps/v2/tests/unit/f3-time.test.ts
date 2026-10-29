import { describe, expect, it } from 'vitest';
import {
  addCivilDays,
  compareCivilDate,
  enumerateCivilDates,
  localIntervalMinutes,
  resolveZonedInterval,
  validateCivilDate,
  weekdayIndex,
} from '../../src/domain/planning-time';

describe('F3 civil dates and zoned intervals', () => {
  it('civil_date_never_moves_with_device_zone', () => {
    expect(validateCivilDate('2027-01-24')).toBe('2027-01-24');
    expect(addCivilDays('2027-01-24', 1)).toBe('2027-01-25');
    expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addCivilDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addCivilDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(compareCivilDate('2027-01-24', '2027-01-25')).toBe(-1);
    expect(enumerateCivilDates('2027-01-24', '2027-01-26')).toEqual([
      '2027-01-24',
      '2027-01-25',
      '2027-01-26',
    ]);
    // Sunday 2027-01-24, used by the fixtures as the exam date.
    expect(weekdayIndex('2027-01-24')).toBe(0);

    // The same civil date resolved in two zones yields different instants but
    // never changes the date itself.
    const fortaleza = resolveZonedInterval({
      date: '2027-01-24',
      start: '08:00',
      end: '10:00',
      zone: 'America/Fortaleza',
    });
    const tokyo = resolveZonedInterval({
      date: '2027-01-24',
      start: '08:00',
      end: '10:00',
      zone: 'Asia/Tokyo',
    });
    expect(fortaleza.ok).toBe(true);
    expect(tokyo.ok).toBe(true);
    if (fortaleza.ok && tokyo.ok) {
      expect(fortaleza.startInstant).not.toBe(tokyo.startInstant);
      expect(fortaleza.startInstant.startsWith('2027-01-24')).toBe(true);
    }
  });

  it('rejects_impossible_civil_dates_and_bad_zones', () => {
    expect(() => validateCivilDate('2027-02-29')).toThrow(/invalid civil date/);
    expect(() => validateCivilDate('2026-13-01')).toThrow();
    expect(() => validateCivilDate('2026-04-31')).toThrow();
    expect(() => validateCivilDate('24-01-2027')).toThrow();
    expect(
      resolveZonedInterval({ date: '2026-10-29', start: '08:00', end: '09:00', zone: 'Mars/Base' }),
    ).toEqual({ ok: false, code: 'INVALID_ZONE' });
    expect(
      resolveZonedInterval({ date: '2026-10-29', start: '09:00', end: '09:00', zone: 'UTC' }),
    ).toEqual({ ok: false, code: 'INVALID_INTERVAL' });
  });

  it('dst_gap_rejected_overlap_requires_offset', () => {
    expect(
      resolveZonedInterval({
        date: '2026-03-08',
        start: '02:30',
        end: '03:30',
        zone: 'America/New_York',
      }),
    ).toEqual({ ok: false, code: 'NONEXISTENT_TIME' });

    expect(
      resolveZonedInterval({
        date: '2026-11-01',
        start: '01:30',
        end: '02:30',
        zone: 'America/New_York',
      }),
    ).toEqual({ ok: false, code: 'AMBIGUOUS_TIME' });

    const firstOccurrence = resolveZonedInterval({
      date: '2026-11-01',
      start: '01:30',
      end: '02:30',
      zone: 'America/New_York',
      offsetChoice: '-04:00',
    });
    const secondOccurrence = resolveZonedInterval({
      date: '2026-11-01',
      start: '01:30',
      end: '02:30',
      zone: 'America/New_York',
      offsetChoice: '-05:00',
    });
    expect(firstOccurrence.ok).toBe(true);
    expect(secondOccurrence.ok).toBe(true);
    if (firstOccurrence.ok && secondOccurrence.ok) {
      expect(firstOccurrence.startInstant).toBe('2026-11-01T05:30:00.000Z');
      expect(secondOccurrence.startInstant).toBe('2026-11-01T06:30:00.000Z');
    }
  });

  it('intervals_crossing_midnight_span_two_civil_days', () => {
    expect(localIntervalMinutes('22:00', '01:30')).toBe(210);
    expect(localIntervalMinutes('08:00', '09:00')).toBe(60);
    const crossing = resolveZonedInterval({
      date: '2026-10-29',
      start: '22:00',
      end: '01:30',
      zone: 'America/Fortaleza',
    });
    expect(crossing.ok).toBe(true);
    if (crossing.ok) {
      expect(crossing.startInstant).toBe('2026-10-30T01:00:00.000Z');
      expect(crossing.endInstant).toBe('2026-10-30T04:30:00.000Z');
    }
  });
});
