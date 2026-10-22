/**
 * Ações do formulário individual da Reta Final.
 *
 * Cada campo editável vira um comando PATCH no rascunho persistido. Nenhuma
 * ação deste módulo escreve em state.planejamento ou em eventos de estudo.
 */

import { registerAction } from "./dispatcher.js";
import { showConfirm, showToast } from "../../app.js?v=8.37";
import {
  db as storeDb,
  discardRetaFinalDraft,
  loadRetaFinalDraft,
  saveRetaFinalDraft,
  state,
} from "../../store.js?v=8.37";
import { todayStr, uid } from "../../utils.js?v=8.37";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../logic/reta-final-drafts.js";
import {
  buildRetaFinalEditorPatch,
  renderRetaFinalEditorForm,
  resolveRetaFinalEditorTopic,
} from "../../views/reta-final-editor-form.js";
import {
  computeRetaFinalSelection,
  createBulkRetaFinalCommand,
} from "../../views/reta-final-bulk-actions.js";
import { renderRetaFinalPlanner } from "../../views/reta-final-planner.js";
import { proposeRetaFinalRedistribution } from "../../logic/reta-final-redistribution.js";
import {
  beginRetaFinalDialog,
  closeRetaFinalBlockDetail,
  trapRetaFinalDialogFocus,
} from "../../views/reta-final-detail.js";

const sessions = new Map();
const plannerSessions = new Map();

export function resetRetaFinalEditorSessions() {
  sessions.clear();
  plannerSessions.clear();
}

function findBlock(draft, blockId) {
  return (draft?.snapshot?.retaFinal?.blocos || []).find(
    (block) => block?.id === blockId,
  );
}

function findDisciplina(catalog, discId) {
  for (const edital of catalog || []) {
    const disc = (edital?.disciplinas || []).find(
      (item) => item?.id === discId,
    );
    if (disc) return disc;
  }
  return null;
}

function activeBlockIds(eventos) {
  const ids = new Set();
  for (const evento of eventos || []) {
    if (evento?._timerStart && evento.rfBlocoId) ids.add(evento.rfBlocoId);
  }
  return ids;
}

function editorDraftId(plan) {
  return "reta-final-editor-" + plan.planId;
}

function contextFor(session, overrides = {}) {
  return {
    events: session.eventos,
    catalog: session.editais,
    catalogIntents: session.draft.catalogIntents || [],
    today: session.today,
    activeTimerIds: session.activeTimerIds,
    makeId: () => uid(),
    now: new Date().toISOString(),
    deviceId: session.deviceId,
    ...overrides,
  };
}

async function applyCommand(session, command, options = {}) {
  const candidate = options.candidate || session.draft;
  const context = options.context || contextFor(session);
  const result = appendRetaFinalDraftOperation(candidate, command, context);
  if (!result.valid) return result;
  try {
    await saveRetaFinalDraft(session.db, result.draft);
  } catch (error) {
    return {
      valid: false,
      draft: session.draft,
      diff: [],
      errors: [
        {
          code: "DRAFT_SAVE_FAILED",
          message:
            error?.message ||
            "Falha ao salvar o rascunho; nada foi confirmado.",
        },
      ],
    };
  }
  session.draft = result.draft;
  return result;
}

async function patchSession(session, patch) {
  if (!Object.keys(patch).length) {
    return { valid: true, draft: session.draft, diff: [], errors: [] };
  }
  return applyCommand(session, {
    operationId: "rf-edit-" + uid(),
    type: "PATCH",
    blockIds: [session.blockId],
    patch,
  });
}

function panelHtml(session) {
  const staleWarning = session.stale
    ? '<div class="restore-preview-warning" role="alert">Este rascunho foi criado para outra revisão do plano. <button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-restart">Recomeçar rascunho</button></div>'
    : "";
  return (
    staleWarning +
    renderRetaFinalEditorForm(session.draft, session.blockId, {
      catalog: session.editais,
      activeTimerIds: session.activeTimerIds,
    })
  );
}

