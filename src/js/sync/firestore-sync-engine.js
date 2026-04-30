import {
  completeGoogleRedirectSignIn,
  getFirebaseConfigStatus,
  initFirebaseServices,
  observeFirebaseAuth,
  signInWithGoogle,
  signOutFirebase,
} from '../firebase/firebase-client.js?v=8.30';
import { saveStateToDB, setState, state } from '../store.js?v=8.30';
import {
  applyEnvelopeToLocalState,
  createDefaultFirestoreSyncConfig,
  createFirestoreSnapshotEnvelope,
  getEnvelopeUpdatedAt,
  isRemoteNewer,
} from './firestore-schema.js?v=8.30';
import {
  clearFirestoreConflict,
  enqueueFirestoreSnapshot,
  getPendingFirestoreSnapshot,
  markFirestoreSnapshotFailed,
  markFirestoreSnapshotSynced,
  saveFirestoreConflict,
  saveFirestoreMeta,
} from './firestore-outbox.js?v=8.30';
import {
  readFirestoreSnapshot,
  watchFirestoreSnapshot,
  writeFirestoreSnapshot,
} from './firestore-repository.js?v=8.30';
import { canAutoSyncFirestore, mergeStudyStates } from './sync-center.js?v=8.30';
import { applyEntityDocsToState } from './entity-state-builder.js?v=8.30';
import {
  getPendingFirestoreEntityBatch,
  markFirestoreEntityBatchSynced,
  queueFirestoreEntityBatchFromState,
} from './firestore-entity-outbox.js?v=8.30';
import {
  readFirestoreEntityDocuments,
  writeFirestoreEntityDocuments,
} from './firestore-repository.js?v=8.30';
import { compareSnapshotManifestToEntityDocs } from './entity-shadow-verifier.js?v=8.30';
import { visitTrackedEntities } from './entity-metadata.js?v=8.30';

let currentUser = null;
let authUnsubscribe = null;
let snapshotUnsubscribe = null;
let isFlushing = false;

function getConfig() {
  if (!state.config) state.config = {};
  state.config.firestoreSync = createDefaultFirestoreSyncConfig(state.config.firestoreSync || {});
  return state.config.firestoreSync;
}

function emitStatus(status, detail = {}) {
  const config = getConfig();
  Object.assign(config, detail.config || {});
  document.dispatchEvent(
    new CustomEvent('app:firestoreSyncStatus', {
      detail: {
        status,
        uid: currentUser?.uid || config.uid || null,
        mode: config.mode,
        hasPendingWrites: !!config.hasPendingWrites,
        lastError: config.lastError || null,
        ...detail,
      },
    })
  );
}

async function persistSyncConfig(skipRender = true) {
  await saveStateToDB(true, true, true, { touchLocalBackup: false });
  if (!skipRender) document.dispatchEvent(new Event('app:renderCurrentView'));
}

async function reconcileFirestorePendingState(skipRender = true) {
  const config = getConfig();
  const pending = await getPendingFirestoreSnapshot();
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

function shouldWatchPrimaryFirestore() {
  const config = getConfig();
  return Boolean(config.enabled && config.mode === 'primary' && currentUser);
}

function stopFirestoreRemoteWatch() {
  if (snapshotUnsubscribe) {
    snapshotUnsubscribe();
    snapshotUnsubscribe = null;
  }
}

async function applyRemoteSnapshotFromWatch(remote) {
  if (!remote || isFlushing || !shouldWatchPrimaryFirestore()) return;
  if (isEntityPrimaryEnabled()) return;
  if (!currentUser?.uid) return;

  const config = getConfig();
  const pending = await getPendingFirestoreSnapshot();
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);

  if (pending) {
    const pendingUpdatedAt = getEnvelopeUpdatedAt(pending.envelope);
    if (pendingUpdatedAt && pendingUpdatedAt === remoteUpdatedAt) return;
    await registerConflict(remote, pending.envelope);
    return;
  }

  if (!isRemoteNewer(remote, state)) {
    if (remoteUpdatedAt && remoteUpdatedAt !== config.remoteUpdatedAt) {
      Object.assign(config, {
        remoteUpdatedAt,
        lastPullAt: new Date().toISOString(),
        lastError: null,
      });
      await saveFirestoreMeta({
        uid: currentUser.uid,
        remoteUpdatedAt,
        lastPullAt: config.lastPullAt,
      });
      await persistSyncConfig(true);
      emitStatus('synced');
    }
    return;
  }

  const nextState = applyEnvelopeToLocalState(remote, config);
  setState(nextState);
  await clearFirestoreConflict();
  await markFirestoreSnapshotSynced();
  await saveFirestoreMeta({
    uid: currentUser.uid,
    remoteUpdatedAt,
    lastPullAt: new Date().toISOString(),
  });
  await saveStateToDB(true, true, true, { touchLocalBackup: false });
  document.dispatchEvent(new Event('app:renderCurrentView'));
  emitStatus('synced');
}

