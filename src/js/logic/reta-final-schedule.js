// =============================================
// RETA FINAL — PROJEÇÃO TEMPORAL (pura)
// Separa a intenção humana (dataPlanejada) da data efetiva exibida e
// materializada. A projeção pode rolar um pendente atrasado para hoje, mas
// nunca altera o plano de entrada, eventos, revision ou updatedAt.
// =============================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isCivilDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function toIdSet(values) {
  const ids = new Set();
  if (!values || typeof values === 'string') return ids;
  if (values instanceof Set) {
    for (const id of values) {
      if (typeof id === 'string' && id) ids.add(id);
    }
    return ids;
  }
  if (Array.isArray(values)) {
    for (const id of values) {
      if (typeof id === 'string' && id) ids.add(id);
    }
    return ids;
  }
  if (typeof values === 'object') {
    if (typeof values[Symbol.iterator] === 'function') {
      for (const id of values) {
        if (typeof id === 'string' && id) ids.add(id);
      }
      return ids;
    }
    for (const [id, active] of Object.entries(values)) {
      if (active && id) ids.add(id);
    }
  }
  return ids;
}

function isPinFlag(value) {
  if (value == null || value === false || value === 0 || value === '') return false;
  if (typeof value === 'object') return value.ativa !== false;
  return true;
}

function isPinned(bloco) {
  return (
    isPinFlag(bloco.fixado) ||
    isPinFlag(bloco.pinned) ||
    isPinFlag(bloco.fixacao) ||
    (bloco.fixadoEm != null && bloco.fixadoEm !== false)
  );
}

function isExplicitlyRescheduled(bloco, intent) {
  if (
    bloco.reagendado === true ||
    bloco.rescheduled === true ||
    bloco.ajusteManual === true ||
    bloco.movido === true ||
    bloco.reagendadoEm != null ||
    bloco.rescheduledAt != null
  ) {
    return true;
  }
  return isCivilDate(bloco.dataOriginal) && isCivilDate(intent) && intent !== bloco.dataOriginal;
}

function isExplicitlyUnallocated(bloco) {
  return (
    bloco.naoAlocado === true ||
    bloco.alocacao === 'nao_alocada' ||
    bloco.alocacao === 'nao_alocado'
  );
}

function resolveIntent(bloco) {
  // Um campo presente e inválido é diagnóstico, não licença para adivinhar a
  // intenção em outro campo. O fallback só cobre o legado sem o campo.
  if (bloco.dataPlanejada != null) {
    return isCivilDate(bloco.dataPlanejada) ? bloco.dataPlanejada : null;
  }
  if (bloco.dataOriginal != null) {
    return isCivilDate(bloco.dataOriginal) ? bloco.dataOriginal : null;
  }
  if (bloco.data != null) return isCivilDate(bloco.data) ? bloco.data : null;
  return null;
}

function statusForCategory(categoria) {
  if (categoria === 'concluido') return 'concluido';
  if (categoria === 'nao_coberto') return 'nao_coberto';
  return 'pendente';
}

function addUnallocatedAlert(alerts, blocoId, reason, message) {
  alerts.push({ code: 'NAO_ALOCADO', blocoId, reason, message });
}

/**
 * Projeta o cronograma sem escrever no plano.
 *
 * - Pendente atrasado elegível aparece em `today` e permanece com
 *   `dataPlanejada` intacta.
 * - Bloco fixado, reagendado explicitamente ou ocupado por evento preservado
 *   não rola.
 * - Após `dataFinal`, bloco pendente elegível vira `nao_coberto`.
 * - `naoAlocado` diferencia falta de alocação/capacidade de prazo vencido.
 * - `occupiedBlocoIds` contém eventos preservados (estudei ou tempo > 0).
 *   `completedBlocoIds`, quando informado, distingue conclusão real de timer
 *   parcial; sem ele, os ids ocupados são tratados como concluídos para
 *   compatibilidade com chamadas antigas.
 *
 * @param {object} plan - plano `reta_final` v2 (ou legado compatível)
 * @param {{ today: string, occupiedBlocoIds?: Iterable<string>|Set<string>,
 *   completedBlocoIds?: Iterable<string>|Set<string> }} options
 * @returns {{ blocos: object[], alerts: object[] }}
 */
export function projectRetaFinalSchedule(plan, options = {}) {
  const { today, occupiedBlocoIds, completedBlocoIds } = options;
  const blocos = [];
  const alerts = [];
  if (!plan || plan.tipo !== 'reta_final' || !plan.retaFinal) {
    return { blocos, alerts };
  }
  if (!Array.isArray(plan.retaFinal.blocos)) return { blocos, alerts };

  const hoje = isCivilDate(today) ? today : null;
  const dataFinal = isCivilDate(plan.retaFinal.dataFinal) ? plan.retaFinal.dataFinal : null;
  const occupied = toIdSet(occupiedBlocoIds);
  const completedProvided = Object.prototype.hasOwnProperty.call(options, 'completedBlocoIds');
  const completed = completedProvided ? toIdSet(completedBlocoIds) : occupied;

  for (const bloco of plan.retaFinal.blocos) {
    if (!bloco || typeof bloco !== 'object') continue;
    const blocoId = typeof bloco.id === 'string' ? bloco.id : null;
    const intent = resolveIntent(bloco);
    const isCompleted = Boolean(blocoId && completed.has(blocoId));
    const isOccupied = Boolean(blocoId && occupied.has(blocoId));
    const pinned = isPinned(bloco);
    const rescheduled = isExplicitlyRescheduled(bloco, intent);
    const protectedFromRollover = pinned || rescheduled || isOccupied;

    let dataEfetiva = intent;
    let categoriaTemporal;
    let naoAlocado = false;
    let rolado = false;

    if (isCompleted) {
      categoriaTemporal = 'concluido';
    } else if (!intent) {
      dataEfetiva = null;
      categoriaTemporal = 'nao_alocado';
      naoAlocado = true;
      addUnallocatedAlert(
        alerts,
        blocoId,
        'data_invalida',
        `Bloco ${blocoId || '(sem id)'} sem data planejada válida.`
      );
    } else if (isExplicitlyUnallocated(bloco)) {
      dataEfetiva = null;
      categoriaTemporal = 'nao_alocado';
      naoAlocado = true;
      addUnallocatedAlert(
        alerts,
        blocoId,
        'capacidade',
        `Bloco ${blocoId || '(sem id)'} não alocado por capacidade.`
      );
    } else if (
      (dataFinal && intent > dataFinal) ||
      (dataFinal && hoje && hoje > dataFinal && !isOccupied)
    ) {
      categoriaTemporal = 'nao_coberto';
      alerts.push({
        code: 'NAO_COBERTO',
        blocoId,
        dataPlanejada: intent,
        dataFinal,
        message: `Bloco ${blocoId || '(sem id)'} ficou fora do prazo em ${dataFinal}.`,
      });
    } else if (!hoje) {
      categoriaTemporal = 'futuro';
    } else if (intent < hoje) {
      categoriaTemporal = 'atrasado';
      if (!protectedFromRollover) {
        dataEfetiva = hoje;
        rolado = true;
      }
    } else if (intent === hoje) {
      categoriaTemporal = 'hoje';
    } else {
      categoriaTemporal = 'futuro';
    }

    blocos.push({
      ...bloco,
      data: dataEfetiva || bloco.data,
      dataEfetiva,
      categoriaTemporal,
      naoAlocado,
      rolado,
      status: statusForCategory(categoriaTemporal),
    });
  }

  return { blocos, alerts };
}
