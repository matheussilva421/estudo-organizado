import { describe, expect, it } from 'vitest';
import {
  nextPomodoroStep,
  type PomodoroConfig,
} from '../../src/domain/session-pomodoro';
import { sumVerifiedFocusMs } from '../../src/domain/session-clock';
import type { SessionInterval } from '../../src/domain/session';

const config: PomodoroConfig = {
  focusMs: 25 * 60_000,
  breakMs: 5 * 60_000,
};

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

describe('F4 Pomodoro', () => {
  it('focus_25_break_5_counts_only_25_as_study', () => {
    expect(
      sumVerifiedFocusMs([
        interval({ kind: 'FOCUS', verifiedMs: 25 * 60_000 }),
        interval({ kind: 'BREAK', verifiedMs: 5 * 60_000 }),
      ]),
    ).toBe(25 * 60_000);
  });

  it('valid_focus_completion_begins_break', () => {
    expect(
      nextPomodoroStep({
        stage: 'FOCUS',
        elapsedVerifiedMs: 25 * 60_000,
        config,
        continuity: 'VALID',
        authorityValid: true,
      }),
    ).toEqual({ kind: 'BEGIN_BREAK' });
  });

  it('break_end_requires_explicit_start', () => {
    expect(
      nextPomodoroStep({
        stage: 'BREAK',
        elapsedVerifiedMs: 5 * 60_000,
        config,
        continuity: 'VALID',
        authorityValid: true,
      }),
    ).toEqual({ kind: 'AWAIT_FOCUS_CONFIRMATION' });
  });

  it('suspend_causes_recovery_not_auto_cycles', () => {
    expect(
      nextPomodoroStep({
        stage: 'FOCUS',
        elapsedVerifiedMs: 25 * 60_000,
        config,
        continuity: 'UNCERTAIN',
        authorityValid: true,
      }),
    ).toEqual({ kind: 'RECOVERY_REQUIRED' });
  });

  it('invalid_authority_causes_recovery', () => {
    expect(
      nextPomodoroStep({
        stage: 'FOCUS',
        elapsedVerifiedMs: 25 * 60_000,
        config,
        continuity: 'VALID',
        authorityValid: false,
      }),
    ).toEqual({ kind: 'RECOVERY_REQUIRED' });
  });

  it('notification_failure_does_not_change_session', () => {
    const step = nextPomodoroStep({
      stage: 'FOCUS',
      elapsedVerifiedMs: 25 * 60_000,
      config,
      continuity: 'VALID',
      authorityValid: true,
    });
    expect(() => {
      throw new Error('notification failed');
    }).toThrow('notification failed');
    expect(step).toEqual({ kind: 'BEGIN_BREAK' });
  });

  it('invalid_config_rejected', () => {
    expect(() =>
      nextPomodoroStep({
        stage: 'FOCUS',
        elapsedVerifiedMs: 1,
        config: { focusMs: 0, breakMs: 5 * 60_000 },
        continuity: 'VALID',
        authorityValid: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_POMODORO_CONFIG' }));
  });
});