function startFirestoreRemoteWatch() {
  if (snapshotUnsubscribe || !shouldWatchPrimaryFirestore()) return;
  const { db, uid } = requireSignedInServices();
  snapshotUnsubscribe = watchFirestoreSnapshot(
    db,
    uid,
    (remote) => {
      applyRemoteSnapshotFromWatch(remote).catch((err) => {
        const config = getConfig();
        config.lastError = err.message || String(err);
        persistSyncConfig(false).catch((persistErr) => {
          console.error('Failed to persist sync config after watch error:', persistErr);
        });
        emitStatus('error', { error: config.lastError });
      });
    },
    (err) => {
      const config = getConfig();
      config.lastError = err.message || String(err);
      persistSyncConfig(false).catch((persistErr) => {
        console.error('Failed to persist sync config after watch error:', persistErr);
      });
      emitStatus('error', { error: config.lastError });
    }
  );
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
    ...config,
  };
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
      stopFirestoreRemoteWatch();
      syncConfig.hasPendingWrites = false;
      emitStatus('signed-out');
      document.dispatchEvent(new Event('app:renderCurrentView'));
      return;
    }
    emitStatus('signed-in', { config: { uid: user.uid, lastError: null } });
    reconcileFirestorePendingState(false).catch((err) => {
      console.warn('Firestore pending state repair failed:', err);
    });
    startFirestoreRemoteWatch();
    requestPrimarySync('signed-in');
    document.dispatchEvent(new Event('app:renderCurrentView'));
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
  startFirestoreRemoteWatch();
  requestPrimarySync('signed-in');
  return currentUser;
}

export async function firestoreSignOut() {
  await signOutFirebase();
  currentUser = null;
  stopFirestoreRemoteWatch();
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
  startFirestoreRemoteWatch();
  if (config.mode === 'primary') requestPrimarySync('enabled');
  return true;
}

export async function disableFirestoreSync() {
  const config = getConfig();
  config.enabled = false;
  config.hasPendingWrites = false;
  config.lastError = null;
  stopFirestoreRemoteWatch();
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
    const entityMode = state.config?.entitySync?.mode;
    if (
      state.config?.entitySync?.enabled &&
      (entityMode === 'shadow' || entityMode === 'primary')
    ) {
      await queueFirestoreEntityBatchFromState(sourceState, options);
    }
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

function canShadowWriteEntities(config = getConfig()) {
  const entitySync = state.config?.entitySync || {};
  return Boolean(
    config.enabled &&
    config.mode === 'primary' &&
    entitySync.enabled &&
    entitySync.mode === 'shadow'
  );
}

function isEntityPrimaryEnabled() {
  const entitySync = state.config?.entitySync || {};
  return Boolean(entitySync.enabled && entitySync.mode === 'primary');
}

function getConflictEntityKey(record = {}) {
  return record.key || `${record.collection}/${record.id}`;
}

function entityMatchesKey(record = {}, entityKey) {
  return (
    getConflictEntityKey(record) === entityKey || `${record.collection}/${record.id}` === entityKey
  );
}

function upsertEntityInStateByRecord(targetState = {}, record = {}) {
  if (!record || !record.entity || !record.collection || !record.id) return false;
  const { collection, id, key, entity } = record;
  const upsert = (list) => {
    if (!Array.isArray(list)) return false;
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) list.push(entity);
    else list[index] = entity;
    return true;
  };

  if (collection === 'editais') {
    if (!Array.isArray(targetState.editais)) targetState.editais = [];
    return upsert(targetState.editais);
  }
  if (collection === 'eventos' || collection === 'arquivo' || collection === 'revisoes') {
    if (!Array.isArray(targetState[collection])) targetState[collection] = [];
    return upsert(targetState[collection]);
  }
  if (collection.startsWith('habitos.')) {
    const type = collection.replace('habitos.', '');
    if (!targetState.habitos || typeof targetState.habitos !== 'object') targetState.habitos = {};
    if (!Array.isArray(targetState.habitos[type])) targetState.habitos[type] = [];
    return upsert(targetState.habitos[type]);
  }
  if (collection === 'planejamento.sequencia') {
    if (!targetState.planejamento || typeof targetState.planejamento !== 'object') {
      targetState.planejamento = {};
    }
    if (!Array.isArray(targetState.planejamento.sequencia)) targetState.planejamento.sequencia = [];
    return upsert(targetState.planejamento.sequencia);
  }

  const segments = String(key || '').split('/');
  const edital = (targetState.editais || []).find((entry) => entry.id === segments[1]);
  if (!edital) return false;

  if (collection === 'disciplinas') {
    if (!Array.isArray(edital.disciplinas)) edital.disciplinas = [];
    return upsert(edital.disciplinas);
  }

  const disciplina = (edital.disciplinas || []).find((entry) => entry.id === segments[3]);
  if (!disciplina) return false;
  const listName = collection === 'assuntos' ? 'assuntos' : collection === 'aulas' ? 'aulas' : null;
  if (!listName) return false;
  if (!Array.isArray(disciplina[listName])) disciplina[listName] = [];
  return upsert(disciplina[listName]);
}

