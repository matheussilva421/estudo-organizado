/* global cancelAnimationFrame */
import { state } from '../store.js?v=8.37';
import { getFirestoreSyncStatus } from './firestore-sync-engine.js?v=8.37';
import { buildSyncCenterModel } from './sync-center.js?v=8.37';

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
  paused: { icon: 'fa-pause-circle', text: 'Sync pausado', cssClass: 'sync-status--paused' },
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

// Map sync-coordinator statuses to canonical states (legacy, kept for log paths)
const COORDINATOR_STATUS_MAP = {
  idle: 'idle',
  queued: 'syncing',
  syncing: 'syncing',
  synced: 'synced',
  error: 'error',
  offline: 'offline',
  paused: 'paused',
  degraded: 'degraded',
  'conflict-paused': 'error',
};

// Map manual-sync orchestrator statuses to canonical states
const MANUAL_STATUS_MAP = {
  idle: 'idle',
  syncing: 'syncing',
  synced: 'synced',
  partial: 'error',
  conflict: 'error',
  error: 'error',
  offline: 'offline',
  'no-channels': 'idle',
};

const ATTENTION_STATUS_STICKY_MS = 1000;
const ATTENTION_STATUSES = new Set(['syncing', 'error', 'offline', 'paused', 'degraded']);

let container = null;
let syncToggle = null;
let syncNowBtn = null;
let rafId = null;
let syncCenterRafId = null;
let pendingStatus = null;
let lastPrimaryStatusAt = 0;
let lastAttentionStatusAt = 0;
let listeners = [];
let currentSyncNowState = 'idle';

const HEALTH_ICONS = {
  ok: 'fa-circle-check',
  idle: 'fa-circle',
  pending: 'fa-clock',
  conflict: 'fa-triangle-exclamation',
  error: 'fa-circle-xmark',
  offline: 'fa-wifi',
  paused: 'fa-pause-circle',
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
  paused: 'Pausado',
  synced: 'OK',
  queued: 'Pendente',
  syncing: 'Pendente',
  local_saved: 'OK',
  degraded: 'Erro',
};

function mapToCanonicalStatus(source, rawStatus) {
  let map;
  if (source === 'coordinator') map = COORDINATOR_STATUS_MAP;
  else if (source === 'manual') map = MANUAL_STATUS_MAP;
  else map = FIRESTORE_STATUS_MAP;
  return map[rawStatus] || 'idle';
}

function renderStatus(statusKey) {
  if (!container) return;
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.idle;
  container.className = `sync-status ${config.cssClass}`;
  container.innerHTML = `<i class="fa ${config.icon}"></i> ${config.text}`;
  if (syncToggle) {
    // Manual-only mode: hide the legacy pause-sync toggle from the topbar.
    syncToggle.style.display = 'none';
  }
  currentSyncNowState = deriveSyncNowState(statusKey);
  renderSyncNowButton();
}

const SYNC_NOW_STATES = {
  idle: {
    icon: 'fa-arrows-rotate',
    title: 'Sincronizar agora',
    disabled: false,
    cssClass: '',
  },
  syncing: {
    icon: 'fa-spinner fa-spin',
    title: 'Sincronizando…',
    disabled: true,
    cssClass: 'sync-now-btn--syncing',
  },
  error: {
    icon: 'fa-exclamation-triangle',
    title: 'Erro na sincronização — toque para tentar novamente',
    disabled: false,
    cssClass: 'sync-now-btn--error',
  },
  offline: {
    icon: 'fa-wifi-slash',
    title: 'Sem conexão',
    disabled: false,
    cssClass: 'sync-now-btn--offline',
  },
  'no-channels': {
    icon: 'fa-arrows-rotate',
    title: 'Configure um canal de sincronização',
    disabled: false,
    cssClass: 'sync-now-btn--no-channels',
  },
};

