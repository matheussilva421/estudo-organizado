import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyRetaFinalCommand,
  getCompletedRetaFinalBlocoIds,
} from '../../src/js/logic/reta-final-commands.js';

const HOJE = '2026-10-19';

function topico(overrides = {}) {
  return { assId: 'ass_1', aulaId: null, ...overrides };
}

function bloco(overrides = {}) {
  return {
    id: 'rf_1',
    discId: 'disc_1',
    topicos: [topico()],
    minutos: 60,
    status: 'pendente',
    ordem: 0,
    dataOriginal: '2026-10-19',
    dataPlanejada: '2026-10-19',
    data: '2026-10-19',
    rolagens: 0,
    ...overrides,
  };
}

function plano(blocos = [bloco()], overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    planId: 'rfplan_1',
    schemaVersionRetaFinal: 2,
    revision: 7,
    updatedAt: '2026-10-19T10:00:00.000Z',
    config: { dataProva: '2026-11-15', visualizacao: 'mes' },
    retaFinal: {
      nome: 'Reta Final',
      dataFinal: '2026-10-31',
      minutosPadrao: 60,
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 120, 2: 120, 3: 120, 4: 120, 5: 120, 6: 60 },
        excecoesPorData: {},
        folgas: [0],
        maximoDiario: 180,
      },
      blocos,
      ...overrides,
    },
  };
}

function catalogo() {
  return [
    {
      id: 'ed_1',
      nome: 'Edital',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito Penal',
          assuntos: [{ id: 'ass_1', nome: 'Crimes' }, { id: 'ass_2', nome: 'Penas' }],
          aulas: [{ id: 'aula_1', nome: 'Aula 1' }],
        },
        {
          id: 'disc_2',
          nome: 'Constitucional',
          assuntos: [{ id: 'ass_3', nome: 'Direitos' }],
          aulas: [],
        },
      ],
    },
  ];
}

function eventoEstudado(overrides = {}) {
  return {
    id: 'ev_done',
    titulo: 'Estudo concluido',
    data: '2026-10-18',
    status: 'estudei',
    tempoAcumulado: 1800,
    dataEstudo: '2026-10-18',
    discId: 'disc_1',
    assId: 'ass_1',
    rfBlocoId: 'rf_done',
    questoes: { total: 10, acertos: 7 },
    revisoes: [{ id: 'rev_1' }],
    paginas: [1, 2],
    ...overrides,
  };
}

function eventoTimer(overrides = {}) {
  return {
    id: 'ev_timer',
    titulo: 'Timer ativo',
    data: '2026-10-19',
    status: 'agendado',
    tempoAcumulado: 300,
    rfBlocoId: 'rf_timer',
    _timerStart: '2026-10-19T10:00:00.000Z',
    ...overrides,
  };
}

