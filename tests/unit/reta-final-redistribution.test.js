import { describe, expect, it } from 'vitest';
import { applyRetaFinalCommand } from '../../src/js/logic/reta-final-commands.js';
import { proposeRetaFinalRedistribution } from '../../src/js/logic/reta-final-redistribution.js';

const TODAY = '2026-10-19';

function block(id, overrides = {}) {
  return {
    id,
    discId: 'disc_1',
    topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60,
    status: 'pendente',
    ordem: 0,
    dataOriginal: TODAY,
    dataPlanejada: TODAY,
    data: TODAY,
    ...overrides,
  };
}

function plan(blocks, overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    planId: 'plan_1',
    schemaVersionRetaFinal: 2,
    revision: 12,
    updatedAt: '2026-10-19T10:00:00.000Z',
    retaFinal: {
      nome: 'Reta Final',
      dataFinal: '2026-10-24',
      minutosPadrao: 60,
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        excecoesPorData: {},
        folgas: [],
        maximoDiario: 180,
      },
      blocos: blocks,
      ...overrides,
    },
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function applyProposal(inputPlan, proposal, events = []) {
  let current = inputPlan;
  const diffs = [];
  for (const operation of proposal.operations) {
    const applied = applyRetaFinalCommand(current, operation, {
      today: TODAY,
      events,
      catalog: [],
      activeTimerIds: new Set(),
    });
    expect(applied.valid, JSON.stringify(applied.diagnostics)).toBe(true);
    current = applied.plan;
    diffs.push(...applied.diff);
  }
  return { plan: current, diff: diffs };
}

