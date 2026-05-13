/* global cancelAnimationFrame */
import { state } from '../store.js?v=8.37';
import { getFirestoreSyncStatus } from './firestore-sync-engine.js?v=8.37';
import { buildSyncCenterModel } from './sync-center.js?v=8.37';

/**
 * Sync Status UI — unified topbar pill component.
 *
 * Renders a single "sync pill" in the topbar that consolidates:
 *  - local save status (was #save-status)
 *  - remote sync status (was #sync-status)
 *  - sync-now action  (was #sync-now-btn)
 *
 * Click on the pill toggles a popover with detailed status rows and the
 * action buttons (Sincronizar agora / Baixar dados / Baixar log).
 *
 * Listens to:
 *   - app:saveStatus          (local save lifecycle)
 *   - app:primarySyncStatus   (legacy coordinator)
 *   - app:manualSyncStatus    (manual sync orchestrator — primary signal)
 *   - app:firestoreSyncStatus (firestore engine)
 *   - app:cloudSyncStatus     (cloudflare engine)
 *
 * Lightweight DOM updates via requestAnimationFrame; never re-renders the
 * full page.
 */

const PILL_STATES = {
  idle: { icon: 'fa-circle', label: 'Aguardando sync', cssClass: 'sync-pill--idle' },
  ok: { icon: 'fa-circle-check', label: 'Tudo sincronizado', cssClass: 'sync-pill--ok' },
  syncing: {
    icon: 'fa-spinner fa-spin',
    label: 'Sincronizando…',
    cssClass: 'sync-pill--syncing',
  },
  pending: { icon: 'fa-clock', label: 'Pendente', cssClass: 'sync-pill--pending' },
  error: { icon: 'fa-circle-exclamation', label: 'Erro no sync', cssClass: 'sync-pill--error' },
  conflict: {
    icon: 'fa-triangle-exclamation',
    label: 'Conflito',
    cssClass: 'sync-pill--conflict',
  },
  offline: { icon: 'fa-wifi', label: 'Offline', cssClass: 'sync-pill--offline' },
  paused: { icon: 'fa-pause-circle', label: 'Sync pausado', cssClass: 'sync-pill--paused' },
  saving: { icon: 'fa-spinner fa-spin', label: 'Salvando…', cssClass: 'sync-pill--syncing' },
  'save-error': {
    icon: 'fa-circle-exclamation',
    label: 'Erro ao salvar',
    cssClass: 'sync-pill--error',
  },
};

const FIRESTORE_STATUS_MAP = {
  unconfigured: 'idle',
  'signed-in': 'idle',
  'signed-out': 'offline',
  redirecting: 'syncing',
  enabled: 'idle',
  backoff: 'pending',
  pending: 'pending',
  conflict: 'conflict',
  'conflict-paused': 'conflict',
  syncing: 'syncing',
  synced: 'ok',
  error: 'error',
};

const COORDINATOR_STATUS_MAP = {
  idle: 'idle',
  queued: 'syncing',
  syncing: 'syncing',
  synced: 'ok',
  error: 'error',
  offline: 'offline',
  paused: 'paused',
  degraded: 'pending',
  'conflict-paused': 'conflict',
};

const MANUAL_STATUS_MAP = {
  idle: 'idle',
  syncing: 'syncing',
  synced: 'ok',
  partial: 'error',
  conflict: 'conflict',
  error: 'error',
  offline: 'offline',
  'no-channels': 'idle',
};

const SAVE_STATUS_MAP = {
  saved: null, // does not change pill state by itself
  saving: 'saving',
  error: 'save-error',
};

const ATTENTION_STATUS_STICKY_MS = 1000;
const ATTENTION_STATES = new Set(['syncing', 'error', 'offline', 'paused', 'pending', 'conflict']);

let pillEl = null;
let pillLabelEl = null;
let popoverEl = null;
let popoverLocalEl = null;
let popoverRemoteEl = null;
let popoverLastEl = null;
let rafId = null;
let popoverOutsideHandler = null;
let listeners = [];

let currentPillState = 'idle';
let lastSaveStatus = { status: 'saved', message: 'Salvo localmente' };
let lastSyncEvent = { status: 'idle', source: null, detail: null };
let lastAttentionStatusAt = 0;

