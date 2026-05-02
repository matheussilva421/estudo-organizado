import { state } from '../store.js?v=8.32';
import {
  autoPullRemoteWhenNewer,
  flushFirestoreOutbox,
  getFirestoreSyncStatus,
  queueFirestoreSnapshotFromState,
  syncFirestoreNow,
} from './firestore-sync-engine.js?v=8.32';
import { getPendingFirestoreSnapshot } from './firestore-outbox.js?v=8.32';
import {
  canRetryEntityBatch,
  getPendingFirestoreEntityBatch,
  queueFirestoreEntityBatchFromState,
} from './firestore-entity-outbox.js?v=8.32';
import {
  appendSyncHealthEvent,
  appendSyncPerformanceMetric,
  deriveSyncHealthState,
} from './sync-health.js?v=8.32';
import { planNextSyncAction, ACTIONS } from './sync-planner.js?v=8.32';
import { yieldToUI } from './sync-yield.js?v=8.32';

const PRIMARY_SYNC_DEBOUNCE_MS = 1500;
const CIRCUIT_BREAKER_FAILURES = 3;

let initialized = false;
let syncTimer = null;
let lastQueuedAt = null;
let lastReason = null;
let failureCount = 0;

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
  if (!pending?.nextAttemptAt) return PRIMARY_SYNC_DEBOUNCE_MS;
  const delay = new Date(pending.nextAttemptAt).getTime() - Date.now();
  return Number.isFinite(delay) && delay > 0 ? delay : PRIMARY_SYNC_DEBOUNCE_MS;
}

function canUsePrimaryFirestore(status = getFirestoreSyncStatus()) {
  return Boolean(
    status.configured &&
    status.signedIn &&
    status.enabled &&
    status.mode === 'primary' &&
    !status.conflict
  );
}

async function scheduleRetryIfNeeded(reason) {
  const pending = await getPendingFirestoreSnapshot();
  if (!pending?.nextAttemptAt) return;
  const delay = toDelayFromPending(pending);
  schedulePrimarySync(reason, { delayMs: delay });
}

async function flushPrimarySyncWhenAllowed(reason) {
  const pendingSnapshot = await getPendingFirestoreSnapshot();
  if (pendingSnapshot?.nextAttemptAt) {
    const delay = toDelayFromPending(pendingSnapshot);
    if (delay > PRIMARY_SYNC_DEBOUNCE_MS) {
      return schedulePrimarySync(reason, { delayMs: delay });
    }
  }

  const pendingEntityBatch = await getPendingFirestoreEntityBatch();
  if (pendingEntityBatch && !canRetryEntityBatch(pendingEntityBatch)) {
    const delay = toDelayFromPending(pendingEntityBatch);
    return schedulePrimarySync(reason, { delayMs: delay });
  }

  return await flushPrimarySyncNow({ reason });
}

function isPrimaryEntitySyncEnabled() {
  const entitySync = state.config?.entitySync || {};
  return Boolean(entitySync.enabled && entitySync.mode === 'primary');
}

async function ensurePrimaryEntityBatchReady(reason) {
  if (!isPrimaryEntitySyncEnabled()) return true;
  const pendingEntityBatch = await getPendingFirestoreEntityBatch();
  if (pendingEntityBatch && !canRetryEntityBatch(pendingEntityBatch)) {
    emitCoordinatorStatus('queued', {
      reason,
      delayMs: toDelayFromPending(pendingEntityBatch),
      pending: pendingEntityBatch,
    });
    return false;
  }
  const start = performance.now();
  const queuedEntity = await queueFirestoreEntityBatchFromState(state, { manual: false });
  appendSyncPerformanceMetric(state, {
    name: 'entityBuildMs',
    durationMs: performance.now() - start,
  });
  return Boolean(queuedEntity);
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
  lastReason = reason;

  if (status.conflict) {
    emitCoordinatorStatus('conflict-paused', { reason, firestore: status });
    return false;
  }

  if (!canUsePrimaryFirestore(status)) {
    emitCoordinatorStatus('idle', { reason, firestore: status });
    return false;
  }

  if (syncTimer) clearTimeout(syncTimer);
  const delayMs = typeof options.delayMs === 'number' ? options.delayMs : PRIMARY_SYNC_DEBOUNCE_MS;
  lastQueuedAt = new Date().toISOString();
  emitCoordinatorStatus('queued', { reason, delayMs, firestore: status });
  document.dispatchEvent(
    new CustomEvent('app:primarySyncQueued', {
      detail: { reason, delayMs, queuedAt: lastQueuedAt },
    })
  );

  syncTimer = setTimeout(() => {
    syncTimer = null;
    flushPrimarySyncNow({ reason }).catch(() => {
      if (failureCount >= CIRCUIT_BREAKER_FAILURES) {
        emitCoordinatorStatus('degraded', { reason });
      }
    });
  }, delayMs);

  return true;
}

