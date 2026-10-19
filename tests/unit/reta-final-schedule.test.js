import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDateStr } from '../../src/js/utils.js?v=8.37';
import { projectRetaFinalSchedule } from '../../src/js/logic/reta-final-schedule.js';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createAssunto,
  createBaseState,
  createDisciplina,
  createEdital,
  createEvento,
} from '../helpers/state-builders.js';

const HOJE = '2026-10-19';

function bloco(overrides = {}) {
  return {
    id: 'rf_1',
    discId: 'disc_1',
    topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60,
    status: 'pendente',
    ordem: 0,
    dataOriginal: '2026-10-18',
    dataPlanejada: '2026-10-18',
    data: '2026-10-18',
    rolagens: 0,
    ...overrides,
  };
}

function plano(blocos, overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    planId: 'rfplan_1',
    schemaVersionRetaFinal: 2,
    revision: 7,
    updatedAt: '2026-10-19T10:00:00.000Z',
    retaFinal: {
      nome: 'Reta Final',
      dataFinal: '2026-10-25',
      minutosPadrao: 60,
      blocos,
      ...overrides,
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

describe('projectRetaFinalSchedule — intenção versus projeção', () => {
  it('projeta bloco pendente atrasado para hoje e mantém o plano byte-a-byte imutável', () => {
    const plan = deepFreeze(
      plano([bloco({ id: 'rf_late', dataPlanejada: '2026-10-18', dataOriginal: '2026-10-18' })])
    );
    const before = JSON.stringify(plan);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos).toHaveLength(1);
    expect(result.blocos[0]).toMatchObject({
      id: 'rf_late',
      dataPlanejada: '2026-10-18',
      dataEfetiva: HOJE,
      categoriaTemporal: 'atrasado',
      naoAlocado: false,
      rolado: true,
      status: 'pendente',
    });
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.revision).toBe(7);
    expect(plan.updatedAt).toBe('2026-10-19T10:00:00.000Z');
  });

  it('vira a data local de 2026-10-19 para 2026-10-20 sem deslocamento UTC', () => {
    const plan = plano([
      bloco({
        id: 'rf_virada',
        dataPlanejada: '2026-10-19',
        dataOriginal: '2026-10-19',
        data: '2026-10-19',
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: '2026-10-20' });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: '2026-10-20',
      categoriaTemporal: 'atrasado',
      rolado: true,
    });
    // 23h30 locais de 19/10 continuam 19/10; o offset local não pode empurrar
    // a data civil para o dia seguinte como faria uma leitura UTC ingênua.
    expect(getLocalDateStr(new Date(2026, 9, 19, 23, 30))).toBe('2026-10-19');
  });

  it('não rola bloco fixado, mesmo vencido', () => {
    const plan = plano([
      bloco({
        id: 'rf_fixed',
        fixado: true,
        dataPlanejada: '2026-10-16',
        dataOriginal: '2026-10-16',
        data: '2026-10-16',
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: '2026-10-16',
      categoriaTemporal: 'atrasado',
      rolado: false,
      naoAlocado: false,
    });
  });

  it('não rola bloco explicitamente reagendado', () => {
    const plan = plano([
      bloco({
        id: 'rf_moved',
        dataOriginal: '2026-10-14',
        dataPlanejada: '2026-10-17',
        data: '2026-10-17',
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: '2026-10-17',
      categoriaTemporal: 'atrasado',
      rolado: false,
    });
  });

  it('após dataFinal marca nao_coberto sem apagar bloco nem intenção', () => {
    const plan = deepFreeze(
      plano([
        bloco({
          id: 'rf_late',
          dataPlanejada: '2026-10-17',
          dataOriginal: '2026-10-17',
          data: '2026-10-17',
        }),
      ], { dataFinal: '2026-10-18' })
    );
    const before = JSON.stringify(plan);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos).toHaveLength(1);
    expect(result.blocos[0]).toMatchObject({
      id: 'rf_late',
      dataPlanejada: '2026-10-17',
      dataEfetiva: '2026-10-17',
      categoriaTemporal: 'nao_coberto',
      naoAlocado: false,
      status: 'nao_coberto',
    });
    expect(result.alerts).toContainEqual(
      expect.objectContaining({ code: 'NAO_COBERTO', blocoId: 'rf_late' })
    );
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.retaFinal.blocos).toHaveLength(1);
  });

  it('mantém coberto o dia exato da dataFinal (intervalo fechado)', () => {
    const plan = plano(
      [
        bloco({
          id: 'rf_ultimo_dia',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
      ],
      { dataFinal: HOJE }
    );

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: HOJE,
      categoriaTemporal: 'atrasado',
      rolado: true,
    });
  });

  it('deriva concluído do evento preservado mesmo após a dataFinal', () => {
    const plan = plano(
      [
        bloco({
          id: 'rf_done',
          status: 'pendente',
          dataPlanejada: '2026-10-17',
          dataOriginal: '2026-10-17',
          data: '2026-10-17',
        }),
      ],
      { dataFinal: '2026-10-18' }
    );

    const result = projectRetaFinalSchedule(plan, {
      today: HOJE,
      occupiedBlocoIds: new Set(['rf_done']),
    });

    expect(result.blocos[0]).toMatchObject({
      id: 'rf_done',
      dataEfetiva: '2026-10-17',
      categoriaTemporal: 'concluido',
      status: 'concluido',
    });
  });

  it('não conclui bloco apenas porque o texto de planejamento diz concluído', () => {
    const plan = plano([
      bloco({
        id: 'rf_texto_diz_concluido',
        status: 'concluido',
        dataPlanejada: '2026-10-18',
        dataOriginal: '2026-10-18',
        data: '2026-10-18',
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      id: 'rf_texto_diz_concluido',
      categoriaTemporal: 'atrasado',
      status: 'pendente',
      rolado: true,
    });
  });

  it('evento preservado parcial impede rolagem sem virar concluído', () => {
    const plan = plano([bloco({ id: 'rf_partial' })]);

    const result = projectRetaFinalSchedule(plan, {
      today: HOJE,
      occupiedBlocoIds: new Set(['rf_partial']),
      completedBlocoIds: new Set(),
    });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: '2026-10-18',
      categoriaTemporal: 'atrasado',
      rolado: false,
      status: 'pendente',
    });
  });

  it('distingue não alocado por capacidade de não coberto por prazo', () => {
    const plan = plano([
      bloco({
        id: 'rf_sem_capacidade',
        naoAlocado: true,
        dataPlanejada: HOJE,
        dataOriginal: HOJE,
        data: HOJE,
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: null,
      categoriaTemporal: 'nao_alocado',
      naoAlocado: true,
    });
    expect(result.alerts).toContainEqual(
      expect.objectContaining({ code: 'NAO_ALOCADO', blocoId: 'rf_sem_capacidade' })
    );
  });

  it('data planejada inválida gera não alocado e diagnóstico legível', () => {
    const plan = plano([
      bloco({
        id: 'rf_invalido',
        dataPlanejada: '2026-02-30',
        dataOriginal: '2026-02-30',
        data: null,
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: null,
      categoriaTemporal: 'nao_alocado',
      naoAlocado: true,
    });
    expect(result.alerts).toContainEqual(
      expect.objectContaining({
        code: 'NAO_ALOCADO',
        blocoId: 'rf_invalido',
        reason: 'data_invalida',
      })
    );
  });

  it('não mascara dataPlanejada inválida com uma data legada válida', () => {
    const plan = plano([
      bloco({
        id: 'rf_invalido_com_legado',
        dataPlanejada: '2026-02-30',
        dataOriginal: '2026-10-18',
        data: '2026-10-18',
      }),
    ]);

    const result = projectRetaFinalSchedule(plan, { today: HOJE });

    expect(result.blocos[0]).toMatchObject({
      dataEfetiva: null,
      categoriaTemporal: 'nao_alocado',
      naoAlocado: true,
    });
    expect(result.alerts).toContainEqual(
      expect.objectContaining({
        code: 'NAO_ALOCADO',
        blocoId: 'rf_invalido_com_legado',
        reason: 'data_invalida',
      })
    );
  });

  it('plano ausente ou de outro tipo retorna projeção vazia', () => {
    expect(projectRetaFinalSchedule(null, { today: HOJE })).toEqual({ blocos: [], alerts: [] });
    expect(
      projectRetaFinalSchedule({ tipo: 'ciclo' }, { today: HOJE })
    ).toEqual({ blocos: [], alerts: [] });
  });
});

describe('syncRetaFinalToEventos — integração com a projeção v2', () => {
  let store;
  let logic;
  let retaFinalMod;

  function buildState(blocos, { dataFinal = '2026-10-25', eventos = [] } = {}) {
    return createBaseState({
      editais: [
        createEdital({
          id: 'ed_1',
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              nome: 'Direito Penal',
              assuntos: [createAssunto({ id: 'ass_1', nome: 'Crimes contra a vida' })],
            }),
          ],
        }),
      ],
      planejamento: {
        ativo: true,
        tipo: 'reta_final',
        planId: 'rfplan_integration',
        schemaVersionRetaFinal: 2,
        revision: 7,
        updatedAt: '2026-10-18T10:00:00.000Z',
        disciplinas: ['disc_1'],
        relevancia: {},
        horarios: { dataFinal },
        materiasPorDia: 3,
        sequencia: [],
        slotOverrides: [],
        ciclosCompletos: 0,
        dataInicioCicloAtual: '2026-10-01T00:00:00.000Z',
        retaFinal: {
          nome: 'Reta Final',
          dataFinal,
          minutosPadrao: 60,
          importadoEm: '2026-10-01T10:00:00.000Z',
          blocos,
        },
      },
      eventos,
    });
  }

  function eventosDoBloco(blocoId) {
    return store.state.eventos.filter((ev) => ev.rfBlocoId === blocoId);
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(HOJE + 'T10:00:00'));

    const modules = await loadAppModules();
    store = modules.store;
    logic = modules.logic;
    retaFinalMod = await import('../../src/js/logic/reta-final.js');
  });

  it('rola a projeção v2, materializa rfBlocoId e preserva intenção/revisão', () => {
    store.setState(
      buildState([
        bloco({
          id: 'rf_late',
          dataPlanejada: '2026-10-18',
          dataOriginal: '2026-10-18',
          data: '2026-10-18',
        }),
      ])
    );
    logic.invalidateDiscCache();

    retaFinalMod.syncRetaFinalToEventos();

    const plan = store.state.planejamento;
    const projected = plan.retaFinal.blocos[0];
    expect(projected).toMatchObject({ data: HOJE, dataPlanejada: '2026-10-18' });
    expect(projected.dataPlanejada).toBe('2026-10-18');
    expect(plan.revision).toBe(7);
    expect(plan.updatedAt).toBe('2026-10-18T10:00:00.000Z');
    const events = eventosDoBloco('rf_late');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ data: HOJE, rfBlocoId: 'rf_late', isAutoGenerated: true });
  });

  it('bloco fixado no passado permanece na data humana e não ganha evento', () => {
    store.setState(
      buildState([
        bloco({
          id: 'rf_fixed',
          fixado: true,
          dataPlanejada: '2026-10-17',
          dataOriginal: '2026-10-17',
          data: '2026-10-17',
        }),
      ])
    );
    logic.invalidateDiscCache();

    retaFinalMod.syncRetaFinalToEventos();

    expect(store.state.planejamento.retaFinal.blocos[0].data).toBe('2026-10-17');
    expect(store.state.planejamento.revision).toBe(7);
    expect(eventosDoBloco('rf_fixed')).toHaveLength(0);
  });

  it('após dataFinal mantém o bloco, marca nao_coberto e remove auto pendente', () => {
    vi.setSystemTime(new Date('2026-10-20T10:00:00'));
    store.setState(
      buildState(
        [
          bloco({
            id: 'rf_late',
            dataPlanejada: '2026-10-18',
            dataOriginal: '2026-10-18',
            data: '2026-10-18',
          }),
        ],
        {
          dataFinal: '2026-10-19',
          eventos: [
            createEvento({
              id: 'ev_auto',
              data: '2026-10-18',
              status: 'agendado',
              tempoAcumulado: 0,
              rfBlocoId: 'rf_late',
              isAutoGenerated: true,
            }),
          ],
        }
      )
    );
    logic.invalidateDiscCache();

    retaFinalMod.syncRetaFinalToEventos();

    const blocoFinal = store.state.planejamento.retaFinal.blocos[0];
    expect(blocoFinal).toMatchObject({ status: 'nao_coberto', dataPlanejada: '2026-10-18' });
    expect(store.state.planejamento.retaFinal.blocos).toHaveLength(1);
    expect(eventosDoBloco('rf_late')).toHaveLength(0);
    expect(store.state.planejamento.revision).toBe(7);
  });
});