function mapStatus(source, rawStatus) {
  let map;
  if (source === 'coordinator') map = COORDINATOR_STATUS_MAP;
  else if (source === 'manual') map = MANUAL_STATUS_MAP;
  else if (source === 'firestore') map = FIRESTORE_STATUS_MAP;
  else map = FIRESTORE_STATUS_MAP;
  return map[rawStatus] || 'idle';
}

function aggregatedPillState() {
  // If a save error is active, that takes priority — local data risk is the
  // most critical signal.
  if (lastSaveStatus.status === 'error') return 'save-error';
  if (lastSaveStatus.status === 'saving' && lastSyncEvent.status !== 'syncing') return 'saving';

  return lastSyncEvent.status || 'idle';
}

function applyPillRender() {
  if (!pillEl) return;
  const stateKey = aggregatedPillState();
  const cfg = PILL_STATES[stateKey] || PILL_STATES.idle;

  // Replace prefix classes
  for (const cls of [...pillEl.classList]) {
    if (cls.startsWith('sync-pill--')) pillEl.classList.remove(cls);
  }
  if (cfg.cssClass) pillEl.classList.add(cfg.cssClass);

  const iconWrapper = pillEl.querySelector('.sync-pill-icon i');
  if (iconWrapper) iconWrapper.className = `fa ${cfg.icon}`;
  if (pillLabelEl) pillLabelEl.textContent = cfg.label;
  pillEl.setAttribute('title', cfg.label);
  currentPillState = stateKey;

  updatePopoverRows();
}

function formatTime(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function updatePopoverRows() {
  if (!popoverEl) return;
  // Local row
  if (popoverLocalEl) {
    if (lastSaveStatus.status === 'error') {
      popoverLocalEl.textContent = '⚠ Erro ao salvar';
      popoverLocalEl.className = 'sync-popover-row-value sync-popover-row-value--error';
    } else if (lastSaveStatus.status === 'saving') {
      popoverLocalEl.textContent = 'Salvando…';
      popoverLocalEl.className = 'sync-popover-row-value sync-popover-row-value--pending';
    } else {
      const t = formatTime(state.config?.localBackupAt);
      popoverLocalEl.textContent = t ? `✓ Salvo (${t})` : '✓ Salvo';
      popoverLocalEl.className = 'sync-popover-row-value sync-popover-row-value--ok';
    }
  }
  // Remote row
  if (popoverRemoteEl) {
    const stateKey = lastSyncEvent.status || 'idle';
    const cfg = PILL_STATES[stateKey] || PILL_STATES.idle;
    let toneClass = 'sync-popover-row-value';
    if (stateKey === 'ok') toneClass += ' sync-popover-row-value--ok';
    else if (stateKey === 'syncing' || stateKey === 'pending')
      toneClass += ' sync-popover-row-value--pending';
    else if (stateKey === 'error' || stateKey === 'conflict')
      toneClass += ' sync-popover-row-value--error';
    else if (stateKey === 'offline') toneClass += ' sync-popover-row-value--offline';
    popoverRemoteEl.className = toneClass;
    popoverRemoteEl.textContent = cfg.label;
  }
  // Last manual sync
  if (popoverLastEl) {
    const lastAt = state.config?.lastManualSyncAt;
    if (lastAt) {
      try {
        popoverLastEl.textContent = new Date(lastAt).toLocaleString('pt-BR');
      } catch {
        popoverLastEl.textContent = String(lastAt);
      }
    } else {
      popoverLastEl.textContent = 'Nunca';
    }
  }
}

function requestFrame(cb) {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : setTimeout(cb, 0);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

function scheduleApply() {
  if (rafId !== null) return;
  rafId = requestFrame(() => {
    rafId = null;
    applyPillRender();
  });
}

// ── popover handling ──────────────────────────────────────────────────

export function setSyncPopoverOpen(open) {
  if (!popoverEl || !pillEl) return;
  if (open) {
    popoverEl.hidden = false;
    pillEl.setAttribute('aria-expanded', 'true');
    updatePopoverRows();
    setTimeout(() => {
      // Attach outside-click handler on next tick to avoid catching the
      // click that opened the popover.
      popoverOutsideHandler = (evt) => {
        if (!popoverEl || !pillEl) return;
        if (popoverEl.contains(evt.target) || pillEl.contains(evt.target)) return;
        setSyncPopoverOpen(false);
      };
      document.addEventListener('click', popoverOutsideHandler, true);
      document.addEventListener('keydown', escClose);
    }, 0);
  } else {
    popoverEl.hidden = true;
    pillEl.setAttribute('aria-expanded', 'false');
    if (popoverOutsideHandler) {
      document.removeEventListener('click', popoverOutsideHandler, true);
      popoverOutsideHandler = null;
    }
    document.removeEventListener('keydown', escClose);
  }
}

function escClose(evt) {
  if (evt.key === 'Escape') setSyncPopoverOpen(false);
}

export function toggleSyncPopover() {
  if (!popoverEl) return;
  const isOpen = !popoverEl.hidden;
  setSyncPopoverOpen(!isOpen);
}

// ── event handlers ────────────────────────────────────────────────────

function handleSaveStatus(event) {
  const detail = event.detail || {};
  const status = detail.status || 'saved';
  lastSaveStatus = { status, message: detail.message || '' };
  scheduleApply();
}

function handlePrimarySyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  const status = mapStatus('coordinator', raw);
  // Avoid flapping back to idle right after an attention status.
  if (status === 'idle' && Date.now() - lastAttentionStatusAt < ATTENTION_STATUS_STICKY_MS) return;
  if (ATTENTION_STATES.has(status)) lastAttentionStatusAt = Date.now();
  lastSyncEvent = { status, source: 'coordinator', detail: event.detail };
  scheduleApply();
}

function handleManualSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  const status = mapStatus('manual', raw);
  if (ATTENTION_STATES.has(status)) lastAttentionStatusAt = Date.now();
  lastSyncEvent = { status, source: 'manual', detail: event.detail };
  scheduleApply();
}

