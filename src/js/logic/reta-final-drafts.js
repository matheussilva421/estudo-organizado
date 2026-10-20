import { applyRetaFinalCommand } from "./reta-final-commands.js";
import { validateRetaFinalV2 } from "./reta-final-schema.js";

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (isObject(value))
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stable(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
};
export function retaFinalDigest(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of stable(value)) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return "fnv1a64:" + hash.toString(16).padStart(16, "0");
}
function operationProvenancePayload(operation) {
  return {
    operationId: operation.operationId,
    planId: operation.planId ?? operation.before?.planId ?? null,
    command: operation.command,
    generatedIds: operation.generatedIds ?? [],
    before: operation.before,
    after: operation.after,
    diff: operation.diff,
    baseRevision: operation.baseRevision,
    createdAt: operation.createdAt,
    deviceId: operation.deviceId ?? null,
    historyAction: operation.historyAction ?? null,
    sourceOperationId: operation.sourceOperationId ?? null,
  };
}
function hasOperationProvenance(operation) {
  return (
    operation?.before !== undefined ||
    operation?.after !== undefined ||
    operation?.diff !== undefined ||
    operation?.baseRevision !== undefined ||
    operation?.provenanceChecksum !== undefined
  );
}
function changedFields(before, after) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  return [...keys]
    .filter((key) => stable(before?.[key]) !== stable(after?.[key]))
    .sort();
}
function blockDiff(before, after) {
  return {
    blockId: after?.id ?? before?.id ?? null,
    before: before ? clone(before) : null,
    after: after ? clone(after) : null,
    fieldsChanged: changedFields(before, after),
  };
}
function diffPlans(before, after) {
  const diff = [];
  if (before.retaFinal.dataFinal !== after.retaFinal.dataFinal) {
    diff.push({
      blockId: null,
      before: { dataFinal: before.retaFinal.dataFinal },
      after: { dataFinal: after.retaFinal.dataFinal },
      fieldsChanged: ["retaFinal.dataFinal"],
    });
  }
  if (
    stable(before.retaFinal.capacidade) !== stable(after.retaFinal.capacidade)
  ) {
    diff.push({
      blockId: null,
      before: { capacidade: clone(before.retaFinal.capacidade) },
      after: { capacidade: clone(after.retaFinal.capacidade) },
      fieldsChanged: ["retaFinal.capacidade"],
    });
  }
  const oldBlocks = new Map(
    before.retaFinal.blocos.map((block) => [block.id, block]),
  );
  const newBlocks = new Map(
    after.retaFinal.blocos.map((block) => [block.id, block]),
  );
  const ids = [
    ...before.retaFinal.blocos.map((block) => block.id),
    ...after.retaFinal.blocos
      .map((block) => block.id)
      .filter((id) => !oldBlocks.has(id)),
  ];
  for (const id of ids) {
    const oldBlock = oldBlocks.get(id);
    const newBlock = newBlocks.get(id);
    if (stable(oldBlock) !== stable(newBlock))
      diff.push(blockDiff(oldBlock, newBlock));
  }
  return diff;
}
function error(code, message, operationId = null, index = null, extra = {}) {
  return { code, message, operationId, index, ...extra };
}
function hasOwnIndex(value, index) {
  return Object.prototype.hasOwnProperty.call(value, index);
}
function snapshotShapeError(snapshot, label) {
  if (
    !isObject(snapshot.retaFinal) ||
    !Array.isArray(snapshot.retaFinal.blocos)
  ) {
    return error(
      "DRAFT_INVALID",
      label + ": retaFinal.blocos deve ser uma lista.",
    );
  }
  const blocks = snapshot.retaFinal.blocos;
  for (let index = 0; index < blocks.length; index += 1) {
    if (!hasOwnIndex(blocks, index)) {
      return error(
        "DRAFT_INVALID",
        label + ": bloco ausente no índice " + index + ".",
        null,
        index,
      );
    }
    const block = blocks[index];
    if (!isObject(block) || typeof block.id !== "string" || !block.id.trim()) {
      return error(
        "DRAFT_INVALID",
        label + ": cada bloco deve ter um id válido.",
        null,
        index,
      );
    }
  }
  const validation = validateRetaFinalV2(snapshot);
  if (!validation.valid) {
    return error(
      "DRAFT_INVALID",
      label + ": " + (validation.errors[0] || "snapshot inválido."),
    );
  }
  return null;
}
function operationShapeErrors(operations) {
  const errors = [];
  for (let index = 0; index < operations.length; index += 1) {
    if (!hasOwnIndex(operations, index)) {
      errors.push(
        error(
          "DRAFT_OPERATION_INVALID",
          "Registro de operação ausente no índice " + index + ".",
          null,
          index,
        ),
      );
      continue;
    }
    const operation = operations[index];
    const operationId =
      isObject(operation) && typeof operation.operationId === "string"
        ? operation.operationId
        : null;
    const generatedIds = operation?.generatedIds;
    const valid =
      isObject(operation) &&
      typeof operationId === "string" &&
      operationId.trim() &&
      isObject(operation.command) &&
      operation.command.operationId === operationId &&
      (generatedIds === undefined ||
        (Array.isArray(generatedIds) &&
          generatedIds.every((id) => typeof id === "string" && id.trim())));
    if (!valid) {
      errors.push(
        error(
          "DRAFT_OPERATION_INVALID",
          "Registro de operação inválido.",
          operationId,
          index,
        ),
      );
    }
  }
  return errors;
}
function shapeErrors(draft) {
  if (
    !isObject(draft) ||
    !isObject(draft.baseSnapshot) ||
    !isObject(draft.snapshot) ||
    !Array.isArray(draft.operations) ||
    typeof draft.draftId !== "string" ||
    !draft.draftId.trim() ||
    typeof draft.planId !== "string" ||
    !draft.planId.trim() ||
    !Number.isSafeInteger(draft.baseRevision) ||
    draft.baseRevision < 0 ||
    typeof draft.baseDigest !== "string" ||
    !draft.baseDigest
  ) {
    return [
      error("DRAFT_INVALID", "Estrutura ou identidade do rascunho inválida."),
    ];
  }
  const nested = [
    snapshotShapeError(draft.baseSnapshot, "Snapshot-base"),
    snapshotShapeError(draft.snapshot, "Snapshot"),
  ].filter(Boolean);
  if (nested.length) return nested;
  const operationErrors = operationShapeErrors(draft.operations);
  if (operationErrors.length) return operationErrors;
  return [];
}
function contextErrors(context) {
  if (context === undefined) return [];
  if (!isObject(context))
    return [
      error("CONTEXT_INVALID", "Contexto de comandos deve ser um objeto."),
    ];
  for (const key of ["events", "catalog", "catalogIntents", "history"]) {
    if (context[key] !== undefined && !Array.isArray(context[key])) {
      return [error("CONTEXT_INVALID", key + " deve ser uma lista.")];
    }
  }
  if (
    context.activeTimerIds !== undefined &&
    !(
      context.activeTimerIds instanceof Set ||
      Array.isArray(context.activeTimerIds) ||
      typeof context.activeTimerIds === "string" ||
      isObject(context.activeTimerIds)
    )
  ) {
    return [error("CONTEXT_INVALID", "activeTimerIds tem formato inválido.")];
  }
  if (context.today !== undefined && context.today !== null) {
    const match =
      typeof context.today === "string" &&
      /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(context.today);
    if (!match)
      return [
        error("CONTEXT_INVALID", "today deve ser uma data civil YYYY-MM-DD."),
      ];
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > days[month - 1]
    ) {
      return [
        error("CONTEXT_INVALID", "today deve ser uma data civil YYYY-MM-DD."),
      ];
    }
  }
  if (context.makeId !== undefined && typeof context.makeId !== "function") {
    return [error("CONTEXT_INVALID", "makeId deve ser uma função.")];
  }
  return [];
}

