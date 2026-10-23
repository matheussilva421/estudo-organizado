/**
 * Consulta integral de um bloco da Reta Final.
 *
 * O card do cronograma pode elidir o texto por CSS; este painel sempre mostra
 * o assunto completo, sem truncamento, com metadados e evidências de estudo.
 * A leitura é somente leitura: nenhuma ação aqui altera o plano oficial.
 */

import { esc, todayStr } from "../utils.js?v=8.37";
import { state } from "../store.js?v=8.37";
import { getDisc } from "../logic.js?v=8.37";

const STATUS_LABEL = {
  pendente: "Pendente",
  concluido: "Concluído",
  nao_coberto: "Não coberto",
  arquivado: "Arquivado",
};

const CATEGORIA_LABEL = {
  hoje: "Hoje",
  futuro: "Próximo",
  atrasado: "Atrasado",
  concluido: "Concluído",
  nao_coberto: "Não coberto",
  nao_alocado: "Não alocado por capacidade",
  sem_data: "Sem data planejada",
};

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

function resolveDisciplina(disciplina) {
  if (!disciplina) return null;
  if (disciplina.disc) return disciplina.disc;
  return disciplina;
}

function renderTopicos(block, disc) {
  const assuntos = Array.isArray(disc?.assuntos) ? disc.assuntos : [];
  const aulas = Array.isArray(disc?.aulas) ? disc.aulas : [];
  const items = [];
  for (const topico of block?.topicos || []) {
    if (topico?.assId) {
      const assunto = assuntos.find((item) => item?.id === topico.assId);
      items.push(
        assunto?.nome
          ? '<li class="rf-detail-topic">' + esc(assunto.nome) + "</li>"
          : '<li class="rf-detail-topic rf-detail-topic--missing">Tópico sem referência no catálogo (' +
              esc(topico.assId) +
              ")</li>",
      );
    }
    if (topico?.aulaId) {
      const aula = aulas.find((item) => item?.id === topico.aulaId);
      items.push(
        aula?.nome
          ? '<li class="rf-detail-topic rf-detail-topic--aula">🎬 ' +
              esc(aula.nome) +
              "</li>"
          : '<li class="rf-detail-topic rf-detail-topic--missing">Aula sem referência no catálogo (' +
              esc(topico.aulaId) +
              ")</li>",
      );
    }
  }
  return items.length
    ? '<ul class="rf-detail-topics">' + items.join("") + "</ul>"
    : '<p class="config-desc">Este bloco não possui assuntos vinculados.</p>';
}

