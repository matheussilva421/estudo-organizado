// Pure Reta Final v2 sync protocol. No DOM, store, network or clock access.

export const RETA_FINAL_SYNC_SCHEMA = 2;

const CAPABILITIES = Object.freeze({
  schema: RETA_FINAL_SYNC_SCHEMA,
  granularMerge: true,
  guards: Object.freeze({ envelope: "rules-v2", probe: 1 }),
});

const DERIVED_FIELDS = new Set([
  "data",
  "dataEfetiva",
  "categoriaTemporal",
  "naoAlocado",
  "concluido",
  "atrasoDias",
]);

// Fields the scheduling projection rewrites in place (syncRetaFinalToEventos,
// rollover) without bumping `revision`. They describe how this device renders
// the plan, never what the user asked for, so intent comparisons ignore them.
const PROJECTION_BLOCK_FIELDS = new Set([
  ...DERIVED_FIELDS,
  "status",
  "rolagens",
  "rolado",
  "motivoNaoAlocado",
]);

// Plan-level bookkeeping rebuilt per device, per migration or by the sync
// journal. Two devices with the same intent may carry different values.
const PLAN_METADATA_FIELDS = new Set([
  "updatedAt",
  "operations",
  "pendingOperations",
  "operationIds",
]);

const PLAN_RETA_FINAL_METADATA_FIELDS = new Set([
  "removedBlockIds",
  "minRetainedRevision",
]);

const INTENT_DIFFERENCE_LIMIT = 40;

const DESCRIPTOR_KEYS = new Set([
  "schema",
  "planId",
  "lineageId",
  "generation",
  "revision",
  "baseRevision",
  "snapshotRevision",
  "baseSnapshotRevision",
  "baseRemoteUpdatedAt",
  "digest",
  "deviceId",
  "capabilities",
  "state",
  "minRetainedRevision",
  "removedBlockIds",
]);

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value) {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 128
  );
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
    value.guards.envelope === "rules-v2" &&
    value.guards.probe === 1
  );
}

