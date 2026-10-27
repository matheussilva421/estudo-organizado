import { debugLog } from "../debug.js";
import {
  completeGoogleRedirectSignIn,
  getFirebaseConfigStatus,
  initFirebaseServices,
  observeFirebaseAuth,
  signInWithGoogle,
  signOutFirebase,
} from "../firebase/firebase-client.js?v=8.37";
import { saveStateToDB, setState, state } from "../store.js?v=8.37";
import { stableStringify } from "../store/normalize-state.js?v=8.37";
import {
  applyEnvelopeToLocalState,
  createDefaultFirestoreSyncConfig,
  createFirestoreSnapshotEnvelope,
  getEnvelopeUpdatedAt,
  getFirestoreDeviceId,
  isRemoteNewer,
  FIRESTORE_ENVELOPE_MAX_BYTES,
  getFirestoreEnvelopeSizeBytes,
} from "./firestore-schema.js?v=8.37";
import {
  clearFirestoreConflict,
  enqueueFirestoreSnapshot,
  getPendingFirestoreSnapshot,
  markFirestoreSnapshotFailed,
  markFirestoreSnapshotSynced,
  replacePendingFirestoreSnapshotEnvelope,
  saveFirestoreConflict,
  saveFirestoreMeta,
} from "./firestore-outbox.js?v=8.37";
import * as firestoreRepository from "./firestore-repository.js?v=8.37";
import {
  canAutoSyncFirestore,
  isGlobalSyncPaused,
  isRemoteStateNewer,
  mergeStudyStates,
} from "./sync-center.js?v=8.37";
import {
  checkEntityMigrationNeeded,
  migrateEntitiesToSnapshot,
} from "./entity-migration.js?v=8.37";
import { firestoreLock } from "./sync-lock.js?v=8.37";
import { yieldToUIWithBudget } from "./sync-yield.js?v=8.37";
import {
  buildRetaFinalSyncDescriptor,
  classifyRetaFinalRemoteError,
  compareRetaFinalPlanIntent,
  computeRetaFinalIntentDigest,
  computeRetaFinalPlanDigest,
  getRetaFinalPlan,
  getRetaFinalSyncCapabilities,
  readRetaFinalSyncDescriptor,
  validateRetaFinalEnvelopeWrite,
} from "./reta-final-protocol.js?v=8.37";
import {
  assessLegacyRetaFinalWrite,
  buildLegacyRetaFinalAdoption,
  isRetaFinalPlanShape,
} from "./reta-final-legacy.js?v=8.37";
import { mergeRetaFinalPlans } from "../logic/reta-final-merge.js?v=8.37";

const readFirestoreSnapshot = (...args) =>
  firestoreRepository.readFirestoreSnapshot(...args);
const writeFirestoreSnapshot = (...args) =>
  firestoreRepository.writeFirestoreSnapshot(...args);

let currentUser = null;

/** @internal - Test hook to set currentUser for unit tests */
export function __setCurrentUser(user) {
  currentUser = user;
}
let authUnsubscribe = null;
let lastStatusSignature = "";

function getConfig() {
  if (!state.config) state.config = {};
  const defaults = createDefaultFirestoreSyncConfig();
  const current = state.config.firestoreSync;
  if (!current || typeof current !== "object") {
    state.config.firestoreSync = defaults;
    return state.config.firestoreSync;
  }
  // Keep object identity: emitStatus() calls getConfig() frequently and a new
  // object here would silently discard mutations made by the caller.
  for (const key of Object.keys(defaults)) {
    if (!(key in current)) current[key] = defaults[key];
  }
  return current;
}

const RETA_FINAL_CONFLICT = "reta-final-conflict";
const LEGACY_PLAN_MISMATCH_REASON =
  "O planejamento Reta Final do Firestore e anterior ao schema v2 e diverge do plano local; compare as diferencas antes de publicar qualquer alteracao.";

function isRetaFinalConflict(conflict) {
  return conflict?.type === RETA_FINAL_CONFLICT;
}

function isBlockingFirestoreConflict(conflict) {
  return conflict?.type === "entity-conflict" || isRetaFinalConflict(conflict);
}

// A 9.71 client could persist `missing-remote-plan` before the legacy adoption
// existed. It is safe to re-read the remote on the normal path: the strict
// comparison either adopts an equivalent legacy plan or replaces the conflict
// with a material one. Any pending outbox still blocks this recovery.
const RECOVERABLE_RETA_FINAL_CAUSES = new Set([
  "missing-remote-plan",
  // A 9.76 client could persist an `outbox-rebase-unsafe` produced by a raw
  // plan comparison (projection drift). It must be re-evaluated by the normal
  // path: a safe rebase repairs it, and a real divergence is registered again
  // with a precise subcause. The original operation is never discarded.
  "outbox-rebase-unsafe",
  "replay-payload-mismatch",
  "remote-changed-during-recovery",
]);
function isRecoverableRetaFinalConflict(conflict) {
  return (
    isRetaFinalConflict(conflict) &&
    RECOVERABLE_RETA_FINAL_CAUSES.has(conflict.cause)
  );
}

// Write-time rejections that may be repaired by re-deriving the descriptor
// from the observed remote instead of asking the user to act.
const RECOVERABLE_RETA_FINAL_REASONS = new Set([
  "replay-payload-mismatch",
  "replay-descriptor-mismatch",
  "plan-payload-mismatch",
  "snapshot-jump",
  "stale-snapshot",
]);

function recoveryConflictReason(recovery) {
  const code = recovery?.reasonCode || "unknown";
  const head = `A outbox pendente nao pode ser rebaseada com seguranca (${code}).`;
  if (code === "plan-intent-divergence" || code === "pending-plan-intent-divergence") {
    return (
      head +
      " O plano local e o remoto divergem em conteudo academico; compare as diferencas listadas e resolva pelo editor ou por um checkpoint."
    );
  }
  if (code === "academic-divergence") {
    return (
      head +
      " O mesmo item academico mudou dos dois lados; escolha qual versao manter."
    );
  }
  if (code === "rebase-too-large") {
    return (
      head +
      " A envelope continua acima de 1 MiB; nenhum dado academico foi cortado ou removido."
    );
  }
  if (code === "local-tombstones-not-remote" || code === "local-retention-ahead") {
    return (
      head +
      " Existem exclusoes locais que o remoto ainda nao conhece; publique-as por uma nova revisao."
    );
  }
  return (
    head +
    " A operacao original permanece preservada; nada foi sobrescrito. Tente sincronizar novamente apos confirmar o estado remoto."
  );
}

function clonePlan(plan) {
  return plan ? JSON.parse(JSON.stringify(plan)) : null;
}

// Same snapshot slot: the same plan lineage and the same CAS counters. A new
// plan revision may coalesce into it; a different slot must be flushed first.
function sameOutboxSnapshotLineage(left, right) {
  if (!left || !right) return false;
  return (
    left.planId === right.planId &&
    left.lineageId === right.lineageId &&
    left.generation === right.generation &&
    left.baseRevision === right.baseRevision &&
    left.snapshotRevision === right.snapshotRevision &&
    left.baseSnapshotRevision === right.baseSnapshotRevision
  );
}

function filterRemovedBlocks(plan, removedBlockIds) {
  if (!plan || !Array.isArray(removedBlockIds) || removedBlockIds.length === 0)
    return plan;
  const removed = new Set(removedBlockIds);
  const blocks = Array.isArray(plan.retaFinal?.blocos)
    ? plan.retaFinal.blocos.filter((block) => !removed.has(block?.id))
    : [];
  return { ...plan, retaFinal: { ...plan.retaFinal, blocos: blocks } };
}

function localTombstones(config) {
  return Array.isArray(config.removedBlocks) ? config.removedBlocks : [];
}

function updateLocalTombstones(config, basePlan, plan, revision) {
  const currentIds = new Set(
    (plan?.retaFinal?.blocos || []).map((block) => block?.id).filter(Boolean),
  );
  const map = new Map(localTombstones(config).map((item) => [item.id, item]));
  for (const block of basePlan?.retaFinal?.blocos || []) {
    if (block?.id && !currentIds.has(block.id)) {
      map.set(block.id, { id: block.id, revision });
    }
  }
  // Append-only lineage: a block that reappears in the plan keeps its tombstone.
  const sorted = [...map.values()].sort(
    (left, right) =>
      right.revision - left.revision || left.id.localeCompare(right.id),
  );
  if (sorted.length > 200) {
    config.minRetainedRevision = Math.max(
      Number.isSafeInteger(config.minRetainedRevision)
        ? config.minRetainedRevision
        : 0,
      Number.isSafeInteger(config.baseRevision) ? config.baseRevision : 0,
      Number.isSafeInteger(basePlan?.revision) ? basePlan.revision : 0,
    );
  }
  config.removedBlocks = sorted.slice(0, 200);
  return config.removedBlocks;
}

function retentionFloor(config, tombstones) {
  const remoteFloor = Number.isSafeInteger(config.minRetainedRevision)
    ? config.minRetainedRevision
    : 0;
  if (tombstones.length === 0) {
    // Omit the field when the remote lineage never declared a floor: the rules
    // require exact presence equality on an unchanged-plan advance.
    return remoteFloor > 0 ? remoteFloor : undefined;
  }
  const localFloor = Math.max(
    0,
    Math.min(...tombstones.map((item) => item.revision)) - 1,
  );
  return Math.max(localFloor, remoteFloor);
}

function rememberRemoteTombstones(config, descriptor) {
  if (!descriptor) return;
  const map = new Map(localTombstones(config).map((item) => [item.id, item]));
  for (const id of descriptor.removedBlockIds || []) {
    map.set(id, { id, revision: descriptor.revision });
  }
  config.removedBlocks = [...map.values()]
    .sort(
      (left, right) =>
        right.revision - left.revision || left.id.localeCompare(right.id),
    )
    .slice(0, 200);
  if (descriptor.minRetainedRevision !== undefined) {
    config.minRetainedRevision = descriptor.minRetainedRevision;
  }
}

function allRemovedIds(config, descriptor) {
  return [
    ...new Set([
      ...(descriptor?.removedBlockIds || []),
      ...localTombstones(config).map((item) => item.id),
    ]),
  ];
}

function getRetaFinalPayloadPlan(sourceState) {
  const plan = sourceState?.planejamento;
  if (
    !plan ||
    typeof plan !== "object" ||
    plan.tipo !== "reta_final" ||
    plan.schemaVersionRetaFinal !== 2
  ) {
    return null;
  }
  return plan;
}

function verifiedRetaFinalBase(config) {
  const base = config.basePlan;
  if (!base || typeof base !== "object" || Array.isArray(base)) return null;
  if (!Number.isSafeInteger(base.revision) || base.revision < 0) return null;
  if (!config.baseDigest) return null;
  if (computeRetaFinalPlanDigest(base) !== config.baseDigest) return null;
  return base;
}

function setRetaFinalBaseFromRemote(config, remote, remotePlan) {
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  rememberRemoteTombstones(config, readRetaFinalSyncDescriptor(remote));
  if (!remotePlan) {
    const descriptor = readRetaFinalSyncDescriptor(remote);
    Object.assign(config, {
      basePlan: null,
      baseRevision: null,
      baseDigest: null,
      baseRemoteDigest: null,
      baseRemovedBlockIds: null,
      baseMinRetainedRevision: null,
      snapshotRevision: descriptor?.snapshotRevision ?? 0,
      baseRemoteUpdatedAt: remoteUpdatedAt,
    });
    return;
  }
  const descriptor = readRetaFinalSyncDescriptor(remote);
  Object.assign(config, {
    basePlan: clonePlan(remotePlan),
    baseRevision: descriptor?.revision ?? remotePlan.revision,
    // baseDigest verifies the local copy; baseRemoteDigest is the wire value
    // the rules compare. They can differ when projection drift changed only
    // the local rendering of the same intent.
    baseDigest: computeRetaFinalPlanDigest(remotePlan),
    baseRemoteDigest: descriptor?.digest ?? computeRetaFinalPlanDigest(remotePlan),
    baseRemovedBlockIds: Array.isArray(descriptor?.removedBlockIds)
      ? [...descriptor.removedBlockIds]
      : null,
    baseMinRetainedRevision:
      descriptor && Object.hasOwn(descriptor, "minRetainedRevision")
        ? descriptor.minRetainedRevision
        : null,
    snapshotRevision: descriptor?.snapshotRevision ?? 0,
    baseRemoteUpdatedAt: remoteUpdatedAt,
    baseUpdatedAt: new Date().toISOString(),
    remoteUpdatedAt,
  });
}

async function probeRetaFinalGuard(db, uid, descriptor) {
  if (typeof firestoreRepository.verifyRetaFinalGuard !== "function") {
    return { verified: false, reason: "guard-unavailable" };
  }
  try {
    const result = await firestoreRepository.verifyRetaFinalGuard(
      db,
      uid,
      descriptor.deviceId,
    );
    if (result?.verified === true)
      return { verified: true, reason: "accepted" };
    return { verified: false, reason: result?.reason || "guard-denied" };
  } catch (err) {
    return {
      verified: false,
      reason: err?.code || err?.message || "guard-unavailable",
    };
  }
}

async function registerRetaFinalConflict(
  config,
  decision,
  pending,
  remote,
  error = null,
) {
  const incoming = decision?.conflict || {};
  const subcause = incoming.subcause || null;
  const remoteDescriptor = readRetaFinalSyncDescriptor(remote);
  const conflict = {
    ...incoming,
    type: RETA_FINAL_CONFLICT,
    cause: incoming.cause || decision?.reason || "unknown",
    ...(subcause ? { subcause } : {}),
    detectedAt: new Date().toISOString(),
    remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
    basePlan: clonePlan(config.basePlan),
    remoteSnapshotRevision: remoteDescriptor?.snapshotRevision ?? null,
    remoteRemovedBlockIds: remoteDescriptor?.removedBlockIds ?? null,
    remoteMinRetainedRevision:
      remoteDescriptor && Object.hasOwn(remoteDescriptor, "minRetainedRevision")
        ? remoteDescriptor.minRetainedRevision
        : null,
    localPlan:
      incoming.localPlan ??
      pending?.envelope?.payload?.planejamento ??
      getRetaFinalPayloadPlan(state),
    remotePlan: incoming.remotePlan ?? remote?.payload?.planejamento ?? null,
    reason:
      incoming.reason ||
      "A Reta Final v2 remota exige reconciliacao humana antes de nova escrita.",
  };
  if (error) conflict.error = error?.code || error?.message || String(error);
  config.conflict = conflict;
  config.hasPendingWrites = true;
  config.lastError = `Conflito Reta Final: ${conflict.cause}${
    subcause ? ` (${subcause})` : ""
  }.`;
  await saveFirestoreConflict(conflict);
  await persistSyncConfig(false);
  emitStatus("conflict", { conflict });
  return false;
}

