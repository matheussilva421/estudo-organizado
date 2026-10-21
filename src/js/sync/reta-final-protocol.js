// Pure Reta Final v2 sync protocol. No DOM, store, network or clock access.

export const RETA_FINAL_SYNC_SCHEMA = 2;

const CAPABILITIES = Object.freeze({
  schema: RETA_FINAL_SYNC_SCHEMA,
  granularMerge: true,
  guards: Object.freeze({ envelope: 'rules-v2', probe: 1 }),
});

const DERIVED_FIELDS = new Set([
  'data',
  'dataEfetiva',
  'categoriaTemporal',
  'naoAlocado',
  'concluido',
  'atrasoDias',
]);

const DESCRIPTOR_KEYS = new Set([
  'schema',
  'planId',
  'lineageId',
  'generation',
  'revision',
  'baseRevision',
  'baseRemoteUpdatedAt',
  'digest',
  'deviceId',
  'capabilities',
  'state',
  'minRetainedRevision',
  'removedBlockIds',
]);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function isRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validCapabilities(value) {
  return (
    record(value) &&
    value.schema === RETA_FINAL_SYNC_SCHEMA &&
    value.granularMerge === true &&
    record(value.guards) &&
    value.guards.envelope === 'rules-v2' &&
    value.guards.probe === 1
  );
}

