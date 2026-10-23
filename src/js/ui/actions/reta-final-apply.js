/**
 * Ações de prévia e aplicação do rascunho da Reta Final.
 *
 * A aplicação usa o commit atômico da Task 7. O retorno diferencia
 * "localCommitted" de "syncPending"; nenhuma mensagem promete sincronização
 * antes do ACK remoto.
 */

import { registerAction } from "./dispatcher.js";
import { showToast } from "../../app.js?v=8.37";
import { renderCurrentView } from "../../components.js?v=8.37";
import {
  db as storeDb,
  loadRetaFinalDraft,
  state,
} from "../../store.js?v=8.37";
import { todayStr } from "../../utils.js?v=8.37";
import { commitRetaFinalDraft } from "../../logic/reta-final.js";
import { invalidateDashCaches } from "../../logic.js?v=8.37";
import {
  buildRetaFinalImpactPreview,
  renderRetaFinalApplyPreview,
} from "../../views/reta-final-apply-preview.js";
import { resetRetaFinalEditorSessions } from "./reta-final-editor.js";
import {
  beginRetaFinalDialog,
  closeRetaFinalBlockDetail,
  trapRetaFinalDialogFocus,
} from "../../views/reta-final-detail.js";

function mountPreviewPanel(session, preview) {
  const doc = session.doc || document;
  let overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.className = "rf-detail-overlay";
    overlay.dataset.rfDetailOverlay = "";
    overlay.innerHTML =
      '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar prévia"></button>' +
      '<div class="rf-detail-panel rf-detail-panel--planner" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1"></div>';
    doc.body.append(overlay);
    beginRetaFinalDialog(doc);
  }
  const panel = overlay.querySelector("[data-rf-detail-panel]");
  panel.innerHTML = renderRetaFinalApplyPreview(preview, {
    draftId: session.draft.draftId,
  });
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRetaFinalBlockDetail(doc);
    } else if (event.key === "Tab") {
      trapRetaFinalDialogFocus(panel, event);
    }
  };
  const button = panel.querySelector('[data-action="rf-apply-draft"]');
  if (button && !button.disabled) button.focus();
  else panel.querySelector('[data-action="rf-close-detail"]')?.focus();
  return panel;
}

/** Abre a prévia unificada para um rascunho já carregado. */
export function openRetaFinalApplyPreview(session) {
  const current = state.planejamento;
  const basePlan =
    current?.planId === session.plan?.planId ? current : session.plan;
  const preview = buildRetaFinalImpactPreview({
    basePlan,
    draft: session.draft,
    events: session.eventos || [],
    catalog: session.editais || [],
    today: session.today || todayStr(),
    dataProva: state.config?.dataProva || null,
  });
  mountPreviewPanel(session, preview);
  return preview;
}

/**
 * Aplica um rascunho persistido. Rejeita drafts bloqueados/conflitantes.
 * @returns {Promise<{localCommitted:boolean, syncPending:boolean, errors?:Array, result?:Object}>}
 */
export async function applyRetaFinalDraftAction(draftId, options = {}) {
  const db = options.db || storeDb;
  const plan = options.plan || state.planejamento;
  const draft = options.draft || (await loadRetaFinalDraft(db, draftId));
  if (!draft) {
    return {
      localCommitted: false,
      syncPending: false,
      errors: [{ code: "DRAFT_MISSING", message: "Rascunho não encontrado." }],
    };
  }
  const preview = buildRetaFinalImpactPreview({
    basePlan: plan,
    draft,
    events: options.eventos || state.eventos || [],
    catalog: options.editais || state.editais || [],
    today: options.today || todayStr(),
    dataProva: state.config?.dataProva || null,
  });
  if (preview.blocked) {
    return {
      localCommitted: false,
      syncPending: false,
      errors: preview.diagnostics,
      preview,
    };
  }
  const result = await commitRetaFinalDraft({
    db,
    draftId: draft.draftId,
    expectedPlanId: draft.planId,
    expectedRevision: draft.baseRevision,
    context: options.context || {},
  });
  return {
    localCommitted: result.localCommitted !== false,
    syncPending: result.syncPending !== false,
    result,
  };
}

export function registerRetaFinalApplyActions() {
  registerAction("rf-apply-draft", async (el) => {
    const draftId = el.dataset.draftId;
    if (!draftId) return;
    el.disabled = true;
    try {
      const result = await applyRetaFinalDraftAction(draftId);
      if (!result.localCommitted) {
        showToast(
          result.errors?.[0]?.message || "Não foi possível aplicar o rascunho.",
          "error",
        );
        el.disabled = false;
        return;
      }
      resetRetaFinalEditorSessions();
      invalidateDashCaches();
      renderCurrentView();
      closeRetaFinalBlockDetail(document);
      showToast(
        "Aplicado localmente. Sincronização remota pendente até confirmação (ACK).",
        "success",
      );
    } catch (error) {
      el.disabled = false;
      showToast(error.message || "Falha ao aplicar o rascunho.", "error");
    }
  });
}
