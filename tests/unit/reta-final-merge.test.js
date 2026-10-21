import { describe, expect, it } from 'vitest';
import { mergeRetaFinalPlans } from '../../src/js/logic/reta-final-merge.js';
import { validateRetaFinalV2 } from '../../src/js/logic/reta-final-schema.js';

const block = (id, patch = {}) => ({
  id, discId: 'disc_1', topicos: [{ assId: 'ass_1', aulaId: null }],
  minutos: 60, dataPlanejada: '2026-10-20', dataOriginal: '2026-10-20',
  ordem: 0, status: 'pendente', ...patch,
});
function plan(blocos, patch = {}) {
  const { retaFinal = {}, ...rest } = patch;
  return {
    ativo: true, tipo: 'reta_final', planId: 'rf-plan-1',
    schemaVersionRetaFinal: 2, revision: 4,
    updatedAt: '2026-10-19T10:00:00.000Z', disciplinas: ['disc_1'],
    retaFinal: { dataFinal: '2026-12-31', minutosPadrao: 60, blocos, ...retaFinal },
    ...rest,
  };
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

describe('mergeRetaFinalPlans', () => {
  it('combines a local move of block A with a remote creation of block B', () => {
    const basePlan = plan([block('a')]);
    const localPlan = plan([block('a', { dataPlanejada: '2026-10-22', status: 'nao_coberto' })], { revision: 5 });
    const remotePlan = plan([block('a'), block('b')], { revision: 5 });
    const result = mergeRetaFinalPlans({ basePlan, localPlan, remotePlan, events: [] });
    expect(result.valid).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.plan.retaFinal.blocos.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.plan.retaFinal.blocos[0].dataPlanejada).toBe('2026-10-22');
  });

  it('reports same-field divergence and keeps the local value provisional', () => {
    const result = mergeRetaFinalPlans({
      basePlan: plan([block('a')]),
      localPlan: plan([block('a', { minutos: 90 })]),
      remotePlan: plan([block('a', { minutos: 120 })]),
      events: [],
    });
    expect(result.valid).toBe(false);
    expect(result.plan.retaFinal.blocos[0].minutos).toBe(90);
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      planId: 'rf-plan-1', blockId: 'a', fieldPath: 'minutos',
      base: 60, local: 90, remote: 120, reason: expect.any(String),
    }));
  });

  it('reports archive versus edit explicitly', () => {
    const result = mergeRetaFinalPlans({
      basePlan: plan([block('a', { arquivado: false })]),
      localPlan: plan([block('a', { arquivado: true })]),
      remotePlan: plan([block('a', { observacao: 'remote edit' })]),
      events: [],
    });
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      blockId: 'a', fieldPath: 'arquivado', reason: expect.stringMatching(/arquiv/i),
    }));
  });

  it('deduplicates operation IDs and does not replay the operation', () => {
    const ops = [{ operationId: 'op-1', type: 'PATCH' }];
    const pending = [{ operationId: 'op-2', type: 'MOVE' }];
    const result = mergeRetaFinalPlans({
      basePlan: plan([block('a')]),
      localPlan: plan([block('a', { minutos: 90 })], { operations: ops, pendingOperations: pending }),
      remotePlan: plan([block('a', { minutos: 90 })], { operations: ops, pendingOperations: pending }),
      events: [],
    });
    expect(result.appliedOperationIds).toEqual(['op-1', 'op-2']);
    expect(result.plan.operations).toHaveLength(1);
    expect(result.plan.pendingOperations).toHaveLength(1);
    expect(result.plan.retaFinal.blocos).toHaveLength(1);
    expect(result.plan.retaFinal.blocos[0].minutos).toBe(90);
  });

  it('blocks a missing base, a different lineage, and delete versus edit', () => {
    const localPlan = plan([block('a', { minutos: 90 })]);
    const remotePlan = plan([block('a', { minutos: 120 })], { revision: 9 });
    const missing = mergeRetaFinalPlans({ localPlan, remotePlan, events: [] });
    const lineage = mergeRetaFinalPlans({
      basePlan: plan([block('a')], { planId: 'other-plan' }),
      localPlan, remotePlan, events: [],
    });
    const deletion = mergeRetaFinalPlans({
      basePlan: plan([block('a')]),
      localPlan: plan([]),
      remotePlan: plan([block('a', { observacao: 'edited' })]),
      events: [],
    });
    expect(missing.conflicts[0]).toMatchObject({ fieldPath: '$base', blockId: null });
    expect(missing.plan.retaFinal.blocos[0].minutos).toBe(90);
    expect(lineage.conflicts[0]).toMatchObject({ fieldPath: 'planId', blockId: null });
    expect(deletion.conflicts).toContainEqual(expect.objectContaining({
      blockId: 'a', fieldPath: '$existence', local: null,
      remote: expect.objectContaining({ observacao: 'edited' }),
    }));
  });

  it('reconciles completion while preserving immutable inputs and event history', () => {
    const basePlan = freezeDeep(plan([block('a')]));
    const localPlan = freezeDeep(plan([block('a')]));
    const remotePlan = freezeDeep(plan([block('a')]));
    const events = freezeDeep([{
      id: 'ev-a', rfBlocoId: 'a', status: 'estudei',
      data: '2026-10-20', tempoAcumulado: 5400, titulo: 'History',
    }]);
    const before = stable({ basePlan, localPlan, remotePlan, events });
    const result = mergeRetaFinalPlans({ basePlan, localPlan, remotePlan, events });
    expect(result.plan.retaFinal.blocos[0].status).toBe('concluido');
    expect(stable({ basePlan, localPlan, remotePlan, events })).toBe(before);
    expect(events[0].tempoAcumulado).toBe(5400);
  });

  it('blocks a merged plan that exceeds daily capacity', () => {
    const opts = { retaFinal: { capacidade: { minutosPorDiaSemana: { 2: 90 } } } };
    const result = mergeRetaFinalPlans({
      basePlan: plan([block('a')], opts),
      localPlan: plan([block('a')], opts),
      remotePlan: plan([block('a'), block('b')], opts),
      events: [],
    });
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      fieldPath: 'retaFinal.capacidade', reason: expect.stringMatching(/capacidade/i),
    }));
  });

  it('is deterministic for non-conflicting edits in either argument order', () => {
    const basePlan = plan([block('a'), block('b')]);
    const localPlan = plan([block('a', { dataPlanejada: '2026-10-22', status: 'nao_coberto' }), block('b')]);
    const remotePlan = plan([block('a', { status: 'atrasado' }), block('b', { prioridade: 4, rolagens: 2 }), block('c')]);
    const first = mergeRetaFinalPlans({ basePlan, localPlan, remotePlan, events: [] });
    const second = mergeRetaFinalPlans({ basePlan, localPlan: remotePlan, remotePlan: localPlan, events: [] });
    expect(first.conflicts).toEqual([]);
    expect(stable(first.plan)).toBe(stable(second.plan));
  });
});


