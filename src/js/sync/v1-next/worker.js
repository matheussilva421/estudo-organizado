import {
  ackLocalOperation,
  acquireV1WorkerLease,
  clearActiveV1Context,
  getActiveV1Context,
  getPendingOperations,
  markLocalOperationConflict,
  markLocalOperationRetry,
  readLocalGeneration,
  releaseV1WorkerLease,
  renewV1WorkerLease,
  setActiveV1Context,
} from './local.js';
import { applyRemoteOperation, subscribeGeneration } from './remote.js';
import {
  reconcileRemoteDelta,
  revalidateV1Generation,
} from './bootstrap.js';

const BATCH_LIMIT = 25;
const EVENT_DEBOUNCE_MS = 75;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 5 * 60_000;
const LEASE_TTL_MS = 30_000;
const STOPPING_CODES = new Set([
  'V1_REMOTE_AUTH_REQUIRED',
  'V1_REMOTE_UID_MISMATCH',
  'V1_REMOTE_PERMISSION_DENIED',
  'V1_REMOTE_GENERATION_INVALID',
  'V1_REMOTE_GENERATION_INACTIVE',
  'V1_REMOTE_OFFLINE',
  'V1_REMOTE_UNAVAILABLE',
  'V1_REMOTE_TIMEOUT',
]);
const CONFLICT_CODES = new Set([
  'V1_REMOTE_INVALID_OPERATION',
  'V1_REMOTE_OP_CONFLICT',
]);
const DEFAULT_REMOTE_API = Object.freeze({
  applyRemoteOperation,
  subscribeGeneration,
});

let runtime = null;
let epoch = 0;
let inFlight = null;

function emptyResult() {
  return { acked: 0, pending: 0, conflicts: 0 };
}

function contextKey(uid, generationId) {
  return JSON.stringify([uid, generationId]);
}

function ownerId() {
  const random = globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `v1_worker_${random.replaceAll('-', '').slice(0, 40)}`;
}

function isOnline() {
  return globalThis.navigator?.onLine !== false;
}

function isActive(entry = runtime) {
  if (!entry || entry !== runtime || entry.stopping) return false;
  const active = getActiveV1Context();
  return active?.uid === entry.uid && active.generationId === entry.generationId;
}

function emitStatus(entry, status, detail = {}) {
  if (!entry || entry !== runtime || typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('app:primarySyncStatus', {
    detail: {
      mode: 'v1',
      status,
      uid: entry.uid,
      generationId: entry.generationId,
      ...detail,
    },
  }));
}

function clearTimer(entry, field) {
  if (entry?.[field] === null || entry?.[field] === undefined) return;
  clearTimeout(entry[field]);
  entry[field] = null;
}

function retryDelay(attempts) {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)));
}

function scheduleRetry(entry, retryAt) {
  if (!isActive(entry) || !Number.isFinite(retryAt)) return;
  const delay = Math.max(0, Math.min(RETRY_MAX_MS, retryAt - Date.now()));
  clearTimer(entry, 'retryTimer');
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (isActive(entry)) fireDrain(entry, 'retry');
  }, delay);
}

function fireDrain(entry, reason) {
  void triggerDrain(entry, reason).catch((error) => {
    emitStatus(entry, 'error', {
      reason: error?.code || 'V1_SYNC_FAILED',
      error: error?.message || null,
    });
  });
}

async function pendingCount(entry) {
  if (!isActive(entry)) return 0;
  try {
    return (await getPendingOperations(entry.uid, entry.generationId)).length;
  } catch {
    return 0;
  }
}

function conflictFrom(error, outcome) {
  if (outcome?.conflict) return outcome.conflict;
  return {
    code: error?.code || 'invalid-operation',
    remoteRevision: null,
    remoteDeleted: false,
    remoteRecord: null,
  };
}

async function retryOperation(entry, operation, reason) {
  const attempts = (Number(operation.attempts) || 0) + 1;
  const nextAttemptAt = new Date(Date.now() + retryDelay(attempts)).toISOString();
  await markLocalOperationRetry(operation.opId, {
    reason,
    nextAttemptAt,
    attempts,
  });
  scheduleRetry(entry, Date.parse(nextAttemptAt));
}

