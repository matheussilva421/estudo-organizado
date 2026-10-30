import {
  SessionValidationError,
  type ClockObservation,
  type SessionInterval,
} from './session';

export type ClockPort = {
  observe(): ClockObservation;
};

export type ContinuityPolicy = {
  maxUnobservedGapMs: number;
  maxWallClockDriftMs: number;
};

export type ContinuityResult =
  | { kind: 'VALID'; elapsedMs: number }
  | { kind: 'UNCERTAIN'; reason: string };

export type SessionReviewPolicy = {
  maxUnobservedGapMs: number;
  anomalousDurationMs: number;
};

export type DurationReview =
  | { kind: 'VALID' }
  | { kind: 'REVIEW_REQUIRED' }
  | { kind: 'INVALID'; code: string };

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

function validateObservation(observation: ClockObservation): void {
  if (!observation || typeof observation !== 'object') {
    fail('INVALID_OBSERVATION', 'clock observation is required');
  }
  if (typeof observation.contextId !== 'string' || !observation.contextId.trim()) {
    fail('INVALID_OBSERVATION', 'contextId is required');
  }
  if (
    typeof observation.monotonicMs !== 'number' ||
    !Number.isFinite(observation.monotonicMs) ||
    observation.monotonicMs < 0
  ) {
    fail('INVALID_OBSERVATION', 'monotonicMs must be finite and non-negative');
  }
  if (
    typeof observation.wallInstant !== 'string' ||
    Number.isNaN(Date.parse(observation.wallInstant))
  ) {
    fail('INVALID_OBSERVATION', 'wallInstant must be an ISO date-time');
  }
}

function validatePolicy(policy: ContinuityPolicy): void {
  if (
    !policy ||
    typeof policy.maxUnobservedGapMs !== 'number' ||
    !Number.isFinite(policy.maxUnobservedGapMs) ||
    policy.maxUnobservedGapMs < 0 ||
    typeof policy.maxWallClockDriftMs !== 'number' ||
    !Number.isFinite(policy.maxWallClockDriftMs) ||
    policy.maxWallClockDriftMs < 0
  ) {
    fail('INVALID_POLICY', 'continuity policy requires finite non-negative limits');
  }
}

/**
 * A monotonic clock is the only source of elapsed study time. Wall-clock
 * anchors are used solely to detect drift and to place a verified interval on
 * the civil calendar; they never become elapsed time by themselves.
 */
export function inspectContinuity(
  previous: ClockObservation,
  current: ClockObservation,
  policy: ContinuityPolicy,
): ContinuityResult {
  validateObservation(previous);
  validateObservation(current);
  validatePolicy(policy);

  if (previous.contextId !== current.contextId) {
    return { kind: 'UNCERTAIN', reason: 'CONTEXT_CHANGED' };
  }

  const monotonicDelta = current.monotonicMs - previous.monotonicMs;
  if (monotonicDelta < 0) {
    return { kind: 'UNCERTAIN', reason: 'MONOTONIC_REGRESSION' };
  }
  if (monotonicDelta > policy.maxUnobservedGapMs) {
    return { kind: 'UNCERTAIN', reason: 'UNOBSERVED_GAP' };
  }

  const wallDelta =
    Date.parse(current.wallInstant) - Date.parse(previous.wallInstant);
  if (Math.abs(wallDelta - monotonicDelta) > policy.maxWallClockDriftMs) {
    return { kind: 'UNCERTAIN', reason: 'WALL_CLOCK_DRIFT' };
  }

  return { kind: 'VALID', elapsedMs: monotonicDelta };
}

export function sumVerifiedFocusMs(intervals: readonly SessionInterval[]): number {
  if (!Array.isArray(intervals)) fail('INVALID_INTERVAL', 'intervals must be an array');
  let total = 0;
  for (const interval of intervals) {
    if (!interval || (interval.kind !== 'FOCUS' && interval.kind !== 'BREAK')) {
      fail('INVALID_INTERVAL', 'interval kind must be FOCUS or BREAK');
    }
    if (
      typeof interval.verifiedMs !== 'number' ||
      !Number.isFinite(interval.verifiedMs) ||
      interval.verifiedMs < 0
    ) {
      fail('INVALID_DURATION', 'verifiedMs must be finite and non-negative');
    }
    if (typeof interval.recoveryFlag !== 'boolean') {
      fail('INVALID_INTERVAL', 'recoveryFlag is required');
    }
    if (interval.kind === 'FOCUS' && !interval.recoveryFlag) {
      total += interval.verifiedMs;
    }
  }
  return total;
}

export function createSystemClock(contextId: string): ClockPort {
  if (typeof contextId !== 'string' || !contextId.trim()) {
    fail('INVALID_CONTEXT', 'contextId is required');
  }
  return {
    observe: () => ({
      contextId,
      monotonicMs:
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now(),
      wallInstant: new Date().toISOString(),
    }),
  };
}

/**
 * Long but possible durations are never truncated. They are surfaced for a
 * human decision; structurally invalid values are rejected before commit.
 */
export function reviewDuration(input: {
  durationMs: number;
  policy: SessionReviewPolicy;
  source: 'MEASURED' | 'MANUAL';
}): DurationReview {
  if (!input || typeof input !== 'object') {
    return { kind: 'INVALID', code: 'INVALID_INPUT' };
  }
  if (
    typeof input.durationMs !== 'number' ||
    !Number.isFinite(input.durationMs) ||
    input.durationMs < 0
  ) {
    return { kind: 'INVALID', code: 'INVALID_DURATION' };
  }
  const policy = input.policy;
  if (
    !policy ||
    typeof policy.maxUnobservedGapMs !== 'number' ||
    !Number.isFinite(policy.maxUnobservedGapMs) ||
    policy.maxUnobservedGapMs < 0 ||
    typeof policy.anomalousDurationMs !== 'number' ||
    !Number.isFinite(policy.anomalousDurationMs) ||
    policy.anomalousDurationMs < 0
  ) {
    return { kind: 'INVALID', code: 'INVALID_POLICY' };
  }
  if (input.source !== 'MEASURED' && input.source !== 'MANUAL') {
    return { kind: 'INVALID', code: 'INVALID_SOURCE' };
  }
  return input.durationMs > policy.anomalousDurationMs
    ? { kind: 'REVIEW_REQUIRED' }
    : { kind: 'VALID' };
}