function run(plan, operation, context, generatedIds) {
  const producedIds = [];
  let generatedIndex = 0;
  const makeId = generatedIds
    ? () => generatedIds[generatedIndex++]
    : typeof context?.makeId === "function"
      ? () => {
          const id = context.makeId();
          producedIds.push(id);
          return id;
        }
      : undefined;
  const options = { ...(context || {}) };
  if (makeId) options.makeId = makeId;
  else delete options.makeId;
  return {
    result: applyRetaFinalCommand(
      plan,
      operation.command ?? operation,
      options,
    ),
    producedIds,
  };
}

/** Captures a detached Reta Final v2 snapshot and deterministic base digest. */
export function createRetaFinalDraft(plan, { draftId, now } = {}) {
  const validation = validateRetaFinalV2(plan);
  if (!validation.valid)
    throw new TypeError("Plano-base inválido: " + validation.errors.join(" "));
  if (typeof draftId !== "string" || !draftId.trim())
    throw new TypeError("draftId inválido.");
  if (typeof now !== "string" || !now)
    throw new TypeError("now deve ser uma data textual.");
  const baseSnapshot = clone(plan);
  return {
    draftId,
    planId: plan.planId,
    baseRevision: plan.revision,
    baseDigest: retaFinalDigest(baseSnapshot),
    baseSnapshot,
    snapshot: clone(baseSnapshot),
    operations: [],
    state: "editing",
    createdAt: now,
    updatedAt: now,
  };
}