function retaFinalQueueOptions(config, sourceState, options) {
  const activePlan = getRetaFinalPlan(sourceState);
  const payloadPlan = getRetaFinalPayloadPlan(sourceState);
  const base = verifiedRetaFinalBase(config);
  const baseSnapshotRevision = Number.isSafeInteger(config.snapshotRevision)
    ? config.snapshotRevision
    : 0;
  const snapshotRevision = baseSnapshotRevision + 1;

  if (activePlan) {
    if (config.basePlan && !base) {
      throw new Error(
        "Base local da Reta Final invalida; publique somente apos reconciliar.",
      );
    }
    if (base && base.planId !== activePlan.planId) {
      const err = new Error(
        "Linhagem da Reta Final mudou sem confirmacao humana.",
      );
      err.code = "RETA_FINAL_LINEAGE_CHANGE";
      throw err;
    }
    const baseRevision = base?.revision ?? 0;
    if (baseRevision > activePlan.revision) {
      throw new Error(
        "baseRevision local nao pode exceder a revision do plano.",
      );
    }
    const tombstones = updateLocalTombstones(
      config,
      base,
      activePlan,
      activePlan.revision,
    );
    // Identity is the intent, not the local projection: syncRetaFinalToEventos
    // rewrites `data`/`status`/`rolagens` in place without bumping `revision`.
    const academicOnly =
      Boolean(base) &&
      activePlan.revision === base.revision &&
      compareRetaFinalPlanIntent(activePlan, base).equivalent;
    // The descriptor must describe the plan that actually travels in the
    // envelope. Academic-only pushes carry the verified remote plan verbatim
    // (the rules compare the map), so they also carry the remote wire digest.
    const planForDescriptor = academicOnly ? base : activePlan;
    const wireDigest = academicOnly
      ? (config.baseRemoteDigest ?? computeRetaFinalPlanDigest(base))
      : null;
    // An unchanged plan must carry the remote descriptor fields verbatim: the
    // rules compare presence, value and list order of tombstones and floor.
    const removedBlockIds =
      academicOnly && Array.isArray(config.baseRemovedBlockIds)
        ? config.baseRemovedBlockIds
        : tombstones.map((item) => item.id);
    const minRetainedRevision = academicOnly
      ? (config.baseMinRetainedRevision ?? undefined)
      : retentionFloor(config, tombstones);
    const descriptor = buildRetaFinalSyncDescriptor({
      plan: planForDescriptor,
      baseRevision,
      baseRemoteUpdatedAt:
        options.baseRemoteUpdatedAt ??
        config.baseRemoteUpdatedAt ??
        (base ? null : (config.remoteUpdatedAt ?? null)),
      deviceId: getFirestoreDeviceId(),
      capabilities: getRetaFinalSyncCapabilities(sourceState),
      state: "active",
      snapshotRevision,
      baseSnapshotRevision,
      removedBlockIds,
      minRetainedRevision,
      wireDigest,
    });
    if (getRetaFinalPayloadPlan(sourceState)?.planId !== descriptor.planId) {
      const err = new Error(
        "Payload e descriptor pertencem a linhagens diferentes.",
      );
      err.code = "RETA_FINAL_LINEAGE_PAYLOAD";
      throw err;
    }
    return {
      ...options,
      retaFinalSync: descriptor,
      planOverride: academicOnly ? base : undefined,
    };
  }

  if (!base) {
    if (payloadPlan) {
      const err = new Error(
        "Linhagem remota desconhecida para o plano Reta Final inativo.",
      );
      err.code = "RETA_FINAL_LINEAGE_UNKNOWN";
      throw err;
    }
    return options;
  }

  if (payloadPlan && payloadPlan.planId !== base.planId) {
    const err = new Error(
      "Linhagem da Reta Final mudou sem confirmacao humana.",
    );
    err.code = "RETA_FINAL_LINEAGE_CHANGE";
    throw err;
  }

  const remoteRevision = Number.isSafeInteger(config.baseRevision)
    ? config.baseRevision
    : base.revision;
  const alreadyRetired =
    base.ativo !== true &&
    compareRetaFinalPlanIntent(payloadPlan || base, base).equivalent;
  const revision = alreadyRetired
    ? remoteRevision
    : Math.max(base.revision, remoteRevision) + 1;
  const retiredPlan = payloadPlan || base;
  const tombstones = updateLocalTombstones(config, base, retiredPlan, revision);
  const descriptor = buildRetaFinalSyncDescriptor({
    plan: retiredPlan,
    revision,
    baseRevision: remoteRevision,
    baseRemoteUpdatedAt: config.baseRemoteUpdatedAt ?? null,
    deviceId: getFirestoreDeviceId(),
    capabilities: getRetaFinalSyncCapabilities(sourceState),
    state: "retired",
    snapshotRevision,
    baseSnapshotRevision,
    removedBlockIds: tombstones.map((item) => item.id),
    minRetainedRevision: retentionFloor(config, tombstones),
    wireDigest: alreadyRetired ? (config.baseRemoteDigest ?? null) : null,
  });
  if (payloadPlan && payloadPlan.planId !== descriptor.planId) {
    const err = new Error(
      "Payload e descriptor pertencem a linhagens diferentes.",
    );
    err.code = "RETA_FINAL_LINEAGE_PAYLOAD";
    throw err;
  }
  return {
    ...options,
    retaFinalSync: descriptor,
    planOverride: alreadyRetired ? base : undefined,
  };
}

function stripOperationalMetadata(sourceState) {
  const snapshot = JSON.parse(JSON.stringify(sourceState || {}));
  delete snapshot.lastSync;
  if (snapshot.config) {
    delete snapshot.config.firestoreSync;
    delete snapshot.config.syncMergeConflicts;
    delete snapshot.config.localBackupAt;
    delete snapshot.config._lastUpdated;
    // Mirror createExportableState: these local-only operational fields never
    // travel in the Firestore payload and must not create false academic diffs.
    delete snapshot.config.cfUrl;
    delete snapshot.config.cfToken;
    delete snapshot.config.cfTokenSaved;
    delete snapshot.config.cfConflict;
    delete snapshot.config.cfRemoteUpdatedAt;
    delete snapshot.config.cfLastSyncAt;
    delete snapshot.config.cfSyncEnabled;
    delete snapshot.config.manualSyncHistory;
    delete snapshot.config.lastManualSyncResults;
  }
  delete snapshot.driveFileId;
  return snapshot;
}

function nonPlanStateDigest(sourceState) {
  const snapshot = stripOperationalMetadata(sourceState);
  delete snapshot.planejamento;
  delete snapshot.planejamentoArquivado;
  return stableStringify(snapshot);
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function academicItemContent(item) {
  if (!item || typeof item !== "object") return stableStringify(item);
  const copy = { ...item };
  delete copy.updatedAt;
  return stableStringify(copy);
}

function academicDivergences(baseState, localState, remoteState) {
  const divergences = [];
  const tombstones = new Set(
    [
      ...(Array.isArray(baseState?.syncTombstones)
        ? baseState.syncTombstones
        : []),
      ...(Array.isArray(localState?.syncTombstones)
        ? localState.syncTombstones
        : []),
      ...(Array.isArray(remoteState?.syncTombstones)
        ? remoteState.syncTombstones
        : []),
    ].map((item) => `${item?.col}:${item?.id}`),
  );
  const compare = (collection, baseList, localList, remoteList) => {
    const byId = (list) =>
      new Map(
        (Array.isArray(list) ? list : [])
          .filter((item) => item?.id)
          .map((item) => [item.id, item]),
      );
    const baseMap = byId(baseList);
    const localMap = byId(localList);
    const remoteMap = byId(remoteList);
    for (const id of new Set([...localMap.keys(), ...remoteMap.keys()])) {
      if (tombstones.has(`${collection}:${id}`)) continue;
      const baseItem = baseMap.get(id);
      const localItem = localMap.get(id);
      const remoteItem = remoteMap.get(id);
      const baseContent = baseItem ? academicItemContent(baseItem) : null;
      const localContent = localItem ? academicItemContent(localItem) : null;
      const remoteContent = remoteItem ? academicItemContent(remoteItem) : null;
      let diverged = false;
      if (localItem && remoteItem) {
        if (localContent === remoteContent) continue;
        if (!baseItem) {
          diverged = true;
        } else {
          const localChanged = localContent !== baseContent;
          const remoteChanged = remoteContent !== baseContent;
          diverged = localChanged && remoteChanged;
        }
      } else if (!localItem && remoteItem) {
        if (baseItem) {
          // Local absence without a tombstone cannot be proven to be a
          // legitimate deletion; a changed remote would be overwritten.
          diverged = true;
        }
      }
      if (diverged) {
        divergences.push(`${collection}:${id}`);
        if (divergences.length >= 20) return;
      }
    }
  };
  for (const collection of ["eventos", "editais", "arquivo", "revisoes"]) {
    compare(
      collection,
      baseState?.[collection],
      localState?.[collection],
      remoteState?.[collection],
    );
  }
  const habitKeys = new Set([
    ...Object.keys(baseState?.habitos || {}),
    ...Object.keys(localState?.habitos || {}),
    ...Object.keys(remoteState?.habitos || {}),
  ]);
  for (const key of habitKeys) {
    compare(
      `habitos.${key}`,
      baseState?.habitos?.[key],
      localState?.habitos?.[key],
      remoteState?.habitos?.[key],
    );
  }
  return divergences;
}

function isStaleRetaFinalReplay(pending, remote) {
  const pendingDescriptor = readRetaFinalSyncDescriptor(pending?.envelope);
  const remoteDescriptor = readRetaFinalSyncDescriptor(remote);
  if (!pendingDescriptor || !remoteDescriptor) {
    return { ok: false, reason: "missing-descriptor" };
  }
  if (
    pendingDescriptor.state !== "active" ||
    remoteDescriptor.state !== "active"
  ) {
    return { ok: false, reason: "not-active" };
  }
  if (
    pendingDescriptor.planId !== remoteDescriptor.planId ||
    pendingDescriptor.lineageId !== remoteDescriptor.lineageId ||
    pendingDescriptor.generation !== remoteDescriptor.generation ||
    pendingDescriptor.revision !== remoteDescriptor.revision
  ) {
    return { ok: false, reason: "lineage" };
  }
  // The pending write may be a replay (same snapshot) or the immediate next
  // snapshot whose payload was built from a stale plan/projection. Anything
  // further ahead is not a recoverable replay.
  if (
    pendingDescriptor.snapshotRevision >
    remoteDescriptor.snapshotRevision + 1
  ) {
    return { ok: false, reason: "pending-snapshot-ahead" };
  }
  return { ok: true, pendingDescriptor, remoteDescriptor };
}

function exactTombstoneFields(remoteDescriptor, localConfig) {
  const localRemoved = localTombstones(localConfig).map((item) => item.id);
  const remoteRemoved = remoteDescriptor.removedBlockIds ?? [];
  const extraLocal = localRemoved.filter((id) => !remoteRemoved.includes(id));
  if (extraLocal.length) {
    return { ok: false, reason: "local-tombstones-not-remote" };
  }
  const localFloor = Number.isSafeInteger(localConfig.minRetainedRevision)
    ? localConfig.minRetainedRevision
    : 0;
  const remoteFloor = Number.isSafeInteger(remoteDescriptor.minRetainedRevision)
    ? remoteDescriptor.minRetainedRevision
    : 0;
  if (localFloor > remoteFloor) {
    return { ok: false, reason: "local-retention-ahead" };
  }
  return {
    ok: true,
    removedBlockIds: remoteRemoved,
    minRetainedRevision: remoteDescriptor.minRetainedRevision,
  };
}

function mergeAcademicStateForRebase(currentState, pendingPayload, remotePayload) {
  const pendingAcademic = { ...(pendingPayload || {}) };
  delete pendingAcademic.planejamento;
  const remoteAcademic = { ...(remotePayload || {}) };
  delete remoteAcademic.planejamento;
  let merged = mergeStudyStates(currentState, pendingAcademic);
  merged = mergeStudyStates(merged, remoteAcademic);
  preserveRunningTimers(merged, currentState);
  merged.planejamento = clonePlan(remotePayload?.planejamento);
  return merged;
}

// `_timerStart` is a transient runtime marker (an active timer), not academic
// content. LWW can drop it when the same event also changed remotely; the
// running session must never be lost by a recovery merge.
function preserveRunningTimers(merged, localState) {
  if (!Array.isArray(merged?.eventos) || !Array.isArray(localState?.eventos))
    return merged;
  const localById = new Map(
    localState.eventos
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
  merged.eventos = merged.eventos.map((item) => {
    const local = localById.get(item?.id);
    if (!local || !local._timerStart || item._timerStart) return item;
    // The running marker and its accumulated base are one pair; restoring
    // only `_timerStart` would add the local session to a different base.
    return {
      ...item,
      _timerStart: local._timerStart,
      ...(Number.isFinite(Number(local.tempoAcumulado))
        ? { tempoAcumulado: Number(local.tempoAcumulado) }
        : {}),
    };
  });
  return merged;
}

function pullLocalIdentity(localPlan) {
  return {
    revision: localPlan?.revision ?? null,
    // Projection drift during the pull must not look like a local edit.
    digest: localPlan ? computeRetaFinalIntentDigest(localPlan) : null,
    backupAt: state.config?.localBackupAt ?? null,
    nonPlanDigest: nonPlanStateDigest(state),
  };
}

function legacyAdoptionAlreadyRecorded(config, remote, plan) {
  const base = verifiedRetaFinalBase(config);
  if (!base) return false;
  if (config.baseRevision !== 0 || config.snapshotRevision !== 0) return false;
  if (config.baseRemoteUpdatedAt !== getEnvelopeUpdatedAt(remote)) return false;
  return (
    computeRetaFinalPlanDigest(base) === computeRetaFinalPlanDigest(plan)
  );
}

function mergeLegacyAdoptionState(remote) {
  // Academic-only merge: the plan was proven equivalent, so the local v2
  // identity and revision stay authoritative while remote academic data is
  // pulled in without touching the planning.
  const payload = { ...(remote?.payload || {}) };
  delete payload.planejamento;
  return mergeStudyStates(
    { ...state, planejamento: clonePlan(state.planejamento) },
    payload,
  );
}

function pendingEnvelopeHasOperationalHistory(pending) {
  const payloadConfig = pending?.envelope?.payload?.config;
  return Boolean(
    payloadConfig &&
      (Object.hasOwn(payloadConfig, "manualSyncHistory") ||
        Object.hasOwn(payloadConfig, "lastManualSyncResults")),
  );
}

function envelopeTooLargeMessage(size) {
  return (
    `Envelope Firestore com ${size} bytes excede ${FIRESTORE_ENVELOPE_MAX_BYTES}; ` +
    "dados academicos preservados, segmentacao necessaria."
  );
}

async function repairPendingFirestoreSnapshot(pending, config) {
  if (!pending?.envelope) return pending;
  const size = getFirestoreEnvelopeSizeBytes(pending.envelope);
  const hasHistory = pendingEnvelopeHasOperationalHistory(pending);
  if (!hasHistory && size <= FIRESTORE_ENVELOPE_MAX_BYTES) return pending;

  const removedBefore = JSON.stringify(config.removedBlocks || []);
  let envelope;
  try {
    const options = retaFinalQueueOptions(config, state, {
      manual: true,
      baseRemoteUpdatedAt:
        pending.envelope.baseRemoteUpdatedAt ??
        config.baseRemoteUpdatedAt ??
        null,
    });
    envelope = createFirestoreSnapshotEnvelope(state, options);
  } catch (err) {
    config.lastError =
      "Nao foi possivel reconstruir a outbox pendente: " +
      (err.message || String(err));
    config.hasPendingWrites = true;
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return pending;
  }
  if (JSON.stringify(config.removedBlocks || []) !== removedBefore) {
    await persistSyncConfig(true);
  }
  const nextSize = getFirestoreEnvelopeSizeBytes(envelope);
  config.lastEnvelopeBytes = nextSize;
  if (nextSize > FIRESTORE_ENVELOPE_MAX_BYTES) {
    config.lastError = envelopeTooLargeMessage(nextSize);
    config.hasPendingWrites = true;
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return pending;
  }
  const replaced = await replacePendingFirestoreSnapshotEnvelope(envelope, {
    queuedAt: pending.queuedAt ?? null,
    sentAt: pending.envelope?.sentAt ?? null,
  });
  if (!replaced) return await getPendingFirestoreSnapshot();
  const repaired = await getPendingFirestoreSnapshot();
  emitStatus("pending", {
    reason: "outbox-recomposed",
    sizeBytes: nextSize,
  });
  return repaired;
}

function descriptorPayloadMismatch(pending, descriptor, remoteEnvelope = null) {
  if (!descriptor) return true;
  const sentPlan = getRetaFinalPayloadPlan({
    planejamento: pending?.envelope?.payload?.planejamento,
  });
  const sentDigest = sentPlan ? computeRetaFinalPlanDigest(sentPlan) : null;
  const remoteDescriptor = readRetaFinalSyncDescriptor(remoteEnvelope);
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remoteEnvelope?.payload?.planejamento,
  });
  // An unchanged plan carries the remote digest verbatim: the rules compare
  // both the digest and the plan map, so the payload must be the exact remote
  // plan while the local projection may differ.
  const carriedRemoteDigest = Boolean(
    remoteDescriptor &&
      remotePlan &&
      sentPlan &&
      descriptor.digest === remoteDescriptor.digest &&
      sameJson(sentPlan, remotePlan),
  );
  if (descriptor.state === "active") {
    if (!sentPlan || sentPlan.ativo !== true) return true;
    if (sentPlan.revision !== descriptor.revision) return true;
    return sentDigest !== descriptor.digest && !carriedRemoteDigest;
  }
  return Boolean(
    (sentPlan && sentPlan.ativo === true) ||
      (sentPlan && sentDigest !== descriptor.digest && !carriedRemoteDigest),
  );
}

