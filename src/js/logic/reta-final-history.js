import { applyRetaFinalCommand } from "./reta-final-commands.js";
import { validateRetaFinalV2 } from "./reta-final-schema.js";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
  retaFinalDigest,
} from "./reta-final-drafts.js";

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) =>
  value === undefined ? undefined : structuredClone(value);
const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (isObject(value)) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stable(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
};

const RESTORABLE_BLOCK_FIELDS = [
  "discId",
  "topicos",
  "minutos",
  "prioridade",
  "observacao",
  "dataPlanejada",
  "ordem",
  "fixado",
];

function diagnostic(code, message, extra = {}) {
  return { code, message, blocking: true, ...extra };
}

function checkpointPayload(checkpoint) {
  return {
    id: checkpoint.id,
    checkpointId: checkpoint.checkpointId ?? checkpoint.id,
    type: checkpoint.type,
    planId: checkpoint.planId,
    revision: checkpoint.revision,
    createdAt: checkpoint.createdAt,
    kind: checkpoint.kind,
    label: checkpoint.label ?? null,
    draftId: checkpoint.draftId ?? null,
    plan: checkpoint.plan,
  };
}

/** Creates a detached, checksummed snapshot of plan intent, without event history. */
export function createRetaFinalCheckpoint(
  plan,
  { checkpointId, createdAt, kind, label, draftId } = {},
) {
  if (!validateRetaFinalV2(plan).valid)
    throw new TypeError("Plano inválido para checkpoint.");
  if (typeof checkpointId !== "string" || !checkpointId.trim())
    throw new TypeError("checkpointId inválido.");
  if (typeof createdAt !== "string" || !createdAt.trim())
    throw new TypeError("createdAt inválido.");
  if (!["manual", "automatic"].includes(kind))
    throw new TypeError("kind deve ser manual ou automatic.");
  if (label !== undefined && (typeof label !== "string" || !label.trim()))
    throw new TypeError("label deve ser texto não vazio.");
  if (draftId !== undefined && (typeof draftId !== "string" || !draftId.trim()))
    throw new TypeError("draftId inválido.");
  if (Object.hasOwn(plan, "eventos") || Object.hasOwn(plan, "events"))
    throw new TypeError(
      "Checkpoint aceita apenas o plano, sem histórico de eventos.",
    );

  const checkpoint = {
    id: checkpointId,
    checkpointId,
    type: "checkpoint",
    planId: plan.planId,
    revision: plan.revision,
    createdAt,
    kind,
    ...(label !== undefined ? { label } : {}),
    ...(draftId !== undefined ? { draftId } : {}),
    plan: clone(plan),
  };
  checkpoint.checksum = retaFinalDigest(checkpointPayload(checkpoint));
  return checkpoint;
}

/** Reports checksum and snapshot validity without discarding the stored record. */
export function verifyRetaFinalCheckpoint(checkpoint) {
  const errors = [];
  if (
    !isObject(checkpoint) ||
    checkpoint.type !== "checkpoint" ||
    typeof checkpoint.id !== "string" ||
    !checkpoint.id.trim() ||
    typeof checkpoint.planId !== "string" ||
    !Number.isSafeInteger(checkpoint.revision) ||
    typeof checkpoint.createdAt !== "string" ||
    !["manual", "automatic"].includes(checkpoint.kind) ||
    !isObject(checkpoint.plan)
  ) {
    errors.push(
      diagnostic(
        "CHECKPOINT_INVALID",
        "Estrutura ou identidade do checkpoint inválida.",
      ),
    );
  } else if (
    checkpoint.plan.planId !== checkpoint.planId ||
    checkpoint.plan.revision !== checkpoint.revision ||
    !validateRetaFinalV2(checkpoint.plan).valid
  ) {
    errors.push(
      diagnostic(
        "CHECKPOINT_INVALID",
        "Snapshot do checkpoint não corresponde à identidade declarada.",
      ),
    );
  }
  if (
    errors.length === 0 &&
    (typeof checkpoint.checksum !== "string" ||
      checkpoint.checksum !== retaFinalDigest(checkpointPayload(checkpoint)))
  ) {
    errors.push(
      diagnostic(
        "CHECKPOINT_CHECKSUM_INVALID",
        "Checksum do checkpoint não confere.",
      ),
    );
  }
  return { valid: errors.length === 0, diagnostics: errors };
}