function eventoParcial(overrides = {}) {
  return {
    id: 'ev_partial',
    data: '2026-10-19',
    status: 'agendado',
    tempoAcumulado: 300,
    rfBlocoId: 'rf_partial',
    ...overrides,
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function contexto(overrides = {}) {
  return {
    events: [],
    catalog: catalogo(),
    activeTimerIds: new Set(),
    today: HOJE,
    makeId: () => 'rf_novo',
    ...overrides,
  };
}

function apply(plan, command, overrides = {}) {
  return applyRetaFinalCommand(plan, command, contexto(overrides));
}

function op(type, fields = {}) {
  return { operationId: 'op_' + type.toLowerCase(), type, ...fields };
}

function createInput(overrides = {}) {
  return {
    discId: 'disc_1',
    topicos: [topico()],
    minutos: 45,
    dataPlanejada: '2026-10-25',
    ...overrides,
  };
}

describe('applyRetaFinalCommand - identidade, MOVE e atomicidade', () => {
  it('MOVE conserva o id e produz diff canonico sem mutar o plano', () => {
    const plan = freezeDeep(
      plano([
        bloco({
          id: 'rf_1',
          ordem: 1,
          dataPlanejada: '2026-10-19',
          dataOriginal: '2026-10-18',
          data: '2026-10-19',
        }),
      ])
    );
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('MOVE', { blockIds: ['rf_1'], targetDate: '2026-10-22', targetOrder: 4 })
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.plan).not.toBe(plan);
    expect(result.plan.retaFinal.blocos[0]).toMatchObject({
      id: 'rf_1',
      dataPlanejada: '2026-10-22',
      data: '2026-10-22',
      ordem: 4,
      reagendado: true,
    });
    expect(result.plan.revision).toBe(7);
    expect(result.plan.updatedAt).toBe('2026-10-19T10:00:00.000Z');
    expect(plan).toEqual(before);
    expect(result.diff).toHaveLength(1);
    expect(result.diff[0]).toMatchObject({
      blockId: 'rf_1',
      before: expect.objectContaining({ id: 'rf_1', dataPlanejada: '2026-10-19' }),
      after: expect.objectContaining({ id: 'rf_1', dataPlanejada: '2026-10-22' }),
    });
    expect(result.diff[0].fieldsChanged).toEqual([
      'data',
      'dataPlanejada',
      'ordem',
      'reagendado',
    ]);
  });

  it('MOVE coletivo falha inteiro quando um alvo tem timer ativo', () => {
    const plan = freezeDeep(
      plano([
        bloco({ id: 'rf_1', ordem: 0 }),
        bloco({ id: 'rf_timer', ordem: 1 }),
      ])
    );
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('MOVE', { blockIds: ['rf_1', 'rf_timer'], targetDate: '2026-10-22' }),
      { activeTimerIds: new Set(['rf_timer']) }
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TIMER_ATIVO',
          blockId: 'rf_timer',
          operationId: 'op_move',
          type: 'MOVE',
        }),
      ])
    );
  });

  it('detecta timer ativo pelo evento com _timerStart', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const events = freezeDeep([eventoTimer({ rfBlocoId: 'rf_1' })]);
    const planBefore = snapshot(plan);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('MOVE', { blockIds: ['rf_1'], targetDate: '2026-10-22' }),
      { events }
    );

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TIMER_ATIVO', blockId: 'rf_1' }),
      ])
    );
    expect(plan).toEqual(planBefore);
    expect(events).toEqual(eventsBefore);
  });

  it('operacao coletiva com bloco inexistente nao aplica os demais', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('MOVE', { blockIds: ['rf_1', 'rf_missing'], targetDate: '2026-10-22' })
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BLOCO_NAO_ENCONTRADO', blockId: 'rf_missing' }),
      ])
    );
  });
});