// Cheap structural gate used before any network read. The digest relation is
// verified later, once the remote envelope is available.
function descriptorPayloadStructureMismatch(pending, descriptor) {
  if (!descriptor) return true;
  const sentPlan = getRetaFinalPayloadPlan({
    planejamento: pending?.envelope?.payload?.planejamento,
  });
  if (descriptor.state === "active") {
    return (
      !sentPlan ||
      sentPlan.ativo !== true ||
      sentPlan.revision !== descriptor.revision
    );
  }
  return Boolean(sentPlan && sentPlan.ativo === true);
}

async function acknowledgeAlreadyAppliedOutbox(pending, remote, uid, config) {
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remote?.payload?.planejamento,
  });
  const cleared = await markFirestoreSnapshotSynced({
    queuedAt: pending.queuedAt ?? null,
    sentAt: pending.envelope?.sentAt ?? null,
  });
  if (!cleared) {
    config.hasPendingWrites = true;
    config.lastError = "Outbox mudou durante a recuperacao do replay.";
    await persistSyncConfig(true);
    emitStatus("pending", { reason: "outbox-changed" });
    return false;
  }
  setRetaFinalBaseFromRemote(config, remote, remotePlan);
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  const pullAt = new Date().toISOString();
  await clearFirestoreConflict();
  Object.assign(config, {
    uid,
    remoteUpdatedAt,
    lastPullAt: pullAt,
    hasPendingWrites: false,
    conflict: null,
    lastError: null,
  });
  await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
  await persistSyncConfig(true);
  emitPrimaryStatus("synced", {
    source: "outbox-already-applied",
    remoteUpdatedAt,
  });
  emitStatus("synced");
  return true;
}

async function recoverStaleAdoptionOutbox(pending, remote, config) {
  const stale = isStaleRetaFinalReplay(pending, remote);
  if (!stale.ok)
    return { status: "not-applicable", reasonCode: stale.reason };

  const localPlan = getRetaFinalPayloadPlan(state);
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remote?.payload?.planejamento,
  });
  const pendingPlan = getRetaFinalPayloadPlan({
    planejamento: pending?.envelope?.payload?.planejamento,
  });
  if (!localPlan || !remotePlan || !pendingPlan) {
    return { status: "unsafe", reasonCode: "missing-plan" };
  }
  if (
    localPlan.planId !== remotePlan.planId ||
    localPlan.revision !== remotePlan.revision ||
    pendingPlan.planId !== remotePlan.planId ||
    pendingPlan.revision !== remotePlan.revision
  ) {
    return { status: "unsafe", reasonCode: "lineage" };
  }
  // Plan identity is human intent, never the raw representation. The schedule
  // projection rewrites `data`, `status` and `rolagens` in place on every
  // device without bumping `revision`, so a byte comparison would turn normal
  // projection drift into a false `outbox-rebase-unsafe` (the 9.76 incident).
  const localIntent = compareRetaFinalPlanIntent(localPlan, remotePlan);
  if (!localIntent.equivalent) {
    return {
      status: "unsafe",
      reasonCode: "plan-intent-divergence",
      differences: localIntent.differences,
      details: {
        blockCount: localIntent.blockCount,
        changedBlockIds: localIntent.changedBlockIds,
      },
    };
  }
  const pendingIntent = compareRetaFinalPlanIntent(pendingPlan, remotePlan);
  if (!pendingIntent.equivalent) {
    return {
      status: "unsafe",
      reasonCode: "pending-plan-intent-divergence",
      differences: pendingIntent.differences,
      details: {
        blockCount: pendingIntent.blockCount,
        changedBlockIds: pendingIntent.changedBlockIds,
      },
    };
  }
  const tombstoneFields = exactTombstoneFields(stale.remoteDescriptor, config);
  if (!tombstoneFields.ok) {
    return {
      status: "unsafe",
      reasonCode: tombstoneFields.reason,
      details: {
        localTombstones: localTombstones(config).length,
        remoteTombstones: (stale.remoteDescriptor.removedBlockIds ?? []).length,
        localRetentionFloor: config.minRetainedRevision ?? 0,
        remoteRetentionFloor:
          stale.remoteDescriptor.minRetainedRevision ?? 0,
      },
    };
  }

  const pendingPayload = pending.envelope.payload || {};
  const remotePayload = remote.payload || {};
  const divergences = academicDivergences(
    pendingPayload,
    state,
    remotePayload,
  );
  if (divergences.length) {
    return {
      status: "unsafe",
      reasonCode: "academic-divergence",
      differences: divergences,
      details: { conflictCount: divergences.length },
    };
  }

  const pendingAcademic = { ...pendingPayload };
  delete pendingAcademic.planejamento;
  const combined = mergeStudyStates(state, pendingAcademic);
  const remoteNonPlan = nonPlanStateDigest(remotePayload);
  if (
    nonPlanStateDigest(combined) === remoteNonPlan &&
    nonPlanStateDigest(state) === remoteNonPlan
  ) {
    return { status: "already-applied" };
  }

  const merged = mergeAcademicStateForRebase(
    state,
    pendingPayload,
    remotePayload,
  );
  merged.planejamento = clonePlan(remotePlan);
  const localNonPlanAtRebase = nonPlanStateDigest(state);
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  const descriptor = buildRetaFinalSyncDescriptor({
    plan: remotePlan,
    baseRevision: stale.remoteDescriptor.revision,
    baseRemoteUpdatedAt: remoteUpdatedAt,
    deviceId: getFirestoreDeviceId(),
    capabilities: getRetaFinalSyncCapabilities(state),
    state: "active",
    revision: stale.remoteDescriptor.revision,
    snapshotRevision: stale.remoteDescriptor.snapshotRevision + 1,
    baseSnapshotRevision: stale.remoteDescriptor.snapshotRevision,
    removedBlockIds: tombstoneFields.removedBlockIds,
    minRetainedRevision: tombstoneFields.minRetainedRevision,
    wireDigest: stale.remoteDescriptor.digest,
  });
  const envelope = createFirestoreSnapshotEnvelope(merged, {
    retaFinalSync: descriptor,
    deviceId: getFirestoreDeviceId(),
    baseRemoteUpdatedAt: remoteUpdatedAt,
    payloadUpdatedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  });
  const envelopePlan = getRetaFinalPayloadPlan({
    planejamento: envelope.payload?.planejamento,
  });
  if (!envelopePlan || !sameJson(envelopePlan, remotePlan)) {
    return {
      status: "unsafe",
      reasonCode: "plan-rebase-mismatch",
      differences: envelopePlan
        ? compareRetaFinalPlanIntent(envelopePlan, remotePlan).differences
        : ["plano ausente"],
    };
  }
  const size = getFirestoreEnvelopeSizeBytes(envelope);
  if (size > FIRESTORE_ENVELOPE_MAX_BYTES) {
    return {
      status: "unsafe",
      reasonCode: "rebase-too-large",
      details: { sizeBytes: size, maxBytes: FIRESTORE_ENVELOPE_MAX_BYTES },
    };
  }
  const replaced = await replacePendingFirestoreSnapshotEnvelope(envelope, {
    queuedAt: pending.queuedAt ?? null,
    sentAt: pending.envelope?.sentAt ?? null,
  });
  if (!replaced) {
    return {
      status: "pending-changed",
      pending: await getPendingFirestoreSnapshot(),
    };
  }
  return {
    status: "rebased",
    pending: await getPendingFirestoreSnapshot(),
    mergedState: merged,
    localNonPlanAtRebase,
  };
}

function legacyAdoptionNextState(remote, force) {
  if (!force) return mergeLegacyAdoptionState(remote);
  // "Baixar dados" keeps replace semantics: the remote academic payload wins,
  // but the proven local v2 identity/revision stays on top of it.
  const replaced = applyEnvelopeToLocalState(remote, getConfig());
  replaced.planejamento = clonePlan(state.planejamento);
  return replaced;
}

