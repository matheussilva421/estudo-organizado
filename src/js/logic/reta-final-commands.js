// =============================================
// RETA FINAL — COMANDOS PUROS
// Aplica operações editoriais sobre um plano v2 sem escrever em estado,
// armazenamento ou eventos. A saída é um plano novo e um diff canônico.
// Histórico, timer, questões, revisões e vínculos nunca são reescritos.
// =============================================

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const COMMAND_TYPES = new Set([
  'CREATE',
  'PATCH',
  'MOVE',
  'DUPLICATE',
  'ARCHIVE',
  'SET_DURATION',
  'SET_PRIORITY',
  'SET_CAPACITY',
  'EXTEND_DEADLINE',
]);

const BLOCK_COMMAND_TYPES = new Set([
  'PATCH',
  'MOVE',
  'DUPLICATE',
  'ARCHIVE',
  'SET_DURATION',
  'SET_PRIORITY',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  'status',
  'data',
  'dataOriginal',
  'dataEstudo',
  'tempoAcumulado',
  'questoes',
  'revisoes',
  'historico',
  'paginas',
  'rolagens',
  'rfBlocoId',
  'arquivado',
  'reagendado',
  '_timerStart',
  'timerAtivo',
]);

const EDITABLE_PATCH_FIELDS = new Set([
  'discId',
  'topicos',
  'minutos',
  'prioridade',
  'observacao',
  'dataPlanejada',
  'ordem',
  'fixado',
]);

const CREATE_FIELDS = new Set([
  'discId',
  'topicos',
  'minutos',
  'prioridade',
  'observacao',
  'dataPlanejada',
  'ordem',
  'fixado',
]);

const ANNOTATION_FIELDS = new Set(['prioridade', 'observacao']);

function isPlainObject(value) {
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
  const day = parts[2];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function isPositiveMinutes(value) {
  return Number.isInteger(value) && value > 0;
}

function isOrder(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasOrderRange(start, count) {
  return (
    isOrder(start) &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    start <= Number.MAX_SAFE_INTEGER - (count - 1)
  );
}

function isPriority(value) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 5);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = cloneValue(item);
    return out;
  }
  return value;
}

function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!sameValue(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function changedFields(before, after) {
  if (before === null || before === undefined) return Object.keys(after || {}).sort();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const key of keys) {
    if (!sameValue(before[key], after[key])) changed.push(key);
  }
  return changed.sort();
}

function diagnostic(code, command, message, extra) {
  const operationId =
    command && typeof command.operationId === 'string' ? command.operationId : null;
  const type = command && typeof command.type === 'string' ? command.type : null;
  return {
    code,
    operationId,
    type,
    blockId: extra && extra.blockId != null ? extra.blockId : null,
    ...(extra || {}),
    message,
  };
}

function invalidResult(plan, diagnostics) {
  return { plan, diff: [], diagnostics, valid: false };
}

function validResult(plan, diff) {
  return { plan, diff, diagnostics: [], valid: true };
}

function blockIndex(blocos) {
  const index = new Map();
  for (const bloco of blocos) {
    if (isPlainObject(bloco) && isId(bloco.id)) index.set(bloco.id, bloco);
  }
  return index;
}

function blockDiff(before, after) {
  return {
    blockId: after && after.id != null ? after.id : before && before.id != null ? before.id : null,
    before: before ? cloneValue(before) : null,
    after: after ? cloneValue(after) : null,
    fieldsChanged: changedFields(before, after),
  };
}

function planError(plan) {
  if (!isPlainObject(plan)) return 'Plano ausente ou inválido.';
  if (plan.tipo !== 'reta_final') return 'Plano não é uma Reta Final.';
  if (plan.schemaVersionRetaFinal !== 2) return 'schemaVersionRetaFinal deve ser 2.';
  if (!isId(plan.planId)) return 'planId ausente ou inválido.';
  if (!Number.isSafeInteger(plan.revision) || plan.revision < 0) {
    return 'revision deve ser um inteiro não negativo.';
  }
  if (!isPlainObject(plan.retaFinal) || !Array.isArray(plan.retaFinal.blocos)) {
    return 'retaFinal.blocos deve ser uma lista.';
  }
  if (!isCivilDate(plan.retaFinal.dataFinal)) return 'dataFinal inválida.';
  return null;
}

