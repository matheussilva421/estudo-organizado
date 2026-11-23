import {
  classifyRevisions,
  encodeDocId,
  encodeRecordData,
  entityCollectionForType,
  recordKey,
  validateManifest,
  validateRecord,
} from './contracts.js';
import { sha256Utf8 } from './sha256.js';

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const COLLECTIONS = [
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
];
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
const REQUIRED_SDK = [
  'collection',
  'doc',
  'getDoc',
  'getDocs',
  'getDocsFromServer',
  'onSnapshot',
  'runTransaction',
  'serverTimestamp',
];

let remoteConfig = null;

export class V1RemoteError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = 'V1RemoteError';
    this.code = code;
    this.cause = cause;
  }
}

function remoteError(code, message, cause = null) {
  if (cause?.code?.startsWith?.('V1_REMOTE_')) return cause;
  return new V1RemoteError(code, message, cause);
}

function fail(code, description, cause = null) {
  throw remoteError(code, description, cause);
}

function isMap(value) {
  return value !== null && typeof value === 'object' &&
    [null, Object.prototype].includes(Object.getPrototypeOf(value));
}

function isTimestamp(value) {
  return value !== null && typeof value === 'object' && Number.isInteger(value.seconds) &&
    value.seconds >= -62135596800 && value.seconds <= 253402300799 &&
    Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 &&
    value.nanoseconds < 1e9;
}