function applyRetaFinalPull(remote, config, { force = false } = {}) {
  const localPlan = getRetaFinalPayloadPlan(state);
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remote?.payload?.planejamento,
  });
  const remoteHasDescriptor = Boolean(
    remote && Object.hasOwn(remote, "retaFinalSync"),
  );
  const remoteDescriptor = readRetaFinalSyncDescriptor(remote);
  rememberRemoteTombstones(config, remoteDescriptor);
  const localIdentity = pullLocalIdentity(localPlan);
  const localNonPlan = nonPlanStateDigest(state);
  const remoteNonPlan = nonPlanStateDigest(remote?.payload);

  if (!remotePlan && !localPlan && !remoteHasDescriptor)
    return { handled: false };
  if (remoteHasDescriptor && !remoteDescriptor) {
    return { handled: true, conflict: "invalid-remote-descriptor" };
  }
  if (remoteDescriptor && !remotePlan)
    return { handled: true, conflict: "invalid-remote-plan" };
  const rawRemotePlan = remote?.payload?.planejamento;
  if (
    !remotePlan &&
    localPlan &&
    localPlan.ativo === true &&
    !remoteHasDescriptor &&
    rawRemotePlan?.tipo === "reta_final"
  ) {
    const adoption = buildLegacyRetaFinalAdoption({
      legacyPlan: rawRemotePlan,
      localPlan,
    });
    if (adoption.status !== "equivalent") {
      return {
        handled: true,
        conflict:
          adoption.status === "mismatch"
            ? "legacy-plan-mismatch"
            : "invalid-remote-plan",
        legacyAdoptionStatus: adoption.status,
        differences: adoption.differences ?? adoption.reasons ?? [],
        localPlan,
        remotePlan: null,
      };
    }
    if (legacyAdoptionAlreadyRecorded(config, remote, adoption.plan)) {
      return { handled: true, applied: false };
    }
    return {
      handled: true,
      applied: true,
      legacyAdoption: true,
      basePlan: adoption.plan,
      localIdentity,
      nextState: legacyAdoptionNextState(remote, force),
    };
  }
  if (!remotePlan && localPlan)
    return { handled: true, conflict: "missing-remote-plan" };
  if (remotePlan && !localPlan)
    return { handled: true, conflict: "missing-local-plan" };
  if (remotePlan.planId !== localPlan.planId)
    return { handled: true, conflict: "lineage" };

  const localRetired = localPlan.ativo !== true;
  const remoteRetired = remotePlan.ativo !== true;
  if (localRetired !== remoteRetired) {
    return { handled: true, conflict: "retirement-mismatch" };
  }
  if (localRetired && remoteRetired) {
    if (remotePlan.revision < localPlan.revision)
      return { handled: true, applied: false };
    if (
      remotePlan.revision === localPlan.revision &&
      !compareRetaFinalPlanIntent(remotePlan, localPlan).equivalent
    ) {
      return { handled: true, conflict: "retired-digest-mismatch" };
    }
    if (remotePlan.revision === localPlan.revision) {
      if (localNonPlan === remoteNonPlan)
        return { handled: true, applied: false };
      return {
        handled: true,
        applied: true,
        nextState: mergeStudyStates(state, remote.payload || {}, {
          basePlan: localPlan,
        }),
        basePlan: remotePlan,
        localIdentity,
      };
    }
    return {
      handled: true,
      applied: true,
      nextState: mergeStudyStates(state, remote.payload || {}, {
        basePlan: localPlan,
      }),
      basePlan: remotePlan,
      localIdentity,
    };
  }

  if (force) {
    if (
      compareRetaFinalPlanIntent(localPlan, remotePlan).equivalent &&
      localNonPlan === remoteNonPlan
    ) {
      return { handled: true, applied: false };
    }
    return {
      handled: true,
      applied: true,
      nextState: applyEnvelopeToLocalState(remote, config),
      basePlan: remotePlan,
      localIdentity,
    };
  }

  const base = verifiedRetaFinalBase(config);
  if (!base) return { handled: true, conflict: "missing-base" };
  if (base.planId !== localPlan.planId || base.planId !== remotePlan.planId) {
    return { handled: true, conflict: "base-lineage" };
  }
  if (
    base.revision > localPlan.revision ||
    base.revision > remotePlan.revision
  ) {
    return { handled: true, conflict: "base-ahead" };
  }

  const localMatchesBase = compareRetaFinalPlanIntent(
    localPlan,
    base,
  ).equivalent;
  const remoteMatchesBase = compareRetaFinalPlanIntent(
    remotePlan,
    base,
  ).equivalent;
  const localMatchesRemote = compareRetaFinalPlanIntent(
    localPlan,
    remotePlan,
  ).equivalent;

  if (
    remoteDescriptor?.minRetainedRevision !== undefined &&
    base.revision < remoteDescriptor.minRetainedRevision
  ) {
    return {
      handled: true,
      conflict: "stale-base",
      basePlan: base,
      localPlan,
      remotePlan,
    };
  }

  if (localMatchesBase) {
    if (remoteMatchesBase && localNonPlan === remoteNonPlan) {
      return { handled: true, applied: false };
    }
    return {
      handled: true,
      applied: true,
      nextState: mergeStudyStates(state, remote.payload || {}, {
        basePlan: base,
      }),
      basePlan: remotePlan,
      localIdentity,
    };
  }

  if (localMatchesRemote) {
    if (localNonPlan === remoteNonPlan)
      return { handled: true, applied: false };
    const merged = mergeStudyStates(state, remote.payload || {}, {
      basePlan: base,
    });
    return {
      handled: true,
      applied: true,
      academicOnly: true,
      nextState: merged,
      basePlan: remotePlan,
      localIdentity,
    };
  }

  const merge = mergeRetaFinalPlans({
    basePlan: base,
    localPlan,
    remotePlan,
    events: state.eventos || [],
    catalog:
      Array.isArray(state.editais) && state.editais.length
        ? state.editais
        : null,
  });
  const proposedPlan = filterRemovedBlocks(
    merge.plan,
    allRemovedIds(config, remoteDescriptor),
  );
  return {
    handled: true,
    conflict: "merge-review",
    proposedPlan,
    mergeConflicts: merge.conflicts,
    mergeValid: merge.valid,
    basePlan: base,
    localPlan,
    remotePlan,
  };
}

function pullConflictDecision(outcome) {
  return {
    allowed: false,
    reason: outcome.conflict,
    conflict: {
      type: RETA_FINAL_CONFLICT,
      cause: outcome.conflict,
      proposedPlan: outcome.proposedPlan ?? null,
      basePlan: outcome.basePlan ?? null,
      localPlan: outcome.localPlan ?? null,
      remotePlan: outcome.remotePlan ?? null,
      mergeConflicts: outcome.mergeConflicts ?? null,
      mergeValid: outcome.mergeValid ?? null,
      legacyAdoptionStatus: outcome.legacyAdoptionStatus ?? null,
      differences: outcome.differences ?? null,
      ...(outcome.conflict === "legacy-plan-mismatch"
        ? { reason: LEGACY_PLAN_MISMATCH_REASON }
        : {}),
    },
  };
}

function emitNoopPullStatus(remote) {
  const localPlan = getRetaFinalPayloadPlan(state);
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remote?.payload?.planejamento,
  });
  const same =
    localPlan &&
    remotePlan &&
    compareRetaFinalPlanIntent(localPlan, remotePlan).equivalent;
  emitStatus(same ? "synced" : "idle", { reason: "noop" });
  return false;
}

/**
 * Persist the state that was written by a safe rebase. The remote already has
 * this merged academic content, so leaving the local copy behind would let the
 * next academic-only push delete it. If the user edited during the write, fall
 * back to the same LWW merge used by pulls instead of overwriting those edits.
 */
async function applyRebasedStateLocally(
  rebasedState,
  pending,
  syncConfig,
  expectedNonPlan,
) {
  if (!rebasedState) return false;
  const localPlan = clonePlan(state.planejamento);
  const unchanged =
    Boolean(expectedNonPlan) && nonPlanStateDigest(state) === expectedNonPlan;
  const next = unchanged
    ? rebasedState
    : mergeStudyStates(state, pending?.envelope?.payload || {}, {
        basePlan: syncConfig.basePlan,
      });
  setState(next, { merge: true });
  if (!state.config) state.config = {};
  // The remote plan is intent-equal; keep this device's projection (derived
  // dates/status) instead of flashing it back to the remote representation.
  if (localPlan) state.planejamento = localPlan;
  // Keep the live config object: flush mutates it after this point.
  state.config.firestoreSync = syncConfig;
  await saveStateToDB({
    skipCloudSync: true,
    skipFirestoreSync: true,
    skipDriveSync: true,
    touchLocalBackup: false,
  });
  return true;
}

async function applyPulledRetaFinalState(
  outcome,
  remote,
  uid,
  reason,
  options = {},
) {
  if (outcome?.applied !== true || !outcome.nextState) return false;
  const pending = await getPendingFirestoreSnapshot();
  if (pending && options.discardPending !== true) {
    await registerRetaFinalConflict(
      getConfig(),
      {
        allowed: false,
        reason: "pending-outbox",
        conflict: { type: RETA_FINAL_CONFLICT, cause: "pending-outbox" },
      },
      pending,
      remote,
    );
    return false;
  }
  if (outcome.localIdentity) {
    const currentPlan = getRetaFinalPayloadPlan(state);
    const currentDigest = currentPlan
      ? computeRetaFinalIntentDigest(currentPlan)
      : null;
    const backupAt = state.config?.localBackupAt ?? null;
    const currentNonPlan = nonPlanStateDigest(state);
    if (
      currentPlan?.revision !== outcome.localIdentity.revision ||
      currentDigest !== outcome.localIdentity.digest ||
      backupAt !== outcome.localIdentity.backupAt ||
      currentNonPlan !== outcome.localIdentity.nonPlanDigest
    ) {
      await registerRetaFinalConflict(
        getConfig(),
        {
          allowed: false,
          reason: "local-changed-during-pull",
          conflict: {
            type: RETA_FINAL_CONFLICT,
            cause: "local-changed-during-pull",
            localPlan: clonePlan(currentPlan),
            remotePlan: remote?.payload?.planejamento ?? null,
          },
        },
        pending,
        remote,
      );
      return false;
    }
  }
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  setState(outcome.nextState, { merge: true });
  const liveConfig = getConfig();
  setRetaFinalBaseFromRemote(liveConfig, remote, outcome.basePlan);
  await clearFirestoreConflict();
  const cleared = await markFirestoreSnapshotSynced(
    pending
      ? {
          queuedAt: pending.queuedAt ?? null,
          sentAt: pending.envelope?.sentAt ?? null,
        }
      : { queuedAt: null, sentAt: null },
  );
  if (!cleared) {
    liveConfig.hasPendingWrites = true;
    liveConfig.lastError = "Outbox recebeu uma nova gravacao durante o pull.";
    await persistSyncConfig(true);
    emitStatus("pending");
    return false;
  }
  const pullAt = new Date().toISOString();
  await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
  Object.assign(liveConfig, {
    uid,
    remoteUpdatedAt,
    lastPullAt: pullAt,
    hasPendingWrites: false,
    conflict: null,
    lastError: null,
  });
  await persistSyncConfig(true);
  await saveStateToDB({
    skipCloudSync: true,
    skipFirestoreSync: true,
    skipDriveSync: true,
    touchLocalBackup: false,
  });
  emitPrimaryStatus("synced", { source: reason, remoteUpdatedAt });
  emitStatus("synced");
  return true;
}

function emitStatus(status, detail = {}) {
  const config = getConfig();
  Object.assign(config, detail.config || {});
  const eventDetail = {
    status,
    uid: currentUser?.uid || config.uid || null,
    mode: config.mode,
    enabled: !!config.enabled,
    hasPendingWrites: !!config.hasPendingWrites,
    conflict: config.conflict || null,
    remoteUpdatedAt: config.remoteUpdatedAt || null,
    lastPullAt: config.lastPullAt || null,
    lastPushAt: config.lastPushAt || null,
    lastError: config.lastError || null,
    ...detail,
  };
  const signature = JSON.stringify({
    status: eventDetail.status,
    uid: eventDetail.uid,
    mode: eventDetail.mode,
    enabled: eventDetail.enabled,
    hasPendingWrites: eventDetail.hasPendingWrites,
    conflict: !!eventDetail.conflict,
    remoteUpdatedAt: eventDetail.remoteUpdatedAt,
    lastPullAt: eventDetail.lastPullAt,
    lastPushAt: eventDetail.lastPushAt,
    lastError: eventDetail.lastError,
    error: eventDetail.error || null,
  });
  if (signature === lastStatusSignature) return;
  lastStatusSignature = signature;
  document.dispatchEvent(
    new CustomEvent("app:firestoreSyncStatus", {
      detail: eventDetail,
    }),
  );
}

function emitPrimaryStatus(status, detail = {}) {
  document.dispatchEvent(
    new CustomEvent("app:primarySyncStatus", {
      detail: { status, ...detail },
    }),
  );
}

async function persistSyncConfig(skipRender = true) {
  await saveStateToDB({
    skipCloudSync: true,
    skipFirestoreSync: true,
    skipDriveSync: true,
    touchLocalBackup: false,
    skipSyncEvent: true,
  });
  if (!skipRender) emitPrimaryStatus("config-updated");
}

async function reconcileFirestorePendingState(skipRender = true) {
  const config = getConfig();
  let pending = await getPendingFirestoreSnapshot();
  if (pending) {
    pending = await repairPendingFirestoreSnapshot(pending, config);
  }

  // Clear stale conflicts when there is no pending snapshot to resolve.
  // Entity-level conflicts are already the conflict payload and must remain visible.
  if (
    config.conflict &&
    !isBlockingFirestoreConflict(config.conflict) &&
    !pending
  ) {
    config.conflict = null;
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(skipRender);
    emitStatus("synced");
  }

  // Entity-conflict with no pending snapshot: clear hasPendingWrites but keep conflict for UI resolution.
  if (
    isBlockingFirestoreConflict(config.conflict) &&
    !pending &&
    config.hasPendingWrites
  ) {
    config.hasPendingWrites = false;
    await persistSyncConfig(skipRender);
  }

  if (!pending && config.hasPendingWrites && !config.conflict) {
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(skipRender);
    emitStatus("synced");
  }

  // Stale pending snapshot: enqueued >60s ago with zero attempts and no conflict.
  // Clear it to prevent hasPendingWrites from being stuck forever.
  if (
    pending &&
    !pending.recomposedAt &&
    !config.conflict &&
    pending.attempts === 0 &&
    !Object.hasOwn(pending.envelope || {}, "retaFinalSync")
  ) {
    const queuedAge = Date.now() - new Date(pending.queuedAt).getTime();
    if (Number.isFinite(queuedAge) && queuedAge > 60000) {
      await markFirestoreSnapshotSynced();
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(skipRender);
      emitStatus("synced");
      return null;
    }
  }

  return pending;
}

function requestPrimarySync(reason) {
  document.dispatchEvent(
    new CustomEvent("app:primarySyncRequested", {
      detail: { reason },
    }),
  );
}

// --- Polling-based remote sync (replaces onSnapshot) ---

let pollingInterval = null;
const DEFAULT_POLL_INTERVAL_MS = 30000;

