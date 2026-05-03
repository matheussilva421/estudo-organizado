import { state } from '../store.js?v=8.37';
import {
  autoPullRemoteWhenNewer,
  flushFirestoreOutbox,
  getFirestoreSyncStatus,
  queueFirestoreSnapshotFromState,
  syncFirestoreNow,
} from './firestore-sync-engine.js?v=8.37';
import { getPendingFirestoreSnapshot } from './firestore-outbox.js?v=8.37';
import {
  appendSyncHealthEvent,
  appendSyncPerformanceMetric,
  deriveSyncHealthState,
} from './sync-health.js?v=8.37';
import { planNextSyncAction, ACTIONS } from './sync-planner.js?v=8.37';
import { yieldToUI } from './sync-yield.js?v=8.37';
import { primarySyncLock } from './sync-lock.js?v=8.37';

const AUTO_SYNC_DEBOUNCE_MS = 3000;
const CIRCUIT_BREAKER_DEGRADED = 3;
const CIRCUIT_BREAKER_OFFLINE = 5;

let initialized = false;
let syncTimer = null;
let lastQueuedAt = null;
let lastReason = null;
let failureCount = 0;

let _listeners = [];

function isBlockingConflict(conflict) {
  return conflict?.type === 'entity-conflict';
}

function addListener(target, event, handler) {
  target.addEventListener(event, handler);
  _listeners.push({ target, event, handler });
}

function teardownListeners() {
  for (const { target, event, handler } of _listeners) {
    target.removeEventListener(event, handler);
  }
  _listeners = [];
}

function emitCoordinatorStatus(status, detail = {}) {
  appendSyncHealthEvent(state, {
    type: status,
    reason: detail.reason,
    detail: detail.error || null,
  });
  document.dispatchEvent(
    new CustomEvent('app:primarySyncStatus', {
      detail: {
        status,
        lastQueuedAt,
        lastReason,
        ...detail,
      },
    })
  );
}

function toDelayFromPending(pending) {
  if (!pending?.nextAttemptAt) return AUTO_SYNC_DEBOUNCE_MS;
  const delay = new Date(pending.nextAttemptAt).getTime() - Date.now();
  return Number.isFinite(delay) && delay > 0 ? delay : AUTO_SYNC_DEBOUNCE_MS;
}

function canUsePrimaryFirestore(status = getFirestoreSyncStatus()) {
  return Boolean(
    status.configured &&
    status.signedIn &&
    status.enabled &&
    status.mode === 'primary' &&
    !isBlockingConflict(status.conflict)
  );
}

function updateCircuitBreaker(reason, firestoreStatus) {
  if (failureCount >= CIRCUIT_BREAKER_OFFLINE) {
    emitCoordinatorStatus('offline', { reason, firestore: firestoreStatus });
  } else if (failureCount >= CIRCUIT_BREAKER_DEGRADED) {
    emitCoordinatorStatus('degraded', { reason, firestore: firestoreStatus });
  }
}

async function scheduleRetryIfNeeded(reason) {
  const pending = await getPendingFirestoreSnapshot();
  if (!pending?.nextAttemptAt) return false;
  const delay = toDelayFromPending(pending);
  return schedulePrimarySync(reason, { delayMs: delay });
}

function emitTerminalFlushStatus(ok, reason) {
  if (ok) {
    emitCoordinatorStatus('synced', { reason, firestore: getFirestoreSyncStatus() });
    return;
  }

  const firestore = getFirestoreSyncStatus();
  emitCoordinatorStatus(firestore.conflict ? 'conflict-paused' : 'error', {
    reason,
    firestore,
    error: firestore.lastError || 'Primary sync failed',
  });
}

export async function flushPrimarySyncWhenAllowed(reason) {
  const pendingSnapshot = await getPendingFirestoreSnapshot();
  if (pendingSnapshot?.nextAttemptAt) {
    const delay = toDelayFromPending(pendingSnapshot);
    if (delay > AUTO_SYNC_DEBOUNCE_MS) {
      return schedulePrimarySync(reason, { delayMs: delay });
    }
  }

  return await flushPrimarySyncNow({ reason });
}

export function getSyncCoordinatorStatus() {
  const firestore = getFirestoreSyncStatus();
  const health = deriveSyncHealthState({
    firestore,
    failureCount,
    lastError: firestore.lastError,
    queued: syncTimer !== null,
    localSavedAt: state.config?.localBackupAt,
    remoteAckAt: firestore.lastPushAt || firestore.remoteUpdatedAt,
  });
  return {
    primary: 'firebase',
    autoSyncEnabled: canUsePrimaryFirestore(firestore),
    timerActive: syncTimer !== null,
    lastQueuedAt,
    lastReason,
    failureCount,
    health,
    firestore,
  };
}