function mountPanel(session) {
  const doc = session.doc || document;
  let overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.className = "rf-detail-overlay";
    overlay.dataset.rfDetailOverlay = "";
    overlay.innerHTML =
      '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar editor"></button>' +
      '<div class="rf-detail-panel" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1"></div>';
    doc.body.append(overlay);
    beginRetaFinalDialog(doc);
  }
  const panel = overlay.querySelector("[data-rf-detail-panel]");
  panel.innerHTML = panelHtml(session);
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditorPanel(doc);
    } else if (event.key === "Tab") {
      trapRetaFinalDialogFocus(panel, event);
    }
  };
  session.panel = panel;
  const firstField = panel.querySelector("select, input, textarea");
  if (firstField) firstField.focus();
  return panel;
}

function closeEditorPanel(doc = document) {
  closeRetaFinalBlockDetail(doc);
}

function readForm(panel) {
  const changes = {};
  const form = panel.querySelector("[data-rf-editor-form]");
  if (!form) return changes;
  for (const name of [
    "discId",
    "dataPlanejada",
    "minutos",
    "prioridade",
    "ordem",
    "observacao",
  ]) {
    const field = form.elements.namedItem(name);
    if (field) changes[name] = field.value;
  }
  const fixado = form.elements.namedItem("fixado");
  if (fixado) changes.fixado = fixado.checked;
  return changes;
}

async function commitChanges(session, changes) {
  if (session.stale) {
    return {
      valid: false,
      errors: [{ code: "BASE_STALE", message: "Rascunho desatualizado." }],
    };
  }
  const block = findBlock(session.draft, session.blockId);
  if (!block) {
    return {
      valid: false,
      errors: [
        { code: "BLOCO_AUSENTE", message: "Bloco ausente no rascunho." },
      ],
    };
  }
  const { patch, errors } = buildRetaFinalEditorPatch(changes, block);
  if (errors.length) {
    return {
      valid: false,
      errors: errors.map((message) => ({ code: "CAMPO_INVALIDO", message })),
    };
  }
  let adjusted = false;
  if (patch.discId && !patch.topicos) {
    const destino = findDisciplina(session.editais, patch.discId);
    const primeiro = (destino?.assuntos || [])[0];
    if (!primeiro) {
      return {
        valid: false,
        errors: [
          {
            code: "DISCIPLINA_SEM_ASSUNTOS",
            message:
              "A disciplina de destino não possui assuntos; vincule um tópico antes de salvar.",
          },
        ],
      };
    }
    patch.topicos = [{ assId: primeiro.id, aulaId: null }];
    adjusted = true;
  }
  const result = await patchSession(session, patch);
  if (result.valid && adjusted) result.adjusted = true;
  return result;
}

/**
 * Abre o editor individual, criando ou reutilizando o rascunho do plano.
 * @param {string} blockId
 * @param {Object} options - Injeção para testes: plan, editais, eventos, db, today.
 */
export async function openRetaFinalEditor(blockId, options = {}) {
  const plan = options.plan || state.planejamento;
  if (
    !plan?.ativo ||
    plan.tipo !== "reta_final" ||
    plan.schemaVersionRetaFinal !== 2
  ) {
    throw new Error("O editor exige uma Reta Final v2 ativa.");
  }
  const block = (plan.retaFinal?.blocos || []).find(
    (item) => item?.id === blockId,
  );
  if (!block) throw new Error("Bloco não encontrado no plano atual.");
  const db = options.db || storeDb;
  if (!db) throw new Error("IndexedDB indisponível para o rascunho.");
  const draftId = options.draftId || editorDraftId(plan);
  let draft = options.draft || (await loadRetaFinalDraft(db, draftId));
  if (!draft || draft.state !== "editing") {
    draft = createRetaFinalDraft(plan, {
      draftId,
      now: new Date().toISOString(),
    });
    await saveRetaFinalDraft(db, draft);
  }
  const session = {
    blockId,
    draft,
    stale: draft.planId !== plan.planId || draft.baseRevision !== plan.revision,
    db,
    plan,
    editais: options.editais || state.editais || [],
    eventos: options.eventos || state.eventos || [],
    today: options.today || todayStr(),
    activeTimerIds:
      options.activeTimerIds ||
      activeBlockIds(options.eventos || state.eventos),
    deviceId: options.deviceId,
    doc: options.doc || document,
  };
  sessions.set(blockId, session);
  mountPanel(session);
  return session;
}

