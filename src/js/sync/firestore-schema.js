import { createExportableState, DEFAULT_SCHEMA_VERSION } from '../store.js?v=8.20';

export const FIRESTORE_SYNC_VERSION = 1;
export const FIRESTORE_SNAPSHOT_DOC_ID = 'main';
export const FIRESTORE_DEVICE_ID_KEY = 'estudo_firestore_device_id';

export function getFirestoreDeviceId() {
  let id = localStorage.getItem(FIRESTORE_DEVICE_ID_KEY);
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(FIRESTORE_DEVICE_ID_KEY, id);
  }
  return id;
}

export function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? new Date().toISOString() : new Date(time).toISOString();
}

export function getFirestoreSyncConfig(state) {
  return state?.config?.firestoreSync || {};
}

export function createDefaultFirestoreSyncConfig(overrides = {}) {
  return {
    enabled: false,
    mode: 'shadow',
    uid: null,
    lastPullAt: null,
    lastPushAt: null,
    remoteUpdatedAt: null,
    hasPendingWrites: false,
    conflict: null,
    lastError: null,
    ...overrides
  };
}

export function createFirestoreSnapshotEnvelope(sourceState, options = {}) {
  const syncConfig = getFirestoreSyncConfig(sourceState);
  const payload = createExportableState(sourceState);
  if (!payload.config) payload.config = {};
  payload.config.firestoreSync = createDefaultFirestoreSyncConfig();

  const payloadUpdatedAt = toIsoTimestamp(
    options.payloadUpdatedAt
      || sourceState?.config?._lastUpdated
      || sourceState?.config?.localBackupAt
      || Date.now()
  );

  return {
    version: FIRESTORE_SYNC_VERSION,
    schemaVersion: sourceState?.schemaVersion || DEFAULT_SCHEMA_VERSION,
    deviceId: options.deviceId || getFirestoreDeviceId(),
    baseRemoteUpdatedAt: options.baseRemoteUpdatedAt ?? syncConfig.remoteUpdatedAt ?? null,
    payloadUpdatedAt,
    sentAt: toIsoTimestamp(options.sentAt || Date.now()),
    payload
  };
}

export function isFirestoreSnapshotEnvelope(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.version === FIRESTORE_SYNC_VERSION
    && value.payload
    && typeof value.payload === 'object'
  );
}

export function getEnvelopeUpdatedAt(envelope) {
  return envelope?.payloadUpdatedAt || envelope?.updatedAt || null;
}

export function isRemoteNewer(remoteEnvelope, localState) {
  const remoteTime = new Date(getEnvelopeUpdatedAt(remoteEnvelope) || 0).getTime();
  const localTime = new Date(
    localState?.config?._lastUpdated
      || localState?.config?.localBackupAt
      || 0
  ).getTime();
  return remoteTime > localTime;
}

export function applyEnvelopeToLocalState(envelope, previousSyncConfig = {}) {
  if (!isFirestoreSnapshotEnvelope(envelope)) {
    throw new Error('Envelope Firestore invalido.');
  }
  const nextState = createExportableState(envelope.payload);
  if (!nextState.config) nextState.config = {};
  nextState.config.firestoreSync = createDefaultFirestoreSyncConfig({
    ...previousSyncConfig,
    enabled: true,
    mode: previousSyncConfig.mode || 'shadow',
    remoteUpdatedAt: getEnvelopeUpdatedAt(envelope),
    lastPullAt: new Date().toISOString(),
    hasPendingWrites: false,
    conflict: null,
    lastError: null
  });
  return nextState;
}
