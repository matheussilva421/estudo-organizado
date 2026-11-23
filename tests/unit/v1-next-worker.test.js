import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UID = 'uid_worker';
const GENERATION = 'gen_worker';

function operation(overrides = {}) {
  return {
    opId: 'op_1',
    uid: UID,
    generationId: GENERATION,
    entityKey: 'evento:ev_1',
    entityType: 'evento',
    entityId: 'ev_1',
    collection: 'eventos',
    sequence: 1,
    baseRevision: 0,
    revision: 1,
    action: 'upsert',
    status: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    ...overrides,
  };
}

function receiptFor(item, overrides = {}) {
  return {
    schemaVersion: 1,
    generationId: item.generationId,
    entityType: item.entityType,
    entityId: item.entityId,
    collection: item.collection,
    revision: item.revision,
    baseRevision: item.baseRevision,
    opId: item.opId,
    opDigest: 'a'.repeat(64),
    deleted: item.action === 'delete',
    updatedAt: { seconds: 1800000000, nanoseconds: 0 },
    ...overrides,
  };
}

let local;
let remote;
let bootstrap;
let store;
let worker;
let subscribed;

async function loadWorker() {
  vi.resetModules();
  local = {
    setActiveV1Context: vi.fn((uid, generationId) => {
      local.active = { uid, generationId };
    }),
    clearActiveV1Context: vi.fn(() => { local.active = null; }),
    getActiveV1Context: vi.fn(() => local.active),
    getPendingOperations: vi.fn(async () => []),
    claimLocalOperation: vi.fn(async op => ({ ...op, status: 'in-flight' })),
    ackLocalOperation: vi.fn(async () => {}),
    markLocalOperationRetry: vi.fn(async () => {}),
    markLocalOperationConflict: vi.fn(async () => {}),
    mergeLocalOperationWithRemote: vi.fn(async () => ({ merged: false })),
    acquireV1WorkerLease: vi.fn(async () => ({ acquired: true, token: 'lease' })),
    renewV1WorkerLease: vi.fn(async () => true),
    releaseV1WorkerLease: vi.fn(async () => {}),
    readLocalGeneration: vi.fn(async () => ({
      state: { eventos: [] },
      verified: true,
    })),
  };
  remote = {
    applyRemoteOperation: vi.fn(),
    subscribeGeneration: vi.fn((uid, generationId, handlers) => {
      subscribed = { uid, generationId, handlers, stop: vi.fn() };
      return subscribed.stop;
    }),
  };
  bootstrap = {
    isV1AuthFailure: code => ['V1_REMOTE_AUTH_REQUIRED', 'V1_REMOTE_UID_MISMATCH'].includes(code),
    reconcileRemoteDelta: vi.fn(async () => {}),
    revalidateV1Generation: vi.fn(async () => ({ status: 'ready' })),
  };
  store = { setState: vi.fn() };

  vi.doMock('../../src/js/sync/v1-next/local.js', () => local);
  vi.doMock('../../src/js/sync/v1-next/remote.js', () => remote);
  vi.doMock('../../src/js/sync/v1-next/bootstrap.js', () => bootstrap);
  vi.doMock('../../src/js/store.js?v=8.37', () => store);
  worker = await import('../../src/js/sync/v1-next/worker.js');
}

async function flushWorkerPromises() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

beforeEach(async () => {
  vi.useFakeTimers();
  globalThis.navigator = { onLine: true };
  globalThis.window = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(document, 'addEventListener');
  vi.spyOn(document, 'removeEventListener');
  subscribed = null;
  await loadWorker();
});