describe('mergeRetaFinalPlans reference validation', () => {
  const block = {
    id: 'rf-a', discId: 'disc_1', topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60, dataPlanejada: '2026-10-20', dataOriginal: '2026-10-20', ordem: 0,
  };
  const plan = (blocos) => ({
    ativo: true, tipo: 'reta_final', planId: 'rf-plan-1', schemaVersionRetaFinal: 2, revision: 4,
    disciplinas: ['disc_1'], retaFinal: { dataFinal: '2026-12-31', minutosPadrao: 60, blocos },
  });

  it('validates merged schema and blocks missing catalog references', () => {
    const basePlan = plan([block]);
    const result = mergeRetaFinalPlans({
      basePlan, localPlan: plan([block]), remotePlan: plan([block]), events: [],
      catalog: [{ id: 'ed-1', disciplinas: [{ id: 'disc_1', assuntos: [], aulas: [] }] }],
    });
    expect(validateRetaFinalV2(result.plan).valid).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.conflicts).toContainEqual(expect.objectContaining({ blockId: 'rf-a', fieldPath: 'topicos.assId' }));
  });
});


describe('mergeRetaFinalPlans lineage identity', () => {
  it('blocks a missing planId instead of attempting the merge', () => {
    const basePlan = plan([block('a')]);
    const localPlan = plan([block('a')], { planId: '' });
    const remotePlan = plan([block('a')]);
    const result = mergeRetaFinalPlans({ basePlan, localPlan, remotePlan, events: [] });
    expect(result.valid).toBe(false);
    expect(result.conflicts[0]).toMatchObject({ fieldPath: 'planId', blockId: null });
  });
});