function operationProvenancePayload(operation) {
  return {
    operationId: operation.operationId,
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

/** Validates additive before/after provenance; legacy operation records fail closed. */
export function verifyRetaFinalOperationProvenance(operation) {
  if (
    !isObject(operation) ||
    !isObject(operation.before) ||
    !isObject(operation.after) ||
    !Array.isArray(operation.diff) ||
    !Number.isSafeInteger(operation.baseRevision) ||
    typeof operation.createdAt !== "string" ||
    !operation.createdAt.trim() ||
    typeof operation.provenanceChecksum !== "string"
  ) {
    return {
      valid: false,
      diagnostics: [
        diagnostic(
          "OPERATION_PROVENANCE_MISSING",
          "A operação antiga não possui proveniência segura para inversão.",
        ),
      ],
    };
  }
  const beforeValidation = validateRetaFinalV2(operation.before);
  const afterValidation = validateRetaFinalV2(operation.after);
  if (
    operation.before.revision !== operation.baseRevision ||
    operation.after.revision !== operation.baseRevision ||
    operation.before.planId !== operation.after.planId ||
    !beforeValidation.valid ||
    !afterValidation.valid ||
    operation.command?.operationId !== operation.operationId ||
    operation.provenanceChecksum !==
      retaFinalDigest(operationProvenancePayload(operation))
  ) {
    return {
      valid: false,
      diagnostics: [
        diagnostic(
          "OPERATION_PROVENANCE_INVALID",
          "A proveniência da operação não confere.",
        ),
      ],
    };
  }
  return { valid: true, diagnostics: [] };
}

function changedFields(before, after) {
  return [
    ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})]),
  ]
    .filter((key) => stable(before?.[key]) !== stable(after?.[key]))
    .sort();
}