function removeEntityFromStateByConflictItem(targetState = {}, item = {}) {
  const { collection, id, key } = item;
  const remove = (list) => {
    if (!Array.isArray(list)) return false;
    const next = list.filter((entry) => entry.id !== id);
    const changed = next.length !== list.length;
    list.splice(0, list.length, ...next);
    return changed;
  };

  if (collection === 'editais') return remove(targetState.editais);
  if (collection === 'eventos' || collection === 'arquivo' || collection === 'revisoes') {
    return remove(targetState[collection]);
  }
  if (collection?.startsWith('habitos.')) {
    const type = collection.replace('habitos.', '');
    return remove(targetState.habitos?.[type]);
  }
  if (collection === 'planejamento.sequencia') return remove(targetState.planejamento?.sequencia);

  const segments = String(key || '').split('/');
  const edital = (targetState.editais || []).find((entry) => entry.id === segments[1]);
  if (!edital) return false;
  if (collection === 'disciplinas') return remove(edital.disciplinas);
  const disciplina = (edital.disciplinas || []).find((entry) => entry.id === segments[3]);
  if (!disciplina) return false;
  if (collection === 'assuntos') return remove(disciplina.assuntos);
  if (collection === 'aulas') return remove(disciplina.aulas);
  return false;
}

export async function flushFirestoreEntityOutbox(options = {}) {
  const config = getConfig();
  const isPrimary = isEntityPrimaryEnabled() || Boolean(options.primary);
  if (!options.manual && !canShadowWriteEntities(config) && !isPrimary) return false;
  const pending = await getPendingFirestoreEntityBatch();
  if (!pending || pending.status !== 'pending') return false;
  const { db, uid } = requireSignedInServices();
  const result = await writeFirestoreEntityDocuments(db, uid, pending.docs || []);
  await markFirestoreEntityBatchSynced();
  if (!state.config.entitySync) state.config.entitySync = {};
  Object.assign(state.config.entitySync, {
    enabled: true,
    mode: isPrimary ? 'primary' : 'shadow',
    lastShadowPushAt: new Date().toISOString(),
    lastError: null,
  });
  await persistSyncConfig(false);
  emitStatus('synced', { entityShadowCount: result.count });
  return true;
}

async function forcePushFirestoreEntities() {
  const queued = await queueFirestoreEntityBatchFromState(state, { manual: true });
  if (!queued) return false;
  getConfig().hasPendingWrites = true;
  return await flushFirestoreEntityOutbox({ manual: true, primary: true });
}

export async function verifyFirestoreEntityShadow() {
  const _config = getConfig();
  const { db, uid } = requireSignedInServices();
  const snapshot = await readFirestoreSnapshot(db, uid);
  const entityDocs = await readFirestoreEntityDocuments(db, uid);
  const diff = compareSnapshotManifestToEntityDocs(snapshot || {}, entityDocs);
  if (!state.config.entitySync) state.config.entitySync = {};
  Object.assign(state.config.entitySync, {
    enabled: true,
    mode: state.config.entitySync.mode || 'shadow',
    lastShadowReadAt: new Date().toISOString(),
    lastShadowDiff: diff,
    lastError: diff.ok ? null : 'Entity shadow diverge do snapshot.',
  });
  await persistSyncConfig(false);
  document.dispatchEvent(new Event('app:renderCurrentView'));
  emitStatus(diff.ok ? 'synced' : 'error', { entityShadowDiff: diff });
  return diff;
}

