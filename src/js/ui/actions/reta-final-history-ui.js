/** Ações de desfazer/refazer sobre operações aplicadas da Reta Final. */

import { registerAction } from "./dispatcher.js";
import { showToast } from "../../app.js?v=8.37";
import {
  db as storeDb,
  saveRetaFinalDraft,
  state,
} from "../../store.js?v=8.37";
import { todayStr, uid } from "../../utils.js?v=8.37";
import {
  proposeRetaFinalRedo,
  proposeRetaFinalUndo,
} from "../../logic/reta-final-history.js";
import { listRetaFinalOperations } from "../../store/reta-final-history-store.js";
import { renderRetaFinalOperations } from "../../views/reta-final-history-ui.js";
import {
  beginRetaFinalDialog,
  closeRetaFinalBlockDetail,
  trapRetaFinalDialogFocus,
} from "../../views/reta-final-detail.js";

const sessions = new Map();

/**
 * Cria o draft de inversão sem publicar nada.
 * @returns {{valid:boolean, draft:Object|null, proposal?:Object, errors:Array}}
 */
export function buildHistoryDraft(operation, action, options = {}) {
  const {
    plan,
    events = [],
    catalog = [],
    today,
    activeTimerIds = [],
    draftId,
    now,
    makeId,
  } = options;
  const proposal =
    action === "redo"
      ? proposeRetaFinalRedo(plan, operation, {
          draftId,
          now,
          events,
          catalog,
          today,
          activeTimerIds,
          makeId,
        })
      : proposeRetaFinalUndo(plan, operation, {
          draftId,
          now,
          events,
          catalog,
          today,
          activeTimerIds,
          makeId,
        });
  if (proposal.diagnostics.length) {
    return {
      valid: false,
      draft: null,
      proposal,
      errors: proposal.diagnostics,
    };
  }
  return { valid: true, draft: proposal.draft, proposal, errors: [] };
}

function mountPanel(session) {
  const doc = session.doc || document;
  let overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.className = "rf-detail-overlay";
    overlay.dataset.rfDetailOverlay = "";
    overlay.innerHTML =
      '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar histórico"></button>' +
      '<div class="rf-detail-panel" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1"></div>';
    doc.body.append(overlay);
    beginRetaFinalDialog(doc);
  }
  const panel = overlay.querySelector("[data-rf-detail-panel]");
  panel.dataset.planId = session.plan.planId;
  panel.innerHTML =
    '<div class="rf-history-panel"><header class="rf-planner-header"><div>' +
    '<div class="rf-detail-eyebrow">Histórico</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">Desfazer e refazer</h3></div></header>' +
    renderRetaFinalOperations(session.operations) +
    "</div>";
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRetaFinalBlockDetail(doc);
    } else if (event.key === "Tab") {
      trapRetaFinalDialogFocus(panel, event);
    }
  };
  const first = panel.querySelector("button:not([disabled])");
  if (first) first.focus();
  else panel.focus();
}

export async function openRetaFinalHistory(options = {}) {
  const plan = options.plan || state.planejamento;
  if (!plan?.ativo || plan.tipo !== "reta_final" || plan.schemaVersionRetaFinal !== 2) {
    throw new Error("O histórico exige uma Reta Final v2 ativa.");
  }
  const db = options.db || storeDb;
  if (!db) throw new Error("IndexedDB indisponível para o histórico.");
  const operations =
    options.operations || (await listRetaFinalOperations(db, plan.planId));
  const session = {
    plan,
    db,
    operations,
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

function sessionFrom(el) {
  const panel = el.closest("[data-rf-detail-panel]");
  return { session: sessions.get(panel?.dataset.planId), panel };
}

async function applyHistoryAction(el, action) {
  const { session, panel } = sessionFrom(el);
  if (!session) return;
  const index = Number(el.dataset.index);
  const operation = session.operations[index];
  if (!operation) return;
  const result = buildHistoryDraft(operation, action, {
    plan: session.plan,
    events: session.eventos,
    catalog: session.editais,
    today: session.today,
    activeTimerIds: session.activeTimerIds,
    draftId: "reta-final-history-" + uid(),
    now: new Date().toISOString(),
    makeId: () => uid(),
  });
  if (!result.valid) {
    showToast(
      result.errors?.[0]?.message || "Operação não pode ser invertida.",
      "error",
    );
    return;
  }
  try {
    await saveRetaFinalDraft(session.db, result.draft);
  } catch (error) {
    showToast(error?.message || "Falha ao salvar o rascunho de histórico.", "error");
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
  panel?.remove();
}

export function registerRetaFinalHistoryActions() {
  registerAction("rf-open-history", () => {
    return openRetaFinalHistory()
      .then(() => true)
      .catch((error) => {
        showToast(error.message || "Não foi possível abrir o histórico.", "error");
        return false;
      });
  });
  registerAction("rf-undo-operation", (el) => applyHistoryAction(el, "undo"));
  registerAction("rf-redo-operation", (el) => applyHistoryAction(el, "redo"));
}
