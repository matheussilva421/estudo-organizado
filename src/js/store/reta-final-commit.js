import {
  LOCAL_STATE_CURRENT_KEY,
  LOCAL_STATE_LEGACY_KEY,
  LOCAL_STATE_PREVIOUS_KEY,
  RETA_FINAL_DRAFT_STORE,
  RETA_FINAL_JOURNAL_STORE,
  STORE_NAME,
} from "./indexeddb.js";
import {
  createLocalStateEnvelope,
  isLocalStateEnvelopeValid,
  pickRecoverableLocalState,
  stableStringify,
} from "./normalize-state.js";
import {
  retaFinalDigest,
  validateRetaFinalDraft,
} from "../logic/reta-final-drafts.js";
import { projectRetaFinalSchedule } from "../logic/reta-final-schedule.js";
import {
  carryRemovedAutoNotesToBlocks,
  rebuildRetaFinalAutoEvents,
} from "../logic/reta-final-events.js";
import {
  buildRetaFinalEventTitle,
  reconcileRetaFinalWithEvents,
} from "../logic/reta-final-core.js";
import { createRetaFinalCheckpoint } from "../logic/reta-final-history.js";
import { validateRetaFinalV2 } from "../logic/reta-final-schema.js";
import { mergeRetaFinalPlans } from "../logic/reta-final-merge.js";
import { computeRetaFinalPlanDigest } from "../sync/reta-final-protocol.js";
import { pruneRetaFinalCheckpoints } from "./reta-final-history-store.js";
import {
  collectRetaFinalConflicts,
  removeRetaFinalConflict,
} from "../views/reta-final-conflicts.js";

const clone = (value) => structuredClone(value);
const DANGEROUS_PATH_SEGMENTS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function assertSafePathSegment(segment, path) {
  if (DANGEROUS_PATH_SEGMENTS.has(segment)) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      `Caminho de conflito inseguro: ${path}.`,
    );
  }
}

function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function requestError(request) {
  return (
    request?.error || new Error("Falha ao ler estado local da Reta Final.")
  );
}

function uniqueOperationIds(operations) {
  const ids = [];
  const seen = new Set();
  for (const operation of Array.isArray(operations) ? operations : []) {
    const id = operation?.operationId;
    if (typeof id === "string" && id.trim() && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function assertOperationIdsAvailable(journalRecords, draftId, operationIds) {
  const committedBy = new Map();
  for (const record of Array.isArray(journalRecords) ? journalRecords : []) {
    if (record?.type !== "sync_intent" || !Array.isArray(record.operationIds))
      continue;
    for (const operationId of record.operationIds) {
      if (
        typeof operationId === "string" &&
        operationId &&
        !committedBy.has(operationId)
      ) {
        committedBy.set(operationId, record.draftId ?? null);
      }
    }
  }
  for (const operationId of operationIds) {
    if (
      committedBy.has(operationId) &&
      committedBy.get(operationId) !== draftId
    ) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "operationId já foi utilizado por outro commit da Reta Final.",
        { operationId },
      );
    }
  }
}

function recoverStateFromReads(reads) {
  const recovered = pickRecoverableLocalState({
    current: requestResult(reads.current),
    previous: requestResult(reads.previous),
    legacy: requestResult(reads.legacy),
  });
  if (!recovered.state) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "Estado local persistido indisponível para recuperação.",
    );
  }
  return recovered.state;
}

function recoverReplayStateFromReads(reads, planId, minimumRevision) {
  const current = requestResult(reads.current);
  const previous = requestResult(reads.previous);
  const legacy = requestResult(reads.legacy);
  const candidates = [];
  if (isLocalStateEnvelopeValid(current)) candidates.push(current.payload);
  if (isLocalStateEnvelopeValid(previous)) candidates.push(previous.payload);
  if (legacy && typeof legacy === "object") {
    candidates.push(
      isLocalStateEnvelopeValid(legacy) ? legacy.payload : legacy,
    );
  }

  let selected = null;
  for (const candidate of candidates) {
    const plan = candidate?.planejamento;
    if (
      plan?.planId !== planId ||
      !Number.isSafeInteger(plan.revision) ||
      plan.revision < minimumRevision
    ) {
      continue;
    }
    if (!selected || plan.revision > selected.planejamento.revision) {
      selected = candidate;
    }
  }
  if (!selected) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "Nenhum estado local alcança a revisão aplicada do rascunho.",
    );
  }
  return selected;
}

