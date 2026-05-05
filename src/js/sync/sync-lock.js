/**
 * SyncLock — Promise-based mutex for serializing async operations.
 *
 * Replaces boolean flags (isFlushing, isSyncing, _isSyncing) that had race conditions.
 *
 * Usage:
 *   const result = await lock.withLock(async () => { ... });
 *
 * Features:
 * - Mutual exclusion: only one operation runs at a time
 * - Queue: concurrent calls wait in order
 * - Timeout: configurable, rejects if lock cannot be acquired
 * - Safe: releases lock even if operation throws
 */

export class SyncLock {
  #locked = false;
  #queue = [];
  #timeoutMs;

  constructor(options = {}) {
    this.#timeoutMs = options.timeoutMs ?? 30_000; // Default 30s
  }

  /**
   * Whether the lock is currently held (acquired by a caller).
   * @returns {boolean}
   */
  get isLocked() {
    return this.#locked;
  }

  /**
   * Execute fn inside the lock. Waits if lock is held.
   * @param {Function} fn - Async function to execute
   * @param {Object} options
   * @param {number} options.timeoutMs - Override timeout for this call
   * @returns {Promise<any>} Result of fn
   */
  async withLock(fn, options = {}) {
    const timeout = options.timeoutMs ?? this.#timeoutMs;

    // Wait for lock with timeout
    const acquired = await this.#acquire(timeout);
    if (!acquired) {
      throw new Error(`SyncLock: timeout after ${timeout}ms waiting for lock`);
    }

    try {
      return await fn();
    } finally {
      this.#release();
    }
  }

  /**
   * Reset the lock state. Forces release and clears queue.
   * Use with caution — may interrupt in-flight operations.
   */
  reset() {
    this.#locked = false;

    // Reject all queued waiters
    const queue = this.#queue;
    this.#queue = [];
    for (const { resolve } of queue) {
      resolve(false);
    }
  }

  #acquire(timeoutMs) {
    return new Promise((resolve) => {
      // If lock is free, take it immediately
      if (!this.#locked) {
        this.#locked = true;
        resolve(true);
        return;
      }

      // Queue this waiter
      const waiter = { resolve };
      this.#queue.push(waiter);

      // Timeout for this specific waiter
      waiter.timerId = setTimeout(() => {
        // Remove from queue if still there
        const idx = this.#queue.indexOf(waiter);
        if (idx !== -1) {
          this.#queue.splice(idx, 1);
        }
        resolve(false);
      }, timeoutMs);

      // Override resolve to clear timeout
      const originalResolve = waiter.resolve;
      waiter.resolve = (value) => {
        clearTimeout(waiter.timerId);
        originalResolve(value);
      };
    });
  }

  #release() {
    this.#locked = false;

    // Process next waiter in queue
    if (this.#queue.length > 0) {
      const next = this.#queue.shift();
      // Clear the waiter's timeout timer to prevent leak
      if (next.timerId !== undefined) {
        clearTimeout(next.timerId);
      }
      this.#locked = true;
      next.resolve(true);
    }
  }
}

// Singleton instances for each sync channel
export const firestoreLock = new SyncLock();
export const primarySyncLock = new SyncLock();
export const cloudflareLock = new SyncLock();
export const driveLock = new SyncLock();