async function conflictOperation(entry, operation, conflict) {
  await markLocalOperationConflict(operation.opId, conflict);
  emitStatus(entry, 'conflict-paused', {
    reason: conflict.code || 'conflict',
    entityId: operation.entityId,
    entityType: operation.entityType,
  });
}

async function refreshFromCachedState(entry) {
  if (!isActive(entry)) return;
  try {
    const cached = await readLocalGeneration(entry.uid, entry.generationId);
    if (!isActive(entry) || !cached?.state) return;
    const { setState } = await import('../../store.js?v=8.37');
    if (!isActive(entry)) return;
    setState(cached.state);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('app:renderCurrentView'));
    }
  } catch {
    emitStatus(entry, 'degraded', { reason: 'V1_LOCAL_REFRESH_FAILED' });
  }
}

async function handleDelta(entry, delta) {
  if (!isActive(entry)) return;
  await reconcileRemoteDelta(delta, {
    uid: entry.uid,
    generationId: entry.generationId,
  });
  await refreshFromCachedState(entry);
}

function handleListenerError(entry, error) {
  if (!isActive(entry)) return;
  emitStatus(entry, 'error', {
    reason: error?.code || 'V1_REMOTE_LISTENER_ERROR',
    error: error?.message || 'Falha no listener remoto.',
  });
  clearTimer(entry, 'retryTimer');
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (isActive(entry)) void restartSubscription(entry);
  }, RETRY_BASE_MS);
}

async function restartSubscription(entry) {
  if (!isActive(entry)) return;
  entry.unsubscribe?.();
  entry.unsubscribe = null;
  try {
    entry.unsubscribe = entry.remoteApi.subscribeGeneration(entry.uid, entry.generationId, {
      onDelta: (delta) => handleDelta(entry, delta),
      onError: (error) => handleListenerError(entry, error),
    });
    await triggerDrain(entry, 'listener-recovery');
  } catch (error) {
    handleListenerError(entry, error);
  }
}

async function runWithWebLock(entry, work) {
  const locks = globalThis.navigator?.locks;
  if (typeof locks?.request !== 'function') return { supported: false };
  let acquired = false;
  let result = emptyResult();
  await locks.request(
    `estudo-v1-sync:${contextKey(entry.uid, entry.generationId)}`,
    { ifAvailable: true },
    async (lock) => {
      if (!lock || !isActive(entry)) return;
      acquired = true;
      result = await work();
    },
  );
  return { supported: true, acquired, result };
}

async function runWithIdbLease(entry, work) {
  const lease = await acquireV1WorkerLease({
    uid: entry.uid,
    generationId: entry.generationId,
    ownerId: entry.ownerId,
    ttlMs: LEASE_TTL_MS,
  });
  if (!lease) return null;
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    renewV1WorkerLease({
      uid: entry.uid,
      generationId: entry.generationId,
      ownerId: entry.ownerId,
      token: lease.token,
      ttlMs: LEASE_TTL_MS,
    }).then((owned) => {
      if (!owned) leaseLost = true;
    }).catch(() => { leaseLost = true; });
  }, Math.floor(LEASE_TTL_MS / 3));
  try {
    return await work(() => leaseLost);
  } finally {
    clearInterval(heartbeat);
    await releaseV1WorkerLease({
      uid: entry.uid,
      generationId: entry.generationId,
      ownerId: entry.ownerId,
      token: lease.token,
    }).catch(() => {});
  }
}

async function withExclusiveScan(entry, work) {
  const webLock = await runWithWebLock(entry, work);
  if (webLock.supported) return webLock.acquired ? webLock.result : null;
  return runWithIdbLease(entry, work);
}