function diffPlans(before, after) {
  const diff = [];
  if (
    stable(before.retaFinal.dataFinal) !== stable(after.retaFinal.dataFinal)
  ) {
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
  const nextBlocks = new Map(
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
    const nextBlock = nextBlocks.get(id);
    if (stable(oldBlock) === stable(nextBlock)) continue;
    diff.push({
      blockId: id,
      before: oldBlock ? clone(oldBlock) : null,
      after: nextBlock ? clone(nextBlock) : null,
      fieldsChanged: changedFields(oldBlock, nextBlock),
    });
  }
  return diff;
}

function restoreFailure(diagnostics) {
  return { operations: [], diff: [], diagnostics };
}

/** Proposes command-only restore operations and a preview; it never writes state or events. */
export function proposeRetaFinalRestore(plan, checkpoint, options = {}) {
  const events = options.events === undefined ? [] : options.events;
  const diagnostics = [];
  const checkpointValidation = verifyRetaFinalCheckpoint(checkpoint);
  if (!checkpointValidation.valid)
    return restoreFailure(checkpointValidation.diagnostics);
  if (!validateRetaFinalV2(plan).valid) {
    return restoreFailure([
      diagnostic(
        "RESTORE_PLAN_INVALID",
        "Plano atual inválido para restauração.",
      ),
    ]);
  }
  if (checkpoint.planId !== plan.planId) {
    return restoreFailure([
      diagnostic(
        "CHECKPOINT_PLAN_MISMATCH",
        "O checkpoint pertence a outro plano.",
      ),
    ]);
  }
  if (!Array.isArray(events)) {
    return restoreFailure([
      diagnostic(
        "RESTORE_EVENTS_INVALID",
        "events deve ser uma lista para preservar o histórico atual.",
      ),
    ]);
  }
  const fullRestore = options.blockIds === undefined;
  const targetIds = fullRestore
    ? checkpoint.plan.retaFinal.blocos.map((block) => block.id)
    : options.blockIds;
  if (
    !Array.isArray(targetIds) ||
    targetIds.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(targetIds).size !== targetIds.length
  ) {
    return restoreFailure([
      diagnostic(
        "RESTORE_BLOCK_IDS_INVALID",
        "blockIds deve conter ids válidos e sem repetição.",
      ),
    ]);
  }

  const currentById = new Map(
    plan.retaFinal.blocos.map((block) => [block.id, block]),
  );
  const snapshotById = new Map(
    checkpoint.plan.retaFinal.blocos.map((block) => [block.id, block]),
  );
  if (fullRestore) {
    for (const block of plan.retaFinal.blocos) {
      if (!snapshotById.has(block.id)) {
        diagnostics.push(
          diagnostic(
            "RESTORE_BLOCK_REMOVAL_UNSUPPORTED",
            "O checkpoint não contém o bloco atual " +
              block.id +
              "; a remoção exigiria uma ação destrutiva.",
            { blockId: block.id },
          ),
        );
      }
    }
  }
  for (const blockId of targetIds) {
    if (!snapshotById.has(blockId)) {
      diagnostics.push(
        diagnostic(
          "RESTORE_BLOCK_NOT_IN_CHECKPOINT",
          "O bloco " + blockId + " não existe no checkpoint.",
          { blockId },
        ),
      );
    } else if (!currentById.has(blockId)) {
      diagnostics.push(
        diagnostic(
          "RESTORE_BLOCK_MISSING",
          "O bloco " +
            blockId +
            " não existe no plano atual e não será recriado automaticamente.",
          { blockId },
        ),
      );
    }
  }
  if (diagnostics.length) return restoreFailure(diagnostics);

  let working = clone(plan);
  const operations = [];
  const context = {
    events,
    catalog: Array.isArray(options.catalog) ? options.catalog : [],
    activeTimerIds: options.activeTimerIds ?? [],
    today: options.today,
  };
  const addCommand = (type, body = {}) => {
    const index = operations.length;
    const command = {
      operationId: `history-restore:${checkpoint.id}:${plan.revision}:${index}`,
      type,
      ...clone(body),
    };
    const result = applyRetaFinalCommand(working, command, context);
    if (!result.valid) {
      diagnostics.push(
        ...result.diagnostics.map((item) =>
          diagnostic(item.code, item.message, {
            operationId: item.operationId,
            blockId: item.blockId,
          }),
        ),
      );
      return false;
    }
    working = result.plan;
    operations.push(command);
    return true;
  };

  const targetPlan = checkpoint.plan;
  if (
    stable(working.retaFinal.dataFinal) !==
    stable(targetPlan.retaFinal.dataFinal)
  ) {
    if (targetPlan.retaFinal.dataFinal < working.retaFinal.dataFinal) {
      diagnostics.push(
        diagnostic(
          "RESTORE_DEADLINE_BLOCKED",
          "Restaurar o prazo exigiria encurtar a data final; use edição explícita.",
        ),
      );
    } else if (
      !addCommand("EXTEND_DEADLINE", {
        input: { dataFinal: targetPlan.retaFinal.dataFinal },
      })
    ) {
      return restoreFailure(diagnostics);
    }
  }
  if (
    stable(working.retaFinal.capacidade) !==
    stable(targetPlan.retaFinal.capacidade)
  ) {
    if (!isObject(targetPlan.retaFinal.capacidade)) {
      diagnostics.push(
        diagnostic(
          "RESTORE_CAPACITY_BLOCKED",
          "O checkpoint não possui capacidade restaurável.",
        ),
      );
    } else if (
      !addCommand("SET_CAPACITY", {
        input: { capacidade: targetPlan.retaFinal.capacidade },
      })
    ) {
      return restoreFailure(diagnostics);
    }
  }

  for (const blockId of targetIds) {
    const target = snapshotById.get(blockId);
    const current = working.retaFinal.blocos.find(
      (block) => block.id === blockId,
    );
    const targetArchived = target.arquivado === true;
    const currentArchived = current.arquivado === true;
    if (currentArchived && !targetArchived) {
      if (!addCommand("UNARCHIVE", { blockIds: [blockId] }))
        return restoreFailure(diagnostics);
    }

    const refreshed = working.retaFinal.blocos.find(
      (block) => block.id === blockId,
    );
    if (refreshed.arquivado === true && targetArchived) {
      if (
        RESTORABLE_BLOCK_FIELDS.some(
          (field) => stable(refreshed[field]) !== stable(target[field]),
        )
      ) {
        diagnostics.push(
          diagnostic(
            "RESTORE_ARCHIVED_BLOCK_BLOCKED",
            "O bloco arquivado " +
              blockId +
              " precisa de revisão antes da restauração.",
            { blockId },
          ),
        );
      }
      continue;
    }

    const patch = {};
    for (const field of RESTORABLE_BLOCK_FIELDS) {
      if (stable(refreshed[field]) === stable(target[field])) continue;
      if (Object.hasOwn(target, field)) {
        patch[field] = clone(target[field]);
      } else if (field === "prioridade" || field === "observacao") {
        patch[field] = null;
      } else if (field === "fixado") {
        patch[field] = false;
      } else {
        diagnostics.push(
          diagnostic(
            "RESTORE_FIELD_BLOCKED",
            "O campo " +
              field +
              " do bloco " +
              blockId +
              " não pode ser removido por um comando seguro.",
            { blockId, field },
          ),
        );
      }
    }
    if (
      Object.keys(patch).length &&
      !addCommand("PATCH", { blockIds: [blockId], patch })
    ) {
      return restoreFailure(diagnostics);
    }
    if (targetArchived && !refreshed.arquivado) {
      if (!addCommand("ARCHIVE", { blockIds: [blockId] }))
        return restoreFailure(diagnostics);
    }
  }

  if (diagnostics.length) return restoreFailure(diagnostics);
  return { operations, diff: diffPlans(plan, working), diagnostics: [] };
}

function blockedInverse(code, message) {
  return { blocking: true, diagnostics: [diagnostic(code, message)] };
}

function blockFrom(plan, blockId) {
  return plan?.retaFinal?.blocos?.find((block) => block?.id === blockId);
}

function makeInverseCommand(operation, type, body) {
  return {
    operationId: `history-inverse:${operation.operationId}:${operation.committedRevision ?? operation.baseRevision}`,
    type,
    ...body,
  };
}

/** Returns a validated inverse command, or a blocking diagnostic for unsafe history. */
export function invertRetaFinalOperation(operation) {
  const provenance = verifyRetaFinalOperationProvenance(operation);
  if (!provenance.valid) {
    return {
      blocking: true,
      diagnostics: provenance.diagnostics,
    };
  }
  const command = operation.command;
  const blockIds = Array.isArray(command.blockIds) ? command.blockIds : [];
  if (command.type === "PATCH") {
    const patch = {};
    for (const [field, afterValue] of Object.entries(command.patch || {})) {
      if (field === "dataPlanejada")
        return blockedInverse(
          "UNDO_UNSUPPORTED",
          "A inversão da data planejada alteraria metadados derivados do reagendamento.",
        );
      const beforeValues = [];
      for (const id of blockIds) {
        const before = blockFrom(operation.before, id);
        const after = blockFrom(operation.after, id);
        if (!before || !after || stable(after[field]) !== stable(afterValue)) {
          return blockedInverse(
            "OPERATION_PROVENANCE_INVALID",
            "O campo editado não corresponde à proveniência armazenada.",
          );
        }
        if (Object.hasOwn(before, field)) beforeValues.push(before[field]);
        else if (field === "prioridade" || field === "observacao")
          beforeValues.push(null);
        else if (field === "fixado") beforeValues.push(false);
        else
          return blockedInverse(
            "UNDO_UNSUPPORTED",
            "O campo " + field + " não possui inversão sem perda.",
          );
      }
      if (
        !beforeValues.length ||
        beforeValues.some((value) => stable(value) !== stable(beforeValues[0]))
      ) {
        return blockedInverse(
          "UNDO_UNSUPPORTED",
          "Os alvos da operação possuem valores anteriores diferentes.",
        );
      }
      patch[field] = clone(beforeValues[0]);
    }
    if (!Object.keys(patch).length)
      return blockedInverse(
        "UNDO_UNSUPPORTED",
        "A operação não contém campos editáveis para inverter.",
      );
    return makeInverseCommand(operation, "PATCH", {
      blockIds: clone(blockIds),
      patch,
    });
  }
  if (command.type === "SET_DURATION") {
    const values = blockIds.map(
      (id) => blockFrom(operation.before, id)?.minutos,
    );
    if (
      values.length === 0 ||
      values.some((value) => !Number.isInteger(value) || value !== values[0]) ||
      blockIds.some(
        (id) =>
          blockFrom(operation.after, id)?.minutos !== command.input?.minutos,
      )
    ) {
      return blockedInverse(
        "UNDO_UNSUPPORTED",
        "A duração anterior não pode ser representada por um comando único.",
      );
    }
    return makeInverseCommand(operation, "SET_DURATION", {
      blockIds: clone(blockIds),
      input: { minutos: values[0] },
    });
  }
  if (command.type === "SET_PRIORITY") {
    const values = blockIds.map((id) => {
      const block = blockFrom(operation.before, id);
      return block && Object.hasOwn(block, "prioridade")
        ? block.prioridade
        : null;
    });
    if (
      values.length === 0 ||
      values.some((value) => stable(value) !== stable(values[0])) ||
      blockIds.some(
        (id) =>
          stable(blockFrom(operation.after, id)?.prioridade) !==
          stable(command.input?.prioridade),
      )
    ) {
      return blockedInverse(
        "UNDO_UNSUPPORTED",
        "A prioridade anterior não pode ser representada por um comando único.",
      );
    }
    return makeInverseCommand(operation, "SET_PRIORITY", {
      blockIds: clone(blockIds),
      input: { prioridade: clone(values[0]) },
    });
  }
  if (command.type === "SET_CAPACITY") {
    const beforeCapacity = operation.before?.retaFinal?.capacidade;
    if (
      !isObject(beforeCapacity) ||
      stable(operation.after?.retaFinal?.capacidade) !==
        stable(command.input?.capacidade)
    ) {
      return blockedInverse(
        "UNDO_UNSUPPORTED",
        "A capacidade anterior não pode ser restaurada com segurança.",
      );
    }
    return makeInverseCommand(operation, "SET_CAPACITY", {
      input: { capacidade: clone(beforeCapacity) },
    });
  }
  if (command.type === "ARCHIVE" || command.type === "UNARCHIVE") {
    const inverseType = command.type === "ARCHIVE" ? "UNARCHIVE" : "ARCHIVE";
    const expectedBefore = command.type === "ARCHIVE" ? false : true;
    const expectedAfter = command.type === "ARCHIVE" ? true : false;
    if (
      blockIds.length === 0 ||
      blockIds.some(
        (id) =>
          (blockFrom(operation.before, id)?.arquivado === true) !==
          expectedBefore,
      ) ||
      blockIds.some(
        (id) =>
          (blockFrom(operation.after, id)?.arquivado === true) !==
          expectedAfter,
      )
    ) {
      return blockedInverse(
        "OPERATION_PROVENANCE_INVALID",
        "O estado de arquivamento não corresponde à operação.",
      );
    }
    return makeInverseCommand(operation, inverseType, {
      blockIds: clone(blockIds),
    });
  }
  return blockedInverse(
    "UNDO_UNSUPPORTED",
    command.type === "EXTEND_DEADLINE"
      ? "Reduzir a data final não é permitido por undo; use um checkpoint e revisão explícita."
      : "A operação " +
          String(command.type) +
          " não possui inversão segura disponível.",
  );
}

function historyDraftProposal(plan, operation, options, action) {
  const committedRevision = operation?.committedRevision ?? operation?.revision;
  if (!Number.isSafeInteger(committedRevision)) {
    return {
      draft: null,
      diff: [],
      diagnostics: [
        diagnostic(
          "OPERATION_NOT_COMMITTED",
          "Undo/redo exige uma operação já confirmada pelo Task 7.",
        ),
      ],
    };
  }
  if (operation.planId && operation.planId !== plan?.planId) {
    return {
      draft: null,
      diff: [],
      diagnostics: [
        diagnostic(
          "HISTORY_PLAN_MISMATCH",
          "A operação pertence a outro plano.",
        ),
      ],
    };
  }
  if (committedRevision !== plan?.revision) {
    return {
      draft: null,
      diff: [],
      diagnostics: [
        diagnostic(
          "HISTORY_REVISION_MISMATCH",
          "O plano avançou desde esta operação; use a operação mais recente ou um checkpoint.",
        ),
      ],
    };
  }
  if (action === "redo" && operation.historyAction !== "undo") {
    return {
      draft: null,
      diff: [],
      diagnostics: [
        diagnostic(
          "REDO_SOURCE_INVALID",
          "Redo requer uma operação de undo já aplicada.",
        ),
      ],
    };
  }
  if (
    typeof options.draftId !== "string" ||
    !options.draftId.trim() ||
    typeof options.now !== "string" ||
    !options.now
  ) {
    return {
      draft: null,
      diff: [],
      diagnostics: [
        diagnostic(
          "HISTORY_DRAFT_ID_INVALID",
          "draftId e now são obrigatórios para criar o draft de histórico.",
        ),
      ],
    };
  }
  const inverse = invertRetaFinalOperation(operation);
  if (inverse.blocking)
    return { draft: null, diff: [], diagnostics: inverse.diagnostics };
  let draft = createRetaFinalDraft(plan, {
    draftId: options.draftId,
    now: options.now,
  });
  const appended = appendRetaFinalDraftOperation(draft, inverse, {
    events: options.events ?? [],
    catalog: options.catalog ?? [],
    catalogIntents: options.catalogIntents ?? [],
    activeTimerIds: options.activeTimerIds ?? [],
    today: options.today,
    now: options.now,
    makeId: options.makeId,
    historyAction: action,
    sourceOperationId: operation.operationId,
  });
  if (!appended.valid) {
    return {
      draft: null,
      diff: [],
      diagnostics: appended.errors.map((item) =>
        diagnostic(item.code, item.message, { operationId: item.operationId }),
      ),
    };
  }
  draft = appended.draft;
  return { draft, operations: [inverse], diff: appended.diff, diagnostics: [] };
}

/** Creates an undo draft only when the operation is the current committed revision. */
export function proposeRetaFinalUndo(plan, operation, options = {}) {
  return historyDraftProposal(plan, operation, options, "undo");
}

/** Creates a redo draft only from the latest committed undo operation. */
export function proposeRetaFinalRedo(plan, undoOperation, options = {}) {
  return historyDraftProposal(plan, undoOperation, options, "redo");
}