function listCatalogIds(editais) {
  const ids = new Set();
  for (const edital of Array.isArray(editais) ? editais : []) {
    if (typeof edital?.id === "string") ids.add(edital.id);
    for (const discipline of Array.isArray(edital?.disciplinas)
      ? edital.disciplinas
      : []) {
      if (typeof discipline?.id === "string") ids.add(discipline.id);
      for (const collection of ["assuntos", "aulas"]) {
        for (const entity of Array.isArray(discipline?.[collection])
          ? discipline[collection]
          : []) {
          if (typeof entity?.id === "string") ids.add(entity.id);
        }
      }
    }
  }
  return ids;
}

function materializeCatalogIntents(editais, intents) {
  const catalog = clone(Array.isArray(editais) ? editais : []);
  const allIds = listCatalogIds(catalog);
  const seen = new Set();
  const collectionByEntity = { assunto: "assuntos", aula: "aulas" };
  for (const intent of intents) {
    const collection = collectionByEntity[intent?.entity];
    if (
      !collection ||
      typeof intent.id !== "string" ||
      !intent.id.trim() ||
      typeof intent.discId !== "string" ||
      !intent.discId.trim() ||
      typeof intent.nome !== "string" ||
      !intent.nome.trim() ||
      seen.has(intent.id)
    ) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "Intenção de catálogo inválida ou ambígua.",
      );
    }
    seen.add(intent.id);
    const matches = [];
    for (const edital of catalog) {
      for (const discipline of Array.isArray(edital?.disciplinas)
        ? edital.disciplinas
        : []) {
        if (discipline?.id === intent.discId) matches.push(discipline);
      }
    }
    if (matches.length !== 1) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "A disciplina da intenção de catálogo não é única.",
      );
    }
    if (allIds.has(intent.id)) {
      const existing = (matches[0][collection] || []).filter(
        (item) => item?.id === intent.id,
      );
      if (existing.length === 1 && existing[0].nome === intent.nome) continue;
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "O id da intenção de catálogo já está ocupado.",
      );
    }
    matches[0][collection] = Array.isArray(matches[0][collection])
      ? matches[0][collection]
      : [];
    matches[0][collection].push({ id: intent.id, nome: intent.nome });
    allIds.add(intent.id);
  }
  return catalog;
}

function eventTitle(block, editais) {
  let discipline = null;
  for (const edital of Array.isArray(editais) ? editais : []) {
    discipline =
      (Array.isArray(edital?.disciplinas) ? edital.disciplinas : []).find(
        (item) => item?.id === block.discId,
      ) || discipline;
  }
  return buildRetaFinalEventTitle(block, discipline);
}

