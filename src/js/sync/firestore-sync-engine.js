import {
  completeGoogleRedirectSignIn,
  getFirebaseConfigStatus,
  initFirebaseServices,
  observeFirebaseAuth,
  signInWithGoogle,
  signOutFirebase,
} from '../firebase/firebase-client.js?v=8.33';
import { saveStateToDB, setState, state } from '../store.js?v=8.33';
import {
  applyEnvelopeToLocalState,
  createDefaultFirestoreSyncConfig,
  createFirestoreSnapshotEnvelope,
  getEnvelopeUpdatedAt,
  isRemoteNewer,
} from './firestore-schema.js?v=8.33';
import {
  clearFirestoreConflict,
  enqueueFirestoreSnapshot,
  getPendingFirestoreSnapshot,
  markFirestoreSnapshotSynced,
  saveFirestoreConflict,
  saveFirestoreMeta,
} from './firestore-outbox.js?v=8.33';
import {
  readFirestoreSnapshot,
  writeFirestoreSnapshot,
} from './firestore-repository.js?v=8.33';
import { canAutoSyncFirestore, isRemoteStateNewer, mergeStudyStates } from './sync-center.js?v=8.33';
import { checkEntityMigrationNeeded, migrateEntitiesToSnapshot } from './entity-migration.js?v=8.33';
import { firestoreLock } from './sync-lock.js?v=8.33';
import { yieldToUIWithBudget } from './sync-yield.js?v=8.33';

let currentUser = null;

/** @internal - Test hook to set currentUser for unit tests */
export function __setCurrentUser(user) {
  currentUser = user;
}
let authUnsubscribe = null;
let lastStatusSignature = '';

function getConfig() {
  if (!state.config) state.config = {};
  state.config.firestoreSync = createDefaultFirestoreSyncConfig(state.config.firestoreSync || {});
  return state.config.firestoreSync;
}

function emitStatus(status, detail = {}) {
  const config = getConfig();
  Object.assign(config, detail.config || {});
  const eventDetail = {
    status,
    uid: currentUser?.uid || config.uid || null,
    mode: config.mode,
    enabled: !!config.enabled,
    hasPendingWrites: !!config.hasPendingWrites,
    conflict: config.conflict || null,
    remoteUpdatedAt: config.remoteUpdatedAt || null,
    lastPullAt: config.lastPullAt || null,
    lastPushAt: config.lastPushAt || null,
    lastError: config.lastError || null,
    ...detail,
  };
  const signature = JSON.stringify({
    status: eventDetail.status,
    uid: eventDetail.uid,
    mode: eventDetail.mode,
    enabled: eventDetail.enabled,
    hasPendingWrites: eventDetail.hasPendingWrites,
    conflict: !!eventDetail.conflict,
    remoteUpdatedAt: eventDetail.remoteUpdatedAt,
    lastPullAt: eventDetail.lastPullAt,
    lastPushAt: eventDetail.lastPushAt,
    lastError: eventDetail.lastError,
    error: eventDetail.error || null,
  });
  if (signature === lastStatusSignature) return;
  lastStatusSignature = signature;
  document.dispatchEvent(
    new CustomEvent('app:firestoreSyncStatus', {
      detail: eventDetail,
    })
  );
}

function emitPrimaryStatus(status, detail = {}) {
  document.dispatchEvent(
    new CustomEvent('app:primarySyncStatus', {
      detail: { status, ...detail },
    })
  );
}

async function persistSyncConfig(skipRender = true) {
  await saveStateToDB({
    skipCloudSync: true,
    skipFirestoreSync: true,
    skipDriveSync: true,
    touchLocalBackup: false,
    skipSyncEvent: true,
  });
  if (!skipRender) emitPrimaryStatus('config-updated');
}