/**
 * Aplica uma alteração de campo ao rascunho e persiste.
 * @returns {Promise<{valid:boolean, draft:Object, diff?:Array, errors?:Array}>}
 */
export async function handleRetaFinalEditField({
  draftId,
  blockId,
  field,
  value,
  draft,
  db,
  plan = state.planejamento,
  editais = state.editais || [],
  eventos = state.eventos || [],
  today = todayStr(),
  activeTimerIds,
} = {}) {
  const session = sessions.get(blockId) || {
    blockId,
    draft:
      draft || (db && draftId ? await loadRetaFinalDraft(db, draftId) : null),
    db: db || storeDb,
    plan,
    editais,
    eventos,
    today,
    activeTimerIds: activeTimerIds ?? activeBlockIds(eventos || state.eventos),
  };
  if (!session.draft) {
    return {
      valid: false,
      errors: [{ code: "DRAFT_MISSING", message: "Rascunho não encontrado." }],
    };
  }
  session.stale =
    session.draft.planId !== session.plan.planId ||
    session.draft.baseRevision !== session.plan.revision;
  const result = await commitChanges(session, { [field]: value });
  if (sessions.has(blockId)) mountPanel(session);
  return result;
}

function currentSession(el) {
  const panel = el.closest("[data-rf-detail-panel]");
  const form = panel?.querySelector("[data-rf-editor-form]");
  const blockId = form?.dataset.blocoId;
  return { panel, form, blockId, session: sessions.get(blockId) };
}

async function persistTopicos(session, topicos, extraIntents = []) {
  const intents = [...(session.draft.catalogIntents || []), ...extraIntents];
  return applyCommand(
    session,
    {
      operationId: "rf-edit-" + uid(),
      type: "PATCH",
      blockIds: [session.blockId],
      patch: { topicos },
    },
    {
      candidate: { ...session.draft, catalogIntents: intents },
      context: contextFor(session, { catalogIntents: intents }),
    },
  );
}

function toastErrors(result) {
  const message =
    result?.errors?.[0]?.message ||
    "Não foi possível salvar a alteração no rascunho.";
  showToast(message, "error");
}