function createEventId(context, usedIds) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value =
      typeof context.makeId === "function"
        ? context.makeId()
        : globalThis.crypto?.randomUUID?.() ||
          `rf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id = "autorf_" + value;
    if (typeof value === "string" && value.trim() && !usedIds.has(id)) {
      usedIds.add(id);
      return value;
    }
  }
  return null;
}

function buildCommittedSnapshot(sourceState, draft, context) {
  const plan = sourceState.planejamento;
  const catalogIntents = draft.catalogIntents ?? context.catalogIntents ?? [];
  if (!Array.isArray(catalogIntents)) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "Intenções de catálogo devem ser uma lista.",
    );
  }
  const editais = materializeCatalogIntents(
    sourceState.editais,
    catalogIntents,
  );
  const validation = validateRetaFinalDraft(draft, plan, {
    ...context,
    events: sourceState.eventos || [],
    catalog: editais,
    catalogIntents,
    activeTimerIds: context.activeTimerIds || [],
  });
  if (validation.status !== "ready") {
    const stale = validation.status === "stale";
    throw codedError(
      stale ? "RETA_FINAL_STALE" : "RETA_FINAL_CONFLICT",
      validation.errors?.[0]?.message ||
        "Rascunho não pode ser aplicado ao plano persistido.",
      { validation },
    );
  }

  const now =
    typeof context.now === "string" && context.now
      ? context.now
      : new Date().toISOString();
  const nextPlan = clone(draft.snapshot);
  nextPlan.planId = plan.planId;
  nextPlan.revision = plan.revision + 1;
  nextPlan.updatedAt = now;

  const occupied = new Set();
  const completed = new Set();
  for (const event of sourceState.eventos || []) {
    if (!event?.rfBlocoId) continue;
    if (event.status === "estudei" || Number(event.tempoAcumulado) > 0)
      occupied.add(event.rfBlocoId);
    if (event.status === "estudei") completed.add(event.rfBlocoId);
  }
  const projection = projectRetaFinalSchedule(nextPlan, {
    today: context.today,
    occupiedBlocoIds: occupied,
    completedBlocoIds: completed,
  });
  const byBlockId = new Map(
    projection.blocos.map((block) => [block.id, block]),
  );
  nextPlan.retaFinal.blocos = nextPlan.retaFinal.blocos.map((block) => {
    const projected = byBlockId.get(block.id);
    if (!projected || block.arquivado === true) return block;
    return {
      ...block,
      data: projected.dataEfetiva || block.data,
      status: projected.status,
    };
  });
  const projectedPlan = {
    ...nextPlan,
    retaFinal: { ...nextPlan.retaFinal, blocos: projection.blocos },
  };
  const usedEventIds = new Set(
    (sourceState.eventos || []).map((event) => event?.id).filter(Boolean),
  );
  const rebuilt = rebuildRetaFinalAutoEvents(
    projectedPlan,
    sourceState.eventos || [],
    {
      today: context.today,
      makeId: () => createEventId(context, usedEventIds),
      now: context.now,
    },
  );
  carryRemovedAutoNotesToBlocks(
    nextPlan.retaFinal.blocos,
    rebuilt.diagnostics.removed,
  );
  const createdEventIds = new Set(
    rebuilt.diagnostics.created.map((item) => item.eventId),
  );
  const events = rebuilt.events.map((event) => {
    if (!createdEventIds.has(event?.id)) return event;
    const block = byBlockId.get(event.rfBlocoId);
    if (!block) return event;
    return { ...event, titulo: eventTitle(block, editais), criadoEm: now };
  });
  const finalPlan = { ...nextPlan };
  return {
    ...clone(sourceState),
    editais,
    planejamento: finalPlan,
    eventos: events,
  };
}

function resultFor(plan, draftId) {
  return {
    plan: clone(plan),
    revision: plan.revision,
    localCommitted: true,
    syncPending: true,
    commitId: draftId,
  };
}

/** Atomically commits the editor draft to the official local state and journal. */
export function commitRetaFinalDraft({
  db,
  draftId,
  expectedPlanId,
  expectedRevision,
  context = {},
}) {
  if (!db || typeof db.transaction !== "function") {
    return Promise.reject(new TypeError("Instância IndexedDB indisponível."));
  }
  if (typeof draftId !== "string" || !draftId.trim()) {
    return Promise.reject(new TypeError("draftId inválido."));
  }
  if (
    typeof expectedPlanId !== "string" ||
    !expectedPlanId.trim() ||
    !Number.isSafeInteger(expectedRevision)
  ) {
    return Promise.reject(
      new TypeError("Identidade ou revisão esperada inválida."),
    );
  }

  return new Promise((resolve, reject) => {
    let transaction;
    let plannedError = null;
    let nextState = null;
    let commitResult = null;
    let settled = false;
    const settleError = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error("Transação local da Reta Final falhou."));
    };
    try {
      transaction = db.transaction(
        [STORE_NAME, RETA_FINAL_DRAFT_STORE, RETA_FINAL_JOURNAL_STORE],
        "readwrite",
      );
      transaction.oncomplete = () => {
        if (settled) return;
        if (plannedError) {
          settleError(plannedError);
          return;
        }
        settled = true;
        try {
          context.onCommitted?.(clone(nextState), clone(commitResult));
        } catch (error) {
          console.error(
            "Reta Final: commit durável; falha ao publicar estado em memória.",
            error,
          );
        }
        if (context.pruneAutomatic !== false) {
          try {
            pruneRetaFinalCheckpoints(db, expectedPlanId).catch((error) => {
              console.warn(
                "Reta Final: falha ao podar checkpoints automáticos.",
                error,
              );
            });
          } catch (error) {
            console.warn(
              "Reta Final: falha ao iniciar poda de checkpoints.",
              error,
            );
          }
        }
        resolve(clone(commitResult));
      };
      transaction.onerror = (event) => {
        if (!plannedError)
          plannedError = event?.target?.error || transaction.error;
      };
      transaction.onabort = (event) => {
        settleError(plannedError || event?.target?.error || transaction.error);
      };

      const appStore = transaction.objectStore(STORE_NAME);
      const draftStore = transaction.objectStore(RETA_FINAL_DRAFT_STORE);
      const journalStore = transaction.objectStore(RETA_FINAL_JOURNAL_STORE);
      const reads = {
        current: appStore.get(LOCAL_STATE_CURRENT_KEY),
        previous: appStore.get(LOCAL_STATE_PREVIOUS_KEY),
        legacy: appStore.get(LOCAL_STATE_LEGACY_KEY),
        draft: draftStore.get(draftId),
        journal: journalStore.getAll(),
      };
      const completedReads = new Set();
      const abortForError = (error) => {
        plannedError = error;
        try {
          transaction.abort();
        } catch {
          settleError(plannedError);
        }
      };
      const failForRequest = (request) => abortForError(requestError(request));
      for (const [key, request] of Object.entries(reads)) {
        request.onerror = () => failForRequest(request);
        request.onsuccess = () => {
          completedReads.add(key);
          if (completedReads.size !== Object.keys(reads).length || plannedError)
            return;
          try {
            const draft = requestResult(reads.draft);
            if (!draft)
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "Rascunho não encontrado.",
              );
            if (
              draft.planId !== expectedPlanId ||
              draft.baseRevision !== expectedRevision
            ) {
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "Identidade ou revisão-base não corresponde ao rascunho.",
              );
            }
            if (draft.state === "applied") {
              const appliedRevision = draft.appliedResult?.revision;
              if (
                draft.appliedCommitId !== draftId ||
                draft.appliedBaseRevision !== expectedRevision ||
                draft.appliedPlanId !== expectedPlanId ||
                !draft.appliedResult?.plan ||
                !Number.isSafeInteger(appliedRevision)
              ) {
                throw codedError(
                  "RETA_FINAL_CONFLICT",
                  "Registro de commit aplicado está inconsistente.",
                );
              }
              nextState = clone(
                recoverReplayStateFromReads(
                  reads,
                  expectedPlanId,
                  appliedRevision,
                ),
              );
              commitResult = clone(draft.appliedResult);
              return;
            }
            if (draft.state !== "editing") {
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "O rascunho não está em edição.",
              );
            }

            const state = recoverStateFromReads(reads);
            const currentPlan = state.planejamento;
            if (!currentPlan || currentPlan.planId !== expectedPlanId) {
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "A identidade do plano persistido mudou.",
              );
            }
            if (currentPlan.revision !== expectedRevision) {
              throw codedError(
                "RETA_FINAL_STALE",
                "A revisão do plano mudou desde a criação do rascunho.",
              );
            }
            if (
              context.expectedDigest &&
              context.expectedDigest !== draft.baseDigest
            ) {
              throw codedError(
                "RETA_FINAL_STALE",
                "O digest esperado não corresponde à base do rascunho.",
              );
            }
            if (
              stableStringify(currentPlan) !==
              stableStringify(draft.baseSnapshot)
            ) {
              throw codedError(
                "RETA_FINAL_STALE",
                "O conteúdo do plano mudou desde a criação do rascunho.",
              );
            }

            const operationIds = uniqueOperationIds(draft.operations);
            assertOperationIdsAvailable(
              requestResult(reads.journal),
              draftId,
              operationIds,
            );
            nextState = buildCommittedSnapshot(state, draft, context);
            const committedPlan = nextState.planejamento;
            commitResult = resultFor(committedPlan, draftId);
            const oldCurrent = requestResult(reads.current);
            const previousEnvelope = isLocalStateEnvelopeValid(oldCurrent)
              ? { ...oldCurrent, slot: "previous" }
              : createLocalStateEnvelope(state, { slot: "previous" });
            const currentEnvelope = createLocalStateEnvelope(nextState, {
              slot: "current",
              savedAt: committedPlan.updatedAt,
            });
            const appliedDraft = {
              ...draft,
              state: "applied",
              updatedAt: committedPlan.updatedAt,
              appliedAt: committedPlan.updatedAt,
              appliedPlanId: expectedPlanId,
              appliedBaseRevision: expectedRevision,
              appliedRevision: committedPlan.revision,
              appliedCommitId: draftId,
              appliedResult: commitResult,
              operations: draft.operations.map((operation) => ({
                ...operation,
                committedRevision: committedPlan.revision,
                committedPlanId: expectedPlanId,
                committedAt: committedPlan.updatedAt,
              })),
            };
            const checkpoint = createRetaFinalCheckpoint(currentPlan, {
              checkpointId: `rf-checkpoint:${draftId}`,
              createdAt: committedPlan.updatedAt,
              kind: "automatic",
              draftId,
            });
            const syncIntent = {
              id: `rf-sync-intent:${draftId}`,
              type: "sync_intent",
              planId: expectedPlanId,
              revision: committedPlan.revision,
              status: "pending",
              operationIds,
              createdAt: committedPlan.updatedAt,
              draftId,
              localCommitted: true,
              syncPending: true,
            };
            appStore.put(previousEnvelope, LOCAL_STATE_PREVIOUS_KEY);
            appStore.put(currentEnvelope, LOCAL_STATE_CURRENT_KEY);
            appStore.put(nextState, LOCAL_STATE_LEGACY_KEY);
            draftStore.put(appliedDraft);
            journalStore.put(checkpoint);
            journalStore.put(syncIntent);
          } catch (error) {
            abortForError(error);
          }
        };
      }
    } catch (error) {
      settleError(error);
    }
  });
}

function requestResult(request) {
  return request?.result;
}

// ── Conflict resolution ──────────────────────────────────────────────

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergePatchObject(target, patch) {
  const result = isRecord(target) ? clone(target) : {};
  for (const [key, value] of Object.entries(patch || {})) {
    assertSafePathSegment(key, key);
    if (value === null) {
      delete result[key];
      continue;
    }
    if (isRecord(value) && isRecord(result[key])) {
      result[key] = mergePatchObject(result[key], value);
      continue;
    }
    result[key] = clone(value);
  }
  return result;
}

function setAtPath(target, path, value) {
  const parts = String(path || "")
    .split(".")
    .filter(Boolean);
  if (parts.length === 0) {
    throw codedError("RETA_FINAL_CONFLICT", "Caminho de conflito vazio.");
  }
  for (const part of parts) assertSafePathSegment(part, path);
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (cursor == null || typeof cursor !== "object") {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        `Caminho de conflito inválido: ${path}.`,
      );
    }
    if (Array.isArray(cursor) && !/^\d+$/.test(key)) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        `Caminho de conflito não suportado: ${path}.`,
      );
    }
    if (!Object.hasOwn(cursor, key)) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        `Caminho de conflito inválido: ${path}.`,
      );
    }
    cursor = cursor[key];
  }
  const last = parts[parts.length - 1];
  if (cursor == null || typeof cursor !== "object") {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      `Caminho de conflito inválido: ${path}.`,
    );
  }
  if (value === undefined || value === null) delete cursor[last];
  else cursor[last] = clone(value);
}

function setConflictField(plan, conflict, value) {
  const path = String(conflict.fieldPath || "");
  if (!path || path.startsWith("$") || path === "schema") {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "Este conflito de metadados não pode ser resolvido por campo.",
      { fieldPath: path },
    );
  }
  const prefix = conflict.blockId
    ? `retaFinal.blocos.${conflict.blockId}.`
    : null;
  if (prefix && path.startsWith(prefix)) {
    const block = (plan.retaFinal?.blocos || []).find(
      (item) => item?.id === conflict.blockId,
    );
    if (!block) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "O bloco do conflito não existe mais no plano.",
        { blockId: conflict.blockId },
      );
    }
    const field = path.slice(prefix.length);
    assertSafePathSegment(field, path);
    if (value === undefined || value === null) delete block[field];
    else block[field] = clone(value);
    return plan;
  }
  setAtPath(plan, path, value);
  return plan;
}

function filterRemovedBlocks(plan, state) {
  const removed = new Set(
    (state.config?.firestoreSync?.removedBlocks || [])
      .map((item) => item?.id)
      .filter(Boolean),
  );
  if (removed.size === 0 || !Array.isArray(plan?.retaFinal?.blocos))
    return plan;
  plan.retaFinal.blocos = plan.retaFinal.blocos.filter(
    (block) => !removed.has(block?.id),
  );
  return plan;
}

function validateResolvedPlan(candidate, state) {
  filterRemovedBlocks(candidate, state);
  const validation = validateRetaFinalV2(candidate);
  if (!validation.valid) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      validation.errors[0] || "Plano resolvido inválido.",
      { validation },
    );
  }
  if (candidate.ativo !== true) return candidate;
  const events = Array.isArray(state.eventos) ? state.eventos : [];
  const catalog =
    Array.isArray(state.editais) && state.editais.length ? state.editais : null;
  const merged = mergeRetaFinalPlans({
    basePlan: candidate,
    localPlan: candidate,
    remotePlan: candidate,
    events,
    catalog,
  });
  if (!merged.valid) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      merged.conflicts?.[0]?.reason ||
        "O plano resolvido não passou na validação de referências.",
      { conflicts: merged.conflicts },
    );
  }
  reconcileRetaFinalWithEvents(candidate, events);
  return candidate;
}

function buildResolvedPlan({ conflict, choice, patch, state, now }) {
  const currentPlan = state.planejamento;
  const remotePlan = isRecord(conflict.remotePlan) ? conflict.remotePlan : null;
  const remoteValidation = remotePlan
    ? validateRetaFinalV2(remotePlan)
    : { valid: false };
  const remoteBase =
    remotePlan &&
    remoteValidation.valid &&
    remotePlan.planId === currentPlan.planId
      ? remotePlan
      : null;
  const knownBaseRevision = Number.isSafeInteger(conflict.basePlan?.revision)
    ? conflict.basePlan.revision
    : Number.isSafeInteger(state.config?.firestoreSync?.baseRevision)
      ? state.config.firestoreSync.baseRevision
      : null;
  if (
    remoteBase &&
    (choice === "remote" || choice === "manual") &&
    knownBaseRevision !== null &&
    remoteBase.revision < knownBaseRevision
  ) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "O plano remoto está atrasado em relação à base conhecida.",
      { reason: "stale-remote" },
    );
  }
  let candidate;

  if (conflict.source === "merge") {
    if (!conflict.resolvable) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "Este conflito de metadados exige revisar a base/linhagem do plano.",
      );
    }
    candidate = clone(currentPlan);
    if (choice === "manual") {
      if (!isRecord(patch) || Object.keys(patch).length === 0) {
        throw codedError("RETA_FINAL_CONFLICT", "JSON manual vazio.");
      }
      candidate = mergePatchObject(candidate, patch);
    } else {
      const value = choice === "remote" ? conflict.remote : conflict.local;
      setConflictField(candidate, conflict, value);
    }
  } else if (choice === "remote") {
    if (!remoteBase) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "Não há plano remoto verificável para adotar.",
        { reason: "remote-unavailable" },
      );
    }
    candidate = clone(remoteBase);
  } else if (choice === "local") {
    candidate = clone(currentPlan);
  } else {
    if (!remoteBase) {
      throw codedError(
        "RETA_FINAL_CONFLICT",
        "Não há plano remoto compatível para resolver manualmente.",
        { reason: "remote-unavailable" },
      );
    }
    const proposed =
      isRecord(conflict.proposedPlan) &&
      conflict.proposedPlan.planId === currentPlan.planId &&
      validateRetaFinalV2(conflict.proposedPlan).valid
        ? conflict.proposedPlan
        : currentPlan;
    if (!isRecord(patch) || Object.keys(patch).length === 0) {
      throw codedError("RETA_FINAL_CONFLICT", "JSON manual vazio.");
    }
    candidate = mergePatchObject(clone(proposed), patch);
  }

  if (candidate.planId !== currentPlan.planId) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "A resolução não pode trocar a identidade do plano.",
    );
  }
  if (
    remoteBase &&
    remoteBase.ativo !== true &&
    currentPlan.ativo === true &&
    candidate.ativo === true
  ) {
    throw codedError(
      "RETA_FINAL_CONFLICT",
      "O plano remoto foi aposentado; manter o plano ativo exigiria uma decisão de aposentadoria.",
      { reason: "retired-resurrection" },
    );
  }

  const nextRevision = remoteBase
    ? remoteBase.revision + 1
    : Math.max(currentPlan.revision, candidate.revision || 0) + 1;
  candidate.revision = nextRevision;
  candidate.updatedAt = now;
  const validated = validateResolvedPlan(candidate, state);
  validated.planId = currentPlan.planId;
  validated.revision = nextRevision;
  validated.updatedAt = now;
  return { plan: validated, remoteBase };
}

function readConflictField(plan, conflict) {
  if (!isRecord(plan) || !isRecord(conflict)) return undefined;
  const path = String(conflict.fieldPath || "");
  if (conflict.blockId) {
    const block = (plan.retaFinal?.blocos || []).find(
      (entry) => entry?.id === conflict.blockId,
    );
    if (!block) return undefined;
    const prefix = `retaFinal.blocos.${conflict.blockId}.`;
    if (path.startsWith(prefix)) return block[path.slice(prefix.length)];
  }
  let cursor = plan;
  for (const part of path.split(".").filter(Boolean)) {
    if (DANGEROUS_PATH_SEGMENTS.has(part)) return undefined;
    if (cursor == null || typeof cursor !== "object") return undefined;
    if (!Object.hasOwn(cursor, part)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function planChangeList(before, after) {
  const changes = [];
  if (before?.retaFinal?.dataFinal !== after?.retaFinal?.dataFinal) {
    changes.push({
      blockId: null,
      fieldPath: "retaFinal.dataFinal",
      before: before?.retaFinal?.dataFinal ?? null,
      after: after?.retaFinal?.dataFinal ?? null,
    });
  }
  const beforeBlocks = new Map(
    (before?.retaFinal?.blocos || []).map((block) => [block?.id, block]),
  );
  const afterBlocks = new Map(
    (after?.retaFinal?.blocos || []).map((block) => [block?.id, block]),
  );
  for (const id of [
    ...new Set([...beforeBlocks.keys(), ...afterBlocks.keys()]),
  ].sort()) {
    const previous = beforeBlocks.get(id) || null;
    const next = afterBlocks.get(id) || null;
    if (stableStringify(previous) === stableStringify(next)) continue;
    changes.push({
      blockId: id,
      fieldPath: "$block",
      before: clone(previous),
      after: clone(next),
    });
  }
  return changes;
}

/**
 * Resolves one conflict in a single local transaction: official state,
 * checkpoint and audit operation are committed together or not at all.
 */
export function resolveRetaFinalConflictAtomically({
  db,
  conflictId,
  choice,
  patch,
  expectedPlanId,
  expectedRevision,
  now,
  deviceId,
  operationId: requestedOperationId,
  checkpointId: requestedCheckpointId,
  onCommitted,
} = {}) {
  if (!db || typeof db.transaction !== "function") {
    return Promise.reject(new TypeError("Instância IndexedDB indisponível."));
  }
  if (typeof conflictId !== "string" || !conflictId.trim()) {
    return Promise.reject(new TypeError("conflictId inválido."));
  }
  if (!["local", "remote", "manual"].includes(choice)) {
    return Promise.reject(new TypeError("Escolha de conflito inválida."));
  }
  const timestamp =
    typeof now === "string" && now ? now : new Date().toISOString();
  const device =
    typeof deviceId === "string" && deviceId.trim() ? deviceId : "local-device";

  return new Promise((resolve, reject) => {
    let transaction;
    let plannedError = null;
    let nextState = null;
    let result = null;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error("Transação de resolução de conflito falhou."));
    };
    try {
      transaction = db.transaction(
        [STORE_NAME, RETA_FINAL_JOURNAL_STORE],
        "readwrite",
      );
      transaction.oncomplete = () => {
        if (settled) return;
        if (plannedError) {
          fail(plannedError);
          return;
        }
        settled = true;
        try {
          onCommitted?.(clone(nextState), clone(result));
        } catch (error) {
          console.error(
            "Reta Final: resolução durável; falha ao publicar estado em memória.",
            error,
          );
        }
        resolve(clone(result));
      };
      transaction.onerror = (event) => {
        if (!plannedError)
          plannedError = event?.target?.error || transaction.error;
      };
      transaction.onabort = (event) => {
        fail(plannedError || event?.target?.error || transaction.error);
      };

      const appStore = transaction.objectStore(STORE_NAME);
      const journalStore = transaction.objectStore(RETA_FINAL_JOURNAL_STORE);
      const reads = {
        current: appStore.get(LOCAL_STATE_CURRENT_KEY),
        previous: appStore.get(LOCAL_STATE_PREVIOUS_KEY),
        legacy: appStore.get(LOCAL_STATE_LEGACY_KEY),
        journal: journalStore.getAll(),
      };
      const completedReads = new Set();
      const abortForError = (error) => {
        plannedError = error;
        try {
          transaction.abort();
        } catch {
          fail(plannedError);
        }
      };
      for (const [key, request] of Object.entries(reads)) {
        request.onerror = () => abortForError(requestError(request));
        request.onsuccess = () => {
          completedReads.add(key);
          if (
            completedReads.size !== Object.keys(reads).length ||
            plannedError
          ) {
            return;
          }
          try {
            const state = recoverStateFromReads(reads);
            const currentPlan = state.planejamento;
            if (!isRecord(currentPlan)) {
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "A Reta Final local não está disponível.",
              );
            }
            if (
              typeof expectedPlanId === "string" &&
              currentPlan.planId !== expectedPlanId
            ) {
              throw codedError(
                "RETA_FINAL_STALE",
                "A identidade do plano mudou desde o conflito.",
              );
            }
            const revision = Number.isSafeInteger(expectedRevision)
              ? expectedRevision
              : currentPlan.revision;
            if (currentPlan.revision !== revision) {
              throw codedError(
                "RETA_FINAL_STALE",
                "A revisão do plano mudou desde o conflito.",
              );
            }
            const conflict = collectRetaFinalConflicts(state).find(
              (item) => item.conflictId === conflictId,
            );
            if (!conflict) {
              throw codedError(
                "RETA_FINAL_CONFLICT",
                "O conflito não está mais pendente.",
              );
            }
            if (
              isRecord(conflict.localPlan) &&
              conflict.localPlan.planId === currentPlan.planId &&
              conflict.localPlan.revision === currentPlan.revision &&
              stableStringify(conflict.localPlan) !==
                stableStringify(currentPlan)
            ) {
              throw codedError(
                "RETA_FINAL_STALE",
                "O conteúdo local mudou desde a detecção do conflito.",
              );
            }
            if (conflict.source === "merge") {
              const currentValue = readConflictField(currentPlan, conflict);
              if (
                stableStringify(currentValue ?? null) !==
                stableStringify(conflict.local ?? null)
              ) {
                throw codedError(
                  "RETA_FINAL_STALE",
                  "O campo do conflito mudou desde a detecção.",
                );
              }
            }

            const built = buildResolvedPlan({
              conflict,
              choice,
              patch,
              state,
              now: timestamp,
            });
            nextState = clone(state);
            nextState.planejamento = built.plan;
            if (!isRecord(nextState.config)) nextState.config = {};
            if (!isRecord(nextState.config.firestoreSync)) {
              nextState.config.firestoreSync = {};
            }
            const syncConfig = nextState.config.firestoreSync;
            syncConfig.hasPendingWrites = true;
            syncConfig.lastError = null;
            if (built.remoteBase) {
              const remoteSnapshotRevision = Number.isSafeInteger(
                conflict.remoteSnapshotRevision,
              )
                ? conflict.remoteSnapshotRevision
                : 0;
              syncConfig.basePlan = clone(built.remoteBase);
              syncConfig.baseRevision = built.remoteBase.revision;
              syncConfig.baseSnapshotRevision = remoteSnapshotRevision;
              syncConfig.snapshotRevision = remoteSnapshotRevision;
              // The sync engine compares this digest with its canonical plan
              // digest; retaFinalDigest() uses a different algorithm.
              syncConfig.baseDigest = computeRetaFinalPlanDigest(
                built.remoteBase,
              );
              syncConfig.baseRemoteUpdatedAt =
                conflict.remoteUpdatedAt ||
                syncConfig.remoteUpdatedAt ||
                timestamp;
            }
            nextState.config.localBackupAt = timestamp;
            removeRetaFinalConflict(nextState, conflictId);

            const checkpointId =
              typeof requestedCheckpointId === "string" &&
              requestedCheckpointId.trim()
                ? requestedCheckpointId
                : `rf-checkpoint:conflict:${retaFinalDigest({
                    conflictId,
                    revision: currentPlan.revision,
                    at: timestamp,
                  }).replace("fnv1a64:", "")}`;
            const checkpoint = createRetaFinalCheckpoint(currentPlan, {
              checkpointId,
              createdAt: timestamp,
              kind: "manual",
              label: "Antes de resolver conflito da Reta Final",
              draftId: conflictId,
            });
            checkpoint.pending = true;
            checkpoint.conflicted = true;

            const operationId =
              typeof requestedOperationId === "string" &&
              requestedOperationId.trim()
                ? requestedOperationId
                : `rf-conflict-op:${retaFinalDigest({
                    conflictId,
                    choice,
                    at: timestamp,
                  }).replace("fnv1a64:", "")}`;
            const baseRevision = built.remoteBase
              ? built.remoteBase.revision
              : currentPlan.revision;
            const operation = {
              id: operationId,
              type: "conflict_resolution",
              operationId,
              planId: currentPlan.planId,
              choice,
              conflictId,
              conflictSource: conflict.source,
              baseRevision,
              before: clone(currentPlan),
              after: clone(built.plan),
              diff: planChangeList(currentPlan, built.plan),
              deviceId: device,
              createdAt: timestamp,
              timestamp,
              reason:
                conflict.reason ||
                `Resolução ${choice} do conflito ${conflictId}.`,
            };
            const syncIntent = {
              id: `rf-sync-intent:${operationId}`,
              type: "sync_intent",
              planId: currentPlan.planId,
              revision: built.plan.revision,
              status: "pending",
              operationIds: [operationId],
              createdAt: timestamp,
              localCommitted: true,
              syncPending: true,
              conflictResolution: true,
            };

            const oldCurrent = requestResult(reads.current);
            const previousEnvelope = isLocalStateEnvelopeValid(oldCurrent)
              ? { ...oldCurrent, slot: "previous" }
              : createLocalStateEnvelope(state, { slot: "previous" });
            const currentEnvelope = createLocalStateEnvelope(nextState, {
              slot: "current",
              savedAt: timestamp,
            });
            appStore.put(previousEnvelope, LOCAL_STATE_PREVIOUS_KEY);
            appStore.put(currentEnvelope, LOCAL_STATE_CURRENT_KEY);
            appStore.put(nextState, LOCAL_STATE_LEGACY_KEY);
            journalStore.put(checkpoint);
            journalStore.put(operation);
            journalStore.put(syncIntent);

            result = {
              applied: true,
              plan: clone(built.plan),
              state: clone(nextState),
              revision: built.plan.revision,
              operationId,
              checkpointId,
              conflictId,
              choice,
              localCommitted: true,
              syncPending: true,
              syncStatus: "pending",
            };
          } catch (error) {
            abortForError(error);
          }
        };
      }
    } catch (error) {
      fail(error);
    }
  });
}