describe('applyRetaFinalCommand - DUPLICATE', () => {
  it('cria id novo sem clonar sessao, timer, questoes, revisoes ou historico', () => {
    const source = bloco({
      id: 'rf_done',
      status: 'concluido',
      dataPlanejada: '2026-10-18',
      dataOriginal: '2026-10-18',
      data: '2026-10-18',
      _timerStart: '2026-10-19T10:00:00.000Z',
      tempoAcumulado: 900,
      questoes: { total: 10, acertos: 8 },
      revisoes: [{ id: 'rev_1' }],
      historico: [{ id: 'hist_1' }],
      rfBlocoId: 'rf_done',
      dataEstudo: '2026-10-18',
      paginas: [1, 2],
      prioridade: 5,
      observacao: 'Nota do bloco',
      fixado: true,
    });
    const plan = freezeDeep(plano([source]));
    const events = freezeDeep([eventoEstudado({ rfBlocoId: 'rf_done' })]);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('DUPLICATE', { blockIds: ['rf_done'] }),
      { events, makeId: () => 'rf_novo' }
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.plan.retaFinal.blocos).toHaveLength(2);
    const novo = result.plan.retaFinal.blocos.find((item) => item.id === 'rf_novo');
    expect(novo).toMatchObject({
      id: 'rf_novo',
      discId: 'disc_1',
      topicos: [{ assId: 'ass_1', aulaId: null }],
      minutos: 60,
      status: 'pendente',
      dataPlanejada: '2026-10-18',
      dataOriginal: '2026-10-18',
      data: '2026-10-18',
      rolagens: 0,
      prioridade: 5,
      observacao: 'Nota do bloco',
      fixado: true,
    });
    for (const field of [
      '_timerStart',
      'tempoAcumulado',
      'questoes',
      'revisoes',
      'historico',
      'rfBlocoId',
      'dataEstudo',
      'paginas',
    ]) {
      expect(novo).not.toHaveProperty(field);
    }
    expect(result.diff).toEqual([
      expect.objectContaining({ blockId: 'rf_novo', before: null }),
    ]);
    expect(result.diff[0].after).toMatchObject({ id: 'rf_novo', status: 'pendente' });
    expect(result.diff[0].fieldsChanged).toEqual(
      expect.arrayContaining([
        'id',
        'status',
        'dataPlanejada',
        'dataOriginal',
        'data',
        'rolagens',
        'ordem',
      ])
    );
    expect(events).toEqual(eventsBefore);
  });

  it('duplicacao coletiva usa ids novos em sequencia', () => {
    const plan = freezeDeep(
      plano([
        bloco({ id: 'rf_1', ordem: 0 }),
        bloco({ id: 'rf_2', ordem: 1, dataPlanejada: '2026-10-20', dataOriginal: '2026-10-20', data: '2026-10-20' }),
      ])
    );
    const ids = ['rf_novo_1', 'rf_novo_2'];
    let index = 0;

    const result = apply(
      plan,
      op('DUPLICATE', { blockIds: ['rf_1', 'rf_2'] }),
      { makeId: () => ids[index++] }
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos.map((item) => item.id)).toEqual([
      'rf_1',
      'rf_2',
      'rf_novo_1',
      'rf_novo_2',
    ]);
    expect(result.diff.map((entry) => entry.blockId)).toEqual(['rf_novo_1', 'rf_novo_2']);
  });

  it('falha inteira quando o gerador devolve id ja existente', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('DUPLICATE', { blockIds: ['rf_1'] }),
      { makeId: () => 'rf_1' }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ID_INDISPONIVEL', blockId: 'rf_1' }),
      ])
    );
  });
});

describe('applyRetaFinalCommand - limites de ordem gerada', () => {
  it('MOVE coletivo recusa a faixa que ultrapassa a ordem segura sem mutar ou aplicar prefixo', () => {
    const plan = freezeDeep(
      plano([
        bloco({ id: 'rf_1', ordem: 0 }),
        bloco({ id: 'rf_2', ordem: 1 }),
      ])
    );
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('MOVE', {
        blockIds: ['rf_1', 'rf_2'],
        targetDate: '2026-10-22',
        targetOrder: Number.MAX_SAFE_INTEGER,
      })
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(result.diff).toEqual([]);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORDEM_INVALIDA' })])
    );
  });

  it('CREATE recusa ordem gerada após o maior valor seguro sem consumir identidade', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1', ordem: Number.MAX_SAFE_INTEGER })]));
    const before = snapshot(plan);
    let generated = 0;

    const result = apply(plan, op('CREATE', { input: createInput() }), {
      makeId: () => {
        generated++;
        return 'rf_new';
      },
    });

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(result.diff).toEqual([]);
    expect(plan).toEqual(before);
    expect(generated).toBe(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORDEM_INVALIDA' })])
    );
  });

  it('DUPLICATE recusa ordem gerada após o maior valor seguro sem consumir identidade', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1', ordem: Number.MAX_SAFE_INTEGER })]));
    const before = snapshot(plan);
    let generated = 0;

    const result = apply(plan, op('DUPLICATE', { blockIds: ['rf_1'] }), {
      makeId: () => {
        generated++;
        return 'rf_novo';
      },
    });

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(result.diff).toEqual([]);
    expect(plan).toEqual(before);
    expect(generated).toBe(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORDEM_INVALIDA' })])
    );
  });

  it('DUPLICATE coletivo valida toda a faixa de ordens, não apenas a primeira', () => {
    const plan = freezeDeep(
      plano([
        bloco({ id: 'rf_1', ordem: 0 }),
        bloco({ id: 'rf_2', ordem: Number.MAX_SAFE_INTEGER - 1 }),
      ])
    );
    const before = snapshot(plan);
    const ids = ['rf_novo_1', 'rf_novo_2'];
    let index = 0;

    const result = apply(
      plan,
      op('DUPLICATE', { blockIds: ['rf_1', 'rf_2'] }),
      { makeId: () => ids[index++] }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(result.diff).toEqual([]);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORDEM_INVALIDA' })])
    );
  });
});

