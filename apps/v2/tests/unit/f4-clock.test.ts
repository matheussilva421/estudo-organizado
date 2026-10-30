import { describe, expect, it } from 'vitest';
import {
  inspectContinuity,
  sumVerifiedFocusMs,
  type ContinuityPolicy,
} from '../../src/domain/session-clock';
import type { ClockObservation, SessionInterval } from '../../src/domain/session';

const policy: ContinuityPolicy = {
  maxUnobservedGapMs: 60_000,
  maxWallClockDriftMs: 5_000,
};

function observation(
  contextId: string,
  monotonicMs: number,
  wallInstant: string,
): ClockObservation {
  return { contextId, monotonicMs, wallInstant };
}

function interval(overrides: Partial<SessionInterval> = {}): SessionInterval {
  return {
    id: 'interval-1',
    kind: 'FOCUS',
    verifiedMs: 0,
    contextId: 'ctx-1',
    checkpoint: null,
    recoveryFlag: false,
    ...overrides,
  };
}

describe('F4 session clock', () => {
  it('wall_clock_jump_does_not_create_study_time', () => {
    const result = inspectContinuity(
      observation('ctx-1', 1_000, '2026-10-30T10:00:00.000Z'),
      observation('ctx-1', 31_000, '2026-10-30T11:00:00.000Z'),
      policy,
    );
    expect(result).toEqual({ kind: 'UNCERTAIN', reason: 'WALL_CLOCK_DRIFT' });
    if (result.kind === 'VALID') {
      expect(result.elapsedMs).not.toBe(3_600_000);
    }
  });

  it('different_context_id_is_uncertain', () => {
    expect(
      inspectContinuity(
        observation('ctx-1', 0, '2026-10-30T10:00:00.000Z'),
        observation('ctx-2', 1_000, '2026-10-30T10:00:01.000Z'),
        policy,
      ),
    ).toEqual({ kind: 'UNCERTAIN', reason: 'CONTEXT_CHANGED' });
  });

  it('pauses_exclude_unobserved_time', () => {
    const intervals = [
      interval({ id: 'focus-1', verifiedMs: 10 * 60_000 }),
      interval({ id: 'break-1', kind: 'BREAK', verifiedMs: 5 * 60_000 }),
      interval({ id: 'focus-2', verifiedMs: 20 * 60_000 }),
      interval({ id: 'focus-3', verifiedMs: 7 * 60_000, recoveryFlag: true }),
    ];
    expect(sumVerifiedFocusMs(intervals)).toBe(30 * 60_000);
  });

  it('crash_preserves_only_last_durable_checkpoint', () => {
    const durable = 42 * 60_000;
    const result = inspectContinuity(
      observation('ctx-1', 0, '2026-10-30T10:00:00.000Z'),
      observation('ctx-1', durable + 3 * 60_000, '2026-10-30T10:45:00.000Z'),
      policy,
    );
    expect(result).toEqual({ kind: 'UNCERTAIN', reason: 'UNOBSERVED_GAP' });
    expect(sumVerifiedFocusMs([interval({ verifiedMs: durable })])).toBe(durable);
  });

  it('boundary_gap_is_valid', () => {
    expect(
      inspectContinuity(
        observation('ctx-1', 1_000, '2026-10-30T10:00:00.000Z'),
        observation('ctx-1', 61_000, '2026-10-30T10:01:00.000Z'),
        policy,
      ),
    ).toEqual({ kind: 'VALID', elapsedMs: 60_000 });
  });

  it('negative_monotonic_delta_is_uncertain', () => {
    expect(
      inspectContinuity(
        observation('ctx-1', 2_000, '2026-10-30T10:00:02.000Z'),
        observation('ctx-1', 1_000, '2026-10-30T10:00:03.000Z'),
        policy,
      ),
    ).toEqual({ kind: 'UNCERTAIN', reason: 'MONOTONIC_REGRESSION' });
  });

  it('invalid_policy_rejected', () => {
    expect(() =>
      inspectContinuity(
        observation('ctx-1', 0, '2026-10-30T10:00:00.000Z'),
        observation('ctx-1', 1_000, '2026-10-30T10:00:01.000Z'),
        { maxUnobservedGapMs: Number.NaN, maxWallClockDriftMs: 5_000 },
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_POLICY' }));
  });

  it('sum_verified_focus_rejects_invalid_duration', () => {
    expect(() => sumVerifiedFocusMs([interval({ verifiedMs: Number.NaN })])).toThrowError(
      expect.objectContaining({ code: 'INVALID_DURATION' }),
    );
  });
});
