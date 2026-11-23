import { convertBackupV12, reconstituteBackupV12 } from './backup-codec.js';
import {
  encodeRecordData,
  entityCollectionForType,
  mergeIndependentRecords,
  recordKey,
  validateManifest,
  validateRecord,
} from './contracts.js';
import { sha256Utf8 } from './sha256.js';

export const LOCAL_DB_NAME = 'EstudoOrganizadoDB';
export const LOCAL_DB_VERSION = 8;
export const V1_LOCAL_STATE_STORE = 'v1_local_state';
export const V1_SYNC_OUTBOX_STORE = 'v1_sync_outbox';
export const V1_ENTITY_META_STORE = 'v1_entity_meta';
export const V1_SYNC_CONFLICT_STORE = 'v1_sync_conflicts';
export const V1_SYNC_META_STORE = 'v1_sync_meta';

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const POINTER_KIND = 'v1_generation_pointer';
const WORKER_LEASE_KIND = 'v1_worker_lease';
const POINTER_STATUSES = new Set(['ready', 'blocked']);
const RECEIPT_FIELDS = [
  'schemaVersion',
  'generationId',
  'entityType',
  'entityId',
  'collection',
  'revision',
  'baseRevision',
  'opId',
  'opDigest',
  'deleted',
  'updatedAt',
];

let activeContext = null;

function failClosed(message) {
  throw new TypeError(`Invalid V1 local ${message}`);
}

function validateScope(uid, generationId) {
  if (typeof uid !== 'string' || !TOKEN.test(uid)) failClosed('UID');
  if (typeof generationId !== 'string' || !TOKEN.test(generationId)) {
    failClosed('generation');
  }
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function scopeKey(uid, generationId) {
  validateScope(uid, generationId);
  return JSON.stringify([uid, generationId]);
}

function entityMetaKey(uid, generationId, recordKey) {
  return `${scopeKey(uid, generationId)}\u0000${recordKey}`;
}

function conflictKey(uid, generationId, id) {
  return `${scopeKey(uid, generationId)}\u0000${id}`;
}

function pointerKey(uid) {
  if (typeof uid !== 'string' || !TOKEN.test(uid)) failClosed('UID');
  return JSON.stringify(['v1-generation-pointer', uid]);
}

function readPointerRecord(record, uid) {
  if (!record) return null;
  if (record.key !== pointerKey(uid) || record.kind !== POINTER_KIND ||
    record.uid !== uid || !POINTER_STATUSES.has(record.status) ||
    record.verified !== (record.status === 'ready')) {
    failClosed('generation pointer');
  }
  validateScope(uid, record.generationId);
  validateManifest(record.manifest);
  if (record.manifest.generationId !== record.generationId ||
    !['verified', 'active'].includes(record.manifest.state)) {
    failClosed('generation manifest');
  }
  return clone(record);
}

function checkedBaselineSummary(state, manifest) {
  validateManifest(manifest);
  if (!['verified', 'active'].includes(manifest.state)) failClosed('baseline state');
  const sanitized = sanitizeState(state);
  const converted = convertBackupV12(sanitized.state);
  if (canonical(converted.manifestDraft.counts) !== canonical(manifest.counts) ||
    converted.manifestDraft.businessDigest !== manifest.businessDigest) {
    failClosed('baseline digest or counts');
  }
  return sanitized.state;
}

function isTimestamp(value) {
  return value !== null && typeof value === 'object' &&
    Number.isInteger(value.seconds) && value.seconds >= -62135596800 &&
    value.seconds <= 253402300799 && Number.isInteger(value.nanoseconds) &&
    value.nanoseconds >= 0 && value.nanoseconds < 1e9;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function isOutstanding(operation) {
  return ['pending', 'in-flight', 'retry'].includes(operation.status);
}

function operationItem(operation) {
  if (!operation || operation.action === 'delete') return null;
  return {
    key: operation.entityKey,
    entityType: operation.entityType,
    entityId: operation.entityId,
    path: clone(operation.path),
    data: clone(operation.data),
  };
}

function itemFromRemote(record) {
  if (!record || record.deleted) return null;
  return JSON.parse(record.data);
}

function recordVersion(revision, item, deleted = false) {
  return {
    revision,
    deleted,
    record: clone(item),
    data: item ? clone(item.data) : null,
  };
}

function operationVersions(operation, conflict = {}) {
  const remoteRecord = conflict?.remoteRecord || null;
  const localItem = operationItem(operation);
  return {
    base: {
      revision: operation.baseRevision,
      deleted: false,
      record: clone(operation.baseRecord || null),
      data: operation.baseRecord ? clone(operation.baseRecord.data) : null,
    },
    local: recordVersion(operation.revision, localItem, operation.action === 'delete'),
    remote: remoteRecord || Number.isSafeInteger(conflict?.remoteRevision) ?
      recordVersion(
        remoteRecord?.revision ?? conflict.remoteRevision,
        itemFromRemote(remoteRecord),
        remoteRecord?.deleted === true || conflict?.remoteDeleted === true,
      ) : null,
  };
}

function conflictRecord(operation, conflict, { now, status = 'open' } = {}) {
  const versions = operationVersions(operation, conflict || {});
  return {
    key: conflictKey(operation.uid, operation.generationId, operation.opId),
    uid: operation.uid,
    generationId: operation.generationId,
    conflictId: operation.opId,
    opId: operation.opId,
    entityKey: operation.entityKey,
    entityType: operation.entityType,
    entityId: operation.entityId,
    collection: operation.collection,
    base: operation.baseRevision,
    local: operation.revision,
    remote: Number.isSafeInteger(conflict?.remoteRevision) ?
      conflict.remoteRevision : null,
    baseVersion: versions.base,
    localVersion: versions.local,
    remoteVersion: versions.remote,
    reason: typeof conflict?.code === 'string' ? conflict.code : 'conflict',
    remoteDeleted: conflict?.remoteDeleted === true ||
      conflict?.remoteRecord?.deleted === true,
    remoteRecord: clone(conflict?.remoteRecord || null),
    status,
    createdAt: now,
    updatedAt: now,
  };
}

function removeRecordFromState(state, path) {
  if (!Array.isArray(path) || path.length === 0) failClosed('record path');
  let parent = state;
  for (const segment of path.slice(0, -1)) {
    if (parent == null || (typeof parent !== 'object' && !Array.isArray(parent)) ||
      !Object.hasOwn(parent, segment)) failClosed('record path');
    parent = parent[segment];
  }
  const slot = path.at(-1);
  if (Array.isArray(parent)) {
    if (!Number.isSafeInteger(slot) || slot < 0 || slot >= parent.length) {
      failClosed('record path');
    }
    parent.splice(slot, 1);
    return;
  }
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, slot)) {
    failClosed('record path');
  }
  delete parent[slot];
}

function insertRecordIntoState(state, item) {
  const { path, data } = item;
  if (!Array.isArray(path) || path.length === 0) failClosed('record path');
  let parent = state;
  for (const segment of path.slice(0, -1)) {
    if (parent == null || (typeof parent !== 'object' && !Array.isArray(parent)) ||
      !Object.hasOwn(parent, segment)) failClosed('record path');
    parent = parent[segment];
  }
  const slot = path.at(-1);
  if (Array.isArray(parent)) {
    if (!Number.isSafeInteger(slot) || slot < 0 || slot > parent.length) {
      failClosed('record path');
    }
    parent.splice(slot, 0, clone(data));
    return;
  }
  if (!parent || typeof parent !== 'object') failClosed('record path');
  parent[slot] = clone(data);
}

function stateWithRecord(state, previous, item) {
  if (previous && item) {
    const { records } = convertBackupV12(state);
    const siblings = records[entityCollectionForType(item.entityType)];
    const index = siblings.findIndex(record => record.key === item.key);
    if (index < 0) failClosed('record identity');
    siblings[index] = { ...item, path: previous.path };
    const rebuilt = reconstituteBackupV12(records);
    if (canonical(previous.path) === canonical(item.path)) return rebuilt;
    const subtree = previous.path.reduce((parent, segment) => parent[segment], rebuilt);
    removeRecordFromState(rebuilt, previous.path);
    insertRecordIntoState(rebuilt, { ...item, data: subtree });
    convertBackupV12(rebuilt);
    return rebuilt;
  }
  const next = clone(state);
  if (previous) removeRecordFromState(next, previous.path);
  if (item) insertRecordIntoState(next, item);
  // Reject an impossible topology before it reaches IndexedDB.
  convertBackupV12(next);
  return next;
}