describe('applyRetaFinalCommand - ARCHIVE e historico', () => {
  it('arquiva bloco estudado preservando evento, tempo, questoes e revisoes', () => {
    const plan = freezeDeep(
      plano([
        bloco({
          id: 'rf_done',
          status: 'concluido',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
      ])
    );
    const events = freezeDeep([eventoEstudado({ rfBlocoId: 'rf_done' })]);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('ARCHIVE', { blockIds: ['rf_done'] }),
      { events }
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos[0]).toMatchObject({
      id: 'rf_done',
      arquivado: true,
      status: 'concluido',
      dataPlanejada: '2026-10-18',
    });
    expect(result.diff[0].fieldsChanged).toEqual(['arquivado']);
    expect(events).toEqual(eventsBefore);
    expect(events[0]).toMatchObject({
      status: 'estudei',
      dataEstudo: '2026-10-18',
      tempoAcumulado: 1800,
      rfBlocoId: 'rf_done',
      questoes: { total: 10, acertos: 7 },
      revisoes: [{ id: 'rev_1' }],
    });
  });

  it('recusa arquivar bloco com timer ativo', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_timer' })]));
    const events = freezeDeep([eventoTimer({ rfBlocoId: 'rf_timer' })]);
    const before = snapshot(plan);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('ARCHIVE', { blockIds: ['rf_timer'] }),
      { events }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(events).toEqual(eventsBefore);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TIMER_ATIVO', blockId: 'rf_timer' }),
      ])
    );
  });

  it('arquivamento coletivo nao aplica subconjunto quando um alvo e protegido', () => {
    const plan = freezeDeep(
      plano([
        bloco({
          id: 'rf_done',
          status: 'concluido',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
        bloco({ id: 'rf_timer', ordem: 1 }),
      ])
    );
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('ARCHIVE', { blockIds: ['rf_done', 'rf_timer'] }),
      { activeTimerIds: new Set(['rf_timer']) }
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.plan.retaFinal.blocos.every((item) => item.arquivado !== true)).toBe(true);
  });
});