async function drainUnderLease(entry, leaseLost) {
  const summary = emptyResult();
  let processed = 0;
  let stopReason = null;

  while (processed < BATCH_LIMIT && isActive(entry) && !leaseLost()) {
    const operations = await getPendingOperations(entry.uid, entry.generationId);
    const operation = operations.find((candidate) => {
      if (!candidate.nextAttemptAt) return true;
      return Date.parse(candidate.nextAttemptAt) <= Date.now();
    });
    if (!operation) break;
    processed += 1;

    let outcome;
    try {
      outcome = await entry.remoteApi.applyRemoteOperation(operation);
    } catch (error) {
      if (!isActive(entry) || leaseLost()) return summary;
      if (CONFLICT_CODES.has(error?.code)) {
        await conflictOperation(entry, operation, conflictFrom(error));
        summary.conflicts += 1;
        continue;
      }
      await retryOperation(entry, operation, error?.code || error?.message || 'remote-error');
      stopReason = error?.code || 'V1_REMOTE_TRANSIENT';
      emitStatus(entry, error?.code === 'V1_REMOTE_AUTH_REQUIRED' ||
        error?.code === 'V1_REMOTE_UID_MISMATCH' ? 'auth-required' : 'backoff', {
        reason: stopReason,
        error: error?.message || null,
      });
      if (STOPPING_CODES.has(error?.code)) break;
      continue;
    }

    if (!isActive(entry) || leaseLost()) return summary;
    if (outcome?.conflict) {
      await conflictOperation(entry, operation, outcome.conflict);
      summary.conflicts += 1;
      continue;
    }
    if (outcome?.acknowledged !== true || !outcome.receipt) {
      await retryOperation(entry, operation, 'V1_REMOTE_ACK_MISSING');
      stopReason = 'V1_REMOTE_ACK_MISSING';
      emitStatus(entry, 'backoff', { reason: stopReason });
      continue;
    }
    try {
      await ackLocalOperation(operation.opId, outcome.receipt);
      summary.acked += 1;
    } catch (error) {
      if (!isActive(entry) || leaseLost()) return summary;
      await retryOperation(entry, operation, error?.message || 'ACK_FAILED');
      stopReason = 'V1_LOCAL_ACK_FAILED';
      emitStatus(entry, 'backoff', { reason: stopReason });
    }
  }

  summary.pending = await pendingCount(entry);
  if (isActive(entry)) {
    if (summary.conflicts > 0) {
      emitStatus(entry, 'conflict-paused', {
        reason: 'V1_ENTITY_CONFLICT',
        pending: summary.pending,
        conflicts: summary.conflicts,
      });
    } else if (summary.pending > 0) {
      emitStatus(entry, 'backoff', {
        reason: stopReason || 'V1_RETRY_SCHEDULED',
        pending: summary.pending,
      });
    } else {
      emitStatus(entry, 'synced', {
        acked: summary.acked,
        pending: 0,
        conflicts: 0,
      });
    }
  }
  return summary;
}

async function drainOnce(entry) {
  if (!isActive(entry)) return emptyResult();
  if (!isOnline()) {
    emitStatus(entry, 'offline', { reason: 'offline' });
    return { ...emptyResult(), pending: await pendingCount(entry) };
  }
  const initial = await getPendingOperations(entry.uid, entry.generationId);
  if (initial.length === 0) {
    emitStatus(entry, 'synced', { acked: 0, pending: 0, conflicts: 0 });
    return emptyResult();
  }

  emitStatus(entry, 'syncing', { reason: entry.reason });
  const validated = await revalidateV1Generation({
    uid: entry.uid,
    online: true,
    ...(entry.remoteApi === DEFAULT_REMOTE_API ? {} : { remoteApi: entry.remoteApi }),
  });
  if (!isActive(entry)) return emptyResult();
  if (validated.status === 'requires-network') {
    emitStatus(entry, 'offline', { reason: validated.reason || 'offline' });
    return { ...emptyResult(), pending: await pendingCount(entry) };
  }
  if (validated.status !== 'ready') {
    emitStatus(entry, 'blocked', {
      reason: validated.reason || 'V1_GENERATION_BLOCKED',
    });
    return { ...emptyResult(), pending: await pendingCount(entry) };
  }

  const locked = await withExclusiveScan(entry, (leaseLost = () => false) =>
    drainUnderLease(entry, leaseLost));
  if (locked !== null) return locked;
  emitStatus(entry, 'queued', { reason: 'other-tab' });
  return { ...emptyResult(), pending: await pendingCount(entry) };
}