export function schedulePrimarySync(reason = 'local-save', options = {}) {
  const status = getFirestoreSyncStatus();
  console.log('[SYNC-DEBUG] schedulePrimarySync called:', { reason, statusEnabled: status.enabled, statusMode: status.mode, statusSignedIn: status.signedIn, statusConflict: status.conflict?.type || null });
  lastReason = reason;

  if (isBlockingConflict(status.conflict)) {
    console.log('[SYNC-DEBUG] schedulePrimarySync: blocking conflict, returning false');
    emitCoordinatorStatus('conflict-paused', { reason, firestore: status });
    return false;
  }

  if (!canUsePrimaryFirestore(status)) {
    console.log('[SYNC-DEBUG] schedulePrimarySync: canUsePrimaryFirestore returned false, returning false');
    emitCoordinatorStatus('idle', { reason, firestore: status });
    return false;
  }

  if (syncTimer) clearTimeout(syncTimer);
  const delayMs = typeof options.delayMs === 'number' ? options.delayMs : AUTO_SYNC_DEBOUNCE_MS;
  lastQueuedAt = new Date().toISOString();
  console.log('[SYNC-DEBUG] schedulePrimarySync: scheduling flush in', delayMs, 'ms');
  emitCoordinatorStatus('queued', { reason, delayMs, firestore: status });
  document.dispatchEvent(
    new CustomEvent('app:primarySyncQueued', {
      detail: { reason, delayMs, queuedAt: lastQueuedAt },
    })
  );

  syncTimer = setTimeout(() => {
    console.log('[SYNC-DEBUG] schedulePrimarySync: timeout fired, calling flushPrimarySyncNow');
    syncTimer = null;
    flushPrimarySyncNow({ reason }).catch((err) => {
      console.error('[SYNC-DEBUG] schedulePrimarySync: flushPrimarySyncNow caught error:', err);
      if (failureCount >= CIRCUIT_BREAKER_DEGRADED) {
        updateCircuitBreaker(reason, status);
      }
    });
  }, delayMs);

  return true;
}