function renderSyncNowButton() {
  if (!syncNowBtn) return;
  const config = SYNC_NOW_STATES[currentSyncNowState] || SYNC_NOW_STATES.idle;

  // Remove previous state classes
  for (const className of [...syncNowBtn.classList]) {
    if (className.startsWith('sync-now-btn--')) syncNowBtn.classList.remove(className);
  }
  if (config.cssClass) syncNowBtn.classList.add(config.cssClass);

  syncNowBtn.setAttribute('title', config.title);
  syncNowBtn.disabled = config.disabled;
  if (config.disabled) {
    syncNowBtn.setAttribute('disabled', '');
  } else {
    syncNowBtn.removeAttribute('disabled');
  }

  const icon = syncNowBtn.querySelector('i');
  if (icon) icon.className = `fa ${config.icon}`;
}

function deriveSyncNowState(statusKey) {
  if (!navigator.onLine) return 'offline';
  if (statusKey === 'syncing') return 'syncing';
  if (statusKey === 'error') return 'error';
  return 'idle';
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
  const now = Date.now();
  const status = mapToCanonicalStatus('coordinator', raw);
  lastPrimaryStatusAt = now;
  if (status === 'idle' && now - lastAttentionStatusAt < ATTENTION_STATUS_STICKY_MS) {
    scheduleSyncCenterRefresh();
    return;
  }
  if (ATTENTION_STATUSES.has(status)) lastAttentionStatusAt = now;
  scheduleRender(status);
  scheduleSyncCenterRefresh();
}

function handleManualSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  const now = Date.now();
  const status = mapToCanonicalStatus('manual', raw);
  lastPrimaryStatusAt = now;
  if (ATTENTION_STATUSES.has(status)) lastAttentionStatusAt = now;
  scheduleRender(status);
  scheduleSyncCenterRefresh();
}

function handleFirestoreSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  const status = mapToCanonicalStatus('firestore', raw);
  if (status === 'idle' && Date.now() - lastPrimaryStatusAt < 1000) {
    scheduleSyncCenterRefresh();
    return;
  }
  scheduleRender(status);
  scheduleSyncCenterRefresh();
}

function handleCloudSyncStatus() {
  scheduleSyncCenterRefresh();
}

function handleGlobalSyncPauseChanged() {
  // Manual-only mode: the pause toggle is hidden, but legacy events may still
  // fire from imported state. Just refresh the panel without changing status.
  scheduleSyncCenterRefresh();
}

export function initSyncStatusUI() {
  if (container) return; // already initialized
  container = document.getElementById('sync-status');
  syncToggle = document.getElementById('global-sync-toggle');
  syncNowBtn = document.getElementById('sync-now-btn');
  if (!container) return;

  document.addEventListener('app:primarySyncStatus', handlePrimarySyncStatus);
  document.addEventListener('app:firestoreSyncStatus', handleFirestoreSyncStatus);
  document.addEventListener('app:cloudSyncStatus', handleCloudSyncStatus);
  document.addEventListener('app:globalSyncPauseChanged', handleGlobalSyncPauseChanged);
  document.addEventListener('app:manualSyncStatus', handleManualSyncStatus);
  listeners = [
    { event: 'app:primarySyncStatus', handler: handlePrimarySyncStatus },
    { event: 'app:firestoreSyncStatus', handler: handleFirestoreSyncStatus },
    { event: 'app:cloudSyncStatus', handler: handleCloudSyncStatus },
    { event: 'app:globalSyncPauseChanged', handler: handleGlobalSyncPauseChanged },
    { event: 'app:manualSyncStatus', handler: handleManualSyncStatus },
  ];

  // Initial state — manual-only mode
  if (syncToggle) syncToggle.style.display = 'none';
  currentSyncNowState = navigator.onLine ? 'idle' : 'offline';
  renderSyncNowButton();
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
  syncToggle = null;
  syncNowBtn = null;
  pendingStatus = null;
  lastPrimaryStatusAt = 0;
  lastAttentionStatusAt = 0;
  currentSyncNowState = 'idle';
}

// Auto-init on module import when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncStatusUI);
} else {
  initSyncStatusUI();
}

// Exports for testing
export { SYNC_NOW_STATES, renderSyncNowButton, deriveSyncNowState };
