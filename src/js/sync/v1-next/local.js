import { convertBackupV12, reconstituteBackupV12 } from './backup-codec.js';
import {
  encodeRecordData,
  entityCollectionForType,
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

  const changes = new Map();
  for (const [entityKey, record] of previousRecords) {
    if (!nextRecords.has(entityKey)) {
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

  const updatedPending = new Map(pending.map((operation) => [operation.opId, clone(operation)]));
  const committedOperations = [];
  const entityMetaUpdates = new Map();
  const deletedOperationIds = [];
  const deletedEntityMetaKeys = [];
  let sequence = Math.max(
    Number.isSafeInteger(syncMeta?.nextSequence) ? syncMeta.nextSequence - 1 : 0,
    ...pending.map((operation) => Number(operation.sequence) || 0),
  );

  const ordered = [...changes.entries()].sort(([left], [right]) =>
    left.localeCompare(right));
  for (const [entityKey, change] of ordered) {
    const template = change.next || change.previous;
    const meta = metaByKey.get(entityKey);
    const baseRevision = Number.isSafeInteger(meta?.baseRevision) ? meta.baseRevision : 0;
    const candidate = [...updatedPending.values()]
      .filter((operation) => operation.entityKey === entityKey &&
        ['pending', 'retry'].includes(operation.status) &&
        operation.baseRevision === baseRevision)
      .sort((left, right) => right.sequence - left.sequence)[0] || null;
    let operation = candidate;
    if (change.action === 'delete' && baseRevision === 0) {
      if (operation) {
        updatedPending.delete(operation.opId);
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
      updatedPending.set(operation.opId, operation);
    }
    committedOperations.push(clone(operation));
    entityMetaUpdates.set(entityMetaKey(uid, generationId, entityKey), {
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
            ['pending', 'retry'].includes(operation.status));
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
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE],
    'readwrite',
    (transaction, control) => {
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const metaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const reads = {};
      const done = new Set();
      const stage = () => {
        if (done.size !== 4) return;
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
            operation?.entityKey === entityKey && ['pending', 'retry'].includes(operation.status));
          if (pending.length) {
            control.setResult({ applied: false, reason: 'pending' });
            return;
          }
          const meta = reads.meta;
          if (meta && (meta.revision > record.revision ||
            (meta.revision === record.revision && meta.lastAckedOpId === record.opId))) {
            control.setResult({ applied: false, reason: 'already-current' });
            return;
          }
          if (meta && meta.revision === record.revision &&
            meta.lastAckedOpId !== record.opId) {
            failClosed('conflicting remote revision');
          }

          const converted = convertBackupV12(stateRecord.state);
          let item = null;
          if (!record.deleted) {
            item = JSON.parse(record.data);
            if (item.key !== entityKey || item.entityType !== record.entityType ||
              String(item.entityId) !== record.entityId) {
              failClosed('remote payload identity');
            }
          }
          const records = converted.records;
          records[record.collection] = records[record.collection]
            .filter((candidate) => candidate.key !== entityKey);
          if (item) records[record.collection].push(item);
          const nextState = reconstituteBackupV12(records);

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
            pendingOpId: null,
            lastAckedOpId: record.opId,
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
    [V1_LOCAL_STATE_STORE, V1_SYNC_OUTBOX_STORE, V1_ENTITY_META_STORE, V1_SYNC_META_STORE],
    'readwrite',
    (transaction, control) => {
      const stateStore = transaction.objectStore(V1_LOCAL_STATE_STORE);
      const outbox = transaction.objectStore(V1_SYNC_OUTBOX_STORE);
      const entityMetaStore = transaction.objectStore(V1_ENTITY_META_STORE);
      const syncMetaStore = transaction.objectStore(V1_SYNC_META_STORE);
      const reads = {
        state: undefined,
        operations: undefined,
        meta: undefined,
        syncMeta: undefined,
        pointer: undefined,
      };
      const done = {
        state: false,
        operations: false,
        meta: false,
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
            syncMeta: reads.syncMeta || null,
            verified: reads.state?.verified,
          });
          stateStore.put(prepared.stateRecord);
          for (const operation of prepared.operations) outbox.put(operation);
          for (const opId of prepared.deletedOperationIds) outbox.delete(opId);
          for (const record of prepared.entityMeta) entityMetaStore.put(record);
          for (const key of prepared.deletedEntityMetaKeys) entityMetaStore.delete(key);
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

export async function getPendingOperations(uid, generationId) {
  validateScope(uid, generationId);
  const all = await runTransaction([V1_SYNC_OUTBOX_STORE], 'readonly', (transaction, control) => {
    const request = transaction.objectStore(V1_SYNC_OUTBOX_STORE).getAll();
    request.onsuccess = () => control.setResult(request.result || []);
    request.onerror = () => control.abort(request.error);
  });
  return all
    .filter((operation) => operation?.uid === uid && operation?.generationId === generationId &&
      ['pending', 'retry'].includes(operation.status))
    .sort((left, right) => left.sequence - right.sequence || left.createdAt.localeCompare(right.createdAt))
    .map(clone);
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
        if (!['pending', 'retry'].includes(operation.status)) {
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
            revision: validated.revision,
            pendingOpId: null,
            lastAckedOpId: operation.opId,
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
  return {
    verified: result.state?.verified === true,
    pending: operations.filter((operation) => operation.status === 'pending').length,
    retry: operations.filter((operation) => operation.status === 'retry').length,
    acked: operations.filter((operation) => operation.status === 'acked').length,
    conflicts: conflicts.length,
    total: operations.length,
  };
}
