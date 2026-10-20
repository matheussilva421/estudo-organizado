import { validateRetaFinalV2 } from './reta-final-schema.js';
import { scoreRetaFinalBlock } from './reta-final-priority.js';

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const CAPACITY_FIELDS = new Set([
  'minutosPorDiaSemana',
  'excecoesPorData',
  'folgas',
  'maximoDiario',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCivilDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parts = value.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    dayIsValid(parts[2], days[month - 1])
  );
}

function dayIsValid(day, daysInMonth) {
  return day >= 1 && day <= daysInMonth;
}

function weekday(date) {
  return new Date(date + 'T00:00:00.000Z').getUTCDay();
}

function nextDate(date) {
  const value = new Date(date + 'T00:00:00.000Z');
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareBlocks(left, right) {
  if (left.score.score !== right.score.score) {
    return right.score.score - left.score.score;
  }
  const dateOrder = compareText(
    left.block.dataPlanejada,
    right.block.dataPlanejada,
  );
  if (dateOrder !== 0) return dateOrder;
  if (left.block.ordem !== right.block.ordem) {
    return left.block.ordem - right.block.ordem;
  }
  return compareText(left.block.id, right.block.id);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isRecord(value)) {
    const copy = {};
    for (const [key, entry] of Object.entries(value))
      copy[key] = cloneValue(entry);
    return copy;
  }
  return value;
}

function sameValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    ) {
      return false;
    }
    return left.every((value, index) => sameValue(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!sameValue(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !sameValue(before[key], after[key])).sort();
}

function invalidResult(diagnostics) {
  return {
    operations: [],
    dailyLoad: {},
    unallocated: [],
    explanations: [],
    diff: [],
    valid: false,
    diagnostics,
  };
}

function validCapacity(capacity) {
  if (capacity == null) return true;
  if (!isRecord(capacity)) return false;
  const keys = Object.keys(capacity);
  if (keys.length === 0 || keys.some((key) => !CAPACITY_FIELDS.has(key)))
    return false;
  if (capacity.minutosPorDiaSemana !== undefined) {
    if (!isRecord(capacity.minutosPorDiaSemana)) return false;
    for (const [day, minutes] of Object.entries(capacity.minutosPorDiaSemana)) {
      if (!/^[0-6]$/.test(day) || !Number.isInteger(minutes) || minutes < 0)
        return false;
    }
  }
  if (capacity.excecoesPorData !== undefined) {
    if (!isRecord(capacity.excecoesPorData)) return false;
    for (const [date, minutes] of Object.entries(capacity.excecoesPorData)) {
      if (!isCivilDate(date) || !Number.isInteger(minutes) || minutes < 0)
        return false;
    }
  }
  if (capacity.folgas !== undefined) {
    if (
      !Array.isArray(capacity.folgas) ||
      capacity.folgas.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    ) {
      return false;
    }
  }
  if (
    capacity.maximoDiario !== undefined &&
    (!Number.isInteger(capacity.maximoDiario) || capacity.maximoDiario < 0)
  ) {
    return false;
  }
  return true;
}

function validOverrideMap(value, validator) {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, entry]) => validator(key, entry));
}

function validWeekdayOverride(day, minutes) {
  return /^[0-6]$/.test(day) && Number.isInteger(minutes) && minutes >= 0;
}

function validExceptionOverride(date, minutes) {
  return isCivilDate(date) && Number.isInteger(minutes) && minutes >= 0;
}

function isPinnedFlag(value) {
  if (value == null || value === false || value === 0 || value === '')
    return false;
  if (typeof value === 'object') return value.ativa !== false;
  return true;
}

function isPinned(block, pinnedIds) {
  return (
    pinnedIds.has(block.id) ||
    isPinnedFlag(block.fixado) ||
    isPinnedFlag(block.pinned) ||
    isPinnedFlag(block.fixacao) ||
    (block.fixadoEm != null && block.fixadoEm !== false)
  );
}

function readPinnedIds(value) {
  if (value === undefined) return { valid: true, ids: new Set() };
  const ids = Array.isArray(value)
    ? value
    : value instanceof Set
      ? [...value]
      : null;
  if (!ids || ids.some((id) => !isId(id)))
    return { valid: false, ids: new Set() };
  return { valid: true, ids: new Set(ids) };
}