function readIdSet(value) {
  const ids = new Set();
  if (value instanceof Set) {
    for (const id of value) if (isId(id)) ids.add(id);
    return ids;
  }
  if (Array.isArray(value)) {
    for (const id of value) if (isId(id)) ids.add(id);
    return ids;
  }
  if (typeof value === 'string') {
    if (isId(value)) ids.add(value);
    return ids;
  }
  if (isPlainObject(value)) {
    for (const [id, active] of Object.entries(value)) {
      if (active && isId(id)) ids.add(id);
    }
  }
  return ids;
}

function timerIdsFromEvents(events) {
  const ids = new Set();
  for (const event of events) {
    if (!event || !isId(event.rfBlocoId)) continue;
    if (event._timerStart || event.timerAtivo === true) ids.add(event.rfBlocoId);
  }
  return ids;
}

function readContext(options) {
  const source = isPlainObject(options) ? options : {};
  const events = Array.isArray(source.events) ? source.events : [];
  const timerIds = readIdSet(source.activeTimerIds);
  for (const id of timerIdsFromEvents(events)) timerIds.add(id);
  return {
    events,
    catalog: Array.isArray(source.catalog) ? source.catalog : [],
    timerIds,
    today: isCivilDate(source.today) ? source.today : null,
    makeId: typeof source.makeId === 'function' ? source.makeId : null,
  };
}

function commandShapeError(command) {
  if (!isPlainObject(command)) return 'COMANDO_INVALIDO';
  if (!isId(command.operationId)) return 'OPERATION_ID_INVALIDO';
  if (!COMMAND_TYPES.has(command.type)) return 'TIPO_INVALIDO';
  if (BLOCK_COMMAND_TYPES.has(command.type)) {
    if (!Array.isArray(command.blockIds) || command.blockIds.length === 0) {
      return 'ALVOS_INVALIDOS';
    }
    const seen = new Set();
    for (const id of command.blockIds) {
      if (!isId(id) || seen.has(id)) return 'ALVOS_INVALIDOS';
      seen.add(id);
    }
  }
  return null;
}

function commandShapeMessage(code) {
  if (code === 'COMANDO_INVALIDO') return 'O comando deve ser um objeto.';
  if (code === 'OPERATION_ID_INVALIDO') return 'operationId é obrigatório.';
  if (code === 'TIPO_INVALIDO') return 'Tipo de comando não suportado.';
  return 'Informe ao menos um bloco válido, sem repetições.';
}
function addMissingBlocks(diagnostics, blockIds, byId, command) {
  for (const id of blockIds) {
    if (!byId.has(id)) {
      diagnostics.push(
        diagnostic('BLOCO_NAO_ENCONTRADO', command, 'Bloco ' + id + ' não encontrado no plano.', {
          blockId: id,
        })
      );
    }
  }
}

function addTimerConflicts(diagnostics, blockIds, ctx, command) {
  for (const id of blockIds) {
    if (ctx.timerIds.has(id)) {
      diagnostics.push(
        diagnostic(
          'TIMER_ATIVO',
          command,
          'O bloco ' + id + ' tem um timer ativo; finalize o timer antes desta operação.',
          { blockId: id }
        )
      );
    }
  }
}

function findDiscipline(catalog, discId) {
  if (!isId(discId)) return null;
  for (const edital of catalog) {
    for (const disc of edital?.disciplinas || []) {
      if (disc?.id === discId) return disc;
    }
  }
  return null;
}

function validTopicos(topicos, disc) {
  if (!disc || !Array.isArray(topicos) || topicos.length === 0) return false;
  for (const topico of topicos) {
    if (!isPlainObject(topico)) return false;
    const hasAssunto = topico.assId != null;
    const hasAula = topico.aulaId != null;
    if (!hasAssunto && !hasAula) return false;
    if (
      hasAssunto &&
      (!isId(topico.assId) || !(disc.assuntos || []).some((item) => item?.id === topico.assId))
    ) {
      return false;
    }
    if (
      hasAula &&
      (!isId(topico.aulaId) || !(disc.aulas || []).some((item) => item?.id === topico.aulaId))
    ) {
      return false;
    }
  }
  return true;
}

function normalizeTopicos(topicos) {
  return topicos.map((topico) => {
    const source = isPlainObject(topico) ? topico : {};
    return {
      assId: source.assId != null ? source.assId : null,
      aulaId: source.aulaId != null ? source.aulaId : null,
    };
  });
}

