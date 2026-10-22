/**
 * Modo Planejamento: calendário por dia, filtros, seleção e ações em massa.
 *
 * Renderiza somente o snapshot do rascunho e emite contratos data-action. As
 * mutações acontecem nos comandos puros e no store de rascunhos.
 */

import { esc } from "../utils.js?v=8.37";
import {
  computeRetaFinalSelection,
  filterRetaFinalPlannerBlocks,
} from "./reta-final-bulk-actions.js";

function formatBrDate(dateStr) {
  const [year, month, day] = String(dateStr || "").split("-");
  if (!year || !month || !day) return "";
  return day + "/" + month + "/" + year;
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? hours + "h " + mins + "min" : hours + "h";
  return mins + "min";
}

function findDisc(catalog, discId) {
  for (const edital of catalog || []) {
    const disc = (edital?.disciplinas || []).find(
      (item) => item?.id === discId,
    );
    if (disc) return disc;
  }
  return null;
}

function topicLabel(block, disc) {
  const names = [];
  for (const topico of block.topicos || []) {
    if (topico?.assId) {
      const assunto = (disc?.assuntos || []).find(
        (item) => item?.id === topico.assId,
      );
      if (assunto?.nome) names.push(assunto.nome);
    }
    if (topico?.aulaId) {
      const aula = (disc?.aulas || []).find(
        (item) => item?.id === topico.aulaId,
      );
      if (aula?.nome) names.push("🎬 " + aula.nome);
    }
  }
  return names.join(" · ");
}