/** Applies a Phase A command to the isolated draft; repeated operation ids are idempotent. */
export function appendRetaFinalDraftOperation(draft, command, context = {}) {
  const invalid = shapeErrors(draft);
  if (invalid.length) return { valid: false, draft, diff: [], errors: invalid };
  const currentDiff = diffPlans(draft.baseSnapshot, draft.snapshot);
  const invalidContext = contextErrors(context);
  if (invalidContext.length)
    return { valid: false, draft, diff: currentDiff, errors: invalidContext };
  if (draft.state !== "editing")
    return {
      valid: false,
      draft,
      diff: currentDiff,
      errors: [error("DRAFT_NOT_EDITING", "O rascunho não está em edição.")],
    };
  if (
    !isObject(command) ||
    typeof command.operationId !== "string" ||
    !command.operationId.trim()
  ) {
    return {
      valid: false,
      draft,
      diff: currentDiff,
      errors: [error("OPERATION_ID_INVALIDO", "operationId é obrigatório.")],
    };
  }
  const existing = draft.operations.find(
    (item) => item.operationId === command.operationId,
  );
  if (existing) {
    if (stable(existing.command) === stable(command)) {
      return { valid: true, draft, diff: currentDiff, errors: [] };
    }
    return {
      valid: false,
      draft,
      diff: currentDiff,
      errors: [
        error(
          "OPERATION_ID_CONFLICT",
          "operationId já pertence a outro comando.",
          command.operationId,
        ),
      ],
    };
  }
  const { result, producedIds } = run(draft.snapshot, command, context);
  if (!result.valid) {
    return {
      valid: false,
      draft,
      diff: currentDiff,
      errors: result.diagnostics.map((item) =>
        error(item.code, item.message, item.operationId, null, {
          type: item.type,
          blockId: item.blockId,
        }),
      ),
    };
  }
  const operation = {
    operationId: command.operationId,
    planId: draft.planId,
    command: clone(command),
    generatedIds: producedIds,
    before: clone(draft.snapshot),
    after: clone(result.plan),
    diff: clone(result.diff),
    baseRevision: draft.baseRevision,
    createdAt:
      typeof context.now === "string" && context.now
        ? context.now
        : draft.updatedAt,
  };
  if (typeof context.deviceId === "string" && context.deviceId.trim())
    operation.deviceId = context.deviceId;
  if (["undo", "redo"].includes(context.historyAction))
    operation.historyAction = context.historyAction;
  if (
    typeof context.sourceOperationId === "string" &&
    context.sourceOperationId.trim()
  )
    operation.sourceOperationId = context.sourceOperationId;
  operation.provenanceChecksum = retaFinalDigest(
    operationProvenancePayload(operation),
  );
  const next = {
    ...draft,
    snapshot: clone(result.plan),
    operations: [...draft.operations, operation],
    updatedAt:
      typeof context.now === "string" && context.now
        ? context.now
        : draft.updatedAt,
  };
  return {
    valid: true,
    draft: next,
    diff: diffPlans(next.baseSnapshot, next.snapshot),
    errors: [],
  };
}

/**
 * Statuses: ready means replayable with a current base; conflict means absent or different plan;
 * stale means base revision/content changed; blocked means malformed or commands/context invalid.
 * This reports a diff only and never applies or persists the draft.
 */