function validatePatch(patch, command) {
  const diagnostics = [];
  if (!isPlainObject(patch)) {
    diagnostics.push(
      diagnostic('CAMPO_NAO_EDITAVEL', command, 'patch deve ser um objeto de campos.')
    );
    return diagnostics;
  }
  for (const [field, value] of Object.entries(patch)) {
    if (PROTECTED_FIELDS.has(field)) {
      diagnostics.push(
        diagnostic(
          'CAMPO_PROTEGIDO',
          command,
          'O campo ' + field + ' pertence ao histórico ou ao estado derivado e não é editável.'
        )
      );
    } else if (!EDITABLE_PATCH_FIELDS.has(field)) {
      diagnostics.push(
        diagnostic('CAMPO_NAO_EDITAVEL', command, 'O campo ' + field + ' não é editável.')
      );
    } else if (field === 'minutos' && !isPositiveMinutes(value)) {
      diagnostics.push(
        diagnostic('MINUTOS_INVALIDOS', command, 'minutos deve ser um inteiro maior que zero.')
      );
    } else if (field === 'prioridade' && !isPriority(value)) {
      diagnostics.push(
        diagnostic('PRIORIDADE_INVALIDA', command, 'prioridade deve ser nula ou estar entre 1 e 5.')
      );
    } else if (field === 'ordem' && !isOrder(value)) {
      diagnostics.push(
        diagnostic('ORDEM_INVALIDA', command, 'ordem deve ser um inteiro não negativo.')
      );
    } else if (field === 'dataPlanejada' && !isCivilDate(value)) {
      diagnostics.push(
        diagnostic('DATA_INVALIDA', command, 'dataPlanejada deve ser uma data civil YYYY-MM-DD.')
      );
    } else if (field === 'discId' && !isId(value)) {
      diagnostics.push(
        diagnostic('REFERENCIA_INVALIDA', command, 'discId deve ser um identificador válido.')
      );
    } else if (field === 'topicos' && (!Array.isArray(value) || value.length === 0)) {
      diagnostics.push(
        diagnostic('REFERENCIA_INVALIDA', command, 'topicos deve ser uma lista com vínculos.')
      );
    } else if (field === 'observacao' && value !== null && typeof value !== 'string') {
      diagnostics.push(
        diagnostic('VALOR_INVALIDO', command, 'observacao deve ser texto ou nula.')
      );
    } else if (field === 'fixado' && typeof value !== 'boolean') {
      diagnostics.push(
        diagnostic('VALOR_INVALIDO', command, 'fixado deve ser booleano.')
      );
    }
  }
  return diagnostics;
}

function hasStructuralPatch(patch) {
  return Object.keys(patch || {}).some((field) => !ANNOTATION_FIELDS.has(field));
}

function patchedBlock(block, patch) {
  const next = { ...block };
  for (const [field, value] of Object.entries(patch)) {
    next[field] = field === 'topicos' ? normalizeTopicos(value) : cloneValue(value);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'dataPlanejada')) {
    next.data = patch.dataPlanejada;
    next.reagendado = true;
  }
  return next;
}

function validatePatchedReferences(diagnostics, candidates, patch, ctx, command) {
  const touchesReferences =
    Object.prototype.hasOwnProperty.call(patch, 'discId') ||
    Object.prototype.hasOwnProperty.call(patch, 'topicos');
  if (!touchesReferences) return;
  for (const [id, block] of candidates) {
    const disc = findDiscipline(ctx.catalog, block.discId);
    if (!validTopicos(block.topicos, disc)) {
      diagnostics.push(
        diagnostic(
          'REFERENCIA_INVALIDA',
          command,
          'Disciplina, assunto ou aula do bloco ' + id + ' não existe no catálogo.',
          { blockId: id }
        )
      );
    }
  }
}

