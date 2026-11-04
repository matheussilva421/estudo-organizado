import { beforeEach, describe, expect, it } from 'vitest';
import {
  assessSyncBudget,
  assessSyncBudgetDetailed,
  getMeasuredSyncUsage,
  recordMeasuredSyncUsage,
  resetMeasuredSyncUsageForTests,
  sumMeasuredUsage,
  type SyncUsage,
  type SyncUsageLimits,
} from '../../src/platform/sync/budget';

const usage: SyncUsage = {
  reads: 100,
  writes: 100,
  deletes: 10,
  bytesOut: 1_000,
  windowStart: new Date().toISOString(),
};

const limits: SyncUsageLimits = {
  reads: 50_000,
  writes: 20_000,
  deletes: 20_000,
  bytesOut: 10 * 1024 * 1024 * 1024,
  periodMs: 24 * 60 * 60_000,
};

beforeEach(() => {
  resetMeasuredSyncUsageForTests();
});

describe('F7 sync budget', () => {
  it('f7_rejects_negative_or_nonfinite_limits', () => {
    expect(assessSyncBudget(usage, { ...limits, writes: -1 }, { reads: 1, writes: 1, deletes: 0 })).toBe(
      'PAUSE',
    );
    expect(
      assessSyncBudget(usage, { ...limits, reads: Number.POSITIVE_INFINITY }, { reads: 1, writes: 1, deletes: 0 }),
    ).toBe('PAUSE');
    expect(
      assessSyncBudget(usage, limits, { reads: -1, writes: 1, deletes: 0 }),
    ).toBe('PAUSE');
  });

  it('f7_pause_before_local_safety_budget', () => {
    const nearLimit: SyncUsage = { ...usage, writes: 18_000 };
    expect(assessSyncBudget(nearLimit, limits, { reads: 0, writes: 1_000, deletes: 0 })).toBe('PAUSE');
    expect(assessSyncBudget(usage, limits, { reads: 1, writes: 1, deletes: 0 })).toBe('ALLOW');
  });

  it('f7_reconnect_amplification_counted', () => {
    recordMeasuredSyncUsage({ kind: 'READ', count: 5, bytesOut: 100, source: 'reconnect-1' });
    recordMeasuredSyncUsage({ kind: 'READ', count: 7, bytesOut: 200, source: 'reconnect-2' });
    recordMeasuredSyncUsage({ kind: 'WRITE', count: 2, bytesOut: 50, source: 'flush' });
    const total = sumMeasuredUsage(getMeasuredSyncUsage());
    expect(total.reads).toBe(12);
    expect(total.writes).toBe(2);
    expect(total.bytesOut).toBe(350);
  });

  it('f7_quota_error_keeps_outbox', () => {
    // The budget is a gate; it never deletes the local intent. A pause here
    // means the caller keeps the outbox untouched and reports PAUSED_QUOTA.
    const decision = assessSyncBudget(
      { ...usage, writes: 19_900 },
      limits,
      { reads: 0, writes: 100, deletes: 0 },
    );
    expect(decision).toBe('PAUSE');
  });

  it('f7_unverified_quota_not_reported_as_guaranteed', () => {
    const assessment = assessSyncBudgetDetailed(usage, limits, { reads: 1, writes: 1, deletes: 0 });
    expect(assessment.guaranteed).toBe(false);
    expect(assessment.source).toBe('LOCAL_ESTIMATE');
  });
});
