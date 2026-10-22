/** Lista de operações aplicadas com desfazer/refazer. */

import { esc } from "../utils.js?v=8.37";

const TYPE_LABEL = {
  CREATE: "Criar bloco",
  PATCH: "Editar bloco",
  MOVE: "Mover bloco",
  DUPLICATE: "Duplicar bloco",
  ARCHIVE: "Arquivar bloco",
  UNARCHIVE: "Restaurar bloco",
  SET_DURATION: "Alterar duração",
  SET_PRIORITY: "Alterar prioridade",
  SET_CAPACITY: "Alterar capacidade",
  SET_MINUTOS_PADRAO: "Alterar duração padrão",
  EXTEND_DEADLINE: "Prorrogar prazo",
  MOVE_TO_DRAFT: "Restauração",
  RESTORE: "Restauração",
};

export function renderRetaFinalOperations(operations = []) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return '<p class="config-desc">Nenhuma operação aplicada neste plano.</p>';
  }
  return (
    '<ul class="rf-operation-list">' +
    operations
      .map((operation, index) => {
        const label = TYPE_LABEL[operation?.type] || operation?.type || "Operação";
        const blocks = Array.isArray(operation?.blockIds)
          ? operation.blockIds.join(", ")
          : "";
        const canUndo = operation?.inverseAvailable === true;
        const canRedo =
          operation?.historyAction === "undo" &&
          operation?.inverseAvailable !== false;
        return (
          '<li class="rf-operation-item" data-operation-index="' +
          index +
          '">' +
          '<div><strong>' +
          esc(label) +
          "</strong>" +
          '<span class="rf-operation-meta">revisão ' +
          esc(String(operation?.committedRevision ?? "?")) +
          (blocks ? " · " + esc(blocks) : "") +
          (operation?.historyAction === "undo" ? " · desfazer" : "") +
          "</span></div>" +
          '<div class="rf-operation-actions">' +
          (canUndo
            ? '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-undo-operation" data-index="' +
              index +
              '">Desfazer</button>'
            : '<span class="rf-operation-blocked">Sem inverso seguro</span>') +
          (canRedo
            ? '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-redo-operation" data-index="' +
              index +
              '">Refazer</button>'
            : "") +
          "</div>" +
          "</li>"
        );
      })
      .join("") +
    "</ul>" +
    '<p class="config-desc">Desfazer/refazer cria um novo rascunho e passa pela prévia. Operações posteriores, timers ativos ou conflitos podem bloquear a inversão.</p>'
  );
}