export function registerRetaFinalEditorActions() {
  registerAction("rf-plan-preview", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    return import("./reta-final-apply.js").then(
      ({ openRetaFinalApplyPreview }) => openRetaFinalApplyPreview(session),
    );
  });

  registerAction("rf-open-editor", (el) => {
    const blocoId = el.dataset.blocoId;
    return openRetaFinalEditor(blocoId)
      .then(() => true)
      .catch((error) => {
        showToast(error.message || "Não foi possível abrir o editor.", "error");
        return false;
      });
  });

  registerAction("rf-editor-save", async (el) => {
    const { panel, session } = currentSession(el);
    if (!session) return;
    const result = await commitChanges(session, readForm(panel));
    if (!result.valid) {
      toastErrors(result);
      return;
    }
    mountPanel(session);
    showToast("Rascunho salvo. O plano oficial continua intacto.", "success");
  });

  registerAction("rf-editor-add-assunto", async (el) => {
    const { form, session } = currentSession(el);
    if (!session || !form) return;
    const id = form.querySelector("[data-rf-editor-assunto]")?.value;
    const block = findBlock(session.draft, session.blockId);
    if (!id) {
      showToast("Selecione um assunto existente.", "error");
      return;
    }
    const topicos = [...(block.topicos || [])];
    if (topicos.some((topico) => topico?.assId === id)) {
      showToast("Este assunto já está no bloco.", "info");
      return;
    }
    const result = await persistTopicos(session, [
      ...topicos,
      { assId: id, aulaId: null },
    ]);
    if (!result.valid) return toastErrors(result);
    mountPanel(session);
  });

  registerAction("rf-editor-add-aula", async (el) => {
    const { form, session } = currentSession(el);
    if (!session || !form) return;
    const id = form.querySelector("[data-rf-editor-aula]")?.value;
    const block = findBlock(session.draft, session.blockId);
    if (!id) {
      showToast("Selecione uma aula existente.", "error");
      return;
    }
    const topicos = [...(block.topicos || [])];
    if (topicos.some((topico) => topico?.aulaId === id)) {
      showToast("Esta aula já está no bloco.", "info");
      return;
    }
    const result = await persistTopicos(session, [
      ...topicos,
      { assId: null, aulaId: id },
    ]);
    if (!result.valid) return toastErrors(result);
    mountPanel(session);
  });

  registerAction("rf-editor-remove-topic", async (el) => {
    const { session } = currentSession(el);
    if (!session) return;
    const index = Number(el.dataset.index);
    const field = el.dataset.field === "aulaId" ? "aulaId" : "assId";
    const block = findBlock(session.draft, session.blockId);
    const topicos = (block.topicos || []).map((topico) => ({ ...topico }));
    if (!Number.isInteger(index) || index < 0 || index >= topicos.length)
      return;
    const target = { ...topicos[index], [field]: null };
    const next = topicos
      .map((topico, position) => (position === index ? target : topico))
      .filter((topico) => topico.assId != null || topico.aulaId != null);
    if (!next.length) {
      showToast("O bloco precisa de ao menos um assunto ou aula.", "error");
      return;
    }
    const result = await persistTopicos(session, next);
    if (!result.valid) return toastErrors(result);
    mountPanel(session);
  });

  const createEntity = async (el, entity, inputName) => {
    const { form, session } = currentSession(el);
    if (!session || !form) return;
    const input = form.elements.namedItem(inputName);
    const nome = String(input?.value || "").trim();
    if (!nome) {
      showToast("Informe o nome do novo item.", "error");
      return;
    }
    const block = findBlock(session.draft, session.blockId);
    const resolution = resolveRetaFinalEditorTopic(session.editais, {
      discId: block.discId,
      entity,
      nome,
      makeId: () => uid(),
      existingIntents: session.draft.catalogIntents || [],
    });
    if (!resolution.valid) {
      showToast(
        resolution.errors[0]?.reason || "Conflito de catálogo.",
        "error",
      );
      return;
    }
    const intent = resolution.intent;
    const ref = resolution.ref;
    const topicos = [...(block.topicos || []), ref];
    const jaVinculado = (block.topicos || []).some((topico) =>
      entity === "assunto"
        ? topico?.assId === ref.assId
        : topico?.aulaId === ref.aulaId,
    );
    if (jaVinculado) {
      showToast("Este item já está no bloco.", "info");
      return;
    }
    const result = await persistTopicos(
      session,
      topicos,
      intent ? [intent] : [],
    );
    if (!result.valid) return toastErrors(result);
    mountPanel(session);
    showToast(
      resolution.existing
        ? "Item existente vinculado ao rascunho."
        : "Item reservado no rascunho. Será criado apenas na aplicação.",
      "success",
    );
  };

  registerAction("rf-editor-create-assunto", (el) =>
    createEntity(el, "assunto", "novoAssunto"),
  );
  registerAction("rf-editor-create-aula", (el) =>
    createEntity(el, "aula", "novaAula"),
  );

  registerAction("rf-editor-discard", (el) => {
    const { session, panel } = currentSession(el);
    if (!session) return;
    showConfirm(
      "Descartar este rascunho? As alterações não aplicadas serão perdidas.",
      async () => {
        try {
          await discardRetaFinalDraft(session.db, session.draft.draftId);
          sessions.delete(session.blockId);
          closeEditorPanel(session.doc || document);
          panel?.remove();
          showToast("Rascunho descartado.", "success");
        } catch {
          showToast("Não foi possível descartar o rascunho.", "error");
        }
      },
      { label: "Descartar", title: "Descartar rascunho" },
    );
  });

  registerAction("rf-editor-restart", async (el) => {
    const session = currentSession(el).session || plannerFrom(el);
    if (!session?.plan) return;
    const fresh = createRetaFinalDraft(session.plan, {
      draftId: session.draft.draftId,
      now: new Date().toISOString(),
    });
    try {
      await saveRetaFinalDraft(session.db, fresh);
    } catch (error) {
      showToast(
        error?.message || "Não foi possível recriar o rascunho.",
        "error",
      );
      return;
    }
    session.draft = fresh;
    session.stale = false;
    session.selectedIds = new Set(
      computeRetaFinalSelection(fresh.snapshot.retaFinal.blocos || [], {
        filter: session.filter || {},
        mode: "visible",
      }).visibleBlockIds,
    );
    if (session.blockId) mountPanel(session);
    else mountPlannerPanel(session);
    showToast("Rascunho recriado a partir do plano atual.", "success");
  });

  registerAction("rf-open-planner", (el) => {
    return openRetaFinalPlanner()
      .then(() => true)
      .catch((error) => {
        showToast(
          error.message || "Não foi possível abrir o planejamento.",
          "error",
        );
        return false;
      });
  });

  registerAction("rf-plan-filter", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    session.filter = {
      ...session.filter,
      [el.dataset.field]: el.value || undefined,
    };
    const blocks = session.draft.snapshot.retaFinal.blocos || [];
    const visible = computeRetaFinalSelection(blocks, {
      filter: session.filter,
      mode: "visible",
    }).visibleBlockIds;
    session.selectedIds = new Set(visible);
    mountPlannerPanel(session);
  });

  registerAction("rf-plan-select-visible", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const blocks = session.draft.snapshot.retaFinal.blocos || [];
    session.mode = "visible";
    session.selectedIds = new Set(
      computeRetaFinalSelection(blocks, {
        filter: session.filter,
        mode: "visible",
      }).visibleBlockIds,
    );
    mountPlannerPanel(session);
  });

  registerAction("rf-plan-select-all", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const blocks = session.draft.snapshot.retaFinal.blocos || [];
    session.mode = "all";
    session.selectedIds = new Set(
      computeRetaFinalSelection(blocks, { filter: session.filter, mode: "all" })
        .allBlockIds,
    );
    mountPlannerPanel(session);
  });

  registerAction("rf-plan-clear", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    session.selectedIds = new Set();
    session.mode = "visible";
    mountPlannerPanel(session);
  });

  registerAction("rf-plan-toggle", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const id = el.dataset.blocoId;
    if (!id) return;
    if (el.checked) session.selectedIds.add(id);
    else session.selectedIds.delete(id);
    const panel = el.closest("[data-rf-detail-panel]");
    const count = panel?.querySelector("[data-rf-plan-count]");
    if (count)
      count.textContent =
        plannerSelection(session).ids.length + " selecionado(s)";
  });

  const runBulk = async (el, action, input) => {
    const session = plannerFrom(el);
    if (!session) return;
    await applyPlannerBulk(session, action, input);
  };

  registerAction("rf-plan-move", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const panel = el.closest("[data-rf-detail-panel]");
    const targetDate =
      panel?.querySelector("[data-rf-plan-move-date]")?.value || "";
    return runBulk(el, "MOVE", { targetDate });
  });

  registerAction("rf-plan-drop", (el) =>
    runBulk(el, "MOVE", { targetDate: el.dataset.date }),
  );

  registerAction("rf-plan-duration", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const panel = el.closest("[data-rf-detail-panel]");
    const minutos = panel?.querySelector("[data-rf-plan-duration]")?.value;
    return runBulk(el, "SET_DURATION", { minutos });
  });

  registerAction("rf-plan-priority", (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const panel = el.closest("[data-rf-detail-panel]");
    const prioridade = panel?.querySelector("[data-rf-plan-priority]")?.value;
    return runBulk(el, "SET_PRIORITY", { prioridade });
  });

  registerAction("rf-plan-duplicate", (el) => runBulk(el, "DUPLICATE", {}));
  registerAction("rf-plan-archive", (el) => runBulk(el, "ARCHIVE", {}));
  registerAction("rf-plan-redistribute", async (el) => {
    const session = plannerFrom(el);
    if (!session) return;
    const proposal = proposeRetaFinalRedistribution(session.draft.snapshot, {
      today: session.today,
      activeTimerIds: session.activeTimerIds,
    });
    if (!proposal.valid) {
      showToast(
        proposal.diagnostics?.[0] ||
          "Não foi possível redistribuir: configure a capacidade diária.",
        "error",
      );
      return;
    }
    if (!proposal.operations.length) {
      showToast("Nenhum movimento necessário na redistribuição.", "info");
      return;
    }
    const result = await applyCommandsAtomically(session, proposal.operations);
    if (!result.valid) {
      showToast(
        result.errors?.[0]?.message || "Redistribuição recusada.",
        "error",
      );
      return;
    }
    mountPlannerPanel(session);
    showToast(
      proposal.operations.length +
        " movimento(s) no rascunho · " +
        proposal.unallocated.length +
        " sem alocação. Nada foi publicado.",
      "success",
    );
  });
}