function groupByDate(blocks) {
  const map = new Map();
  for (const block of blocks) {
    const date = block.dataPlanejada || block.data || "";
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(block);
  }
  return [...map.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function renderBlockRow(block, { disc, selected }) {
  const topicos = topicLabel(block, disc);
  return (
    '<li class="rf-planner-block' +
    (selected ? " rf-planner-block--selected" : "") +
    '" data-rf-plan-block="' +
    esc(block.id) +
    '" draggable="true" tabindex="0">' +
    '<label class="rf-planner-check"><input type="checkbox" data-action="rf-plan-toggle" data-bloco-id="' +
    esc(block.id) +
    '"' +
    (selected ? " checked" : "") +
    ' aria-label="Selecionar bloco ' +
    esc(block.id) +
    '"></label>' +
    '<div class="rf-planner-block-body">' +
    '<span class="rf-planner-disc">' +
    esc(disc?.nome || "Disciplina") +
    "</span>" +
    (topicos
      ? '<span class="rf-planner-topicos">' + esc(topicos) + "</span>"
      : "") +
    '<span class="rf-planner-meta">' +
    formatMinutes(block.minutos) +
    (block.prioridade ? " · prioridade " + esc(String(block.prioridade)) : "") +
    (block.fixado ? " · 📌 fixado" : "") +
    "</span>" +
    "</div>" +
    "</li>"
  );
}

function renderDay(entry, { catalog, selected }) {
  const date = entry[0];
  const dayBlocks = entry[1];
  const total = dayBlocks.reduce(
    (sum, block) => sum + (Number(block.minutos) || 0),
    0,
  );
  return (
    '<section class="rf-planner-day" data-rf-plan-day="' +
    esc(date) +
    '">' +
    '<header class="rf-planner-day-header"><span>' +
    esc(formatBrDate(date) || "Sem data") +
    "</span><span>" +
    dayBlocks.length +
    " bloco(s) · " +
    formatMinutes(total) +
    "</span></header>" +
    '<ul class="rf-planner-list">' +
    dayBlocks
      .map((block) =>
        renderBlockRow(block, {
          disc: findDisc(catalog, block.discId),
          selected: selected.has(block.id),
        }),
      )
      .join("") +
    "</ul>" +
    '<button type="button" class="btn btn-ghost btn-sm rf-planner-drop" data-action="rf-plan-drop" data-date="' +
    esc(date) +
    '">Mover selecionados para este dia</button>' +
    "</section>"
  );
}

/**
 * @param {Object} draft
 * @param {{today?: string, filter?: Object, selection?: Object, catalog?: Array}} options
 * @returns {string}
 */
export function renderRetaFinalPlanner(draft, options = {}) {
  const blocks = draft?.snapshot?.retaFinal?.blocos || [];
  const catalog = options.catalog || [];
  const filter = options.filter || {};
  const selection =
    options.selection ||
    computeRetaFinalSelection(blocks, { filter, mode: "visible" });
  const visible = filterRetaFinalPlannerBlocks(blocks, filter);
  const selected = new Set(selection.ids || []);
  const days = groupByDate(visible);
  const totalMinutes = visible.reduce(
    (sum, block) => sum + (Number(block.minutos) || 0),
    0,
  );
  const disciplinas = catalog.flatMap((edital) => edital?.disciplinas || []);

  return (
    '<section class="rf-planner" data-rf-planner>' +
    '<header class="rf-planner-header">' +
    '<div><div class="rf-detail-eyebrow">Modo Planejamento</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">Cronograma editável</h3></div>' +
    '<div class="rf-planner-summary" data-rf-planner-summary>' +
    visible.length +
    " bloco(s) · " +
    formatMinutes(totalMinutes) +
    "</div>" +
    "</header>" +
    '<div class="rf-planner-toolbar">' +
    '<label>Filtrar disciplina<select data-action="rf-plan-filter" data-field="discId"><option value="">Todas</option>' +
    disciplinas
      .map(
        (disc) =>
          '<option value="' +
          esc(disc.id) +
          '"' +
          (filter.discId === disc.id ? " selected" : "") +
          ">" +
          esc(disc.nome) +
          "</option>",
      )
      .join("") +
    "</select></label>" +
    '<label>Filtrar status<select data-action="rf-plan-filter" data-field="status">' +
    '<option value="">Ativos</option>' +
    '<option value="pendente"' +
    (filter.status === "pendente" ? " selected" : "") +
    ">Pendentes</option>" +
    '<option value="concluido"' +
    (filter.status === "concluido" ? " selected" : "") +
    ">Concluídos</option>" +
    '<option value="arquivado"' +
    (filter.status === "arquivado" ? " selected" : "") +
    ">Arquivados</option>" +
    "</select></label>" +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-select-visible">Selecionar visíveis (' +
    selection.visibleBlockIds.length +
    ")</button>" +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-select-all">Todo o cronograma (' +
    selection.allBlockIds.length +
    ")</button>" +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-clear">Limpar seleção</button>' +
    "</div>" +
    '<div class="rf-planner-actions" role="group" aria-label="Ações em massa">' +
    '<span class="rf-planner-count" data-rf-plan-count>' +
    selection.count +
    " selecionado(s)</span>" +
    '<label>Mover para<input type="date" data-rf-plan-move-date value="' +
    esc(options.today || "") +
    '"></label>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-move">Mover</button>' +
    '<label>Duração (min)<input type="number" min="1" step="1" data-rf-plan-duration value="60"></label>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-duration">Aplicar duração</button>' +
    '<label>Prioridade<select data-rf-plan-priority><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-priority">Aplicar prioridade</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-duplicate">Duplicar</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-archive">Arquivar</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-redistribute">Redistribuir</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-plan-capacity">Capacidade</button>' +
    '<button type="button" class="btn btn-primary btn-sm" data-action="rf-plan-preview">Prévia e aplicar</button>' +
    "</div>" +
    (days.length
      ? '<div class="rf-planner-days custom-scrollbar scroll-area-md">' +
        days.map((entry) => renderDay(entry, { catalog, selected })).join("") +
        "</div>"
      : '<div class="config-desc">Nenhum bloco visível com o filtro atual.</div>') +
    "</section>"
  );
}

const WEEKDAYS = [
  ["0", "Domingo"],
  ["1", "Segunda"],
  ["2", "Terça"],
  ["3", "Quarta"],
  ["4", "Quinta"],
  ["5", "Sexta"],
  ["6", "Sábado"],
];

/** Formulário mínimo de capacidade semanal usado pela redistribuição. */
export function renderRetaFinalCapacityForm(draft) {
  const retaFinal = draft?.snapshot?.retaFinal || {};
  const capacity = retaFinal.capacidade || {};
  const byWeekday = capacity.minutosPorDiaSemana || {};
  const padrao = Number(retaFinal.minutosPadrao) || 0;
  return (
    '<section class="rf-capacity-form" data-rf-capacity-form>' +
    '<header class="rf-planner-header"><div><div class="rf-detail-eyebrow">Capacidade</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">Minutos por dia</h3></div></header>' +
    '<p class="config-desc">A redistribuição usa estes limites. Zero significa dia livre. Nenhum dia é presumido quando falta fonte.</p>' +
    '<div class="rf-capacity-grid">' +
    WEEKDAYS.map(
      ([value, label]) =>
        '<label>' +
        esc(label) +
        '<input type="number" min="0" step="1" name="cap-' +
        value +
        '" value="' +
        esc(String(byWeekday[value] ?? padrao)) +
        '"></label>',
    ).join("") +
    "</div>" +
    '<label class="rf-capacity-max">Máximo diário (opcional)<input type="number" min="0" step="1" name="cap-max" value="' +
    esc(
      capacity.maximoDiario === undefined
        ? ""
        : String(capacity.maximoDiario),
    ) +
    '"></label>' +
    '<footer class="rf-detail-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="rf-plan-capacity-back">Voltar</button>' +
    '<button type="button" class="btn btn-primary" data-action="rf-plan-capacity-save">Salvar capacidade no rascunho</button>' +
    "</footer>" +
    "</section>"
  );
}

/** Constrói a capacidade validada a partir dos valores do formulário. */
export function buildRetaFinalCapacity(values = {}, maximoDiario) {
  const minutosPorDiaSemana = {};
  for (const [day] of WEEKDAYS) {
    const minutes = Number(values[day]);
    if (!Number.isSafeInteger(minutes) || minutes < 0) {
      return {
        valid: false,
        errors: ["Minutos do dia " + day + " devem ser inteiros não negativos."],
      };
    }
    minutosPorDiaSemana[day] = minutes;
  }
  const capacity = { minutosPorDiaSemana };
  if (maximoDiario !== "" && maximoDiario != null) {
    const max = Number(maximoDiario);
    if (!Number.isSafeInteger(max) || max < 0) {
      return {
        valid: false,
        errors: ["Máximo diário deve ser inteiro não negativo."],
      };
    }
    capacity.maximoDiario = max;
  }
  return { valid: true, capacity, errors: [] };
}
