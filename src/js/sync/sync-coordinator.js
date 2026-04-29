import { state } from '../store.js?v=8.29';
import {
  flushFirestoreOutbox,
  getFirestoreSyncStatus,
  queueFirestoreSnapshotFromState,
  syncFirestoreNow,
} from './firestore-sync-engine.js?v=8.29';
import { getPendingFirestoreSnapshot } from './firestore-outbox.js?v=8.29';
import { queueFirestoreEntityBatchFromState } from './firestore-entity-outbox.js?v=8.29';

const PRIMARY_SYNC_DEBOUNCE_MS = 1500;

let initialized = false;
let syncTimer = null;
let lastQueuedAt = null;
let lastReason = null;

function emitCoordinatorStatus(status, detail = {}) {
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

export function getSyncCoordinatorStatus() {
  const firestore = getFirestoreSyncStatus();
  return {
    primary: 'firebase',
    autoSyncEnabled: canUsePrimaryFirestore(firestore),
    timerActive: syncTimer !== null,
    lastQueuedAt,
    lastReason,
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
    flushPrimarySyncNow({ reason }).catch((err) => {
      emitCoordinatorStatus('error', { reason, error: err.message || String(err) });
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

  if (status.conflict) {
    emitCoordinatorStatus('conflict-paused', { reason, firestore: status });
    return false;
  }

  if (!canUsePrimaryFirestore(status)) {
    emitCoordinatorStatus('idle', { reason, firestore: status });
    return false;
  }

  emitCoordinatorStatus('syncing', { reason, firestore: status });

  if (manual) {
    const ok = force
      ? await flushFirestoreOutbox({ manual: true, forceOverwrite: true })
      : await syncFirestoreNow();
    if (!ok) await scheduleRetryIfNeeded(reason);
    return ok;
  }

  const queued = await queueFirestoreSnapshotFromState(state, { manual: false });
  if (!queued) {
    await scheduleRetryIfNeeded(reason);
    return false;
  }

  const entitySync = state.config?.entitySync || {};
  if (entitySync.enabled && entitySync.mode === 'primary') {
    await queueFirestoreEntityBatchFromState(state, { manual: false });
  }

  const ok = await flushFirestoreOutbox({ manual: false, forceOverwrite: force });
  if (!ok) await scheduleRetryIfNeeded(reason);
  return ok;
}

export function initSyncCoordinator() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('stateSaved', (event) => {
    if (event.detail?.skipFirestoreSync) return;
    schedulePrimarySync('local-save');
  });

  document.addEventListener('app:primarySyncRequested', (event) => {
    schedulePrimarySync(event.detail?.reason || 'requested');
  });

  document.addEventListener('app:firestoreSyncStatus', (event) => {
    const status = event.detail || {};
    if (['signed-in', 'enabled'].includes(status.status) && status.mode === 'primary') {
      schedulePrimarySync(status.status);
    }
  });
}
