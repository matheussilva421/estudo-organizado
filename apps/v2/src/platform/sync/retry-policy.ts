export const RETRY_BASE_MS = 1_000;
export const RETRY_MAX_MS = 5 * 60_000;
export const RETRY_JITTER_RATIO = 0.2;
export const RETRY_COOLDOWN_AFTER = 5;

export type RetryPlan = {
  nextRetryAt: number;
  terminal: false;
  cooldown: boolean;
  delayMs: number;
};

export type FailureClass = 'TRANSIENT' | 'DETERMINISTIC' | 'AUTH' | 'QUOTA';

/** Deterministic failures never retry forever; they need a human decision. */
export function classifyFailure(error: unknown): FailureClass {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'AUTH') return 'AUTH';
  if (code === 'QUOTA') return 'QUOTA';
  if (code === 'REMOTE_SCOPE' || code === 'DOCUMENT_BUDGET' || code === 'INVALID') {
    return 'DETERMINISTIC';
  }
  return 'TRANSIENT';
}

/**
 * Exponential backoff: base 1s, cap 5min, jitter 0-20%. After the fifth
 * transient failure the operation keeps a cooldown but stays pending; nothing
 * is ever discarded.
 */
export function planRetry(attempts: number, now: number, jitter = 0): RetryPlan {
  const safeAttempts = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const boundedJitter = Math.min(Math.max(Number.isFinite(jitter) ? jitter : 0, 0), 1);
  const exponential = RETRY_BASE_MS * 2 ** Math.min(safeAttempts - 1, 20);
  const base = Math.min(RETRY_MAX_MS, exponential);
  // Clamp after jitter so the 5 minute ceiling is never exceeded.
  const delayMs = Math.min(
    RETRY_MAX_MS,
    Math.round(base * (1 + boundedJitter * RETRY_JITTER_RATIO)),
  );
  return {
    nextRetryAt: safeNow + delayMs,
    terminal: false,
    cooldown: safeAttempts >= RETRY_COOLDOWN_AFTER,
    delayMs,
  };
}

export function isEligible(nextRetryAt: number | null | undefined, now: number): boolean {
  if (nextRetryAt === null || nextRetryAt === undefined) return true;
  if (!Number.isFinite(nextRetryAt)) return false;
  return nextRetryAt <= now;
}