async function reconcileFirestorePendingState(skipRender = true) {
  const config = getConfig();
  const pending = await getPendingFirestoreSnapshot();

  // Clear stale snapshot conflicts when there is no pending snapshot to resolve.
  // Entity-level conflicts are already the conflict payload and must remain visible.
  if (config.conflict && config.conflict.type !== 'entity-conflict' && !pending) {
    config.conflict = null;
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(skipRender);
    emitStatus('synced');
  }

  if (!pending && config.hasPendingWrites && !config.conflict) {
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(skipRender);
    emitStatus('synced');
  }
  return pending;
}

function requestPrimarySync(reason) {
  document.dispatchEvent(
    new CustomEvent('app:primarySyncRequested', {
      detail: { reason },
    })
  );
}

// --- Polling-based remote sync (replaces onSnapshot) ---

let pollingInterval = null;
const DEFAULT_POLL_INTERVAL_MS = 30000;

export async function pollFirestoreRemote() {
  const config = getConfig();
  if (!config.enabled || config.mode !== 'primary' || !currentUser?.uid) return false;

  if (config.conflict) {
    const pending = await getPendingFirestoreSnapshot();
    if (!pending && config.conflict.type !== 'entity-conflict') {
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(true);
      emitStatus('synced');
    } else if (pending || config.conflict.type === 'entity-conflict') {
      return false;
    }
  }

  try {
    const { db, uid } = requireSignedInServices();
    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) return false;
    if (!isRemoteStateNewer(remote, state)) return false;

    await yieldToUIWithBudget(50, performance.now());

    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
    const pullAt = new Date().toISOString();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: pullAt,
      hasPendingWrites: false,
      conflict: null,
      lastError: null,
    });
    await persistSyncConfig(true);
    // CRITICAL: saveStateToDB with skipFirestoreSync to prevent feedback loop
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
    });
    emitPrimaryStatus('synced', { source: 'poll', remoteUpdatedAt });
    emitStatus('synced');
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(true);
    emitStatus('error', { error: config.lastError });
    return false;
  }
}

export function startPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (pollingInterval) return;
  pollFirestoreRemote().catch(() => {});
  pollingInterval = setInterval(() => {
    pollFirestoreRemote().catch(() => {});
  }, intervalMs);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// --- Primary sync status ---

export function getFirestoreSyncStatus() {
  let services;
  try {
    services = initFirebaseServices();
  } catch (err) {
    console.warn('getFirestoreSyncStatus: initFirebaseServices failed:', err);
    return {
      configured: false,
      projectId: '',
      authDomain: '',
      signedIn: false,
      uid: null,
      email: null,
      enabled: false,
      mode: 'off',
      conflict: null,
      hasPendingWrites: false,
      lastError: err.message || String(err),
    };
  }
  const configStatus = getFirebaseConfigStatus();
  const config = getConfig();
  return {
    configured: services.configured,
    projectId: configStatus.projectId,
    authDomain: configStatus.authDomain,
    signedIn: !!currentUser,
    uid: currentUser?.uid || config.uid || null,
    email: currentUser?.email || null,
    ...config,
  };
}

export async function downloadSyncDiagnosticLog() {
  // Import Cloudflare sync functions dynamically to avoid circular deps
  const { getSyncCreds, getSyncConfig } = await import('../cloud-sync.js?v=8.33');

  const log = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    syncStatus: getFirestoreSyncStatus(),
    pendingSnapshot: null,
    pendingError: null,
    localState: {
      eventCount: state.eventos?.length || 0,
      editalCount: state.editais?.length || 0,
      disciplinaCount: state.disciplinas?.length || 0,
      lastBackupAt: state.config?.localBackupAt || null,
      schemaVersion: state.schemaVersion || null,
    },
    syncHistory: state.config?.syncHealth?.events?.slice(-10) || [],
    performanceMetrics: state.config?.syncPerformance?.metrics?.slice(-10) || [],
    // Cloudflare sync data
    cloudflare: {
      configured: !!(state.config?.cfUrl && state.config?.cfTokenSaved),
      enabled: !!state.config?.cfSyncEnabled,
      url: state.config?.cfUrl || null,
      tokenSaved: !!state.config?.cfTokenSaved,
      lastSyncAt: state.config?.cfLastSyncAt || null,
      remoteUpdatedAt: state.config?.cfRemoteUpdatedAt || null,
      conflict: state.config?.cfConflict || null,
      lastError: state.config?.cfLastError || null,
    },
  };

  // Get Cloudflare credential store data
  try {
    const cfCreds = await getSyncCreds();
    log.cloudflare.credentialStore = {
      hasData: !!cfCreds,
      url: cfCreds?.url || null,
      hasToken: !!cfCreds?.token,
      enabled: cfCreds?.enabled || false,
    };
  } catch (err) {
    log.cloudflare.credentialStoreError = err.message || String(err);
  }

  // Get Cloudflare remote data
  try {
    const cfConfig = await getSyncConfig();
    log.cloudflare.remoteConfig = {
      hasConfig: !!cfConfig,
      url: cfConfig?.url || null,
      hasToken: !!cfConfig?.token,
    };
  } catch (err) {
    log.cloudflare.remoteConfigError = err.message || String(err);
  }

  try {
    log.pendingSnapshot = await getPendingFirestoreSnapshot();
  } catch (err) {
    log.pendingError = err.message || String(err);
  }

  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sync-diagnostic-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return log;
}