function recordMap(state) {
  const converted = convertBackupV12(state);
  const records = new Map();
  for (const record of Object.values(converted.records).flat()) {
    records.set(record.key, record);
  }
  return { converted, records };
}

function sanitizeState(state) {
  const converted = convertBackupV12(state);
  return {
    state: reconstituteBackupV12(converted.records),
    records: new Map(Object.values(converted.records).flat().map((record) => [record.key, record])),
  };
}

function operationId(existingIds) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const random = globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const id = `op_${random}`;
    if (TOKEN.test(id) && !existingIds.has(id)) return id;
  }
  throw new Error('Unable to allocate a V1 operation ID');
}

function normalizedOverrides(operations, previousRecords, nextRecords) {
  const overrides = new Map();
  for (const operation of Array.isArray(operations) ? operations : []) {
    if (!operation || typeof operation !== 'object') failClosed('operation');
    const entityType = operation.entityType;
    const entityId = operation.entityId;
    const collection = operation.collection || entityCollectionForType(entityType);
    if (collection !== entityCollectionForType(entityType)) failClosed('collection');
    const key = `${entityType}:${entityId}`;
    const previous = previousRecords.get(key) || null;
    const next = nextRecords.get(key) || null;
    const action = operation.action || (operation.data === null ? 'delete' : 'upsert');
    if (action === 'delete') {
      overrides.set(key, { previous, next: null, action });
      continue;
    }
    if (action !== 'upsert') failClosed('action');
    const source = next || previous;
    const data = operation.data === undefined ? source?.data : operation.data;
    const path = operation.path === undefined ? source?.path : operation.path;
    if (!data || !Array.isArray(path)) failClosed('operation record');
    overrides.set(key, {
      previous,
      next: { key, entityType, entityId, path, data },
      action,
    });
  }
  return overrides;
}

/** Pure preparation used by both the standalone API and saveStateToDB. */
export function prepareLocalCommit({
  uid,
  generationId,
  previousState = null,
  nextState,
  operations = [],
  pendingOperations = [],
  entityMeta = [],
  existingConflicts = [],
  syncMeta = null,
  verified,
  now = new Date().toISOString(),
}) {
  validateScope(uid, generationId);
  if (!nextState || typeof nextState !== 'object') failClosed('state');
  const key = scopeKey(uid, generationId);
  const previousRecords = previousState ? recordMap(previousState).records : new Map();
  const sanitized = sanitizeState(nextState);
  const nextRecords = sanitized.records;
  const allPending = Array.isArray(pendingOperations) ? pendingOperations : [];
  const pending = allPending
    .filter((operation) => operation?.uid === uid && operation?.generationId === generationId);
  const existingIds = new Set(allPending.map((operation) => operation.opId));
  const metaByKey = new Map();
  for (const record of Array.isArray(entityMeta) ? entityMeta : []) {
    if (record?.uid === uid && record?.generationId === generationId &&
      typeof record.entityKey === 'string') {
      metaByKey.set(record.entityKey, clone(record));
    }
  }

  const openByEntity = new Map((existingConflicts || [])
    .filter(row => row.uid === uid && row.generationId === generationId && row.status === 'open')
    .map(row => [row.entityKey, row]));
  const tailByEntity = new Map();
  for (const op of pending) {
    if (isOutstanding(op) && !(tailByEntity.get(op.entityKey)?.sequence >= op.sequence)) {
      tailByEntity.set(op.entityKey, op);
    }
  }

  const tombstoneCandidates = [...nextRecords.entries()]
    .filter(([entityKey]) => metaByKey.get(entityKey)?.deleted === true)
    .sort(([leftKey, left], [rightKey, right]) => {
      const depth = Math.max(left.path.length, right.path.length);
      for (let index = 0; index < depth; index += 1) {
        const leftPart = left.path[index];
        const rightPart = right.path[index];
        if (leftPart === rightPart) continue;
        if (typeof leftPart === 'number' && typeof rightPart === 'number') {
          return rightPart - leftPart;
        }
        return String(rightPart).localeCompare(String(leftPart));
      }
      return leftKey.localeCompare(rightKey);
    });
  const tombstonedAttempts = [];
  const tombstonedKeys = new Set();
  for (const [entityKey, record] of tombstoneCandidates) {
    const meta = metaByKey.get(entityKey);
    removeRecordFromState(sanitized.state, record.path);
    nextRecords.delete(entityKey);
    tombstonedKeys.add(entityKey);
    tombstonedAttempts.push({ entityKey, record, meta });
  }

  const changes = new Map();
  for (const [entityKey, record] of previousRecords) {
    if (!nextRecords.has(entityKey) && !tombstonedKeys.has(entityKey)) {
      changes.set(entityKey, { previous: record, next: null, action: 'delete' });
    }
  }
  for (const [entityKey, record] of nextRecords) {
    const previous = previousRecords.get(entityKey) || null;
    const before = previous ? encodeRecordData(previous) : null;
    const after = encodeRecordData(record);
    if (before !== after || previous?.path.join('/') !== record.path.join('/')) {
      changes.set(entityKey, { previous, next: record, action: 'upsert' });
    }
  }
  for (const [entityKey, override] of normalizedOverrides(operations, previousRecords, nextRecords)) {
    changes.set(entityKey, override);
  }

  const committedOperations = [];
  const entityMetaUpdates = new Map();
  const deletedOperationIds = [];
  const deletedEntityMetaKeys = [];
  const conflicts = [];
  let sequence = Math.max(
    Number.isSafeInteger(syncMeta?.nextSequence) ? syncMeta.nextSequence - 1 : 0,
    ...pending.map((operation) => Number(operation.sequence) || 0),
  );

  const ordered = [...changes.entries()].sort(([left], [right]) =>
    left.localeCompare(right));
  for (const [entityKey, change] of ordered) {
    const template = change.next || change.previous;
    const meta = metaByKey.get(entityKey);
    const open = openByEntity.get(entityKey);
    if (open) {
      conflicts.push({ ...open, localVersion: recordVersion(open.local, change.next,
        change.action === 'delete'), updatedAt: now });
      continue;
    }
    const tail = tailByEntity.get(entityKey);
    const candidate = tail?.status === 'pending' ? tail : null;
    const baseRevision = candidate?.baseRevision ?? tail?.revision ?? meta?.baseRevision ?? 0;
    let operation = candidate ? clone(candidate) : null;
    if (change.action === 'delete' && baseRevision === 0) {
      if (operation) {
        deletedOperationIds.push(operation.opId);
      }
      deletedEntityMetaKeys.push(entityMetaKey(uid, generationId, entityKey));
      continue;
    }
    if (operation) {
      const deleteWins = operation.action === 'delete' || change.action === 'delete';
      if (!(operation.action === 'delete' && change.action === 'upsert')) {
        const attached = change.next || operation;
        operation.action = deleteWins ? 'delete' : 'upsert';
        operation.path = clone(attached.path);
        if (operation.action === 'delete') {
          operation.data = null;
          operation.dataText = 'null';
          operation.opDigest = sha256Utf8('null');
        } else {
          operation.data = clone(change.next.data);
          operation.dataText = encodeRecordData(change.next);
          operation.opDigest = sha256Utf8(operation.dataText);
        }
        operation.updatedAt = now;
      }
    } else {
      sequence += 1;
      const opId = operationId(existingIds);
      existingIds.add(opId);
      if (change.action === 'delete') {
        operation = {
          opId,
          uid,
          generationId,
          entityKey,
          entityType: template.entityType,
          entityId: template.entityId,
          collection: entityCollectionForType(template.entityType),
          path: clone(template.path),
          baseRecord: tail ? operationItem(tail) : clone(meta?.lastRecord ?? change.previous ?? null),
          baseRevision,
          revision: baseRevision + 1,
          action: 'delete',
          data: null,
          dataText: 'null',
          opDigest: sha256Utf8('null'),
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          sequence,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        const dataText = encodeRecordData(change.next);
        operation = {
          opId,
          uid,
          generationId,
          entityKey,
          entityType: change.next.entityType,
          entityId: change.next.entityId,
          collection: entityCollectionForType(change.next.entityType),
          path: clone(change.next.path),
          baseRecord: tail ? operationItem(tail) : clone(meta?.lastRecord ?? change.previous ?? null),
          baseRevision,
          revision: baseRevision + 1,
          action: 'upsert',
          data: clone(change.next.data),
          dataText,
          opDigest: sha256Utf8(dataText),
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          sequence,
          createdAt: now,
          updatedAt: now,
        };
      }
    }
    committedOperations.push(clone(operation));
    entityMetaUpdates.set(entityMetaKey(uid, generationId, entityKey), {
      ...meta,
      key: entityMetaKey(uid, generationId, entityKey),
      uid,
      generationId,
      entityKey,
      entityType: operation.entityType,
      entityId: operation.entityId,
      collection: operation.collection,
      baseRevision: operation.baseRevision,
      revision: operation.revision,
      pendingOpId: operation.opId,
      updatedAt: now,
    });
  }

  for (const { entityKey, record, meta } of tombstonedAttempts) {
    if (openByEntity.has(entityKey)) continue;
    sequence += 1;
    const opId = operationId(existingIds);
    existingIds.add(opId);
    const dataText = encodeRecordData(record);
    const operation = {
      opId,
      uid,
      generationId,
      entityKey,
      entityType: record.entityType,
      entityId: record.entityId,
      collection: entityCollectionForType(record.entityType),
      path: clone(record.path),
      baseRecord: clone(meta.lastRecord || null),
      baseRevision: Number.isSafeInteger(meta.revision) ? meta.revision : 0,
      revision: (Number.isSafeInteger(meta.revision) ? meta.revision : 0) + 1,
      action: 'upsert',
      data: clone(record.data),
      dataText,
      opDigest: sha256Utf8(dataText),
      status: 'conflict',
      attempts: 0,
      nextAttemptAt: null,
      lastError: 'V1_SYNC_TOMBSTONE',
      sequence,
      createdAt: now,
      updatedAt: now,
    };
    committedOperations.push(clone(operation));
    conflicts.push(conflictRecord(operation, {
      code: 'tombstone',
      remoteRevision: meta.revision,
      remoteDeleted: true,
      remoteRecord: meta.lastRemoteRecord || null,
    }, { now }));
  }

  return {
    stateRecord: {
      key,
      uid,
      generationId,
      state: sanitized.state,
      verified: verified === true,
      updatedAt: now,
    },
    operations: committedOperations,
    deletedOperationIds,
    deletedEntityMetaKeys,
    entityMeta: [...entityMetaUpdates.values()],
    conflicts,
    syncMeta: {
      key,
      uid,
      generationId,
      nextSequence: sequence + 1,
      updatedAt: now,
    },
  };
}

export function setActiveV1Context(uid, generationId) {
  validateScope(uid, generationId);
  activeContext = { uid, generationId };
}

export function clearActiveV1Context() {
  activeContext = null;
}

export function getActiveV1Context() {
  return activeContext ? { ...activeContext } : null;
}

export function v1ScopeKey(uid, generationId) {
  return scopeKey(uid, generationId);
}

export function v1EntityMetaKey(uid, generationId, recordKey) {
  return entityMetaKey(uid, generationId, recordKey);
}

function workerLeaseKey(uid, generationId) {
  return `${scopeKey(uid, generationId)}\u0000worker-lease`;
}

function validateLease({ ownerId, token, ttlMs }) {
  if (typeof ownerId !== 'string' || !TOKEN.test(ownerId)) failClosed('lease owner');
  if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    failClosed('lease duration');
  }
  if (token !== undefined && (typeof token !== 'string' || !TOKEN.test(token))) {
    failClosed('lease token');
  }
}