export async function pollFirestoreRemote() {
  const config = getConfig();
  if (!config.enabled || config.mode !== "primary" || !currentUser?.uid)
    return false;

  if (config.conflict) {
    const pending = await getPendingFirestoreSnapshot();
    if (pending) {
      // A repairable outbox conflict is re-evaluated by the normal flush; the
      // original operation is never discarded to make the poll proceed.
      if (isRecoverableRetaFinalConflict(config.conflict)) {
        return await flushFirestoreOutbox({ manual: false });
      }
      return false;
    }
    if (!isBlockingFirestoreConflict(config.conflict)) {
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(true);
      emitStatus("synced");
    } else if (!isRecoverableRetaFinalConflict(config.conflict)) {
      return false;
    }
  }

  try {
    const { db, uid } = requireSignedInServices();
    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) return false;

    const localPlan = getRetaFinalPayloadPlan(state);
    const remotePlan = getRetaFinalPayloadPlan({
      planejamento: remote?.payload?.planejamento,
    });
    const remoteHasDescriptor = Object.hasOwn(remote, "retaFinalSync");
    if (localPlan || remotePlan || remoteHasDescriptor) {
      const pending = await getPendingFirestoreSnapshot();
      if (pending) return false;
      if (localPlan && remotePlan && remotePlan.planId === localPlan.planId) {
        if (remotePlan.revision < localPlan.revision) return false;
      }
      const outcome = applyRetaFinalPull(remote, config, { force: false });
      if (!outcome.handled || outcome.conflict) {
        if (outcome.conflict) {
          await registerRetaFinalConflict(
            config,
            pullConflictDecision(outcome),
            null,
            remote,
          );
        }
        return false;
      }
      if (outcome.applied !== true) return false;
      await yieldToUIWithBudget(50, performance.now());
      return await applyPulledRetaFinalState(outcome, remote, uid, "poll");
    }

    if (!isRemoteStateNewer(remote, state)) return false;

    await yieldToUIWithBudget(50, performance.now());

    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
    const pullAt = new Date().toISOString();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: pullAt,
      hasPendingWrites: false,
      conflict: null,
      lastError: null,
    });
    await persistSyncConfig(true);
    // CRITICAL: saveStateToDB with skipFirestoreSync to prevent feedback loop
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
    });
    emitPrimaryStatus("synced", { source: "poll", remoteUpdatedAt });
    emitStatus("synced");
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }
}

export function startPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (pollingInterval) return;
  if (isGlobalSyncPaused(state.config)) return;
  pollFirestoreRemote().catch(() => {});
  pollingInterval = setInterval(() => {
    pollFirestoreRemote().catch(() => {});
  }, intervalMs);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// --- Primary sync status ---

export function getFirestoreSyncStatus() {
  let services;
  try {
    services = initFirebaseServices();
  } catch (err) {
    console.warn("getFirestoreSyncStatus: initFirebaseServices failed:", err);
    return {
      configured: false,
      projectId: "",
      authDomain: "",
      signedIn: false,
      uid: null,
      email: null,
      enabled: false,
      mode: "off",
      conflict: null,
      hasPendingWrites: false,
      lastError: err.message || String(err),
    };
  }
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

export async function downloadSyncDiagnosticLog() {
  // Import Cloudflare sync functions dynamically to avoid circular deps
  const { getSyncCreds, getSyncConfig } =
    await import("../cloud-sync.js?v=8.37");

  const log = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    syncStatus: getFirestoreSyncStatus(),
    pendingSnapshot: null,
    pendingError: null,
    localState: {
      eventCount: state.eventos?.length || 0,
      editalCount: state.editais?.length || 0,
      disciplinaCount: state.disciplinas?.length || 0,
      lastBackupAt: state.config?.localBackupAt || null,
      schemaVersion: state.schemaVersion || null,
    },
    syncHistory: state.config?.syncHealth?.events?.slice(-10) || [],
    performanceMetrics:
      state.config?.syncPerformance?.metrics?.slice(-10) || [],
    // Cloudflare sync data
    cloudflare: {
      configured: !!(state.config?.cfUrl && state.config?.cfTokenSaved),
      enabled: !!state.config?.cfSyncEnabled,
      url: state.config?.cfUrl || null,
      tokenSaved: !!state.config?.cfTokenSaved,
      lastSyncAt: state.config?.cfLastSyncAt || null,
      remoteUpdatedAt: state.config?.cfRemoteUpdatedAt || null,
      conflict: state.config?.cfConflict || null,
      lastError: state.config?.cfLastError || null,
    },
  };

  // Get Cloudflare credential store data
  try {
    const cfCreds = await getSyncCreds();
    log.cloudflare.credentialStore = {
      hasData: !!cfCreds,
      url: cfCreds?.url || null,
      hasToken: !!cfCreds?.token,
      enabled: cfCreds?.enabled || false,
    };
  } catch (err) {
    log.cloudflare.credentialStoreError = err.message || String(err);
  }

  // Get Cloudflare remote data
  try {
    const cfConfig = await getSyncConfig();
    log.cloudflare.remoteConfig = {
      hasConfig: !!cfConfig,
      url: cfConfig?.url || null,
      hasToken: !!cfConfig?.token,
    };
  } catch (err) {
    log.cloudflare.remoteConfigError = err.message || String(err);
  }

  try {
    log.pendingSnapshot = await getPendingFirestoreSnapshot();
  } catch (err) {
    log.pendingError = err.message || String(err);
  }

  const blob = new Blob([JSON.stringify(log, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sync-diagnostic-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return log;
}

export function initFirestoreSync() {
  const services = initFirebaseServices();
  const _config = getConfig();

  if (!services.configured) {
    emitStatus("unconfigured", { config: { lastError: null } });
    return;
  }

  reconcileFirestorePendingState(false).catch((err) => {
    console.warn("Firestore pending state repair failed:", err);
  });

  completeGoogleRedirectSignIn()
    .then(async (credential) => {
      if (!credential?.user) return;
      currentUser = credential.user;
      const syncConfig = getConfig();
      syncConfig.uid = credential.user.uid;
      syncConfig.lastError = null;
      await persistSyncConfig(false);
      emitStatus("signed-in", {
        config: { uid: credential.user.uid, lastError: null },
      });

      // Check and run entity migration if needed (one-time)
      try {
        const { db, uid } = requireSignedInServices();
        const migrationCheck = await checkEntityMigrationNeeded(db, uid);
        if (migrationCheck.needed) {
          debugLog(
            "sync",
            `Entity migration needed: ${migrationCheck.entityCount} entities found.`,
          );
          emitPrimaryStatus("migrating", {
            entityCount: migrationCheck.entityCount,
          });
          const report = await migrateEntitiesToSnapshot(db, uid, {
            onProgress: (msg) => debugLog("sync", `[Entity Migration] ${msg}`),
          });
          debugLog(
            "sync",
            "Entity migration complete:",
            JSON.stringify(report),
          );
          emitPrimaryStatus("migrated", report);
        }
      } catch (err) {
        console.warn(
          "Entity migration check failed (non-critical):",
          err.message,
        );
      }
    })
    .catch(async (err) => {
      const syncConfig = getConfig();
      syncConfig.lastError = err.message || String(err);
      await persistSyncConfig(false);
      emitStatus("error", { error: syncConfig.lastError });
    });

  if (authUnsubscribe) return;
  authUnsubscribe = observeFirebaseAuth((user) => {
    currentUser = user;
    const syncConfig = getConfig();
    syncConfig.uid = user?.uid || null;
    if (!user) {
      stopPolling();
      syncConfig.hasPendingWrites = false;
      emitStatus("signed-out");
      emitPrimaryStatus("signed-out");
      return;
    }
    emitStatus("signed-in", { config: { uid: user.uid, lastError: null } });
    reconcileFirestorePendingState(false).catch((err) => {
      console.warn("Firestore pending state repair failed:", err);
    });

    // Check and run entity migration if needed (one-time)
    try {
      const { db, uid } = requireSignedInServices();
      checkEntityMigrationNeeded(db, uid)
        .then(async (migrationCheck) => {
          if (!migrationCheck.needed) return;
          debugLog(
            "sync",
            `Entity migration needed: ${migrationCheck.entityCount} entities found.`,
          );
          emitPrimaryStatus("migrating", {
            entityCount: migrationCheck.entityCount,
          });
          const report = await migrateEntitiesToSnapshot(db, uid, {
            onProgress: (msg) => debugLog("sync", `[Entity Migration] ${msg}`),
          });
          debugLog(
            "sync",
            "Entity migration complete:",
            JSON.stringify(report),
          );
          emitPrimaryStatus("migrated", report);
        })
        .catch((err) => {
          console.warn(
            "Entity migration check failed (non-critical):",
            err.message,
          );
        });
    } catch (err) {
      console.warn(
        "Entity migration check failed (non-critical):",
        err.message,
      );
    }

    // Manual-only mode: no automatic polling. Login still emits status so the UI
    // can show "Conectado como ...", but the user must press Sync to push/pull.
    emitPrimaryStatus("signed-in", { uid: user.uid });
  });
}

export async function firestoreSignIn() {
  const credential = await signInWithGoogle();
  if (credential?.cancelled) {
    // Usuario fechou o popup: nenhuma navegacao aconteceu, entao a UI volta ao
    // estado desconectado em vez de ficar presa em "redirecionando".
    emitStatus("signed-out");
    return null;
  }
  if (!credential?.user) {
    emitStatus("redirecting");
    return null;
  }
  currentUser = credential.user;
  getConfig().uid = currentUser.uid;
  await persistSyncConfig(false);

  // Check and run entity migration if needed (one-time)
  try {
    const { db, uid } = requireSignedInServices();
    const migrationCheck = await checkEntityMigrationNeeded(db, uid);
    if (migrationCheck.needed) {
      debugLog(
        "sync",
        `Entity migration needed: ${migrationCheck.entityCount} entities found.`,
      );
      emitPrimaryStatus("migrating", {
        entityCount: migrationCheck.entityCount,
      });
      const report = await migrateEntitiesToSnapshot(db, uid, {
        onProgress: (msg) => debugLog("sync", `[Entity Migration] ${msg}`),
      });
      debugLog("sync", "Entity migration complete:", JSON.stringify(report));
      emitPrimaryStatus("migrated", report);
    }
  } catch (err) {
    console.warn("Entity migration check failed (non-critical):", err.message);
  }

  // Manual-only mode: no polling and no auto-push on sign-in. The user controls
  // when to sync via the manual button.
  return currentUser;
}

export async function firestoreSignOut() {
  await signOutFirebase();
  currentUser = null;
  stopPolling();
  const config = getConfig();
  config.uid = null;
  config.hasPendingWrites = false;
  await persistSyncConfig(false);
}

export async function enableFirestoreSync(mode = "shadow") {
  const config = getConfig();
  config.enabled = true;
  config.mode = mode === "primary" ? "primary" : "shadow";
  config.lastError = null;
  await persistSyncConfig(false);
  emitStatus("enabled");
  // Manual-only mode: no automatic polling or auto-push when activating.
  return true;
}

export async function disableFirestoreSync() {
  const config = getConfig();
  config.enabled = false;
  config.hasPendingWrites = false;
  config.lastError = null;
  stopPolling();
  await persistSyncConfig(false);
}

export async function queueFirestoreSnapshotFromState(
  sourceState = state,
  options = {},
) {
  const config = getConfig();
  if (!config.enabled) return false;
  const pending = await getPendingFirestoreSnapshot();
  if (isRetaFinalConflict(config.conflict)) {
    emitStatus("conflict-paused");
    return false;
  }
  if (!options.manual && !canAutoSyncFirestore(config, pending)) {
    emitStatus(config.conflict ? "conflict-paused" : "backoff");
    return false;
  }
  let envelopeOptions = options;
  const removedBefore = JSON.stringify(config.removedBlocks || []);
  try {
    envelopeOptions = retaFinalQueueOptions(config, sourceState, options);
    if (JSON.stringify(config.removedBlocks || []) !== removedBefore) {
      await persistSyncConfig(true);
    }
  } catch (err) {
    config.lastError = err.message || String(err);
    config.hasPendingWrites = Boolean(pending);
    if (
      err.code === "RETA_FINAL_LINEAGE_CHANGE" ||
      err.code === "RETA_FINAL_LINEAGE_UNKNOWN" ||
      err.code === "RETA_FINAL_LINEAGE_PAYLOAD"
    ) {
      const cause =
        err.code === "RETA_FINAL_LINEAGE_CHANGE"
          ? "lineage-change"
          : err.code === "RETA_FINAL_LINEAGE_PAYLOAD"
            ? "lineage-payload"
            : "lineage-unknown";
      const conflict = {
        type: RETA_FINAL_CONFLICT,
        cause,
        detectedAt: new Date().toISOString(),
        planId:
          getRetaFinalPayloadPlan(sourceState)?.planId ??
          config.basePlan?.planId ??
          null,
        localPlan: getRetaFinalPayloadPlan(sourceState),
        remotePlan: null,
        basePlan: clonePlan(config.basePlan),
        reason: err.message,
      };
      config.conflict = conflict;
      await saveFirestoreConflict(conflict);
      await persistSyncConfig(false);
      emitStatus("conflict", { conflict });
      return false;
    }
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
    return false;
  }
  const envelope = createFirestoreSnapshotEnvelope(
    sourceState,
    envelopeOptions,
  );
  const envelopeSize = getFirestoreEnvelopeSizeBytes(envelope);
  config.lastEnvelopeBytes = envelopeSize;
  if (envelopeSize > FIRESTORE_ENVELOPE_MAX_BYTES) {
    config.hasPendingWrites = Boolean(pending);
    config.lastError = envelopeTooLargeMessage(envelopeSize);
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
    return false;
  }
  // Never replace an operation from another snapshot lineage: its CAS counters
  // belong to a write that was never confirmed. Same-slot updates coalesce and
  // keep queuedAt/attempts instead of resetting the pending operation.
  const nextDescriptor = readRetaFinalSyncDescriptor(envelope);
  const pendingDescriptor = readRetaFinalSyncDescriptor(pending?.envelope);
  if (
    pending &&
    nextDescriptor &&
    pendingDescriptor &&
    !sameOutboxSnapshotLineage(pendingDescriptor, nextDescriptor)
  ) {
    config.hasPendingWrites = true;
    config.lastError =
      "Outbox pendente pertence a outra revisao de snapshot; sincronize a operacao existente antes de enfileirar.";
    await persistSyncConfig(true);
    emitStatus("pending", { reason: "outbox-lineage-changed" });
    return false;
  }
  const queued = await enqueueFirestoreSnapshot(envelope, {
    expected: {
      queuedAt: pending?.queuedAt ?? null,
      sentAt: pending?.envelope?.sentAt ?? null,
    },
    academicOnly: Boolean(envelopeOptions.planOverride),
  });
  if (queued) {
    config.hasPendingWrites = true;
    config.lastError = null;
    emitStatus("pending");
  } else {
    const stillPending = await getPendingFirestoreSnapshot();
    config.hasPendingWrites = Boolean(stillPending);
    config.lastError = pending || stillPending
      ? "A outbox pendente mudou durante o enfileiramento; nada foi sobrescrito. Sincronize novamente."
      : "Armazenamento local do Firestore indisponível. Recarregue a página para migrar o banco local.";
    if (stillPending) emitStatus("pending", { reason: "outbox-changed" });
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
  }
  return queued;
}

function requireSignedInServices() {
  const services = initFirebaseServices();
  if (!services.configured) throw new Error("Firebase nao configurado.");
  if (!currentUser)
    throw new Error("Entre com Google antes de sincronizar com Firestore.");
  return { db: services.db, uid: currentUser.uid };
}

async function registerConflict(remoteEnvelope, localEnvelope) {
  const config = getConfig();
  config.conflict = {
    detectedAt: new Date().toISOString(),
    remoteUpdatedAt: getEnvelopeUpdatedAt(remoteEnvelope),
  };
  config.lastError = "Conflito Firestore: remoto mudou antes do envio local.";
  await persistSyncConfig(false);
  emitStatus("conflict", { conflict: config.conflict });
}

export async function autoPullRemoteWhenNewer() {
  const config = getConfig();
  if (!config.enabled || config.mode !== "primary") return false;

  // Auto-clear stale conflicts
  if (config.conflict) {
    const pending = await getPendingFirestoreSnapshot();
    if (pending) {
      if (isRecoverableRetaFinalConflict(config.conflict)) {
        return await flushFirestoreOutbox({ manual: false });
      }
      return false;
    }
    if (!isBlockingFirestoreConflict(config.conflict)) {
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(true);
      emitStatus("synced");
    } else if (!isRecoverableRetaFinalConflict(config.conflict)) {
      return false;
    }
  }

  const pending = await getPendingFirestoreSnapshot();
  if (pending) return false;

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) return false;

    const localPlan = getRetaFinalPayloadPlan(state);
    const remotePlan = getRetaFinalPayloadPlan({
      planejamento: remote?.payload?.planejamento,
    });
    const remoteHasDescriptor = Object.hasOwn(remote, "retaFinalSync");
    if (localPlan || remotePlan || remoteHasDescriptor) {
      if (localPlan && remotePlan && remotePlan.planId === localPlan.planId) {
        if (remotePlan.revision < localPlan.revision) return false;
      }
      const outcome = applyRetaFinalPull(remote, config, { force: false });
      if (!outcome.handled || outcome.conflict) {
        if (outcome.conflict) {
          await registerRetaFinalConflict(
            config,
            pullConflictDecision(outcome),
            null,
            remote,
          );
        }
        return false;
      }
      if (outcome.applied !== true) return false;
      await yieldToUIWithBudget(50, performance.now());
      return await applyPulledRetaFinalState(outcome, remote, uid, "auto-pull");
    }

    if (!isRemoteStateNewer(remote, state)) return false;

    await yieldToUIWithBudget(50, performance.now());

    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
    const pullAt = new Date().toISOString();
    await saveFirestoreMeta({ uid, remoteUpdatedAt, lastPullAt: pullAt });
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: pullAt,
      hasPendingWrites: false,
      conflict: null,
      lastError: null,
    });
    await persistSyncConfig(true);
    emitPrimaryStatus("synced", { source: "auto-pull", remoteUpdatedAt });
    emitStatus("synced");
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }
}

