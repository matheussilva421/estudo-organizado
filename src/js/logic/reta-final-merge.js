import { reconcileRetaFinalWithEvents } from './reta-final-core.js';
import { validateRetaFinalV2 } from './reta-final-schema.js';

const FIELDS = ['discId', 'topicos', 'minutos', 'dataPlanejada', 'dataOriginal', 'prioridade', 'observacao', 'fixado', 'arquivado'];
const COLLECTIONS = ['operations', 'pendingOperations'];

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}
function stable(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function equal(left, right) { return stable(left) === stable(right); }
function conflict(planId, blockId, fieldPath, base, local, remote, reason, extra = {}) {
  return {
    planId: planId || null, blockId: blockId || null, fieldPath,
    base: base === undefined ? null : clone(base),
    local: local === undefined ? null : clone(local),
    remote: remote === undefined ? null : clone(remote),
    reason, ...extra,
  };
}
function valueAt(object, key) { return object && Object.hasOwn(object, key) ? object[key] : undefined; }
function assign(target, key, value) {
  if (value === undefined) delete target[key];
  else target[key] = clone(value);
}
function idsFrom(plans) {
  const ids = new Set();
  for (const plan of plans) {
    for (const key of [...COLLECTIONS, 'operationIds']) {
      const items = Array.isArray(plan?.[key]) ? plan[key] : [];
      for (const item of items) {
        const id = key === 'operationIds' ? item : item?.operationId;
        if (typeof id === 'string' && id.trim()) ids.add(id);
      }
    }
  }
  return [...ids].sort();
}
function mergeCollection(key, plans, conflicts, planId) {
  const lists = plans.map((plan) => Array.isArray(plan?.[key]) ? plan[key] : []);
  const ids = new Set(lists.flat().map((item) => item?.operationId).filter((id) => typeof id === 'string' && id.trim()));
  const result = [];
  for (const id of [...ids].sort()) {
    const [base, local, remote] = lists.map((list) => list.find((item) => item?.operationId === id));
    if (local && remote && !equal(local, remote)) {
      conflicts.push(conflict(planId, null, key + '[' + id + ']', base, local, remote,
        'O mesmo ID de operação representa conteúdos diferentes.'));
    }
    if (local || remote || base) result.push(clone(local || remote || base));
  }
  const anonymous = new Map();
  for (const item of lists.flat()) {
    if (typeof item?.operationId === 'string' && item.operationId.trim()) continue;
    anonymous.set(stable(item), clone(item));
  }
  return [...result, ...[...anonymous].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item)];
}
function deterministicPick(left, right) {
  return stable(left) <= stable(right) ? left : right;
}
function mergeObject(base, local, remote, conflicts, planId, path = '', excluded = new Set(), reportConflicts = true) {
  const result = {};
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const key of [...keys].sort()) {
    if (excluded.has(key)) continue;
    const b = valueAt(base, key), l = valueAt(local, key), r = valueAt(remote, key);
    const lc = !equal(l, b), rc = !equal(r, b), divergent = lc && rc && !equal(l, r);
    if (divergent && reportConflicts) {
      conflicts.push(conflict(planId, null, path ? path + '.' + key : key, b, l, r,
        'O mesmo campo do plano foi alterado de formas diferentes.'));
    }
    const selected = !lc ? r : !rc || equal(l, r) ? l : reportConflicts ? l : deterministicPick(l, r);
    assign(result, key, selected);
  }
  return result;
}
function blockMap(plan) { return new Map((plan?.retaFinal?.blocos || []).map((item) => [item.id, item])); }
function changedFields(base, changed) {
  return FIELDS.filter((key) => !equal(valueAt(base, key), valueAt(changed, key)));
}
function mergeBlock(base, local, remote, planId, conflicts) {
  const result = mergeObject(
    base || {}, local || {}, remote || {}, conflicts, planId,
    'retaFinal.blocos.' + (local?.id || remote?.id || base?.id),
    new Set(FIELDS), false
  );
  const localArchiveChanged = !equal(valueAt(local, 'arquivado'), valueAt(base, 'arquivado'));
  const remoteArchiveChanged = !equal(valueAt(remote, 'arquivado'), valueAt(base, 'arquivado'));
  const localEdits = changedFields(base, local).filter((field) => field !== 'arquivado');
  const remoteEdits = changedFields(base, remote).filter((field) => field !== 'arquivado');
  const archiveConflict = (localArchiveChanged && remoteEdits.length) || (remoteArchiveChanged && localEdits.length);
  if (archiveConflict) {
    conflicts.push(conflict(planId, local?.id || remote?.id || base?.id, 'arquivado',
      valueAt(base, 'arquivado'), valueAt(local, 'arquivado'), valueAt(remote, 'arquivado'),
      'Arquivamento concorre com edições simultâneas do bloco.',
      { relatedFieldPaths: localArchiveChanged ? remoteEdits : localEdits }));
  }
  for (const key of FIELDS) {
    const b = valueAt(base, key), l = valueAt(local, key), r = valueAt(remote, key);
    const lc = !equal(l, b), rc = !equal(r, b), divergent = lc && rc && !equal(l, r);
    if (divergent && !(key === 'arquivado' && archiveConflict)) {
      conflicts.push(conflict(planId, local?.id || remote?.id || base?.id, key, b, l, r,
        'O mesmo campo do bloco foi alterado de formas diferentes.'));
    }
    assign(result, key, !lc ? r : !rc || equal(l, r) ? l : l);
  }
  return result;
}
function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validCapacity(capacity) {
  if (capacity == null) return true;
  const allowed = ['minutosPorDiaSemana', 'excecoesPorData', 'folgas', 'maximoDiario'];
  if (!record(capacity) || !Object.keys(capacity).length || Object.keys(capacity).some((key) => !allowed.includes(key))) return false;
  if (capacity.minutosPorDiaSemana !== undefined &&
      (!record(capacity.minutosPorDiaSemana) || Object.entries(capacity.minutosPorDiaSemana).some(([day, value]) => !/^[0-6]$/.test(day) || !Number.isInteger(value) || value < 0))) return false;
  if (capacity.excecoesPorData !== undefined &&
      (!record(capacity.excecoesPorData) || Object.entries(capacity.excecoesPorData).some(([date, value]) => !civilDate(date) || !Number.isInteger(value) || value < 0))) return false;
  if (capacity.folgas !== undefined &&
      (!Array.isArray(capacity.folgas) || capacity.folgas.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) return false;
  return capacity.maximoDiario === undefined || (Number.isInteger(capacity.maximoDiario) && capacity.maximoDiario >= 0);
}
function validateCapacity(plan, sources, conflicts) {
  const capacity = plan.retaFinal.capacidade;
  if (capacity == null) return;
  const [base, local, remote] = sources;
  const reject = (block, reason, extra = {}) => conflicts.push(conflict(plan.planId, block?.id || null,
    'retaFinal.capacidade', base.retaFinal?.capacidade, local.retaFinal?.capacidade,
    remote.retaFinal?.capacidade, reason, extra));
  if (!validCapacity(capacity)) { reject(null, 'A capacidade combinada é inválida.'); return; }
  const loads = new Map();
  for (const block of plan.retaFinal.blocos) {
    if (block.arquivado === true || block.status === 'concluido') continue;
    const date = block.dataPlanejada;
    const weekday = new Date(date + 'T00:00:00.000Z').getUTCDay();
    let limit;
    if (Object.hasOwn(capacity.excecoesPorData || {}, date)) limit = capacity.excecoesPorData[date];
    else if ((capacity.folgas || []).includes(weekday)) limit = 0;
    else if (Object.hasOwn(capacity.minutosPorDiaSemana || {}, String(weekday))) limit = capacity.minutosPorDiaSemana[String(weekday)];
    else { reject(block, 'Não há capacidade configurada para ' + date + '; nenhuma capacidade foi presumida.'); continue; }
    if (capacity.maximoDiario !== undefined) limit = Math.min(limit, capacity.maximoDiario);
    const used = (loads.get(date) || 0) + block.minutos;
    loads.set(date, used);
    if (used > limit) reject(block, 'A capacidade diária de ' + limit + ' minutos é excedida em ' + date,
      { date, usedMinutes: used, capacityMinutes: limit });
  }
}
function validateCatalog(plan, catalog, sources, conflicts) {
  if (!Array.isArray(catalog) || !catalog.length) return;
  const disciplines = catalog.flatMap((notice) => Array.isArray(notice?.disciplinas) ? notice.disciplinas : []);
  const [base, local, remote] = sources;
  for (const block of plan.retaFinal.blocos) {
    const matches = disciplines.filter((item) => item?.id === block.discId);
    if (matches.length !== 1 || (plan.disciplinas?.length && !plan.disciplinas.includes(block.discId))) {
      conflicts.push(conflict(plan.planId, block.id, 'discId',
        blockMap(base).get(block.id)?.discId, blockMap(local).get(block.id)?.discId, blockMap(remote).get(block.id)?.discId,
        'A disciplina do bloco não existe de forma única no catálogo.'));
      continue;
    }
    for (const topic of block.topicos) {
      for (const [field, collection] of [['assId', 'assuntos'], ['aulaId', 'aulas']]) {
        if (topic[field] == null) continue;
        const refs = disciplines.flatMap((discipline) =>
          (discipline[collection] || []).filter((item) => item?.id === topic[field]).map(() => discipline)
        );
        if (refs.length !== 1 || refs[0] !== matches[0]) conflicts.push(conflict(plan.planId, block.id, 'topicos.' + field,
          null, topic[field], topic[field], 'A referência do tópico não aponta para item único da disciplina.'));
      }
    }
  }
}
function planDiff(basePlan, plan) {
  const before = blockMap(basePlan), after = blockMap(plan), changes = [];
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const b = before.get(id), a = after.get(id);
    if (!b || !a) { changes.push({ blockId: id, fieldPath: '$existence', base: clone(b || null), merged: clone(a || null) }); continue; }
    for (const key of FIELDS) if (!equal(valueAt(b, key), valueAt(a, key))) {
      changes.push({ blockId: id, fieldPath: key, base: clone(valueAt(b, key) ?? null), merged: clone(valueAt(a, key) ?? null) });
    }
  }
  return changes;
}
function blocked(localPlan, remotePlan, conflicts, plans = []) {
  return { plan: clone(localPlan || remotePlan || null), conflicts, appliedOperationIds: idsFrom(plans), diff: [], valid: false };
}