describe('applyRetaFinalCommand - PATCH', () => {
  it('altera campos editaveis e preserva status e eventos', () => {
    const plan = freezeDeep(
      plano([
        bloco({
          id: 'rf_done',
          status: 'concluido',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
          prioridade: 2,
        }),
      ])
    );
    const events = freezeDeep([eventoEstudado({ rfBlocoId: 'rf_done' })]);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('PATCH', {
        blockIds: ['rf_done'],
        patch: {
          minutos: 90,
          prioridade: 4,
          observacao: 'Revisar',
          dataPlanejada: '2026-10-22',
        },
      }),
      { events }
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos[0]).toMatchObject({
      id: 'rf_done',
      status: 'concluido',
      minutos: 90,
      prioridade: 4,
      observacao: 'Revisar',
      dataPlanejada: '2026-10-22',
      data: '2026-10-22',
      reagendado: true,
    });
    expect(result.diff[0].fieldsChanged).toEqual([
      'data',
      'dataPlanejada',
      'minutos',
      'observacao',
      'prioridade',
      'reagendado',
    ]);
    expect(events).toEqual(eventsBefore);
  });

  it.each([
    [{ status: 'concluido' }],
    [{ tempoAcumulado: 0 }],
    [{ dataEstudo: '2026-10-19' }],
    [{ questoes: [] }],
    [{ revisoes: [] }],
    [{ rfBlocoId: 'rf_1' }],
    [{ arquivado: true }],
  ])('rejeita campo protegido no PATCH: %j', (patch) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(plan, op('PATCH', { blockIds: ['rf_1'], patch }));

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAMPO_PROTEGIDO' })])
    );
  });

  it.each([
    ['dataPlanejada', '2026-02-30', 'DATA_INVALIDA'],
    ['minutos', 0, 'MINUTOS_INVALIDOS'],
    ['minutos', 1.5, 'MINUTOS_INVALIDOS'],
    ['prioridade', 6, 'PRIORIDADE_INVALIDA'],
    ['ordem', -1, 'ORDEM_INVALIDA'],
    ['ordem', Number.MAX_SAFE_INTEGER + 1, 'ORDEM_INVALIDA'],
    ['discId', 'disc_missing', 'REFERENCIA_INVALIDA'],
    ['topicos', [{ assId: 'ass_missing' }], 'REFERENCIA_INVALIDA'],
    ['campoDesconhecido', 1, 'CAMPO_NAO_EDITAVEL'],
  ])('rejeita %s invalido no PATCH', (field, value, code) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('PATCH', { blockIds: ['rf_1'], patch: { [field]: value } })
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    );
  });

  it('PATCH estrutural e recusado com timer ativo', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_timer' })]));
    const events = freezeDeep([eventoTimer({ rfBlocoId: 'rf_timer' })]);
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('PATCH', { blockIds: ['rf_timer'], patch: { minutos: 90 } }),
      { events }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TIMER_ATIVO', blockId: 'rf_timer' }),
      ])
    );
  });

  it('PATCH apenas de prioridade e observacao nao e estrutural', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_timer' })]));
    const events = freezeDeep([eventoTimer({ rfBlocoId: 'rf_timer' })]);
    const eventsBefore = snapshot(events);

    const result = apply(
      plan,
      op('PATCH', {
        blockIds: ['rf_timer'],
        patch: { prioridade: 3, observacao: 'Anotacao' },
      }),
      { events }
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos[0]).toMatchObject({
      prioridade: 3,
      observacao: 'Anotacao',
    });
    expect(events).toEqual(eventsBefore);
  });
});

describe('applyRetaFinalCommand - duracao e prioridade', () => {
  it('SET_DURATION coletivo altera todos os minutos', () => {
    const plan = freezeDeep(
      plano([bloco({ id: 'rf_1', ordem: 0 }), bloco({ id: 'rf_2', ordem: 1 })])
    );

    const result = apply(
      plan,
      op('SET_DURATION', { blockIds: ['rf_1', 'rf_2'], input: { minutos: 90 } })
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos.map((item) => item.minutos)).toEqual([90, 90]);
    expect(result.diff.map((entry) => entry.blockId)).toEqual(['rf_1', 'rf_2']);
    expect(result.diff.every((entry) => entry.fieldsChanged.includes('minutos'))).toBe(true);
  });

  it('SET_DURATION coletivo falha inteiro com timer ativo', () => {
    const plan = freezeDeep(
      plano([bloco({ id: 'rf_1', ordem: 0 }), bloco({ id: 'rf_timer', ordem: 1 })])
    );
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('SET_DURATION', { blockIds: ['rf_1', 'rf_timer'], input: { minutos: 90 } }),
      { activeTimerIds: new Set(['rf_timer']) }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diff).toEqual([]);
  });

  it('SET_DURATION rejeita minutos invalidos', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const result = apply(
      plan,
      op('SET_DURATION', { blockIds: ['rf_1'], input: { minutos: 0 } })
    );

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MINUTOS_INVALIDOS' })])
    );
  });

  it('SET_PRIORITY aceita 1-5 quando presente e usa null para representar ausência', () => {
    // Prioridade é opcional. null limpa o campo; null e ausente são neutros no Task 9.
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const applied = apply(
      plan,
      op('SET_PRIORITY', { blockIds: ['rf_1'], input: { prioridade: 5 } })
    );

    expect(applied.valid).toBe(true);
    expect(applied.plan.retaFinal.blocos[0].prioridade).toBe(5);

    const cleared = apply(
      applied.plan,
      op('SET_PRIORITY', { blockIds: ['rf_1'], input: { prioridade: null } })
    );
    expect(cleared.valid).toBe(true);
    expect(cleared.plan.retaFinal.blocos[0].prioridade).toBeNull();
  });

  it('SET_PRIORITY rejeita prioridade fora da escala', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const result = apply(
      plan,
      op('SET_PRIORITY', { blockIds: ['rf_1'], input: { prioridade: 0 } })
    );

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PRIORIDADE_INVALIDA' })])
    );
  });
});