export function initFirestoreSync() {
  const services = initFirebaseServices();
  const _config = getConfig();

  if (!services.configured) {
    emitStatus('unconfigured', { config: { lastError: null } });
    return;
  }

  reconcileFirestorePendingState(false).catch((err) => {
    console.warn('Firestore pending state repair failed:', err);
  });

  completeGoogleRedirectSignIn()
    .then(async (credential) => {
      if (!credential?.user) return;
      currentUser = credential.user;
      const syncConfig = getConfig();
      syncConfig.uid = credential.user.uid;
      syncConfig.lastError = null;
      await persistSyncConfig(false);
      emitStatus('signed-in', { config: { uid: credential.user.uid, lastError: null } });

      // Check and run entity migration if needed (one-time)
      try {
        const { db, uid } = requireSignedInServices();
        const migrationCheck = await checkEntityMigrationNeeded(db, uid);
        if (migrationCheck.needed) {
          console.log(`Entity migration needed: ${migrationCheck.entityCount} entities found.`);
          emitPrimaryStatus('migrating', { entityCount: migrationCheck.entityCount });
          const report = await migrateEntitiesToSnapshot(db, uid, {
            onProgress: (msg) => console.log(`[Entity Migration] ${msg}`),
          });
          console.log('Entity migration complete:', JSON.stringify(report));
          emitPrimaryStatus('migrated', report);
        }
      } catch (err) {
        console.warn('Entity migration check failed (non-critical):', err.message);
      }
    })
    .catch(async (err) => {
      const syncConfig = getConfig();
      syncConfig.lastError = err.message || String(err);
      await persistSyncConfig(false);
      emitStatus('error', { error: syncConfig.lastError });
    });

  if (authUnsubscribe) return;
  authUnsubscribe = observeFirebaseAuth((user) => {
    currentUser = user;
    const syncConfig = getConfig();
    syncConfig.uid = user?.uid || null;
    if (!user) {
      stopPolling();
      syncConfig.hasPendingWrites = false;
      emitStatus('signed-out');
      emitPrimaryStatus('signed-out');
      return;
    }
    emitStatus('signed-in', { config: { uid: user.uid, lastError: null } });
    reconcileFirestorePendingState(false).catch((err) => {
      console.warn('Firestore pending state repair failed:', err);
    });

    // Check and run entity migration if needed (one-time)
    try {
      const { db, uid } = requireSignedInServices();
      checkEntityMigrationNeeded(db, uid)
        .then(async (migrationCheck) => {
          if (!migrationCheck.needed) return;
          console.log(`Entity migration needed: ${migrationCheck.entityCount} entities found.`);
          emitPrimaryStatus('migrating', { entityCount: migrationCheck.entityCount });
          const report = await migrateEntitiesToSnapshot(db, uid, {
            onProgress: (msg) => console.log(`[Entity Migration] ${msg}`),
          });
          console.log('Entity migration complete:', JSON.stringify(report));
          emitPrimaryStatus('migrated', report);
        })
        .catch((err) => {
          console.warn('Entity migration check failed (non-critical):', err.message);
        });
    } catch (err) {
      console.warn('Entity migration check failed (non-critical):', err.message);
    }

    startPolling();
    requestPrimarySync('signed-in');
    emitPrimaryStatus('signed-in', { uid: user.uid });
  });
}