/** Pure, conservative three-way merge for one verified Reta Final v2 lineage. */
export function mergeRetaFinalPlans({ basePlan, localPlan, remotePlan, events = [], catalog } = {}) {
  const planId = localPlan?.planId || remotePlan?.planId || basePlan?.planId || null;
  const sources = [basePlan, localPlan, remotePlan];
  if (!basePlan) return blocked(localPlan, remotePlan, [
    conflict(planId, null, '$base', null, localPlan, remotePlan, 'A base verificada é obrigatória para mesclar uma Reta Final v2.')
  ], sources);
  if ([basePlan.planId, localPlan.planId, remotePlan.planId].some((id) => typeof id !== 'string' || !id.trim()) || ![basePlan.planId, localPlan.planId, remotePlan.planId].every((id) => id === basePlan.planId)) {
    return blocked(localPlan, remotePlan, [
      conflict(planId, null, 'planId', basePlan.planId, localPlan.planId, remotePlan.planId,
        'Base, plano local e plano remoto pertencem a linhagens diferentes.')
    ], sources);
  }
  const schemaConflicts = [];
  for (const [side, plan] of [['base', basePlan], ['local', localPlan], ['remote', remotePlan]]) {
    const validation = validateRetaFinalV2(plan);
    const errors = [...validation.errors];
    if (plan?.ativo !== true) errors.push('O plano precisa estar ativo.');
    if (errors.length) schemaConflicts.push(conflict(planId, null, 'schema',
      side === 'base' ? errors : null, side === 'local' ? errors : null, side === 'remote' ? errors : null,
      'O plano ' + side + ' não é um Reta Final v2 válido.', { side, errors }));
  }
  if (schemaConflicts.length) return blocked(localPlan, remotePlan, schemaConflicts, sources);

  const conflicts = [];
  const merged = mergeObject(basePlan, localPlan, remotePlan, conflicts, planId, '', new Set([
    'retaFinal', 'revision', 'updatedAt', ...COLLECTIONS, 'operationIds',
  ]));
  const retaFinal = mergeObject(basePlan.retaFinal, localPlan.retaFinal, remotePlan.retaFinal,
    conflicts, planId, 'retaFinal', new Set(['blocos']));
  const baseBlocks = blockMap(basePlan), localBlocks = blockMap(localPlan), remoteBlocks = blockMap(remotePlan);
  const blocks = [];
  for (const id of [...new Set([...baseBlocks.keys(), ...localBlocks.keys(), ...remoteBlocks.keys()])].sort()) {
    const b = baseBlocks.get(id), l = localBlocks.get(id), r = remoteBlocks.get(id);
    if (b && (!l || !r)) {
      const survivor = l || r;
      if (!survivor) continue;
      const edits = changedFields(b, survivor);
      if (edits.length) {
        conflicts.push(conflict(planId, id, '$existence', b, l || null, r || null,
          'A ausência do bloco concorre com uma edição de intenção.', { relatedFieldPaths: edits }));
        if (l) blocks.push(clone(l));
      }
      continue;
    }
    if (!b && (!l || !r)) { blocks.push(clone(l || r)); continue; }
    blocks.push(mergeBlock(b, l, r, planId, conflicts));
  }
  merged.retaFinal = { ...retaFinal, blocos: blocks };
  merged.revision = Math.max(basePlan.revision, localPlan.revision, remotePlan.revision);
  merged.updatedAt = [localPlan.updatedAt, remotePlan.updatedAt].filter((value) => typeof value === 'string')
    .sort((a, b) => (Date.parse(a) || 0) - (Date.parse(b) || 0) || a.localeCompare(b)).at(-1) || null;
  for (const key of COLLECTIONS) merged[key] = mergeCollection(key, sources, conflicts, planId);
  const operationIds = idsFrom(sources);
  if (operationIds.length) merged.operationIds = operationIds;
  else delete merged.operationIds;

  const validation = validateRetaFinalV2(merged);
  if (!validation.valid) conflicts.push(conflict(planId, null, 'schema', null, validation.errors, null,
    'O resultado da mescla não passou pela validação do schema Reta Final v2.', { errors: validation.errors }));
  else {
    reconcileRetaFinalWithEvents(merged, events);
    validateCapacity(merged, sources, conflicts);
    validateCatalog(merged, catalog, sources, conflicts);
  }
  return {
    plan: merged, conflicts, appliedOperationIds: operationIds,
    diff: planDiff(basePlan, merged), valid: conflicts.length === 0,
  };
}