function handleFirestoreSyncStatus(event) {
  const raw = event.detail?.status;
  if (!raw) return;
  const status = mapStatus('firestore', raw);
  if (status === 'idle' && Date.now() - lastAttentionStatusAt < ATTENTION_STATUS_STICKY_MS) return;
  if (ATTENTION_STATES.has(status)) lastAttentionStatusAt = Date.now();
  lastSyncEvent = { status, source: 'firestore', detail: event.detail };
  scheduleApply();
}

function handleCloudSyncStatus() {
  // Cloudflare events don't change the aggregate pill state directly —
  // manual-sync orchestrator carries the unified status. Just refresh
  // popover rows in case CF timestamps moved.
  scheduleApply();
}

function handleGlobalSyncPauseChanged() {
  scheduleApply();
}

// ── refresh sync-center surface (Configurações page) ──────────────────

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

function getCurrentModel() {
  return buildSyncCenterModel({
    state,
    getFirestoreStatus: () => getFirestoreSyncStatus() || {},
  });
}

function refreshConfigSyncSurface() {
  const syncCenter = document.querySelector('[data-testid="sync-center"]');
  if (!syncCenter) return;
  const model = getCurrentModel();
  // Remove resolved conflict panels — when state.config.cfConflict /
  // firestore.conflict is cleared by sync, drop the visual alert if present.
  const firebase = model.sources?.find((s) => s?.id === 'firebase');
  const cloudflare = model.sources?.find((s) => s?.id === 'cloudflare');
  if (!firebase?.conflict) {
    syncCenter.querySelector('[data-testid="firestore-sync-conflict"]')?.remove();
  }
  if (!cloudflare?.conflict) {
    syncCenter.querySelector('[data-testid="cf-sync-conflict"]')?.remove();
  }
  // Update advanced health badge if present
  const healthStatus = model.health?.status || 'idle';
  const badge = syncCenter.querySelector('.sync-health-badge');
  if (badge) {
    for (const cls of [...badge.classList]) {
      if (cls.startsWith('sync-health-badge--')) badge.classList.remove(cls);
    }
    badge.classList.add(`sync-health-badge--${healthStatus}`);
    const icon = badge.querySelector('i');
    if (icon) icon.className = `fa ${HEALTH_ICONS[healthStatus] || HEALTH_ICONS.idle}`;
    const span = badge.querySelector('span');
    if (span) span.textContent = HEALTH_LABELS[healthStatus] || 'Status';
  }
}