function runPatch(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = validatePatch(command.patch, command);
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  if (hasStructuralPatch(command.patch)) {
    addTimerConflicts(diagnostics, command.blockIds, ctx, command);
  }
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const candidates = new Map();
  for (const id of command.blockIds) {
    candidates.set(id, patchedBlock(byId.get(id), command.patch));
  }
  validatePatchedReferences(diagnostics, candidates, command.patch, ctx, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const diff = command.blockIds.map((id) =>
    blockDiff(byId.get(id), candidates.get(id))
  );
  const blocos = plan.retaFinal.blocos.map((block) =>
    candidates.has(block.id) ? candidates.get(block.id) : block
  );
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}
function runMove(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = [];
  if (!isCivilDate(command.targetDate)) {
    diagnostics.push(
      diagnostic('DATA_INVALIDA', command, 'targetDate deve ser uma data civil YYYY-MM-DD.')
    );
  }
  if (
    command.targetOrder != null &&
    !hasOrderRange(command.targetOrder, command.blockIds.length)
  ) {
    diagnostics.push(
      diagnostic(
        'ORDEM_INVALIDA',
        command,
        'targetOrder deve iniciar uma faixa de ordens inteiras e seguras para todos os blocos.'
      )
    );
  }
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  addTimerConflicts(diagnostics, command.blockIds, ctx, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const candidates = new Map();
  command.blockIds.forEach((id, index) => {
    const before = byId.get(id);
    candidates.set(id, {
      ...before,
      dataPlanejada: command.targetDate,
      data: command.targetDate,
      ordem: command.targetOrder == null ? before.ordem : command.targetOrder + index,
      reagendado: true,
    });
  });
  const diff = command.blockIds.map((id) => blockDiff(byId.get(id), candidates.get(id)));
  const blocos = plan.retaFinal.blocos.map((block) =>
    candidates.has(block.id) ? candidates.get(block.id) : block
  );
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}

function nextOrder(blocos) {
  let max = -1;
  for (const block of blocos) {
    if (isOrder(block.ordem)) max = Math.max(max, block.ordem);
  }
  return max === Number.MAX_SAFE_INTEGER ? null : max + 1;
}

function duplicateBlock(source, id, ordem) {
  const dataPlanejada = isCivilDate(source.dataPlanejada)
    ? source.dataPlanejada
    : source.data;
  const dataOriginal = isCivilDate(source.dataOriginal)
    ? source.dataOriginal
    : dataPlanejada;
  const block = {
    id,
    discId: source.discId,
    topicos: cloneValue(source.topicos || []),
    minutos: source.minutos,
    status: 'pendente',
    ordem,
    dataOriginal,
    dataPlanejada,
    data: dataPlanejada,
    rolagens: 0,
  };
  if (dataPlanejada !== dataOriginal) block.reagendado = true;
  if (source.prioridade !== undefined) block.prioridade = cloneValue(source.prioridade);
  if (source.observacao !== undefined) block.observacao = cloneValue(source.observacao);
  if (source.fixado !== undefined) block.fixado = cloneValue(source.fixado);
  return block;
}

function runDuplicate(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = [];
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);
  const startOrder = nextOrder(plan.retaFinal.blocos);
  if (!hasOrderRange(startOrder, command.blockIds.length)) {
    return invalidResult(plan, [
      diagnostic(
        'ORDEM_INVALIDA',
        command,
        'As ordens geradas para a duplicação devem ser inteiras e seguras.'
      ),
    ]);
  }
  if (!ctx.makeId) {
    return invalidResult(plan, [
      diagnostic('ID_INDISPONIVEL', command, 'Gerador de id não fornecido.'),
    ]);
  }

  const used = new Set(plan.retaFinal.blocos.map((block) => block?.id).filter(isId));
  const generated = new Map();
  for (const sourceId of command.blockIds) {
    let id = null;
    try {
      id = ctx.makeId();
    } catch {
      id = null;
    }
    if (!isId(id) || used.has(id)) {
      return invalidResult(plan, [
        diagnostic('ID_INDISPONIVEL', command, 'O id gerado é inválido ou já existe.', {
          blockId: sourceId,
        }),
      ]);
    }
    used.add(id);
    generated.set(sourceId, id);
  }

  let ordem = startOrder;
  const novos = command.blockIds.map((sourceId) => {
    const block = duplicateBlock(byId.get(sourceId), generated.get(sourceId), ordem);
    ordem++;
    return block;
  });
  const diff = novos.map((block) => blockDiff(null, block));
  const blocos = [...plan.retaFinal.blocos, ...novos];
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}

function runArchive(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = [];
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  addTimerConflicts(diagnostics, command.blockIds, ctx, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const candidates = new Map();
  for (const id of command.blockIds) {
    candidates.set(id, { ...byId.get(id), arquivado: true });
  }
  const diff = command.blockIds.map((id) => blockDiff(byId.get(id), candidates.get(id)));
  const blocos = plan.retaFinal.blocos.map((block) =>
    candidates.has(block.id) ? candidates.get(block.id) : block
  );
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}

function runSetDuration(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = [];
  const minutos = command.input?.minutos;
  if (!isPositiveMinutes(minutos)) {
    diagnostics.push(
      diagnostic('MINUTOS_INVALIDOS', command, 'minutos deve ser um inteiro maior que zero.')
    );
  }
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  addTimerConflicts(diagnostics, command.blockIds, ctx, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const candidates = new Map();
  for (const id of command.blockIds) {
    candidates.set(id, { ...byId.get(id), minutos });
  }
  const diff = command.blockIds.map((id) => blockDiff(byId.get(id), candidates.get(id)));
  const blocos = plan.retaFinal.blocos.map((block) =>
    candidates.has(block.id) ? candidates.get(block.id) : block
  );
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}

function runSetPriority(plan, command, ctx) {
  const byId = blockIndex(plan.retaFinal.blocos);
  const diagnostics = [];
  const prioridade = command.input?.prioridade;
  if (!isPriority(prioridade)) {
    diagnostics.push(
      diagnostic('PRIORIDADE_INVALIDA', command, 'prioridade deve ser nula ou estar entre 1 e 5.')
    );
  }
  addMissingBlocks(diagnostics, command.blockIds, byId, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);

  const candidates = new Map();
  for (const id of command.blockIds) {
    candidates.set(id, { ...byId.get(id), prioridade });
  }
  const diff = command.blockIds.map((id) => blockDiff(byId.get(id), candidates.get(id)));
  const blocos = plan.retaFinal.blocos.map((block) =>
    candidates.has(block.id) ? candidates.get(block.id) : block
  );
  return validResult({ ...plan, retaFinal: { ...plan.retaFinal, blocos } }, diff);
}
function validCapacity(capacity) {
  if (!isPlainObject(capacity)) return false;
  const allowed = new Set([
    'minutosPorDiaSemana',
    'excecoesPorData',
    'folgas',
    'maximoDiario',
  ]);
  const keys = Object.keys(capacity);
  if (keys.length === 0) return false;
  if (keys.some((key) => !allowed.has(key))) return false;
  if (keys.some((key) => capacity[key] === undefined)) return false;
  if (capacity.minutosPorDiaSemana !== undefined) {
    if (!isPlainObject(capacity.minutosPorDiaSemana)) return false;
    for (const [day, minutes] of Object.entries(capacity.minutosPorDiaSemana)) {
      if (!/^[0-6]$/.test(day) || !Number.isInteger(minutes) || minutes < 0) return false;
    }
  }
  if (capacity.excecoesPorData !== undefined) {
    if (!isPlainObject(capacity.excecoesPorData)) return false;
    for (const [date, minutes] of Object.entries(capacity.excecoesPorData)) {
      if (!isCivilDate(date) || !Number.isInteger(minutes) || minutes < 0) return false;
    }
  }
  if (capacity.folgas !== undefined) {
    if (!Array.isArray(capacity.folgas)) return false;
    for (const day of capacity.folgas) {
      if (!Number.isInteger(day) || day < 0 || day > 6) return false;
    }
  }
  if (capacity.maximoDiario !== undefined) {
    if (!Number.isInteger(capacity.maximoDiario) || capacity.maximoDiario < 0) return false;
  }
  return true;
}

function runSetCapacity(plan, command) {
  const capacity = command.input?.capacidade;
  if (!validCapacity(capacity)) {
    return invalidResult(plan, [
      diagnostic('CAPACIDADE_INVALIDA', command, 'Capacidade deve usar dias 0-6, minutos inteiros e datas válidas.'),
    ]);
  }
  const before = { capacidade: plan.retaFinal.capacidade };
  const after = { capacidade: cloneValue(capacity) };
  const next = {
    ...plan,
    retaFinal: { ...plan.retaFinal, capacidade: cloneValue(capacity) },
  };
  return validResult(next, [
    {
      blockId: null,
      before: cloneValue(before),
      after: cloneValue(after),
      fieldsChanged: sameValue(before.capacidade, after.capacidade)
        ? []
        : ['retaFinal.capacidade'],
    },
  ]);
}

function runExtendDeadline(plan, command, ctx) {
  const dataFinal = command.input?.dataFinal;
  if (!isCivilDate(dataFinal)) {
    return invalidResult(plan, [
      diagnostic('PRAZO_INVALIDO', command, 'dataFinal deve ser uma data civil YYYY-MM-DD.'),
    ]);
  }
  const atual = plan.retaFinal.dataFinal;
  if (dataFinal <= atual) {
    return invalidResult(plan, [
      diagnostic('PRAZO_NAO_ESTENDE', command, 'A nova dataFinal deve ser posterior ao prazo atual.'),
    ]);
  }
  if (ctx.today && dataFinal < ctx.today) {
    return invalidResult(plan, [
      diagnostic('DATA_PASSADA', command, 'A nova dataFinal não pode estar no passado.'),
    ]);
  }
  const next = {
    ...plan,
    retaFinal: { ...plan.retaFinal, dataFinal },
  };
  return validResult(next, [
    {
      blockId: null,
      before: { dataFinal: atual },
      after: { dataFinal },
      fieldsChanged: ['retaFinal.dataFinal'],
    },
  ]);
}

function createInputDiagnostics(input, plan, ctx, command) {
  const diagnostics = [];
  if (!isPlainObject(input)) {
    diagnostics.push(diagnostic('ENTRADA_INVALIDA', command, 'input deve ser um objeto.'));
    return diagnostics;
  }
  for (const [field] of Object.entries(input)) {
    if (PROTECTED_FIELDS.has(field)) {
      diagnostics.push(
        diagnostic(
          'CAMPO_PROTEGIDO',
          command,
          'O campo ' + field + ' pertence ao histórico ou ao estado derivado e não é editável.'
        )
      );
    } else if (!CREATE_FIELDS.has(field)) {
      diagnostics.push(
        diagnostic('CAMPO_NAO_EDITAVEL', command, 'O campo ' + field + ' não é editável.')
      );
    }
  }

  const minutos = input.minutos === undefined ? plan.retaFinal.minutosPadrao : input.minutos;
  if (!isPositiveMinutes(minutos)) {
    diagnostics.push(
      diagnostic('MINUTOS_INVALIDOS', command, 'minutos deve ser um inteiro maior que zero.')
    );
  }
  if (input.prioridade !== undefined && !isPriority(input.prioridade)) {
    diagnostics.push(
      diagnostic('PRIORIDADE_INVALIDA', command, 'prioridade deve ser nula ou estar entre 1 e 5.')
    );
  }
  if (input.ordem !== undefined && !isOrder(input.ordem)) {
    diagnostics.push(
      diagnostic('ORDEM_INVALIDA', command, 'ordem deve ser um inteiro não negativo.')
    );
  }
  const dataPlanejada =
    input.dataPlanejada === undefined ? ctx.today : input.dataPlanejada;
  if (!isCivilDate(dataPlanejada)) {
    diagnostics.push(
      diagnostic('DATA_INVALIDA', command, 'dataPlanejada deve ser uma data civil YYYY-MM-DD.')
    );
  }
  if (!isId(input.discId)) {
    diagnostics.push(
      diagnostic('REFERENCIA_INVALIDA', command, 'discId deve ser um identificador válido.')
    );
  }
  if (!Array.isArray(input.topicos) || input.topicos.length === 0) {
    diagnostics.push(
      diagnostic('REFERENCIA_INVALIDA', command, 'topicos deve ser uma lista com vínculos.')
    );
  }
  if (input.observacao !== undefined && input.observacao !== null && typeof input.observacao !== 'string') {
    diagnostics.push(
      diagnostic('VALOR_INVALIDO', command, 'observacao deve ser texto ou nula.')
    );
  }
  if (input.fixado !== undefined && typeof input.fixado !== 'boolean') {
    diagnostics.push(
      diagnostic('VALOR_INVALIDO', command, 'fixado deve ser booleano.')
    );
  }
  if (isId(input.discId)) {
    const disc = findDiscipline(ctx.catalog, input.discId);
    if (!disc) {
      diagnostics.push(
        diagnostic('REFERENCIA_INVALIDA', command, 'discId não existe no catálogo.')
      );
    } else if (
      Array.isArray(input.topicos) &&
      input.topicos.length > 0 &&
      !validTopicos(input.topicos, disc)
    ) {
      diagnostics.push(
        diagnostic(
          'REFERENCIA_INVALIDA',
          command,
          'Assunto ou aula não pertence à disciplina informada.'
        )
      );
    }
  }
  return diagnostics;
}

function runCreate(plan, command, ctx) {
  const input = command.input;
  const diagnostics = createInputDiagnostics(input, plan, ctx, command);
  if (diagnostics.length > 0) return invalidResult(plan, diagnostics);
  const ordem = input.ordem === undefined ? nextOrder(plan.retaFinal.blocos) : input.ordem;
  if (!isOrder(ordem)) {
    return invalidResult(plan, [
      diagnostic(
        'ORDEM_INVALIDA',
        command,
        'A ordem gerada para o novo bloco deve ser um inteiro seguro.'
      ),
    ]);
  }
  if (!ctx.makeId) {
    return invalidResult(plan, [
      diagnostic('ID_INDISPONIVEL', command, 'Gerador de id não fornecido.'),
    ]);
  }
  let id = null;
  try {
    id = ctx.makeId();
  } catch {
    id = null;
  }
  const used = new Set(plan.retaFinal.blocos.map((block) => block?.id).filter(isId));
  if (!isId(id) || used.has(id)) {
    return invalidResult(plan, [
      diagnostic('ID_INDISPONIVEL', command, 'O id gerado é inválido ou já existe.'),
    ]);
  }

  const dataPlanejada =
    input.dataPlanejada === undefined ? ctx.today : input.dataPlanejada;
  const minutos =
    input.minutos === undefined ? plan.retaFinal.minutosPadrao : input.minutos;
  const block = {
    id,
    discId: input.discId,
    topicos: normalizeTopicos(input.topicos),
    minutos,
    status: 'pendente',
    ordem,
    dataOriginal: dataPlanejada,
    dataPlanejada,
    data: dataPlanejada,
    rolagens: 0,
  };
  if (input.prioridade !== undefined) block.prioridade = cloneValue(input.prioridade);
  if (input.observacao !== undefined) block.observacao = cloneValue(input.observacao);
  if (input.fixado !== undefined) block.fixado = cloneValue(input.fixado);
  const blocos = [...plan.retaFinal.blocos, block];
  return validResult(
    { ...plan, retaFinal: { ...plan.retaFinal, blocos } },
    [blockDiff(null, block)]
  );
}
/**
 * Ids de blocos com sessão realmente concluída (estudei). Timer em
 * andamento e evento parcial nunca contam como conclusão.
 */
export function getCompletedRetaFinalBlocoIds(events) {
  const ids = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.status === 'estudei' && isId(event.rfBlocoId)) ids.add(event.rfBlocoId);
  }
  return ids;
}

/**
 * Aplica um comando editorial ao plano sem escrever em estado, armazenamento
 * ou eventos. Operações coletivas são atômicas: qualquer alvo inválido ou
 * protegido devolve o plano de entrada intacto e diff vazio.
 */
export function applyRetaFinalCommand(plan, command, options) {
  const ctx = readContext(options);
  const invalidPlan = planError(plan);
  if (invalidPlan) {
    return invalidResult(plan, [diagnostic('PLANO_INVALIDO', command, invalidPlan)]);
  }
  const shapeError = commandShapeError(command);
  if (shapeError) {
    return invalidResult(plan, [
      diagnostic(shapeError, command, commandShapeMessage(shapeError)),
    ]);
  }

  if (command.type === 'MOVE') return runMove(plan, command, ctx);
  if (command.type === 'PATCH') return runPatch(plan, command, ctx);
  if (command.type === 'DUPLICATE') return runDuplicate(plan, command, ctx);
  if (command.type === 'ARCHIVE') return runArchive(plan, command, ctx);
  if (command.type === 'SET_DURATION') return runSetDuration(plan, command, ctx);
  if (command.type === 'SET_PRIORITY') return runSetPriority(plan, command, ctx);
  if (command.type === 'SET_CAPACITY') return runSetCapacity(plan, command);
  if (command.type === 'EXTEND_DEADLINE') return runExtendDeadline(plan, command, ctx);
  if (command.type === 'CREATE') return runCreate(plan, command, ctx);

  return invalidResult(plan, [
    diagnostic('TIPO_INVALIDO', command, commandShapeMessage('TIPO_INVALIDO')),
  ]);
}
