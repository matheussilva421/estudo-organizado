/* global cancelAnimationFrame */
import { state } from '../store.js?v=8.34';
import { getFirestoreSyncStatus } from './firestore-sync-engine.js?v=8.34';
import { buildSyncCenterModel } from './sync-center.js?v=8.34';

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
  degraded: {
    icon: 'fa-exclamation-triangle',
    text: 'Sync degradado',
    cssClass: 'sync-status--degraded',
  },
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
let syncCenterRafId = null;
let pendingStatus = null;
let listeners = [];

const HEALTH_ICONS = {
  ok: 'fa-circle-check',
  idle: 'fa-circle',
  pending: 'fa-clock',
  conflict: 'fa-triangle-exclamation',
  error: 'fa-circle-xmark',
  offline: 'fa-wifi',
  synced: 'fa-circle-check',
  queued: 'fa-clock',
  syncing: 'fa-spinner fa-spin',
  local_saved: 'fa-database',
  degraded: 'fa-triangle-exclamation',
};

const HEALTH_LABELS = {
  ok: 'OK',
  idle: 'Inativo',
  pending: 'Pendente',
  conflict: 'Conflito',
  error: 'Erro',
  offline: 'Offline',
  synced: 'OK',
  queued: 'Pendente',
  syncing: 'Pendente',
  local_saved: 'OK',
  degraded: 'Erro',
};

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

function requestFrame(callback) {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : setTimeout(callback, 0);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

function scheduleRender(statusKey) {
  pendingStatus = statusKey;
  if (rafId !== null) return;
  rafId = requestFrame(() => {
    rafId = null;
    if (pendingStatus !== null) {
      renderStatus(pendingStatus);
      pendingStatus = null;
    }
  });
}

function replaceClassPrefix(el, prefix, nextClass) {
  if (!el) return;
  for (const className of [...el.classList]) {
    if (className.startsWith(prefix)) el.classList.remove(className);
  }
  if (nextClass) el.classList.add(nextClass);
}

function setText(root, selector, value) {
  const el = root?.querySelector(selector);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

function getCurrentModel() {
  return buildSyncCenterModel({
    state,
    getFirestoreStatus: () => getFirestoreSyncStatus() || {},
  });
}

function updateQuietPanel(syncCenter, model) {
  const panel = syncCenter.querySelector('[data-testid="sync-quiet-panel"]');
  if (!panel) return;

  const quiet = model.quiet || {};
  const health = model.health || {};
  const tone = quiet.tone || health.status || 'idle';
  replaceClassPrefix(panel, 'sync-quiet-panel--', `sync-quiet-panel--${tone}`);
  setText(panel, '.sync-quiet-title', quiet.title);
  setText(panel, '.sync-quiet-detail', quiet.detail);

  const icon = panel.querySelector('.sync-quiet-icon i');
  if (icon) icon.className = `fa ${HEALTH_ICONS[health.status] || HEALTH_ICONS.idle}`;

  const actions = panel.querySelector('.sync-quiet-actions');
  if (actions && quiet.primaryAction !== 'sign-in') actions.remove();
}

function updateAdvancedHealth(syncCenter, model) {
  const healthStatus = model.health?.status || 'idle';
  const badge = syncCenter.querySelector('[data-testid="sync-advanced-panel"] .sync-health-badge');
  if (!badge) return;

  replaceClassPrefix(badge, 'sync-health-badge--', `sync-health-badge--${healthStatus}`);
  const icon = badge.querySelector('i');
  if (icon) icon.className = `fa ${HEALTH_ICONS[healthStatus] || HEALTH_ICONS.idle}`;
  setText(badge, 'span', HEALTH_LABELS[healthStatus] || 'Status');
}

function removeResolvedConflictPanels(syncCenter, model) {
  const firebase = model.sources?.find((source) => source?.id === 'firebase');
  const cloudflare = model.sources?.find((source) => source?.id === 'cloudflare');

  if (!firebase?.conflict) {
    syncCenter.querySelector('[data-testid="firestore-sync-conflict"]')?.remove();
    syncCenter
      .querySelector('[data-sync-source="firebase"] [data-testid="sync-source-conflict-entities"]')
      ?.remove();
  }

  if (!cloudflare?.conflict) {
    syncCenter.querySelector('[data-testid="cf-sync-conflict"]')?.remove();
  }
}

function refreshConfigSyncSurface() {
  const syncCenter = document.querySelector('[data-testid="sync-center"]');
  if (!syncCenter) return;

  const model = getCurrentModel();
  removeResolvedConflictPanels(syncCenter, model);
  updateQuietPanel(syncCenter, model);
  updateAdvancedHealth(syncCenter, model);
}

function scheduleSyncCenterRefresh() {
  if (syncCenterRafId !== null) return;
  syncCenterRafId = requestFrame(() => {
    syncCenterRafId = null;
    refreshConfigSyncSurface();
  });
}

function handlePrimarySyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  scheduleRender(mapToCanonicalStatus('coordinator', raw));
  scheduleSyncCenterRefresh();
}

function handleFirestoreSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  scheduleRender(mapToCanonicalStatus('firestore', raw));
  scheduleSyncCenterRefresh();
}

function handleCloudSyncStatus() {
  scheduleSyncCenterRefresh();
}

export function initSyncStatusUI() {
  if (container) return; // already initialized
  container = document.getElementById('sync-status');
  if (!container) return;

  document.addEventListener('app:primarySyncStatus', handlePrimarySyncStatus);
  document.addEventListener('app:firestoreSyncStatus', handleFirestoreSyncStatus);
  document.addEventListener('app:cloudSyncStatus', handleCloudSyncStatus);
  listeners = [
    { event: 'app:primarySyncStatus', handler: handlePrimarySyncStatus },
    { event: 'app:firestoreSyncStatus', handler: handleFirestoreSyncStatus },
    { event: 'app:cloudSyncStatus', handler: handleCloudSyncStatus },
  ];

  // Initial state
  scheduleRender('idle');
}

export function destroySyncStatusUI() {
  if (rafId !== null) {
    cancelFrame(rafId);
    rafId = null;
  }
  if (syncCenterRafId !== null) {
    cancelFrame(syncCenterRafId);
    syncCenterRafId = null;
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