export async function flushPrimarySyncNow(options = {}) {
  const { manual = false, force = false, reason = manual ? 'manual' : 'auto' } = options;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  const status = getFirestoreSyncStatus();
  lastReason = reason;

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

  if (!plan.canRunNow) {
    const statusLabel =
      plan.action === ACTIONS.BLOCKED_CONFLICT
        ? 'conflict-paused'
        : plan.action === ACTIONS.OFFLINE
          ? 'offline'
          : 'idle';
    emitCoordinatorStatus(statusLabel, { reason, firestore: status, plan });
    return false;
  }

  emitCoordinatorStatus('syncing', { reason, firestore: status });

  if (manual) {
    const ok = force
      ? await flushFirestoreOutbox({ manual: true, forceOverwrite: true })
      : await syncFirestoreNow();
    failureCount = ok ? 0 : failureCount + 1;
    if (failureCount >= CIRCUIT_BREAKER_FAILURES) {
      emitCoordinatorStatus('degraded', { reason, firestore: status });
    }
    if (!ok) await scheduleRetryIfNeeded(reason);
    return ok;
  }

  if (plan.action === ACTIONS.CHECK_REMOTE_THEN_PULL) {
    const pulled = await autoPullRemoteWhenNewer();
    if (pulled) {
      failureCount = 0;
      return true;
    }
  }

  await yieldToUI();
  const entityReady = await ensurePrimaryEntityBatchReady(reason);
  if (!entityReady) {
    await scheduleRetryIfNeeded(reason);
    return false;
  }

  await yieldToUI();
  const queued = await queueFirestoreSnapshotFromState(state, { manual: false });
  if (!queued) {
    await scheduleRetryIfNeeded(reason);
    return false;
  }

  const firestoreWriteStart = performance.now();
  const ok = await flushFirestoreOutbox({ manual: false, forceOverwrite: force });
  appendSyncPerformanceMetric(state, {
    name: 'firestoreWriteMs',
    durationMs: performance.now() - firestoreWriteStart,
  });
  failureCount = ok ? 0 : failureCount + 1;
  if (failureCount >= CIRCUIT_BREAKER_FAILURES) {
    emitCoordinatorStatus('degraded', { reason, firestore: status });
  }
  if (!ok) await scheduleRetryIfNeeded(reason);
  return ok;
}

export function initSyncCoordinator() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('stateSaved', (event) => {
    if (event.detail?.skipFirestoreSync) return;
    if (event.detail?.metadataOnly || event.detail?.touchLocalBackup === false) return;
    schedulePrimarySync('local-save');
  });

  document.addEventListener('app:primarySyncRequested', (event) => {
    schedulePrimarySync(event.detail?.reason || 'requested');
  });

  window.addEventListener('online', () => {
    flushPrimarySyncWhenAllowed('reconnect').catch(() => {
      if (failureCount >= CIRCUIT_BREAKER_FAILURES) {
        emitCoordinatorStatus('degraded', { reason: 'reconnect' });
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushPrimarySyncWhenAllowed('foreground').catch(() => {
        if (failureCount >= CIRCUIT_BREAKER_FAILURES) {
          emitCoordinatorStatus('degraded', { reason: 'foreground' });
        }
      });
    }
  });

  document.addEventListener('app:firestoreSyncStatus', (event) => {
    const status = event.detail || {};
    if (['signed-in', 'enabled'].includes(status.status) && status.mode === 'primary') {
      schedulePrimarySync(status.status);
    }
  });
}