let syncCenterRafId = null;
function scheduleSyncCenterRefresh() {
  if (syncCenterRafId !== null) return;
  syncCenterRafId = requestFrame(() => {
    syncCenterRafId = null;
    refreshConfigSyncSurface();
  });
}

// Wrap handlers to also trigger sync-center refresh.
function withCenterRefresh(handler) {
  return (event) => {
    handler(event);
    scheduleSyncCenterRefresh();
  };
}

// ── init / teardown ───────────────────────────────────────────────────

export function initSyncStatusUI() {
  if (pillEl) return; // already initialized
  pillEl = document.getElementById('sync-pill');
  pillLabelEl = document.getElementById('sync-pill-label');
  popoverEl = document.getElementById('sync-popover');
  popoverLocalEl = document.getElementById('sync-popover-local');
  popoverRemoteEl = document.getElementById('sync-popover-remote');
  popoverLastEl = document.getElementById('sync-popover-last');
  if (!pillEl) return;

  const wrappedSave = withCenterRefresh(handleSaveStatus);
  const wrappedPrimary = withCenterRefresh(handlePrimarySyncStatus);
  const wrappedManual = withCenterRefresh(handleManualSyncStatus);
  const wrappedFirestore = withCenterRefresh(handleFirestoreSyncStatus);
  const wrappedCloud = withCenterRefresh(handleCloudSyncStatus);
  const wrappedPause = withCenterRefresh(handleGlobalSyncPauseChanged);

  document.addEventListener('app:saveStatus', wrappedSave);
  document.addEventListener('app:primarySyncStatus', wrappedPrimary);
  document.addEventListener('app:manualSyncStatus', wrappedManual);
  document.addEventListener('app:firestoreSyncStatus', wrappedFirestore);
  document.addEventListener('app:cloudSyncStatus', wrappedCloud);
  document.addEventListener('app:globalSyncPauseChanged', wrappedPause);
  listeners = [
    { event: 'app:saveStatus', handler: wrappedSave },
    { event: 'app:primarySyncStatus', handler: wrappedPrimary },
    { event: 'app:manualSyncStatus', handler: wrappedManual },
    { event: 'app:firestoreSyncStatus', handler: wrappedFirestore },
    { event: 'app:cloudSyncStatus', handler: wrappedCloud },
    { event: 'app:globalSyncPauseChanged', handler: wrappedPause },
  ];

  // Initial state
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastSyncEvent = { status: 'offline', source: 'init', detail: null };
  }
  applyPillRender();
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
  if (popoverOutsideHandler) {
    document.removeEventListener('click', popoverOutsideHandler, true);
    popoverOutsideHandler = null;
  }
  document.removeEventListener('keydown', escClose);
  for (const { event, handler } of listeners) {
    document.removeEventListener(event, handler);
  }
  listeners = [];
  pillEl = null;
  pillLabelEl = null;
  popoverEl = null;
  popoverLocalEl = null;
  popoverRemoteEl = null;
  popoverLastEl = null;
  currentPillState = 'idle';
  lastSaveStatus = { status: 'saved', message: 'Salvo localmente' };
  lastSyncEvent = { status: 'idle', source: null, detail: null };
  lastAttentionStatusAt = 0;
}

// Auto-init on module import when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncStatusUI);
} else {
  initSyncStatusUI();
}

// ── backwards-compat exports for legacy tests ─────────────────────────
// Old API exposed SYNC_NOW_STATES, renderSyncNowButton, deriveSyncNowState
// for the standalone refresh button. The button is gone; keep no-op
// shims so existing test imports don't crash.
export const SYNC_NOW_STATES = {
  idle: { icon: 'fa-arrows-rotate', title: 'Sincronizar agora', disabled: false, cssClass: '' },
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
export function renderSyncNowButton() {
  /* legacy no-op — pill replaces standalone button */
}
export function deriveSyncNowState(statusKey) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (statusKey === 'syncing') return 'syncing';
  if (statusKey === 'error') return 'error';
  return 'idle';
}

// Exports for testing
export {
  PILL_STATES,
  applyPillRender as _applyPillRender,
  aggregatedPillState as _aggregatedPillState,
};