function validDigest(value) {
  return typeof value === 'string' && /^[a-z0-9]{16,128}$/.test(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!record(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (DERIVED_FIELDS.has(key)) continue;
    if (value[key] === undefined) continue;
    result[key] = canonical(value[key]);
  }
  return result;
}

function fnv1a(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function emptyConflict(reason, incoming, remote, envelope, remoteEnvelope) {
  return {
    type: 'reta-final-conflict',
    cause: reason,
    planId: incoming?.planId ?? null,
    lineageId: incoming?.lineageId ?? null,
    baseRevision: incoming?.baseRevision ?? null,
    localRevision: incoming?.revision ?? null,
    remoteRevision: remote?.revision ?? null,
    localDigest: incoming?.digest ?? null,
    remoteDigest: remote?.digest ?? null,
    localPlan: envelope?.payload?.planejamento ?? null,
    remotePlan: remoteEnvelope?.payload?.planejamento ?? null,
  };
}

function denied(reason, incoming, remote, envelope, remoteEnvelope) {
  return {
    allowed: false,
    reason,
    conflict: emptyConflict(reason, incoming, remote, envelope, remoteEnvelope),
  };
}

/** The capability set a v2 client advertises in its descriptor. */
export function getRetaFinalSyncCapabilities(state) {
  void state;
  return {
    schema: CAPABILITIES.schema,
    granularMerge: CAPABILITIES.granularMerge,
    guards: { ...CAPABILITIES.guards },
  };
}

/** Returns the active Reta Final v2 plan, or null for every other planning shape. */
export function getRetaFinalPlan(state) {
  const plan = state?.planejamento;
  if (
    !record(plan) ||
    plan.ativo !== true ||
    plan.tipo !== 'reta_final' ||
    plan.schemaVersionRetaFinal !== RETA_FINAL_SYNC_SCHEMA
  ) {
    return null;
  }
  return plan;
}

/** Stable digest of human intent; derived projection fields are ignored. */
export function computeRetaFinalPlanDigest(plan) {
  const text = JSON.stringify(canonical(plan ?? null));
  return [
    fnv1a(text, 0x811c9dc5),
    fnv1a(text, 0x01000193),
    fnv1a(text, 0x9e3779b9),
    fnv1a(text, 0x85ebca6b),
  ].join('');
}

function descriptorError(message) {
  return new Error(`Descriptor Reta Final invalido: ${message}`);
}

function assertDescriptor(value) {
  if (!record(value)) throw descriptorError('objeto ausente.');
  for (const key of Object.keys(value)) {
    if (!DESCRIPTOR_KEYS.has(key)) throw descriptorError(`campo desconhecido ${key}.`);
  }
  if (value.schema !== RETA_FINAL_SYNC_SCHEMA) throw descriptorError('schema deve ser 2.');
  if (!isId(value.planId)) throw descriptorError('planId invalido.');
  if (!isId(value.lineageId)) throw descriptorError('lineageId invalido.');
  if (!Number.isSafeInteger(value.generation) || value.generation < 1) {
    throw descriptorError('generation deve ser inteiro >= 1.');
  }
  if (!isRevision(value.revision)) throw descriptorError('revision invalida.');
  if (!isRevision(value.baseRevision)) throw descriptorError('baseRevision invalida.');
  if (
    value.baseRemoteUpdatedAt !== null &&
    !(typeof value.baseRemoteUpdatedAt === 'string' && value.baseRemoteUpdatedAt.length <= 64)
  ) {
    throw descriptorError('baseRemoteUpdatedAt invalido.');
  }
  if (!validDigest(value.digest)) throw descriptorError('digest invalido.');
  if (!isId(value.deviceId)) throw descriptorError('deviceId invalido.');
  if (!validCapabilities(value.capabilities)) throw descriptorError('capabilities invalidas.');
  if (value.state !== 'active' && value.state !== 'retired') {
    throw descriptorError('state deve ser active ou retired.');
  }
  if (
    value.minRetainedRevision !== undefined &&
    !isRevision(value.minRetainedRevision)
  ) {
    throw descriptorError('minRetainedRevision invalida.');
  }
  if (value.removedBlockIds !== undefined) {
    if (!Array.isArray(value.removedBlockIds) || value.removedBlockIds.length > 200) {
      throw descriptorError('removedBlockIds invalido.');
    }
    if (value.removedBlockIds.some((id) => !isId(id))) {
      throw descriptorError('removedBlockIds contem id invalido.');
    }
  }
  return value;
}

function normalizeDescriptor(value) {
  const normalized = {
    schema: value.schema,
    planId: value.planId,
    lineageId: value.lineageId,
    generation: value.generation,
    revision: value.revision,
    baseRevision: value.baseRevision,
    baseRemoteUpdatedAt: value.baseRemoteUpdatedAt,
    digest: value.digest,
    deviceId: value.deviceId,
    state: value.state,
    capabilities: {
      schema: value.capabilities.schema,
      granularMerge: value.capabilities.granularMerge,
      guards: { ...value.capabilities.guards },
    },
  };
  if (value.minRetainedRevision !== undefined) {
    normalized.minRetainedRevision = value.minRetainedRevision;
  }
  if (value.removedBlockIds) normalized.removedBlockIds = [...new Set(value.removedBlockIds)];
  return normalized;
}

/** Build the descriptor that travels beside the v1 envelope. */
export function buildRetaFinalSyncDescriptor({
  plan,
  baseRevision = 0,
  baseRemoteUpdatedAt = null,
  deviceId,
  capabilities,
  state = 'active',
  revision = plan?.revision,
  minRetainedRevision,
  removedBlockIds,
} = {}) {
  if (!record(plan)) throw descriptorError('plano ausente.');
  if (!isId(plan.planId)) throw descriptorError('planId invalido.');
  if (!isRevision(plan.revision)) throw descriptorError('revision invalida.');
  if (!isRevision(revision)) throw descriptorError('revision invalida.');
  if (!isRevision(baseRevision)) throw descriptorError('baseRevision invalida.');
  if (baseRevision > revision) {
    throw descriptorError('baseRevision nao pode exceder a revision local.');
  }
  if (!isId(deviceId)) throw descriptorError('deviceId invalido.');
  if (!validCapabilities(capabilities)) throw descriptorError('capabilities invalidas.');
  if (state !== 'active' && state !== 'retired') throw descriptorError('state invalido.');

  const source = removedBlockIds ?? plan.retaFinal?.removedBlockIds;
  const descriptor = {
    schema: RETA_FINAL_SYNC_SCHEMA,
    planId: plan.planId,
    lineageId: plan.planId,
    generation: Number.isSafeInteger(plan.generation) && plan.generation >= 1 ? plan.generation : 1,
    revision,
    baseRevision,
    baseRemoteUpdatedAt,
    digest: computeRetaFinalPlanDigest(plan),
    deviceId,
    state,
    capabilities: {
      schema: capabilities.schema,
      granularMerge: capabilities.granularMerge,
      guards: { ...capabilities.guards },
    },
  };
  const retention =
    minRetainedRevision ?? plan.minRetainedRevision ?? plan.retaFinal?.minRetainedRevision;
  if (retention !== undefined) {
    if (!isRevision(retention)) throw descriptorError('minRetainedRevision invalida.');
    descriptor.minRetainedRevision = retention;
  }
  if (Array.isArray(source)) {
    const removed = [...new Set(source.filter((id) => isId(id)))].slice(0, 200);
    if (removed.length) descriptor.removedBlockIds = removed;
  }
  return assertDescriptor(descriptor);
}

/** Read a descriptor; null means absent or invalid and callers must fail closed. */
export function readRetaFinalSyncDescriptor(envelope) {
  const raw = envelope?.retaFinalSync;
  if (!record(raw)) return null;
  try {
    return normalizeDescriptor(assertDescriptor(raw));
  } catch {
    return null;
  }
}

/** Client-side guard before touching a remote plan. The real barrier is in rules. */
export function validateRetaFinalRemoteWrite({
  clientCapabilities,
  remotePlan,
  localPlan,
  baseRevision,
} = {}) {
  if (!validCapabilities(clientCapabilities)) return { allowed: false, reason: 'capability' };
  if (!isRevision(baseRevision)) return { allowed: false, reason: 'invalid-base' };
  if (!record(remotePlan)) {
    return baseRevision === 0
      ? { allowed: true, reason: 'create' }
      : { allowed: false, reason: 'missing-remote' };
  }
  if (!record(localPlan)) return { allowed: false, reason: 'missing-local' };
  if (remotePlan.planId !== localPlan.planId) return { allowed: false, reason: 'lineage' };
  if (!isRevision(remotePlan.revision) || !isRevision(localPlan.revision)) {
    return { allowed: false, reason: 'invalid-revision' };
  }
  if (localPlan.revision < baseRevision) return { allowed: false, reason: 'rollback' };
  if (baseRevision > remotePlan.revision) return { allowed: false, reason: 'rollback' };
  if (baseRevision < remotePlan.revision) return { allowed: false, reason: 'stale-base' };
  return { allowed: true, reason: 'base-current' };
}

/** Mirror of the Firestore rule that protects a document that already has a v2 descriptor. */
export function validateRetaFinalEnvelopeWrite({ envelope, remoteEnvelope } = {}) {
  const incomingPresent = record(envelope) && Object.hasOwn(envelope, 'retaFinalSync');
  const remotePresent = record(remoteEnvelope) && Object.hasOwn(remoteEnvelope, 'retaFinalSync');
  const incoming = incomingPresent ? readRetaFinalSyncDescriptor(envelope) : null;
  const remote = remotePresent ? readRetaFinalSyncDescriptor(remoteEnvelope) : null;

  if (!incomingPresent) {
    if (remotePresent) return denied('legacy-write', null, remote, envelope, remoteEnvelope);
    return { allowed: true, reason: 'legacy', conflict: null };
  }
  if (!incoming) return denied('invalid-descriptor', null, remote, envelope, remoteEnvelope);
  if (remotePresent && !remote) {
    return denied('invalid-remote-descriptor', incoming, null, envelope, remoteEnvelope);
  }

  if (!record(remoteEnvelope)) {
    if (incoming.baseRevision !== 0 || incoming.state !== 'active') {
      return denied('create-base', incoming, null, envelope, remoteEnvelope);
    }
    return { allowed: true, reason: 'create', conflict: null };
  }

  if (!remote) {
    const adoptionTimestampMatches =
      incoming.baseRevision === 0 &&
      incoming.state === 'active' &&
      incoming.baseRemoteUpdatedAt === remoteEnvelope.payloadUpdatedAt;
    if (!adoptionTimestampMatches) {
      return denied('adoption-base', incoming, null, envelope, remoteEnvelope);
    }
    return { allowed: true, reason: 'adopt', conflict: null };
  }

  if (
    incoming.planId !== remote.planId ||
    incoming.lineageId !== remote.lineageId ||
    incoming.generation !== remote.generation
  ) {
    return denied('lineage', incoming, remote, envelope, remoteEnvelope);
  }

  if (remote.state === 'retired' && incoming.state !== 'retired') {
    return denied('retired-lineage', incoming, remote, envelope, remoteEnvelope);
  }

  if (incoming.revision === remote.revision) {
    if (
      incoming.digest === remote.digest &&
      incoming.state === remote.state &&
      envelope?.payloadUpdatedAt === remoteEnvelope?.payloadUpdatedAt &&
      JSON.stringify(canonical(envelope?.payload)) ===
        JSON.stringify(canonical(remoteEnvelope?.payload))
    ) {
      return { allowed: true, reason: 'replay', conflict: null };
    }
    return denied('replay-payload-mismatch', incoming, remote, envelope, remoteEnvelope);
  }
  if (incoming.revision < remote.revision) {
    return denied('rollback', incoming, remote, envelope, remoteEnvelope);
  }
  if (incoming.baseRevision !== remote.revision) {
    return denied('stale-base', incoming, remote, envelope, remoteEnvelope);
  }
  if (incoming.revision !== remote.revision + 1) {
    return denied('revision-jump', incoming, remote, envelope, remoteEnvelope);
  }
  return { allowed: true, reason: 'advance', conflict: null };
}

function errorCode(error) {
  const raw = error?.code ?? error?.status ?? error?.statusCode ?? error?.message ?? '';
  return String(raw).toLowerCase();
}

/** Normalize remote failures so the engine never turns a barrier error into success. */
export function classifyRetaFinalRemoteError(error) {
  const raw = errorCode(error);
  if (raw.includes('permission-denied') || raw.includes('permission_denied') || raw.includes('403')) {
    return { type: 'permission-denied', retryable: false, code: 'permission-denied' };
  }
  if (
    raw.includes('failed-precondition') ||
    raw.includes('aborted') ||
    raw.includes('409') ||
    raw.includes('already-exists') ||
    raw.includes('conflict')
  ) {
    return { type: 'conflict', retryable: true, code: raw || 'conflict' };
  }
  if (
    raw.includes('unavailable') ||
    raw.includes('offline') ||
    raw.includes('network-request-failed') ||
    raw.includes('failed to fetch') ||
    raw.includes('network') ||
    raw.includes('deadline-exceeded')
  ) {
    return { type: 'offline', retryable: true, code: raw || 'unavailable' };
  }
  if (raw.includes('resource-exhausted') || raw.includes('quota')) {
    return { type: 'transient', retryable: true, code: raw || 'resource-exhausted' };
  }
  return { type: 'unknown', retryable: false, code: raw || 'unknown' };
}

/** True when the stored base must be re-read before another v2 publish. */
export function shouldRefreshRetaFinalBase({
  baseRevision,
  remoteRevision,
  minRetainedRevision,
} = {}) {
  if (!isRevision(baseRevision) || !isRevision(remoteRevision)) return true;
  const minimum = isRevision(minRetainedRevision) ? minRetainedRevision : 0;
  return baseRevision !== remoteRevision || baseRevision < minimum;
}
