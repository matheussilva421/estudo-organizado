import {
  ackLocalOperation,
  acquireV1WorkerLease,
  claimLocalOperation,
  clearActiveV1Context,
  getActiveV1Context,
  getPendingOperations,
  markLocalOperationConflict,
  markLocalOperationRetry,
  mergeLocalOperationWithRemote,
  readLocalGeneration,
  releaseV1WorkerLease,
  renewV1WorkerLease,
  setActiveV1Context,
} from './local.js';
import { applyRemoteOperation, subscribeGeneration } from './remote.js';
import {
  isV1AuthFailure,
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
  if (!entry || entry !== runtime || entry.stopping || entry.authPaused) return false;
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

async function retryOperation(operation, reason) {
  const attempts = (Number(operation.attempts) || 0) + 1;
  const nextAttemptAt = new Date(Date.now() + retryDelay(attempts)).toISOString();
  await markLocalOperationRetry(operation.opId, {
    reason,
    nextAttemptAt,
    attempts,
  });

}

async function conflictOperation(entry, operation, conflict) {
  let merged = null;
  try {
    merged = await mergeLocalOperationWithRemote(operation.opId, conflict);
  } catch {
    merged = { merged: false };
  }
  if (merged?.merged === true) {
    emitStatus(entry, 'syncing', {
      reason: 'independent-fields-merged',
      entityId: operation.entityId,
      entityType: operation.entityType,
      revision: merged.operation?.revision,
    });
    return true;
  }
  await markLocalOperationConflict(operation.opId, conflict);
  emitStatus(entry, 'conflict-paused', {
    reason: conflict.code || 'conflict',
    entityId: operation.entityId,
    entityType: operation.entityType,
  });
  return false;
}

async function refreshFromCachedState(entry) {
  if (!isActive(entry)) return;
  try {
    const cached = await readLocalGeneration(entry.uid, entry.generationId);
    if (!isActive(entry) || !cached?.state) return;
    const { noteV1ChangeBaseline, setState, state } = await import('../../store.js?v=8.37');
    if (!isActive(entry)) return;
    setState(cached.state);
    noteV1ChangeBaseline(state);
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

function pauseForAuth(entry, reason) {
  entry.authPaused = true;
  entry.listenerGeneration += 1;
  clearTimer(entry, 'debounceTimer');
  clearTimer(entry, 'retryTimer');
  clearTimer(entry, 'listenerTimer');
  entry.unsubscribe?.();
  entry.unsubscribe = null;
  emitStatus(entry, 'auth-required', { reason });
}

function subscribeEntry(entry) {
  const generation = ++entry.listenerGeneration;
  return entry.remoteApi.subscribeGeneration(entry.uid, entry.generationId, {
    onDelta: (delta) => {
      if (runtime === entry && entry.listenerGeneration === generation) {
        return handleDelta(entry, delta);
      }
    },
    onError: (error) => {
      if (runtime === entry && entry.listenerGeneration === generation) {
        handleListenerError(entry, error);
      }
    },
  });
}

export function suspendV1SyncForAuth(reason) {
  if (isActive(runtime)) pauseForAuth(runtime, reason);
}

export function resumeV1SyncForUser(uid) {
  const entry = runtime;
  if (!entry || entry.uid !== uid || !entry.authPaused || entry.stopping) return;
  const active = getActiveV1Context();
  if (active?.uid !== uid || active.generationId !== entry.generationId) return;

  entry.authPaused = false;
  entry.reason = 'auth-resumed';
  try {
    entry.unsubscribe?.();
    entry.unsubscribe = subscribeEntry(entry);
    entry.initialDrain = triggerDrain(entry, 'auth-resumed');
    return entry.initialDrain;
  } catch (error) {
    if (isV1AuthFailure(error?.code)) {
      pauseForAuth(entry, error.code);
      return;
    }
    emitStatus(entry, 'error', {
      reason: error?.code || 'V1_WORKER_RESUME_FAILED',
      error: error?.message || null,
    });
    throw error;
  }
}

function handleListenerError(entry, error) {
  if (!isActive(entry)) return;
  if (isV1AuthFailure(error?.code)) {
    pauseForAuth(entry, error.code);
    return;
  }
  emitStatus(entry, 'error', {
    reason: error?.code || 'V1_REMOTE_LISTENER_ERROR',
    error: error?.message || 'Falha no listener remoto.',
  });
  clearTimer(entry, 'listenerTimer');
  entry.listenerTimer = setTimeout(() => {
    entry.listenerTimer = null;
    if (isActive(entry)) void restartSubscription(entry);
  }, RETRY_BASE_MS);
}

async function restartSubscription(entry) {
  if (!isActive(entry)) return;
  entry.unsubscribe?.();
  entry.unsubscribe = null;
  try {
    entry.unsubscribe = subscribeEntry(entry);
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
  entry.heartbeat = heartbeat;
  try {
    return isActive(entry) ? await work(() => leaseLost) : emptyResult();
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
  let stopReason = null;
  const heads = await getPendingOperations(entry.uid, entry.generationId);
  const due = heads.filter(op => !(Date.parse(op.nextAttemptAt) > Date.now()));
  for (const candidate of due.slice(0, BATCH_LIMIT)) {
    if (!isActive(entry) || leaseLost()) break;
    const operation = await claimLocalOperation(candidate);
    if (!operation || !isActive(entry) || leaseLost()) continue;

    let outcome;
    try {
      outcome = await entry.remoteApi.applyRemoteOperation(operation);
    } catch (error) {
      if (!isActive(entry) || leaseLost()) return summary;
      if (CONFLICT_CODES.has(error?.code)) {
        const merged = await conflictOperation(entry, operation, conflictFrom(error));
        if (!merged) summary.conflicts += 1;
        continue;
      }
      if (isV1AuthFailure(error?.code)) {
        pauseForAuth(entry, error.code);
        await markLocalOperationRetry(operation.opId, { reason: error.code, nextAttemptAt: null });
        return { ...summary, pending: (await getPendingOperations(entry.uid, entry.generationId)).length };
      }
      await retryOperation(operation, error?.code || error?.message || 'remote-error');
      stopReason = error?.code || 'V1_REMOTE_TRANSIENT';
      emitStatus(entry, 'backoff', {
        reason: stopReason,
        error: error?.message || null,
      });
      if (STOPPING_CODES.has(error?.code)) break;
      continue;
    }

    if (!isActive(entry) || leaseLost()) return summary;
    if (outcome?.conflict) {
      const merged = await conflictOperation(entry, operation, outcome.conflict);
      if (!merged) summary.conflicts += 1;
      continue;
    }
    if (outcome?.acknowledged !== true || !outcome.receipt) {
      await retryOperation(operation, 'V1_REMOTE_ACK_MISSING');
      stopReason = 'V1_REMOTE_ACK_MISSING';
      emitStatus(entry, 'backoff', { reason: stopReason });
      continue;
    }
    try {
      await ackLocalOperation(operation.opId, outcome.receipt);
      summary.acked += 1;
    } catch (error) {
      if (!isActive(entry) || leaseLost()) return summary;
      await retryOperation(operation, error?.message || 'ACK_FAILED');
      stopReason = 'V1_LOCAL_ACK_FAILED';
      emitStatus(entry, 'backoff', { reason: stopReason });
    }
  }

  const remaining = await getPendingOperations(entry.uid, entry.generationId);
  summary.pending = remaining.length;
  if (remaining.length) {
    const earliest = Math.min(...remaining.map(op => Date.parse(op.nextAttemptAt) || Date.now()));
    scheduleRetry(entry, Math.max(Date.now() + EVENT_DEBOUNCE_MS, earliest));
  }
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

  const earliest = initial.reduce((time, op) => Math.min(time,
    Date.parse(op.nextAttemptAt) || 0), Infinity);
  if (earliest > Date.now()) {
    scheduleRetry(entry, earliest);
    emitStatus(entry, 'backoff', { reason: 'V1_RETRY_SCHEDULED', pending: initial.length });
    return { ...emptyResult(), pending: initial.length };
  }

  emitStatus(entry, 'syncing', { reason: entry.reason });
  const validated = await revalidateV1Generation({
    uid: entry.uid,
    online: true,
    ...(entry.remoteApi === DEFAULT_REMOTE_API ? {} : { remoteApi: entry.remoteApi }),
  });
  if (!isActive(entry)) return emptyResult();
  if (isV1AuthFailure(validated.reason)) {
    pauseForAuth(entry, validated.reason);
    return { ...emptyResult(), pending: initial.length };
  }
  if (validated.status === 'requires-network') {
    scheduleRetry(entry, Date.now() + RETRY_BASE_MS);
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
  scheduleRetry(entry, Date.now() + RETRY_BASE_MS);
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
export async function startV1Sync({ uid, generationId, remoteApi, authFailure } = {}) {
  const key = contextKey(uid, generationId);
  if (runtime?.key === key && !runtime.stopping) {
    if (!runtime.authPaused) return runtime.initialDrain || Promise.resolve();
    if (!isV1AuthFailure(authFailure)) return resumeV1SyncForUser(uid);
  }
  stopV1Sync();

  const entry = {
    key,
    uid,
    generationId,
    ownerId: ownerId(),
    stopping: false,
    unsubscribe: null,
    listenerGeneration: 0,
    debounceTimer: null,
    retryTimer: null,
    listenerTimer: null,
    heartbeat: null,
    authPaused: false,
    reason: 'start',
    initialDrain: null,
    remoteApi: remoteApi || DEFAULT_REMOTE_API,
  };
  const startEpoch = ++epoch;
  runtime = entry;
  setActiveV1Context(uid, generationId);
  attachListeners(entry);
  if (isV1AuthFailure(authFailure)) {
    pauseForAuth(entry, authFailure);
    return;
  }

  try {
    entry.unsubscribe = subscribeEntry(entry);
    if (startEpoch !== epoch || !isActive(entry)) {
      entry.unsubscribe?.();
      throw new Error('V1 worker context changed during start');
    }
    entry.initialDrain = triggerDrain(entry, 'start');
    await entry.initialDrain;
  } catch (error) {
    if (runtime === entry && isV1AuthFailure(error?.code)) {
      pauseForAuth(entry, error.code);
      return;
    }
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
  entry.listenerGeneration += 1;
  clearTimer(entry, 'listenerTimer');
  clearInterval(entry.heartbeat);
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