export function validateRetaFinalDraft(draft, currentPlan, context = {}) {
  const invalid = shapeErrors(draft);
  if (invalid.length) return { status: "blocked", diff: [], errors: invalid };
  if (!isObject(currentPlan))
    return {
      status: "conflict",
      diff: [],
      errors: [error("CURRENT_PLAN_MISSING", "Plano atual ausente.")],
    };
  if (
    draft.planId !== currentPlan.planId ||
    draft.baseSnapshot.planId !== draft.planId
  ) {
    return {
      status: "conflict",
      diff: [],
      errors: [
        error(
          "PLAN_IDENTITY_CONFLICT",
          "A identidade do plano não corresponde ao rascunho.",
        ),
      ],
    };
  }
  if (draft.state !== "editing")
    return {
      status: "blocked",
      diff: [],
      errors: [error("DRAFT_NOT_EDITING", "O rascunho não está em edição.")],
    };
  const invalidContext = contextErrors(context);
  if (invalidContext.length)
    return { status: "blocked", diff: [], errors: invalidContext };
  const baseValidation = validateRetaFinalV2(draft.baseSnapshot);
  if (
    !baseValidation.valid ||
    draft.baseSnapshot.revision !== draft.baseRevision ||
    retaFinalDigest(draft.baseSnapshot) !== draft.baseDigest
  ) {
    return {
      status: "blocked",
      diff: [],
      errors: [
        error(
          "DRAFT_BASE_INVALID",
          "Snapshot ou digest-base do rascunho inválido.",
        ),
      ],
    };
  }
  if (!validateRetaFinalV2(currentPlan).valid)
    return {
      status: "conflict",
      diff: [],
      errors: [
        error("CURRENT_PLAN_INVALID", "Plano atual inválido para comparação."),
      ],
    };
  if (
    currentPlan.revision !== draft.baseRevision ||
    retaFinalDigest(currentPlan) !== draft.baseDigest ||
    stable(currentPlan) !== stable(draft.baseSnapshot)
  ) {
    return {
      status: "stale",
      diff: [],
      errors: [
        error("BASE_STALE", "O plano mudou desde a criação do rascunho."),
      ],
    };
  }
  let replay = clone(draft.baseSnapshot);
  const seen = new Map();
  const errors = [];
  for (let index = 0; index < draft.operations.length; index += 1) {
    const operation = draft.operations[index];
    if (
      !isObject(operation) ||
      typeof operation.operationId !== "string" ||
      operation.operationId !== operation.command?.operationId
    ) {
      errors.push(
        error(
          "DRAFT_OPERATION_INVALID",
          "Registro de operação inválido.",
          null,
          index,
        ),
      );
      continue;
    }
    const commandText = stable(operation.command);
    if (seen.has(operation.operationId)) {
      if (seen.get(operation.operationId) !== commandText) {
        errors.push(
          error(
            "OPERATION_ID_CONFLICT",
            "operationId duplicado com outro comando.",
            operation.operationId,
            index,
          ),
        );
      }
      continue;
    }
    seen.set(operation.operationId, commandText);
    if (hasOperationProvenance(operation)) {
      const validProvenance =
        isObject(operation.before) &&
        isObject(operation.after) &&
        Array.isArray(operation.diff) &&
        operation.baseRevision === draft.baseRevision &&
        typeof operation.createdAt === "string" &&
        operation.createdAt &&
        operation.before.revision === draft.baseRevision &&
        operation.after.revision === draft.baseRevision &&
        stable(operation.before) === stable(replay) &&
        operation.provenanceChecksum ===
          retaFinalDigest(operationProvenancePayload(operation));
      if (!validProvenance) {
        errors.push(
          error(
            "DRAFT_OPERATION_PROVENANCE_INVALID",
            "A proveniência da operação não corresponde ao replay do rascunho.",
            operation.operationId,
            index,
          ),
        );
        continue;
      }
    }
    const { result } = run(
      replay,
      operation,
      context,
      operation.generatedIds || [],
    );
    if (!result.valid) {
      for (const item of result.diagnostics)
        errors.push(
          error(item.code, item.message, item.operationId, index, {
            type: item.type,
            blockId: item.blockId,
          }),
        );
    } else {
      if (
        hasOperationProvenance(operation) &&
        (stable(operation.after) !== stable(result.plan) ||
          stable(operation.diff) !== stable(result.diff))
      ) {
        errors.push(
          error(
            "DRAFT_OPERATION_PROVENANCE_INVALID",
            "A proveniência da operação diverge do comando reproduzido.",
            operation.operationId,
            index,
          ),
        );
        continue;
      }
      replay = result.plan;
    }
  }
  if (errors.length) return { status: "blocked", diff: [], errors };
  if (stable(replay) !== stable(draft.snapshot))
    return {
      status: "blocked",
      diff: [],
      errors: [
        error(
          "DRAFT_SNAPSHOT_MISMATCH",
          "Snapshot não corresponde ao replay das operações.",
        ),
      ],
    };
  return {
    status: "ready",
    diff: diffPlans(draft.baseSnapshot, replay),
    errors: [],
  };
}