function indexManifest(manifest = []) {
  return new Map((manifest || []).map((item) => [item.key, item]));
}

function describeEntityManifestDiff(remoteEnvelope, localEnvelope) {
  const remote = indexManifest(remoteEnvelope?.entityManifest || []);
  const local = indexManifest(localEnvelope?.entityManifest || []);
  const keys = new Set([...remote.keys(), ...local.keys()]);
  const items = [];

  for (const key of keys) {
    const remoteItem = remote.get(key);
    const localItem = local.get(key);
    if (!remoteItem || !localItem) {
      items.push({
        key,
        collection: (remoteItem || localItem)?.collection || key.split('/')[0],
        id: (remoteItem || localItem)?.id || key.split('/').pop(),
        localRevision: localItem?.revision ?? null,
        remoteRevision: remoteItem?.revision ?? null,
        localUpdatedAt: localItem?.updatedAt || localItem?.deletedAt || null,
        remoteUpdatedAt: remoteItem?.updatedAt || remoteItem?.deletedAt || null,
      });
      continue;
    }
    if (
      remoteItem.checksum !== localItem.checksum ||
      remoteItem.revision !== localItem.revision ||
      remoteItem.deletedAt !== localItem.deletedAt
    ) {
      items.push({
        key,
        collection: localItem.collection || remoteItem.collection,
        id: localItem.id || remoteItem.id,
        localRevision: localItem.revision ?? null,
        remoteRevision: remoteItem.revision ?? null,
        localUpdatedAt: localItem.updatedAt || localItem.deletedAt || null,
        remoteUpdatedAt: remoteItem.updatedAt || remoteItem.deletedAt || null,
      });
    }
    if (items.length >= 20) break;
  }

  return items;
}

async function registerConflict(remoteEnvelope, localEnvelope) {
  const config = getConfig();
  const items = describeEntityManifestDiff(remoteEnvelope, localEnvelope);
  const conflict = {
    remoteUpdatedAt: getEnvelopeUpdatedAt(remoteEnvelope),
    localUpdatedAt: getEnvelopeUpdatedAt(localEnvelope),
    detectedAt: new Date().toISOString(),
    remoteDeviceId: remoteEnvelope?.deviceId || null,
    localDeviceId: localEnvelope?.deviceId || null,
    items,
    total: items.length,
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
    if (
      remote &&
      !options.forceOverwrite &&
      pending.envelope.baseRemoteUpdatedAt !== getEnvelopeUpdatedAt(remote)
    ) {
      await registerConflict(remote, pending.envelope);
      return false;
    }

    if (isEntityPrimaryEnabled()) {
      const entityFlushed = await flushFirestoreEntityOutbox({
        manual: options.manual,
        primary: true,
      });
      if (!entityFlushed) {
        config.lastError = 'Falha no envio de entidades Firestore; push interrompido.';
        config.hasPendingWrites = true;
        return false;
      }
    }

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
    if (canShadowWriteEntities(config)) {
      await flushFirestoreEntityOutbox({ manual: options.manual });
    }
    await persistSyncConfig(false);
    startFirestoreRemoteWatch();
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
    const entitySync = state.config?.entitySync || {};
    const useEntityPrimary = entitySync.enabled && entitySync.mode === 'primary';

    if (useEntityPrimary) {
      const pendingEntity = await getPendingFirestoreEntityBatch();
      if (pendingEntity && pendingEntity.status === 'pending' && !forceOverwrite) {
        const entityFlushed = await flushFirestoreEntityOutbox({ manual: true, primary: true });
        if (!entityFlushed) {
          config.lastError = 'Entidades pendentes falharam no envio antes do pull.';
          config.hasPendingWrites = true;
          await persistSyncConfig(false);
          emitStatus('error', { error: config.lastError });
          return false;
        }
      }

      const entityDocs = await readFirestoreEntityDocuments(db, uid);
      if (!entityDocs.length) {
        return await forcePushFirestoreEntities();
      }

      const pullAt = new Date().toISOString();
      const maxEntityUpdatedAt = entityDocs.reduce((max, doc) => {
        const t = doc.updatedAt || '';
        return t > max ? t : max;
      }, '');

      const nextState = applyEntityDocsToState(state, entityDocs);
      setState(nextState);
      await clearFirestoreConflict();
      await markFirestoreEntityBatchSynced();
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: maxEntityUpdatedAt || pullAt,
        lastPullAt: pullAt,
      });
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      document.dispatchEvent(new Event('app:renderCurrentView'));

      Object.assign(getConfig(), {
        uid,
        remoteUpdatedAt: maxEntityUpdatedAt || pullAt,
        lastPullAt: pullAt,
        hasPendingWrites: false,
        conflict: null,
        lastError: null,
      });
      await persistSyncConfig(true);
      emitStatus('synced');
      return true;
    }

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
      const nextState = applyEnvelopeToLocalState(remote, config);
      setState(nextState);
      await clearFirestoreConflict();
      await markFirestoreSnapshotSynced();
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        lastPullAt: new Date().toISOString(),
      });
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      document.dispatchEvent(new Event('app:renderCurrentView'));
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

