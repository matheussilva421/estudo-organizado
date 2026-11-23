const STATUS_LABELS = Object.freeze({
  sincronizado: 'Sincronizado',
  sincronizando: 'Sincronizando',
  'salvo-neste-dispositivo': 'Salvo neste dispositivo',
  'atencao-necessaria': 'Atenção necessária',
});

const STATUS_ARIA_LIVE = Object.freeze({
  sincronizado: 'polite',
  sincronizando: 'polite',
  'salvo-neste-dispositivo': 'polite',
  'atencao-necessaria': 'assertive',
});

let latestStatus = null;
let remoteAckState = { acknowledged: false, at: null };
let authMissing = false;
let persistentError = null;
let bridgeInstalled = false;
let refreshInFlight = null;
let queueState = { pending: 0, retry: 0, conflicts: 0, inFlight: false };
let workerBusy = false;
let statusVersion = 0;
let activeScope = null;

function positiveInteger(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function normalizeNetwork(network) {
  if (network === false) return { online: false, listenerActive: false };
  if (network === true) return { online: true, listenerActive: false };
  if (!network || typeof network !== 'object') {
    return { online: true, listenerActive: false };
  }
  return {
    online: network.online !== false && network.offline !== true && network.connected !== false,
    listenerActive: network.listenerActive === true || network.active === true,
    lastError: network.lastError || null,
  };
}

function normalizeAuth(auth) {
  if (auth === false) return { available: false };
  if (auth === true || auth == null) return { available: true };
  if (typeof auth !== 'object') return { available: true };
  const status = String(auth.status || auth.state || '').toLowerCase();
  if (['missing', 'signed-out', 'unauthenticated', 'auth-required', 'blocked'].includes(status)) {
    return { available: false };
  }
  if (auth.authenticated === false || auth.signedIn === false) {
    return { available: false };
  }
  if (auth.available === false || auth.user === null) return { available: false };
  return {
    available: auth.authenticated !== false && auth.signedIn !== false && auth.user !== null,
  };
}

function normalizeOutbox(outbox) {
  const counts = {
    pending: 0,
    retry: 0,
    conflicts: 0,
    acked: 0,
    inFlight: false,
    persistentError: null,
  };
  if (Array.isArray(outbox)) {
    const attempts = [];
    for (const operation of outbox) {
      const status = String(operation?.status || 'pending');
      if (status === 'pending' || status === 'in-flight') counts.pending += 1;
      else if (status === 'retry') counts.retry += 1;
      else if (status === 'conflict') counts.conflicts += 1;
      else if (status === 'acked') counts.acked += 1;
      attempts.push(Number(operation?.attempts || 0));
    }
    if (attempts.some((attempt) => attempt >= 2)) {
      counts.persistentError = 'retry-attempts';
    }
    return counts;
  }
  if (!outbox || typeof outbox !== 'object') return counts;
  counts.pending = positiveInteger(outbox.pending ?? outbox.pendingCount);
  counts.retry = positiveInteger(outbox.retry ?? outbox.retrying ?? outbox.retryCount);
  counts.conflicts = positiveInteger(outbox.conflicts ?? outbox.conflictCount);
  counts.acked = positiveInteger(outbox.acked ?? outbox.ackCount);
  counts.inFlight = outbox.inFlight === true || outbox.syncing === true;
  const attempts = Number(outbox.attempts ?? outbox.failureCount ?? 0);
  if (outbox.persistentError === true) counts.persistentError = outbox.lastError || 'persistent';
  else if (typeof outbox.persistentError === 'string')
    counts.persistentError = outbox.persistentError;
  else if (attempts >= 2) counts.persistentError = outbox.lastError || 'retry-attempts';
  return counts;
}

function normalizeConflicts(conflicts) {
  if (Array.isArray(conflicts)) return conflicts.filter(conflict => conflict?.status !== 'resolved').length;
  if (Number.isFinite(Number(conflicts))) return positiveInteger(conflicts);
  if (!conflicts || typeof conflicts !== 'object') return 0;
  if (conflicts.conflict || conflicts.entityId || conflicts.conflictId) return 1;
  return positiveInteger(conflicts.count ?? conflicts.total ?? conflicts.conflicts);
}

function normalizeRemoteAck(remoteAck) {
  if (remoteAck === true) return { acknowledged: true, at: null };
  if (remoteAck === false || remoteAck == null) return { acknowledged: false, at: null };
  if (typeof remoteAck === 'string') {
    const normalized = remoteAck.toLowerCase();
    return {
      acknowledged: !['', 'false', 'none', 'listener-active', 'active', 'offline'].includes(
        normalized
      ),
      at: remoteAck,
    };
  }
  if (typeof remoteAck === 'number') {
    return { acknowledged: remoteAck > 0, at: remoteAck > 0 ? remoteAck : null };
  }
  if (typeof remoteAck !== 'object') return { acknowledged: false, at: null };
  const at =
    remoteAck.at ||
    remoteAck.ackedAt ||
    remoteAck.receivedAt ||
    remoteAck.remoteUpdatedAt ||
    remoteAck.lastPushAt ||
    null;
  const acknowledged =
    remoteAck.acknowledged === true ||
    remoteAck.ack === true ||
    remoteAck.receipt != null ||
    Boolean(at);
  return { acknowledged, at };
}

function statusResult(state, message, details = {}) {
  return {
    state,
    status: state,
    label: STATUS_LABELS[state],
    message,
    ariaLive: STATUS_ARIA_LIVE[state],
    ...details,
  };
}

/**
 * Converts local outbox, connectivity, auth and receipt evidence into the four
 * user-visible V1 states. A live listener is deliberately not receipt evidence.
 */
export function deriveV1SyncStatus({
  outbox = [],
  network = true,
  auth = true,
  conflicts = [],
  remoteAck = null,
  persistentError: inputError = null,
  error = null,
} = {}) {
  const queue = normalizeOutbox(outbox);
  const connectivity = normalizeNetwork(network);
  const authentication = normalizeAuth(auth);
  const conflictCount = Math.max(normalizeConflicts(conflicts), queue.conflicts);
  const pendingCount = queue.pending + queue.retry + conflictCount;
  const ack = normalizeRemoteAck(remoteAck);
  const errorValue = inputError || error || queue.persistentError || connectivity.lastError || null;
  const details = {
    pendingCount,
    conflictCount,
    acknowledged: ack.acknowledged,
  };

  if (!authentication.available) {
    return statusResult(
      'salvo-neste-dispositivo',
      'Entre com Google para ativar a sincronização. As alterações continuam salvas neste dispositivo.',
      details
    );
  }

  if (conflictCount > 0) {
    const noun = conflictCount === 1 ? 'item' : 'itens';
    const verb = conflictCount === 1 ? 'precisa' : 'precisam';
    return statusResult(
      'atencao-necessaria',
      `${conflictCount} ${noun} ${verb} de revisão; os demais seguem normalmente. As alterações locais estão preservadas.`,
      details
    );
  }

  if (errorValue) {
    return statusResult(
      'atencao-necessaria',
      'Não foi possível sincronizar após novas tentativas. As alterações continuam neste dispositivo; use as opções avançadas se o problema persistir.',
      details
    );
  }

  if (!connectivity.online) {
    return statusResult(
      'salvo-neste-dispositivo',
      'Você está offline. As alterações estão salvas neste dispositivo e serão sincronizadas quando a conexão voltar.',
      details
    );
  }

  if (pendingCount > 0 || queue.inFlight) {
    return statusResult(
      'sincronizando',
      'Alterações salvas neste dispositivo; aguardando confirmação do servidor.',
      details
    );
  }

  if (ack.acknowledged) {
    return statusResult(
      'sincronizado',
      'As alterações deste dispositivo foram confirmadas pelo servidor.',
      details
    );
  }

  return statusResult(
    'salvo-neste-dispositivo',
    'Alterações preservadas neste dispositivo; ainda sem confirmação do servidor.',
    details
  );
}

export function shouldWarnV1BeforeUnload(status = latestStatus) {
  return Boolean(
    status &&
    (status.pendingCount > 0 ||
      status.state === 'sincronizando' ||
      (status.state === 'atencao-necessaria' && status.pendingCount > 0))
  );
}

function hasV1Runtime() {
  try {
    if (globalThis.window?.__ESTUDO_V1_SYNC_TEST__?.enabled === true) return true;
    if (globalThis.localStorage?.getItem('estudo_v1_sync_enabled') === 'true') return true;
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
  return false;
}

function publishStatus(status) {
  latestStatus = status;
  renderV1SyncStatusDom(status);
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('app:v1SyncStatusChanged', { detail: status }));
}

function renderV1SyncStatusDom(status = latestStatus) {
  if (!status || typeof document === 'undefined') return;
  const root = document.querySelector?.('[data-testid="v1-sync-status"]');
  if (!root) return;
  const tone =
    status.state === 'atencao-necessaria'
      ? ' config-save-status--error'
      : status.state === 'sincronizando'
        ? ' config-save-status--saving'
        : '';
  root.dataset.state = status.state;
  root.className = `v1-sync-status config-save-status${tone} v1-sync-status--${status.state}`;
  root.setAttribute('aria-live', status.ariaLive);
  const label = root.querySelector?.('[data-v1-sync-label]');
  const message = root.querySelector?.('[data-v1-sync-message]');
  if (label) label.textContent = status.label;
  if (message) message.textContent = status.message;
}

export function getV1SyncStatusSnapshot() {
  installV1SyncStatusBridge();
  if (latestStatus) return latestStatus;
  if (!hasV1Runtime()) return null;
  latestStatus = deriveV1SyncStatus({
    outbox: [],
    network: { online: globalThis.navigator?.onLine !== false, listenerActive: true },
    auth: true,
    conflicts: [],
    remoteAck: false,
  });
  void refreshV1SyncStatus();
  return latestStatus;
}

function onPrimarySyncStatus(event) {
  const detail = event?.detail || {};
  if (detail.mode !== 'v1') return;
  if (activeScope && detail.uid && detail.generationId &&
    activeScope !== `${detail.uid}\u0000${detail.generationId}`) return;
  statusVersion += 1;
  const status = detail.status;
  if (status === 'synced' && positiveInteger(detail.acked) > 0) {
    remoteAckState = { acknowledged: true, at: new Date().toISOString() };
    authMissing = false;
    persistentError = null;
  }
  if (status === 'auth-required') authMissing = true;
  if (['error', 'blocked', 'degraded'].includes(status)) {
    persistentError = detail.reason || 'remote-error';
  }
  if (status === 'synced') persistentError = null;
  workerBusy = ['queued', 'syncing', 'backoff'].includes(status);
  // Event counters are partial hints. Only a durable read can clear known work.
  if (detail.pending != null) {
    queueState.pending = Math.max(queueState.pending + queueState.retry, positiveInteger(detail.pending));
    queueState.retry = 0;
  }
  if (detail.conflicts != null) {
    queueState.conflicts = Math.max(queueState.conflicts, positiveInteger(detail.conflicts));
  }
  queueState.inFlight = workerBusy || status === 'synced';
  const eventStatus = deriveV1SyncStatus({
    outbox: {
      ...queueState,
      persistentError,
    },
    network: { online: globalThis.navigator?.onLine !== false },
    auth: !authMissing,
    conflicts: queueState.conflicts,
    remoteAck: remoteAckState,
  });
  publishStatus(eventStatus);
  void refreshV1SyncStatus();
}

function onStateSaved(event) {
  if (event?.detail?.metadataOnly === true && latestStatus?.pendingCount === 0) return;
  statusVersion += 1;
  if (event?.detail?.metadataOnly !== true) {
    remoteAckState = { acknowledged: false, at: null };
    queueState.inFlight = true;
    publishRuntimeStatus();
  }
  void refreshV1SyncStatus();
}

function publishRuntimeStatus() {
  publishStatus(deriveV1SyncStatus({
    outbox: queueState,
    network: { online: globalThis.navigator?.onLine !== false },
    auth: !authMissing,
    conflicts: queueState.conflicts,
    remoteAck: remoteAckState,
    persistentError,
  }));
}

/** Called by the existing application Auth observer, including token recovery. */
export function setV1SyncStatusAuth(user) {
  installV1SyncStatusBridge();
  statusVersion += 1;
  authMissing = !user?.uid;
  if (authMissing) remoteAckState = { acknowledged: false, at: null };
  publishRuntimeStatus();
  void refreshV1SyncStatus();
}

/** Hydrate the exit-warning snapshot before releasing the V1 application UI. */
export async function initializeV1SyncStatus({ uid, generationId, authFailure } = {}) {
  const scope = `${uid}\u0000${generationId}`;
  if (activeScope !== scope) {
    activeScope = scope;
    queueState = { pending: 0, retry: 0, conflicts: 0, inFlight: false };
    remoteAckState = { acknowledged: false, at: null };
    persistentError = null;
    workerBusy = false;
  }
  authMissing = !uid || Boolean(authFailure);
  statusVersion += 1;
  installV1SyncStatusBridge();
  return refreshV1SyncStatus();
}

export function installV1SyncStatusBridge() {
  if (bridgeInstalled || typeof document === 'undefined') return;
  bridgeInstalled = true;
  document.addEventListener('app:primarySyncStatus', onPrimarySyncStatus);
  document.addEventListener('stateSaved', onStateSaved);
  globalThis.window?.addEventListener?.('online', () => void refreshV1SyncStatus());
  globalThis.window?.addEventListener?.('offline', () => void refreshV1SyncStatus());
}

export async function refreshV1SyncStatus() {
  installV1SyncStatusBridge();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    let version;
    do {
      version = statusVersion;
    try {
      const store = await import('../../store.js?v=8.37');
      const context = store.getActiveV1Context?.();
      if (!context?.uid || !context.generationId) return latestStatus;
      const [localStatus, operations, conflicts] = await Promise.all([
        store.getLocalSyncStatus(context.uid, context.generationId),
        store.getPendingOperations(context.uid, context.generationId),
        store.listLocalConflicts(context.uid, context.generationId),
      ]);
      if (version !== statusVersion) continue;
      const attempts = (operations || []).reduce(
        (max, operation) => Math.max(max, Number(operation?.attempts || 0)),
        0
      );
      if (attempts >= 2)
        persistentError =
          operations.find((operation) => Number(operation?.attempts || 0) >= 2)?.lastError ||
          'retry-attempts';
      if (positiveInteger(localStatus?.acked) > 0 && !authMissing) {
        remoteAckState = { ...remoteAckState, acknowledged: true };
      }
      queueState = {
        pending: positiveInteger(localStatus?.pending),
        retry: positiveInteger(localStatus?.retry),
        conflicts: normalizeConflicts(conflicts),
        inFlight: workerBusy,
      };
      const status = deriveV1SyncStatus({
        outbox: {
          ...queueState,
          acked: localStatus?.acked,
        },
        network: { online: globalThis.navigator?.onLine !== false },
        auth: !authMissing,
        conflicts,
        remoteAck: remoteAckState,
        persistentError,
      });
      publishStatus(status);
      return status;
    } catch {
      if (version !== statusVersion) continue;
      const status = deriveV1SyncStatus({
        outbox: { ...queueState, persistentError: true },
        network: { online: globalThis.navigator?.onLine !== false },
        auth: !authMissing,
        conflicts: queueState.conflicts,
        remoteAck: remoteAckState,
      });
      publishStatus(status);
      return status;
    }
    } while (version !== statusVersion);
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
