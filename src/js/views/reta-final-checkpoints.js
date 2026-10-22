/**
 * Lista e seleção de checkpoints da Reta Final.
 *
 * A restauração é sempre uma nova proposta no rascunho; sessões e eventos
 * posteriores não são reescritos por esta tela.
 */

import { esc } from "../utils.js?v=8.37";

function formatWhen(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.slice(0, 16).replace("T", " ");
}

function checkpointLabel(checkpoint) {
  if (checkpoint?.label) return checkpoint.label;
  return checkpoint?.kind === "manual"
    ? "Checkpoint manual"
    : "Checkpoint automático";
}

function isInvalid(checkpoint) {
  return (
    checkpoint?.integrity === "invalid" ||
    (Array.isArray(checkpoint?.integrityDiagnostics) &&
      checkpoint.integrityDiagnostics.length > 0)
  );
}

/** @returns {string} HTML inerte da lista de checkpoints. */
export function renderRetaFinalCheckpointList(checkpoints = []) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    return '<p class="config-desc">Nenhum checkpoint disponível para este plano.</p>';
  }
  return (
    '<ul class="rf-checkpoint-list">' +
    checkpoints
      .map((checkpoint) => {
        const invalid = isInvalid(checkpoint);
        const id = String(checkpoint?.id || "");
        return (
          '<li class="rf-checkpoint-item' +
          (invalid ? " rf-checkpoint-item--invalid" : "") +
          '">' +
          '<button type="button" class="rf-checkpoint-open" data-action="rf-checkpoint-open" data-checkpoint-id="' +
          esc(id) +
          '"' +
          (invalid ? ' disabled aria-disabled="true"' : "") +
          ">" +
          "<strong>" +
          esc(checkpointLabel(checkpoint)) +
          "</strong>" +
          "<span>" +
          esc(
            "revisão " +
              (checkpoint?.revision ?? "?") +
              " · " +
              formatWhen(checkpoint?.createdAt) +
              " · " +
              (checkpoint?.kind === "manual" ? "manual" : "automático"),
          ) +
          "</span>" +
          (invalid
            ? '<span class="rf-checkpoint-invalid">Inválido: não pode ser restaurado</span>'
            : "") +
          "</button>" +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

/** Lista de blocos do checkpoint para restauração seletiva. */
export function renderRetaFinalCheckpointBlocks(checkpoint) {
  const blocks = checkpoint?.plan?.retaFinal?.blocos || [];
  if (!blocks.length) {
    return '<p class="config-desc">O checkpoint não contém blocos.</p>';
  }
  return (
    '<div class="rf-checkpoint-blocks">' +
    '<p class="config-desc">Escolha os blocos a restaurar. Sessões, questões e tempo registrados depois do checkpoint serão preservados.</p>' +
    '<ul class="rf-checkpoint-block-list">' +
    blocks
      .map(
        (block) =>
          '<li><label><input type="checkbox" name="rf-restore-block" value="' +
          esc(block.id) +
          '" checked> <span>' +
          esc(block.id) +
          "</span> · " +
          esc(String(block.minutos ?? "")) +
          " min · " +
          esc(block.dataPlanejada || block.data || "sem data") +
          "</label></li>",
      )
      .join("") +
    "</ul>" +
    '<div class="rf-checkpoint-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="rf-checkpoint-back">Voltar</button>' +
    '<button type="button" class="btn btn-primary" data-action="rf-restore-checkpoint">Restaurar selecionados no rascunho</button>' +
    "</div>" +
    "</div>"
  );
}

/** Resumo da proposta de restauração (nunca aplica). */
export function renderRetaFinalRestoreSummary(proposal) {
  const operations = proposal?.operations || [];
  const diff = proposal?.diff || [];
  return (
    '<div class="rf-checkpoint-summary" data-rf-restore-summary>' +
    "<p><strong>" +
    operations.length +
    "</strong> operação(ões) proposta(s) · <strong>" +
    diff.length +
    "</strong> bloco(s) alterado(s).</p>" +
    '<p class="config-desc">A restauração cria uma nova revisão no rascunho. O plano oficial só muda após a prévia e a aplicação.</p>' +
    "</div>"
  );
}