function natural(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function exact(map, fields) {
  return isMap(map) && Object.keys(map).length === fields.length &&
    fields.every(field => Object.hasOwn(map, field));
}

function validateUid(uid) {
  if (typeof uid !== 'string' || !TOKEN.test(uid)) {
    fail('V1_REMOTE_INVALID_UID', 'UID de sincronização inválido.');
  }
}

function validateGenerationId(generationId) {
  if (typeof generationId !== 'string' || !TOKEN.test(generationId)) {
    fail('V1_REMOTE_INVALID_GENERATION', 'Geração de sincronização inválida.');
  }
}

function validateControl(control) {
  if (!exact(control, ['schemaVersion', 'generationId', 'updatedAt']) ||
    control.schemaVersion !== 1 || !TOKEN.test(control.generationId) ||
    !isTimestamp(control.updatedAt)) {
    fail('V1_REMOTE_INVALID_CONTROL', 'Controle de geração inválido.');
  }
}

function checkedManifest(manifest, generationId) {
  try {
    validateManifest(manifest);
  } catch (error) {
    fail('V1_REMOTE_INVALID_MANIFEST', 'Manifesto remoto inválido.', error);
  }
  if (manifest.generationId !== generationId) {
    fail('V1_REMOTE_GENERATION_INVALID', 'A geração do manifesto não corresponde.');
  }
  if (!['verified', 'active'].includes(manifest.state)) {
    fail('V1_REMOTE_GENERATION_INACTIVE', 'A geração remota não está homologada.');
  }
  return manifest;
}

function sdkFailure(error, fallbackCode = 'V1_REMOTE_UNAVAILABLE') {
  if (error?.code?.startsWith?.('V1_REMOTE_')) return error;
  const code = error?.code || '';
  if (code === 'permission-denied') {
    return remoteError('V1_REMOTE_PERMISSION_DENIED', 'Firestore negou a operação.', error);
  }
  if (code === 'deadline-exceeded' || code === 'timeout') {
    return remoteError('V1_REMOTE_TIMEOUT', 'A operação remota excedeu o tempo limite.', error);
  }
  if (code === 'unavailable' || code === 'offline' || code === 'cancelled') {
    return remoteError('V1_REMOTE_UNAVAILABLE', 'Firestore está indisponível.', error);
  }
  if (code === 'unauthenticated') {
    return remoteError('V1_REMOTE_AUTH_REQUIRED', 'A sessão remota não está autenticada.', error);
  }
  return remoteError(fallbackCode, 'A operação remota falhou.', error);
}

function requireConfig() {
  if (!remoteConfig) {
    fail('V1_REMOTE_NOT_CONFIGURED', 'O repositório remoto V1 não foi configurado.');
  }
  return remoteConfig;
}

function requireAuth(config, uid) {
  if (!config.auth?.currentUser) {
    fail('V1_REMOTE_AUTH_REQUIRED', 'É necessário autenticar antes de sincronizar.');
  }
  if (config.auth.currentUser.uid !== uid) {
    fail('V1_REMOTE_UID_MISMATCH', 'A sessão autenticada pertence a outro UID.');
  }
}

function requireOnline(config) {
  const online = config.isOnline ? config.isOnline() : globalThis.navigator?.onLine !== false;
  if (!online) {
    fail('V1_REMOTE_OFFLINE', 'Firestore está offline. A operação permanece na fila local.');
  }
}

function controlRef(config, uid) {
  return config.sdk.doc(config.db, 'users', uid, 'v1SyncControl', 'current');
}

function manifestRef(config, uid, generationId) {
  return config.sdk.doc(config.db, 'users', uid, 'v1SyncNamespaces', generationId);
}

function entityRef(config, uid, operation, generationId = operation.generationId) {
  return config.sdk.doc(
    config.db,
    'users',
    uid,
    'v1SyncNamespaces',
    generationId,
    operation.collection,
    operation.entityDocId,
  );
}

function operationRef(config, uid, operation, generationId = operation.generationId) {
  return config.sdk.doc(
    config.db,
    'users',
    uid,
    'v1SyncNamespaces',
    generationId,
    'operations',
    operation.opId,
  );
}

function recordForOperation(operation, updatedAt) {
  return {
    schemaVersion: 1,
    generationId: operation.generationId,
    collection: operation.collection,
    entityType: operation.entityType,
    entityId: operation.entityId,
    baseRevision: operation.baseRevision,
    revision: operation.revision,
    opId: operation.opId,
    opDigest: operation.opDigest,
    deleted: operation.deleted,
    data: operation.deleted ? null : operation.dataText,
    updatedAt,
  };
}

function receiptForOperation(operation, updatedAt) {
  const { data: _data, ...receipt } = recordForOperation(operation, updatedAt);
  return receipt;
}

function normalizeOperation(operation) {
  if (!isMap(operation)) {
    fail('V1_REMOTE_INVALID_OPERATION', 'Operação remota inválida.');
  }
  try {
    validateUid(operation.uid);
    validateGenerationId(operation.generationId);
    if (typeof operation.opId !== 'string' || !TOKEN.test(operation.opId) ||
      !natural(operation.baseRevision) || !natural(operation.revision) ||
      operation.revision !== operation.baseRevision + 1 ||
      !['upsert', 'delete'].includes(operation.action) ||
      (typeof operation.entityId !== 'string' && !Number.isFinite(operation.entityId)) ||
      String(operation.entityId).length === 0) {
      throw new TypeError('operation envelope');
    }
    const entityId = String(operation.entityId);
    const collection = entityCollectionForType(operation.entityType);
    if (operation.collection !== collection) throw new TypeError('operation collection');
    const key = recordKey(operation.entityType, entityId);
    if (operation.entityKey !== undefined && operation.entityKey !== key) {
      throw new TypeError('operation key');
    }
    const deleted = operation.action === 'delete';
    let baseRecord = null;
    if (operation.baseRecord != null) {
      const encodedBase = encodeRecordData(operation.baseRecord);
      baseRecord = JSON.parse(encodedBase);
      if (baseRecord.key !== key || baseRecord.entityType !== operation.entityType ||
        String(baseRecord.entityId) !== entityId) {
        throw new TypeError('operation base identity');
      }
    }
    let dataText;
    if (deleted) {
      if (operation.baseRevision === 0 || operation.data !== null) {
        throw new TypeError('delete base');
      }
      dataText = 'null';
    } else {
      let item;
      try {
        item = JSON.parse(operation.dataText);
      } catch {
        throw new TypeError('operation payload JSON');
      }
      if (item.entityType !== operation.entityType ||
        String(item.entityId) !== entityId || item.key !== key ||
        JSON.stringify(item.path) !== JSON.stringify(operation.path)) {
        throw new TypeError('operation payload identity');
      }
      dataText = encodeRecordData(item);
    }
    if (typeof operation.dataText !== 'string' || operation.dataText !== dataText ||
      typeof operation.opDigest !== 'string' || !SHA256.test(operation.opDigest) ||
      operation.opDigest !== sha256Utf8(dataText)) {
      throw new TypeError('operation payload');
    }
    const normalized = {
      uid: operation.uid,
      generationId: operation.generationId,
      opId: operation.opId,
      entityType: operation.entityType,
      entityId,
      entityDocId: encodeDocId(key),
      collection,
      path: operation.path,
      baseRevision: operation.baseRevision,
      revision: operation.revision,
      deleted,
      data: operation.data,
      dataText,
      opDigest: operation.opDigest,
      baseRecord,
      localRecord: deleted ? null : JSON.parse(dataText),
    };
    validateRecord(recordForOperation(normalized,
      { seconds: 1, nanoseconds: 0 }));
    return normalized;
  } catch (error) {
    if (error?.code?.startsWith?.('V1_REMOTE_')) throw error;
    fail('V1_REMOTE_INVALID_OPERATION', 'Operação remota inválida.', error);
  }
}

function validateReceiptForOperation(receipt, operation) {
  if (!isMap(receipt) || !exact(receipt, RECEIPT_FIELDS)) {
    fail('V1_REMOTE_OP_CONFLICT', 'O opId já possui um recibo incompatível.');
  }
  const mismatched = [
    'schemaVersion', 'generationId', 'entityType', 'entityId', 'collection',
    'revision', 'baseRevision', 'opId', 'opDigest', 'deleted',
  ].some(field => receipt[field] !== (
    field === 'deleted' ? operation.deleted :
      field === 'schemaVersion' ? 1 : operation[field]
  ));
  if (mismatched) {
    fail('V1_REMOTE_OP_CONFLICT', 'O opId foi reutilizado com outro conteúdo.');
  }
  try {
    validateRecord({ ...receipt, data: operation.deleted ? null : operation.dataText });
  } catch (error) {
    fail('V1_REMOTE_INVALID_RECEIPT', 'Recibo remoto inválido.', error);
  }
  return receipt;
}

function generationFromSnapshot(controlSnapshot, manifestSnapshot) {
  validateControl(controlSnapshot.data());
  const control = controlSnapshot.data();
  const manifest = checkedManifest(manifestSnapshot.data(), control.generationId);
  return { generationId: control.generationId, control, manifest };
}

async function readCurrentGeneration(config, uid) {
  const controlSnapshot = await config.sdk.getDoc(controlRef(config, uid));
  if (controlSnapshot.metadata?.fromCache !== false) {
    fail('V1_REMOTE_CACHE_REJECTED', 'O controle da geração não veio do servidor.');
  }
  if (!controlSnapshot.exists()) return null;
  const control = controlSnapshot.data();
  validateControl(control);
  const manifestSnapshot = await config.sdk.getDoc(
    manifestRef(config, uid, control.generationId),
  );
  if (manifestSnapshot.metadata?.fromCache !== false) {
    fail('V1_REMOTE_CACHE_REJECTED', 'O manifesto da geração não veio do servidor.');
  }
  if (!manifestSnapshot.exists()) {
    fail('V1_REMOTE_GENERATION_INVALID', 'O manifesto da geração atual não existe.');
  }
  const generation = generationFromSnapshot(controlSnapshot, manifestSnapshot);
  return { uid, ...generation };
}

async function readCurrentGenerationInTransaction(transaction, config, uid, generationId) {
  const controlSnapshot = await transaction.get(controlRef(config, uid));
  if (!controlSnapshot.exists()) {
    fail('V1_REMOTE_GENERATION_INVALID', 'O controle da geração não existe.');
  }
  const control = controlSnapshot.data();
  validateControl(control);
  if (control.generationId !== generationId) {
    fail('V1_REMOTE_GENERATION_INVALID', 'A geração da operação não é a geração atual.');
  }
  const manifestSnapshot = await transaction.get(manifestRef(config, uid, generationId));
  if (!manifestSnapshot.exists()) {
    fail('V1_REMOTE_GENERATION_INVALID', 'O manifesto da operação não existe.');
  }
  return generationFromSnapshot(controlSnapshot, manifestSnapshot);
}

/** Read and validate the Admin-owned pointer plus its active manifest. */
export async function getCurrentGeneration(uid) {
  validateUid(uid);
  const config = requireConfig();
  requireAuth(config, uid);
  requireOnline(config);
  try {
    return await readCurrentGeneration(config, uid);
  } catch (error) {
    throw sdkFailure(error, 'V1_REMOTE_READ_FAILED');
  }
}

/**
 * Apply one durable outbox operation. The entity and immutable receipt are
 * written by the same Firestore transaction. A transaction read of the receipt
 * makes retries idempotent, including after a lost response.
 */
export async function applyRemoteOperation(operation) {
  const normalized = normalizeOperation(operation);
  const config = requireConfig();
  requireAuth(config, normalized.uid);
  requireOnline(config);

  let outcome;
  try {
    outcome = await config.sdk.runTransaction(config.db, async transaction => {
      requireAuth(config, normalized.uid);
      await readCurrentGenerationInTransaction(
        transaction,
        config,
        normalized.uid,
        normalized.generationId,
      );
      const receiptSnapshot = await transaction.get(
        operationRef(config, normalized.uid, normalized),
      );
      if (receiptSnapshot.exists()) {
        const receipt = validateReceiptForOperation(receiptSnapshot.data(), normalized);
        return { type: 'replay', receipt };
      }

      const entitySnapshot = await transaction.get(
        entityRef(config, normalized.uid, normalized),
      );
      let remoteRecord = null;
      if (entitySnapshot.exists()) {
        remoteRecord = entitySnapshot.data();
        try {
          validateRecord(remoteRecord);
        } catch (error) {
          fail('V1_REMOTE_INVALID_RECORD', 'Entidade remota inválida.', error);
        }
      }
      const remoteRevision = remoteRecord ? remoteRecord.revision : 0;
      const revisionComparison = classifyRevisions(
        normalized.baseRevision,
        remoteRevision,
        { remoteDeleted: remoteRecord?.deleted === true },
      );
      if (revisionComparison !== 'equal') {
        return {
          type: 'conflict',
          remoteRevision,
          remoteRecord,
          reason: remoteRecord?.deleted ? 'tombstone' : 'revision',
        };
      }

      const entity = recordForOperation(normalized, config.sdk.serverTimestamp());
      const receipt = receiptForOperation(normalized, config.sdk.serverTimestamp());
      try {
        validateRecord({ ...entity, updatedAt: { seconds: 1, nanoseconds: 0 } });
      } catch (error) {
        fail('V1_REMOTE_INVALID_OPERATION', 'A entidade remota não passou na validação.', error);
      }
      transaction.set(entityRef(config, normalized.uid, normalized), entity);
      transaction.set(operationRef(config, normalized.uid, normalized), receipt);
      return { type: 'applied' };
    });
  } catch (error) {
    const failure = sdkFailure(error, 'V1_REMOTE_TRANSACTION_FAILED');
    if (failure.code === 'V1_REMOTE_PERMISSION_DENIED') {
      try {
        const current = await readCurrentGeneration(config, normalized.uid);
        if (!current || current.generationId !== normalized.generationId) {
          fail('V1_REMOTE_GENERATION_INVALID', 'A geração da operação não está ativa.');
        }
        const entitySnapshot = await config.sdk.getDoc(
          entityRef(config, normalized.uid, normalized),
        );
        const remoteRecord = entitySnapshot.exists() ? entitySnapshot.data() : null;
        if (remoteRecord) validateRecord(remoteRecord);
        const remoteRevision = remoteRecord?.revision || 0;
        if (classifyRevisions(normalized.baseRevision, remoteRevision,
          { remoteDeleted: remoteRecord?.deleted === true }) !== 'equal') {
          outcome = {
            type: 'conflict',
            remoteRevision,
            remoteRecord,
            reason: remoteRecord?.deleted ? 'tombstone' : 'revision',
          };
        }
      } catch (classificationError) {
        if (classificationError?.code?.startsWith?.('V1_REMOTE_GENERATION_')) {
          throw classificationError;
        }
      }
    }
    if (!outcome) throw failure;
  }

  if (outcome.type === 'conflict') {
    return {
      opId: normalized.opId,
      entityId: normalized.entityId,
      revision: outcome.remoteRevision,
      acknowledged: false,
      conflict: {
        code: outcome.reason === 'tombstone' ? 'tombstone' : 'revision',
        baseRevision: normalized.baseRevision,
        localRevision: normalized.revision,
        remoteRevision: outcome.remoteRevision,
        baseRecord: normalized.baseRecord,
        localRecord: normalized.localRecord,
        remoteDeleted: outcome.remoteRecord?.deleted === true,
        remoteRecord: outcome.remoteRecord,
      },
    };
  }

  if (outcome.type === 'replay') {
    return {
      opId: normalized.opId,
      entityId: normalized.entityId,
      revision: normalized.revision,
      acknowledged: true,
      receipt: outcome.receipt,
    };
  }

  let receiptSnapshot;
  try {
    receiptSnapshot = await config.sdk.getDoc(
      operationRef(config, normalized.uid, normalized),
    );
  } catch (error) {
    throw sdkFailure(error, 'V1_REMOTE_ACK_FAILED');
  }
  if (!receiptSnapshot.exists()) {
    fail('V1_REMOTE_ACK_FAILED', 'O recibo não está disponível após o commit.');
  }
  const receipt = validateReceiptForOperation(receiptSnapshot.data(), normalized);
  return {
    opId: normalized.opId,
    entityId: normalized.entityId,
    revision: normalized.revision,
    acknowledged: true,
    receipt,
  };
}

function recordsFromSnapshot(snapshot, collectionName, generationId) {
  const records = [];
  for (const documentSnapshot of snapshot.docs) {
    const record = documentSnapshot.data();
    try {
      validateRecord(record);
      const expectedDocId = encodeDocId(recordKey(record.entityType, record.entityId));
      if (expectedDocId !== documentSnapshot.id || record.collection !== collectionName ||
        record.generationId !== generationId) {
        throw new TypeError('document identity');
      }
    } catch (error) {
      fail('V1_REMOTE_INVALID_RECORD', 'Documento remoto inválido na baseline.', error);
    }
    if (record.deleted) continue;
    let item;
    try {
      item = JSON.parse(record.data);
    } catch (error) {
      fail('V1_REMOTE_INVALID_RECORD', 'Payload remoto não é JSON válido.', error);
    }
    if (item.entityType !== record.entityType ||
      String(item.entityId) !== record.entityId ||
      encodeDocId(item.key) !== documentSnapshot.id) {
      fail('V1_REMOTE_INVALID_RECORD', 'A identidade lógica do documento não corresponde.');
    }
    records.push(item);
  }
  return records;
}

/** Read a complete active baseline for the atomic local swap performed by T5. */
export async function fetchGenerationRecords(uid, generationId) {
  validateUid(uid);
  validateGenerationId(generationId);
  const config = requireConfig();
  requireAuth(config, uid);
  requireOnline(config);
  let generation;
  try {
    generation = await getCurrentGeneration(uid);
    if (!generation || generation.generationId !== generationId) {
      fail('V1_REMOTE_GENERATION_INVALID', 'A geração solicitada não está ativa.');
    }
  } catch (error) {
    throw sdkFailure(error, 'V1_REMOTE_READ_FAILED');
  }

  const snapshots = await Promise.all(COLLECTIONS.map(async collectionName => {
    try {
      return [collectionName, await config.sdk.getDocsFromServer(config.sdk.collection(
        config.db,
        'users',
        uid,
        'v1SyncNamespaces',
        generationId,
        collectionName,
      ))];
    } catch (error) {
      throw sdkFailure(error, 'V1_REMOTE_READ_FAILED');
    }
  }));

  let total = 0;
  const records = [];
  const keys = new Set();
  for (const [collectionName, snapshot] of snapshots) {
    if (snapshot.metadata?.fromCache !== false) {
      fail('V1_REMOTE_CACHE_REJECTED', 'A baseline remota não veio do servidor.');
    }
    const expected = generation.manifest.counts.byCollection[collectionName];
    if (snapshot.docs.length !== expected) {
      fail('V1_REMOTE_MANIFEST_MISMATCH', 'A contagem remota não corresponde ao manifesto.');
    }
    total += snapshot.docs.length;
    for (const item of recordsFromSnapshot(snapshot, collectionName, generationId)) {
      if (keys.has(item.key)) {
        fail('V1_REMOTE_INVALID_RECORD', 'Chave lógica duplicada na baseline.');
      }
      keys.add(item.key);
      records.push(item);
    }
  }
  if (total !== generation.manifest.counts.total) {
    fail('V1_REMOTE_MANIFEST_MISMATCH', 'O total remoto não corresponde ao manifesto.');
  }
  return {
    generationId,
    manifest: generation.manifest,
    records,
  };
}

function emitDelta(entry, delta) {
  if (entry.stopped) return;
  for (const subscriber of [...entry.handlers]) {
    if (!subscriber.active) continue;
    try {
      subscriber.onDelta(delta);
    } catch (error) {
      try {
        subscriber.onError(remoteError(
          'V1_REMOTE_CONSUMER_ERROR',
          'O consumidor do delta remoto falhou.',
          error,
        ));
      } catch {
        // A failing observer must not stop the transport for other observers.
      }
    }
  }
}

function stopEntry(entry, error = null) {
  if (entry.stopped) return;
  entry.stopped = true;
  for (const unsubscribe of entry.unsubscribers.splice(0)) {
    try {
      unsubscribe();
    } catch {
      // Firestore unsubscribe is best-effort and idempotent for this facade.
    }
  }
  entry.config.subscriptions.delete(entry.key);
  if (error) {
    for (const subscriber of [...entry.handlers]) {
      subscriber.active = false;
      try {
        subscriber.onError(error);
      } catch {
        // Preserve cleanup and notification of the remaining subscribers.
      }
    }
  }
  entry.handlers.clear();
}

function baselineFor(subscriber, entry) {
  if (!subscriber.active || entry.stopped) return;
  for (const [collectionName, records] of entry.baselines) {
    for (const record of records.values()) {
      emitDelta(entry, {
        collection: collectionName,
        entityId: record.entityId,
        record,
        changeType: 'added',
        baseline: true,
      });
    }
  }
}

function listenerRecord(entry, collectionName, documentSnapshot) {
  try {
    const record = documentSnapshot.data();
    validateRecord(record);
    if (record.generationId !== entry.generationId ||
      record.collection !== collectionName ||
      encodeDocId(recordKey(record.entityType, record.entityId)) !== documentSnapshot.id) {
      throw new TypeError('listener document identity');
    }
    return record;
  } catch (error) {
    throw remoteError(
      'V1_REMOTE_INVALID_RECORD',
      'Um documento recebido pelo listener é inválido.',
      error,
    );
  }
}

function replaceBaseline(entry, collectionName, snapshot) {
  const next = new Map();
  for (const documentSnapshot of snapshot.docs) {
    next.set(documentSnapshot.id, listenerRecord(entry, collectionName, documentSnapshot));
  }
  entry.baselines.set(collectionName, next);
  entry.initialized.add(collectionName);
  for (const record of next.values()) {
    emitDelta(entry, {
      collection: collectionName,
      entityId: record.entityId,
      record,
      changeType: 'added',
      baseline: true,
    });
  }
}

function watchCollection(entry, collectionName) {
  const collectionRef = entry.config.sdk.collection(
    entry.config.db,
    'users',
    entry.uid,
    'v1SyncNamespaces',
    entry.generationId,
    collectionName,
  );
  const unsubscribe = entry.config.sdk.onSnapshot(
    collectionRef,
    { includeMetadataChanges: true },
    snapshot => {
      if (entry.stopped) return;
      try {
        if (snapshot.metadata?.fromCache !== false ||
          snapshot.metadata?.hasPendingWrites !== false) return;
        if (!entry.initialized.has(collectionName)) {
          replaceBaseline(entry, collectionName, snapshot);
          return;
        }
        const cache = entry.baselines.get(collectionName);
        for (const change of snapshot.docChanges()) {
          const docId = change.doc.id;
          if (change.type === 'removed') {
            const previous = cache.get(docId);
            cache.delete(docId);
            emitDelta(entry, {
              collection: collectionName,
              entityId: previous?.entityId || docId,
              record: null,
              changeType: 'removed',
              baseline: false,
            });
            continue;
          }
          const record = listenerRecord(entry, collectionName, change.doc);
          const previous = cache.get(docId);
          if (previous?.opId === record.opId &&
            previous?.revision === record.revision &&
            previous?.opDigest === record.opDigest) {
            continue;
          }
          cache.set(docId, record);
          emitDelta(entry, {
            collection: collectionName,
            entityId: record.entityId,
            record,
            changeType: change.type,
            baseline: false,
          });
        }
      } catch (error) {
        stopEntry(entry, sdkFailure(error, 'V1_REMOTE_LISTENER_ERROR'));
      }
    },
    error => {
      if (!entry.stopped) {
        stopEntry(entry, sdkFailure(error, 'V1_REMOTE_LISTENER_ERROR'));
      }
    },
  );
  entry.unsubscribers.push(unsubscribe);
}

async function startEntry(entry) {
  try {
    const active = await getCurrentGeneration(entry.uid);
    if (entry.stopped) return;
    if (!active || active.generationId !== entry.generationId) {
      fail('V1_REMOTE_GENERATION_INVALID', 'A assinatura pertence a uma geração inativa.');
    }
    for (const collectionName of COLLECTIONS) {
      if (entry.stopped) return;
      watchCollection(entry, collectionName);
    }
  } catch (error) {
    stopEntry(entry, sdkFailure(error, 'V1_REMOTE_LISTENER_ERROR'));
  }
}

/** Subscribe once per UID/generation and fan one Firestore listener set out to all consumers. */
export function subscribeGeneration(uid, generationId, handlers = {}) {
  validateUid(uid);
  validateGenerationId(generationId);
  if (!isMap(handlers) || typeof handlers.onDelta !== 'function' ||
    typeof handlers.onError !== 'function') {
    fail('V1_REMOTE_INVALID_LISTENER', 'Handlers do listener remoto são inválidos.');
  }
  const config = requireConfig();
  requireAuth(config, uid);
  const key = JSON.stringify([uid, generationId]);
  let entry = config.subscriptions.get(key);
  if (!entry) {
    entry = {
      key,
      uid,
      generationId,
      config,
      handlers: new Set(),
      unsubscribers: [],
      initialized: new Set(),
      baselines: new Map(),
      stopped: false,
    };
    config.subscriptions.set(key, entry);
    void startEntry(entry);
  }
  const subscriber = { active: true, onDelta: handlers.onDelta, onError: handlers.onError };
  entry.handlers.add(subscriber);
  if (entry.initialized.size > 0) {
    Promise.resolve().then(() => baselineFor(subscriber, entry));
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    subscriber.active = false;
    entry.handlers.delete(subscriber);
    if (entry.handlers.size === 0) stopEntry(entry);
  };
}

/** Configure the module from production Firebase services or from test doubles. */
export function configureV1Remote({ db, auth, firestore, isOnline } = {}) {
  if (!db || !auth || !isMap(firestore)) {
    fail('V1_REMOTE_INVALID_CONFIGURATION', 'Configuração do Firestore V1 incompleta.');
  }
  for (const name of REQUIRED_SDK) {
    if (typeof firestore[name] !== 'function') {
      fail('V1_REMOTE_INVALID_CONFIGURATION', `SDK Firestore sem ${name}().`);
    }
  }
  if (remoteConfig) {
    for (const entry of [...remoteConfig.subscriptions.values()]) stopEntry(entry);
  }
  if (isOnline !== undefined && typeof isOnline !== 'function') {
    fail('V1_REMOTE_INVALID_CONFIGURATION', 'isOnline deve ser uma função.');
  }
  remoteConfig = { db, auth, sdk: firestore, isOnline, subscriptions: new Map() };
  return remoteApi;
}

/** Named production seam used by the worker and by emulator integration tests. */
export function wireFirestores(services = {}) {
  return configureV1Remote(services);
}

const remoteApi = Object.freeze({
  getCurrentGeneration,
  applyRemoteOperation,
  subscribeGeneration,
  fetchGenerationRecords,
});