function plannerFrom(el) {
  const panel = el.closest("[data-rf-detail-panel]");
  const root = panel?.querySelector("[data-rf-planner]");
  const planId = root?.dataset.planId;
  return plannerSessions.get(planId) || null;
}

function plannerSelection(session) {
  const blocks = session.draft.snapshot.retaFinal.blocos || [];
  const base = computeRetaFinalSelection(blocks, {
    filter: session.filter,
    mode: session.mode,
  });
  const scope =
    session.mode === "all" ? base.allBlockIds : base.visibleBlockIds;
  const ids = scope.filter((id) => session.selectedIds.has(id));
  return {
    visibleBlockIds: base.visibleBlockIds,
    allBlockIds: base.allBlockIds,
    mode: session.mode,
    ids,
    count: ids.length,
  };
}

function mountPlannerPanel(session) {
  const doc = session.doc || document;
  let overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.className = "rf-detail-overlay";
    overlay.dataset.rfDetailOverlay = "";
    overlay.innerHTML =
      '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar planejamento"></button>' +
      '<div class="rf-detail-panel rf-detail-panel--planner" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1"></div>';
    doc.body.append(overlay);
    beginRetaFinalDialog(doc);
  }
  const panel = overlay.querySelector("[data-rf-detail-panel]");
  const selection = plannerSelection(session);
  panel.innerHTML =
    (session.stale
      ? '<div class="restore-preview-warning" role="alert">Rascunho criado para outra revisão do plano. <button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-restart">Recomeçar rascunho</button></div>'
      : "") +
    renderRetaFinalPlanner(session.draft, {
      today: session.today,
      catalog: session.editais,
      filter: session.filter,
      selection,
    });
  const root = panel.querySelector("[data-rf-planner]");
  if (root) {
    root.dataset.planId = session.plan.planId;
    root.dataset.draftId = session.draft.draftId;
  }
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditorPanel(doc);
    } else if (event.key === "Tab") {
      trapRetaFinalDialogFocus(panel, event);
    }
  };
  if (panel.dataset.dragWired !== "true") {
    panel.dataset.dragWired = "true";
    panel.addEventListener("dragstart", (event) => {
      const row = event.target.closest("[data-rf-plan-block]");
      if (!row) return;
      session.dragging = row.dataset.rfPlanBlock;
      if (!session.selectedIds.has(session.dragging)) {
        session.selectedIds = new Set([session.dragging]);
      }
      event.dataTransfer?.setData("text/plain", session.dragging);
    });
    panel.addEventListener("dragover", (event) => {
      if (event.target.closest("[data-rf-plan-day]")) event.preventDefault();
    });
    panel.addEventListener("drop", (event) => {
      const day = event.target.closest("[data-rf-plan-day]");
      if (!day || !session.selectedIds.size) return;
      event.preventDefault();
      applyPlannerBulk(session, "MOVE", { targetDate: day.dataset.rfPlanDay });
    });
  }
  const first = panel.querySelector("select, input, button");
  if (first) first.focus();
}

