export type SyncUsage = {
  reads: number;
  writes: number;
  deletes: number;
  bytesOut: number;
  windowStart: string;
};

export type SyncUsageLimits = {
  reads: number;
  writes: number;
  deletes: number;
  bytesOut: number;
  periodMs: number;
};

export type MeasuredUsage = {
  kind: 'READ' | 'WRITE' | 'DELETE';
  count: number;
  bytesOut: number;
  source: string;
};

export type BudgetAssessment = {
  kind: 'ALLOW' | 'PAUSE';
  guaranteed: false;
  source: 'LOCAL_ESTIMATE';
  reason?: string;
};

/** Pause before the nominal ceiling; the remaining 10% is emergency margin. */
export const SYNC_BUDGET_SAFETY_RATIO = 0.9;

/** One Firestore apply batch writes entity, operation, change and head. */
export const REMOTE_WRITES_PER_OPERATION = 4;

/** Three documents per attempt, with room for one reconciliation retry. */
export const REMOTE_READS_PER_OPERATION = 6;

/** Conservative ceiling for one bounded pull cycle (up to ten pages of 50). */
export const REMOTE_PULL_READ_BUDGET = 2_501;

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validUsage(usage: SyncUsage): boolean {
  return (
    finiteNonNegative(usage.reads) &&
    finiteNonNegative(usage.writes) &&
    finiteNonNegative(usage.deletes) &&
    finiteNonNegative(usage.bytesOut) &&
    typeof usage.windowStart === 'string' &&
    usage.windowStart.trim().length > 0
  );
}

function validLimits(limits: SyncUsageLimits): boolean {
  return (
    finiteNonNegative(limits.reads) &&
    finiteNonNegative(limits.writes) &&
    finiteNonNegative(limits.deletes) &&
    finiteNonNegative(limits.bytesOut) &&
    finiteNonNegative(limits.periodMs) &&
    limits.periodMs > 0
  );
}

function validNext(next: { reads: number; writes: number; deletes: number }): boolean {
  return (
    Number.isInteger(next.reads) &&
    next.reads >= 0 &&
    Number.isInteger(next.writes) &&
    next.writes >= 0 &&
    Number.isInteger(next.deletes) &&
    next.deletes >= 0
  );
}

export function assessSyncBudgetDetailed(
  usage: SyncUsage,
  limits: SyncUsageLimits,
  next: { reads: number; writes: number; deletes: number },
): BudgetAssessment {
  if (!validUsage(usage) || !validLimits(limits) || !validNext(next)) {
    return {
      kind: 'PAUSE',
      guaranteed: false,
      source: 'LOCAL_ESTIMATE',
      reason: 'INVALID_INPUT',
    };
  }
  const checks: Array<[string, number, number, number]> = [
    ['reads', usage.reads, next.reads, limits.reads],
    ['writes', usage.writes, next.writes, limits.writes],
    ['deletes', usage.deletes, next.deletes, limits.deletes],
    ['bytesOut', usage.bytesOut, 0, limits.bytesOut],
  ];
  for (const [name, current, increment, limit] of checks) {
    if (current + increment >= limit * SYNC_BUDGET_SAFETY_RATIO) {
      return {
        kind: 'PAUSE',
        guaranteed: false,
        source: 'LOCAL_ESTIMATE',
        reason: `BUDGET_MARGIN:${name}`,
      };
    }
  }
  return { kind: 'ALLOW', guaranteed: false, source: 'LOCAL_ESTIMATE' };
}

export function assessSyncBudget(
  usage: SyncUsage,
  limits: SyncUsageLimits,
  next: { reads: number; writes: number; deletes: number },
): 'ALLOW' | 'PAUSE' {
  return assessSyncBudgetDetailed(usage, limits, next).kind;
}

const measured: MeasuredUsage[] = [];

/** Sanitized local measurement; never stores payload or account content. */
export function recordMeasuredSyncUsage(event: MeasuredUsage): void {
  if (!event || (event.kind !== 'READ' && event.kind !== 'WRITE' && event.kind !== 'DELETE')) return;
  if (!Number.isInteger(event.count) || event.count < 0) return;
  if (!finiteNonNegative(event.bytesOut)) return;
  if (typeof event.source !== 'string' || !event.source.trim()) return;
  measured.push({
    kind: event.kind,
    count: event.count,
    bytesOut: event.bytesOut,
    source: event.source,
  });
  if (measured.length > 1_000) measured.splice(0, measured.length - 1_000);
}

export function getMeasuredSyncUsage(): readonly MeasuredUsage[] {
  return measured;
}

export function resetMeasuredSyncUsageForTests(): void {
  measured.length = 0;
}

export function sumMeasuredUsage(events: readonly MeasuredUsage[]): SyncUsage {
  const usage: SyncUsage = {
    reads: 0,
    writes: 0,
    deletes: 0,
    bytesOut: 0,
    windowStart: new Date(0).toISOString(),
  };
  for (const event of events) {
    if (event.kind === 'READ') usage.reads += event.count;
    if (event.kind === 'WRITE') usage.writes += event.count;
    if (event.kind === 'DELETE') usage.deletes += event.count;
    usage.bytesOut += event.bytesOut;
  }
  return usage;
}
