import { SessionValidationError } from './session';

export type PomodoroConfig = {
  focusMs: number;
  breakMs: number;
};

export type PomodoroStage = 'FOCUS' | 'BREAK';

export type PomodoroStep =
  | 'BEGIN_BREAK'
  | 'AWAIT_FOCUS_CONFIRMATION'
  | 'RECOVERY_REQUIRED'
  | 'CONTINUE';

export type PomodoroStepInput = {
  stage: PomodoroStage;
  elapsedVerifiedMs: number;
  config: PomodoroConfig;
  continuity: 'VALID' | 'UNCERTAIN';
  authorityValid: boolean;
};

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

function positiveDuration(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail('INVALID_POMODORO_CONFIG', 'Pomodoro durations must be finite and positive');
  }
}

/**
 * Foco e descanso são estágios distintos. A transição foco→descanso só é
 * automática com continuidade e autoridade verificáveis; descanso→foco
 * sempre exige confirmação humana.
 */
export function nextPomodoroStep(input: PomodoroStepInput): { kind: PomodoroStep } {
  if (!input || typeof input !== 'object') {
    fail('INVALID_POMODORO_INPUT', 'Pomodoro input is required');
  }
  positiveDuration(input.config?.focusMs);
  positiveDuration(input.config?.breakMs);
  if (
    typeof input.elapsedVerifiedMs !== 'number' ||
    !Number.isFinite(input.elapsedVerifiedMs) ||
    input.elapsedVerifiedMs < 0
  ) {
    fail('INVALID_DURATION', 'elapsedVerifiedMs must be finite and non-negative');
  }
  if (input.stage !== 'FOCUS' && input.stage !== 'BREAK') {
    fail('INVALID_POMODORO_STAGE', 'stage must be FOCUS or BREAK');
  }
  if (input.continuity !== 'VALID' && input.continuity !== 'UNCERTAIN') {
    fail('INVALID_CONTINUITY', 'continuity must be VALID or UNCERTAIN');
  }
  if (typeof input.authorityValid !== 'boolean') {
    fail('INVALID_AUTHORITY', 'authorityValid must be boolean');
  }

  if (!input.authorityValid || input.continuity === 'UNCERTAIN') {
    return { kind: 'RECOVERY_REQUIRED' };
  }
  if (input.stage === 'FOCUS') {
    return input.elapsedVerifiedMs >= input.config.focusMs
      ? { kind: 'BEGIN_BREAK' }
      : { kind: 'CONTINUE' };
  }
  return input.elapsedVerifiedMs >= input.config.breakMs
    ? { kind: 'AWAIT_FOCUS_CONFIRMATION' }
    : { kind: 'CONTINUE' };
}
