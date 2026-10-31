import { describe, expect, it } from 'vitest';
import {
  allocateFocus,
  splitVerifiedTimeByCivilDate,
} from '../../src/domain/session-accounting';
import { summarizeExecutionLinks } from '../../src/domain/planning-execution-contract';
import type { SessionInterval } from '../../src/domain/session';

const minute = 60_000;

function focus(
  startedAt: string | undefined,
  endedAt: string | undefined,
  verifiedMs: number,
): SessionInterval {
  return {
    id: 'interval-1',
    kind: 'FOCUS',
    verifiedMs,
    contextId: 'ctx-1',
    checkpoint: null,
    recoveryFlag: false,
    startedAt,
    endedAt,
  };
}

describe('F4 session accounting', () => {
  it('90min_50plus40_allocated_exactly', () => {
    expect(
      allocateFocus(90 * minute, [
        { sessionId: 's1', allocationId: 'a1', durationMs: 50 * minute },
        { sessionId: 's1', allocationId: 'a2', durationMs: 40 * minute },
      ]),
    ).toEqual({ allocatedMs: 90 * minute, unallocatedMs: 0 });
  });

  it('unallocated_remainder_preserved', () => {
    expect(
      allocateFocus(90 * minute, [
        { sessionId: 's1', allocationId: 'a1', durationMs: 50 * minute },
      ]),
    ).toEqual({ allocatedMs: 50 * minute, unallocatedMs: 40 * minute });
  });

  it('sum_over_total_rejected', () => {
    expect(() =>
      allocateFocus(90 * minute, [
        { sessionId: 's1', allocationId: 'a1', durationMs: 50 * minute },
        { sessionId: 's1', allocationId: 'a2', durationMs: 50 * minute },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ALLOCATION' }));
  });

  it('midnight_23_40_to_00_20_yields_20_and_20_when_anchors_valid', () => {
    const result = splitVerifiedTimeByCivilDate(
      [
        focus(
          '2026-10-30T23:40:00-03:00',
          '2026-10-31T00:20:00-03:00',
          40 * minute,
        ),
      ],
      'America/Fortaleza',
    );
    expect(result.unassignableMs).toBe(0);
    expect(result.byCivilDate['2026-10-30']).toBe(20 * minute);
    expect(result.byCivilDate['2026-10-31']).toBe(20 * minute);
  });

  it('missing_temporal_anchors_remain_unassignable', () => {
    const result = splitVerifiedTimeByCivilDate(
      [focus(undefined, undefined, 30 * minute)],
      'America/Fortaleza',
    );
    expect(result.byCivilDate).toEqual({});
    expect(result.unassignableMs).toBe(30 * minute);
  });

  it('recovery_flagged_focus_is_unassignable', () => {
    const interval = {
      ...focus(
        '2026-10-30T23:40:00-03:00',
        '2026-10-31T00:20:00-03:00',
        40 * minute,
      ),
      recoveryFlag: true,
    };
    const result = splitVerifiedTimeByCivilDate([interval], 'America/Fortaleza');
    expect(result.byCivilDate).toEqual({});
    expect(result.unassignableMs).toBe(0);
  });

  it('one_session_serving_two_editais_counts_sixty_minutes', () => {
    expect(
      summarizeExecutionLinks([
        {
          sessionId: 's1',
          editalId: 'e1',
          editalDisciplineId: 'd1',
          durationMinutes: 60,
        },
        {
          sessionId: 's1',
          editalId: 'e2',
          editalDisciplineId: 'd2',
          durationMinutes: 60,
        },
      ]).uniqueMinutes,
    ).toBe(60);
  });
});
