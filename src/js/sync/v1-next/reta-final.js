import { encodeDocId, encodeRecordData, recordKey, validateRecord } from './contracts.js';
import { getActiveV1Context } from './local.js';
import { applyRemoteOperation, runV1RemoteTransaction } from './remote.js';
import { sha256Utf8 } from './sha256.js';

const CONTRACT = 'estudo.reta-final.revision.v1';
const POINTER_ID = 'retaFinalRevision';
const BATCH_PREFIX = 'retaFinalRevision:batch:';
const BATCH_SIZE = 48;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function fail(code, message, extra = {}) {
  throw Object.assign(new Error(message), { code, ...extra });
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function digest(value) {
  return sha256Utf8(canonical(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateOperation(operation) {
  if (!isObject(operation)) fail('RETA_FINAL_INVALID', 'Revisão da Reta Final inválida.');
  const { planId, baseRevision, blocks, metadata, opId } = operation;
  if (typeof planId !== 'string' || !planId.trim() || planId.length > 200 ||
    !Number.isSafeInteger(baseRevision) || baseRevision < 0 ||
    !Array.isArray(blocks) || !isObject(metadata) ||
    typeof opId !== 'string' || !TOKEN.test(opId)) {
    fail('RETA_FINAL_INVALID', 'Identidade, revisão, blocos, metadados ou opId inválidos.');
  }
  const blockIds = new Set();
  const orders = new Set();
  for (const block of blocks) {
    if (!isObject(block) || typeof block.id !== 'string' || !block.id.trim() ||
      blockIds.has(block.id) || !Number.isSafeInteger(block.ordem) || block.ordem < 0 ||
      orders.has(block.ordem)) {
      fail('RETA_FINAL_INVALID', 'Blocos exigem IDs e ordens únicos e não negativos.');
    }
    if (block.topicos !== undefined && !Array.isArray(block.topicos)) {
      fail('RETA_FINAL_INVALID', 'Tópicos do bloco devem ser uma lista.');
    }
    blockIds.add(block.id);
    orders.add(block.ordem);
  }
  const excluded = excludedBlockIds(metadata);
  for (const id of excluded) {
    if (blockIds.has(id)) {
      fail('RETA_FINAL_INVALID', 'Bloco excluído não pode reaparecer na revisão atual.', { blockId: id });
    }
  }
  return { excluded, blockIds };
}

function excludedBlockIds(metadata) {
  const excluded = new Set();
  for (const field of ['tombstones', 'exclusoes', 'excludedBlockIds']) {
    const values = metadata?.[field];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const id = typeof value === 'string' ? value :
        value?.blockId ?? value?.blocoId ?? value?.id ?? null;
      if (typeof id === 'string' && id.trim()) excluded.add(id);
    }
  }
  return excluded;
}

function metaItem(id, data) {
  return { key: recordKey('meta', id), entityType: 'meta', entityId: id, path: [id], data: clone(data) };
}

function batchData(operation, batchIndex, batchCount, blocks, metadata, batchKind) {
  const unsigned = {
    contract: CONTRACT,
    kind: 'revision-batch',
    schemaVersion: 1,
    planId: operation.planId,
    revision: operation.baseRevision + 1,
    baseRevision: operation.baseRevision,
    opId: operation.opId,
    batchIndex,
    batchCount,
    batchKind,
    blocks: clone(blocks),
    metadata: batchKind === 'metadata' ? clone(metadata) : null,
  };
  const batchDigest = digest(unsigned);
  return {
    ...unsigned,
    digest: batchDigest,
    receipt: {
      contract: CONTRACT,
      batchIndex,
      digest: batchDigest,
      recordKey: recordKey('meta', `${BATCH_PREFIX}${batchDigest.slice(0, 32)}`),
    },
  };
}

/** Build deterministic, content-addressed staging batches without performing I/O. */
export function preparePlanRevision(operation) {
  validateOperation(operation);
  const revision = operation.baseRevision + 1;
  const blockBatches = [];
  for (let offset = 0; offset < operation.blocks.length; offset += BATCH_SIZE) {
    blockBatches.push(operation.blocks.slice(offset, offset + BATCH_SIZE));
  }
  const batchCount = blockBatches.length + 1;
  const descriptors = [];
  const batches = [];
  const append = (blocks, batchKind) => {
    const index = batches.length;
    const candidate = batchData(operation, index, batchCount, blocks,
      operation.metadata, batchKind);
    const entityId = `${BATCH_PREFIX}${candidate.digest.slice(0, 32)}`;
    if (descriptors.some(entry => entry.entityId === entityId)) {
      fail('RETA_FINAL_INVALID', 'Lote de revisão colidiu com outro lote.');
    }
    const descriptor = {
      entityId,
      digest: candidate.digest,
      kind: batchKind,
      count: blocks.length,
      firstOrder: blocks[0]?.ordem ?? null,
    };
    descriptors.push(descriptor);
    batches.push(metaItem(entityId, candidate));
  };
  for (const blocks of blockBatches) append(blocks, 'blocks');
  append([], 'metadata');
  const blockDigest = digest(operation.blocks);
  const metadataDigest = digest(operation.metadata);
  const pointerFields = {
    contract: CONTRACT,
    kind: 'pointer',
    schemaVersion: 1,
    planId: operation.planId,
    revision,
    baseRevision: operation.baseRevision,
    opId: operation.opId,
    blockCount: operation.blocks.length,
    blockDigest,
    metadataDigest,
    batchCount,
    batches: descriptors,
    excludedBlockIds: [...excludedBlockIds(operation.metadata)].sort(),
  };
  const manifest = { ...pointerFields, digest: digest(pointerFields) };
  return { manifest, batches };
}

function storedItem(record) {
  if (isObject(record) && typeof record.data === 'string') {
    try { return { ...record, data: JSON.parse(record.data) }; } catch { return null; }
  }
  return isObject(record) ? clone(record) : null;
}

function batchForRecord(record) {
  const item = storedItem(record);
  if (!item) return null;
  if (item.contract === CONTRACT && item.kind === 'revision-batch') return { item, entityId: null };
  if (isObject(item.data) && item.data.contract === CONTRACT &&
    item.data.kind === 'revision-batch' && item.entityType === 'meta') {
    return { item: item.data, entityId: item.entityId };
  }
  if (item.contract === CONTRACT && item.kind === 'pointer') {
    return { pointer: item };
  }
  if (isObject(item.data) && item.data.contract === CONTRACT && item.data.kind === 'pointer') {
    return { pointer: item.data };
  }
  return null;
}

function validateBatch(candidate, descriptor, planId, revision) {
  const data = candidate.item;
  if (data.planId !== planId || data.revision !== revision ||
    data.batchIndex < 0 || !Number.isSafeInteger(data.batchIndex) ||
    !Number.isSafeInteger(data.batchCount) ||
    data.batchIndex !== descriptor.index || data.batchKind !== descriptor.kind ||
    data.batchCount !== descriptor.batchCount || data.blocks.length !== descriptor.count ||
    data.digest !== descriptor.digest ||
    data.blocks[0]?.ordem !== undefined && data.blocks[0].ordem !== descriptor.firstOrder ||
    !isObject(data.receipt) || data.receipt.contract !== CONTRACT ||
    data.receipt.batchIndex !== descriptor.index ||
    data.receipt.digest !== data.digest ||
    data.receipt.recordKey !== recordKey('meta', descriptor.entityId) ||
    candidate.entityId && candidate.entityId !== descriptor.entityId) {
    fail('RETA_FINAL_REVISION_INVALID', 'Lote de revisão não corresponde ao ponteiro.');
  }
  const { digest: _digest, receipt: _receipt, ...unsigned } = data;
  if (digest(unsigned) !== data.digest) {
    fail('RETA_FINAL_REVISION_INVALID', 'Digest interno do lote não confere.');
  }
  return data;
}

/** Resolve only a complete, validated plan revision referenced by the pointer. */
export function resolveVisiblePlanRevision(manifestInput, records) {
  const manifestRecord = storedItem(manifestInput);
  const parsed = batchForRecord(manifestRecord);
  const manifest = parsed?.pointer || (isObject(manifestRecord) &&
    manifestRecord.contract === CONTRACT && manifestRecord.kind === 'pointer' ?
    clone(manifestRecord) : null);
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.batches) ||
    manifest.batches.length !== manifest.batchCount ||
    !Number.isSafeInteger(manifest.revision) || !Number.isSafeInteger(manifest.baseRevision) ||
    manifest.revision !== manifest.baseRevision + 1) {
    fail('RETA_FINAL_REVISION_INCOMPLETE', 'Ponteiro da revisão está ausente ou incompleto.');
  }
  const { digest: manifestDigest, ...unsignedManifest } = manifest;
  if (digest(unsignedManifest) !== manifestDigest) {
    fail('RETA_FINAL_REVISION_INVALID', 'Digest do ponteiro não confere.');
  }
  const available = new Map();
  const recordList = Array.isArray(records) ? records :
    isObject(records) ? Object.values(records).flat() : [];
  for (const record of recordList) {
    const candidate = batchForRecord(record);
    if (!candidate || !candidate.item) continue;
    const itemRecord = storedItem(record);
    const entityId = candidate.entityId || itemRecord?.entityId || null;
    if (!entityId) continue;
    if (available.has(entityId)) {
      fail('RETA_FINAL_REVISION_INVALID', 'Lote de revisão duplicado.');
    }
    available.set(entityId, candidate);
  }
  const blocks = [];
  let metadata = null;
  let metadataBatches = 0;
  for (let index = 0; index < manifest.batches.length; index += 1) {
    const descriptor = { ...manifest.batches[index], index, batchCount: manifest.batchCount };
    const candidate = available.get(descriptor.entityId);
    if (!candidate) {
      fail('RETA_FINAL_REVISION_INCOMPLETE', 'Revisão ainda não possui todos os lotes.', {
        revision: manifest.revision, batchIndex: index,
      });
    }
    const data = validateBatch(candidate, descriptor, manifest.planId, manifest.revision);
    if (data.batchKind === 'blocks') blocks.push(...clone(data.blocks));
    else if (data.batchKind === 'metadata') {
      metadataBatches += 1;
      metadata = clone(data.metadata);
    }
    else fail('RETA_FINAL_REVISION_INVALID', 'Tipo de lote desconhecido.');
  }
  if (metadataBatches !== 1 || !isObject(metadata) ||
    digest(metadata) !== manifest.metadataDigest ||
    digest(blocks) !== manifest.blockDigest || blocks.length !== manifest.blockCount) {
    fail('RETA_FINAL_REVISION_INVALID', 'Conteúdo da revisão não corresponde ao ponteiro.');
  }
  const normalized = { planId: manifest.planId, baseRevision: manifest.baseRevision,
    revision: manifest.revision, opId: manifest.opId, blocks, metadata };
  validateOperation(normalized);
  if (canonical([...excludedBlockIds(metadata)].sort()) !==
    canonical(manifest.excludedBlockIds)) {
    fail('RETA_FINAL_REVISION_INVALID', 'Exclusões do ponteiro não correspondem aos metadados.');
  }
  return { ...clone(manifest), ...normalized };
}

/** Apply a resolved logical plan revision to the application state. */
export function applyPlanRevisionToState(state, revision) {
  if (!isObject(state) || !isObject(revision) || !isObject(revision.metadata) ||
    !isObject(revision.metadata.plan) || !isObject(revision.metadata.plan.retaFinal) ||
    !Array.isArray(revision.blocks)) {
    fail('RETA_FINAL_REVISION_INVALID', 'Revisão aplicável ausente.');
  }
  const next = clone(state);
  const plan = clone(revision.metadata.plan);
  plan.retaFinal.blocos = clone(revision.blocks);
  next.planejamento = plan;
  if (revision.metadata.planejamentoArquivado !== undefined) {
    next.planejamentoArquivado = clone(revision.metadata.planejamentoArquivado);
  }
  return next;
}

function operationScope(operation) {
  const active = getActiveV1Context();
  const uid = operation.uid ?? active?.uid;
  const generationId = operation.generationId ?? active?.generationId;
  if (typeof uid !== 'string' || !TOKEN.test(uid) ||
    typeof generationId !== 'string' || !TOKEN.test(generationId)) {
    fail('RETA_FINAL_SCOPE_REQUIRED', 'UID e geração ativos são necessários para publicar.');
  }
  return { uid, generationId };
}

function stagingOperation(item, scope) {
  const dataText = encodeRecordData(item);
  return {
    opId: `rf_batch_${item.data.digest.slice(0, 32)}`,
    uid: scope.uid,
    generationId: scope.generationId,
    entityKey: item.key,
    entityType: item.entityType,
    entityId: item.entityId,
    collection: 'meta',
    path: clone(item.path),
    baseRecord: null,
    baseRevision: 0,
    revision: 1,
    action: 'upsert',
    data: clone(item.data),
    dataText,
    opDigest: sha256Utf8(dataText),
    status: 'pending',
  };
}

/** Stage every batch, then atomically make one validated pointer visible. */
export async function publishPlanRevision(operation) {
  const prepared = preparePlanRevision(operation);
  const scope = operationScope(operation);
  for (const item of prepared.batches) {
    await applyRemoteOperation(stagingOperation(item, scope));
  }
  const pointerItem = metaItem(POINTER_ID, prepared.manifest);
  const pointerDataText = encodeRecordData(pointerItem);
  const result = await runV1RemoteTransaction(scope, async ({ transaction, sdk, db }) => {
    const pointerRef = sdk.doc(db, 'users', scope.uid, 'v1SyncNamespaces',
      scope.generationId, 'meta', encodeDocId(pointerItem.key));
    const receiptRef = sdk.doc(db, 'users', scope.uid, 'v1SyncNamespaces',
      scope.generationId, 'operations', operation.opId);
    const [receiptSnapshot, pointerSnapshot] = await Promise.all([
      transaction.get(receiptRef), transaction.get(pointerRef),
    ]);
    const replay = receiptSnapshot.exists();
    if (replay) {
      const receipt = receiptSnapshot.data();
      if (receipt.opId !== operation.opId ||
        receipt.opDigest !== sha256Utf8(pointerDataText) ||
        receipt.entityType !== 'meta' || receipt.entityId !== POINTER_ID) {
        fail('RETA_FINAL_OP_CONFLICT', 'opId já foi usado por outra publicação.');
      }
    }
    const pointerRecord = pointerSnapshot.exists() ? pointerSnapshot.data() : null;
    let pointerBase = 0;
    if (pointerRecord) {
      validateRecord(pointerRecord);
      const pointerItem = storedItem(pointerRecord);
      const current = pointerItem?.data?.data;
      if (!current || current.contract !== CONTRACT || current.kind !== 'pointer') {
        fail('RETA_FINAL_REVISION_INVALID', 'Ponteiro remoto existente é inválido.');
      }
      if (!replay && current.revision !== operation.baseRevision) {
        fail('RETA_FINAL_STALE', 'A revisão-base não é a revisão visível.', {
          remoteRevision: current.revision,
        });
      }
      pointerBase = pointerRecord.revision;
    }

    const staged = [];
    for (const descriptor of prepared.manifest.batches) {
      const ref = sdk.doc(db, 'users', scope.uid, 'v1SyncNamespaces', scope.generationId,
        'meta', encodeDocId(recordKey('meta', descriptor.entityId)));
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        fail('RETA_FINAL_REVISION_INCOMPLETE', 'Lote preparado desapareceu antes da publicação.');
      }
      const record = snapshot.data();
      validateRecord(record);
      staged.push(JSON.parse(record.data));
    }
    const resolved = resolveVisiblePlanRevision(prepared.manifest, staged);
    if (replay) return { status: 'replay', plan: resolved };
    const pointerRecordNext = {
      schemaVersion: 1,
      generationId: scope.generationId,
      collection: 'meta',
      entityType: 'meta',
      entityId: POINTER_ID,
      baseRevision: pointerBase,
      revision: pointerBase + 1,
      opId: operation.opId,
      opDigest: sha256Utf8(pointerDataText),
      deleted: false,
      data: pointerDataText,
      updatedAt: sdk.serverTimestamp(),
    };
    const { data: _data, ...receipt } = pointerRecordNext;
    transaction.set(pointerRef, pointerRecordNext);
    transaction.set(receiptRef, receipt);
    return { status: 'published', plan: resolved };
  });
  const plan = clone(result.plan);
  return { status: result.status, ...plan, plan };
}