describe('applyRetaFinalCommand - CREATE', () => {
  it('cria bloco pendente com id novo, referencias validas e ordem final', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1', ordem: 0 })]));

    const result = apply(
      plan,
      op('CREATE', { input: createInput({ prioridade: 2, observacao: 'Novo' }) }),
      { makeId: () => 'rf_new' }
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.blocos).toHaveLength(2);
    const novo = result.plan.retaFinal.blocos.find((item) => item.id === 'rf_new');
    expect(novo).toMatchObject({
      id: 'rf_new',
      discId: 'disc_1',
      topicos: [{ assId: 'ass_1', aulaId: null }],
      minutos: 45,
      status: 'pendente',
      dataPlanejada: '2026-10-25',
      dataOriginal: '2026-10-25',
      data: '2026-10-25',
      rolagens: 0,
      ordem: 1,
      prioridade: 2,
      observacao: 'Novo',
    });
    expect(result.diff).toEqual([
      expect.objectContaining({ blockId: 'rf_new', before: null }),
    ]);
    expect(result.diff[0].fieldsChanged).toEqual(
      expect.arrayContaining(['id', 'status', 'dataPlanejada', 'dataOriginal', 'data'])
    );
  });

  it.each([
    [{ discId: 'disc_missing' }, 'REFERENCIA_INVALIDA'],
    [{ topicos: [{ assId: 'ass_missing' }] }, 'REFERENCIA_INVALIDA'],
    [{ dataPlanejada: '2026-02-30' }, 'DATA_INVALIDA'],
    [{ minutos: 0 }, 'MINUTOS_INVALIDOS'],
    [{ status: 'concluido' }, 'CAMPO_PROTEGIDO'],
    [{ tempoAcumulado: 300 }, 'CAMPO_PROTEGIDO'],
  ])('rejeita CREATE invalido: %j', (patch, code) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('CREATE', { input: createInput(patch) }),
      { makeId: () => 'rf_new' }
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    );
  });

  it('falha quando o id gerado colide com bloco existente', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('CREATE', { input: createInput() }),
      { makeId: () => 'rf_1' }
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ID_INDISPONIVEL' })])
    );
  });
});