export async function firestoreSignIn() {
  const credential = await signInWithGoogle();
  if (!credential?.user) {
    emitStatus('redirecting');
    return null;
  }
  currentUser = credential.user;
  getConfig().uid = currentUser.uid;
  await persistSyncConfig(false);

  // Check and run entity migration if needed (one-time)
  try {
    const { db, uid } = requireSignedInServices();
    const migrationCheck = await checkEntityMigrationNeeded(db, uid);
    if (migrationCheck.needed) {
      console.log(`Entity migration needed: ${migrationCheck.entityCount} entities found.`);
      emitPrimaryStatus('migrating', { entityCount: migrationCheck.entityCount });
      const report = await migrateEntitiesToSnapshot(db, uid, {
        onProgress: (msg) => console.log(`[Entity Migration] ${msg}`),
      });
      console.log('Entity migration complete:', JSON.stringify(report));
      emitPrimaryStatus('migrated', report);
    }
  } catch (err) {
    console.warn('Entity migration check failed (non-critical):', err.message);
  }

  startPolling();
  requestPrimarySync('signed-in');
  return currentUser;
}

export async function firestoreSignOut() {
  await signOutFirebase();
  currentUser = null;
  stopPolling();
  const config = getConfig();
  config.uid = null;
  config.hasPendingWrites = false;
  await persistSyncConfig(false);
}

export async function enableFirestoreSync(mode = 'shadow') {
  const config = getConfig();
  config.enabled = true;
  config.mode = mode === 'primary' ? 'primary' : 'shadow';
  config.lastError = null;
  await persistSyncConfig(false);
  emitStatus('enabled');
  startPolling();
  if (config.mode === 'primary') requestPrimarySync('enabled');
  return true;
}

export async function disableFirestoreSync() {
  const config = getConfig();
  config.enabled = false;
  config.hasPendingWrites = false;
  config.lastError = null;
  stopPolling();
  await persistSyncConfig(false);
}

export async function queueFirestoreSnapshotFromState(sourceState = state, options = {}) {
  const config = getConfig();
  if (!config.enabled) return false;
  const pending = await getPendingFirestoreSnapshot();
  if (!options.manual && !canAutoSyncFirestore(config, pending)) {
    emitStatus(config.conflict ? 'conflict-paused' : 'backoff');
    return false;
  }
  const envelope = createFirestoreSnapshotEnvelope(sourceState, options);
  const queued = await enqueueFirestoreSnapshot(envelope);
  if (queued) {
    config.hasPendingWrites = true;
    config.lastError = null;
    emitStatus('pending');
  } else {
    config.hasPendingWrites = false;
    config.lastError =
      'Armazenamento local do Firestore indisponivel. Recarregue a pagina para migrar o banco local.';
    await persistSyncConfig(false);
    emitStatus('error', { error: config.lastError });
  }
  return queued;
}

function requireSignedInServices() {
  const services = initFirebaseServices();
  if (!services.configured) throw new Error('Firebase nao configurado.');
  if (!currentUser) throw new Error('Entre com Google antes de sincronizar com Firestore.');
  return { db: services.db, uid: currentUser.uid };
}

async function registerConflict(remoteEnvelope, localEnvelope) {
  const config = getConfig();
  config.conflict = {
    detectedAt: new Date().toISOString(),
    remoteUpdatedAt: getEnvelopeUpdatedAt(remoteEnvelope),
  };
  config.lastError = 'Conflito Firestore: remoto mudou antes do envio local.';
  await persistSyncConfig(false);
  emitStatus('conflict', { conflict: config.conflict });
}