export async function forcePushFirestore() {
  const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
  if (!queued) return false;
  return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
}

export async function syncFirestoreNow() {
  const config = getConfig();
  const entitySync = state.config?.entitySync || {};
  const useEntityPrimary = entitySync.enabled && entitySync.mode === 'primary';

  await reconcileFirestorePendingState(true);
  if (config.conflict) {
    emitStatus('conflict-paused', { conflict: config.conflict });
    return false;
  }

  if (useEntityPrimary) {
    const { db, uid } = requireSignedInServices();
    const entityDocs = await readFirestoreEntityDocuments(db, uid);
    const maxEntityUpdatedAt = entityDocs.reduce((max, d) => {
      const t = d.updatedAt || '';
      return t > max ? t : max;
    }, '');
    if (
      entityDocs.length &&
      isRemoteNewer(
        {
          payloadUpdatedAt: maxEntityUpdatedAt,
        },
        state
      )
    ) {
      const pullAt = new Date().toISOString();
      const nextState = applyEntityDocsToState(state, entityDocs);
      setState(nextState);
      await clearFirestoreConflict();
      await markFirestoreEntityBatchSynced();
      Object.assign(getConfig(), {
        uid,
        remoteUpdatedAt: maxEntityUpdatedAt || pullAt,
        lastPullAt: pullAt,
        hasPendingWrites: false,
        conflict: null,
        lastError: null,
      });
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: maxEntityUpdatedAt || pullAt,
        lastPullAt: pullAt,
      });
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      document.dispatchEvent(new Event('app:renderCurrentView'));
      emitStatus('synced');
      return true;
    }
    const queued = await queueFirestoreEntityBatchFromState(state, { manual: true });
    if (!queued) return false;
    return await flushFirestoreEntityOutbox({ manual: true, primary: true });
  }

  const { db, uid } = requireSignedInServices();
  const remote = await readFirestoreSnapshot(db, uid);
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  const pending = await getPendingFirestoreSnapshot();

  if (remote && pending && pending.envelope.baseRemoteUpdatedAt !== remoteUpdatedAt) {
    await registerConflict(remote, pending.envelope);
    return false;
  }

  if (remote && !pending && isRemoteNewer(remote, state)) {
    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState);
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: new Date().toISOString() });
    await saveStateToDB(true, true, true, { touchLocalBackup: false });
    document.dispatchEvent(new Event('app:renderCurrentView'));
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
  return await flushFirestoreOutbox({ manual: true });
}

