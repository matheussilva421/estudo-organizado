import { describe, expect, it } from 'vitest';

import {
  appendSyncHealthEvent,
  deriveSyncHealthState,
  summarizeSyncMetrics,
} from '../../src/js/sync/sync-health.js';

describe('sync-health.js', () => {
  it('summarizes the normal synced state', () => {
    const health = deriveSyncHealthState({
      localSavedAt: '2026-04-30T10:00:00.000Z',
      remoteAckAt: '2026-04-30T10:00:05.000Z',
    });

    expect(health.state).toBe('synced');
    expect(health.requiresAction).toBe(false);
  });

  it('marks pending writes as queued with retry metrics', () => {
    const health = deriveSyncHealthState({
      pending: {
        status: 'pending',
        attempts: 2,
        queuedAt: '2026-04-30T10:00:00.000Z',
        nextAttemptAt: '2026-04-30T10:02:00.000Z',
      },
      now: new Date('2026-04-30T10:01:00.000Z').getTime(),
    });

    expect(health.state).toBe('queued');
    expect(health.metrics.pendingAgeMs).toBe(60000);
    expect(health.metrics.retryAttempts).toBe(2);
    expect(health.metrics.nextRetryAt).toBe('2026-04-30T10:02:00.000Z');
  });

  it('marks repeated errors as degraded without requiring payload data', () => {
    const health = deriveSyncHealthState({
      lastError: 'network timeout',
      failureCount: 3,
    });

    expect(health.state).toBe('degraded');
    expect(health.requiresAction).toBe(false);
    expect(health.lastError).toBe('network timeout');
  });

  it('marks offline state as queued for later sync without requiring action', () => {
    const health = deriveSyncHealthState({
      offline: true,
      localSavedAt: '2026-05-01T10:00:00.000Z',
    });

    expect(health.state).toBe('offline');
    expect(health.requiresAction).toBe(false);
  });

  it('keeps bounded structured event history without payloads', () => {
    const target = { config: {} };
    appendSyncHealthEvent(target, {
      type: 'queued',
      payload: { secret: 'must-not-persist' },
      reason: 'local-save',
    }, { now: '2026-04-30T10:00:00.000Z', max: 1 });
    appendSyncHealthEvent(target, {
      type: 'synced',
      detail: 'remote ack',
    }, { now: '2026-04-30T10:01:00.000Z', max: 1 });

    expect(target.config.syncHealth.events).toHaveLength(1);
    expect(target.config.syncHealth.events[0]).toEqual({
      type: 'synced',
      reason: null,
      detail: 'remote ack',
      at: '2026-04-30T10:01:00.000Z',
    });
  });

  it('returns compact metrics for the Sync Center', () => {
    expect(summarizeSyncMetrics({
      pendingAgeMs: 120000,
      retryAttempts: 4,
      nextRetryAt: '2026-04-30T10:02:00.000Z',
      remoteAckAt: '2026-04-30T10:01:00.000Z',
    })).toMatchObject({
      pendingAgeLabel: '2 min',
      retryAttempts: 4,
      nextRetryAt: '2026-04-30T10:02:00.000Z',
    });
  });
});
