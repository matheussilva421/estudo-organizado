/**
 * Formulário individual da Reta Final integrado ao rascunho.
 *
 * O formulário renderiza o snapshot do draft (nunca o plano oficial) e expõe
 * apenas campos editáveis pelos comandos puros. A persistência e a criação de
 * comandos ficam na camada de ações.
 */

import { esc } from "../utils.js?v=8.37";
import { resolveRetaFinalCatalog } from "../logic/reta-final-catalog.js";
import { normalizeNameKey } from "../logic/reta-final-core.js";

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isCivilDate(value) {
  if (!CIVIL_DATE_RE.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
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

function collectDisciplinas(catalog) {
  const items = [];
  for (const edital of catalog || []) {
    for (const disc of edital?.disciplinas || []) {
      if (disc?.id) items.push(disc);
    }
  }
  return items;
}

function assuntoName(disc, id) {
  return (disc?.assuntos || []).find((item) => item?.id === id)?.nome || id;
}

function aulaName(disc, id) {
  return (disc?.aulas || []).find((item) => item?.id === id)?.nome || id;
}

function renderTopicosChips(block, disc) {
  const chips = [];
  (block.topicos || []).forEach((topico, index) => {
    if (topico?.assId) {
      chips.push(
        '<li class="rf-editor-chip"><span>📘 ' +
          esc(assuntoName(disc, topico.assId)) +
          '</span><button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-remove-topic" data-index="' +
          index +
          '" data-field="assId" aria-label="Remover assunto">✕</button></li>',
      );
    }
    if (topico?.aulaId) {
      chips.push(
        '<li class="rf-editor-chip"><span>🎬 ' +
          esc(aulaName(disc, topico.aulaId)) +
          '</span><button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-remove-topic" data-index="' +
          index +
          '" data-field="aulaId" aria-label="Remover aula">✕</button></li>',
      );
    }
  });
  return chips.length
    ? '<ul class="rf-editor-chips">' + chips.join("") + "</ul>"
    : '<p class="config-desc">Nenhum assunto vinculado. Adicione um tópico abaixo.</p>';
}

function renderAssuntoOptions(disc) {
  return (disc?.assuntos || [])
    .map(
      (assunto) =>
        '<option value="' +
        esc(assunto.id) +
        '">' +
        esc(assunto.nome) +
        "</option>",
    )
    .join("");
}

function renderAulaOptions(disc) {
  return (disc?.aulas || [])
    .map(
      (aula) =>
        '<option value="' + esc(aula.id) + '">' + esc(aula.nome) + "</option>",
    )
    .join("");
}

function prioridadeOptions(current) {
  const values = ["", "1", "2", "3", "4", "5"];
  return values
    .map((value) => {
      const selected = String(current ?? "") === value ? " selected" : "";
      const label = value === "" ? "Sem prioridade" : "Prioridade " + value;
      return (
        '<option value="' + value + '"' + selected + ">" + label + "</option>"
      );
    })
    .join("");
}

/**
 * Renderiza o formulário de edição de um bloco a partir do draft.
 * @param {Object} draft
 * @param {string} blockId
 * @param {{catalog?: Array, activeTimerIds?: Set<string>|Array<string>}} options
 * @returns {string}
 */
export function renderRetaFinalEditorForm(draft, blockId, options = {}) {
  const catalog = options.catalog || [];
  const block = (draft?.snapshot?.retaFinal?.blocos || []).find(
    (item) => item?.id === blockId,
  );
  if (!draft || !block) return "";
  const disc = findDisciplina(catalog, block.discId);
  const disciplinas = collectDisciplinas(catalog);
  const timerIds = options.activeTimerIds;
  const timerAtivo =
    block._timerStart ||
    block.timerAtivo === true ||
    (timerIds &&
      typeof timerIds.has === "function" &&
      timerIds.has(block.id)) ||
    (Array.isArray(timerIds) && timerIds.includes(block.id));
  const intents = Array.isArray(draft.catalogIntents)
    ? draft.catalogIntents
    : [];

  return (
    '<form class="rf-editor-form" data-rf-editor-form data-bloco-id="' +
    esc(block.id) +
    '" data-draft-id="' +
    esc(draft.draftId) +
    '">' +
    '<header class="rf-detail-header">' +
    '<div class="rf-detail-eyebrow">Editar bloco</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">' +
    esc(disc?.nome || "Disciplina") +
    "</h3>" +
    '<span class="rf-status-badge">Rascunho local</span>' +
    "</header>" +
    (timerAtivo
      ? '<div class="restore-preview-warning" role="status" data-field="timer-warning">Cronômetro ativo: data, duração, disciplina, tópicos e fixação ficam bloqueados até pausar ou encerrar a sessão. Observação e prioridade continuam editáveis.</div>'
      : "") +
    '<div class="rf-editor-grid">' +
    '<label class="rf-editor-field">Disciplina<select name="discId"' +
    (timerAtivo ? " disabled" : "") +
    ">" +
    disciplinas
      .map(
        (item) =>
          '<option value="' +
          esc(item.id) +
          '"' +
          (item.id === block.discId ? " selected" : "") +
          ">" +
          esc(item.nome) +
          "</option>",
      )
      .join("") +
    "</select></label>" +
    '<label class="rf-editor-field">Data planejada<input type="date" name="dataPlanejada" value="' +
    esc(block.dataPlanejada || block.data || "") +
    '"' +
    (timerAtivo ? " disabled" : "") +
    "></label>" +
    '<label class="rf-editor-field">Duração (min)<input type="number" name="minutos" min="1" step="1" value="' +
    esc(String(block.minutos ?? 60)) +
    '"' +
    (timerAtivo ? " disabled" : "") +
    "></label>" +
    '<label class="rf-editor-field">Prioridade<select name="prioridade">' +
    prioridadeOptions(block.prioridade) +
    "</select></label>" +
    '<label class="rf-editor-field">Ordem<input type="number" name="ordem" min="0" step="1" value="' +
    esc(String(block.ordem ?? 0)) +
    '"' +
    (timerAtivo ? " disabled" : "") +
    "></label>" +
    '<label class="rf-editor-check"><input type="checkbox" name="fixado"' +
    (block.fixado ? " checked" : "") +
    (timerAtivo ? " disabled" : "") +
    "> Fixar data (impede rolagem automática)</label>" +
    "</div>" +
    '<fieldset class="rf-editor-fieldset"' +
    (timerAtivo ? " disabled" : "") +
    ">" +
    "<legend>Tópicos</legend>" +
    renderTopicosChips(block, disc) +
    '<div class="rf-editor-add-row">' +
    "<label>Assunto existente<select data-rf-editor-assunto>" +
    (renderAssuntoOptions(disc) || '<option value="">Sem assuntos</option>') +
    "</select></label>" +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-add-assunto">Adicionar assunto</button>' +
    "</div>" +
    '<div class="rf-editor-add-row">' +
    "<label>Aula existente<select data-rf-editor-aula>" +
    (renderAulaOptions(disc) || '<option value="">Sem aulas</option>') +
    "</select></label>" +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-add-aula">Adicionar aula</button>' +
    "</div>" +
    '<div class="rf-editor-add-row">' +
    '<label>Novo assunto (só é criado ao aplicar)<input type="text" name="novoAssunto" maxlength="240" placeholder="Nome do novo assunto"></label>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-create-assunto">Criar assunto</button>' +
    "</div>" +
    '<div class="rf-editor-add-row">' +
    '<label>Nova aula (só é criada ao aplicar)<input type="text" name="novaAula" maxlength="240" placeholder="Nome da nova aula"></label>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rf-editor-create-aula">Criar aula</button>' +
    "</div>" +
    "</fieldset>" +
    '<label class="rf-editor-field rf-editor-field--full">Observação<textarea name="observacao" rows="3" maxlength="2000">' +
    esc(block.observacao || "") +
    "</textarea></label>" +
    (intents.length
      ? '<div class="config-desc" data-field="catalog-intents">Novas entidades no rascunho: ' +
        intents
          .map((intent) =>
            esc((intent.entity === "aula" ? "🎬 " : "📘 ") + intent.nome),
          )
          .join(" · ") +
        ". Elas só entram no catálogo no commit atômico.</div>"
      : "") +
    '<div class="config-desc">Alterações ficam no rascunho. O plano oficial e os estudos só mudam na prévia/aplicação.</div>' +
    '<footer class="rf-detail-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="rf-close-detail">Cancelar</button>' +
    '<button type="button" class="btn btn-ghost" data-action="rf-editor-discard">Descartar rascunho</button>' +
    '<button type="button" class="btn btn-primary" data-action="rf-editor-save">Salvar no rascunho</button>' +
    "</footer>" +
    "</form>"
  );
}

/**
 * Converte os campos do formulário em um patch apenas com mudanças válidas.
 * @returns {{patch: Object, errors: string[]}}
 */
export function buildRetaFinalEditorPatch(changes = {}, block = {}) {
  const patch = {};
  const errors = [];
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  if (changes.discId !== undefined && changes.discId !== block.discId) {
    if (!String(changes.discId || "").trim())
      errors.push("Disciplina inválida.");
    else patch.discId = String(changes.discId);
  }
  if (changes.dataPlanejada !== undefined) {
    const value = String(changes.dataPlanejada || "").trim();
    if (value !== (block.dataPlanejada || block.data || "")) {
      if (!isCivilDate(value))
        errors.push("Data planejada deve ser uma data civil válida.");
      else patch.dataPlanejada = value;
    }
  }
  if (changes.minutos !== undefined) {
    const value = Number(changes.minutos);
    if (value !== Number(block.minutos)) {
      if (!Number.isSafeInteger(value) || value <= 0)
        errors.push("Duração deve ser um inteiro maior que zero.");
      else patch.minutos = value;
    }
  }
  if (changes.prioridade !== undefined) {
    const raw = changes.prioridade;
    const value = raw === "" || raw == null ? null : Number(raw);
    if (value !== (block.prioridade ?? null)) {
      if (
        value !== null &&
        (!Number.isInteger(value) || value < 1 || value > 5)
      )
        errors.push("Prioridade deve estar entre 1 e 5.");
      else patch.prioridade = value;
    }
  }
  if (changes.ordem !== undefined) {
    const value = Number(changes.ordem);
    if (value !== Number(block.ordem ?? 0)) {
      if (!Number.isSafeInteger(value) || value < 0)
        errors.push("Ordem deve ser um inteiro não negativo.");
      else patch.ordem = value;
    }
  }
  if (changes.observacao !== undefined) {
    const value = String(changes.observacao ?? "");
    if (value !== (block.observacao ?? "")) patch.observacao = value;
  }
  if (changes.fixado !== undefined) {
    const value =
      changes.fixado === true ||
      changes.fixado === "true" ||
      changes.fixado === "on";
    if (value !== Boolean(block.fixado)) patch.fixado = value;
  }
  if (changes.topicos !== undefined) {
    if (!same(changes.topicos, block.topicos || []))
      patch.topicos = changes.topicos;
  }
  return { patch, errors };
}

export function describeRetaFinalEditorDiff(diff = []) {
  return diff
    .map((entry) => {
      const fields = (entry.fieldsChanged || []).join(", ");
      return fields
        ? "Bloco " + (entry.blockId || "plano") + ": " + fields
        : "";
    })
    .filter(Boolean)
    .join(" · ");
}

/**
 * Resolve um novo assunto/aula para o rascunho. Retorna o intent e a
 * referência pronta para PATCH; nunca escolhe homônimos ambíguos.
 * @returns {{valid: boolean, intent?: Object, ref?: Object, errors: Array}}
 */
export function resolveRetaFinalEditorTopic(
  catalog,
  { discId, entity = "assunto", nome, makeId, existingIntents = [] } = {},
) {
  const key = normalizeNameKey(nome);
  const pending = existingIntents.find(
    (intent) =>
      intent?.entity === entity &&
      intent?.discId === discId &&
      normalizeNameKey(intent?.nome) === key,
  );
  if (pending) {
    return {
      valid: true,
      intent: pending,
      ref:
        entity === "assunto"
          ? { assId: pending.id, aulaId: null }
          : { assId: null, aulaId: pending.id },
      existing: true,
      errors: [],
    };
  }
  const resolution = resolveRetaFinalCatalog(catalog, {
    discId,
    assuntos: entity === "assunto" ? [{ nome }] : [],
    aulas: entity === "aula" ? [{ nome }] : [],
    makeId,
  });
  if (resolution.conflicts.length) {
    return { valid: false, errors: resolution.conflicts };
  }
  if (!resolution.createIntents.length) {
    if (resolution.refs.length) {
      return {
        valid: true,
        intent: null,
        ref: resolution.refs[0],
        existing: true,
        errors: [],
      };
    }
    return {
      valid: false,
      errors: [{ reason: "Já existe um item com esse nome." }],
    };
  }
  return {
    valid: true,
    intent: resolution.createIntents[0],
    ref: resolution.refs[0],
    errors: [],
  };
}
