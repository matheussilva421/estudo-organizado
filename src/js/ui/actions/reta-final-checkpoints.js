/**
 * Restauração de checkpoints da Reta Final via rascunho.
 *
 * Nenhuma operação escreve no plano oficial: as operações viram um commit
 * atômico somente depois da prévia e da confirmação do usuário.
 */

import { registerAction } from "./dispatcher.js";
import { showToast } from "../../app.js?v=8.37";
import {
  db as storeDb,
  loadRetaFinalDraft,
  saveRetaFinalDraft,
  state,
} from "../../store.js?v=8.37";
import { todayStr } from "../../utils.js?v=8.37";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../logic/reta-final-drafts.js";
import { proposeRetaFinalRestore } from "../../logic/reta-final-history.js";
import { listRetaFinalCheckpoints } from "../../store/reta-final-history-store.js";
import {
  renderRetaFinalCheckpointBlocks,
  renderRetaFinalCheckpointList,
} from "../../views/reta-final-checkpoints.js";
import {
  beginRetaFinalDialog,
  closeRetaFinalBlockDetail,
  trapRetaFinalDialogFocus,
} from "../../views/reta-final-detail.js";

const sessions = new Map();

function editorDraftId(plan) {
  return "reta-final-editor-" + plan.planId;
}

function contextFor(session) {
  return {
    events: session.eventos,
    catalog: session.editais,
    activeTimerIds: session.activeTimerIds,
    today: session.today,
  };
}

/** Aplica todas as operações em um candidato, sem publicar em memória. */
export function appendRestoreOperationsToDraft(draft, operations, context) {
  let candidate = draft;
  const diffs = [];
  for (const operation of operations) {
    const result = appendRetaFinalDraftOperation(candidate, operation, context);
    if (!result.valid) {
      return { valid: false, draft, diff: [], errors: result.errors };
    }
    candidate = result.draft;
    diffs.push(...(result.diff || []));
  }
  return { valid: true, draft: candidate, diff: diffs, errors: [] };
}

/**
 * Propõe e anexa uma restauração ao rascunho. Não persiste nem aplica.
 * @returns {{valid:boolean, draft:Object, proposal?:Object, errors:Array}}
 */
export function restoreRetaFinalCheckpoint(checkpoint, options = {}) {
  const {
    draft,
    plan,
    events = [],
    catalog = [],
    today,
    activeTimerIds = [],
    blockIds,
  } = options;
  if (!draft || !plan) {
    return {
      valid: false,
      draft,
      errors: [{ code: "RESTORE_CONTEXT_MISSING", message: "Plano ou rascunho ausente." }],
    };
  }
  const checkpointBlocks = checkpoint?.plan?.retaFinal?.blocos || [];
  const requested = Array.isArray(blockIds) ? blockIds : null;
  const fullRestore =
    !requested ||
    (requested.length === checkpointBlocks.length &&
      checkpointBlocks.every((block) => requested.includes(block.id)));
  const proposal = proposeRetaFinalRestore(plan, checkpoint, {
    events,
    catalog,
    activeTimerIds,
    today,
    ...(fullRestore ? {} : { blockIds: requested }),
  });
  if (proposal.diagnostics.length) {
    return { valid: false, draft, proposal, errors: proposal.diagnostics };
  }
  const appended = appendRestoreOperationsToDraft(
    draft,
    proposal.operations,
    { events, catalog, activeTimerIds, today },
  );
  if (!appended.valid) return { ...appended, proposal };
  return { valid: true, draft: appended.draft, proposal, errors: [] };
}

function mountPanel(session) {
  const doc = session.doc || document;
  let overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.className = "rf-detail-overlay";
    overlay.dataset.rfDetailOverlay = "";
    overlay.innerHTML =
      '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar checkpoints"></button>' +
      '<div class="rf-detail-panel" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1"></div>';
    doc.body.append(overlay);
    beginRetaFinalDialog(doc);
  }
  const panel = overlay.querySelector("[data-rf-detail-panel]");
  panel.innerHTML =
    '<div class="rf-checkpoints">' +
    '<header class="rf-planner-header"><div><div class="rf-detail-eyebrow">Versões</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">Restaurar checkpoint</h3></div></header>' +
    (session.current
      ? renderRetaFinalCheckpointBlocks(session.current)
      : renderRetaFinalCheckpointList(session.checkpoints)) +
    "</div>";
  panel.dataset.checkpointId = session.current?.id || "";
  panel.dataset.planId = session.plan.planId;
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRetaFinalBlockDetail(doc);
    } else if (event.key === "Tab") {
      trapRetaFinalDialogFocus(panel, event);
    }
  };
  const first = panel.querySelector("button:not([disabled]), input");
  if (first) first.focus();
}