function readWorkerLease(record, uid, generationId) {
  if (!record) return null;
  if (record.key !== workerLeaseKey(uid, generationId) ||
    record.kind !== WORKER_LEASE_KIND || record.uid !== uid ||
    record.generationId !== generationId || typeof record.ownerId !== 'string' ||
    !TOKEN.test(record.ownerId) || typeof record.token !== 'string' ||
    !TOKEN.test(record.token) || !Number.isFinite(record.expiresAt)) {
    failClosed('worker lease');
  }
  return record;
}

/** Acquire the IndexedDB lease used when the Web Locks API is unavailable. */
export async function acquireV1WorkerLease({
  uid,
  generationId,
  ownerId,
  now = Date.now(),
  ttlMs = 30_000,
}) {
  validateScope(uid, generationId);
  validateLease({ ownerId, ttlMs });
  const key = workerLeaseKey(uid, generationId);
  const token = `${ownerId}_${Math.floor(now).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  validateLease({ ownerId, token, ttlMs });
  return runTransaction([V1_SYNC_META_STORE], 'readwrite', (transaction, control) => {
    const store = transaction.objectStore(V1_SYNC_META_STORE);
    const request = store.get(key);
    request.onerror = () => control.abort(request.error);
    request.onsuccess = () => {
      try {
        const current = readWorkerLease(request.result, uid, generationId);
        if (current && current.expiresAt > now && current.ownerId !== ownerId) {
          control.setResult(null);
          return;
        }
        const lease = {
          key,
          kind: WORKER_LEASE_KIND,
          uid,
          generationId,
          ownerId,
          token,
          expiresAt: now + ttlMs,
          updatedAt: new Date(now).toISOString(),
        };
        store.put(lease);
        control.setResult(clone(lease));
      } catch (error) {
        control.abort(error);
      }
    };
  });
}

/** Extend an owned IndexedDB lease without allowing another tab to take it. */
export async function renewV1WorkerLease({
  uid,
  generationId,
  ownerId,
  token,
  now = Date.now(),
  ttlMs = 30_000,
}) {
  validateScope(uid, generationId);
  validateLease({ ownerId, token, ttlMs });
  const key = workerLeaseKey(uid, generationId);
  return runTransaction([V1_SYNC_META_STORE], 'readwrite', (transaction, control) => {
    const store = transaction.objectStore(V1_SYNC_META_STORE);
    const request = store.get(key);
    request.onerror = () => control.abort(request.error);
    request.onsuccess = () => {
      try {
        const current = readWorkerLease(request.result, uid, generationId);
        if (!current || current.ownerId !== ownerId || current.token !== token) {
          control.setResult(false);
          return;
        }
        store.put({
          ...current,
          expiresAt: Math.max(current.expiresAt, now + ttlMs),
          updatedAt: new Date(now).toISOString(),
        });
        control.setResult(true);
      } catch (error) {
        control.abort(error);
      }
    };
  });
}

/** Release only a lease still owned by this worker invocation. */
export async function releaseV1WorkerLease({
  uid,
  generationId,
  ownerId,
  token,
}) {
  validateScope(uid, generationId);
  validateLease({ ownerId, token, ttlMs: 1 });
  const key = workerLeaseKey(uid, generationId);
  return runTransaction([V1_SYNC_META_STORE], 'readwrite', (transaction, control) => {
    const store = transaction.objectStore(V1_SYNC_META_STORE);
    const request = store.get(key);
    request.onerror = () => control.abort(request.error);
    request.onsuccess = () => {
      const current = readWorkerLease(request.result, uid, generationId);
      if (current?.ownerId === ownerId && current.token === token) store.delete(key);
    };
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = globalThis.indexedDB.open(LOCAL_DB_NAME);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction(storeNames, mode, work) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction(storeNames, mode);
    } catch (error) {
      database.close?.();
      reject(error);
      return;
    }
    let result;
    let failure = null;
    const abort = (error) => {
      failure ||= error;
      try {
        transaction.abort();
      } catch {
        reject(failure);
      }
    };
    transaction.oncomplete = () => {
      database.close?.();
      resolve(result);
    };
    transaction.onerror = () => {
      failure ||= transaction.error || new Error('IndexedDB transaction failed');
    };
    transaction.onabort = () => {
      database.close?.();
      reject(failure || transaction.error || new Error('IndexedDB transaction aborted'));
    };
    try {
      work(transaction, { setResult: (value) => { result = value; }, abort });
    } catch (error) {
      abort(error);
    }
  }));
}

export async function readLocalGeneration(uid, generationId) {
  const key = scopeKey(uid, generationId);
  const record = await runTransaction([V1_LOCAL_STATE_STORE], 'readonly', (transaction, control) => {
    const request = transaction.objectStore(V1_LOCAL_STATE_STORE).get(key);
    request.onsuccess = () => control.setResult(request.result || null);
    request.onerror = () => control.abort(request.error);
  });
  if (!record) return null;
  if (record.key !== key || record.uid !== uid || record.generationId !== generationId ||
    !record.state || typeof record.state !== 'object') {
    failClosed('state record');
  }
  return { state: clone(record.state), verified: record.verified === true };
}

export async function readV1GenerationPointer(uid) {
  pointerKey(uid);
  const key = pointerKey(uid);
  const record = await runTransaction([V1_LOCAL_STATE_STORE], 'readonly', (transaction, control) => {
    const request = transaction.objectStore(V1_LOCAL_STATE_STORE).get(key);
    request.onsuccess = () => control.setResult(request.result || null);
    request.onerror = () => control.abort(request.error);
  });
  return readPointerRecord(record, uid);
}

/** Install one verified remote baseline and its UID pointer in one transaction. */
export async function installRemoteBaseline({
  uid,
  generationId,
  state,
  manifest,
  now = new Date().toISOString(),
}) {
  validateScope(uid, generationId);
  if (manifest?.generationId !== generationId) failClosed('baseline generation');
  const verifiedState = checkedBaselineSummary(state, manifest);
  const stateKey = scopeKey(uid, generationId);
  const versionKey = pointerKey(uid);

  return runTransaction(
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_SYNC_META_STORE],
    'readwrite',
    (transaction, control) => {
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const syncMetaStore = transaction.objectStore(V1_SYNC_META_STORE);
      const reads = {};
      const done = new Set();
      const stage = () => {
        if (done.size !== 4) return;
        try {
          const pointer = readPointerRecord(reads.pointer, uid);
          const existing = reads.state;
          const pending = (reads.operations || []).filter((operation) =>
            operation?.uid === uid && operation?.generationId === generationId &&
            isOutstanding(operation));
          if (pending.length) failClosed('baseline with pending work');

          if (existing && (existing.key !== stateKey || existing.uid !== uid ||
            existing.generationId !== generationId || existing.verified !== true)) {
            failClosed('existing baseline');
          }
          if (existing) {
            const current = convertBackupV12(existing.state);
            if (canonical(current.manifestDraft.counts) !== canonical(manifest.counts) ||
              current.manifestDraft.businessDigest !== manifest.businessDigest) {
              failClosed('existing baseline differs from manifest');
            }
          } else {
            stateStore.put({
              key: stateKey,
              uid,
              generationId,
              state: verifiedState,
              verified: true,
              verifiedAt: now,
              updatedAt: now,
            });
          }

          stateStore.put({
            key: versionKey,
            kind: POINTER_KIND,
            uid,
            generationId,
            status: 'ready',
            verified: true,
            manifest: clone(manifest),
            source: 'network',
            installedAt: pointer?.generationId === generationId ?
              pointer.installedAt : now,
            updatedAt: now,
          });
          syncMetaStore.put({
            key: stateKey,
            uid,
            generationId,
            nextSequence: Number.isSafeInteger(reads.syncMeta?.nextSequence) ?
              reads.syncMeta.nextSequence : 1,
            updatedAt: now,
          });
          control.setResult(true);
        } catch (error) {
          control.abort(error);
        }
      };
      const read = (store, key, field) => {
        const request = key === null ? store.getAll() : store.get(key);
        request.onsuccess = () => {
          reads[field] = request.result;
          done.add(field);
          stage();
        };
        request.onerror = () => control.abort(request.error);
      };
      read(stateStore, versionKey, 'pointer');
      read(stateStore, stateKey, 'state');
      read(outbox, null, 'operations');
      read(syncMetaStore, stateKey, 'syncMeta');
    },
  );
}

/** Block a generation from local writes after remote revocation is observed. */
export async function markV1GenerationBlocked(
  uid,
  generationId,
  now = new Date().toISOString(),
) {
  validateScope(uid, generationId);
  const key = pointerKey(uid);
  const stateKey = scopeKey(uid, generationId);
  await runTransaction([V1_LOCAL_STATE_STORE], 'readwrite', (transaction, control) => {
    const store = transaction.objectStore(V1_LOCAL_STATE_STORE);
    const pointerRequest = store.get(key);
    const stateRequest = store.get(stateKey);
    const reads = {};
    const stage = () => {
      if (!Object.hasOwn(reads, 'pointer') || !Object.hasOwn(reads, 'state')) return;
      try {
        const pointer = readPointerRecord(reads.pointer, uid);
        if (!pointer || pointer.generationId !== generationId) failClosed('active pointer');
        store.put({
          ...pointer,
          status: 'blocked',
          verified: false,
          blockedAt: now,
          updatedAt: now,
        });
        if (reads.state?.key === stateKey) {
          store.put({ ...reads.state, verified: false, updatedAt: now });
        }
      } catch (error) {
        control.abort(error);
      }
    };
    pointerRequest.onsuccess = () => {
      reads.pointer = pointerRequest.result;
      stage();
    };
    pointerRequest.onerror = () => control.abort(pointerRequest.error);
    stateRequest.onsuccess = () => {
      reads.state = stateRequest.result;
      stage();
    };
    stateRequest.onerror = () => control.abort(stateRequest.error);
  });
  const active = getActiveV1Context();
  if (active?.uid === uid && active.generationId === generationId) clearActiveV1Context();
}

/** Apply one validated remote record to state without creating a local operation. */
export async function applyRemoteRecord({
  uid,
  generationId,
  record,
  now = new Date().toISOString(),
}) {
  validateScope(uid, generationId);
  validateRecord(record);
  if (record.generationId !== generationId) failClosed('remote record generation');
  const stateKey = scopeKey(uid, generationId);
  const versionKey = pointerKey(uid);
  const entityKey = recordKey(record.entityType, record.entityId);
  const metaKey = entityMetaKey(uid, generationId, entityKey);

  return runTransaction(
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE,
      V1_SYNC_CONFLICT_STORE],
    'readwrite',
    (transaction, control) => {
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const metaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const conflictStore = transaction.objectStore(V1_SYNC_CONFLICT_STORE);
      const reads = {};
      const done = new Set();
      const stage = () => {
        if (done.size !== 5) return;
        try {
          const pointer = readPointerRecord(reads.pointer, uid);
          if (!pointer || pointer.generationId !== generationId || pointer.status !== 'ready') {
            failClosed('blocked generation');
          }
          const stateRecord = reads.state;
          if (!stateRecord || stateRecord.key !== stateKey || stateRecord.uid !== uid ||
            stateRecord.generationId !== generationId || stateRecord.verified !== true) {
            failClosed('verified state');
          }
          const pending = (reads.operations || []).filter((operation) =>
            operation?.uid === uid && operation?.generationId === generationId &&
            operation?.entityKey === entityKey && isOutstanding(operation));
          const meta = reads.meta;
          const ownTombstone = record.deleted && pending.some(
            (operation) => operation.opId === record.opId,
          );
          if (meta?.deleted === true && record.deleted !== true) {
            control.setResult({ applied: false, reason: 'tombstoned' });
            return;
          }
          if (!record.deleted && (pending.length || reads.conflicts.some(conflict =>
            conflict.uid === uid && conflict.generationId === generationId &&
            conflict.entityKey === entityKey && conflict.status === 'open'))) {
            control.setResult({ applied: false, reason: 'pending' });
            return;
          }
          if (!record.deleted && meta && (meta.revision > record.revision ||
            (meta.revision === record.revision && meta.lastAckedOpId === record.opId))) {
            control.setResult({ applied: false, reason: 'already-current' });
            return;
          }
          if (!record.deleted && meta && meta.revision === record.revision &&
            meta.lastAckedOpId !== record.opId) {
            failClosed('conflicting remote revision');
          }

          const converted = convertBackupV12(stateRecord.state);
          const previous = converted.records[record.collection]
            .find((candidate) => candidate.key === entityKey) || null;
          let item = null;
          if (!record.deleted) {
            item = JSON.parse(record.data);
            if (item.key !== entityKey || item.entityType !== record.entityType ||
              String(item.entityId) !== record.entityId) {
              failClosed('remote payload identity');
            }
          }

          if (record.deleted) {
            if (meta?.lastRemoteRecord?.revision > record.revision) {
              control.setResult({ applied: false, reason: 'already-current' });
              return;
            }
            for (const conflict of reads.conflicts) {
              if (conflict.uid === uid && conflict.generationId === generationId &&
                conflict.entityKey === entityKey && conflict.status === 'open') {
                conflictStore.put({ ...conflict, reason: 'tombstone', remote: record.revision,
                  remoteDeleted: true, remoteRecord: clone(record),
                  remoteVersion: recordVersion(record.revision, null, true), updatedAt: now });
              }
            }
          }

          if (pending.length && record.deleted && !ownTombstone) {
            const conflicts = [];
            const existing = new Map((reads.conflicts || [])
              .filter(conflict => conflict.uid === uid && conflict.generationId === generationId)
              .map(conflict => [conflict.conflictId, conflict]));
            for (const operation of pending) {
              const candidate = conflictRecord(operation, {
                code: 'tombstone',
                remoteRevision: record.revision,
                remoteDeleted: true,
                remoteRecord: record,
              }, { now });
              conflicts.push(existing.get(operation.opId) || candidate);
              outbox.put({
                ...operation,
                status: 'conflict',
                lastError: 'V1_SYNC_TOMBSTONE',
                updatedAt: now,
              });
            }
            for (const conflict of conflicts) conflictStore.put(conflict);
            const nextState = stateWithRecord(stateRecord.state, previous, null);
            stateStore.put({
              ...stateRecord,
              state: nextState,
              verified: true,
              verifiedAt: stateRecord.verifiedAt || now,
              updatedAt: now,
            });
            metaStore.put({
              key: metaKey,
              uid,
              generationId,
              entityKey,
              entityType: record.entityType,
              entityId: record.entityId,
              collection: record.collection,
              baseRevision: record.baseRevision,
              revision: record.revision,
              deleted: true,
              lastAckedOpId: record.opId,
              lastRecord: null,
              lastRemoteRecord: clone(record),
              updatedAt: now,
            });
            control.setResult({
              applied: true,
              conflict: true,
              conflictIds: conflicts.map((conflict) => conflict.conflictId),
            });
            return;
          }
          const nextState = stateWithRecord(stateRecord.state, previous, item);

          stateStore.put({
            ...stateRecord,
            state: nextState,
            verified: true,
            verifiedAt: stateRecord.verifiedAt || now,
            updatedAt: now,
          });
          metaStore.put({
            key: metaKey,
            uid,
            generationId,
            entityKey,
            entityType: record.entityType,
            entityId: record.entityId,
            collection: record.collection,
            baseRevision: record.revision,
            revision: record.revision,
            deleted: record.deleted === true,
            pendingOpId: null,
            lastAckedOpId: record.opId,
            lastRecord: clone(item),
            lastRemoteRecord: clone(record),
            updatedAt: now,
          });
          control.setResult({ applied: true });
        } catch (error) {
          control.abort(error);
        }
      };
      const read = (store, key, field) => {
        const request = key === null ? store.getAll() : store.get(key);
        request.onsuccess = () => {
          reads[field] = request.result;
          done.add(field);
          stage();
        };
        request.onerror = () => control.abort(request.error);
      };
      read(stateStore, versionKey, 'pointer');
      read(stateStore, stateKey, 'state');
      read(outbox, null, 'operations');
      read(metaStore, metaKey, 'meta');
      read(conflictStore, null, 'conflicts');
    },
  );
}

export async function commitLocalChange({
  uid,
  generationId,
  nextState,
  operations = [],
}) {
  validateScope(uid, generationId);
  const key = scopeKey(uid, generationId);
  await runTransaction(
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE,
      V1_SYNC_CONFLICT_STORE, V1_SYNC_META_STORE],
    'readwrite',
    (transaction, control) => {
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const entityMetaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const conflictStore = transaction.objectStore(V1_SYNC_CONFLICT_STORE);
      const syncMetaStore = transaction.objectStore(V1_SYNC_META_STORE);
      const reads = {
        state: undefined,
        operations: undefined,
        meta: undefined,
        conflicts: undefined,
        syncMeta: undefined,
        pointer: undefined,
      };
      const done = {
        state: false,
        operations: false,
        meta: false,
        conflicts: false,
        syncMeta: false,
        pointer: false,
      };
      let staged = false;

      const stage = () => {
        if (staged || !Object.values(done).every(Boolean)) return;
        staged = true;
        try {
          const pointer = readPointerRecord(reads.pointer, uid);
          if (pointer && (pointer.generationId !== generationId ||
            pointer.status !== 'ready')) {
            failClosed('blocked generation');
          }
          const prepared = prepareLocalCommit({
            uid,
            generationId,
            previousState: reads.state?.state || null,
            nextState,
            operations,
            pendingOperations: reads.operations || [],
            entityMeta: reads.meta || [],
            existingConflicts: reads.conflicts || [],
            syncMeta: reads.syncMeta || null,
            verified: reads.state?.verified,
          });
          stateStore.put(prepared.stateRecord);
          for (const operation of prepared.operations) outbox.put(operation);
          for (const opId of prepared.deletedOperationIds) outbox.delete(opId);
          for (const record of prepared.entityMeta) entityMetaStore.put(record);
          for (const key of prepared.deletedEntityMetaKeys) entityMetaStore.delete(key);
          for (const conflict of prepared.conflicts) conflictStore.put(conflict);
          syncMetaStore.put(prepared.syncMeta);
        } catch (error) {
          control.abort(error);
        }
      };
      const read = (store, keyOrNull, field) => {
        const request = keyOrNull === null ? store.getAll() : store.get(keyOrNull);
        request.onsuccess = () => {
          reads[field] = request.result;
          done[field] = true;
          stage();
        };
        request.onerror = () => control.abort(request.error);
      };
      read(stateStore, key, 'state');
      read(outbox, null, 'operations');
      read(entityMetaStore, null, 'meta');
      read(conflictStore, null, 'conflicts');
      read(syncMetaStore, key, 'syncMeta');
      read(stateStore, pointerKey(uid), 'pointer');
    },
  );
}

export async function setLocalGenerationVerified(uid, generationId, verified = true) {
  const key = scopeKey(uid, generationId);
  if (typeof verified !== 'boolean') failClosed('verification');
  await runTransaction([V1_LOCAL_STATE_STORE], 'readwrite', (transaction, control) => {
    const store = transaction.objectStore(V1_LOCAL_STATE_STORE);
    const request = store.get(key);
    request.onerror = () => control.abort(request.error);
    request.onsuccess = () => {
      const record = request.result;
      if (!record || record.key !== key || record.uid !== uid ||
        record.generationId !== generationId) {
        control.abort(new Error('V1 local generation not found'));
        return;
      }
      store.put({
        ...record,
        verified,
        verifiedAt: verified ? new Date().toISOString() : null,
      });
    };
  });
}

// Read conflict barriers and FIFO heads in the same transaction as the claim.
function readQueueHeads(transaction, control, uid, generationId, ready) {
  const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
  const ops = outbox.getAll();
  const conflicts = transaction.objectStore(V1_SYNC_CONFLICT_STORE).getAll();
  let remaining = 2;
  const finish = () => {
    remaining -= 1;
    if (remaining > 0) return;
    const scoped = row => row.uid === uid && row.generationId === generationId;
    const seen = new Set(conflicts.result.filter(row => scoped(row) && row.status !== 'resolved')
      .map(row => row.entityKey));
    const heads = ops.result.filter(row => scoped(row) && isOutstanding(row))
      .sort((left, right) => left.sequence - right.sequence)
      .filter(row => {
        if (seen.has(row.entityKey)) return false;
        seen.add(row.entityKey);
        return true;
      });
    ready(heads, outbox);
  };
  ops.onsuccess = conflicts.onsuccess = finish;
  ops.onerror = () => control.abort(ops.error);
  conflicts.onerror = () => control.abort(conflicts.error);
}

export async function getPendingOperations(uid, generationId) {
  validateScope(uid, generationId);
  return runTransaction([V1_SYNC_OUTBOX_STORE, V1_SYNC_CONFLICT_STORE], 'readonly', (tx, control) => {
    readQueueHeads(tx, control, uid, generationId, heads => control.setResult(heads));
  });
}

export async function claimLocalOperation({ uid, generationId, opId }) {
  validateScope(uid, generationId);
  return runTransaction([V1_SYNC_OUTBOX_STORE, V1_SYNC_CONFLICT_STORE], 'readwrite', (tx, control) => {
    readQueueHeads(tx, control, uid, generationId, (heads, outbox) => {
      const head = heads.find(row => row.opId === opId);
      if (!head || Date.parse(head.nextAttemptAt) > Date.now()) {
        control.setResult(null);
        return;
      }
      const operation = { ...head, status: 'in-flight' };
      outbox.put(operation);
      control.setResult(operation);
    });
  });
}

/** Persist bounded retry metadata without changing the operation payload. */
export async function markLocalOperationRetry(opId, {
  reason = null,
  nextAttemptAt,
  attempts,
  now = new Date().toISOString(),
} = {}) {
  if (typeof opId !== 'string' || !TOKEN.test(opId)) failClosed('operation ID');
  if (nextAttemptAt !== null && nextAttemptAt !== undefined &&
    (typeof nextAttemptAt !== 'string' || !Number.isFinite(Date.parse(nextAttemptAt)))) {
    failClosed('retry time');
  }
  if (attempts !== undefined && (!Number.isSafeInteger(attempts) || attempts < 0)) {
    failClosed('retry attempts');
  }
  return runTransaction([V1_SYNC_OUTBOX_STORE], 'readwrite', (transaction, control) => {
    const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
    const request = outbox.get(opId);
    request.onerror = () => control.abort(request.error);
    request.onsuccess = () => {
      const operation = request.result;
      if (!operation) {
        control.abort(new Error('V1 operation not found'));
        return;
      }
      if (!isOutstanding(operation)) {
        control.setResult(false);
        return;
      }
      outbox.put({
        ...operation,
        status: 'retry',
        attempts: attempts ?? operation.attempts + 1,
        nextAttemptAt: nextAttemptAt ?? null,
        lastError: reason === null ? null : String(reason),
        updatedAt: now,
      });
      control.setResult(true);
    };
  });
}

/** Suspend one operation in the isolated conflict store while retaining it in the outbox. */
export async function markLocalOperationConflict(opId, conflict, {
  now = new Date().toISOString(),
} = {}) {
  if (typeof opId !== 'string' || !TOKEN.test(opId)) failClosed('operation ID');
  if (!conflict || typeof conflict !== 'object' || Array.isArray(conflict)) {
    failClosed('conflict');
  }
  return runTransaction(
    [V1_SYNC_OUTBOX_STORE, V1_SYNC_CONFLICT_STORE],
    'readwrite',
    (transaction, control) => {
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const conflicts = transaction.objectStore(V1_SYNC_CONFLICT_STORE);
      const request = outbox.get(opId);
      request.onerror = () => control.abort(request.error);
      request.onsuccess = () => {
        const operation = request.result;
        if (!operation) {
          control.abort(new Error('V1 operation not found'));
          return;
        }
        if (operation.status === 'conflict') {
          control.setResult(false);
          return;
        }
        if (!isOutstanding(operation)) {
          control.abort(new Error('V1 operation cannot enter conflict'));
          return;
        }
        const queued = outbox.getAll();
        queued.onerror = () => control.abort(queued.error);
        queued.onsuccess = () => {
          const tail = queued.result.filter(op => op.uid === operation.uid &&
            op.generationId === operation.generationId && op.entityKey === operation.entityKey &&
            op.sequence > operation.sequence && isOutstanding(op))
            .sort((left, right) => right.sequence - left.sequence)[0];
          const entry = conflictRecord(operation, conflict, { now });
          if (tail) {
            entry.local = tail.revision;
            entry.localVersion = recordVersion(tail.revision, operationItem(tail), tail.action === 'delete');
          }
          conflicts.put(entry);
        };
        outbox.put({
          ...operation,
          status: 'conflict',
          lastError: 'V1_SYNC_CONFLICT',
          updatedAt: now,
        });
        control.setResult(true);
      };
    },
  );
}

/** Atomically merge one advanced remote version into a pending local update.
 * The operation keeps its opId but receives a new base/revision before retry.
 */
export async function mergeLocalOperationWithRemote(opId, conflict, {
  now = new Date().toISOString(),
} = {}) {
  if (typeof opId !== 'string' || !TOKEN.test(opId)) failClosed('operation ID');
  if (!conflict || typeof conflict !== 'object' || Array.isArray(conflict)) {
    failClosed('conflict');
  }
  return runTransaction(
    [V1_SYNC_OUTBOX_STORE, V1_LOCAL_STATE_STORE, V1_ENTITY_META_STORE, V1_SYNC_CONFLICT_STORE],
    'readwrite',
    (transaction, control) => {
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const metaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const reads = {};
      const done = new Set();
      const stage = () => {
        if (done.size !== 4) return;
        try {
          const operation = reads.operation;
          if (!operation) failClosed('operation');
          validateScope(operation.uid, operation.generationId);
          if (reads.meta?.deleted || conflict.remoteDeleted === true || conflict.remoteRecord?.deleted === true) {
            control.setResult({ merged: false, reason: 'tombstone' });
            return;
          }
          if (reads.conflicts.some(row => row.uid === operation.uid &&
            row.generationId === operation.generationId && row.entityKey === operation.entityKey &&
            row.status === 'open') || !isOutstanding(operation) || (reads.meta?.pendingOpId &&
            reads.meta.pendingOpId !== opId)) {
            control.setResult({ merged: false, reason: 'operation-status' });
            return;
          }
          const remoteRecord = conflict.remoteRecord;
          if (!remoteRecord) {
            control.setResult({ merged: false, reason: 'missing-remote' });
            return;
          }
          validateRecord(remoteRecord);
          if (remoteRecord.generationId !== operation.generationId ||
            remoteRecord.entityType !== operation.entityType ||
            String(remoteRecord.entityId) !== String(operation.entityId)) {
            failClosed('remote conflict identity');
          }
          if (operation.action === 'delete') {
            control.setResult({ merged: false, reason: 'delete' });
            return;
          }
          if (operation.baseRevision > 0 && !operation.baseRecord) {
            control.setResult({ merged: false, reason: 'missing-base' });
            return;
          }
          const localItem = operationItem(operation);
          const remoteItem = itemFromRemote(remoteRecord);
          const merged = mergeIndependentRecords({
            base: operation.baseRecord || null,
            local: localItem,
            remote: remoteItem,
          });
          if (!merged.merged) {
            control.setResult({ ...merged, reason: 'same-field' });
            return;
          }
          const stateRecord = reads.state;
          if (!stateRecord?.state) failClosed('verified state');
          const dataText = encodeRecordData(merged.record);
          const baseRevision = remoteRecord.revision;
          const revision = baseRevision + 1;
          const updated = {
            ...operation,
            path: clone(merged.record.path),
            baseRecord: clone(remoteItem),
            baseRevision,
            revision,
            action: 'upsert',
            data: clone(merged.record.data),
            dataText,
            opDigest: sha256Utf8(dataText),
            status: 'pending',
            attempts: 0,
            nextAttemptAt: null,
            lastError: null,
            updatedAt: now,
          };
          const metaKey = entityMetaKey(operation.uid, operation.generationId,
            operation.entityKey);
          const previous = convertBackupV12(stateRecord.state).records[operation.collection]
            .find((candidate) => candidate.key === operation.entityKey) || null;
          stateStore.put({
            ...stateRecord,
            state: stateWithRecord(stateRecord.state, previous, merged.record),
            verified: true,
            verifiedAt: stateRecord.verifiedAt || now,
            updatedAt: now,
          });
          outbox.put(updated);
          metaStore.put({
            ...(reads.meta || {}),
            key: metaKey,
            uid: operation.uid,
            generationId: operation.generationId,
            entityKey: operation.entityKey,
            entityType: operation.entityType,
            entityId: operation.entityId,
            collection: operation.collection,
            baseRevision,
            revision,
            deleted: false,
            pendingOpId: operation.opId,
            lastRecord: clone(remoteItem),
            lastRemoteRecord: clone(remoteRecord),
            updatedAt: now,
          });
          control.setResult({ merged: true, operation: clone(updated), record: merged.record });
        } catch (error) {
          control.abort(error);
        }
      };
      const read = (store, key, field) => {
        const request = key === null ? store.getAll() : store.get(key);
        request.onsuccess = () => {
          reads[field] = request.result || null;
          done.add(field);
          stage();
        };
        request.onerror = () => control.abort(request.error);
      };
      const initial = outbox.get(opId);
      initial.onsuccess = () => {
        reads.operation = initial.result || null;
        if (!reads.operation) {
          control.abort(new Error('V1 operation not found'));
          return;
        }
        const scope = scopeKey(reads.operation.uid, reads.operation.generationId);
        const metaKey = entityMetaKey(reads.operation.uid, reads.operation.generationId,
          reads.operation.entityKey);
        read(transaction.objectStore(V1_SYNC_CONFLICT_STORE), null, 'conflicts');
        read(stateStore, scope, 'state');
        read(metaStore, metaKey, 'meta');
        done.add('operation');
        stage();
      };
      initial.onerror = () => control.abort(initial.error);
    },
  );
}

function resolutionDigest(choice, item) {
  const value = item ? encodeRecordData(item) : 'null';
  return sha256Utf8(`${choice}\n${value}`);
}

/** Explicitly resolve one isolated conflict. Repeated identical calls are idempotent. */
export async function resolveLocalConflict({
  uid,
  generationId,
  conflictId,
  choice,
  record = null,
  now = new Date().toISOString(),
} = {}) {
  validateScope(uid, generationId);
  if (typeof conflictId !== 'string' || !TOKEN.test(conflictId)) failClosed('conflict ID');
  if (!['local', 'remote', 'merged'].includes(choice)) failClosed('resolution choice');
  const key = conflictKey(uid, generationId, conflictId);
  return runTransaction(
    [V1_SYNC_OUTBOX_STORE, V1_SYNC_CONFLICT_STORE, V1_LOCAL_STATE_STORE, V1_ENTITY_META_STORE],
    'readwrite',
    (transaction, control) => {
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const conflicts = transaction.objectStore(V1_SYNC_CONFLICT_STORE);
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const metaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const conflictRequest = conflicts.get(key);
      conflictRequest.onerror = () => control.abort(conflictRequest.error);
      conflictRequest.onsuccess = () => {
        const conflict = conflictRequest.result;
        if (!conflict) {
          control.abort(new Error('V1 conflict not found'));
          return;
        }
        if (conflict.uid !== uid || conflict.generationId !== generationId ||
          conflict.conflictId !== conflictId) failClosed('conflict scope');
        const chosen = choice === 'merged' ? record : null;
        if (choice === 'merged') {
          if (!chosen) failClosed('merged revision');
          checkCodecRecordForLocal(chosen);
          if (chosen.key !== conflict.entityKey ||
            chosen.entityType !== conflict.entityType ||
            String(chosen.entityId) !== String(conflict.entityId)) {
            failClosed('merged identity');
          }
        }
        const digest = resolutionDigest(choice, chosen ||
          (choice === 'local' ? conflict.localVersion?.record : null));
        if (conflict.status === 'resolved') {
          if (conflict.resolution?.choice !== choice ||
            conflict.resolution?.digest !== digest) {
            control.abort(new Error('V1 conflict already resolved differently'));
            return;
          }
          control.setResult({
            idempotent: true,
            status: conflict.resolution.status,
            operation: clone(conflict.resolution.operation || null),
          });
          return;
        }
        if (conflict.status !== 'open') failClosed('conflict status');

        const operationRequest = outbox.get(conflict.opId);
        operationRequest.onerror = () => control.abort(operationRequest.error);
        operationRequest.onsuccess = () => {
          const operation = operationRequest.result;
          if (!operation) {
            control.abort(new Error('V1 conflict operation not found'));
            return;
          }
          const stateRequest = stateStore.get(scopeKey(uid, generationId));
          stateRequest.onerror = () => control.abort(stateRequest.error);
          stateRequest.onsuccess = () => {
            const stateRecord = stateRequest.result;
            if (!stateRecord?.state) {
              control.abort(new Error('V1 conflict state not found'));
              return;
            }
            const metaKey = entityMetaKey(uid, generationId, conflict.entityKey);
            const metaRequest = metaStore.get(metaKey);
            metaRequest.onerror = () => control.abort(metaRequest.error);
            metaRequest.onsuccess = () => {
              try {
                const meta = metaRequest.result || null;
                const remote = conflict.remoteVersion;
                if (!remote || !Number.isSafeInteger(remote.revision)) {
                  failClosed('remote conflict version');
                }
                const confirmedRevision = meta?.pendingOpId
                  ? meta.lastRemoteRecord?.revision ?? operation.baseRevision
                  : meta?.revision;
                if (confirmedRevision > remote.revision ||
                  (meta?.deleted && (!remote.deleted || choice !== 'remote'))) {
                  failClosed('stale conflict or terminal tombstone');
                }
                const previous = convertBackupV12(stateRecord.state)
                  .records[conflict.collection]
                  .find((candidate) => candidate.key === conflict.entityKey) || null;
                // The selected version resolves the entire entity, including edits queued during apply.
                const queued = outbox.getAll();
                queued.onerror = () => control.abort(queued.error);
                queued.onsuccess = () => {
                  for (const op of queued.result) {
                    if (op.uid === uid && op.generationId === generationId &&
                      op.entityKey === operation.entityKey && op.sequence > operation.sequence &&
                      isOutstanding(op)) outbox.put({ ...op, status: 'resolved', updatedAt: now });
                  }
                };
                let resultStatus;
                let nextOperation = null;
                let nextState;
                if (choice === 'remote') {
                  nextState = stateWithRecord(stateRecord.state, previous, remote.record);
                  outbox.put({
                    ...operation,
                    status: 'resolved',
                    nextAttemptAt: null,
                    lastError: 'V1_SYNC_RESOLVED_REMOTE',
                    updatedAt: now,
                  });
                  metaStore.put({
                    ...(meta || {}),
                    key: metaKey,
                    uid,
                    generationId,
                    entityKey: conflict.entityKey,
                    entityType: conflict.entityType,
                    entityId: conflict.entityId,
                    collection: conflict.collection,
                    baseRevision: remote.revision,
                    revision: remote.revision,
                    deleted: remote.deleted === true,
                    pendingOpId: null,
                    lastRecord: clone(remote.record),
                    lastRemoteRecord: clone(conflict.remoteRecord),
                    updatedAt: now,
                  });
                  resultStatus = 'resolved';
                } else {
                  if (remote.deleted === true) failClosed('tombstone wins over local resolution');
                  let item;
                  if (choice === 'local') {
                    if (conflict.localVersion?.deleted === true) item = null;
                    else item = conflict.localVersion?.record || operationItem(operation);
                  } else {
                    item = chosen;
                  }
                  if (item) checkCodecRecordForLocal(item);
                  const baseRevision = remote.revision;
                  const revision = baseRevision + 1;
                  const dataText = item ? encodeRecordData(item) : 'null';
                  nextOperation = {
                    ...operation,
                    path: item ? clone(item.path) : clone(operation.path),
                    baseRecord: clone(remote.record),
                    baseRevision,
                    revision,
                    action: item ? 'upsert' : 'delete',
                    data: item ? clone(item.data) : null,
                    dataText,
                    opDigest: sha256Utf8(dataText),
                    status: 'pending',
                    attempts: 0,
                    nextAttemptAt: null,
                    lastError: null,
                    updatedAt: now,
                  };
                  outbox.put(nextOperation);
                  nextState = stateWithRecord(stateRecord.state, previous, item);
                  metaStore.put({
                    ...(meta || {}),
                    key: metaKey,
                    uid,
                    generationId,
                    entityKey: conflict.entityKey,
                    entityType: conflict.entityType,
                    entityId: conflict.entityId,
                    collection: conflict.collection,
                    baseRevision,
                    revision,
                    deleted: false,
                    lastRecord: clone(remote.record),
                    lastRemoteRecord: clone(conflict.remoteRecord),
                    pendingOpId: conflict.opId,
                    updatedAt: now,
                  });
                  resultStatus = 'pending';
                }
                stateStore.put({
                  ...stateRecord,
                  state: nextState,
                  verified: true,
                  verifiedAt: stateRecord.verifiedAt || now,
                  updatedAt: now,
                });
                conflicts.put({
                  ...conflict,
                  status: 'resolved',
                  resolution: {
                    choice,
                    digest,
                    status: resultStatus,
                    revision: nextOperation?.revision ?? conflict.remoteVersion?.revision ?? null,
                    operation: nextOperation ? clone(nextOperation) : null,
                    resolvedAt: now,
                  },
                  updatedAt: now,
                });
                control.setResult({
                  status: resultStatus,
                  operation: clone(nextOperation),
                });
              } catch (error) {
                control.abort(error);
              }
            };
          };
        };
      };
    },
  );
}

function checkCodecRecordForLocal(item) {
  const text = encodeRecordData(item);
  const parsed = JSON.parse(text);
  if (!parsed || parsed.key !== item.key) failClosed('record');
}

function validateReceipt(operation, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) failClosed('ACK');
  if (Object.hasOwn(input, 'uid') && input.uid !== operation.uid) failClosed('ACK UID');
  const receipt = clone(input);
  if (Object.hasOwn(receipt, 'uid')) delete receipt.uid;
  if (Object.keys(receipt).length !== RECEIPT_FIELDS.length ||
    !RECEIPT_FIELDS.every((field) => Object.hasOwn(receipt, field)) ||
    Object.hasOwn(receipt, 'data')) {
    failClosed('ACK fields');
  }
  if (receipt.schemaVersion !== 1 || receipt.opId !== operation.opId ||
    receipt.generationId !== operation.generationId ||
    receipt.entityType !== operation.entityType ||
    String(receipt.entityId) !== String(operation.entityId) ||
    receipt.collection !== operation.collection ||
    receipt.baseRevision !== operation.baseRevision ||
    receipt.revision !== operation.revision ||
    receipt.opDigest !== operation.opDigest ||
    receipt.deleted !== (operation.action === 'delete') ||
    !SHA256.test(receipt.opDigest) || typeof receipt.deleted !== 'boolean' ||
    !isTimestamp(receipt.updatedAt)) {
    failClosed('ACK receipt');
  }
  return receipt;
}

export async function ackLocalOperation(opId, receipt) {
  if (typeof opId !== 'string' || !TOKEN.test(opId)) failClosed('operation ID');
  await runTransaction(
    [V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE],
    'readwrite',
    (transaction, control) => {
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const metaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const request = outbox.get(opId);
      request.onerror = () => control.abort(request.error);
      request.onsuccess = () => {
        const operation = request.result;
        if (!operation) {
          control.abort(new Error('V1 operation not found'));
          return;
        }
        validateScope(operation.uid, operation.generationId);
        let validated;
        try {
          validated = validateReceipt(operation, receipt);
        } catch (error) {
          control.abort(error);
          return;
        }
        if (operation.status === 'acked') {
          if (canonical(operation.receipt) !== canonical(validated)) {
            control.abort(new Error('V1 operation already acknowledged with another receipt'));
          }
          return;
        }
        if (!isOutstanding(operation)) {
          control.abort(new Error('V1 operation cannot be acknowledged'));
          return;
        }
        const now = new Date().toISOString();
        outbox.put({
          ...operation,
          status: 'acked',
          receipt: validated,
          ackedAt: now,
          updatedAt: now,
        });
        const key = entityMetaKey(operation.uid, operation.generationId, operation.entityKey);
        const metaRequest = metaStore.get(key);
        metaRequest.onerror = () => control.abort(metaRequest.error);
        metaRequest.onsuccess = () => {
          const previous = metaRequest.result;
          metaStore.put({
            key,
            uid: operation.uid,
            generationId: operation.generationId,
            entityKey: operation.entityKey,
            entityType: operation.entityType,
            entityId: operation.entityId,
            collection: operation.collection,
            baseRevision: validated.revision,
            revision: Math.max(previous?.revision ?? 0, validated.revision),
            deleted: validated.deleted,
            pendingOpId: previous?.pendingOpId === opId ? null : previous?.pendingOpId ?? null,
            lastAckedOpId: operation.opId,
            lastRecord: validated.deleted ? null : operationItem(operation),
            lastRemoteRecord: {
              ...validated,
              data: validated.deleted ? null : operation.dataText,
            },
            updatedAt: now,
            ...(previous?.verified === true ? { verified: true } : {}),
          });
        };
      };
    },
  );
}

export async function listLocalConflicts(uid, generationId) {
  const key = scopeKey(uid, generationId);
  const all = await runTransaction([V1_SYNC_CONFLICT_STORE], 'readonly', (transaction, control) => {
    const request = transaction.objectStore(V1_SYNC_CONFLICT_STORE).getAll();
    request.onsuccess = () => control.setResult(request.result || []);
    request.onerror = () => control.abort(request.error);
  });
  return all.filter((conflict) => conflict?.uid === uid && conflict?.generationId === generationId &&
    typeof conflict.key === 'string' && conflict.key.startsWith(`${key}\u0000`))
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(clone);
}

export async function readLocalConflict(uid, generationId, conflictId) {
  const key = conflictKey(uid, generationId, conflictId);
  const conflict = await runTransaction([V1_SYNC_CONFLICT_STORE], 'readonly', (transaction, control) => {
    const request = transaction.objectStore(V1_SYNC_CONFLICT_STORE).get(key);
    request.onsuccess = () => control.setResult(request.result || null);
    request.onerror = () => control.abort(request.error);
  });
  if (!conflict) return null;
  if (conflict.uid !== uid || conflict.generationId !== generationId) failClosed('conflict');
  return clone(conflict);
}

export async function getLocalSyncStatus(uid, generationId) {
  validateScope(uid, generationId);
  const key = scopeKey(uid, generationId);
  const result = await runTransaction(
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_SYNC_CONFLICT_STORE],
    'readonly',
    (transaction, control) => {
      const reads = {};
      const done = {};
      const finish = () => {
        if (!Object.values(done).every(Boolean)) return;
        control.setResult(reads);
      };
      for (const [field, storeName, all] of [
        ['state', V1_LOCAL_STATE_STORE, false],
        ['operations', V1_SYNC_OUTBOX_STORE, true],
        ['conflicts', V1_SYNC_CONFLICT_STORE, true],
      ]) {
        const store = transaction.objectStore(storeName);
        const request = all ? store.getAll() : store.get(key);
        request.onsuccess = () => {
          reads[field] = request.result;
          done[field] = true;
          finish();
        };
        request.onerror = () => control.abort(request.error);
      }
    },
  );
  const operations = (result.operations || []).filter((operation) =>
    operation.uid === uid && operation.generationId === generationId);
  const conflicts = (result.conflicts || []).filter((conflict) =>
    conflict.uid === uid && conflict.generationId === generationId &&
    typeof conflict.key === 'string' && conflict.key.startsWith(`${key}\u0000`));
  const openConflicts = conflicts.filter((conflict) => conflict.status !== 'resolved');
  return {
    verified: result.state?.verified === true,
    pending: operations.filter((operation) => ['pending', 'in-flight'].includes(operation.status)).length,
    retry: operations.filter((operation) => operation.status === 'retry').length,
    acked: operations.filter((operation) => operation.status === 'acked').length,
    conflicts: openConflicts.length,
    total: operations.length,
  };
}