function renderEventos(block, events) {
  const vinculados = (events || []).filter(
    (event) => event?.rfBlocoId === block?.id,
  );
  if (!vinculados.length) {
    return '<p class="config-desc">Nenhuma sessão de estudo vinculada a este bloco.</p>';
  }
  return (
    '<ul class="rf-detail-events">' +
    vinculados
      .map((event) => {
        const estudado = event.status === "estudei";
        const data = formatBrDate(event.dataEstudo || event.data);
        const tempo =
          Number(event.tempoAcumulado) > 0
            ? formatMinutes(Number(event.tempoAcumulado) / 60)
            : "";
        const questoes =
          Number.isFinite(Number(event.questoes)) && Number(event.questoes) > 0
            ? Number(event.questoes) + " questões"
            : "";
        const detalhes = [data, tempo, questoes].filter(Boolean).join(" · ");
        return (
          '<li class="rf-detail-event">' +
          '<span class="rf-status-badge ' +
          (estudado ? "rf-status-badge--concluido" : "") +
          '">' +
          (estudado ? "Estudado" : "Pendente") +
          "</span> " +
          "<span>" +
          esc(detalhes || "Sem registro de tempo") +
          "</span>" +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function metaRow(label, value) {
  if (!value) return "";
  return (
    '<div class="rf-detail-meta-row"><dt>' +
    esc(label) +
    "</dt><dd>" +
    esc(value) +
    "</dd></div>"
  );
}

/**
 * Renderiza a consulta integral de um bloco como HTML inerte.
 * @param {Object} block
 * @param {{disciplina?: Object, events?: Array, projection?: Object, today?: string}} options
 * @returns {string}
 */
export function renderRetaFinalBlockDetail(block, options = {}) {
  if (!block || !block.id) return "";
  const { disciplina, events = [], projection = {} } = options;
  const disc = resolveDisciplina(disciplina);
  const statusLabel = STATUS_LABEL[block.status] || block.status || "Pendente";
  const statusClass =
    block.status === "concluido"
      ? " rf-status-badge--concluido"
      : block.status === "nao_coberto"
        ? " rf-status-badge--nao-coberto"
        : "";
  const categoria = projection.categoriaTemporal || block.categoriaTemporal;
  const dataEfetiva = projection.dataEfetiva || block.dataEfetiva || block.data;
  const naoAlocado =
    projection.naoAlocado === true || block.naoAlocado === true;
  const prioridade =
    block.prioridade === undefined ||
    block.prioridade === null ||
    block.prioridade === ""
      ? ""
      : String(block.prioridade);
  const observacao = block.observacao ? String(block.observacao) : "";
  const titulo = disc?.nome ? disc.nome : "Disciplina";
  const icone = esc(String(disc?.icone || "📚"));

  return (
    '<article class="rf-detail" data-rf-detail-block="' +
    esc(block.id) +
    '">' +
    '<header class="rf-detail-header">' +
    '<div class="rf-detail-eyebrow">' +
    icone +
    " " +
    esc(titulo) +
    "</div>" +
    '<h3 class="rf-detail-title" id="rf-detail-title">Assunto completo</h3>' +
    '<span class="rf-status-badge' +
    statusClass +
    '">' +
    esc(statusLabel) +
    "</span>" +
    (naoAlocado ? '<span class="rf-status-badge">Não alocado</span>' : "") +
    "</header>" +
    '<section class="rf-detail-section" data-field="topicos" aria-labelledby="rf-detail-topicos-title">' +
    '<h4 class="rf-detail-section-title" id="rf-detail-topicos-title">Conteúdo</h4>' +
    renderTopicos(block, disc) +
    "</section>" +
    '<section class="rf-detail-section" aria-labelledby="rf-detail-meta-title">' +
    '<h4 class="rf-detail-section-title" id="rf-detail-meta-title">Detalhes do bloco</h4>' +
    '<dl class="rf-detail-meta">' +
    metaRow("Duração", formatMinutes(block.minutos)) +
    metaRow("Prioridade", prioridade) +
    metaRow("Data original", formatBrDate(block.dataOriginal)) +
    metaRow("Data planejada", formatBrDate(block.dataPlanejada)) +
    metaRow("Data efetiva", formatBrDate(dataEfetiva)) +
    metaRow(
      "Situação temporal",
      categoria ? CATEGORIA_LABEL[categoria] || categoria : "",
    ) +
    metaRow(
      "Rolagens",
      Number(block.rolagens) > 0 ? String(block.rolagens) : "",
    ) +
    "</dl>" +
    "</section>" +
    (observacao
      ? '<section class="rf-detail-section" aria-labelledby="rf-detail-obs-title">' +
        '<h4 class="rf-detail-section-title" id="rf-detail-obs-title">Observação</h4>' +
        '<p class="rf-detail-observation" data-field="observacao">' +
        esc(observacao) +
        "</p>" +
        "</section>"
      : "") +
    '<section class="rf-detail-section" aria-labelledby="rf-detail-events-title">' +
    '<h4 class="rf-detail-section-title" id="rf-detail-events-title">Sessões vinculadas</h4>' +
    renderEventos(block, events) +
    "</section>" +
    '<footer class="rf-detail-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="rf-close-detail">Fechar</button>' +
    '<button type="button" class="btn btn-primary" data-action="rf-open-editor" data-bloco-id="' +
    esc(block.id) +
    '"><i class="fa fa-pen"></i> Editar</button>' +
    "</footer>" +
    "</article>"
  );
}

let lastFocusedElement = null;

/** Marca o elemento que abriu o diálogo para restaurar o foco ao fechar. */
export function beginRetaFinalDialog(doc = document) {
  if (lastFocusedElement) return;
  lastFocusedElement =
    doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  doc.body.classList.add("rf-detail-open");
}

function resolveBlock(plan, blockId) {
  return (
    (plan?.retaFinal?.blocos || []).find((block) => block?.id === blockId) ||
    null
  );
}

function findDisciplina(editais, discId) {
  for (const edital of editais || []) {
    const disc = (edital?.disciplinas || []).find(
      (item) => item?.id === discId,
    );
    if (disc) return { disc, edital };
  }
  return null;
}

function focusables(panel) {
  return [
    ...panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.disabled && element.offsetParent !== null);
}

export function trapRetaFinalDialogFocus(panel, event) {
  const items = focusables(panel);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Abre o painel de consulta integral (drawer no desktop, sheet no mobile).
 * @param {string} blockId
 * @param {{plan?: Object, editais?: Array, eventos?: Array, today?: string, doc?: Document}} options
 * @returns {HTMLElement|null}
 */
export function openRetaFinalBlockDetail(blockId, options = {}) {
  const doc = options.doc || document;
  const plan = options.plan || state.planejamento;
  const editais = options.editais || state.editais || [];
  const eventos = options.eventos || state.eventos || [];
  const block = resolveBlock(plan, blockId);
  if (!block) return null;

  closeRetaFinalBlockDetail(doc);
  beginRetaFinalDialog(doc);
  const discEntry =
    findDisciplina(editais, block.discId) || getDisc(block.discId);
  const overlay = doc.createElement("div");
  overlay.className = "rf-detail-overlay";
  overlay.dataset.rfDetailOverlay = "";
  overlay.innerHTML =
    '<button type="button" class="rf-detail-backdrop" data-action="rf-close-detail" aria-label="Fechar detalhes"></button>' +
    '<div class="rf-detail-panel" data-rf-detail-panel role="dialog" aria-modal="true" aria-labelledby="rf-detail-title" tabindex="-1">' +
    renderRetaFinalBlockDetail(block, {
      disciplina: discEntry,
      events: eventos,
      today: options.today || todayStr(),
    }) +
    "</div>";
  doc.body.append(overlay);
  doc.body.classList.add("rf-detail-open");

  const panel = overlay.querySelector("[data-rf-detail-panel]");
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRetaFinalBlockDetail(doc);
      return;
    }
    if (event.key === "Tab") trapRetaFinalDialogFocus(panel, event);
  });
  const closeButton = panel.querySelector('[data-action="rf-close-detail"]');
  if (closeButton) closeButton.focus();
  return panel;
}

/** Fecha o painel e devolve o foco ao botão que o abriu. */
export function closeRetaFinalBlockDetail(doc = document) {
  const overlay = doc.querySelector("[data-rf-detail-overlay]");
  if (overlay) overlay.remove();
  doc.body.classList.remove("rf-detail-open");
  const target = lastFocusedElement;
  lastFocusedElement = null;
  if (target && target.isConnected) target.focus();
}