async function _executeFlush(options) {
  const { manual = false, force = false, reason = manual ? 'manual' : 'auto' } = options;
  console.log('[SYNC-DEBUG] _executeFlush called:', { manual, force, reason });
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  let status = getFirestoreSyncStatus();
  lastReason = reason;

  if (status.conflict) {
    const pending = await getPendingFirestoreSnapshot();
    if (!pending && status.conflict.type !== 'entity-conflict') {
      emitCoordinatorStatus('syncing', {
        reason,
        firestore: status,
        repair: 'stale-conflict',
      });
      const ok = await syncFirestoreNow();
      failureCount = ok ? 0 : failureCount + 1;
      updateCircuitBreaker(reason, status);
      const retryQueued = ok ? false : await scheduleRetryIfNeeded(reason);
      if (!retryQueued) emitTerminalFlushStatus(ok, reason);
      return ok;
    }
    if (status.conflict.type === 'entity-conflict') {
      emitCoordinatorStatus('conflict-paused', {
        reason,
        firestore: status,
      });
      return false;
    }
    if (reason === 'local-save' || reason === 'foreground') {
      emitCoordinatorStatus('syncing', {
        reason,
        firestore: status,
        repair: reason === 'foreground' ? 'snapshot-conflict-foreground' : 'snapshot-conflict-local-save',
      });
      const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
      if (!queued) {
        const retryQueued = await scheduleRetryIfNeeded(reason);
        if (!retryQueued) emitTerminalFlushStatus(false, reason);
        return false;
      }
      const firestoreWriteStart = performance.now();
      const ok = await flushFirestoreOutbox({ manual: false, forceOverwrite: true });
      appendSyncPerformanceMetric(state, {
        name: 'firestoreWriteMs',
        durationMs: performance.now() - firestoreWriteStart,
      });
      failureCount = ok ? 0 : failureCount + 1;
      updateCircuitBreaker(reason, status);
      const retryQueued = ok ? false : await scheduleRetryIfNeeded(reason);
      if (!retryQueued) emitTerminalFlushStatus(ok, reason);
      return ok;
    }
    status = getFirestoreSyncStatus();
  }

  const plannerStart = performance.now();
  const plan = planNextSyncAction({
    firestoreConfigured: status.configured,
    signedIn: status.signedIn,
    enabled: status.enabled,
    mode: status.mode,
    conflict: status.conflict,
    offline: !navigator.onLine,
    reason,
    backoffActive: false,
    pendingLocal: false,
  });
  appendSyncPerformanceMetric(state, {
    name: 'plannerMs',
    durationMs: performance.now() - plannerStart,
  });
  console.log('[SYNC-DEBUG] _executeFlush: plan result:', { canRunNow: plan.canRunNow, action: plan.action });

  if (!plan.canRunNow) {
    const statusLabel =
      plan.action === ACTIONS.BLOCKED_CONFLICT
        ? 'conflict-paused'
        : plan.action === ACTIONS.OFFLINE
          ? 'offline'
          : 'idle';
    console.log('[SYNC-DEBUG] _executeFlush: plan.canRunNow is false, returning false');
    emitCoordinatorStatus(statusLabel, { reason, firestore: status, plan });
    return false;
  }

  emitCoordinatorStatus('syncing', { reason, firestore: status });

  if (manual) {
    console.log('[SYNC-DEBUG] _executeFlush: manual=true, calling flushFirestoreOutbox or syncFirestoreNow');
    const ok = force
      ? await flushFirestoreOutbox({ manual: true, forceOverwrite: true })
      : await syncFirestoreNow();
    failureCount = ok ? 0 : failureCount + 1;
    updateCircuitBreaker(reason, status);
    const retryQueued = ok ? false : await scheduleRetryIfNeeded(reason);
    if (!retryQueued) emitTerminalFlushStatus(ok, reason);
    return ok;
  }

  if (plan.action === ACTIONS.CHECK_REMOTE_THEN_PULL) {
    console.log('[SYNC-DEBUG] _executeFlush: CHECK_REMOTE_THEN_PULL, calling autoPullRemoteWhenNewer');
    const pulled = await autoPullRemoteWhenNewer();
    if (pulled) {
      failureCount = 0;
      emitTerminalFlushStatus(true, reason);
      return true;
    }
  }

  await yieldToUI();
  console.log('[SYNC-DEBUG] _executeFlush: calling queueFirestoreSnapshotFromState');
  const queued = await queueFirestoreSnapshotFromState(state, { manual: false });
  console.log('[SYNC-DEBUG] _executeFlush: queueFirestoreSnapshotFromState result:', queued);
  if (!queued) {
    const retryQueued = await scheduleRetryIfNeeded(reason);
    if (!retryQueued) emitTerminalFlushStatus(false, reason);
    return false;
  }

  const firestoreWriteStart = performance.now();
  console.log('[SYNC-DEBUG] _executeFlush: calling flushFirestoreOutbox, forceOverwrite:', force || reason === 'local-save');
  const ok = await flushFirestoreOutbox({
    manual: false,
    forceOverwrite: force || reason === 'local-save',
  });
  console.log('[SYNC-DEBUG] _executeFlush: flushFirestoreOutbox result:', ok);
  appendSyncPerformanceMetric(state, {
    name: 'firestoreWriteMs',
    durationMs: performance.now() - firestoreWriteStart,
  });
  failureCount = ok ? 0 : failureCount + 1;
  updateCircuitBreaker(reason, status);
  const retryQueued = ok ? false : await scheduleRetryIfNeeded(reason);
  if (!retryQueued) emitTerminalFlushStatus(ok, reason);
  return ok;
}

export async function flushPrimarySyncNow(options = {}) {
  return primarySyncLock.withLock(() => _executeFlush(options));
}

export function initSyncCoordinator() {
  if (initialized) return;
  initialized = true;

  addListener(document, 'stateSaved', (event) => {
    console.log('[SYNC-DEBUG] stateSaved event received:', event.detail);
    if (event.detail?.skipFirestoreSync) {
      console.log('[SYNC-DEBUG] stateSaved: skipFirestoreSync is true, ignoring');
      return;
    }
    if (event.detail?.metadataOnly || event.detail?.touchLocalBackup === false) {
      console.log('[SYNC-DEBUG] stateSaved: metadataOnly or touchLocalBackup=false, ignoring');
      return;
    }
    console.log('[SYNC-DEBUG] stateSaved: calling schedulePrimarySync');
    schedulePrimarySync('local-save');
  });

  addListener(document, 'app:primarySyncRequested', (event) => {
    schedulePrimarySync(event.detail?.reason || 'requested');
  });

  addListener(window, 'online', () => {
    flushPrimarySyncWhenAllowed('reconnect').catch(() => {
      if (failureCount >= CIRCUIT_BREAKER_DEGRADED) {
        updateCircuitBreaker('reconnect', getFirestoreSyncStatus());
      }
    });
  });

  addListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushPrimarySyncWhenAllowed('foreground').catch(() => {
        if (failureCount >= CIRCUIT_BREAKER_DEGRADED) {
          updateCircuitBreaker('foreground', getFirestoreSyncStatus());
        }
      });
    }
  });


}

export { teardownListeners as teardownSyncCoordinator };