describe('applyRetaFinalCommand - configuracao do plano', () => {
  it('SET_CAPACITY altera somente a capacidade do plano', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const blocksBefore = snapshot(plan.retaFinal.blocos);
    const configBefore = snapshot(plan.config);
    const deadlineBefore = plan.retaFinal.dataFinal;
    const minutosPadraoBefore = plan.retaFinal.minutosPadrao;
    const capacidadeBefore = snapshot(plan.retaFinal.capacidade);
    const novaCapacidade = {
      minutosPorDiaSemana: { 1: 90, 2: 90 },
      excecoesPorData: { '2026-10-25': 0 },
      folgas: [0, 6],
      maximoDiario: 150,
    };

    const result = apply(
      plan,
      op('SET_CAPACITY', { input: { capacidade: novaCapacidade } })
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.capacidade).toEqual(novaCapacidade);
    expect(result.plan.retaFinal.blocos).toEqual(blocksBefore);
    expect(result.plan.retaFinal.dataFinal).toBe(deadlineBefore);
    expect(result.plan.retaFinal.minutosPadrao).toBe(minutosPadraoBefore);
    expect(result.plan.config).toEqual(configBefore);
    expect(result.plan.revision).toBe(7);
    expect(result.plan.updatedAt).toBe('2026-10-19T10:00:00.000Z');
    expect(result.diff).toHaveLength(1);
    expect(result.diff[0]).toMatchObject({
      blockId: null,
      before: { capacidade: capacidadeBefore },
      after: { capacidade: novaCapacidade },
    });
    expect(result.diff[0].fieldsChanged).toEqual(['retaFinal.capacidade']);
  });

  it.each([
    [{ minutosPorDiaSemana: { 1: -1 } }],
    [{ excecoesPorData: { '2026-02-30': 0 } }],
    [{ folgas: [7] }],
    [{ maximoDiario: 1.5 }],
  ])('SET_CAPACITY rejeita configuracao invalida: %j', (capacidade) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('SET_CAPACITY', { input: { capacidade } })
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAPACIDADE_INVALIDA' })])
    );
  });

  it('EXTEND_DEADLINE altera dataFinal sem tocar config.dataProva nem blocos', () => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const blocksBefore = snapshot(plan.retaFinal.blocos);
    const configBefore = snapshot(plan.config);

    const result = apply(
      plan,
      op('EXTEND_DEADLINE', {
        input: { dataFinal: '2026-11-30', dataProva: '2027-01-01' },
      })
    );

    expect(result.valid).toBe(true);
    expect(result.plan.retaFinal.dataFinal).toBe('2026-11-30');
    expect(result.plan.retaFinal.blocos).toEqual(blocksBefore);
    expect(result.plan.config).toEqual(configBefore);
    expect(result.plan.config.dataProva).toBe('2026-11-15');
    expect(result.plan.revision).toBe(7);
    expect(result.plan.updatedAt).toBe('2026-10-19T10:00:00.000Z');
    expect(result.diff).toHaveLength(1);
    expect(result.diff[0]).toMatchObject({
      blockId: null,
      before: { dataFinal: '2026-10-31' },
      after: { dataFinal: '2026-11-30' },
    });
    expect(result.diff[0].fieldsChanged).toEqual(['retaFinal.dataFinal']);
  });

  it.each([
    ['2026-02-30', 'PRAZO_INVALIDO'],
    ['2026-10-01', 'PRAZO_NAO_ESTENDE'],
  ])('EXTEND_DEADLINE rejeita %s', (dataFinal, code) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('EXTEND_DEADLINE', { input: { dataFinal } })
    );

    expect(result.valid).toBe(false);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    );
  });

  it('EXTEND_DEADLINE rejeita prazo no passado mesmo maior que o atual', () => {
    const plan = freezeDeep(
      plano([bloco({ id: 'rf_1' })], { dataFinal: '2026-10-01' })
    );

    const result = apply(
      plan,
      op('EXTEND_DEADLINE', { input: { dataFinal: '2026-10-10' } })
    );

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DATA_PASSADA' })])
    );
  });
});

