import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncHealth } from '../../src/application/sync-types';
import { AdaptiveSyncScheduler, type SchedulerCoordinator } from '../../src/platform/sync/scheduler';

const profileId = 'profile-scheduler';

function health(overrides: Partial<SyncHealth> = {}): SyncHealth {
  return {
    localCommitted: true,
    remoteCommitted: true,
    converged: false,
    pendingCount: 0,
    mode: 'READY',
    ...overrides,
  };
}

function coordinator(result: SyncHealth = health()): SchedulerCoordinator & { calls: Array<{ profileId: string; reason: string }> } {
  const calls: Array<{ profileId: string; reason: string }> = [];
  return {
    calls,
    async requestFlush(nextProfileId, reason) {
      calls.push({ profileId: nextProfileId, reason });
      return result;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('F7 sync scheduler', () => {
  it('f7_commit_requests_single_coalesced_flush', async () => {
    const remote = coordinator();
    const scheduler = new AdaptiveSyncScheduler({ coordinator: remote });
    scheduler.request(profileId, 'COMMIT');
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(0);
    expect(remote.calls).toEqual([{ profileId, reason: 'LOCAL_COMMIT' }]);
  });

  it('f7_offline_does_not_spin', async () => {
    const remote = coordinator();
    const scheduler = new AdaptiveSyncScheduler({ coordinator: remote, isOnline: () => false });
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.calls).toHaveLength(0);
  });

  it('f7_health_callback_runs_after_an_automatic_flush', async () => {
    const remote = coordinator();
    const seen: string[] = [];
    const scheduler = new AdaptiveSyncScheduler({
      coordinator: remote,
      onHealth: (_profileId, next) => seen.push(next.mode),
    });
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(['READY']);
  });

  it('f7_no_auth_does_not_send', async () => {
    const remote = coordinator();
    const scheduler = new AdaptiveSyncScheduler({
      coordinator: remote,
      hasAuth: async () => false,
    });
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.calls).toHaveLength(0);
  });

  it('f7_closed_or_disposed_does_not_schedule_work', async () => {
    const remote = coordinator();
    const scheduler = new AdaptiveSyncScheduler({ coordinator: remote });
    scheduler.dispose();
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.calls).toHaveLength(0);
  });

  it('f7_backoff_and_quota_pause', async () => {
    const remote = coordinator(health({ mode: 'PAUSED_QUOTA', pendingCount: 1 }));
    const scheduler = new AdaptiveSyncScheduler({ coordinator: remote });
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(0);
    expect(remote.calls).toHaveLength(1);
    expect(scheduler.state(profileId).paused).toBe(true);
    scheduler.request(profileId, 'COMMIT');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.calls).toHaveLength(1);
  });

  it('f7_manual_request_respects_security_gates', async () => {
    const remote = coordinator();
    let online = false;
    let authenticated = true;
    const scheduler = new AdaptiveSyncScheduler({
      coordinator: remote,
      isOnline: () => online,
      hasAuth: async () => authenticated,
    });
    scheduler.request(profileId, 'MANUAL');
    await vi.advanceTimersByTimeAsync(0);
    expect(remote.calls).toHaveLength(0);

    online = true;
    authenticated = false;
    scheduler.request(profileId, 'MANUAL');
    await vi.advanceTimersByTimeAsync(0);
    expect(remote.calls).toHaveLength(0);

    authenticated = true;
    scheduler.request(profileId, 'MANUAL');
    await vi.advanceTimersByTimeAsync(0);
    expect(remote.calls).toEqual([{ profileId, reason: 'MANUAL' }]);
  });
});
