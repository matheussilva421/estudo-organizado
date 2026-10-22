/**
 * Seleção e comandos coletivos do Modo Planejamento.
 *
 * A seleção distingue explicitamente o que está visível sob o filtro atual do
 * cronograma completo. Um lote é atômico: o comando carrega todos os alvos e o
 * motor puro rejeita o conjunto inteiro se um deles for protegido.
 */

import { uid } from "../utils.js?v=8.37";

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const BULK_ACTIONS = {
  MOVE: "MOVE",
  SET_DURATION: "SET_DURATION",
  SET_PRIORITY: "SET_PRIORITY",
  DUPLICATE: "DUPLICATE",
  ARCHIVE: "ARCHIVE",
};

function matchesFilter(block, filter) {
  if (!block) return false;
  if (filter.status === "arquivado") {
    if (block.arquivado !== true) return false;
  } else if (block.arquivado === true) {
    return false;
  }
  if (filter.discId && block.discId !== filter.discId) return false;
  if (
    filter.status &&
    filter.status !== "arquivado" &&
    block.status !== filter.status
  )
    return false;
  return true;
}

/** Blocos visíveis sob o filtro (sem alterar o snapshot do draft). */
export function filterRetaFinalPlannerBlocks(blocks = [], filter = {}) {
  return blocks.filter((block) => matchesFilter(block, filter));
}

export function computeRetaFinalSelection(
  blocks = [],
  { filter = {}, mode = "visible", selectedIds } = {},
) {
  const visible = filterRetaFinalPlannerBlocks(blocks, filter);
  const visibleBlockIds = visible.map((block) => block.id);
  const allBlockIds = blocks
    .filter((block) => block?.arquivado !== true)
    .map((block) => block.id);
  const base = mode === "all" ? allBlockIds : visibleBlockIds;
  const chosen =
    Array.isArray(selectedIds) && selectedIds.length
      ? new Set(selectedIds)
      : new Set(base);
  const ids = base.filter((id) => chosen.has(id));
  if (mode === "visible" && !Array.isArray(selectedIds)) {
    return {
      visibleBlockIds,
      allBlockIds,
      mode,
      ids: visibleBlockIds,
      count: visibleBlockIds.length,
    };
  }
  return { visibleBlockIds, allBlockIds, mode, ids, count: ids.length };
}

function civilDate(value) {
  if (!CIVIL_DATE_RE.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

/**
 * Cria o comando coletivo. Drag-and-drop e o botão "Mover para data" devem
 * chamar esta mesma função para produzir um MOVE idêntico.
 * @returns {{valid: boolean, command?: Object, errors: Array}}
 */
export function createBulkRetaFinalCommand(
  selection,
  action,
  input = {},
  { operationId } = {},
) {
  const ids = [...new Set(selection?.ids || [])].filter(Boolean);
  const base = {
    operationId: operationId || "rf-bulk-" + uid(),
    type: action,
    blockIds: ids,
  };
  if (!ids.length) {
    return {
      valid: false,
      errors: [
        { code: "SELECAO_VAZIA", message: "Selecione ao menos um bloco." },
      ],
    };
  }
  if (action === BULK_ACTIONS.MOVE) {
    if (!civilDate(input.targetDate)) {
      return {
        valid: false,
        errors: [
          { code: "DATA_INVALIDA", message: "Informe uma data civil válida." },
        ],
      };
    }
    const command = { ...base, targetDate: input.targetDate };
    if (Number.isSafeInteger(input.targetOrder) && input.targetOrder >= 0) {
      command.targetOrder = input.targetOrder;
    }
    return { valid: true, command, errors: [] };
  }
  if (action === BULK_ACTIONS.SET_DURATION) {
    const minutos = Number(input.minutos);
    if (!Number.isSafeInteger(minutos) || minutos <= 0) {
      return {
        valid: false,
        errors: [
          {
            code: "MINUTOS_INVALIDOS",
            message: "Duração deve ser um inteiro maior que zero.",
          },
        ],
      };
    }
    return {
      valid: true,
      command: { ...base, input: { minutos } },
      errors: [],
    };
  }
  if (action === BULK_ACTIONS.SET_PRIORITY) {
    const raw = input.prioridade;
    const prioridade = raw === "" || raw == null ? null : Number(raw);
    if (
      prioridade !== null &&
      (!Number.isInteger(prioridade) || prioridade < 1 || prioridade > 5)
    ) {
      return {
        valid: false,
        errors: [
          {
            code: "PRIORIDADE_INVALIDA",
            message: "Prioridade deve estar entre 1 e 5.",
          },
        ],
      };
    }
    return {
      valid: true,
      command: { ...base, input: { prioridade } },
      errors: [],
    };
  }
  if ([BULK_ACTIONS.DUPLICATE, BULK_ACTIONS.ARCHIVE].includes(action)) {
    return { valid: true, command: base, errors: [] };
  }
  return {
    valid: false,
    errors: [{ code: "ACAO_INVALIDA", message: "Ação coletiva desconhecida." }],
  };
}

/** Resumo honesto do lote antes de qualquer escrita. */
export function describeBulkRetaFinalCommand(selection, command) {
  const count = command?.blockIds?.length || 0;
  if (!count) return "Nenhum bloco selecionado.";
  if (command.type === BULK_ACTIONS.MOVE) {
    return "Mover " + count + " bloco(s) para " + command.targetDate + ".";
  }
  if (command.type === BULK_ACTIONS.SET_DURATION) {
    return (
      "Definir " + command.input.minutos + " min em " + count + " bloco(s)."
    );
  }
  if (command.type === BULK_ACTIONS.SET_PRIORITY) {
    return (
      "Definir prioridade " +
      (command.input.prioridade ?? "nenhuma") +
      " em " +
      count +
      " bloco(s)."
    );
  }
  if (command.type === BULK_ACTIONS.DUPLICATE)
    return "Duplicar " + count + " bloco(s) sem sessões.";
  if (command.type === BULK_ACTIONS.ARCHIVE)
    return "Arquivar " + count + " bloco(s).";
  return count + " bloco(s) selecionado(s).";
}