async function flushFirestoreOutboxUnlocked(options = {}) {
  const config = getConfig();
  if (!config.enabled) return false;

  const startTime = performance.now();

  let pending = await getPendingFirestoreSnapshot();
  if (
    !options.manual &&
    !options.forceOverwrite &&
    !canAutoSyncFirestore(config, pending)
  ) {
    emitStatus(config.conflict ? "conflict-paused" : "backoff");
    return false;
  }

  emitStatus("syncing");
  if (pending) {
    pending = await repairPendingFirestoreSnapshot(pending, config);
  }
  if (!pending) {
    config.hasPendingWrites = false;
    await persistSyncConfig(true);
    emitStatus("synced");
    return true;
  }

  const envelopeSize = getFirestoreEnvelopeSizeBytes(pending.envelope);
  config.lastEnvelopeBytes = envelopeSize;
  if (
    pendingEnvelopeHasOperationalHistory(pending) ||
    envelopeSize > FIRESTORE_ENVELOPE_MAX_BYTES
  ) {
    config.lastError = envelopeTooLargeMessage(envelopeSize);
    config.hasPendingWrites = true;
    await markFirestoreSnapshotFailed(new Error(config.lastError));
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }

  const descriptorPresent = Object.hasOwn(
    pending.envelope || {},
    "retaFinalSync",
  );
  let descriptor = readRetaFinalSyncDescriptor(pending.envelope);
  if (descriptorPresent && !descriptor) {
    config.lastError = "Descriptor Reta Final invalido; envio bloqueado.";
    config.hasPendingWrites = true;
    await markFirestoreSnapshotFailed(new Error(config.lastError));
    await persistSyncConfig(true);
    emitStatus("blocked-guard", {
      reason: "invalid-descriptor",
      error: config.lastError,
    });
    return false;
  }
  if (descriptor) {
    const sentPlan = getRetaFinalPayloadPlan({
      planejamento: pending.envelope?.payload?.planejamento,
    });
    if (sentPlan && sentPlan.planId !== descriptor.planId) {
      await registerRetaFinalConflict(
        config,
        {
          allowed: false,
          reason: "lineage-payload",
          conflict: { type: RETA_FINAL_CONFLICT, cause: "lineage-payload" },
        },
        pending,
        null,
      );
      await markFirestoreSnapshotFailed(new Error("lineage-payload"));
      return false;
    }
    const baseRevisionForFloor = Number.isSafeInteger(config.baseRevision)
      ? config.baseRevision
      : descriptor.baseRevision;
    if (
      Number.isSafeInteger(config.minRetainedRevision) &&
      baseRevisionForFloor < config.minRetainedRevision
    ) {
      await registerRetaFinalConflict(
        config,
        {
          allowed: false,
          reason: "stale-base",
          conflict: { type: RETA_FINAL_CONFLICT, cause: "stale-base" },
        },
        pending,
        null,
      );
      await markFirestoreSnapshotFailed(new Error("stale-base"));
      return false;
    }
    if (descriptorPayloadStructureMismatch(pending, descriptor)) {
      config.lastError =
        "Envelope Reta Final nao corresponde ao plano local enviado.";
      config.hasPendingWrites = true;
      await markFirestoreSnapshotFailed(new Error(config.lastError));
      await persistSyncConfig(true);
      emitStatus("blocked-guard", {
        reason: "descriptor-mismatch",
        error: config.lastError,
      });
      return false;
    }
  }

  let db;
  let uid;
  try {
    ({ db, uid } = requireSignedInServices());
  } catch (err) {
    config.lastError = err.message || String(err);
    await markFirestoreSnapshotFailed(err);
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }

  if (descriptor) {
    const guard = await probeRetaFinalGuard(db, uid, descriptor);
    if (!guard.verified) {
      config.lastError = `blocked-guard: ${guard.reason}`;
      config.hasPendingWrites = true;
      await markFirestoreSnapshotFailed(new Error(config.lastError));
      await persistSyncConfig(true);
      emitStatus("blocked-guard", {
        reason: guard.reason,
        error: config.lastError,
      });
      return false;
    }
  }

  let remote = null;
  try {
    remote = await readFirestoreSnapshot(db, uid);
  } catch (err) {
    config.lastError = err.message || String(err);
    await markFirestoreSnapshotFailed(err);
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }

  // A repaired rebase must also update the local state; otherwise the next
  // academic-only push could drop the data that was just merged remotely.
  let rebasedState = null;
  let rebasedNonPlan = null;
  if (descriptor) {
    if (descriptorPayloadMismatch(pending, descriptor, remote)) {
      config.lastError =
        "Envelope Reta Final nao corresponde ao plano local enviado.";
      config.hasPendingWrites = true;
      await markFirestoreSnapshotFailed(new Error(config.lastError));
      await persistSyncConfig(true);
      emitStatus("blocked-guard", {
        reason: "descriptor-mismatch",
        error: config.lastError,
      });
      return false;
    }
    let decision = validateRetaFinalEnvelopeWrite({
      envelope: pending.envelope,
      remoteEnvelope: remote,
    });
    if (!decision.allowed && RECOVERABLE_RETA_FINAL_REASONS.has(decision.reason)) {
      const recovery = await recoverStaleAdoptionOutbox(
        pending,
        remote,
        config,
      );
      if (recovery.status === "already-applied") {
        return await acknowledgeAlreadyAppliedOutbox(
          pending,
          remote,
          uid,
          config,
        );
      }
      if (
        recovery.status === "rebased" ||
        recovery.status === "pending-changed"
      ) {
        pending = recovery.pending;
        if (recovery.status === "rebased" && recovery.mergedState) {
          rebasedState = recovery.mergedState;
          rebasedNonPlan = recovery.localNonPlanAtRebase ?? null;
        }
        if (!pending) {
          config.hasPendingWrites = false;
          await persistSyncConfig(true);
          emitStatus("synced");
          return true;
        }
        descriptor = readRetaFinalSyncDescriptor(pending.envelope);
        if (!descriptor) {
          config.lastError = "Descriptor Reta Final invalido; envio bloqueado.";
          config.hasPendingWrites = true;
          await markFirestoreSnapshotFailed(new Error(config.lastError));
          await persistSyncConfig(true);
          emitStatus("blocked-guard", {
            reason: "invalid-descriptor",
            error: config.lastError,
          });
          return false;
        }
        const rebasedPlan = getRetaFinalPayloadPlan({
          planejamento: pending.envelope?.payload?.planejamento,
        });
        if (rebasedPlan && rebasedPlan.planId !== descriptor.planId) {
          await registerRetaFinalConflict(
            config,
            {
              allowed: false,
              reason: "lineage-payload",
              conflict: { type: RETA_FINAL_CONFLICT, cause: "lineage-payload" },
            },
            pending,
            remote,
          );
          await markFirestoreSnapshotFailed(new Error("lineage-payload"));
          return false;
        }
        if (descriptorPayloadMismatch(pending, descriptor, remote)) {
          config.lastError =
            "Envelope Reta Final nao corresponde ao plano local enviado.";
          config.hasPendingWrites = true;
          await markFirestoreSnapshotFailed(new Error(config.lastError));
          await persistSyncConfig(true);
          emitStatus("blocked-guard", {
            reason: "descriptor-mismatch",
            error: config.lastError,
          });
          return false;
        }
        decision = validateRetaFinalEnvelopeWrite({
          envelope: pending.envelope,
          remoteEnvelope: remote,
        });
      } else if (recovery.status === "unsafe") {
        await registerRetaFinalConflict(
          config,
          {
            allowed: false,
            reason: recovery.reasonCode,
            conflict: {
              type: RETA_FINAL_CONFLICT,
              cause: "outbox-rebase-unsafe",
              subcause: recovery.reasonCode,
              reason: recoveryConflictReason(recovery),
              differences: recovery.differences ?? null,
              details: recovery.details ?? null,
            },
          },
          pending,
          remote,
        );
        await markFirestoreSnapshotFailed(new Error("outbox-rebase-unsafe"));
        return false;
      }
    }
    if (!decision.allowed) {
      return await registerRetaFinalConflict(config, decision, pending, remote);
    }
    const legacyWrite = assessLegacyRetaFinalWrite({
      plan: getRetaFinalPayloadPlan({
        planejamento: pending.envelope?.payload?.planejamento,
      }),
      remoteEnvelope: remote,
    });
    if (!legacyWrite.allowed) {
      const cause =
        legacyWrite.reason === "ambiguous-v2-remote"
          ? "invalid-remote-plan"
          : "legacy-plan-mismatch";
      await registerRetaFinalConflict(
        config,
        {
          allowed: false,
          reason: legacyWrite.reason,
          conflict: {
            type: RETA_FINAL_CONFLICT,
            cause,
            differences: legacyWrite.differences ?? null,
            ...(cause === "legacy-plan-mismatch"
              ? { reason: LEGACY_PLAN_MISMATCH_REASON }
              : {}),
          },
        },
        pending,
        remote,
      );
      await markFirestoreSnapshotFailed(new Error(cause));
      return false;
    }
    // Guard/CAS: the rules compare snapshotRevision server-side, but a remote
    // write that landed between the read and this point must not burn a failed
    // write nor overwrite newer academic data. Re-read and revalidate.
    let fresh = null;
    try {
      fresh = await readFirestoreSnapshot(db, uid);
    } catch {
      fresh = null;
    }
    if (
      fresh &&
      (getEnvelopeUpdatedAt(fresh) !== getEnvelopeUpdatedAt(remote) ||
        (readRetaFinalSyncDescriptor(fresh)?.snapshotRevision ?? null) !==
          (readRetaFinalSyncDescriptor(remote)?.snapshotRevision ?? null))
    ) {
      const freshDecision = validateRetaFinalEnvelopeWrite({
        envelope: pending.envelope,
        remoteEnvelope: fresh,
      });
      if (!freshDecision.allowed) {
        await registerRetaFinalConflict(
          config,
          {
            allowed: false,
            reason: "remote-changed-during-recovery",
            conflict: {
              type: RETA_FINAL_CONFLICT,
              cause: "remote-changed-during-recovery",
              reason:
                "O documento remoto mudou durante a recuperacao; nada foi gravado. A outbox original foi preservada e a proxima sincronizacao reavalia.",
            },
          },
          pending,
          fresh,
        );
        await markFirestoreSnapshotFailed(
          new Error("remote-changed-during-recovery"),
        );
        return false;
      }
      remote = fresh;
    }
  } else if (
    remote &&
    (Object.hasOwn(remote, "retaFinalSync") ||
      getRetaFinalPayloadPlan({ planejamento: remote?.payload?.planejamento }) ||
      isRetaFinalPlanShape(remote?.payload?.planejamento))
  ) {
    return await registerRetaFinalConflict(
      config,
      {
        allowed: false,
        reason: "legacy-write",
        conflict: { type: RETA_FINAL_CONFLICT, cause: "legacy-write" },
      },
      pending,
      remote,
    );
  } else if (
    remote &&
    !options.forceOverwrite &&
    pending.envelope.baseRemoteUpdatedAt !== getEnvelopeUpdatedAt(remote)
  ) {
    const remoteDeviceId = remote.deviceId || null;
    const localDeviceId = getFirestoreDeviceId();

    if (remoteDeviceId && remoteDeviceId !== localDeviceId) {
      await registerConflict(remote, pending.envelope);
      return false;
    }

    pending.envelope.baseRemoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  }

  await yieldToUIWithBudget(50, startTime);

  let result;
  try {
    result = await writeFirestoreSnapshot(db, uid, pending.envelope);
  } catch (err) {
    console.error("[Sync] writeFirestoreSnapshot failed:", err.message);
    if (descriptor) {
      const classification = classifyRetaFinalRemoteError(err);
      if (
        classification.type === "permission-denied" ||
        classification.type === "conflict"
      ) {
        await registerRetaFinalConflict(
          config,
          {
            allowed: false,
            reason: classification.type,
            conflict: { type: RETA_FINAL_CONFLICT, cause: classification.type },
          },
          pending,
          remote,
          err,
        );
        await markFirestoreSnapshotFailed(err);
        return false;
      }
    }
    config.lastError = err.message || String(err);
    await markFirestoreSnapshotFailed(err);
    await persistSyncConfig(true);
    emitStatus("error", { error: config.lastError });
    return false;
  }

  if (descriptor) {
    const sentPlan = getRetaFinalPayloadPlan({
      planejamento: pending.envelope?.payload?.planejamento,
    });
    const basePlan = clonePlan(sentPlan) ||
      clonePlan(config.basePlan) || {
        ativo: false,
        tipo: "reta_final",
        schemaVersionRetaFinal: 2,
        planId: descriptor.planId,
        revision: descriptor.revision,
      };
    Object.assign(config, {
      basePlan,
      baseRevision: descriptor.revision,
      baseDigest: sentPlan
        ? computeRetaFinalPlanDigest(sentPlan)
        : descriptor.digest,
      baseRemoteDigest: descriptor.digest,
      baseRemovedBlockIds: Array.isArray(descriptor.removedBlockIds)
        ? [...descriptor.removedBlockIds]
        : null,
      baseMinRetainedRevision: Object.hasOwn(
        descriptor,
        "minRetainedRevision",
      )
        ? descriptor.minRetainedRevision
        : null,
      snapshotRevision: descriptor.snapshotRevision,
      baseRemoteUpdatedAt: result.updatedAt,
      baseUpdatedAt: new Date().toISOString(),
      remoteUpdatedAt: result.updatedAt,
    });
    try {
      await persistSyncConfig(true);
    } catch (err) {
      config.lastError = err.message || String(err);
      await markFirestoreSnapshotFailed(err);
      emitStatus("error", { error: config.lastError });
      return false;
    }
  }

  const cleared = await markFirestoreSnapshotSynced({
    queuedAt: pending.queuedAt ?? null,
    sentAt: pending.envelope?.sentAt ?? null,
  });
  if (!cleared) {
    const stillPending = await getPendingFirestoreSnapshot();
    config.hasPendingWrites = Boolean(stillPending);
    config.lastError = null;
    await persistSyncConfig(true);
    emitStatus(stillPending ? "pending" : "synced");
    return !stillPending;
  }
  if (rebasedState) {
    try {
      await applyRebasedStateLocally(
        rebasedState,
        pending,
        config,
        rebasedNonPlan,
      );
    } catch (err) {
      config.lastError =
        "Dados remotos mesclados, mas a gravacao local falhou: " +
        (err.message || String(err));
    }
  }
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
  await persistSyncConfig(false);
  // Manual-only mode: do not start polling after a successful push.
  emitStatus("synced");
  return true;
}

