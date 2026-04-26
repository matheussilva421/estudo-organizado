import { getFirebaseConfigStatus, initFirebaseServices, observeFirebaseAuth, signInWithGoogle, signOutFirebase } from '../firebase/firebase-client.js?v=8.19';
import { saveStateToDB, setState, state, SyncQueue } from '../store.js?v=8.19';
import {
  applyEnvelopeToLocalState,
  createDefaultFirestoreSyncConfig,
  createFirestoreSnapshotEnvelope,
  getEnvelopeUpdatedAt,
  isRemoteNewer
} from './firestore-schema.js?v=8.19';
import {
  clearFirestoreConflict,
  enqueueFirestoreSnapshot,
  getPendingFirestoreSnapshot,
  markFirestoreSnapshotFailed,
  markFirestoreSnapshotSynced,
  saveFirestoreConflict,
  saveFirestoreMeta
} from './firestore-outbox.js?v=8.19';
import { readFirestoreSnapshot, writeFirestoreSnapshot } from './firestore-repository.js?v=8.19';
import { canAutoSyncFirestore, mergeStudyStates } from './sync-center.js?v=8.19';

let currentUser = null;
let authUnsubscribe = null;
let isFlushing = false;

function getConfig() {
  if (!state.config) state.config = {};
  state.config.firestoreSync = createDefaultFirestoreSyncConfig(state.config.firestoreSync || {});
  return state.config.firestoreSync;
}

function emitStatus(status, detail = {}) {
  const config = getConfig();
  Object.assign(config, detail.config || {});
  document.dispatchEvent(new CustomEvent('app:firestoreSyncStatus', {
    detail: {
      status,
      uid: currentUser?.uid || config.uid || null,
      mode: config.mode,
      hasPendingWrites: !!config.hasPendingWrites,
      lastError: config.lastError || null,
      ...detail
    }
  }));
}