function triggerDrain(entry, reason = 'local-save') {
  if (!isActive(entry)) return Promise.resolve(emptyResult());
  clearTimer(entry, 'debounceTimer');
  entry.reason = reason;
  if (inFlight?.entry === entry) {
    inFlight.rerun = true;
    return inFlight.promise;
  }

  const flight = { entry, promise: null, rerun: false };
  flight.promise = drainOnce(entry).finally(() => {
    if (inFlight === flight) inFlight = null;
    if (flight.rerun && isActive(entry)) fireDrain(entry, reason);
  });
  inFlight = flight;
  return flight.promise;
}

function queueDrain(entry, reason) {
  if (!isActive(entry)) return;
  if (entry.debounceTimer !== null) return;
  entry.reason = reason;
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    if (isActive(entry)) fireDrain(entry, reason);
  }, EVENT_DEBOUNCE_MS);
  emitStatus(entry, 'queued', { reason });
}

function attachListeners(entry) {
  entry.onStateSaved = () => queueDrain(entry, 'stateSaved');
  entry.onOnline = () => fireDrain(entry, 'online');
  entry.onFocus = () => fireDrain(entry, 'focus');
  entry.onVisibility = () => {
    if (document.visibilityState === 'visible') fireDrain(entry, 'visible');
  };
  document.addEventListener('stateSaved', entry.onStateSaved);
  window.addEventListener('online', entry.onOnline);
  window.addEventListener('focus', entry.onFocus);
  document.addEventListener('visibilitychange', entry.onVisibility);
}

function detachListeners(entry) {
  document.removeEventListener('stateSaved', entry.onStateSaved);
  window.removeEventListener('online', entry.onOnline);
  window.removeEventListener('focus', entry.onFocus);
  document.removeEventListener('visibilitychange', entry.onVisibility);
}

/** Start one worker for the active UID/generation. Repeated calls are idempotent. */
export async function startV1Sync({ uid, generationId, remoteApi } = {}) {
  const key = contextKey(uid, generationId);
  if (runtime?.key === key && !runtime.stopping) {
    return runtime.initialDrain || Promise.resolve();
  }
  stopV1Sync();

  const entry = {
    key,
    uid,
    generationId,
    ownerId: ownerId(),
    stopping: false,
    unsubscribe: null,
    debounceTimer: null,
    retryTimer: null,
    reason: 'start',
    initialDrain: null,
    remoteApi: remoteApi || DEFAULT_REMOTE_API,
  };
  const startEpoch = ++epoch;
  runtime = entry;
  setActiveV1Context(uid, generationId);
  attachListeners(entry);

  try {
    entry.unsubscribe = entry.remoteApi.subscribeGeneration(uid, generationId, {
      onDelta: (delta) => handleDelta(entry, delta),
      onError: (error) => handleListenerError(entry, error),
    });
    if (startEpoch !== epoch || !isActive(entry)) {
      entry.unsubscribe?.();
      throw new Error('V1 worker context changed during start');
    }
    entry.initialDrain = triggerDrain(entry, 'start');
    await entry.initialDrain;
  } catch (error) {
    if (runtime === entry && startEpoch === epoch) {
      emitStatus(entry, 'error', {
        reason: error?.code || 'V1_WORKER_START_FAILED',
        error: error?.message || null,
      });
      stopV1Sync();
    }
    throw error;
  }
}

/** Remove the current generation listener and all pending callbacks/timers. */
export function stopV1Sync() {
  const entry = runtime;
  if (!entry) {
    clearActiveV1Context();
    return;
  }
  epoch += 1;
  entry.stopping = true;
  runtime = null;
  clearTimer(entry, 'debounceTimer');
  clearTimer(entry, 'retryTimer');
  try {
    entry.unsubscribe?.();
  } catch {
    // Local cleanup still proceeds if a transport unsubscribe fails.
  }
  entry.unsubscribe = null;
  detachListeners(entry);
  const active = getActiveV1Context();
  if (active?.uid === entry.uid && active.generationId === entry.generationId) {
    clearActiveV1Context();
  }
}

/** Drain the current outbox once. Concurrent callers share the same flight. */
export async function drainPendingOperations() {
  const entry = runtime;
  if (!isActive(entry)) return emptyResult();
  return triggerDrain(entry, 'manual');
}
