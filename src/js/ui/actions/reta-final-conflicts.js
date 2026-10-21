/**
 * Delegated actions for the Reta Final conflict review.
 *
 * The view never applies anything by itself. This module asks for an explicit
 * confirmation, parses manual input, and delegates the durable work to the
 * single transaction in `store/reta-final-commit.js`.
 */
import { registerAction } from "./dispatcher.js";
import { showConfirm, showToast } from "../../app.js?v=8.37";
import { renderCurrentView } from "../../components.js?v=8.37";
import { collectRetaFinalConflicts } from "../../views/reta-final-conflicts.js?v=8.37";
import { resolveRetaFinalConflictAtomically } from "../../store/reta-final-commit.js";
import {
  db as defaultDb,
  publishRetaFinalCommit,
  state as liveState,
} from "../../store.js?v=8.37";

const CHOICES = new Set(["local", "remote", "manual"]);
const runtime = {
  resolve: resolveRetaFinalConflict,
  confirm: showConfirm,
  notify: showToast,
  refresh: renderCurrentView,
  sync: null,
};
let registered = false;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function conflictCard(element) {
  return element?.closest?.("[data-rf-conflict-card]") || null;
}

function selectedChoice(card) {
  return card?.querySelector?.('input[type="radio"]:checked')?.value || null;
}

function parseManualPatch(card) {
  const textarea = card?.querySelector?.(".rf-conflict-manual-input");
  const raw = typeof textarea?.value === "string" ? textarea.value.trim() : "";
  if (!raw) {
    return {
      valid: false,
      message: "Informe um JSON válido para resolver manualmente.",
    };
  }
  try {
    const patch = JSON.parse(raw);
    if (!isRecord(patch) || Object.keys(patch).length === 0) {
      return {
        valid: false,
        message:
          "O JSON manual precisa ser um objeto com pelo menos uma alteração.",
      };
    }
    return { valid: true, patch };
  } catch {
    return { valid: false, message: "JSON inválido. Nada foi gravado." };
  }
}

function setManualFeedback(card, message, isError = false) {
  const status = card?.querySelector?.("[data-rf-conflict-manual-status]");
  if (status) {
    status.textContent = message || "";
    status.classList.toggle("rf-conflict-manual-status--error", !!isError);
  }
  const textarea = card?.querySelector?.(".rf-conflict-manual-input");
  if (textarea) {
    if (isError) textarea.setAttribute("aria-invalid", "true");
    else textarea.removeAttribute("aria-invalid");
  }
}

function resetCard(card) {
  if (!card) return;
  card.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.checked = false;
  });
  const textarea = card.querySelector(".rf-conflict-manual-input");
  if (textarea) textarea.value = "";
  setManualFeedback(card, "Conflito mantido; nada foi gravado.", false);
  const cancel = card.querySelector('[data-action="rf-conflict-cancel"]');
  cancel?.focus?.();
}

function confirmationMessage(choice, conflictId) {
  if (choice === "remote") {
    return `Usar o plano remoto para resolver ${conflictId}? A versão local será preservada em um checkpoint antes da troca.`;
  }
  if (choice === "manual") {
    return `Aplicar o plano editado para resolver ${conflictId}? A versão local será preservada em um checkpoint antes da gravação.`;
  }
  return `Manter a versão deste dispositivo para resolver ${conflictId}? A versão local será preservada em um checkpoint e uma nova revisão será criada.`;
}

function failureMessage(result) {
  if (result?.reason === "RETA_FINAL_STALE") {
    return "A revisão local mudou. O conflito foi mantido; revise novamente.";
  }
  if (result?.reason === "RETA_FINAL_CONFLICT") {
    return result.message || "O conflito não pôde ser aplicado e foi mantido.";
  }
  return (
    result?.message || "Não foi possível resolver o conflito. Nada foi gravado."
  );
}

async function applyConflict(element) {
  const card = conflictCard(element);
  if (!card) {
    runtime.notify(
      "Abra a revisão do conflito para aplicar uma escolha.",
      "error",
    );
    return;
  }
  const conflictId = card.dataset.conflictId;
  const choice = selectedChoice(card);
  if (!CHOICES.has(choice)) {
    runtime.notify("Escolha uma opção antes de aplicar.", "error");
    return;
  }

  let patch;
  if (choice === "manual") {
    const parsed = parseManualPatch(card);
    if (!parsed.valid) {
      setManualFeedback(card, parsed.message, true);
      runtime.notify(parsed.message, "error");
      return;
    }
    patch = parsed.patch;
  }

  return new Promise((resolveApply) => {
    runtime.confirm(
      confirmationMessage(choice, conflictId),
      async () => {
        try {
          const result = await runtime.resolve(
            conflictId,
            { choice, patch },
            {
              confirmed: true,
              online:
                typeof navigator === "undefined" || navigator.onLine !== false,
            },
          );
          if (!result?.applied) {
            runtime.notify(failureMessage(result), "error");
            return;
          }
          runtime.notify(
            "Conflito resolvido localmente. A sincronização continua pendente até o Firestore confirmar.",
            "success",
          );
          runtime.refresh?.();
        } finally {
          resolveApply();
        }
      },
      {
        title: "Resolver conflito da Reta Final",
        label: "Aplicar resolução",
        danger: choice === "remote",
      },
    );
  });
}