function resolveCapacity(
  date,
  persisted,
  weekdayOverrides,
  exceptionOverrides,
) {
  const day = weekday(date);
  const hasOptionException = Object.hasOwn(exceptionOverrides, date);
  const hasPersistedException = Object.hasOwn(
    persisted?.excecoesPorData || {},
    date,
  );
  const hasOptionWeekday = Object.hasOwn(weekdayOverrides, String(day));
  const hasPersistedWeekday = Object.hasOwn(
    persisted?.minutosPorDiaSemana || {},
    String(day),
  );

  let minutes;
  if (hasOptionException) minutes = exceptionOverrides[date];
  else if (hasPersistedException) minutes = persisted.excecoesPorData[date];
  else if (hasOptionWeekday) minutes = weekdayOverrides[String(day)];
  else if ((persisted?.folgas || []).includes(day)) minutes = 0;
  else if (hasPersistedWeekday)
    minutes = persisted.minutosPorDiaSemana[String(day)];
  else return null;

  if (persisted?.maximoDiario !== undefined) {
    minutes = Math.min(minutes, persisted.maximoDiario);
  }
  return minutes;
}

/**
 * Returns Task 3 MOVE proposals for pending, non-archived blocks. The function
 * only builds a proposal and never applies commands or writes plan/event state.
 */