export async function autoPullRemoteWhenNewer() {
  const config = getConfig();
  if (!config.enabled || config.mode !== 'primary') return false;

  // Auto-clear stale conflicts
  if (config.conflict) {
    const pending = await getPendingFirestoreSnapshot();
    if (!pending) {
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(true);
      emitStatus('synced');
    } else {
      return false;
    }
  }

  const pending = await getPendingFirestoreSnapshot();
  if (pending) return false;

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) return false;
    if (!isRemoteStateNewer(remote, state)) return false;

    await yieldToUIWithBudget(50, performance.now());

    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
    const pullAt = new Date().toISOString();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: pullAt,
      hasPendingWrites: false,
      conflict: null,
      lastError: null,
    });
    await persistSyncConfig(true);
    emitPrimaryStatus('synced', { source: 'auto-pull', remoteUpdatedAt });
    emitStatus('synced');
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(true);
    emitStatus('error', { error: config.lastError });
    return false;
  }
}

async function flushFirestoreOutboxUnlocked(options = {}) {
  const config = getConfig();
  if (!config.enabled) return false;

  const startTime = performance.now();

  const pending = await getPendingFirestoreSnapshot();
  if (!options.manual && !options.forceOverwrite && !canAutoSyncFirestore(config, pending)) {
    emitStatus(config.conflict ? 'conflict-paused' : 'backoff');
    return false;
  }

  emitStatus('syncing');
  if (!pending) {
    config.hasPendingWrites = false;
    await persistSyncConfig(true);
    emitStatus('synced');
    return true;
  }

  const { db, uid } = requireSignedInServices();
  const remote = await readFirestoreSnapshot(db, uid);
  if (
    remote &&
    !options.forceOverwrite &&
    pending.envelope.baseRemoteUpdatedAt !== getEnvelopeUpdatedAt(remote)
  ) {
    await registerConflict(remote, pending.envelope);
    return false;
  }

  await yieldToUIWithBudget(50, startTime);

  const result = await writeFirestoreSnapshot(db, uid, pending.envelope);
  await markFirestoreSnapshotSynced();
  await clearFirestoreConflict();
  await saveFirestoreMeta({
    uid,
    remoteUpdatedAt: result.updatedAt,
    lastPushAt: new Date().toISOString(),
  });
  Object.assign(config, {
    uid,
    remoteUpdatedAt: result.updatedAt,
    lastPushAt: new Date().toISOString(),
    hasPendingWrites: false,
    conflict: null,
    lastError: null,
  });
  await persistSyncConfig(false);
  startPolling();
  emitStatus('synced');
  return true;
}

export async function flushFirestoreOutbox(options = {}) {
  return firestoreLock.withLock(() => flushFirestoreOutboxUnlocked(options));
}

export async function pullFromFirestore(forceOverwrite = false) {
  const config = getConfig();
  if (!config.enabled && !forceOverwrite) return false;
  emitStatus('syncing');

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
      if (!queued) return false;
      return await flushFirestoreOutbox({ manual: true });
    }

    const pending = await getPendingFirestoreSnapshot();
    if (pending && !forceOverwrite) {
      await registerConflict(remote, pending.envelope);
      return false;
    }

    if (forceOverwrite || isRemoteNewer(remote, state)) {
      await yieldToUIWithBudget(50, performance.now());
      const nextState = applyEnvelopeToLocalState(remote, config);
      setState(nextState, { merge: true });
      await clearFirestoreConflict();
      await markFirestoreSnapshotSynced();
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        lastPullAt: new Date().toISOString(),
      });
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitPrimaryStatus('remote-applied', { remoteUpdatedAt: getEnvelopeUpdatedAt(remote) });
    }

    Object.assign(getConfig(), {
      uid,
      remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
      lastPullAt: new Date().toISOString(),
      hasPendingWrites: false,
      conflict: null,
      lastError: null,
    });
    await persistSyncConfig(true);
    emitStatus('synced');
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus('error', { error: config.lastError });
    return false;
  }
}