function validDigest(value) {
  return typeof value === "string" && /^[a-z0-9]{16,128}$/.test(value);
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

function stableIntent(value) {
  if (Array.isArray(value)) return value.map(stableIntent);
  if (!record(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    result[key] = stableIntent(value[key]);
  }
  return result;
}

// Stable key order without removing any field: the rules compare the whole
// payload map, so the client mirror must not ignore nested projection fields.
function stablePayload(value) {
  if (Array.isArray(value)) return value.map(stablePayload);
  if (!record(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    result[key] = stablePayload(value[key]);
  }
  return result;
}

function samePayload(left, right) {
  return JSON.stringify(stablePayload(left)) === JSON.stringify(stablePayload(right));
}

/**
 * Strip everything that is projection or per-device bookkeeping from a plan.
 * Blocks are matched by identity and sorted by id, so array order (which the
 * rollover rewrites) never changes the intent.
 */
export function retaFinalPlanIntent(plan) {
  if (!record(plan)) return null;
  const copy = JSON.parse(JSON.stringify(plan));
  for (const key of PLAN_METADATA_FIELDS) delete copy[key];
  if (record(copy.retaFinal)) {
    for (const key of PLAN_RETA_FINAL_METADATA_FIELDS)
      delete copy.retaFinal[key];
    if (!Array.isArray(copy.retaFinal.blocos)) copy.retaFinal.blocos = [];
    copy.retaFinal.blocos = copy.retaFinal.blocos
      .map((block) => {
        if (!record(block)) return block;
        const clean = {};
        for (const key of Object.keys(block)) {
          if (PROJECTION_BLOCK_FIELDS.has(key)) continue;
          if (block[key] === undefined) continue;
          clean[key] = block[key];
        }
        return clean;
      })
      .sort((left, right) =>
        String(left?.id ?? "").localeCompare(String(right?.id ?? "")),
      );
  }
  return copy;
}

/** Deterministic digest of the human intent only; instrumentation, not wire. */
export function computeRetaFinalIntentDigest(plan) {
  const text = JSON.stringify(stableIntent(retaFinalPlanIntent(plan)));
  return [
    fnv1a(text, 0x811c9dc5),
    fnv1a(text, 0x01000193),
    fnv1a(text, 0x9e3779b9),
    fnv1a(text, 0x85ebca6b),
  ].join("");
}

function intentBlocks(plan) {
  const map = new Map();
  const list = Array.isArray(plan?.retaFinal?.blocos)
    ? plan.retaFinal.blocos
    : [];
  for (const block of list) {
    if (record(block) && isId(block.id)) map.set(block.id, block);
  }
  return map;
}

/**
 * Compare two Reta Final plans by human intent.
 *
 * Equivalent means: same lineage/activation, same block identities and the
 * same non-projection fields. Projection drift (`data`, `status`, `rolagens`),
 * per-device metadata (`updatedAt`, journal) and array order are ignored.
 * Anything else is reported as a stable path so a real divergence can be
 * reviewed without guessing.
 */
export function compareRetaFinalPlanIntent(left, right) {
  if (!record(left) || !record(right)) {
    return {
      equivalent: false,
      differences: ["plano ausente"],
      blockCount: 0,
      changedBlockIds: [],
    };
  }
  const leftIntent = retaFinalPlanIntent(left);
  const rightIntent = retaFinalPlanIntent(right);
  const differences = [];
  const push = (path) => {
    if (differences.length < INTENT_DIFFERENCE_LIMIT) differences.push(path);
  };
  const keys = new Set([...Object.keys(leftIntent), ...Object.keys(rightIntent)]);
  for (const key of [...keys].sort()) {
    if (key === "retaFinal") continue;
    if (
      JSON.stringify(stableIntent(leftIntent[key])) !==
      JSON.stringify(stableIntent(rightIntent[key]))
    ) {
      push(key);
    }
  }
  const leftPlan = record(leftIntent.retaFinal) ? leftIntent.retaFinal : {};
  const rightPlan = record(rightIntent.retaFinal) ? rightIntent.retaFinal : {};
  const planKeys = new Set([...Object.keys(leftPlan), ...Object.keys(rightPlan)]);
  for (const key of [...planKeys].sort()) {
    if (key === "blocos") continue;
    if (
      JSON.stringify(stableIntent(leftPlan[key])) !==
      JSON.stringify(stableIntent(rightPlan[key]))
    ) {
      push(`retaFinal.${key}`);
    }
  }
  const leftBlocks = intentBlocks(leftIntent);
  const rightBlocks = intentBlocks(rightIntent);
  const changedBlockIds = [];
  for (const id of [
    ...new Set([...leftBlocks.keys(), ...rightBlocks.keys()]),
  ].sort()) {
    const leftBlock = leftBlocks.get(id);
    const rightBlock = rightBlocks.get(id);
    if (!leftBlock || !rightBlock) {
      changedBlockIds.push(id);
      push(`retaFinal.blocos.${id}`);
      continue;
    }
    const fieldKeys = new Set([
      ...Object.keys(leftBlock),
      ...Object.keys(rightBlock),
    ]);
    for (const field of [...fieldKeys].sort()) {
      if (field === "id") continue;
      if (
        JSON.stringify(stableIntent(leftBlock[field])) !==
        JSON.stringify(stableIntent(rightBlock[field]))
      ) {
        if (!changedBlockIds.includes(id)) changedBlockIds.push(id);
        push(`retaFinal.blocos.${id}.${field}`);
      }
    }
  }
  return {
    equivalent: differences.length === 0,
    differences,
    blockCount: leftBlocks.size,
    changedBlockIds,
  };
}

function fnv1a(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function emptyConflict(reason, incoming, remote, envelope, remoteEnvelope) {
  return {
    type: "reta-final-conflict",
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
    plan.tipo !== "reta_final" ||
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
  ].join("");
}

function descriptorError(message) {
  return new Error(`Descriptor Reta Final invalido: ${message}`);
}

function assertDescriptor(value) {
  if (!record(value)) throw descriptorError("objeto ausente.");
  for (const key of Object.keys(value)) {
    if (!DESCRIPTOR_KEYS.has(key))
      throw descriptorError(`campo desconhecido ${key}.`);
  }
  if (value.schema !== RETA_FINAL_SYNC_SCHEMA)
    throw descriptorError("schema deve ser 2.");
  if (!isId(value.planId)) throw descriptorError("planId invalido.");
  if (!isId(value.lineageId)) throw descriptorError("lineageId invalido.");
  if (!Number.isSafeInteger(value.generation) || value.generation < 1) {
    throw descriptorError("generation deve ser inteiro >= 1.");
  }
  if (!isRevision(value.revision)) throw descriptorError("revision invalida.");
  if (!isRevision(value.baseRevision))
    throw descriptorError("baseRevision invalida.");
  if (
    !Number.isSafeInteger(value.snapshotRevision) ||
    value.snapshotRevision < 1
  ) {
    throw descriptorError("snapshotRevision invalida.");
  }
  if (!isRevision(value.baseSnapshotRevision)) {
    throw descriptorError("baseSnapshotRevision invalida.");
  }
  if (value.baseSnapshotRevision > value.snapshotRevision) {
    throw descriptorError(
      "baseSnapshotRevision nao pode exceder snapshotRevision.",
    );
  }
  if (
    value.baseRemoteUpdatedAt !== null &&
    !(
      typeof value.baseRemoteUpdatedAt === "string" &&
      value.baseRemoteUpdatedAt.length <= 64
    )
  ) {
    throw descriptorError("baseRemoteUpdatedAt invalido.");
  }
  if (!validDigest(value.digest)) throw descriptorError("digest invalido.");
  if (!isId(value.deviceId)) throw descriptorError("deviceId invalido.");
  if (!validCapabilities(value.capabilities))
    throw descriptorError("capabilities invalidas.");
  if (value.state !== "active" && value.state !== "retired") {
    throw descriptorError("state deve ser active ou retired.");
  }
  if (
    value.minRetainedRevision !== undefined &&
    !isRevision(value.minRetainedRevision)
  ) {
    throw descriptorError("minRetainedRevision invalida.");
  }
  if (value.removedBlockIds !== undefined) {
    if (
      !Array.isArray(value.removedBlockIds) ||
      value.removedBlockIds.length > 200
    ) {
      throw descriptorError("removedBlockIds invalido.");
    }
    if (value.removedBlockIds.some((id) => !isId(id))) {
      throw descriptorError("removedBlockIds contem id invalido.");
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
    snapshotRevision: value.snapshotRevision,
    baseSnapshotRevision: value.baseSnapshotRevision,
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
  if (value.removedBlockIds)
    normalized.removedBlockIds = [...new Set(value.removedBlockIds)];
  return normalized;
}

/** Build the descriptor that travels beside the v1 envelope. */
export function buildRetaFinalSyncDescriptor({
  plan,
  baseRevision = 0,
  baseRemoteUpdatedAt = null,
  deviceId,
  capabilities,
  state = "active",
  revision = plan?.revision,
  snapshotRevision = baseRevision > 0 ? 2 : 1,
  baseSnapshotRevision = Math.max(0, snapshotRevision - 1),
  minRetainedRevision,
  removedBlockIds,
  wireDigest = null,
} = {}) {
  if (!record(plan)) throw descriptorError("plano ausente.");
  if (!isId(plan.planId)) throw descriptorError("planId invalido.");
  if (!isRevision(plan.revision)) throw descriptorError("revision invalida.");
  if (!isRevision(revision)) throw descriptorError("revision invalida.");
  if (!isRevision(baseRevision))
    throw descriptorError("baseRevision invalida.");
  if (!Number.isSafeInteger(snapshotRevision) || snapshotRevision < 1) {
    throw descriptorError("snapshotRevision invalida.");
  }
  if (!isRevision(baseSnapshotRevision)) {
    throw descriptorError("baseSnapshotRevision invalida.");
  }
  if (baseSnapshotRevision > snapshotRevision) {
    throw descriptorError(
      "baseSnapshotRevision nao pode exceder snapshotRevision.",
    );
  }
  if (baseRevision > revision) {
    throw descriptorError("baseRevision nao pode exceder a revision local.");
  }
  if (!isId(deviceId)) throw descriptorError("deviceId invalido.");
  if (!validCapabilities(capabilities))
    throw descriptorError("capabilities invalidas.");
  if (state !== "active" && state !== "retired")
    throw descriptorError("state invalido.");

  const source = removedBlockIds ?? plan.retaFinal?.removedBlockIds;
  const descriptor = {
    schema: RETA_FINAL_SYNC_SCHEMA,
    planId: plan.planId,
    lineageId: plan.planId,
    generation:
      Number.isSafeInteger(plan.generation) && plan.generation >= 1
        ? plan.generation
        : 1,
    revision,
    baseRevision,
    snapshotRevision,
    baseSnapshotRevision,
    baseRemoteUpdatedAt,
    // A descriptor that describes an unchanged plan carries the digest the
    // remote already published: the rules compare it verbatim, while the plan
    // content is compared by intent (projection drift is not a new revision).
    digest: validDigest(wireDigest)
      ? wireDigest
      : computeRetaFinalPlanDigest(plan),
    deviceId,
    state,
    capabilities: {
      schema: capabilities.schema,
      granularMerge: capabilities.granularMerge,
      guards: { ...capabilities.guards },
    },
  };
  const retention =
    minRetainedRevision ??
    plan.minRetainedRevision ??
    plan.retaFinal?.minRetainedRevision;
  if (retention !== undefined) {
    if (!isRevision(retention))
      throw descriptorError("minRetainedRevision invalida.");
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
  if (!validCapabilities(clientCapabilities))
    return { allowed: false, reason: "capability" };
  if (!isRevision(baseRevision))
    return { allowed: false, reason: "invalid-base" };
  if (!record(remotePlan)) {
    return baseRevision === 0
      ? { allowed: true, reason: "create" }
      : { allowed: false, reason: "missing-remote" };
  }
  if (!record(localPlan)) return { allowed: false, reason: "missing-local" };
  if (remotePlan.planId !== localPlan.planId)
    return { allowed: false, reason: "lineage" };
  if (!isRevision(remotePlan.revision) || !isRevision(localPlan.revision)) {
    return { allowed: false, reason: "invalid-revision" };
  }
  if (localPlan.revision < baseRevision)
    return { allowed: false, reason: "rollback" };
  if (baseRevision > remotePlan.revision)
    return { allowed: false, reason: "rollback" };
  if (baseRevision < remotePlan.revision)
    return { allowed: false, reason: "stale-base" };
  return { allowed: true, reason: "base-current" };
}

/** Mirror of the Firestore rule that protects a document that already has a v2 descriptor. */
export function validateRetaFinalEnvelopeWrite({
  envelope,
  remoteEnvelope,
} = {}) {
  const incomingPresent =
    record(envelope) && Object.hasOwn(envelope, "retaFinalSync");
  const remotePresent =
    record(remoteEnvelope) && Object.hasOwn(remoteEnvelope, "retaFinalSync");
  const incoming = incomingPresent
    ? readRetaFinalSyncDescriptor(envelope)
    : null;
  const remote = remotePresent
    ? readRetaFinalSyncDescriptor(remoteEnvelope)
    : null;

  if (!incomingPresent) {
    if (remotePresent)
      return denied("legacy-write", null, remote, envelope, remoteEnvelope);
    return { allowed: true, reason: "legacy", conflict: null };
  }
  if (!incoming)
    return denied("invalid-descriptor", null, remote, envelope, remoteEnvelope);
  if (remotePresent && !remote) {
    return denied(
      "invalid-remote-descriptor",
      incoming,
      null,
      envelope,
      remoteEnvelope,
    );
  }

  if (!record(remoteEnvelope)) {
    if (
      incoming.baseRevision !== 0 ||
      incoming.snapshotRevision !== 1 ||
      incoming.baseSnapshotRevision !== 0 ||
      incoming.state !== "active"
    ) {
      return denied("create-base", incoming, null, envelope, remoteEnvelope);
    }
    return { allowed: true, reason: "create", conflict: null };
  }

  if (!remote) {
    const adoptionTimestampMatches =
      incoming.baseRevision === 0 &&
      incoming.snapshotRevision === 1 &&
      incoming.baseSnapshotRevision === 0 &&
      incoming.state === "active" &&
      incoming.baseRemoteUpdatedAt === remoteEnvelope.payloadUpdatedAt;
    if (!adoptionTimestampMatches) {
      return denied("adoption-base", incoming, null, envelope, remoteEnvelope);
    }
    return { allowed: true, reason: "adopt", conflict: null };
  }

  if (
    incoming.planId !== remote.planId ||
    incoming.lineageId !== remote.lineageId ||
    incoming.generation !== remote.generation
  ) {
    return denied("lineage", incoming, remote, envelope, remoteEnvelope);
  }

  if (remote.state === "retired" && incoming.state !== "retired") {
    return denied(
      "retired-lineage",
      incoming,
      remote,
      envelope,
      remoteEnvelope,
    );
  }

  if (incoming.snapshotRevision === remote.snapshotRevision) {
    if (
      envelope?.payloadUpdatedAt !== remoteEnvelope?.payloadUpdatedAt ||
      !samePayload(envelope?.payload, remoteEnvelope?.payload)
    ) {
      return denied(
        "replay-payload-mismatch",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    if (JSON.stringify(incoming) !== JSON.stringify(remote)) {
      return denied(
        "replay-descriptor-mismatch",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    return { allowed: true, reason: "replay", conflict: null };
  }
  if (incoming.snapshotRevision !== remote.snapshotRevision + 1) {
    return denied("snapshot-jump", incoming, remote, envelope, remoteEnvelope);
  }
  if (incoming.baseSnapshotRevision !== remote.snapshotRevision) {
    return denied("stale-snapshot", incoming, remote, envelope, remoteEnvelope);
  }

  const planUnchanged =
    incoming.revision === remote.revision && incoming.digest === remote.digest;
  const planAdvanced =
    incoming.revision === remote.revision + 1 &&
    incoming.baseRevision === remote.revision;
  if (!planUnchanged && !planAdvanced) {
    if (incoming.revision < remote.revision) {
      return denied("rollback", incoming, remote, envelope, remoteEnvelope);
    }
    if (incoming.revision === remote.revision) {
      return denied(
        "plan-digest-mismatch",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    if (incoming.baseRevision !== remote.revision) {
      return denied("stale-base", incoming, remote, envelope, remoteEnvelope);
    }
    return denied("revision-jump", incoming, remote, envelope, remoteEnvelope);
  }

  if (planUnchanged) {
    // The rules compare the plan map literally in this branch; a projection
    // difference would pass a digest-only check and be denied server-side.
    if (!samePayload(envelope?.payload?.planejamento, remoteEnvelope?.payload?.planejamento)) {
      return denied(
        "plan-payload-mismatch",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    if (incoming.state !== remote.state) {
      return denied(
        "retired-state-change",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    const sameRemoved =
      JSON.stringify(incoming.removedBlockIds ?? []) ===
      JSON.stringify(remote.removedBlockIds ?? []);
    const sameFloor =
      (incoming.minRetainedRevision ?? 0) === (remote.minRetainedRevision ?? 0);
    if (!sameRemoved || !sameFloor) {
      return denied(
        "tombstone-downgrade",
        incoming,
        remote,
        envelope,
        remoteEnvelope,
      );
    }
    return { allowed: true, reason: "academic-write", conflict: null };
  }

  const oldFloor = remote.minRetainedRevision ?? 0;
  const newFloor = incoming.minRetainedRevision ?? 0;
  if (newFloor < oldFloor) {
    return denied(
      "tombstone-downgrade",
      incoming,
      remote,
      envelope,
      remoteEnvelope,
    );
  }
  const oldRemoved = remote.removedBlockIds ?? [];
  const newRemoved = new Set(incoming.removedBlockIds ?? []);
  const lostTombstone = oldRemoved.some((id) => !newRemoved.has(id));
  if (lostTombstone && !(newFloor >= remote.revision && newFloor >= oldFloor)) {
    return denied(
      "tombstone-downgrade",
      incoming,
      remote,
      envelope,
      remoteEnvelope,
    );
  }
  return { allowed: true, reason: "advance", conflict: null };
}

function errorCode(error) {
  const raw =
    error?.code ?? error?.status ?? error?.statusCode ?? error?.message ?? "";
  return String(raw).toLowerCase();
}

/** Normalize remote failures so the engine never turns a barrier error into success. */
export function classifyRetaFinalRemoteError(error) {
  const raw = errorCode(error);
  if (
    raw.includes("permission-denied") ||
    raw.includes("permission_denied") ||
    raw.includes("403")
  ) {
    return {
      type: "permission-denied",
      retryable: false,
      code: "permission-denied",
    };
  }
  if (
    raw.includes("failed-precondition") ||
    raw.includes("aborted") ||
    raw.includes("409") ||
    raw.includes("already-exists") ||
    raw.includes("conflict")
  ) {
    return { type: "conflict", retryable: true, code: raw || "conflict" };
  }
  if (
    raw.includes("unavailable") ||
    raw.includes("offline") ||
    raw.includes("network-request-failed") ||
    raw.includes("failed to fetch") ||
    raw.includes("network") ||
    raw.includes("deadline-exceeded")
  ) {
    return { type: "offline", retryable: true, code: raw || "unavailable" };
  }
  if (raw.includes("resource-exhausted") || raw.includes("quota")) {
    return {
      type: "transient",
      retryable: true,
      code: raw || "resource-exhausted",
    };
  }
  return { type: "unknown", retryable: false, code: raw || "unknown" };
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