export function proposeRetaFinalRedistribution(plan, options = {}) {
  if (!isRecord(options)) return invalidResult(['options deve ser um objeto.']);
  const validation = validateRetaFinalV2(plan);
  if (!validation.valid) {
    return invalidResult(
      validation.errors.map((error) => 'Plano inválido: ' + error),
    );
  }
  if (!isCivilDate(options.today)) {
    return invalidResult(['today deve ser uma data civil válida.']);
  }

  const persisted = plan.retaFinal.capacidade;
  if (!validCapacity(persisted)) {
    return invalidResult(['Capacidade persistida inválida.']);
  }
  if (!validOverrideMap(options.capacityByWeekday, validWeekdayOverride)) {
    return invalidResult([
      'capacityByWeekday deve mapear dias 0–6 para minutos inteiros não negativos.',
    ]);
  }
  if (!validOverrideMap(options.exceptionsByDate, validExceptionOverride)) {
    return invalidResult([
      'exceptionsByDate deve mapear datas civis para minutos inteiros não negativos.',
    ]);
  }
  if (options.evidence !== undefined && !isRecord(options.evidence)) {
    return invalidResult(['evidence deve ser um objeto indexado por bloco.']);
  }
  const pinned = readPinnedIds(options.pinnedBlockIds);
  if (!pinned.valid) {
    return invalidResult(['pinnedBlockIds deve conter somente IDs válidos.']);
  }

  const finalDate = plan.retaFinal.dataFinal;
  const today = options.today;
  const dailyLoad = {};
  const dayEntries = new Map();

  if (today <= finalDate) {
    let date = today;
    while (date <= finalDate) {
      const capacity = resolveCapacity(
        date,
        persisted,
        options.capacityByWeekday || {},
        options.exceptionsByDate || {},
      );
      if (capacity == null) {
        return invalidResult([
          'Não há fonte de capacidade para ' +
            date +
            '; nenhuma capacidade foi presumida.',
        ]);
      }
      const entry = {
        capacityMinutes: capacity,
        usedMinutes: 0,
        remainingMinutes: capacity,
        overCapacityMinutes: 0,
        blockIds: [],
      };
      dailyLoad[date] = entry;
      dayEntries.set(date, { entry, blocks: [] });
      if (date === finalDate) break;
      date = nextDate(date);
    }
  }

  const candidates = plan.retaFinal.blocos
    .filter((block) => block.status === 'pendente' && block.arquivado !== true)
    .map((block) => ({
      block,
      pinned: isPinned(block, pinned.ids),
      score: scoreRetaFinalBlock(
        block,
        isRecord(options.evidence?.[block.id])
          ? options.evidence[block.id]
          : {},
      ),
    }))
    .sort(compareBlocks);

  const unallocated = [];
  const explanations = [];
  const operations = [];
  const diff = [];

  const addToLoad = (block, date) => {
    const target = dayEntries.get(date);
    if (!target) return;
    target.entry.usedMinutes += block.minutos;
    target.blocks.push(block);
  };

  for (const item of candidates.filter((candidate) => candidate.pinned)) {
    const block = item.block;
    const plannedDate = block.dataPlanejada;
    if (plannedDate > finalDate) {
      const reason = 'deadline';
      unallocated.push({
        blockId: block.id,
        plannedDate,
        minutes: block.minutos,
        reason,
      });
      explanations.push({
        blockId: block.id,
        score: item.score.score,
        reasons: item.score.reasons,
        sourcesUsed: item.score.sourcesUsed,
        from: plannedDate,
        to: null,
        status: 'unallocated',
        reason,
      });
    } else {
      if (plannedDate >= today) addToLoad(block, plannedDate);
      explanations.push({
        blockId: block.id,
        score: item.score.score,
        reasons: item.score.reasons,
        sourcesUsed: item.score.sourcesUsed,
        from: plannedDate,
        to: plannedDate,
        status: 'fixed',
        reason: plannedDate < today ? 'fixed_in_past' : 'pinned',
      });
    }
  }

  for (const item of candidates.filter((candidate) => !candidate.pinned)) {
    const block = item.block;
    const plannedDate = block.dataPlanejada;
    if (today > finalDate) {
      const reason = 'deadline';
      unallocated.push({
        blockId: block.id,
        plannedDate,
        minutes: block.minutos,
        reason,
      });
      explanations.push({
        blockId: block.id,
        score: item.score.score,
        reasons: item.score.reasons,
        sourcesUsed: item.score.sourcesUsed,
        from: plannedDate,
        to: null,
        status: 'unallocated',
        reason,
      });
      continue;
    }

    let allocatedDate = null;
    let date = today;
    while (date <= finalDate) {
      const entry = dailyLoad[date];
      if (entry.usedMinutes + block.minutos <= entry.capacityMinutes) {
        allocatedDate = date;
        addToLoad(block, date);
        break;
      }
      if (date === finalDate) break;
      date = nextDate(date);
    }

    if (!allocatedDate) {
      const reason = 'capacity';
      unallocated.push({
        blockId: block.id,
        plannedDate,
        minutes: block.minutos,
        reason,
      });
      explanations.push({
        blockId: block.id,
        score: item.score.score,
        reasons: item.score.reasons,
        sourcesUsed: item.score.sourcesUsed,
        from: plannedDate,
        to: null,
        status: 'unallocated',
        reason,
      });
      continue;
    }

    if (allocatedDate !== plannedDate) {
      const operation = {
        operationId:
          'rf-redistribution:' + JSON.stringify([block.id, allocatedDate]),
        type: 'MOVE',
        blockIds: [block.id],
        targetDate: allocatedDate,
        targetOrder: block.ordem,
      };
      const after = {
        ...block,
        dataPlanejada: allocatedDate,
        data: allocatedDate,
        ordem: block.ordem,
        reagendado: true,
      };
      operations.push(operation);
      diff.push({
        blockId: block.id,
        before: cloneValue(block),
        after: cloneValue(after),
        fieldsChanged: changedFields(block, after),
      });
    }
    explanations.push({
      blockId: block.id,
      score: item.score.score,
      reasons: item.score.reasons,
      sourcesUsed: item.score.sourcesUsed,
      from: plannedDate,
      to: allocatedDate,
      status: allocatedDate === plannedDate ? 'kept' : 'moved',
      reason:
        allocatedDate === plannedDate
          ? 'capacity_available'
          : 'capacity_redistributed',
    });
  }
  for (const { entry, blocks } of dayEntries.values()) {
    blocks.sort((left, right) => {
      if (left.ordem !== right.ordem) return left.ordem - right.ordem;
      return compareText(left.id, right.id);
    });
    entry.blockIds = blocks.map((block) => block.id);
    entry.remainingMinutes = Math.max(
      0,
      entry.capacityMinutes - entry.usedMinutes,
    );
    entry.overCapacityMinutes = Math.max(
      0,
      entry.usedMinutes - entry.capacityMinutes,
    );
  }

  return {
    operations,
    dailyLoad,
    unallocated,
    explanations,
    diff,
    valid: true,
    diagnostics: [],
  };
}
