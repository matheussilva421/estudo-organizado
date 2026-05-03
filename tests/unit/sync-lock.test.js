import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  SyncLock,
  firestoreLock,
  primarySyncLock,
  cloudflareLock,
  driveLock,
} from '../../src/js/sync/sync-lock.js?v=8.33';

describe('sync/sync-lock.js', () => {
  beforeEach(() => {
    // Reset all locks before each test
    firestoreLock.reset();
    primarySyncLock.reset();
    cloudflareLock.reset();
    driveLock.reset();
  });

  describe('SyncLock class', () => {
    it('acquires and releases lock sequentially', async () => {
      const lock = new SyncLock();
      let order = [];

      await lock.withLock(async () => {
        order.push('first-start');
        await new Promise((r) => setTimeout(r, 50));
        order.push('first-end');
      });

      await lock.withLock(async () => {
        order.push('second-start');
        order.push('second-end');
      });

      expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
    });

    it('queues concurrent calls — second waits for first', async () => {
      const lock = new SyncLock();
      let concurrent = false;

      const p1 = lock.withLock(async () => {
        concurrent = true;
        await new Promise((r) => setTimeout(r, 100));
        concurrent = false;
        return 'first';
      });

      const p2 = lock.withLock(async () => {
        // This should NOT run while first is running
        expect(concurrent).toBe(false);
        return 'second';
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('first');
      expect(r2).toBe('second');
    });

    it('rejects after timeout if lock cannot be acquired', async () => {
      const lock = new SyncLock({ timeoutMs: 100 });

      // Hold the lock longer than timeout
      const held = lock.withLock(async () => {
        await new Promise((r) => setTimeout(r, 500));
        return 'held';
      });

      // This should timeout
      await expect(lock.withLock(async () => 'should-not-run', { timeoutMs: 100 })).rejects.toThrow(
        /timeout/i
      );

      // Original should still complete
      await held;
    });

    it('queues calls started after the first operation has entered the critical section', async () => {
      const lock = new SyncLock();
      const order = [];
      let releaseFirst;
      const firstCanFinish = new Promise((resolve) => {
        releaseFirst = resolve;
      });

      const first = lock.withLock(async () => {
        order.push('first-start');
        await firstCanFinish;
        order.push('first-end');
      });

      await vi.waitFor(() => {
        expect(order).toEqual(['first-start']);
      });

      const second = lock.withLock(async () => {
        order.push('second-start');
      });

      await Promise.resolve();
      expect(order).toEqual(['first-start']);

      releaseFirst();
      await Promise.all([first, second]);
      expect(order).toEqual(['first-start', 'first-end', 'second-start']);
    });

    it('releases lock even if operation throws', async () => {
      const lock = new SyncLock();

      await expect(
        lock.withLock(async () => {
          throw new Error('intentional');
        })
      ).rejects.toThrow('intentional');

      // Lock should be released — this should not hang
      let ran = false;
      await lock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('returns the result of the operation', async () => {
      const lock = new SyncLock();
      const result = await lock.withLock(async () => 42);
      expect(result).toBe(42);
    });

    it('reset clears the lock state', async () => {
      const lock = new SyncLock();
      let started = false;

      // Start a long-running operation
      const p = lock.withLock(async () => {
        started = true;
        await new Promise((r) => setTimeout(r, 5000));
      });

      // Reset should allow new operations
      lock.reset();

      let ran = false;
      await lock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
      expect(started).toBe(true);

      // Clean up the original promise (it will eventually resolve)
      // We can't cancel it, but we've proven reset works
    });
  });

  describe('singleton instances', () => {
    it('exports firestoreLock', async () => {
      expect(firestoreLock).toBeInstanceOf(SyncLock);
      let ran = false;
      await firestoreLock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('exports cloudflareLock', async () => {
      expect(cloudflareLock).toBeInstanceOf(SyncLock);
      let ran = false;
      await cloudflareLock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('exports primarySyncLock', async () => {
      expect(primarySyncLock).toBeInstanceOf(SyncLock);
      let ran = false;
      await primarySyncLock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('exports driveLock', async () => {
      expect(driveLock).toBeInstanceOf(SyncLock);
      let ran = false;
      await driveLock.withLock(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('each singleton is independent', async () => {
      // Acquire all three locks concurrently — should all succeed
      const [r1, r2, r3] = await Promise.all([
        firestoreLock.withLock(async () => 'fs'),
        cloudflareLock.withLock(async () => 'cf'),
        driveLock.withLock(async () => 'drive'),
      ]);
      expect(r1).toBe('fs');
      expect(r2).toBe('cf');
      expect(r3).toBe('drive');
    });
  });
});
