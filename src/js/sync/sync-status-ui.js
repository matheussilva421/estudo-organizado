/* global cancelAnimationFrame */
/**
 * Sync Status UI Component
 * Lightweight DOM updater for sync state — no full page re-renders.
 *
 * Listens to:
 *   - app:primarySyncStatus  (from sync-coordinator)
 *   - app:firestoreSyncStatus (from firestore-sync-engine)
 *
 * Renders status text + icon into #sync-status container.
 * Uses requestAnimationFrame for batched DOM updates.
 */

const STATUS_CONFIG = {
  idle: { icon: 'fa-circle', text: 'Aguardando sync', cssClass: '' },
  syncing: { icon: 'fa-spinner fa-spin', text: 'Sincronizando…', cssClass: 'sync-status--syncing' },
  synced: { icon: 'fa-check-circle', text: 'Sincronizado', cssClass: 'sync-status--synced' },
  error: { icon: 'fa-exclamation-circle', text: 'Erro no sync', cssClass: 'sync-status--error' },
  offline: { icon: 'fa-wifi fa-offline-icon', text: 'Offline', cssClass: 'sync-status--offline' },
  degraded: { icon: 'fa-exclamation-triangle', text: 'Sync degradado', cssClass: 'sync-status--degraded' },
};

// Map firestore-sync-engine statuses to canonical states
const FIRESTORE_STATUS_MAP = {
  unconfigured: 'idle',
  'signed-in': 'idle',
  'signed-out': 'offline',
  redirecting: 'syncing',
  enabled: 'idle',
  backoff: 'degraded',
  pending: 'syncing',
  conflict: 'error',
  'conflict-paused': 'error',
  syncing: 'syncing',
  synced: 'synced',
  error: 'error',
};

// Map sync-coordinator statuses to canonical states
const COORDINATOR_STATUS_MAP = {
  idle: 'idle',
  queued: 'syncing',
  syncing: 'syncing',
  synced: 'synced',
  error: 'error',
  offline: 'offline',
  degraded: 'degraded',
  'conflict-paused': 'error',
};

let container = null;
let rafId = null;
let pendingStatus = null;
let listeners = [];

function mapToCanonicalStatus(source, rawStatus) {
  const map = source === 'coordinator' ? COORDINATOR_STATUS_MAP : FIRESTORE_STATUS_MAP;
  return map[rawStatus] || 'idle';
}

function renderStatus(statusKey) {
  if (!container) return;
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.idle;
  container.className = `sync-status ${config.cssClass}`;
  container.innerHTML = `<i class="fa ${config.icon}"></i> ${config.text}`;
}

function scheduleRender(statusKey) {
  pendingStatus = statusKey;
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    if (pendingStatus !== null) {
      renderStatus(pendingStatus);
      pendingStatus = null;
    }
  });
}

function handlePrimarySyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  scheduleRender(mapToCanonicalStatus('coordinator', raw));
}

function handleFirestoreSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  scheduleRender(mapToCanonicalStatus('firestore', raw));
}

export function initSyncStatusUI() {
  if (container) return; // already initialized
  container = document.getElementById('sync-status');
  if (!container) return;

  document.addEventListener('app:primarySyncStatus', handlePrimarySyncStatus);
  document.addEventListener('app:firestoreSyncStatus', handleFirestoreSyncStatus);
  listeners = [
    { event: 'app:primarySyncStatus', handler: handlePrimarySyncStatus },
    { event: 'app:firestoreSyncStatus', handler: handleFirestoreSyncStatus },
  ];

  // Initial state
  scheduleRender('idle');
}

export function destroySyncStatusUI() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  for (const { event, handler } of listeners) {
    document.removeEventListener(event, handler);
  }
  listeners = [];
  container = null;
  pendingStatus = null;
}

// Auto-init on module import when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncStatusUI);
} else {
  initSyncStatusUI();
}