async function applyCommandsAtomically(session, commands) {
  let candidate = session.draft;
  const diffs = [];
  for (const command of commands) {
    const result = appendRetaFinalDraftOperation(
      candidate,
      command,
      contextFor(session),
    );
    if (!result.valid) return result;
    candidate = result.draft;
    diffs.push(...(result.diff || []));
  }
  try {
    await saveRetaFinalDraft(session.db, candidate);
  } catch (error) {
    return {
      valid: false,
      draft: session.draft,
      errors: [
        {
          code: "DRAFT_SAVE_FAILED",
          message: error?.message || "Falha ao salvar o rascunho.",
        },
      ],
    };
  }
  session.draft = candidate;
  return { valid: true, draft: candidate, diff: diffs, errors: [] };
}

async function applyPlannerBulk(session, action, input) {
  const selection = plannerSelection(session);
  const built = createBulkRetaFinalCommand(selection, action, input);
  if (!built.valid) {
    showToast(built.errors[0]?.message || "Lote inválido.", "error");
    return;
  }
  const result = await applyCommand(session, built.command);
  if (!result.valid) {
    showToast(
      result.errors[0]?.message || "O lote foi recusado por completo.",
      "error",
    );
    return;
  }
  session.selectedIds = new Set(built.command.blockIds);
  session.mode = "visible";
  mountPlannerPanel(session);
  showToast(
    "Lote aplicado ao rascunho. Nada foi publicado no plano oficial.",
    "success",
  );
}