export async function flushFirestoreOutbox(options = {}) {
  return firestoreLock.withLock(() => flushFirestoreOutboxUnlocked(options));
}

export async function pullFromFirestore(forceOverwrite = false, options = {}) {
  const config = getConfig();
  if (!config.enabled && !forceOverwrite) return false;
  emitStatus("syncing");

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      const queued = await queueFirestoreSnapshotFromState(state, {
        manual: true,
      });
      if (!queued) return false;
      return await flushFirestoreOutbox({ manual: true });
    }

    const pending = await getPendingFirestoreSnapshot();
    if (pending && (!forceOverwrite || options.discardPending !== true)) {
      await registerRetaFinalConflict(
        config,
        {
          allowed: false,
          reason: "pending-outbox",
          conflict: { type: RETA_FINAL_CONFLICT, cause: "pending-outbox" },
        },
        pending,
        remote,
      );
      return false;
    }

    const localPlan = getRetaFinalPayloadPlan(state);
    const remotePlan = getRetaFinalPayloadPlan({
      planejamento: remote?.payload?.planejamento,
    });
    const remoteHasDescriptor = Object.hasOwn(remote, "retaFinalSync");
    if (localPlan || remotePlan || remoteHasDescriptor) {
      const outcome = applyRetaFinalPull(remote, config, {
        force: forceOverwrite,
      });
      if (!outcome.handled || outcome.conflict) {
        if (outcome.conflict) {
          await registerRetaFinalConflict(
            config,
            pullConflictDecision(outcome),
            pending,
            remote,
          );
        }
        return false;
      }
      if (outcome.applied !== true) {
        if (forceOverwrite && options.discardPending === true && pending) {
          const cleared = await markFirestoreSnapshotSynced({
            queuedAt: pending.queuedAt ?? null,
            sentAt: pending.envelope?.sentAt ?? null,
          });
          if (!cleared) {
            emitStatus("pending");
            return false;
          }
          await clearFirestoreConflict();
          config.conflict = null;
          config.hasPendingWrites = false;
          config.lastError = null;
          await persistSyncConfig(true);
          const localAfter = getRetaFinalPayloadPlan(state);
          const remoteAfter = getRetaFinalPayloadPlan({
            planejamento: remote?.payload?.planejamento,
          });
          const sameAfter =
            localAfter &&
            remoteAfter &&
            computeRetaFinalPlanDigest(localAfter) ===
              computeRetaFinalPlanDigest(remoteAfter);
          emitNoopPullStatus(remote);
          return Boolean(sameAfter);
        }
        return emitNoopPullStatus(remote);
      }
      await yieldToUIWithBudget(50, performance.now());
      if (!forceOverwrite) {
        return await applyPulledRetaFinalState(outcome, remote, uid, "pull", {
          discardPending: options.discardPending === true,
        });
      }

      const preservedCfUrl = state.config?.cfUrl || null;
      const preservedCfToken = state.config?.cfToken || null;
      const preservedCfSyncEnabled = state.config?.cfSyncEnabled === true;
      const preservedFirestoreSync = state.config?.firestoreSync || null;
      const preservedManualSyncHistory =
        state.config?.manualSyncHistory ?? null;
      const preservedLastManualSyncResults =
        state.config?.lastManualSyncResults ?? null;
      setState(outcome.nextState);
      if (state.config) {
        if (preservedCfUrl) state.config.cfUrl = preservedCfUrl;
        if (preservedCfToken) state.config.cfToken = preservedCfToken;
        state.config.cfSyncEnabled = preservedCfSyncEnabled;
        if (preservedFirestoreSync)
          state.config.firestoreSync = preservedFirestoreSync;
        if (preservedManualSyncHistory !== null)
          state.config.manualSyncHistory = preservedManualSyncHistory;
        if (preservedLastManualSyncResults !== null)
          state.config.lastManualSyncResults = preservedLastManualSyncResults;
      }
      const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
      if (Object.hasOwn(remote, "retaFinalSync") || outcome.basePlan) {
        setRetaFinalBaseFromRemote(
          config,
          remote,
          outcome.basePlan ?? remotePlan,
        );
      } else {
        Object.assign(config, {
          basePlan: null,
          baseRevision: null,
          baseDigest: null,
          baseRemoteUpdatedAt: remoteUpdatedAt,
        });
      }
      await clearFirestoreConflict();
      const cleared = await markFirestoreSnapshotSynced(
        pending
          ? {
              queuedAt: pending.queuedAt ?? null,
              sentAt: pending.envelope?.sentAt ?? null,
            }
          : { queuedAt: null, sentAt: null },
      );
      if (!cleared) {
        const stillPending = await getPendingFirestoreSnapshot();
        config.hasPendingWrites = Boolean(stillPending);
        config.lastError = null;
        await persistSyncConfig(true);
        emitStatus(stillPending ? "pending" : "synced");
        return !stillPending;
      }
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt,
        lastPullAt: new Date().toISOString(),
      });
      Object.assign(config, {
        uid,
        remoteUpdatedAt,
        lastPullAt: new Date().toISOString(),
        hasPendingWrites: false,
        conflict: null,
        lastError: null,
      });
      await persistSyncConfig(true);
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitPrimaryStatus("remote-applied", { remoteUpdatedAt });
      emitStatus("synced");
      return true;
    }

    if (forceOverwrite || isRemoteNewer(remote, state)) {
      await yieldToUIWithBudget(50, performance.now());
      const nextState = applyEnvelopeToLocalState(remote, config);
      // CRITICAL: with forceOverwrite the user explicitly wants to REPLACE
      // local data with remote (e.g. via "Baixar dados" or restore preview).
      // setState(merge: true) merges arrays by id and preserves local-only
      // items — that's wrong for overwrite semantics because items deleted
      // locally would survive. Force a full replace; preserve sync-related
      // creds/metadata that must not come from a remote payload.
      if (forceOverwrite) {
        const preservedCfUrl = state.config?.cfUrl || null;
        const preservedCfToken = state.config?.cfToken || null;
        const preservedCfSyncEnabled = state.config?.cfSyncEnabled === true;
        const preservedFirestoreSync = state.config?.firestoreSync || null;
        const preservedManualSyncHistory =
          state.config?.manualSyncHistory ?? null;
        const preservedLastManualSyncResults =
          state.config?.lastManualSyncResults ?? null;
        setState(nextState);
        if (state.config) {
          if (preservedCfUrl) state.config.cfUrl = preservedCfUrl;
          if (preservedCfToken) state.config.cfToken = preservedCfToken;
          state.config.cfSyncEnabled = preservedCfSyncEnabled;
          if (preservedFirestoreSync)
            state.config.firestoreSync = preservedFirestoreSync;
          if (preservedManualSyncHistory !== null)
            state.config.manualSyncHistory = preservedManualSyncHistory;
          if (preservedLastManualSyncResults !== null)
            state.config.lastManualSyncResults = preservedLastManualSyncResults;
        }
      } else {
        setState(nextState, { merge: true });
      }
      await clearFirestoreConflict();
      const cleared = await markFirestoreSnapshotSynced(
        pending
          ? {
              queuedAt: pending.queuedAt ?? null,
              sentAt: pending.envelope?.sentAt ?? null,
            }
          : { queuedAt: null, sentAt: null },
      );
      if (!cleared) {
        const stillPending = await getPendingFirestoreSnapshot();
        config.hasPendingWrites = Boolean(stillPending);
        config.lastError = null;
        await persistSyncConfig(true);
        emitStatus(stillPending ? "pending" : "synced");
        return !stillPending;
      }
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        lastPullAt: new Date().toISOString(),
      });
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitPrimaryStatus("remote-applied", {
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
      });
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
    emitStatus("synced");
    return true;
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
    return false;
  }
}

export async function previewFirestoreRestore() {
  const { db, uid } = requireSignedInServices();

  const remote = await readFirestoreSnapshot(db, uid);
  if (!remote) return null;
  return applyEnvelopeToLocalState(remote, getConfig());
}

export async function forcePushFirestore() {
  // "Enviar local" must not replace an unconfirmed operation: repair it first.
  if (await getPendingFirestoreSnapshot()) {
    await flushFirestoreOutbox({ manual: true, forceOverwrite: true });
    if (await getPendingFirestoreSnapshot()) return false;
  }
  const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
  if (!queued) return false;
  return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
}

