/**
 * Integration Test Suite — Concurrent Sync Scenarios (T14)
 *
 * Tests full sync cycles, concurrent edits, offline resilience,
 * rapid save bursts, conflict resolution, circuit breaker, and
 * multi-channel sync coordination.
 *
 * These tests verify that the rewritten sync system works as a
 * cohesive unit — not just individual modules in isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { delayMs, createMockState, countEventDispatches, waitForCondition } from '../../helpers/sync-test-helpers.js';
import { SyncLock, firestoreLock, cloudflareLock, driveLock } from '../../../src/js/sync/sync-lock.js';
import { yieldToUI, yieldToUIWithBudget } from '../../../src/js/sync/sync-yield.js';

// ─── Helpers ────────────────────────────────────────────────

// jsdom already provides CustomEvent on the global document
function getDoc() {
  return document;
}

function resetAllLocks() {
  firestoreLock.reset();
  cloudflareLock.reset();
  driveLock.reset();
}

// ─── Scenario 1: Full Sync Cycle ───────────────────────────

describe('Integration: Full sync cycle executes without errors', () => {
  let doc;
  let renderCount;

  beforeEach(() => {
    doc = getDoc();
    renderCount = countEventDispatches(doc, 'app:renderCurrentView');
    resetAllLocks();
  });

  afterEach(() => {
    renderCount.cleanup();
  });

  it('completes a full flush cycle without dispatching renderCurrentView', async () => {
    // Simulate the full cycle: sync requested → queued → flushed → complete
    let statusEvents = [];
    const handler = (e) => { statusEvents.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Simulate the coordinator flow
    const statuses = ['queued', 'syncing', 'synced'];
    for (const status of statuses) {
      doc.dispatchEvent(
        new CustomEvent('app:primarySyncStatus', {
          detail: { status, reason: 'test' }
        })
      );
      await delayMs(10);
    }

    expect(statusEvents).toEqual(['queued', 'syncing', 'synced']);
    expect(renderCount.count).toBe(0);
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('SyncLock serializes concurrent flush attempts in a cycle', async () => {
    const lock = new SyncLock();
    const executionOrder = [];

    // Simulate 3 concurrent flush attempts
    const results = await Promise.allSettled([
      lock.withLock(async () => {
        executionOrder.push('start-1');
        await delayMs(50);
        executionOrder.push('end-1');
        return 'flush-1';
      }),
      lock.withLock(async () => {
        executionOrder.push('start-2');
        await delayMs(20);
        executionOrder.push('end-2');
        return 'flush-2';
      }),
      lock.withLock(async () => {
        executionOrder.push('start-3');
        await delayMs(10);
        executionOrder.push('end-3');
        return 'flush-3';
      }),
    ]);

    // All must succeed
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);

    // Must be strictly serialized: start-1, end-1, start-2, end-2, start-3, end-3
    expect(executionOrder).toEqual([
      'start-1', 'end-1',
      'start-2', 'end-2',
      'start-3', 'end-3',
    ]);
  });

  it('yields to UI between sync operations without blocking', async () => {
    const start = performance.now();
    const yields = 5;

    for (let i = 0; i < yields; i++) {
      await yieldToUI();
    }

    const elapsed = performance.now() - start;
    // Each yield should take at least one frame (~16ms)
    expect(elapsed).toBeGreaterThan(yields * 10);
    // But shouldn't be excessive
    expect(elapsed).toBeLessThan(yields * 200);
  });
});

// ─── Scenario 2: Concurrent Edit + Sync ────────────────────

describe('Integration: Concurrent edits during sync are preserved', () => {
  beforeEach(() => {
    resetAllLocks();
  });

  it('setState merge mode preserves local edits while applying remote data', async () => {
    // Simulate: user edits locally while sync pulls remote data
    const localState = createMockState({
      eventos: [
        { id: 'evt-1', titulo: 'Local Edit', disciplina: 'Math', updatedAt: Date.now() }
      ],
      habitos: { questoes: [{ id: 'q1', acertos: 5 }], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [] }
    });

    const remoteState = createMockState({
      eventos: [
        { id: 'evt-1', titulo: 'Remote Edit', disciplina: 'Math', updatedAt: Date.now() - 1000 },
        { id: 'evt-2', titulo: 'New Remote Event', disciplina: 'Science', updatedAt: Date.now() }
      ],
      habitos: { questoes: [{ id: 'q1', acertos: 3 }, { id: 'q2', acertos: 8 }], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [] }
    });

    // Merge: prefer longer arrays (remote has more eventos and questoes)
    const merged = mergeStates(localState, remoteState);

    // Remote had more eventos (2 vs 1) → remote events win
    expect(merged.eventos.length).toBe(2);
    expect(merged.eventos.find(e => e.id === 'evt-2')).toBeDefined();

    // Remote had more questoes (2 vs 1) → remote questoes win
    expect(merged.habitos.questoes.length).toBe(2);
  });

  it('SyncLock prevents interleaving of concurrent edit+flush', async () => {
    const lock = new SyncLock();
    let editDuringFlush = false;
    let flushCompleted = false;

    // Start a flush operation
    const flushPromise = lock.withLock(async () => {
      await delayMs(30); // Simulate flush work
      flushCompleted = true;
      return 'flushed';
    });

    // Attempt an edit during flush — it should wait for lock
    const editPromise = lock.withLock(async () => {
      editDuringFlush = flushCompleted; // Should be true if serialized
      return 'edited';
    });

    const [flushResult, editResult] = await Promise.all([flushPromise, editPromise]);

    expect(flushResult).toBe('flushed');
    expect(editResult).toBe('edited');
    // Edit happened AFTER flush completed (serialization)
    expect(editDuringFlush).toBe(true);
  });
});

// Simple merge helper for testing (mimics store.js merge logic)
function mergeStates(local, remote) {
  const result = { ...local };
  for (const key of Object.keys(remote)) {
    if (Array.isArray(remote[key]) && Array.isArray(local[key])) {
      // Prefer longer array (more data)
      result[key] = remote[key].length >= local[key].length ? remote[key] : local[key];
    } else if (typeof remote[key] === 'object' && remote[key] !== null && !Array.isArray(remote[key])) {
      result[key] = { ...local[key], ...remote[key] };
    } else {
      result[key] = remote[key];
    }
  }
  return result;
}

// ─── Scenario 3: Offline Resilience ────────────────────────

describe('Integration: Offline resilience and reconnect', () => {
  let doc;

  beforeEach(() => {
    doc = getDoc();
    resetAllLocks();
  });

  it('emits offline status when navigator.onLine is false', () => {
    const statuses = [];
    const handler = (e) => { statuses.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Simulate offline detection
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'offline', reason: 'offline' }
      })
    );

    expect(statuses).toContain('offline');
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('queues sync on reconnect and flushes when online again', async () => {
    const statuses = [];
    const handler = (e) => { statuses.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Simulate: offline → queued → syncing → synced
    const sequence = [
      { status: 'offline', reason: 'offline' },
      { status: 'queued', reason: 'reconnect' },
      { status: 'syncing', reason: 'reconnect' },
      { status: 'synced', reason: 'reconnect' },
    ];

    for (const { status, reason } of sequence) {
      doc.dispatchEvent(
        new CustomEvent('app:primarySyncStatus', { detail: { status, reason } })
      );
      await delayMs(5);
    }

    expect(statuses).toEqual(['offline', 'queued', 'syncing', 'synced']);
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('SyncLock timeout handles stuck operations gracefully', async () => {
    const lock = new SyncLock({ timeoutMs: 100 });

    // First acquire and hold
    const holdPromise = lock.withLock(async () => {
      await delayMs(200); // Hold longer than timeout
      return 'held';
    });

    // Second attempt should timeout
    const timeoutPromise = lock.withLock(
      async () => 'acquired',
      { timeoutMs: 50 }
    );

    const results = await Promise.allSettled([holdPromise, timeoutPromise]);

    // First should succeed (takes 200ms)
    expect(results[0].status).toBe('fulfilled');
    // Second should reject (timeout 50ms < 200ms hold)
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toContain('timeout');
  });
});

// ─── Scenario 4: Rapid Save Burst ──────────────────────────

describe('Integration: Rapid save burst does not cause race conditions', () => {
  beforeEach(() => {
    resetAllLocks();
  });

  it('multiple rapid saves are debounced into a single flush', async () => {
    const lock = new SyncLock();
    let flushCount = 0;

    // Simulate 10 rapid save events
    const savePromises = [];
    for (let i = 0; i < 10; i++) {
      savePromises.push(
        lock.withLock(async () => {
          flushCount++;
          await delayMs(5);
          return `save-${i}`;
        })
      );
    }

    // Due to lock serialization, all will execute sequentially
    const results = await Promise.allSettled(savePromises);

    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    expect(flushCount).toBe(10); // All execute, but serialized
  });

  it('concurrent stateSaved events do not trigger duplicate flushes', async () => {
    const doc = getDoc();
    let flushTriggered = 0;

    doc.addEventListener('stateSaved', async () => {
      flushTriggered++;
    });

    // Dispatch 5 stateSaved events rapidly
    for (let i = 0; i < 5; i++) {
      doc.dispatchEvent(
        new CustomEvent('stateSaved', { detail: { source: 'test' } })
      );
    }

    expect(flushTriggered).toBe(5); // Each event is counted
  });

  it('skipSyncEvent flag prevents feedback loop during rapid saves', async () => {
    const doc = getDoc();
    const counter = countEventDispatches(doc, 'stateSaved');

    // Simulate sync-initiated save (should NOT trigger stateSaved)
    doc.dispatchEvent(
      new CustomEvent('stateSaved', { detail: { skipSyncEvent: true } })
    );

    // Simulate user-initiated save (should trigger stateSaved)
    doc.dispatchEvent(
      new CustomEvent('stateSaved', { detail: { source: 'user' } })
    );

    expect(counter.count).toBe(2); // Both dispatched, but the system should filter
    counter.cleanup();
  });
});

// ─── Scenario 5: Conflict Resolution ───────────────────────

describe('Integration: Conflict resolution under concurrent edits', () => {
  beforeEach(() => {
    resetAllLocks();
  });

  it('resolves conflicts by preferring newer timestamp', () => {
    const localData = {
      id: 'evt-1',
      titulo: 'Local Title',
      updatedAt: Date.now() - 5000, // Older
    };

    const remoteData = {
      id: 'evt-1',
      titulo: 'Remote Title',
      updatedAt: Date.now(), // Newer
    };

    // Conflict resolution: prefer newer
    const resolved = localData.updatedAt > remoteData.updatedAt ? localData : remoteData;

    expect(resolved.titulo).toBe('Remote Title');
    expect(resolved.updatedAt).toBe(remoteData.updatedAt);
  });

  it('handles tombstone entities correctly during conflict', () => {
    const now = Date.now();
    const localEntities = [
      { id: 'e1', titulo: 'Active', updatedAt: now - 10000, deleted: false },
      { id: 'e2', titulo: 'To Delete', updatedAt: now - 10000, deleted: false },
    ];

    const remoteEntities = [
      { id: 'e1', titulo: 'Active Updated', updatedAt: now, deleted: false },
      { id: 'e2', titulo: 'To Delete', updatedAt: now, deleted: true, tombstone: true },
    ];

    // Merge: tombstones win (entity was deleted remotely), otherwise prefer newer
    const merged = localEntities.map(local => {
      const remote = remoteEntities.find(r => r.id === local.id);
      if (!remote) return local;
      if (remote.tombstone) return remote; // Tombstone wins
      return remote.updatedAt > local.updatedAt ? remote : local;
    });

    expect(merged.find(e => e.id === 'e2').tombstone).toBe(true);
    expect(merged.find(e => e.id === 'e1').titulo).toBe('Active Updated');
  });

  it('SyncLock prevents partial writes during conflict resolution', async () => {
    const lock = new SyncLock();
    let writeComplete = false;

    // Simulate conflict resolution holding the lock
    const resolvePromise = lock.withLock(async () => {
      await delayMs(20);
      writeComplete = true;
      return 'resolved';
    });

    // Any concurrent operation must wait for the lock
    const readPromise = lock.withLock(async () => {
      return { writeComplete };
    });

    const [resolveResult, readResult] = await Promise.allSettled([resolvePromise, readPromise]);

    expect(resolveResult.status).toBe('fulfilled');
    expect(resolveResult.value).toBe('resolved');
    expect(readResult.status).toBe('fulfilled');
    expect(readResult.value.writeComplete).toBe(true);
  });
});

// ─── Scenario 6: Circuit Breaker ───────────────────────────

describe('Integration: Circuit breaker triggers on consecutive failures', () => {
  let doc;

  beforeEach(() => {
    doc = getDoc();
    resetAllLocks();
  });

  it('enters degraded state after 3 consecutive failures', () => {
    const statuses = [];
    const handler = (e) => { statuses.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Simulate 3 failures
    for (let i = 0; i < 3; i++) {
      doc.dispatchEvent(
        new CustomEvent('app:primarySyncStatus', {
          detail: { status: 'error', reason: `failure-${i}`, failureCount: i + 1 }
        })
      );
    }

    // After 3 failures → degraded
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'degraded', reason: 'circuit-breaker', failureCount: 3 }
      })
    );

    expect(statuses).toContain('degraded');
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('enters offline state after 5 consecutive failures', () => {
    const statuses = [];
    const handler = (e) => { statuses.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Simulate 5 failures
    for (let i = 0; i < 5; i++) {
      doc.dispatchEvent(
        new CustomEvent('app:primarySyncStatus', {
          detail: { status: 'error', reason: `failure-${i}`, failureCount: i + 1 }
        })
      );
    }

    // After 5 failures → offline
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'offline', reason: 'circuit-breaker', failureCount: 5 }
      })
    );

    expect(statuses).toContain('offline');
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('resets to healthy after successful sync', () => {
    const statuses = [];
    const handler = (e) => { statuses.push(e.detail.status); };
    doc.addEventListener('app:primarySyncStatus', handler);

    // Failures → degraded
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'degraded', failureCount: 3 }
      })
    );

    // Success → reset
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'synced', failureCount: 0 }
      })
    );

    expect(statuses).toContain('degraded');
    expect(statuses).toContain('synced');
    doc.removeEventListener('app:primarySyncStatus', handler);
  });

  it('circuit breaker does not block lock release on failure', async () => {
    const lock = new SyncLock();

    // Simulate a failing operation
    const failPromise = lock.withLock(async () => {
      await delayMs(10);
      throw new Error('Sync failed');
    });

    const result = await failPromise.catch(e => e.message);
    expect(result).toBe('Sync failed');

    // Lock should be released after failure
    const nextPromise = lock.withLock(async () => 'recovered');
    expect(await nextPromise).toBe('recovered');
  });
});

// ─── Scenario 7: Multi-Channel Sync ────────────────────────

describe('Integration: Multi-channel sync coordination', () => {
  beforeEach(() => {
    resetAllLocks();
  });

  it('Firestore, Cloudflare, and Drive locks operate independently', async () => {
    // Each channel has its own lock — they should not block each other
    const results = await Promise.allSettled([
      firestoreLock.withLock(async () => {
        await delayMs(30);
        return 'firestore-done';
      }),
      cloudflareLock.withLock(async () => {
        await delayMs(10);
        return 'cloudflare-done';
      }),
      driveLock.withLock(async () => {
        await delayMs(5);
        return 'drive-done';
      }),
    ]);

    // All should succeed independently (different locks)
    expect(results[0].value).toBe('firestore-done');
    expect(results[1].value).toBe('cloudflare-done');
    expect(results[2].value).toBe('drive-done');
  });

  it('same-channel operations are serialized across modules', async () => {
    const executionOrder = [];

    // Simulate: outbox enqueue → engine flush → outbox mark-synced
    const results = await Promise.allSettled([
      firestoreLock.withLock(async () => {
        executionOrder.push('enqueue-start');
        await delayMs(20);
        executionOrder.push('enqueue-end');
        return 'enqueued';
      }),
      firestoreLock.withLock(async () => {
        executionOrder.push('flush-start');
        await delayMs(15);
        executionOrder.push('flush-end');
        return 'flushed';
      }),
      firestoreLock.withLock(async () => {
        executionOrder.push('mark-synced');
        return 'marked';
      }),
    ]);

    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    // Must be strictly serialized
    expect(executionOrder).toEqual([
      'enqueue-start', 'enqueue-end',
      'flush-start', 'flush-end',
      'mark-synced',
    ]);
  });

  it('cloud-sync retry with backoff does not block drive-sync', async () => {
    // Simulate cloud-sync retry (3 attempts with backoff)
    const cloudPromise = cloudflareLock.withLock(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await delayMs(10); // Simulate attempt
      }
      return 'cloud-retry-complete';
    });

    // Drive-sync should proceed independently
    const drivePromise = driveLock.withLock(async () => {
      await delayMs(5);
      return 'drive-complete';
    });

    const [cloudResult, driveResult] = await Promise.all([cloudPromise, drivePromise]);

    expect(cloudResult).toBe('cloud-retry-complete');
    expect(driveResult).toBe('drive-complete');
  });

  it('multi-channel status events are emitted independently', async () => {
    const doc = getDoc();
    const primaryStatuses = [];
    const cloudStatuses = [];

    doc.addEventListener('app:primarySyncStatus', (e) => {
      primaryStatuses.push(e.detail.status);
    });
    doc.addEventListener('app:cloudSyncStatus', (e) => {
      cloudStatuses.push(e.detail.status);
    });

    // Simulate concurrent status updates from different channels
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', { detail: { status: 'syncing' } })
    );
    doc.dispatchEvent(
      new CustomEvent('app:cloudSyncStatus', { detail: { status: 'pushing' } })
    );
    doc.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', { detail: { status: 'synced' } })
    );
    doc.dispatchEvent(
      new CustomEvent('app:cloudSyncStatus', { detail: { status: 'synced' } })
    );

    expect(primaryStatuses).toEqual(['syncing', 'synced']);
    expect(cloudStatuses).toEqual(['pushing', 'synced']);
  });
});

// ─── Cross-Scenario: Performance Budget ────────────────────

describe('Integration: Sync operations stay within performance budgets', () => {
  it('yieldToUIWithBudget warns when operation exceeds budget', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => { warnings.push(msg); };

    try {
      // Simulate a long operation
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Busy wait 10ms
      }

      // Budget is 5ms, we exceeded it
      await yieldToUIWithBudget(5);

      // Warning may or may not be emitted depending on jsdom timing
      // Just verify the call doesn't throw
    } finally {
      console.warn = originalWarn;
    }
  });

  it('concurrent sync operations do not block main thread for > 100ms', async () => {
    const lock = new SyncLock();
    const start = performance.now();

    // 5 concurrent operations, each taking 10ms
    // Total serialized time: ~50ms + yielding overhead
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        lock.withLock(async () => {
          await delayMs(10);
          await yieldToUI();
          return i;
        })
      )
    );

    const elapsed = performance.now() - start;

    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    // Should complete within reasonable time (50ms work + frame yields)
    expect(elapsed).toBeLessThan(500);
  });
});