function persistentQueue(initial = []) {
  let pending = initial.map((item) => ({ ...item }));
  local.getPendingOperations.mockImplementation(async () => pending);
  local.ackLocalOperation.mockImplementation(async (opId) => {
    pending = pending.filter((item) => item.opId !== opId);
  });
  local.markLocalOperationRetry.mockImplementation(async (opId, details) => {
    pending = pending.map((item) => item.opId === opId ? {
      ...item,
      status: 'retry',
      attempts: details.attempts,
      nextAttemptAt: details.nextAttemptAt,
    } : item);
  });
  local.markLocalOperationConflict.mockImplementation(async (opId) => {
    pending = pending.filter((item) => item.opId !== opId);
  });
  return {
    set(items) { pending = items.map((item) => ({ ...item })); },
    get() { return pending; },
  };
}

afterEach(() => {
  worker?.stopV1Sync();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('V1 sync worker', () => {
  it('coalesces multiple stateSaved events into one serial drain', async () => {
    const first = operation();
    const queue = persistentQueue();
    remote.applyRemoteOperation.mockResolvedValue({
      acknowledged: true,
      receipt: receiptFor(first),
    });

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    queue.set([first]);
    for (let index = 0; index < 5; index += 1) {
      document.dispatchEvent(new CustomEvent('stateSaved', {
        detail: { source: 'unit' },
      }));
    }
    await vi.advanceTimersByTimeAsync(250);

    expect(remote.applyRemoteOperation).toHaveBeenCalledTimes(1);
    expect(local.ackLocalOperation).toHaveBeenCalledTimes(1);
    expect(remote.subscribeGeneration).toHaveBeenCalledOnce();
  });

  it('reconciles a remote echo without creating or sending an outbox operation', async () => {
    local.getPendingOperations.mockResolvedValue([]);
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    const delta = {
      collection: 'eventos',
      entityId: 'ev_remote',
      record: { opId: 'op_remote' },
    };

    await subscribed.handlers.onDelta(delta);

    expect(bootstrap.reconcileRemoteDelta).toHaveBeenCalledWith(delta, {
      uid: UID,
      generationId: GENERATION,
    });
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
    expect(local.markLocalOperationConflict).not.toHaveBeenCalled();
  });

  it('waits while offline and drains automatically after reconnect', async () => {
    const first = operation();
    persistentQueue([first]);
    navigator.onLine = false;
    remote.applyRemoteOperation.mockResolvedValue({
      acknowledged: true,
      receipt: receiptFor(first),
    });

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();

    navigator.onLine = true;
    const onlineHandler = window.addEventListener.mock.calls.find(
      ([event]) => event === 'online',
    )?.[1];
    onlineHandler(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);

    expect(remote.applyRemoteOperation).toHaveBeenCalledOnce();
    expect(local.ackLocalOperation).toHaveBeenCalledOnce();
  });

  it('recovers a durable receipt on retry when ACK failed after the remote commit', async () => {
    const first = operation();
    persistentQueue([first]);
    remote.applyRemoteOperation
      .mockResolvedValueOnce({
        acknowledged: true,
        receipt: receiptFor(first),
      })
      .mockResolvedValueOnce({
        acknowledged: true,
        receipt: receiptFor(first),
      });
    local.ackLocalOperation
      .mockRejectedValueOnce(new Error('ACK storage failed'));

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    expect(local.ackLocalOperation).toHaveBeenCalledOnce();
    expect(local.markLocalOperationRetry).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1_000);
    await worker.drainPendingOperations();

    expect(remote.applyRemoteOperation).toHaveBeenCalledTimes(2);
    expect(local.ackLocalOperation).toHaveBeenCalledTimes(2);
  });

  it('keeps an expired Auth operation durable and does not report a false ACK', async () => {
    const first = operation();
    local.getPendingOperations.mockResolvedValue([first]);
    remote.applyRemoteOperation.mockRejectedValue(Object.assign(
      new Error('expired'),
      { code: 'V1_REMOTE_AUTH_REQUIRED' },
    ));

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });

    expect(local.ackLocalOperation).not.toHaveBeenCalled();
    expect(local.markLocalOperationRetry).toHaveBeenCalledWith(
      first.opId,
      expect.objectContaining({ reason: 'V1_REMOTE_AUTH_REQUIRED' }),
    );
    expect(remote.applyRemoteOperation).toHaveBeenCalledOnce();
  });

  it('detaches an unauthenticated listener until the same UID signs in again', async () => {
    const queue = persistentQueue();
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    const old = subscribed;
    old.handlers.onError({ code: 'V1_REMOTE_AUTH_REQUIRED' });
    queue.set([operation()]);
    await vi.advanceTimersByTimeAsync(6000);
    await worker.drainPendingOperations();
    expect(old.stop).toHaveBeenCalledOnce();
    expect(remote.subscribeGeneration).toHaveBeenCalledOnce();
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
    await worker.resumeV1SyncForUser('other');
    remote.applyRemoteOperation.mockResolvedValue({ acknowledged: true, receipt: receiptFor(operation()) });
    await worker.resumeV1SyncForUser(UID);
    await old.handlers.onDelta({});
    expect(bootstrap.reconcileRemoteDelta).not.toHaveBeenCalled();
    expect(remote.subscribeGeneration).toHaveBeenCalledTimes(2);
    expect(local.ackLocalOperation).toHaveBeenCalledOnce();
  });

  it('isolates a conflict to its entity and continues the remaining FIFO operations', async () => {
    const conflicted = operation();
    const healthy = operation({
      opId: 'op_2',
      entityKey: 'evento:ev_2',
      entityId: 'ev_2',
      sequence: 2,
      baseRevision: 2,
      revision: 3,
    });
    const queue = persistentQueue();
    remote.applyRemoteOperation.mockImplementation(async (item) => {
      if (item.opId === conflicted.opId) {
        return {
          acknowledged: false,
          conflict: { code: 'revision', remoteRevision: 4 },
        };
      }
      return { acknowledged: true, receipt: receiptFor(item) };
    });

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    queue.set([conflicted, healthy]);
    const result = await worker.drainPendingOperations();

    expect(local.markLocalOperationConflict).toHaveBeenCalledWith(
      conflicted.opId,
      expect.objectContaining({ remoteRevision: 4 }),
    );
    expect(local.ackLocalOperation).toHaveBeenCalledWith(
      healthy.opId,
      expect.any(Object),
    );
    expect(result.conflicts).toBeGreaterThanOrEqual(1);
  });

  it('rebases an independent advanced edit, retries once and acknowledges the new revision', async () => {
    const original = operation({
      baseRevision: 1,
      revision: 2,
      baseRecord: { data: { titulo: 'Base' } },
    });
    const rebased = operation({
      baseRevision: 2,
      revision: 3,
      baseRecord: { data: { titulo: 'Remote title' } },
    });
    const queue = persistentQueue([original]);
    local.mergeLocalOperationWithRemote.mockImplementation(async () => {
      queue.set([rebased]);
      return { merged: true, operation: rebased };
    });
    remote.applyRemoteOperation
      .mockResolvedValueOnce({
        acknowledged: false,
        conflict: { code: 'revision', remoteRevision: 2, remoteRecord: { revision: 2 } },
      })
      .mockResolvedValueOnce({
        acknowledged: true,
        receipt: receiptFor(rebased),
      });

    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    await worker.drainPendingOperations();

    expect(local.mergeLocalOperationWithRemote).toHaveBeenCalledWith(
      original.opId,
      expect.objectContaining({ remoteRevision: 2 }),
    );
    expect(local.ackLocalOperation).toHaveBeenCalledWith(
      original.opId,
      expect.objectContaining({ baseRevision: 2, revision: 3 }),
    );
    expect(local.markLocalOperationConflict).not.toHaveBeenCalled();
    expect(remote.applyRemoteOperation).toHaveBeenCalledTimes(2);
    expect(queue.get()).toEqual([]);
  });

  it('removes all old listeners and ignores late callbacks after a UID switch', async () => {
    local.getPendingOperations.mockResolvedValue([]);
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    const oldSubscription = subscribed;
    const oldHandler = document.addEventListener.mock.calls.find(
      ([event]) => event === 'stateSaved',
    )?.[1];

    await worker.startV1Sync({ uid: 'uid_other', generationId: 'gen_other' });
    if (oldHandler) oldHandler(new CustomEvent('stateSaved'));

    expect(oldSubscription.stop).toHaveBeenCalledOnce();
    expect(local.clearActiveV1Context).toHaveBeenCalled();
    expect(document.removeEventListener).toHaveBeenCalledWith('stateSaved', oldHandler);
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
  });

  it('does not send from a non-leader tab when an exclusive scan is already running', async () => {
    const first = operation();
    persistentQueue();
    remote.applyRemoteOperation.mockResolvedValue({
      acknowledged: true,
      receipt: receiptFor(first),
    });
    let releaseApply;
    const applyGate = new Promise((resolve) => { releaseApply = resolve; });
    remote.applyRemoteOperation.mockImplementation(async () => {
      await applyGate;
      return { acknowledged: true, receipt: receiptFor(first) };
    });
    let held = false;
    navigator.locks = {
      request: vi.fn(async (_name, options, callback) => {
        expect(options).toEqual({ ifAvailable: true });
        if (held) return callback(null);
        held = true;
        try {
          return await callback({ name: 'leader' });
        } finally {
          held = false;
        }
      }),
    };

    const leaderWorker = worker;
    const leaderLocal = local;
    const leaderRemote = remote;
    const leaderQueue = persistentQueue([first]);
    const leaderRun = leaderWorker.startV1Sync({ uid: UID, generationId: GENERATION });
    await flushWorkerPromises();

    await loadWorker();
    persistentQueue([operation({ opId: 'op_other', sequence: 2 })]);
    const followerRun = worker.startV1Sync({ uid: UID, generationId: GENERATION });
    await flushWorkerPromises();

    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
    releaseApply();
    await leaderRun;
    await followerRun;

    expect(leaderRemote.applyRemoteOperation).toHaveBeenCalledTimes(1);
    expect(leaderQueue.get()).toEqual([]);
    leaderWorker.stopV1Sync();
    expect(leaderLocal.ackLocalOperation).toHaveBeenCalledOnce();
  });

  it('wakes at the earliest persisted retry, continues a full batch and cancels on stop', async () => {
    const later = new Date(Date.now() + 5000).toISOString();
    const earlier = new Date(Date.now() + 2000).toISOString();
    const items = Array.from({ length: 28 }, (_, i) => operation({
      opId: `op_${i}`, entityKey: `evento:${i}`, sequence: i, nextAttemptAt: i ? earlier : later,
    }));
    persistentQueue(items);
    remote.applyRemoteOperation.mockImplementation(async item => ({ acknowledged: true, receipt: receiptFor(item) }));
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    await vi.advanceTimersByTimeAsync(1999);
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(remote.applyRemoteOperation).toHaveBeenCalledTimes(27);
    worker.stopV1Sync();
    await vi.advanceTimersByTimeAsync(10000);
    expect(remote.applyRemoteOperation).toHaveBeenCalledTimes(27);
  });

  it('retries a busy lease automatically', async () => {
    persistentQueue([operation()]);
    local.acquireV1WorkerLease.mockResolvedValueOnce(null);
    remote.applyRemoteOperation.mockResolvedValue({ acknowledged: true, receipt: receiptFor(operation()) });
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1200);
    expect(remote.applyRemoteOperation).toHaveBeenCalledOnce();
  });

  it('returns the exact empty result and never calls remote transport', async () => {
    local.getPendingOperations.mockResolvedValue([]);
    await worker.startV1Sync({ uid: UID, generationId: GENERATION });

    await expect(worker.drainPendingOperations()).resolves.toEqual({
      acked: 0,
      pending: 0,
      conflicts: 0,
    });
    expect(remote.applyRemoteOperation).not.toHaveBeenCalled();
  });
});
