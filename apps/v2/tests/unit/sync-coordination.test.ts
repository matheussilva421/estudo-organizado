import { describe, expect, it, vi } from 'vitest';
import {
  withSafeFlushLock,
  type LockPort,
} from '../../src/platform/sync/coordination';

class FakeLocks implements LockPort {
  private tail: Promise<unknown> = Promise.resolve();
  active = 0;
  maxActive = 0;

  request<T>(_name: string, task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      this.active += 1;
      this.maxActive = Math.max(this.maxActive, this.active);
      try {
        return await task();
      } finally {
        this.active -= 1;
      }
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<T>;
  }
}

describe('sync coordination', () => {
  it('one_flush_owner_across_two_tabs', async () => {
    const locks = new FakeLocks();
    const order: string[] = [];

    const first = withSafeFlushLock(
      'v2-flush-profile-a',
      async () => {
        order.push('first-start');
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('first-end');
      },
      locks,
    );
    const second = withSafeFlushLock(
      'v2-flush-profile-a',
      async () => {
        order.push('second');
      },
      locks,
    );

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second']);
    expect(locks.maxActive).toBe(1);
  });

  it('no_web_locks_blocks_remote_flush_without_safe_fallback', async () => {
    const task = vi.fn(async () => 'remote-write');
    const result = await withSafeFlushLock('v2-flush-profile-a', task, null);

    expect(result).toEqual({ kind: 'BLOCKED' });
    expect(task).not.toHaveBeenCalled();
  });

  it('lock_released_after_exception', async () => {
    const locks = new FakeLocks();

    const failed = await withSafeFlushLock(
      'v2-flush-profile-a',
      async () => {
        throw new Error('network');
      },
      locks,
    );
    const next = await withSafeFlushLock('v2-flush-profile-a', async () => 'ok', locks);

    expect(failed).toEqual({ kind: 'BLOCKED' });
    expect(next).toEqual({ kind: 'EXECUTED', value: 'ok' });
  });

  it('broadcast_does_not_grant_lock', async () => {
    const task = vi.fn(async () => 'write');
    const broken: LockPort = {
      request: () => Promise.reject(new Error('locks unavailable')),
    };

    expect(await withSafeFlushLock('v2-flush-profile-a', task, broken)).toEqual({ kind: 'BLOCKED' });
    expect(task).not.toHaveBeenCalled();
  });
});