function cancelConflict(element) {
  const card = conflictCard(element);
  resetCard(card);
  runtime.notify("Conflito mantido. Nenhuma alteração foi gravada.", "info");
}

function handleManualInput(element) {
  const card = conflictCard(element);
  setManualFeedback(card, "");
}

function handleEscape(event) {
  if (event.key !== "Escape") return;
  const review = event.target?.closest?.("[data-rf-conflict-review]");
  if (!review) return;
  event.preventDefault();
  event.stopPropagation();
  const cancel = review.querySelector('[data-action="rf-conflict-cancel"]');
  if (cancel) cancelConflict(cancel);
}

/**
 * Resolves one conflict with an explicit confirmation gate. The durable write
 * happens in one IndexedDB transaction over state, checkpoint and journal.
 */
export async function resolveRetaFinalConflict(
  conflictId,
  { choice, patch } = {},
  options = {},
) {
  if (options.confirmed !== true) {
    return { applied: false, reason: "CONFIRMATION_REQUIRED" };
  }
  if (!CHOICES.has(choice)) {
    return { applied: false, reason: "INVALID_CHOICE" };
  }
  if (
    choice === "manual" &&
    (!isRecord(patch) || Object.keys(patch).length === 0)
  ) {
    return { applied: false, reason: "INVALID_PATCH" };
  }

  const sourceState = options.state || liveState;
  const conflict = collectRetaFinalConflicts(sourceState).find(
    (item) => item.conflictId === conflictId,
  );
  if (!conflict) {
    return { applied: false, reason: "CONFLICT_NOT_FOUND" };
  }
  const database = options.db || defaultDb;
  if (!database || typeof database.transaction !== "function") {
    return { applied: false, reason: "DB_UNAVAILABLE" };
  }

  try {
    const result = await resolveRetaFinalConflictAtomically({
      db: database,
      conflictId,
      choice,
      patch: choice === "manual" ? patch : undefined,
      expectedPlanId: conflict.planId,
      expectedRevision: conflict.localRevision,
      now: options.now,
      deviceId: options.deviceId,
      operationId: options.operationId,
      checkpointId: options.checkpointId,
    });
    if (options.publish !== false) {
      try {
        publishRetaFinalCommit(result.state, result);
      } catch (error) {
        console.error(
          "Reta Final: conflito durável; falha ao publicar estado em memória.",
          error,
        );
      }
    }
    let syncResult = { queued: false, flushed: false };
    const shouldSync =
      options.sync !== false && !(options.db && options.sync === undefined);
    if (shouldSync) {
      try {
        const sync =
          typeof options.sync === "function"
            ? options.sync
            : runtime.sync || (await defaultSyncResolvedState());
        syncResult = (await sync()) || { queued: false, flushed: false };
      } catch (error) {
        console.error("Reta Final: resolução local; sync pendente.", error);
      }
    }
    return {
      applied: true,
      revision: result.revision,
      operationId: result.operationId,
      checkpointId: result.checkpointId,
      localCommitted: true,
      syncStatus: "pending",
      queued: syncResult.queued === true,
      flushed: syncResult.flushed === true,
    };
  } catch (error) {
    return {
      applied: false,
      reason: error?.code || error?.name || "TRANSACTION_FAILED",
      message: error?.message || String(error),
    };
  }
}

async function defaultSyncResolvedState() {
  return async () => {
    const engine = await import("../../sync/firestore-sync-engine.js?v=8.37");
    const queued = await engine.queueFirestoreSnapshotFromState(liveState, {
      manual: true,
    });
    if (!queued) return { queued: false, flushed: false };
    const flushed = await engine.flushFirestoreOutbox({ manual: true });
    return { queued: true, flushed: flushed === true };
  };
}

/** Registers the delegated handlers once; repeated calls only refresh test seams. */
export function registerRetaFinalConflictActions(options = {}) {
  if (options.resolve) runtime.resolve = options.resolve;
  if (options.confirm) runtime.confirm = options.confirm;
  if (options.notify) runtime.notify = options.notify;
  if (options.refresh) runtime.refresh = options.refresh;
  if (options.sync) runtime.sync = options.sync;
  if (registered) return;
  registered = true;
  registerAction("rf-conflict-apply", applyConflict);
  registerAction("rf-conflict-cancel", cancelConflict);
  registerAction("rf-conflict-manual-input", handleManualInput);
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", handleEscape);
  }
}