export async function mergeFromFirestore() {
  const config = getConfig();
  const entitySync = state.config?.entitySync || {};
  const useEntityPrimary = entitySync.enabled && entitySync.mode === 'primary';
  emitStatus('syncing');

  try {
    const { db, uid } = requireSignedInServices();

    if (useEntityPrimary) {
      const remoteEntityDocs = await readFirestoreEntityDocuments(db, uid);
      if (!remoteEntityDocs.length) {
        return await forcePushFirestoreEntities();
      }
      const merged = mergeStudyStates(state, applyEntityDocsToState({}, remoteEntityDocs));
      setState(merged);
      const mergeConflict = merged.config?.syncMergeConflicts;
      if (mergeConflict) {
        const conflict = {
          remoteUpdatedAt: remoteEntityDocs.reduce((max, d) => {
            const t = d.updatedAt || '';
            return t > max ? t : max;
          }, ''),
          localUpdatedAt: new Date().toISOString(),
          detectedAt: mergeConflict.detectedAt,
          reason: 'merge-collision',
          total: mergeConflict.total,
          items: mergeConflict.items,
        };
        Object.assign(getConfig(), {
          uid,
          enabled: true,
          remoteUpdatedAt: conflict.remoteUpdatedAt,
          lastPullAt: new Date().toISOString(),
          conflict,
          lastError: 'Conflito Firestore: itens com o mesmo ID possuem conteudo diferente.',
          hasPendingWrites: true,
        });
        await saveFirestoreConflict(conflict);
        await saveStateToDB(true, true, true, { touchLocalBackup: false });
        document.dispatchEvent(new Event('app:renderCurrentView'));
        emitStatus('conflict', { conflict });
        return false;
      }
      Object.assign(getConfig(), {
        uid,
        enabled: true,
        remoteUpdatedAt: remoteEntityDocs.reduce((max, d) => {
          const t = d.updatedAt || '';
          return t > max ? t : max;
        }, ''),
        lastPullAt: new Date().toISOString(),
        conflict: null,
        lastError: null,
      });
      await clearFirestoreConflict();
      await saveStateToDB(true, true, true);
      const queued = await queueFirestoreEntityBatchFromState(state, { manual: true });
      if (!queued) {
        getConfig().hasPendingWrites = false;
        return false;
      }
      Object.assign(getConfig(), { hasPendingWrites: true });
      const ok = await flushFirestoreEntityOutbox({
        forceOverwrite: true,
        manual: true,
        primary: true,
      });
      document.dispatchEvent(new Event('app:renderCurrentView'));
      document.dispatchEvent(
        new CustomEvent('app:showToast', {
          detail: { msg: 'Firestore mesclado com os dados locais.', type: 'success' },
        })
      );
      return ok;
    }

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      return await forcePushFirestore();
    }

    const previousSyncConfig = { ...config };
    const merged = mergeStudyStates(state, remote.payload || {});
    setState(merged);
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
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      document.dispatchEvent(new Event('app:renderCurrentView'));
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
    await saveStateToDB(true, true, true);
    const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
    if (!queued) return false;
    const ok = await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
    document.dispatchEvent(new Event('app:renderCurrentView'));
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

export async function resolveEntityConflict(entityKey, decision) {
  const config = getConfig();
  const conflict = config.conflict;
  if (!conflict || !Array.isArray(conflict.items)) return false;

  const itemIndex = conflict.items.findIndex(
    (item) => (item.key || `${item.collection}/${item.id}`) === entityKey
  );
  if (itemIndex === -1) return false;

  const item = conflict.items[itemIndex];

  if (decision === 'remote') {
    try {
      const { db, uid } = requireSignedInServices();
      let remoteEntityRecord = null;
      let remoteDeletesEntity = false;

      if (isEntityPrimaryEnabled()) {
        const remoteEntityDocs = await readFirestoreEntityDocuments(db, uid);
        const remoteDoc = remoteEntityDocs.find((doc) => entityMatchesKey(doc, entityKey));
        if (!remoteDoc) return false;
        if (remoteDoc?.payload) {
          remoteEntityRecord = {
            collection: remoteDoc.collection,
            key: remoteDoc.key,
            id: remoteDoc.id,
            entity: remoteDoc.payload,
          };
        } else {
          remoteDeletesEntity = true;
        }
      } else {
        const remote = await readFirestoreSnapshot(db, uid);
        if (!remote || !remote.payload) return false;

        const remoteEntities = visitTrackedEntities(remote.payload);
        remoteEntityRecord = remoteEntities.find((r) => entityMatchesKey(r, entityKey));
        remoteDeletesEntity = !remoteEntityRecord;
      }

      if (remoteDeletesEntity) {
        if (!removeEntityFromStateByConflictItem(state, item)) return false;
      } else if (!remoteEntityRecord) {
        return false;
      } else if (!upsertEntityInStateByRecord(state, remoteEntityRecord)) {
        return false;
      }
    } catch (err) {
      console.error('Failed to fetch remote entity for conflict resolution:', err);
      return false;
    }
  }

  conflict.items.splice(itemIndex, 1);
  conflict.total = conflict.items.length;

  if (conflict.total === 0) {
    config.conflict = null;
    await clearFirestoreConflict();
  } else {
    await saveFirestoreConflict(conflict);
  }

  await saveStateToDB(true, true, true, { touchLocalBackup: false });
  return true;
}