/**
 * Abre o Modo Planejamento sobre o rascunho do plano.
 */
export async function openRetaFinalPlanner(options = {}) {
  const plan = options.plan || state.planejamento;
  if (
    !plan?.ativo ||
    plan.tipo !== "reta_final" ||
    plan.schemaVersionRetaFinal !== 2
  ) {
    throw new Error("O Modo Planejamento exige uma Reta Final v2 ativa.");
  }
  const db = options.db || storeDb;
  if (!db) throw new Error("IndexedDB indisponível para o rascunho.");
  const draftId = options.draftId || editorDraftId(plan);
  let draft = options.draft || (await loadRetaFinalDraft(db, draftId));
  if (!draft || draft.state !== "editing") {
    draft = createRetaFinalDraft(plan, {
      draftId,
      now: new Date().toISOString(),
    });
    await saveRetaFinalDraft(db, draft);
  }
  const blocks = draft.snapshot.retaFinal.blocos || [];
  const session = {
    plan,
    draft,
    stale: draft.planId !== plan.planId || draft.baseRevision !== plan.revision,
    db,
    editais: options.editais || state.editais || [],
    eventos: options.eventos || state.eventos || [],
    today: options.today || todayStr(),
    activeTimerIds:
      options.activeTimerIds ||
      activeBlockIds(options.eventos || state.eventos),
    deviceId: options.deviceId,
    doc: options.doc || document,
    filter: options.filter || {},
    mode: "visible",
    selectedIds: new Set(
      computeRetaFinalSelection(blocks, {
        filter: options.filter || {},
        mode: "visible",
      }).visibleBlockIds,
    ),
  };
  plannerSessions.set(plan.planId, session);
  mountPlannerPanel(session);
  return session;
}