describe('proposeRetaFinalRedistribution', () => {
  it('deixa vazio o dia com capacidade zero e informa o bloco inviável', () => {
    const input = plan([block('rf_1')]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 0 },
    });

    expect(result.valid).toBe(true);
    expect(result.dailyLoad[TODAY]).toMatchObject({
      capacityMinutes: 0,
      usedMinutes: 0,
      remainingMinutes: 0,
      blockIds: [],
    });
    expect(result.operations).toEqual([]);
    expect(result.unallocated).toEqual([
      expect.objectContaining({ blockId: 'rf_1', minutes: 60 }),
    ]);
  });

  it('contabiliza bloco fixado e não o move nem excede a capacidade diária', () => {
    const input = plan([
      block('rf_pinned', { fixado: true, minutos: 60, ordem: 0 }),
      block('rf_candidate', { minutos: 60, ordem: 1 }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(
      result.operations.map((operation) => operation.blockIds),
    ).not.toContainEqual(['rf_pinned']);
    expect(result.operations).toEqual([]);
    expect(result.dailyLoad[TODAY]).toMatchObject({
      capacityMinutes: 60,
      usedMinutes: 60,
      remainingMinutes: 0,
      blockIds: ['rf_pinned'],
    });
    expect(result.unallocated).toEqual([
      expect.objectContaining({ blockId: 'rf_candidate' }),
    ]);
  });

  it('reserva bloco com timer ativo sem emitir MOVE ou mutar o plano', () => {
    const input = deepFreeze(
      plan([
        block('rf_timer', {
          ordem: 0,
          minutos: 30,
          dataPlanejada: '2026-10-18',
          data: '2026-10-18',
        }),
        block('rf_movable', {
          ordem: 1,
          minutos: 30,
          dataPlanejada: '2026-10-18',
          data: '2026-10-18',
        }),
      ]),
    );
    const before = JSON.stringify(input);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
      activeTimerIds: new Set(['rf_timer']),
    });
    const repeated = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
      activeTimerIds: new Set(['rf_timer']),
    });

    expect(result.valid).toBe(true);
    expect(result.operations.map((operation) => operation.blockIds)).toEqual([
      ['rf_movable'],
    ]);
    expect(result.dailyLoad[TODAY]).toMatchObject({
      usedMinutes: 30,
      blockIds: ['rf_movable'],
    });
    expect(result.explanations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: 'rf_timer',
          from: '2026-10-18',
          to: '2026-10-18',
          status: 'fixed',
          reason: 'active_timer',
        }),
      ]),
    );
    expect(result.unallocated).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blockId: 'rf_timer' }),
      ]),
    );
    expect(repeated.dailyLoad).toEqual(result.dailyLoad);
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(result));
    expect(JSON.stringify(input)).toBe(before);
    expect(input.revision).toBe(12);
  });

  it.each([
    ['Set', new Set(['rf_timer'])],
    ['array', ['rf_timer']],
    ['object', { rf_timer: true }],
    ['string', 'rf_timer'],
  ])(
    'normaliza activeTimerIds como %s e contabiliza minutos no dia',
    (_, activeTimerIds) => {
      const input = deepFreeze(plan([block('rf_timer', { minutos: 30 })]));
      const before = JSON.stringify(input);
      const result = proposeRetaFinalRedistribution(input, {
        today: TODAY,
        capacityByWeekday: { 1: 60 },
        activeTimerIds,
      });

      expect(result.valid).toBe(true);
      expect(result.operations).toEqual([]);
      expect(result.dailyLoad[TODAY]).toMatchObject({
        usedMinutes: 30,
        remainingMinutes: 30,
        blockIds: ['rf_timer'],
      });
      expect(result.explanations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            blockId: 'rf_timer',
            to: TODAY,
            reason: 'active_timer',
          }),
        ]),
      );
      expect(JSON.stringify(input)).toBe(before);
    },
  );

  it('reporta timer ativo após dataFinal sem MOVE nem carga diária', () => {
    const input = deepFreeze(
      plan([
        block('rf_timer', {
          minutos: 30,
          dataPlanejada: '2026-10-25',
          data: '2026-10-25',
        }),
      ]),
    );
    const before = JSON.stringify(input);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
      activeTimerIds: new Set(['rf_timer']),
    });

    expect(result.valid).toBe(true);
    expect(result.operations).toEqual([]);
    expect(result.dailyLoad['2026-10-25']).toBeUndefined();
    expect(result.unallocated).toEqual([
      {
        blockId: 'rf_timer',
        plannedDate: '2026-10-25',
        minutes: 30,
        reason: 'active_timer_deadline',
      },
    ]);
    expect(result.explanations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: 'rf_timer',
          from: '2026-10-25',
          to: null,
          status: 'unallocated',
          reason: 'active_timer_deadline',
        }),
      ]),
    );
    expect(JSON.stringify(input)).toBe(before);
  });

  it('reserva primeiro blocos fixados mesmo quando têm score inferior', () => {
    const input = plan([
      block('rf_high', { ordem: 0, dataPlanejada: TODAY, fixado: false }),
      block('rf_pinned', { ordem: 1, dataPlanejada: TODAY, fixado: true }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60 },
      evidence: { rf_high: { manual: 5 } },
    });

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      blockIds: ['rf_high'],
      targetDate: '2026-10-20',
    });
    expect(result.dailyLoad[TODAY]).toMatchObject({
      usedMinutes: 60,
      blockIds: ['rf_pinned'],
    });
  });

  it('prioriza score sobre a data original ao preencher capacidade futura', () => {
    const input = plan([
      block('rf_low', { ordem: 0, dataPlanejada: TODAY }),
      block('rf_high', { ordem: 1, dataPlanejada: '2026-10-24' }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 },
      evidence: { rf_high: { manual: 5 } },
    });

    expect(result.operations).toEqual([
      expect.objectContaining({ blockIds: ['rf_high'], targetDate: TODAY }),
      expect.objectContaining({
        blockIds: ['rf_low'],
        targetDate: '2026-10-20',
      }),
    ]);
  });
  it('respeita pinnedBlockIds fornecidos pelo chamador', () => {
    const input = plan([
      block('rf_option_pinned', { ordem: 0 }),
      block('rf_movable', { ordem: 1 }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
      pinnedBlockIds: new Set(['rf_option_pinned']),
    });

    expect(result.operations).toEqual([]);
    expect(result.dailyLoad[TODAY].blockIds).toEqual(['rf_option_pinned']);
    expect(result.unallocated).toEqual([
      expect.objectContaining({ blockId: 'rf_movable' }),
    ]);
  });
  it('trata dataFinal como inclusiva e nunca aloca além dela', () => {
    const input = plan(
      [
        block('rf_1', {
          minutos: 60,
          dataPlanejada: '2026-10-18',
          data: '2026-10-18',
        }),
        block('rf_2', {
          minutos: 60,
          ordem: 1,
          dataPlanejada: '2026-10-18',
          data: '2026-10-18',
        }),
      ],
      { dataFinal: '2026-10-20' },
    );
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60, 3: 60, 4: 60 },
    });

    expect(result.operations.map((operation) => operation.targetDate)).toEqual([
      TODAY,
      '2026-10-20',
    ]);
    expect(
      result.operations.every(
        (operation) => operation.targetDate <= input.retaFinal.dataFinal,
      ),
    ).toBe(true);
    expect(result.unallocated).toEqual([]);
    expect(result.dailyLoad['2026-10-20'].usedMinutes).toBe(60);
  });

  it('antecipa bloco planejado depois de dataFinal para dentro do intervalo fechado', () => {
    const input = plan(
      [block('rf_late', { dataPlanejada: '2026-10-25', data: '2026-10-25' })],
      { dataFinal: '2026-10-20' },
    );
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60 },
    });

    expect(result.valid).toBe(true);
    expect(result.operations).toEqual([
      expect.objectContaining({ blockIds: ['rf_late'], targetDate: TODAY }),
    ]);
    expect(result.unallocated).toEqual([]);
    expect(result.dailyLoad[TODAY].blockIds).toEqual(['rf_late']);
  });
  it('mantém contagem e duração e reporta overflow sem dividir nem encurtar blocos', () => {
    const input = plan([
      block('rf_short', { minutos: 30, ordem: 0 }),
      block('rf_long', { minutos: 45, ordem: 1 }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(result.valid).toBe(true);
    expect(input.retaFinal.blocos).toHaveLength(2);
    expect(input.retaFinal.blocos.map((item) => item.minutos)).toEqual([
      30, 45,
    ]);
    expect(result.operations).toEqual([]);
    expect(result.unallocated).toEqual([
      expect.objectContaining({ blockId: 'rf_long', minutes: 45 }),
    ]);
    expect(result.dailyLoad[TODAY]).toMatchObject({
      usedMinutes: 30,
      remainingMinutes: 30,
    });
  });

  it('ordena por score, data planejada, ordem e id com desempate reproduzível', () => {
    const input = plan([
      block('rf_z', { ordem: 0, dataPlanejada: '2026-10-20' }),
      block('rf_b', { ordem: 1, dataPlanejada: TODAY }),
      block('rf_a', { ordem: 1, dataPlanejada: TODAY }),
      block('rf_high', { ordem: 9, dataPlanejada: TODAY }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60, 3: 60, 4: 60 },
      evidence: { rf_high: { manual: 5 } },
    });

    expect(result.operations.map((operation) => operation.blockIds[0])).toEqual(
      ['rf_a', 'rf_b', 'rf_z'],
    );
    expect(result.dailyLoad[TODAY].blockIds).toEqual(['rf_high']);
    expect(result.dailyLoad['2026-10-20'].blockIds).toEqual(['rf_a']);
    expect(result.dailyLoad['2026-10-21'].blockIds).toEqual(['rf_b']);
    expect(result.dailyLoad['2026-10-22'].blockIds).toEqual(['rf_z']);
  });

  it('retorna exatamente a mesma proposta em duas chamadas', () => {
    const input = plan([
      block('rf_2', { ordem: 1 }),
      block('rf_1', { ordem: 0 }),
    ]);
    const options = { today: TODAY, capacityByWeekday: { 1: 60, 2: 60 } };

    const first = proposeRetaFinalRedistribution(input, options);
    const second = proposeRetaFinalRedistribution(input, options);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('não muta plano ou opções, mesmo quando congelados', () => {
    const input = deepFreeze(
      plan([
        block('rf_1', { dataPlanejada: '2026-10-18', data: '2026-10-18' }),
      ]),
    );
    const options = deepFreeze({ today: TODAY, capacityByWeekday: { 1: 60 } });
    const beforePlan = JSON.stringify(input);
    const beforeOptions = JSON.stringify(options);

    const result = proposeRetaFinalRedistribution(input, options);

    expect(result.valid).toBe(true);
    expect(JSON.stringify(input)).toBe(beforePlan);
    expect(JSON.stringify(options)).toBe(beforeOptions);
    expect(input.revision).toBe(12);
    expect(input.updatedAt).toBe('2026-10-19T10:00:00.000Z');
  });

  it('emite comandos MOVE aplicáveis na Task 3 e diff idêntico sem tocar em eventos ou revisão', () => {
    const input = deepFreeze(
      plan([
        block('rf_1', { dataPlanejada: '2026-10-18', data: '2026-10-18' }),
        block('rf_2', {
          ordem: 1,
          dataPlanejada: '2026-10-18',
          data: '2026-10-18',
        }),
      ]),
    );
    const events = deepFreeze([
      {
        id: 'ev_1',
        rfBlocoId: 'rf_other',
        status: 'estudei',
        revisoes: [{ id: 'rev_1' }],
        questoes: { total: 20, acertos: 10 },
      },
    ]);
    const beforePlan = JSON.stringify(input);
    const beforeEvents = JSON.stringify(events);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60, 2: 60 },
    });

    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]).toMatchObject({
      type: 'MOVE',
      operationId: expect.any(String),
      blockIds: ['rf_1'],
      targetDate: TODAY,
      targetOrder: 0,
    });
    expect(result.operations[1]).toMatchObject({
      type: 'MOVE',
      blockIds: ['rf_2'],
      targetDate: '2026-10-20',
      targetOrder: 1,
    });
    const applied = applyProposal(input, result, events);

    expect(result.diff).toEqual(applied.diff);
    expect(applied.plan.retaFinal.blocos[0]).toMatchObject({
      dataPlanejada: TODAY,
      minutos: 60,
    });
    expect(applied.plan.retaFinal.blocos[1]).toMatchObject({
      dataPlanejada: '2026-10-20',
      minutos: 60,
    });
    expect(applied.plan.retaFinal.blocos).toHaveLength(
      input.retaFinal.blocos.length,
    );
    expect(applied.plan.retaFinal.blocos.map((item) => item.minutos)).toEqual(
      input.retaFinal.blocos.map((item) => item.minutos),
    );
    expect(applied.plan.revision).toBe(input.revision);
    expect(applied.plan.updatedAt).toBe(input.updatedAt);
    expect(JSON.stringify(input)).toBe(beforePlan);
    expect(JSON.stringify(events)).toBe(beforeEvents);
    expect(result.diff[0].fieldsChanged).toContain('dataPlanejada');
  });
  it('ignora blocos concluídos e arquivados como candidatos de alocação', () => {
    const input = plan([
      block('rf_done', {
        status: 'concluido',
        dataPlanejada: '2026-10-18',
        data: '2026-10-18',
      }),
      block('rf_archived', {
        arquivado: true,
        dataPlanejada: '2026-10-18',
        data: '2026-10-18',
      }),
      block('rf_pending', { dataPlanejada: '2026-10-18', data: '2026-10-18' }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(result.operations.map((operation) => operation.blockIds)).toEqual([
      ['rf_pending'],
    ]);
    expect(result.dailyLoad[TODAY].blockIds).toEqual(['rf_pending']);
  });

  it('aplica exceções e opções, limita pelo máximo diário e mantém folgas em zero', () => {
    const input = plan([block('rf_1')], {
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 },
        excecoesPorData: {},
        folgas: [2],
        maximoDiario: 60,
      },
    });
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 120, 3: 120 },
      exceptionsByDate: { [TODAY]: 120 },
    });

    expect(result.dailyLoad[TODAY]).toMatchObject({
      capacityMinutes: 60,
      usedMinutes: 60,
      blockIds: ['rf_1'],
    });
    expect(result.dailyLoad['2026-10-20']).toMatchObject({
      capacityMinutes: 0,
      usedMinutes: 0,
      blockIds: [],
    });
    expect(result.dailyLoad['2026-10-21']).toMatchObject({
      capacityMinutes: 60,
      usedMinutes: 0,
      blockIds: [],
    });
  });

  it('permite que capacityByWeekday substitua uma folga persistida', () => {
    const input = plan([block('rf_monday')], {
      dataFinal: '2026-10-20',
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        excecoesPorData: {},
        folgas: [1],
        maximoDiario: 60,
      },
    });
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(result.valid).toBe(true);
    expect(result.dailyLoad[TODAY]).toMatchObject({
      capacityMinutes: 60,
      usedMinutes: 60,
      blockIds: ['rf_monday'],
    });
    expect(result.operations).toEqual([]);
  });
  it('aplica exceção de data a uma folga sem passar do máximo diário', () => {
    const input = plan([block('rf_sunday')], {
      dataFinal: '2026-10-25',
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        excecoesPorData: {},
        folgas: [0],
        maximoDiario: 60,
      },
    });
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      exceptionsByDate: { '2026-10-25': 90 },
    });

    expect(result.valid).toBe(true);
    expect(result.dailyLoad['2026-10-25']).toMatchObject({
      capacityMinutes: 60,
      usedMinutes: 60,
      blockIds: ['rf_sunday'],
    });
    expect(result.operations[0].targetDate).toBe('2026-10-25');
  });
  it('retorna inválido com diagnóstico para data ou capacidade malformada sem comandos parciais', () => {
    const input = plan([block('rf_1')], {
      capacidade: {
        minutosPorDiaSemana: { 1: -5 },
        excecoesPorData: {},
        folgas: [],
      },
    });
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(result.valid).toBe(false);
    expect(result.operations).toEqual([]);
    expect(result.diff).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('não recoloca bloco fixado em data passada e explica a imobilidade', () => {
    const input = plan([
      block('rf_fixed_old', {
        fixado: true,
        dataPlanejada: '2026-10-18',
        data: '2026-10-18',
      }),
    ]);
    const result = proposeRetaFinalRedistribution(input, {
      today: TODAY,
      capacityByWeekday: { 1: 60 },
    });

    expect(result.operations).toEqual([]);
    expect(result.dailyLoad[TODAY].blockIds).toEqual([]);
    expect(result.explanations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: 'rf_fixed_old',
          reason: expect.stringMatching(/fix|pinn|imobil/i),
        }),
      ]),
    );
  });
});