export async function previewFirestoreRestore() {
  const { db, uid } = requireSignedInServices();

  const remote = await readFirestoreSnapshot(db, uid);
  if (!remote) return null;
  return applyEnvelopeToLocalState(remote, getConfig());
}

export async function forcePushFirestore() {
  const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
  if (!queued) return false;
  return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
}

async function syncFirestoreNowUnlocked() {
  const config = getConfig();

  await reconcileFirestorePendingState(true);

  // Force-clear stale conflicts on manual sync (user-initiated resolution)
  if (config.conflict) {
    config.conflict = null;
    config.lastError = null;
    await persistSyncConfig(true);
  }

  const { db, uid } = requireSignedInServices();
  const remote = await readFirestoreSnapshot(db, uid);
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  const pending = await getPendingFirestoreSnapshot();

  // Skip conflict check for manual sync - force push instead
  // The user explicitly wants to sync, so we trust their intent
  if (remote && !pending && isRemoteNewer(remote, state)) {
    await yieldToUIWithBudget(50, performance.now());
    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: new Date().toISOString() });
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
    });
    emitPrimaryStatus('synced', { source: 'sync-now-pull', remoteUpdatedAt });
    emitStatus('synced');
    return true;
  }

  if (remoteUpdatedAt) {
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: new Date().toISOString(),
      lastError: null,
    });
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: config.lastPullAt });
    await persistSyncConfig(true);
  }

  const queued = await queueFirestoreSnapshotFromState(state, {
    manual: true,
    baseRemoteUpdatedAt: remoteUpdatedAt || config.remoteUpdatedAt || null,
  });
  if (!queued) return false;
  // Force overwrite on manual sync to bypass stale conflict checks
  return await flushFirestoreOutboxUnlocked({ manual: true, forceOverwrite: true });
}

export async function syncFirestoreNow() {
  return firestoreLock.withLock(() => syncFirestoreNowUnlocked());
}

export async function mergeFromFirestore() {
  const config = getConfig();
  emitStatus('syncing');

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      return await forcePushFirestore();
    }

    await yieldToUIWithBudget(50, performance.now());

    const previousSyncConfig = { ...config };
    const merged = mergeStudyStates(state, remote.payload || {});
    setState(merged, { merge: true });
    const mergeConflict = merged.config?.syncMergeConflicts;
    if (mergeConflict) {
      const conflict = {
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        localUpdatedAt: getEnvelopeUpdatedAt(
          createFirestoreSnapshotEnvelope(state, { manual: true })
        ),
        detectedAt: mergeConflict.detectedAt,
        reason: 'merge-collision',
        total: mergeConflict.total,
        items: mergeConflict.items,
      };
      Object.assign(getConfig(), {
        ...previousSyncConfig,
        uid,
        enabled: true,
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        lastPullAt: new Date().toISOString(),
        conflict,
        lastError: 'Conflito Firestore: itens com o mesmo ID possuem conteudo diferente.',
        hasPendingWrites: true,
      });
      await saveFirestoreConflict(conflict);
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitPrimaryStatus('conflict', { conflict });
      emitStatus('conflict', { conflict });
      return false;
    }
    Object.assign(getConfig(), {
      ...previousSyncConfig,
      uid,
      enabled: true,
      remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
      lastPullAt: new Date().toISOString(),
      conflict: null,
      lastError: null,
      hasPendingWrites: true,
    });

    await clearFirestoreConflict();
    await saveStateToDB({ skipCloudSync: true, skipFirestoreSync: true, skipDriveSync: true });
    const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
    if (!queued) return false;
    const ok = await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
    emitPrimaryStatus('merged', { source: 'snapshot' });
    document.dispatchEvent(
      new CustomEvent('app:showToast', {
        detail: { msg: 'Firestore mesclado com os dados locais.', type: 'success' },
      })
    );
    return ok;
  } catch (err) {
    document.dispatchEvent(
      new CustomEvent('app:showToast', {
        detail: { msg: 'Erro ao mesclar dados do Firestore', type: 'error' },
      })
    );
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus('error', { error: config.lastError });
    return false;
  }
}
