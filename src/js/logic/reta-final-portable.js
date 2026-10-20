import { validateRetaFinalPayload } from "./reta-final-core.js";

const TOP_LEVEL_FIELDS = new Set([
  "versao",
  "tipo",
  "nome",
  "planId",
  "exportRevision",
  "sourceRevision",
  "provenance",
  "dataFinal",
  "minutosPadrao",
  "capacidade",
  "blocos",
]);
const BLOCK_FIELDS = new Set([
  "id",
  "discId",
  "topicos",
  "minutos",
  "dataPlanejada",
  "dataOriginal",
  "prioridade",
  "observacao",
  "fixado",
  "arquivado",
  "provenance",
]);
const PRIVATE_KEY =
  /event|sess|credential|credenc|token|secret|password|senha|histor/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPrivateKey(key) {
  const normalized = String(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return PRIVATE_KEY.test(normalized);
}

function isCivilDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

function isSafeIntegerAtLeast(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function isPortableValue(value, seen = new Set()) {
  if (value === null || ["string", "boolean"].includes(typeof value))
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isPortableValue(item, seen))
    : Object.entries(value).every(
        ([key, item]) => !isPrivateKey(key) && isPortableValue(item, seen),
      );
  seen.delete(value);
  return valid;
}

function validCapacity(value) {
  if (!isRecord(value)) return false;
  const allowed = new Set([
    "minutosPorDiaSemana",
    "excecoesPorData",
    "folgas",
    "maximoDiario",
  ]);
  if (
    Object.keys(value).length === 0 ||
    Object.keys(value).some((key) => !allowed.has(key))
  )
    return false;
  if (value.minutosPorDiaSemana !== undefined) {
    if (!isRecord(value.minutosPorDiaSemana)) return false;
    if (
      Object.entries(value.minutosPorDiaSemana).some(
        ([day, minutes]) =>
          !/^[0-6]$/.test(day) || !Number.isInteger(minutes) || minutes < 0,
      )
    )
      return false;
  }
  if (value.excecoesPorData !== undefined) {
    if (!isRecord(value.excecoesPorData)) return false;
    if (
      Object.entries(value.excecoesPorData).some(
        ([date, minutes]) =>
          !isCivilDate(date) || !Number.isInteger(minutes) || minutes < 0,
      )
    )
      return false;
  }
  if (
    value.folgas !== undefined &&
    (!Array.isArray(value.folgas) ||
      value.folgas.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  )
    return false;
  if (
    value.maximoDiario !== undefined &&
    (!Number.isInteger(value.maximoDiario) || value.maximoDiario < 0)
  )
    return false;
  return true;
}

function copyPortable(value) {
  if (Array.isArray(value)) return value.map(copyPortable);
  if (!isRecord(value)) return value;
  const copy = {};
  for (const [key, item] of Object.entries(value)) {
    if (isPrivateKey(key)) continue;
    copy[key] = copyPortable(item);
  }
  return copy;
}

function addError(errors, message) {
  if (!errors.includes(message)) errors.push(message);
}

function validateV2(payload) {
  const errors = [];
  if (payload.versao !== 2) addError(errors, 'Campo "versao" deve ser 2.');
  if (payload.tipo !== "reta_final")
    addError(errors, 'Campo "tipo" deve ser reta_final.');
  if (!isId(payload.nome)) addError(errors, 'Campo "nome" é obrigatório.');
  if (!isId(payload.planId)) addError(errors, 'Campo "planId" inválido.');
  if (!isSafeIntegerAtLeast(payload.exportRevision))
    addError(errors, 'Campo "exportRevision" inválido.');
  if (
    payload.sourceRevision !== undefined &&
    !isSafeIntegerAtLeast(payload.sourceRevision)
  ) {
    addError(errors, 'Campo "sourceRevision" inválido.');
  }
  if (!isCivilDate(payload.dataFinal))
    addError(errors, 'Campo "dataFinal" inválido.');
  if (!Number.isInteger(payload.minutosPadrao) || payload.minutosPadrao <= 0) {
    addError(errors, 'Campo "minutosPadrao" deve ser um inteiro positivo.');
  }
  if (payload.capacidade !== undefined && !validCapacity(payload.capacidade)) {
    addError(errors, 'Campo "capacidade" inválido.');
  }
  if (
    payload.provenance !== undefined &&
    (!isRecord(payload.provenance) || !isPortableValue(payload.provenance))
  ) {
    addError(errors, 'Campo "provenance" inválido ou contém dado privado.');
  }
  for (const key of Object.keys(payload)) {
    if (!TOP_LEVEL_FIELDS.has(key))
      addError(errors, `Campo não portátil: ${key}.`);
  }
  if (!Array.isArray(payload.blocos)) {
    addError(errors, 'Campo "blocos" deve ser uma lista.');
    return errors;
  }
  const ids = new Set();
  payload.blocos.forEach((block, index) => {
    const path = `blocos[${index}]`;
    if (!isRecord(block)) {
      addError(errors, `${path}: bloco inválido.`);
      return;
    }
    for (const key of Object.keys(block)) {
      if (!BLOCK_FIELDS.has(key))
        addError(errors, `${path}: campo não portátil: ${key}.`);
    }
    if (!isId(block.id) || ids.has(block.id))
      addError(errors, `${path}: id ausente ou duplicado.`);
    ids.add(block.id);
    if (!isId(block.discId)) addError(errors, `${path}: discId inválido.`);
    if (!Array.isArray(block.topicos) || block.topicos.length === 0) {
      addError(errors, `${path}: topicos deve conter referências.`);
    } else {
      block.topicos.forEach((topic, topicIndex) => {
        const hasAssunto = isId(topic?.assId);
        const hasAula = isId(topic?.aulaId);
        if (
          !isRecord(topic) ||
          Object.keys(topic).some(
            (key) => !["assId", "aulaId"].includes(key),
          ) ||
          hasAssunto === hasAula ||
          (topic.assId != null && !hasAssunto) ||
          (topic.aulaId != null && !hasAula)
        ) {
          addError(
            errors,
            `${path}.topicos[${topicIndex}]: referência inválida.`,
          );
        }
      });
    }
    if (!Number.isInteger(block.minutos) || block.minutos <= 0) {
      addError(errors, `${path}: minutos deve ser um inteiro positivo.`);
    }
    if (!isCivilDate(block.dataPlanejada))
      addError(errors, `${path}: dataPlanejada inválida.`);
    if (block.dataOriginal !== undefined && !isCivilDate(block.dataOriginal)) {
      addError(errors, `${path}: dataOriginal inválida.`);
    }
    if (
      block.prioridade !== undefined &&
      block.prioridade !== null &&
      (!Number.isInteger(block.prioridade) ||
        block.prioridade < 1 ||
        block.prioridade > 5)
    ) {
      addError(errors, `${path}: prioridade inválida.`);
    }
    if (
      block.observacao !== undefined &&
      block.observacao !== null &&
      typeof block.observacao !== "string"
    )
      addError(errors, `${path}: observacao inválida.`);
    if (block.fixado !== undefined && typeof block.fixado !== "boolean") {
      addError(errors, `${path}: fixado inválido.`);
    }
    if (block.arquivado !== undefined && typeof block.arquivado !== "boolean") {
      addError(errors, `${path}: arquivado inválido.`);
    }
    if (
      block.provenance !== undefined &&
      (!isRecord(block.provenance) || !isPortableValue(block.provenance))
    ) {
      addError(errors, `${path}: provenance inválida ou contém dado privado.`);
    }
  });
  return errors;
}

/** Recognizes the legacy v1 importer and the portable v2 schedule without throwing. */
export function validateRetaFinalPortable(payload) {
  const version =
    isRecord(payload) && [1, 2].includes(payload.versao)
      ? payload.versao
      : null;
  try {
    if (!isRecord(payload)) {
      return {
        valid: false,
        version,
        errors: ["O arquivo não contém um objeto JSON válido."],
      };
    }
    if (version === 1) {
      const result = validateRetaFinalPayload(payload);
      return { ...result, version };
    }
    if (version === 2) {
      const errors = validateV2(payload);
      return { valid: errors.length === 0, version, errors };
    }
    return {
      valid: false,
      version,
      errors: ["Versão de Reta Final não suportada."],
    };
  } catch {
    return {
      valid: false,
      version,
      errors: ["JSON de Reta Final malformado."],
    };
  }
}

/** Exports a detached, history-free portable representation of a v2 plan. */
export function exportRetaFinalPortable(plan) {
  if (
    !isRecord(plan) ||
    plan.tipo !== "reta_final" ||
    plan.schemaVersionRetaFinal !== 2 ||
    !isRecord(plan.retaFinal) ||
    !Array.isArray(plan.retaFinal.blocos)
  ) {
    throw new TypeError("Plano v2 da Reta Final inválido.");
  }
  const retaFinal = plan.retaFinal;
  const payload = {
    versao: 2,
    tipo: "reta_final",
    nome:
      typeof retaFinal.nome === "string" && retaFinal.nome
        ? retaFinal.nome
        : "Reta Final",
    planId: plan.planId,
    exportRevision: plan.revision,
    ...(Number.isSafeInteger(plan.sourceRevision)
      ? { sourceRevision: plan.sourceRevision }
      : {}),
    ...(isRecord(plan.provenance)
      ? { provenance: copyPortable(plan.provenance) }
      : {}),
    dataFinal: retaFinal.dataFinal,
    minutosPadrao: retaFinal.minutosPadrao,
    ...(retaFinal.capacidade !== undefined
      ? { capacidade: copyPortable(retaFinal.capacidade) }
      : {}),
    blocos: [...retaFinal.blocos]
      .sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0))
      .map((block) => ({
        id: block?.id,
        discId: block?.discId,
        topicos: copyPortable(block?.topicos),
        minutos: block?.minutos,
        dataPlanejada: block?.dataPlanejada,
        ...(block?.dataOriginal !== undefined
          ? { dataOriginal: block.dataOriginal }
          : {}),
        ...(block?.prioridade !== undefined
          ? { prioridade: block.prioridade }
          : {}),
        ...(block?.observacao !== undefined
          ? { observacao: block.observacao }
          : {}),
        ...(block?.fixado !== undefined ? { fixado: block.fixado } : {}),
        arquivado: block?.arquivado === true,
        ...(isRecord(block?.provenance)
          ? { provenance: copyPortable(block.provenance) }
          : {}),
      })),
  };
  const validation = validateRetaFinalPortable(payload);
  if (!validation.valid)
    throw new TypeError("Plano v2 inválido: " + validation.errors.join(" "));
  return payload;
}