async function persistSyncConfig(skipRender = true) {
  await saveStateToDB(true, true, true);
  if (!skipRender) document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function getFirestoreSyncStatus() {
  const services = initFirebaseServices();
  const configStatus = getFirebaseConfigStatus();
  const config = getConfig();
  return {
    configured: services.configured,
    projectId: configStatus.projectId,
    authDomain: configStatus.authDomain,
    signedIn: !!currentUser,
    uid: currentUser?.uid || config.uid || null,
    email: currentUser?.email || null,
    ...config
  };
}

export function initFirestoreSync() {
  const services = initFirebaseServices();
  const config = getConfig();

  if (!services.configured) {
    emitStatus('unconfigured', { config: { lastError: null } });
    return;
  }

  if (authUnsubscribe) return;
  authUnsubscribe = observeFirebaseAuth((user) => {
    currentUser = user;
    const syncConfig = getConfig();
    syncConfig.uid = user?.uid || null;
    if (!user) {
      syncConfig.hasPendingWrites = false;
      emitStatus('signed-out');
      document.dispatchEvent(new Event('app:renderCurrentView'));
      return;
    }
    emitStatus('signed-in', { config: { uid: user.uid, lastError: null } });
    document.dispatchEvent(new Event('app:renderCurrentView'));
    if (syncConfig.enabled) {
      SyncQueue.add(() => pullFromFirestore()).catch(err => console.error('Firestore boot pull failed:', err));
      SyncQueue.add(() => flushFirestoreOutbox()).catch(err => console.error('Firestore boot push failed:', err));
    }
  });
}

export async function firestoreSignIn() {
  const credential = await signInWithGoogle();
  currentUser = credential.user;
  getConfig().uid = currentUser.uid;
  await persistSyncConfig(false);
  return currentUser;
}

export async function firestoreSignOut() {
  await signOutFirebase();
  currentUser = null;
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
  await queueFirestoreSnapshotFromState(state, { manual: true });
  await persistSyncConfig(false);
  return await flushFirestoreOutbox({ manual: true });
}

export async function disableFirestoreSync() {
  const config = getConfig();
  config.enabled = false;
  config.hasPendingWrites = false;
  config.lastError = null;
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
  const envelope = createFirestoreSnapshotEnvelope(sourceState);
  const queued = await enqueueFirestoreSnapshot(envelope);
  if (queued) {
    config.hasPendingWrites = true;
    config.lastError = null;
    emitStatus('pending');
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
  const conflict = {
    remoteUpdatedAt: getEnvelopeUpdatedAt(remoteEnvelope),
    localUpdatedAt: getEnvelopeUpdatedAt(localEnvelope),
    detectedAt: new Date().toISOString(),
    remoteDeviceId: remoteEnvelope?.deviceId || null,
    localDeviceId: localEnvelope?.deviceId || null
  };
  config.conflict = conflict;
  config.hasPendingWrites = true;
  config.lastError = 'Conflito Firestore: remoto mudou antes do envio local.';
  await saveFirestoreConflict(conflict);
  await persistSyncConfig(false);
  document.dispatchEvent(new CustomEvent('app:firestoreConflictDetected', { detail: conflict }));
  emitStatus('conflict', { conflict });
}

export async function flushFirestoreOutbox(options = {}) {
  if (isFlushing) return false;
  const config = getConfig();
  if (!config.enabled) return false;

  isFlushing = true;
  try {
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
    if (remote && !options.forceOverwrite && pending.envelope.baseRemoteUpdatedAt !== getEnvelopeUpdatedAt(remote)) {
      await registerConflict(remote, pending.envelope);
      return false;
    }

    const result = await writeFirestoreSnapshot(db, uid, pending.envelope);
    await markFirestoreSnapshotSynced();
    await clearFirestoreConflict();
    await saveFirestoreMeta({ uid, remoteUpdatedAt: result.updatedAt, lastPushAt: new Date().toISOString() });
    Object.assign(config, {
      uid,
      remoteUpdatedAt: result.updatedAt,
      lastPushAt: new Date().toISOString(),
      hasPendingWrites: false,
      conflict: null,
      lastError: null
    });
    await persistSyncConfig(false);
    emitStatus('synced');
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    config.hasPendingWrites = true;
    await markFirestoreSnapshotFailed(err);
    await persistSyncConfig(false);
    emitStatus('error', { error: config.lastError });
    return false;
  } finally {
    isFlushing = false;
  }
}

export async function pullFromFirestore(forceOverwrite = false) {
  const config = getConfig();
  if (!config.enabled && !forceOverwrite) return false;
  emitStatus('syncing');

  try {
    const { db, uid } = requireSignedInServices();
    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      await queueFirestoreSnapshotFromState(state);
      return await flushFirestoreOutbox();
    }

    const pending = await getPendingFirestoreSnapshot();
    if (pending && !forceOverwrite) {
      await registerConflict(remote, pending.envelope);
      return false;
    }

    if (forceOverwrite || isRemoteNewer(remote, state)) {
      const nextState = applyEnvelopeToLocalState(remote, config);
      setState(nextState);
      await clearFirestoreConflict();
      await saveFirestoreMeta({ uid, remoteUpdatedAt: getEnvelopeUpdatedAt(remote), lastPullAt: new Date().toISOString() });
      await saveStateToDB(true, true, true);
      document.dispatchEvent(new Event('app:renderCurrentView'));
    }

    Object.assign(getConfig(), {
      uid,
      remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
      lastPullAt: new Date().toISOString(),
      conflict: null,
      lastError: null
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

export async function forcePushFirestore() {
  await queueFirestoreSnapshotFromState(state, { manual: true });
  return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
}

export async function syncFirestoreNow() {
  const config = getConfig();
  if (config.conflict) {
    emitStatus('conflict-paused', { conflict: config.conflict });
    return false;
  }
  await queueFirestoreSnapshotFromState(state, { manual: true });
  return await flushFirestoreOutbox({ manual: true });
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

    const previousSyncConfig = { ...config };
    const merged = mergeStudyStates(state, remote.payload || {});
    setState(merged);
    Object.assign(getConfig(), {
      ...previousSyncConfig,
      uid,
      enabled: true,
      remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
      lastPullAt: new Date().toISOString(),
      conflict: null,
      lastError: null,
      hasPendingWrites: true
    });

    await clearFirestoreConflict();
    await saveStateToDB(true, true);
    await queueFirestoreSnapshotFromState(state, { manual: true });
    const ok = await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
    document.dispatchEvent(new Event('app:renderCurrentView'));
    document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Firestore mesclado com os dados locais.', type: 'success' } }));
    return ok;
  } catch (err) {
    document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Erro ao mesclar dados do Firestore', type: 'error' } }));
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus('error', { error: config.lastError });
    return false;
  }
}
