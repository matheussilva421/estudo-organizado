const HEALTH_EVENT_LIMIT = 30;

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function ageMs(value, now) {
  const time = toTime(value);
  return time > 0 ? Math.max(0, now - time) : null;
}

function formatAge(ms) {
  if (ms === null || ms === undefined) return '0 min';
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

export function deriveSyncHealthState(input = {}) {
  const now = input.now || Date.now();
  const pending = input.pending || null;
  const conflict = input.conflict || input.firestore?.conflict || null;
  const failureCount = Number(input.failureCount || 0);
  const lastError = input.lastError || input.firestore?.lastError || null;
  const remoteAckAt =
    input.remoteAckAt || input.firestore?.lastPushAt || input.firestore?.remoteUpdatedAt || null;
  const localSavedAt = input.localSavedAt || null;
  let state = 'local_saved';

  if (input.recovery) state = 'recovery';
  else if (conflict) state = 'conflict';
  else if (input.syncing) state = 'syncing';
  else if (failureCount >= 3 || (lastError && failureCount > 0)) state = 'degraded';
  else if (pending || input.queued) state = 'queued';
  else if (remoteAckAt) state = 'synced';

  return {
    state,
    requiresAction: state === 'conflict' || state === 'recovery',
    lastError,
    conflict,
    metrics: {
      localSavedAt,
      remoteAckAt,
      pendingAgeMs: ageMs(pending?.queuedAt || pending?.createdAt || input.queuedAt, now),
      retryAttempts: Number(pending?.attempts || input.retryAttempts || 0),
      nextRetryAt: pending?.nextAttemptAt || input.nextRetryAt || null,
      failureCount,
    },
  };
}

export function summarizeSyncMetrics(metrics = {}) {
  return {
    pendingAgeLabel: formatAge(metrics.pendingAgeMs),
    retryAttempts: Number(metrics.retryAttempts || 0),
    nextRetryAt: metrics.nextRetryAt || null,
    remoteAckAt: metrics.remoteAckAt || null,
    localSavedAt: metrics.localSavedAt || null,
    failureCount: Number(metrics.failureCount || 0),
  };
}

export function appendSyncHealthEvent(targetState, event = {}, options = {}) {
  if (!targetState.config) targetState.config = {};
  if (!targetState.config.syncHealth) targetState.config.syncHealth = { events: [] };
  const max = options.max || HEALTH_EVENT_LIMIT;
  const safeEvent = {
    type: event.type || 'unknown',
    reason: event.reason || null,
    detail: event.detail || null,
    at: options.now || new Date().toISOString(),
  };
  const current = Array.isArray(targetState.config.syncHealth.events)
    ? targetState.config.syncHealth.events
    : [];
  targetState.config.syncHealth.events = [...current, safeEvent].slice(-max);
  return safeEvent;
}