describe('applyRetaFinalCommand - validacao de contrato', () => {
  it.each([
    [null, 'COMANDO_INVALIDO'],
    [{ type: 'MOVE', blockIds: ['rf_1'], targetDate: '2026-10-22' }, 'OPERATION_ID_INVALIDO'],
    [{ operationId: 'op', type: 'DELETE', blockIds: ['rf_1'] }, 'TIPO_INVALIDO'],
    [
      { operationId: 'op', type: 'MOVE', blockIds: [], targetDate: '2026-10-22' },
      'ALVOS_INVALIDOS',
    ],
  ])('rejeita comando invalido %j', (command, code) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const result = apply(plan, command);

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    );
  });

  it.each([
    [null],
    [{ tipo: 'ciclo' }],
    [{ ...plano([bloco({ id: 'rf_1' })]), schemaVersionRetaFinal: 1 }],
  ])('rejeita plano invalido: %j', (plan) => {
    const result = apply(plan, op('MOVE', { blockIds: ['rf_1'], targetDate: '2026-10-22' }));

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PLANO_INVALIDO' })])
    );
  });

  it.each([
    [{ targetDate: '2026-13-01' }, 'DATA_INVALIDA'],
    [{ targetDate: '2026-10-22', targetOrder: -1 }, 'ORDEM_INVALIDA'],
    [{ targetDate: '2026-10-22', targetOrder: 1.5 }, 'ORDEM_INVALIDA'],
  ])('valida data e ordem de MOVE: %j', (fields, code) => {
    const plan = freezeDeep(plano([bloco({ id: 'rf_1' })]));
    const before = snapshot(plan);

    const result = apply(
      plan,
      op('MOVE', { blockIds: ['rf_1'], ...fields })
    );

    expect(result.valid).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(plan).toEqual(before);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    );
  });
});

describe('applyRetaFinalCommand - conclusao e pureza', () => {
  it('deriva conclusao somente de evento estudei, nunca de timer parcial', () => {
    const events = [
      eventoEstudado({ id: 'ev_done', rfBlocoId: 'rf_done' }),
      eventoTimer({ id: 'ev_timer', rfBlocoId: 'rf_timer' }),
      eventoParcial({ id: 'ev_partial', rfBlocoId: 'rf_partial' }),
    ];

    expect([...getCompletedRetaFinalBlocoIds(events)]).toEqual(['rf_done']);
  });

  it('nenhum comando valido altera eventos historicos', () => {
    const events = freezeDeep([
      eventoEstudado({ id: 'ev_done', rfBlocoId: 'rf_done' }),
      eventoTimer({ id: 'ev_timer', rfBlocoId: 'rf_timer' }),
      eventoParcial({ id: 'ev_partial', rfBlocoId: 'rf_partial' }),
    ]);
    const eventsBefore = snapshot(events);
    const plan = freezeDeep(
      plano([
        bloco({ id: 'rf_1', ordem: 0 }),
        bloco({
          id: 'rf_done',
          ordem: 1,
          status: 'concluido',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
        bloco({
          id: 'rf_timer',
          ordem: 2,
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
      ])
    );
    let generated = 0;
    const commands = [
      op('PATCH', { blockIds: ['rf_1'], patch: { minutos: 90 } }),
      op('MOVE', { blockIds: ['rf_1'], targetDate: '2026-10-22' }),
      op('DUPLICATE', { blockIds: ['rf_done'] }),
      op('ARCHIVE', { blockIds: ['rf_done'] }),
      op('SET_DURATION', { blockIds: ['rf_1'], input: { minutos: 45 } }),
      op('SET_PRIORITY', { blockIds: ['rf_1'], input: { prioridade: 3 } }),
      op('SET_CAPACITY', { input: { capacidade: { minutosPorDiaSemana: { 1: 60 } } } }),
      op('EXTEND_DEADLINE', { input: { dataFinal: '2026-11-30' } }),
    ];

    for (const command of commands) {
      const result = apply(plan, command, {
        events,
        makeId: () => 'rf_novo_' + ++generated,
      });
      expect(result.valid).toBe(true);
      expect(events).toEqual(eventsBefore);
    }
  });

  it('modulo e puro: sem imports, DOM, store, rede ou timers', () => {
    const source = readFileSync('src/js/logic/reta-final-commands.js', 'utf8');

    expect([...source.matchAll(/^import\s/gm)]).toHaveLength(0);
    expect(source).not.toMatch(
      /\b(document|window|localStorage|indexedDB|fetch|scheduleSave|setTimeout|setInterval)\b/
    );
  });
});
