// Pure domain normalization. No store, clock, catalog writes or event reconciliation.
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Validate persisted identities and intent; catalog existence needs external context. */
export function validateRetaFinalV2(plan) {
  const errors = [];
  if (!isObject(plan) || plan.tipo !== 'reta_final') {
    return { valid: false, errors: ['Planejamento não é uma Reta Final.'] };
  }
  if (plan.schemaVersionRetaFinal !== 2) errors.push('schemaVersionRetaFinal deve ser 2.');
  if (!isId(plan.planId)) errors.push('planId ausente ou inválido.');
  if (!Number.isSafeInteger(plan.revision) || plan.revision < 0) {
    errors.push('revision deve ser um inteiro não negativo.');
  }
  if (!isObject(plan.retaFinal) || !Array.isArray(plan.retaFinal.blocos)) {
    errors.push('retaFinal.blocos deve ser uma lista.');
    return { valid: false, errors };
  }
  if (!isCivilDate(plan.retaFinal.dataFinal)) errors.push('dataFinal inválida.');
  const ids = new Set();
  plan.retaFinal.blocos.forEach((bloco, index) => {
    const path = `blocos[${index}]`;
    if (!isObject(bloco)) {
      errors.push(`${path}: bloco inválido; requer reparo humano.`);
      return;
    }
    if (!isId(bloco.id) || ids.has(bloco.id)) errors.push(`${path}: id ausente ou duplicado.`);
    ids.add(bloco.id);
    if (!isId(bloco.discId)) errors.push(`${path}: discId inválido.`);
    if (!Number.isInteger(bloco.minutos) || bloco.minutos <= 0) {
      errors.push(`${path}: minutos deve ser um inteiro positivo.`);
    }
    if (!Number.isSafeInteger(bloco.ordem) || bloco.ordem < 0) errors.push(`${path}: ordem inválida.`);
    if (!isCivilDate(bloco.dataPlanejada)) errors.push(`${path}: dataPlanejada inválida.`);
    if (!Array.isArray(bloco.topicos)) {
      errors.push(`${path}: topicos deve ser uma lista.`);
    } else {
      bloco.topicos.forEach((topico, topicIndex) => {
        if (!isObject(topico) || (!isId(topico.assId) && !isId(topico.aulaId)) ||
            (topico.assId != null && !isId(topico.assId)) ||
            (topico.aulaId != null && !isId(topico.aulaId))) {
          errors.push(`${path}.topicos[${topicIndex}]: vínculo inválido.`);
        }
      });
    }
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Upgrade the singleton plan without activation, history writes or human revision.
 * The caller owns identity allocation and durable persistence. today is deliberately
 * not used: loading on another day cannot change the recovered human intent.
 * Ambiguous input stays intact and diagnostics are returned for human repair.
 */
export function migrateRetaFinalV2(plan, { makePlanId, today } = {}) {
  void today;
  const unchanged = (diagnostics = []) => ({ plan, changed: false, diagnostics });
  if (!isObject(plan) || plan.tipo !== 'reta_final') return unchanged();
  if (plan.schemaVersionRetaFinal != null && ![1, 2].includes(plan.schemaVersionRetaFinal)) {
    return unchanged(['Versão da Reta Final não suportada; requer reparo humano.']);
  }
  if (!isObject(plan.retaFinal) || !Array.isArray(plan.retaFinal.blocos)) {
    return unchanged(['retaFinal.blocos inválido; requer reparo humano.']);
  }
  const candidate = {
    ...plan,
    // Validate before allocating an identity, including ambiguous legacy input.
    planId: plan.planId === undefined ? 'pending_identity' : plan.planId,
    schemaVersionRetaFinal: 2,
    revision: plan.revision === undefined ? 0 : plan.revision,
    retaFinal: {
      ...plan.retaFinal,
      blocos: plan.retaFinal.blocos.map((bloco, index) => {
        if (!isObject(bloco)) return bloco;
        const intent = Number(bloco.rolagens) > 0 && isCivilDate(bloco.dataOriginal) &&
          bloco.dataOriginal !== bloco.data ? bloco.dataOriginal : bloco.data;
        return {
          ...bloco,
          dataPlanejada: bloco.dataPlanejada === undefined ? intent : bloco.dataPlanejada,
          ordem: bloco.ordem === undefined ? index : bloco.ordem,
        };
      }),
    },
  };
  const validation = validateRetaFinalV2(candidate);
  if (!validation.valid) return unchanged(validation.errors);
  if (plan.planId === undefined) {
    if (typeof makePlanId !== 'function') return unchanged(['Gerador de planId não fornecido.']);
    candidate.planId = makePlanId();
    if (!isId(candidate.planId)) return unchanged(['Gerador retornou planId inválido.']);
  }
  const changed = plan.planId !== candidate.planId || plan.schemaVersionRetaFinal !== 2 ||
    plan.revision !== candidate.revision || candidate.retaFinal.blocos.some((bloco, index) => {
      const previous = plan.retaFinal.blocos[index];
      return previous.dataPlanejada !== bloco.dataPlanejada || previous.ordem !== bloco.ordem;
    });
  return changed ? { plan: candidate, changed: true, diagnostics: [] } : unchanged();
}
