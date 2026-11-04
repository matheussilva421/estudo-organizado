import type { SyncHealth } from '../../application/sync-types';
import type { FlushReason } from './sync-coordinator';

export type SyncTrigger =
  | 'COMMIT'
  | 'OPEN'
  | 'RESUME'
  | 'ONLINE'
  | 'REMOTE_HINT'
  | 'MANUAL'
  | 'RETRY';

export type SchedulerCoordinator = {
  requestFlush(profileId: string, reason: FlushReason): Promise<SyncHealth>;
};

export type AdaptiveSyncSchedulerOptions = {
  coordinator: SchedulerCoordinator;
  isOnline?: () => boolean;
  hasAuth?: (profileId: string) => Promise<boolean>;
  retryBaseMs?: number;
  retryMaxMs?: number;
};

export type SchedulerState = {
  paused: boolean;
  pending: SyncTrigger | null;
  timerScheduled: boolean;
};

const PRIORITY: Record<SyncTrigger, number> = {
  MANUAL: 7,
  COMMIT: 6,
  ONLINE: 5,
  RESUME: 4,
  RETRY: 3,
  OPEN: 2,
  REMOTE_HINT: 1,
};

function mapReason(trigger: SyncTrigger): FlushReason {
  if (trigger === 'COMMIT') return 'LOCAL_COMMIT';
  if (trigger === 'ONLINE') return 'RECONNECT';
  if (trigger === 'MANUAL') return 'MANUAL';
  return 'RESUME';
}

function stronger(left: SyncTrigger | undefined, right: SyncTrigger): SyncTrigger {
  if (!left) return right;
  return PRIORITY[right] >= PRIORITY[left] ? right : left;
}

/**
 * Coalesces sync requests into one economical flush. It never spins while
 * offline, unauthenticated, paused or disposed, and quota/auth pauses require
 * an explicit resume.
 */
export class AdaptiveSyncScheduler {
  private readonly coordinator: SchedulerCoordinator;
  private readonly isOnline: () => boolean;
  private readonly hasAuth: (profileId: string) => Promise<boolean>;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reasons = new Map<string, SyncTrigger>();
  private readonly paused = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private disposed = false;

  constructor(options: AdaptiveSyncSchedulerOptions) {
    this.coordinator = options.coordinator;
    this.isOnline = options.isOnline ?? (() => true);
    this.hasAuth = options.hasAuth ?? (async () => true);
    this.retryBaseMs = Math.max(1, options.retryBaseMs ?? 30_000);
    this.retryMaxMs = Math.max(this.retryBaseMs, options.retryMaxMs ?? 5 * 60_000);
  }

  request(profileId: string, trigger: SyncTrigger): void {
    if (this.disposed || this.paused.has(profileId)) return;
    if (!this.isOnline()) return;
    this.reasons.set(profileId, stronger(this.reasons.get(profileId), trigger));
    if (this.timers.has(profileId)) return;
    this.schedule(profileId, 0);
  }

  pause(profileId: string): void {
    this.paused.add(profileId);
    this.reasons.delete(profileId);
    this.clear(profileId);
  }

  resume(profileId: string): void {
    this.paused.delete(profileId);
    this.attempts.delete(profileId);
    this.request(profileId, 'RESUME');
  }

  dispose(): void {
    this.disposed = true;
    for (const profileId of [...this.timers.keys()]) this.clear(profileId);
    this.reasons.clear();
    this.paused.clear();
    this.attempts.clear();
  }

  state(profileId: string): SchedulerState {
    return {
      paused: this.paused.has(profileId),
      pending: this.reasons.get(profileId) ?? null,
      timerScheduled: this.timers.has(profileId),
    };
  }

  private clear(profileId: string): void {
    const timer = this.timers.get(profileId);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(profileId);
  }

  private schedule(profileId: string, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(profileId);
      void this.flush(profileId);
    }, delay);
    this.timers.set(profileId, timer);
  }

  private async flush(profileId: string): Promise<void> {
    if (this.disposed || this.paused.has(profileId)) return;
    if (!this.isOnline()) return;
    const trigger = this.reasons.get(profileId) ?? 'OPEN';
    this.reasons.delete(profileId);
    if (!(await this.hasAuth(profileId).catch(() => false))) return;

    const health = await this.coordinator.requestFlush(profileId, mapReason(trigger)).catch(() => null);
    if (!health) return;
    if (health.mode === 'PAUSED_QUOTA' || health.mode === 'PAUSED_AUTH' || health.mode === 'PAUSED_LOCK') {
      this.pause(profileId);
      return;
    }
    if (health.pendingCount > 0) {
      const attempt = (this.attempts.get(profileId) ?? 0) + 1;
      this.attempts.set(profileId, attempt);
      const delay = Math.min(this.retryMaxMs, this.retryBaseMs * 2 ** Math.min(attempt - 1, 10));
      this.reasons.set(profileId, 'RETRY');
      this.schedule(profileId, delay);
      return;
    }
    this.attempts.delete(profileId);
  }
}