/** Abre a lista de checkpoints do plano atual. */
export async function openRetaFinalCheckpoints(options = {}) {
  const plan = options.plan || state.planejamento;
  if (!plan?.ativo || plan.tipo !== "reta_final" || plan.schemaVersionRetaFinal !== 2) {
    throw new Error("Os checkpoints exigem uma Reta Final v2 ativa.");
  }
  const db = options.db || storeDb;
  if (!db) throw new Error("IndexedDB indisponível para os checkpoints.");
  const checkpoints =
    options.checkpoints || (await listRetaFinalCheckpoints(db, plan.planId));
  const session = {
    plan,
    db,
    checkpoints,
    current: null,
    editais: options.editais || state.editais || [],
    eventos: options.eventos || state.eventos || [],
    today: options.today || todayStr(),
    activeTimerIds: options.activeTimerIds || [],
    doc: options.doc || document,
  };
  sessions.set(plan.planId, session);
  mountPanel(session);
  return session;
}

function checkpointFrom(el) {
  const panel = el.closest("[data-rf-detail-panel]");
  const session = sessions.get(panel?.dataset.planId);
  return { session, panel };
}

export function registerRetaFinalCheckpointActions() {
  registerAction("rf-open-checkpoints", () => {
    return openRetaFinalCheckpoints()
      .then(() => true)
      .catch((error) => {
        showToast(error.message || "Não foi possível abrir os checkpoints.", "error");
        return false;
      });
  });

  registerAction("rf-checkpoint-open", (el) => {
    const { session } = checkpointFrom(el);
    if (!session) return;
    const checkpoint = session.checkpoints.find(
      (item) => item.id === el.dataset.checkpointId,
    );
    if (!checkpoint) return;
    session.current = checkpoint;
    mountPanel(session);
  });

  registerAction("rf-checkpoint-back", (el) => {
    const { session } = checkpointFrom(el);
    if (!session) return;
    session.current = null;
    mountPanel(session);
  });

  registerAction("rf-restore-checkpoint", async (el) => {
    const { session, panel } = checkpointFrom(el);
    if (!session?.current) return;
    const checked = [
      ...(panel?.querySelectorAll('input[name="rf-restore-block"]:checked') || []),
    ].map((input) => input.value);
    if (!checked.length) {
      showToast("Selecione ao menos um bloco para restaurar.", "error");
      return;
    }
    let draft = await loadRetaFinalDraft(session.db, editorDraftId(session.plan));
    if (!draft || draft.state !== "editing") {
      draft = createRetaFinalDraft(session.plan, {
        draftId: editorDraftId(session.plan),
        now: new Date().toISOString(),
      });
    }
    const result = restoreRetaFinalCheckpoint(session.current, {
      draft,
      plan: session.plan,
      events: session.eventos,
      catalog: session.editais,
      today: session.today,
      activeTimerIds: session.activeTimerIds,
      blockIds: checked,
    });
    if (!result.valid) {
      showToast(
        result.errors?.[0]?.message || "Restauração recusada.",
        "error",
      );
      return;
    }
    try {
      await saveRetaFinalDraft(session.db, result.draft);
    } catch (error) {
      showToast(error?.message || "Falha ao salvar a restauração.", "error");
      return;
    }
    closeRetaFinalBlockDetail(session.doc || document);
    const { openRetaFinalApplyPreview } = await import("./reta-final-apply.js");
    openRetaFinalApplyPreview({
      draft: result.draft,
      plan: session.plan,
      editais: session.editais,
      eventos: session.eventos,
      today: session.today,
      db: session.db,
    });
  });
}
