import { describe, expect, it, vi } from 'vitest';
import { migrateRetaFinalV2, validateRetaFinalV2 } from '../../src/js/logic/reta-final-schema.js';

function legacyPlan(bloco = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    updatedAt: '2026-10-17T12:00:00.000Z',
    retaFinal: {
      dataFinal: '2026-11-01',
      blocos: [{
        id: 'rf_1', discId: 'disc_1',
        topicos: [{ assId: 'ass_1', aulaId: null }, { assId: null, aulaId: 'aula_1' }],
        minutos: 60, status: 'pendente', rolagens: 1,
        dataOriginal: '2026-10-18', data: '2026-10-19', ...bloco,
      }],
    },
  };
}

const options = () => ({ makePlanId: vi.fn(() => 'plan_1'), today: '2026-10-19' });

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

describe('migrateRetaFinalV2', () => {
  it('recupera intenção anterior à rolagem sem mutar IDs, vínculos ou autoria; é idempotente', () => {
    const input = freezeDeep(legacyPlan());
    const opts = options();
    const result = migrateRetaFinalV2(input, opts);
    expect(result.changed).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      planId: 'plan_1', schemaVersionRetaFinal: 2, revision: 0, updatedAt: input.updatedAt,
      retaFinal: { blocos: [{ ...input.retaFinal.blocos[0], dataPlanejada: '2026-10-18', ordem: 0 }] },
    });
    expect(input.retaFinal.blocos[0]).not.toHaveProperty('dataPlanejada');
    expect(opts.makePlanId).toHaveBeenCalledTimes(1);
    const second = migrateRetaFinalV2(freezeDeep(result.plan), { ...opts, today: '2026-10-20' });
    expect(second).toEqual({ plan: result.plan, changed: false, diagnostics: [] });
    expect(opts.makePlanId).toHaveBeenCalledTimes(1);
    expect(validateRetaFinalV2(result.plan)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [{ dataOriginal: undefined }, '2026-10-19'],
    [{ rolagens: 0 }, '2026-10-19'],
    [{ dataOriginal: '2026-02-30' }, '2026-10-19'],
    [{ dataOriginal: '2026-10-19' }, '2026-10-19'],
    [{ dataPlanejada: '2026-10-16' }, '2026-10-16'],
  ])('define dataPlanejada somente quando ausente: %j', (bloco, expected) => {
    const result = migrateRetaFinalV2(legacyPlan(bloco), options());
    expect(result.plan.retaFinal.blocos[0].dataPlanejada).toBe(expected);
    expect(result.plan.retaFinal.blocos[0].dataOriginal).toBe(bloco.dataOriginal ?? (Object.hasOwn(bloco, 'dataOriginal') ? undefined : '2026-10-18'));
  });

  it('preserva conclusão, revisão existente, ordem explícita e dados adicionais', () => {
    const input = legacyPlan({ status: 'concluido', ordem: 7, eventoId: 'ev_1', dataConclusao: '2026-10-19' });
    input.revision = 9;
    input.planId = 'existing_plan';
    const result = migrateRetaFinalV2(input, options());
    expect(result.plan).toMatchObject({ planId: 'existing_plan', revision: 9, updatedAt: input.updatedAt });
    expect(result.plan.retaFinal.blocos[0]).toMatchObject({ ...input.retaFinal.blocos[0], dataPlanejada: '2026-10-18' });
  });

  it.each([null, { tipo: 'ciclo' }, { tipo: null }])('ignora planos fora da Reta Final: %j', (input) => {
    const opts = options();
    expect(migrateRetaFinalV2(input, opts)).toEqual({ plan: input, changed: false, diagnostics: [] });
    expect(opts.makePlanId).not.toHaveBeenCalled();
  });

  it.each([
    { data: 'desconhecida', dataOriginal: undefined },
    { id: null },
    { minutos: 0 },
    { topicos: [{ assId: 12 }] },
  ])('mantém legado irrecuperável intacto e sinaliza reparo humano: %j', (bloco) => {
    const input = freezeDeep(legacyPlan(bloco));
    const opts = options();
    const result = migrateRetaFinalV2(input, opts);
    expect(result.plan).toEqual(input);
    expect(result.changed).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(opts.makePlanId).not.toHaveBeenCalled();
  });

  it('não remapeia IDs duplicados referenciados por eventos', () => {
    const input = legacyPlan();
    input.retaFinal.blocos.push({ ...input.retaFinal.blocos[0] });
    const result = migrateRetaFinalV2(freezeDeep(input), options());
    expect(result.changed).toBe(false);
    expect(result.plan).toEqual(input);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('não rebaixa uma versão futura', () => {
    const input = { ...legacyPlan(), schemaVersionRetaFinal: 3 };
    expect(migrateRetaFinalV2(input, options())).toMatchObject({ plan: input, changed: false });
    expect(migrateRetaFinalV2(input, options()).diagnostics.length).toBeGreaterThan(0);
  });
});

describe('validateRetaFinalV2', () => {
  it.each([
    [null],
    [{ tipo: 'ciclo' }],
    [{ ...legacyPlan(), planId: '', schemaVersionRetaFinal: 2, revision: 0 }],
    [{ ...legacyPlan(), planId: 'p', schemaVersionRetaFinal: 2, revision: -1 }],
    [{ ...legacyPlan(), planId: 'p', schemaVersionRetaFinal: 2, revision: 1.5 }],
  ])('recusa schema/identidade/revisão inválidos sem lançar exceção', (input) => {
    const result = validateRetaFinalV2(freezeDeep(input));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-1-01', '2026-10-19T00:00:00Z', '0000-01-01'])('recusa data civil inválida: %s', (dataPlanejada) => {
    const plan = migrateRetaFinalV2(legacyPlan(), options()).plan;
    plan.retaFinal.blocos[0].dataPlanejada = dataPlanejada;
    expect(validateRetaFinalV2(plan).valid).toBe(false);
  });

  it('aceita dia bissexto e não impõe prazo à projeção data legada', () => {
    const plan = migrateRetaFinalV2(legacyPlan({ dataPlanejada: '2028-02-29', data: '2030-01-01' }), options()).plan;
    expect(validateRetaFinalV2(plan)).toEqual({ valid: true, errors: [] });
  });
});
