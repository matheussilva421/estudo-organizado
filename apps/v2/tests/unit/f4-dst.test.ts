import { describe, expect, it } from 'vitest';
import { resolveZonedInterval } from '../../src/domain/planning-time';
import { splitVerifiedTimeByCivilDate } from '../../src/domain/session-accounting';
import type { SessionInterval } from '../../src/domain/session';

function focus(
  startedAt: string,
  endedAt: string,
  verifiedMs: number,
): SessionInterval {
  return {
    id: 'interval-dst',
    kind: 'FOCUS',
    verifiedMs,
    contextId: 'ctx-1',
    checkpoint: null,
    recoveryFlag: false,
    startedAt,
    endedAt,
  };
}

describe('F4 DST and civil accounting', () => {
  it('nonexistent_local_time_rejected', () => {
    expect(
      resolveZonedInterval({
        date: '2026-03-08',
        start: '02:30',
        end: '03:30',
        zone: 'America/New_York',
      }),
    ).toEqual({ ok: false, code: 'NONEXISTENT_TIME' });
  });

  it('ambiguous_local_time_requires_explicit_offset', () => {
    expect(
      resolveZonedInterval({
        date: '2026-11-01',
        start: '01:30',
        end: '02:30',
        zone: 'America/New_York',
      }),
    ).toEqual({ ok: false, code: 'AMBIGUOUS_TIME' });

    const first = resolveZonedInterval({
      date: '2026-11-01',
      start: '01:30',
      end: '02:30',
      zone: 'America/New_York',
      offsetChoice: '-04:00',
    });
    const second = resolveZonedInterval({
      date: '2026-11-01',
      start: '01:30',
      end: '02:30',
      zone: 'America/New_York',
      offsetChoice: '-05:00',
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.startInstant).toBe('2026-11-01T05:30:00.000Z');
      expect(second.startInstant).toBe('2026-11-01T06:30:00.000Z');
    }
    expect(
      resolveZonedInterval({
        date: '2026-11-01',
        start: '01:30',
        end: '02:30',
        zone: 'America/New_York',
        offsetChoice: 'nonsense',
      }),
    ).toEqual({ ok: false, code: 'AMBIGUOUS_TIME' });
  });

  it('dst_spring_forward_day_is_23_hours_not_24', () => {
    const resolved = resolveZonedInterval({
      date: '2026-03-08',
      start: '00:00',
      end: '23:59',
      zone: 'America/New_York',
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const duration = Date.parse(resolved.endInstant) - Date.parse(resolved.startInstant);
    expect(duration).toBe(23 * 3_600_000 - 60_000);
    const result = splitVerifiedTimeByCivilDate(
      [focus(resolved.startInstant, resolved.endInstant, duration)],
      'America/New_York',
    );
    expect(result.unassignableMs).toBe(0);
    expect(result.byCivilDate['2026-03-08']).toBe(duration);
  });

  it('dst_fall_back_day_is_25_hours_not_24', () => {
    const resolved = resolveZonedInterval({
      date: '2026-11-01',
      start: '00:00',
      end: '23:59',
      zone: 'America/New_York',
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const duration = Date.parse(resolved.endInstant) - Date.parse(resolved.startInstant);
    expect(duration).toBe(25 * 3_600_000 - 60_000);
    const result = splitVerifiedTimeByCivilDate(
      [focus(resolved.startInstant, resolved.endInstant, duration)],
      'America/New_York',
    );
    expect(result.unassignableMs).toBe(0);
    expect(result.byCivilDate['2026-11-01']).toBe(duration);
  });

  it('gap_interval_uses_actual_elapsed_not_wall_span', () => {
    const start = '2026-03-08T06:30:00.000Z';
    const end = '2026-03-08T07:30:00.000Z';
    const result = splitVerifiedTimeByCivilDate(
      [focus(start, end, 3_600_000)],
      'America/New_York',
    );
    expect(result.unassignableMs).toBe(0);
    expect(result.byCivilDate['2026-03-08']).toBe(3_600_000);
  });

  it('invalid_zone_rejected_without_fictitious_time', () => {
    expect(() => splitVerifiedTimeByCivilDate([], 'Mars/Base')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TIME_ZONE' }),
    );
  });
});
