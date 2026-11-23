import { createExportableState, DEFAULT_SCHEMA_VERSION } from '../store.js?v=8.37';

export const FIRESTORE_SYNC_VERSION = 1;
export const FIRESTORE_SNAPSHOT_DOC_ID = 'main';
export const FIRESTORE_DEVICE_ID_KEY = 'estudo_firestore_device_id';
export const FIRESTORE_ENVELOPE_MAX_BYTES = 1_048_576;
// The Firestore limit applies to the encoded document, not to JSON.stringify.
// Keep a margin for the document name and protobuf framing.
export const FIRESTORE_ENVELOPE_SAFETY_BYTES = 16_384;

export function getFirestoreEnvelopeSizeBytes(envelope) {
  if (!envelope) return 0;
  const text = JSON.stringify(envelope);
  if (typeof Blob !== 'undefined') {
    return new Blob([text]).size;
  }
  return text.length;
}

function utf8Length(value) {
  const text = String(value);
  const BufferCtor = globalThis.Buffer;
  if (BufferCtor && typeof BufferCtor.byteLength === 'function') {
    return BufferCtor.byteLength(text, 'utf8');
  }
  const Encoder = globalThis.TextEncoder;
  if (typeof Encoder === 'function') {
    return new Encoder().encode(text).length;
  }
  if (typeof Blob !== 'undefined') return new Blob([text]).size;
  return text.length;
}

function varintSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 10;
  if (number < 0x80) return 1;
  if (number < 0x4000) return 2;
  if (number < 0x200000) return 3;
  if (number < 0x10000000) return 4;
  if (number < 0x800000000) return 5;
  let rest = BigInt(number);
  let bytes = 1;
  while (
    rest > 0x7fn
  ) {
    rest >>= 7n;
    bytes += 1;
  }
  return bytes;
}

function firestoreValueSize(value) {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'string') {
    const bytes = utf8Length(value);
    return 2 + varintSize(bytes) + bytes;
  }
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value)) return 1 + varintSize(value);
    return 9;
  }
  if (Array.isArray(value)) {
    let size = 1 + varintSize(value.length);
    for (const item of value) size += firestoreValueSize(item);
    return size;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    let size = 1 + varintSize(entries.length);
    for (const [key, item] of entries) {
      const keyBytes = utf8Length(key);
      size += 1 + varintSize(keyBytes) + keyBytes + firestoreValueSize(item);
    }
    return size;
  }
  return 1;
}

/**
 * Estimates the encoded Firestore document size. JSON.stringify overestimates
 * string-heavy documents because of quotes/escapes and boolean/null literals;
 * using it as the 1 MiB guard rejects payloads the server would accept.
 */
export function getFirestoreEncodedSizeBytes(documentData) {
  if (!documentData) return 0;
  return firestoreValueSize(documentData);
}

export function isFirestoreEnvelopeWithinBudget(envelope) {
  return (
    getFirestoreEncodedSizeBytes(envelope) <=
    FIRESTORE_ENVELOPE_MAX_BYTES - FIRESTORE_ENVELOPE_SAFETY_BYTES
  );
}

function stripFirestoreOperationalMetadata(payload) {
  if (payload?.config) {
    delete payload.config.manualSyncHistory;
    delete payload.config.lastManualSyncResults;
  }
  return payload;
}

/**
 * Recursively strip undefined values from an object.
 * Firestore's setDoc() rejects undefined field values — they must be omitted or null.
 */
function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const result = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue; // Omit undefined fields for Firestore
    result[key] = stripUndefined(value);
  }
  return result;
}

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

function toTimestampMs(value) {
  if (!value) return 0;
  const time = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getLocalContentUpdatedAt(sourceState) {
  const newest = Math.max(
    toTimestampMs(sourceState?.config?._lastUpdated),
    toTimestampMs(sourceState?.config?.localBackupAt)
  );
  return newest ? new Date(newest).toISOString() : null;
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
    ...overrides,
  };
}

export function createFirestoreSnapshotEnvelope(sourceState, options = {}) {
  const syncConfig = getFirestoreSyncConfig(sourceState);
  const rawPayload = createExportableState(sourceState);
  // Operational telemetry stays local; it must never bloat the Firestore doc.
  stripFirestoreOperationalMetadata(rawPayload);
  if (!rawPayload.config) rawPayload.config = {};
  rawPayload.config.firestoreSync = createDefaultFirestoreSyncConfig();

  // CRITICAL: Strip undefined values — Firestore setDoc() rejects them
  const payload = stripUndefined(rawPayload);
  if (options.planOverride && typeof options.planOverride === 'object') {
    // Academic-only pushes carry the verified remote plan verbatim so the
    // server can compare it without trusting a client digest.
    payload.planejamento = options.planOverride;
  }

  const payloadUpdatedAt = toIsoTimestamp(
    options.payloadUpdatedAt || getLocalContentUpdatedAt(sourceState) || Date.now()
  );

  return {
    version: FIRESTORE_SYNC_VERSION,
    schemaVersion: sourceState?.schemaVersion || DEFAULT_SCHEMA_VERSION,
    deviceId: options.deviceId || getFirestoreDeviceId(),
    baseRemoteUpdatedAt: options.baseRemoteUpdatedAt ?? syncConfig.remoteUpdatedAt ?? null,
    payloadUpdatedAt,
    sentAt: toIsoTimestamp(options.sentAt || Date.now()),
    ...(options.retaFinalSync ? { retaFinalSync: options.retaFinalSync } : {}),
    payload,
  };
}

export function isFirestoreSnapshotEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.version === FIRESTORE_SYNC_VERSION &&
    value.payload &&
    typeof value.payload === 'object'
  );
}

export function getEnvelopeUpdatedAt(envelope) {
  return envelope?.payloadUpdatedAt || envelope?.updatedAt || null;
}

export function isRemoteNewer(remoteEnvelope, localState) {
  const remoteTime = new Date(getEnvelopeUpdatedAt(remoteEnvelope) || 0).getTime();
  const localTime = new Date(getLocalContentUpdatedAt(localState) || 0).getTime();
  return remoteTime > localTime;
}

export function applyEnvelopeToLocalState(envelope, previousSyncConfig = {}) {
  if (!isFirestoreSnapshotEnvelope(envelope)) {
    throw new Error('Envelope Firestore invalido.');
  }
  const nextState = createExportableState(envelope.payload);
  if (!nextState.config) nextState.config = {};
  const remoteUpdatedAt = getEnvelopeUpdatedAt(envelope);
  if (remoteUpdatedAt) {
    nextState.config.localBackupAt = remoteUpdatedAt;
  }
  nextState.config.firestoreSync = createDefaultFirestoreSyncConfig({
    ...previousSyncConfig,
    enabled: true,
    mode: previousSyncConfig.mode || 'shadow',
    remoteUpdatedAt,
    lastPullAt: new Date().toISOString(),
    hasPendingWrites: false,
    conflict: null,
    lastError: null,
  });
  return nextState;
}