async function syncFirestoreNowUnlocked() {
  const config = getConfig();

  await reconcileFirestorePendingState(true);

  // A stale adoption outbox can leave a persisted conflict. The normal sync
  // path must repair it; force buttons are not required.
  if (isRecoverableRetaFinalConflict(config.conflict)) {
    const pending = await getPendingFirestoreSnapshot();
    if (pending) {
      // Flush the operation that was never confirmed. Replacing it with a new
      // envelope would lose its identity and its CAS counters.
      return await flushFirestoreOutboxUnlocked({ manual: true });
    }
    config.conflict = null;
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(true);
  }

  // Never overwrite a pending operation with a freshly queued one. Flush it
  // first; if it survives, stop and let the caller retry the repair.
  if (await getPendingFirestoreSnapshot()) {
    await flushFirestoreOutboxUnlocked({ manual: true });
    if (await getPendingFirestoreSnapshot()) return false;
  }

  // Force-clear stale conflicts on manual sync (user-initiated resolution)
  if (config.conflict) {
    if (
      isRetaFinalConflict(config.conflict) &&
      !isRecoverableRetaFinalConflict(config.conflict)
    ) {
      emitStatus("conflict-paused", { conflict: config.conflict });
      return false;
    }
    if (!isRetaFinalConflict(config.conflict)) {
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await persistSyncConfig(true);
    }
  }

  const { db, uid } = requireSignedInServices();
  const remote = await readFirestoreSnapshot(db, uid);
  const remoteUpdatedAt = getEnvelopeUpdatedAt(remote);
  const pending = await getPendingFirestoreSnapshot();

  const localPlan = getRetaFinalPayloadPlan(state);
  const remotePlan = getRetaFinalPayloadPlan({
    planejamento: remote?.payload?.planejamento,
  });
  const remoteHasDescriptor = Boolean(
    remote && Object.hasOwn(remote, "retaFinalSync"),
  );
  let retaFinalPullHandled = false;
  if ((localPlan || remotePlan || remoteHasDescriptor) && !pending) {
    const outcome = applyRetaFinalPull(remote, config, { force: false });
    if (!outcome.handled || outcome.conflict) {
      if (outcome.conflict) {
        await registerRetaFinalConflict(
          config,
          pullConflictDecision(outcome),
          null,
          remote,
        );
      }
      return false;
    }
    if (outcome.applied !== true) return emitNoopPullStatus(remote);
    retaFinalPullHandled = true;
    await yieldToUIWithBudget(50, performance.now());
    if (
      !(await applyPulledRetaFinalState(outcome, remote, uid, "sync-now-pull"))
    ) {
      return false;
    }
    const mergedPlan = getRetaFinalPayloadPlan(state);
    if (
      mergedPlan &&
      remotePlan &&
      compareRetaFinalPlanIntent(mergedPlan, remotePlan).equivalent &&
      nonPlanStateDigest(state) === nonPlanStateDigest(remote.payload)
    ) {
      return true;
    }
  }

  // Skip conflict check for manual sync - force push instead
  // The user explicitly wants to sync, so we trust their intent
  if (
    !retaFinalPullHandled &&
    remote &&
    !pending &&
    isRemoteNewer(remote, state)
  ) {
    await yieldToUIWithBudget(50, performance.now());
    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    await saveFirestoreMeta({
      uid,
      remoteUpdatedAt,
      lastPullAt: new Date().toISOString(),
    });
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
    });
    // CRITICAL: clear hasPendingWrites since we pulled instead of pushing
    // and there is no pending snapshot in the outbox
    config.hasPendingWrites = false;
    config.conflict = null;
    config.lastError = null;
    await persistSyncConfig(true);
    emitPrimaryStatus("synced", { source: "sync-now-pull", remoteUpdatedAt });
    emitStatus("synced");
    return true;
  }

  if (remoteUpdatedAt) {
    Object.assign(config, {
      uid,
      remoteUpdatedAt,
      lastPullAt: new Date().toISOString(),
      lastError: null,
    });
    await saveFirestoreMeta({
      uid,
      remoteUpdatedAt,
      lastPullAt: config.lastPullAt,
    });
    await persistSyncConfig(true);
  }

  const queued = await queueFirestoreSnapshotFromState(state, {
    manual: true,
    baseRemoteUpdatedAt: remoteUpdatedAt || config.remoteUpdatedAt || null,
  });
  if (!queued) return false;
  // Force overwrite on manual sync to bypass stale conflict checks
  return await flushFirestoreOutboxUnlocked({
    manual: true,
    forceOverwrite: true,
  });
}

export async function syncFirestoreNow() {
  return firestoreLock.withLock(() => syncFirestoreNowUnlocked());
}

export async function mergeFromFirestore() {
  const config = getConfig();
  emitStatus("syncing");

  try {
    const { db, uid } = requireSignedInServices();

    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      return await forcePushFirestore();
    }

    const localPlan = getRetaFinalPayloadPlan(state);
    const remotePlan = getRetaFinalPayloadPlan({
      planejamento: remote?.payload?.planejamento,
    });
    const remoteHasDescriptor = Object.hasOwn(remote, "retaFinalSync");
    if (localPlan || remotePlan || remoteHasDescriptor) {
      const pending = await getPendingFirestoreSnapshot();
      if (pending) {
        await registerRetaFinalConflict(
          config,
          {
            allowed: false,
            reason: "pending-outbox",
            conflict: { type: RETA_FINAL_CONFLICT, cause: "pending-outbox" },
          },
          pending,
          remote,
        );
        return false;
      }
      const outcome = applyRetaFinalPull(remote, config, { force: false });
      if (!outcome.handled || outcome.conflict) {
        if (outcome.conflict) {
          await registerRetaFinalConflict(
            config,
            pullConflictDecision(outcome),
            null,
            remote,
          );
        }
        return false;
      }
      if (outcome.applied !== true) return emitNoopPullStatus(remote);
      await yieldToUIWithBudget(50, performance.now());
      if (!(await applyPulledRetaFinalState(outcome, remote, uid, "merge"))) {
        return false;
      }
      const mergedPlan = getRetaFinalPayloadPlan(state);
      const planDiffers = Boolean(
        mergedPlan &&
          remotePlan &&
          !compareRetaFinalPlanIntent(mergedPlan, remotePlan).equivalent,
      );
      const academicDiffers =
        nonPlanStateDigest(state) !== nonPlanStateDigest(remote.payload);
      if (planDiffers || academicDiffers) {
        const queued = await queueFirestoreSnapshotFromState(state, {
          manual: true,
        });
        if (!queued) return false;
        const pushed = await flushFirestoreOutbox({
          forceOverwrite: true,
          manual: true,
        });
        if (!pushed) return false;
      }
      emitPrimaryStatus("merged", { source: "snapshot" });
      document.dispatchEvent(
        new CustomEvent("app:showToast", {
          detail: {
            msg: "Firestore mesclado com os dados locais.",
            type: "success",
          },
        }),
      );
      return true;
    }

    await yieldToUIWithBudget(50, performance.now());

    const previousSyncConfig = { ...config };
    const merged = mergeStudyStates(state, remote.payload || {});
    setState(merged, { merge: true });
    const mergeConflict = merged.config?.syncMergeConflicts;
    if (mergeConflict) {
      const conflict = {
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        localUpdatedAt: getEnvelopeUpdatedAt(
          createFirestoreSnapshotEnvelope(state, { manual: true }),
        ),
        detectedAt: mergeConflict.detectedAt,
        reason: "merge-collision",
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
        lastError:
          "Conflito Firestore: itens com o mesmo ID possuem conteudo diferente.",
        hasPendingWrites: true,
      });
      await saveFirestoreConflict(conflict);
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitPrimaryStatus("conflict", { conflict });
      emitStatus("conflict", { conflict });
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
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
    });
    const queued = await queueFirestoreSnapshotFromState(state, {
      manual: true,
    });
    if (!queued) return false;
    const ok = await flushFirestoreOutbox({
      forceOverwrite: true,
      manual: true,
    });
    emitPrimaryStatus("merged", { source: "snapshot" });
    document.dispatchEvent(
      new CustomEvent("app:showToast", {
        detail: {
          msg: "Firestore mesclado com os dados locais.",
          type: "success",
        },
      }),
    );
    return ok;
  } catch (err) {
    document.dispatchEvent(
      new CustomEvent("app:showToast", {
        detail: { msg: "Erro ao mesclar dados do Firestore", type: "error" },
      }),
    );
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
    return false;
  }
}

export async function resolveEntityConflictKeepLocal() {
  const config = getConfig();
  if (isRetaFinalConflict(config.conflict)) {
    try {
      const { db, uid } = requireSignedInServices();
      const remote = await readFirestoreSnapshot(db, uid);
      const localPlan = getRetaFinalPayloadPlan(state);
      const remotePlan = getRetaFinalPayloadPlan({
        planejamento: remote?.payload?.planejamento,
      });
      const base = verifiedRetaFinalBase(config);
      const localMatchesBase =
        Boolean(localPlan && base) &&
        compareRetaFinalPlanIntent(localPlan, base).equivalent;
      const allowed =
        Boolean(localPlan && remotePlan && base) &&
        base.planId === localPlan.planId &&
        base.planId === remotePlan.planId &&
        base.revision === remotePlan.revision &&
        (!config.baseDigest ||
          computeRetaFinalPlanDigest(base) === config.baseDigest) &&
        localPlan.revision >= base.revision &&
        (localPlan.revision > base.revision || localMatchesBase);
      if (!allowed) {
        config.lastError =
          "Conflito Reta Final: base e revisao locais nao conferem com o remoto.";
        await persistSyncConfig(false);
        emitStatus("conflict", { conflict: config.conflict });
        return false;
      }
      if (localPlan.revision === base.revision && localMatchesBase) {
        config.conflict = null;
        config.hasPendingWrites = false;
        config.lastError = null;
        await clearFirestoreConflict();
        await persistSyncConfig(true);
        emitStatus("synced");
        return true;
      }
      config.conflict = null;
      config.hasPendingWrites = true;
      config.lastError = null;
      await clearFirestoreConflict();
      await persistSyncConfig(true);
      const queued = await queueFirestoreSnapshotFromState(state, {
        manual: true,
      });
      if (!queued) return false;
      return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
    } catch (err) {
      config.lastError = err.message || String(err);
      await persistSyncConfig(false);
      emitStatus("error", { error: config.lastError });
      return false;
    }
  }
  if (!config.conflict?.items) return false;

  config.conflict = null;
  config.hasPendingWrites = true;
  config.lastError = null;
  await persistSyncConfig(true);
  await clearFirestoreConflict();

  const queued = await queueFirestoreSnapshotFromState(state, { manual: true });
  if (!queued) return false;
  return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
}

export async function resolveEntityConflictKeepRemote(options = {}) {
  const config = getConfig();
  if (isRetaFinalConflict(config.conflict)) {
    try {
      const { db, uid } = requireSignedInServices();
      const remote = await readFirestoreSnapshot(db, uid);
      const remotePlan = getRetaFinalPayloadPlan({
        planejamento: remote?.payload?.planejamento,
      });
      if (!remote || !remotePlan) {
        config.lastError =
          "Conflito Reta Final: o remoto nao contem um plano v2 aplicavel.";
        await persistSyncConfig(false);
        return false;
      }
      const preservedCfUrl = state.config?.cfUrl || null;
      const preservedCfToken = state.config?.cfToken || null;
      const preservedCfSyncEnabled = state.config?.cfSyncEnabled === true;
      const preservedFirestoreSync = state.config?.firestoreSync || null;
      const preservedManualSyncHistory =
        state.config?.manualSyncHistory ?? null;
      const preservedLastManualSyncResults =
        state.config?.lastManualSyncResults ?? null;
      const pending = await getPendingFirestoreSnapshot();
      if (pending && options.discardPending !== true) {
        await registerRetaFinalConflict(
          config,
          {
            allowed: false,
            reason: "pending-outbox",
            conflict: { type: RETA_FINAL_CONFLICT, cause: "pending-outbox" },
          },
          pending,
          remote,
        );
        return false;
      }
      const nextState = applyEnvelopeToLocalState(remote, config);
      setState(nextState);
      if (state.config) {
        if (preservedCfUrl) state.config.cfUrl = preservedCfUrl;
        if (preservedCfToken) state.config.cfToken = preservedCfToken;
        state.config.cfSyncEnabled = preservedCfSyncEnabled;
        if (preservedFirestoreSync)
          state.config.firestoreSync = preservedFirestoreSync;
        if (preservedManualSyncHistory !== null)
          state.config.manualSyncHistory = preservedManualSyncHistory;
        if (preservedLastManualSyncResults !== null)
          state.config.lastManualSyncResults = preservedLastManualSyncResults;
      }
      if (Object.hasOwn(remote, "retaFinalSync")) {
        setRetaFinalBaseFromRemote(config, remote, remotePlan);
      } else {
        Object.assign(config, {
          basePlan: null,
          baseRevision: null,
          baseDigest: null,
          baseRemoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        });
      }
      config.conflict = null;
      config.hasPendingWrites = false;
      config.lastError = null;
      await clearFirestoreConflict();
      const cleared = await markFirestoreSnapshotSynced(
        pending
          ? {
              queuedAt: pending.queuedAt ?? null,
              sentAt: pending.envelope?.sentAt ?? null,
            }
          : { queuedAt: null, sentAt: null },
      );
      if (!cleared) {
        config.hasPendingWrites = true;
        config.lastError =
          "Outbox recebeu uma nova gravacao durante o keep-remote.";
        await persistSyncConfig(true);
        emitStatus("pending");
        return false;
      }
      await saveFirestoreMeta({
        uid,
        remoteUpdatedAt: getEnvelopeUpdatedAt(remote),
        lastPullAt: new Date().toISOString(),
      });
      await persistSyncConfig(true);
      await saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
        touchLocalBackup: false,
      });
      emitStatus("synced");
      return true;
    } catch (err) {
      config.lastError = err.message || String(err);
      await persistSyncConfig(false);
      emitStatus("error", { error: config.lastError });
      return false;
    }
  }
  if (!config.conflict?.items) return false;

  try {
    const { db, uid } = requireSignedInServices();
    const remote = await readFirestoreSnapshot(db, uid);
    if (!remote) {
      config.conflict = null;
      await persistSyncConfig(true);
      return false;
    }

    const nextState = applyEnvelopeToLocalState(remote, config);
    setState(nextState, { merge: true });

    config.conflict = null;
    config.hasPendingWrites = false;
    config.lastError = null;
    await persistSyncConfig(true);
    await clearFirestoreConflict();
    await markFirestoreSnapshotSynced();
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
    });

    const queued = await queueFirestoreSnapshotFromState(state, {
      manual: true,
    });
    if (!queued) return false;
    return await flushFirestoreOutbox({ forceOverwrite: true, manual: true });
  } catch (err) {
    config.lastError = err.message || String(err);
    await persistSyncConfig(false);
    emitStatus("error", { error: config.lastError });
    return false;
  }
}
