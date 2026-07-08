import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createDisciplina,
  createAssunto,
  createEdital,
} from '../helpers/state-builders.js';

const HOJE = '2026-07-10';

let store;
let retaFinalMod;

function payload(overrides = {}) {
  return {
    versao: 1,
    nome: 'Reta Final TJ-SP',
    dataFinal: '2026-08-15',
    minutosPadrao: 45,
    dias: [
      {
        data: '2026-07-10',
        blocos: [
          {
            disciplina: 'Direito Penal',
            topicos: ['Crimes contra a vida'],
            aula: 'Aula 05',
            minutos: 90,
          },
          { disciplina: 'Português', topicos: ['Crase'] },
        ],
      },
      {
        data: '2026-07-11',
        blocos: [{ disciplina: 'Direito Penal', topicos: ['Crimes contra a vida'] }],
      },
    ],
    ...overrides,
  };
}

function baseStateComEdital(overrides = {}) {
  return createBaseState({
    editais: [
      createEdital({
        id: 'ed_1',
        nome: 'Principal',
        arquivado: false,
        disciplinas: [
          createDisciplina({
            id: 'disc_penal',
            nome: 'Direito Penal',
            assuntos: [createAssunto({ id: 'ass_vida', nome: 'Crimes contra a vida' })],
            aulas: [{ id: 'aula_05', nome: 'Aula 05' }],
          }),
        ],
      }),
    ],
    ...overrides,
  });
}

function planoCicloAtivo() {
  return {
    ativo: true,
    tipo: 'ciclo',
    disciplinas: ['disc_penal'],
    relevancia: {},
    horarios: { horasSemanais: 20 },
    sequencia: [
      { id: 'seq_1', discId: 'disc_penal', minutosAlvo: 60, concluido: false, status: 'pendente' },
    ],
    slotOverrides: [],
    ciclosCompletos: 2,
    dataInicioCicloAtual: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(HOJE + 'T10:00:00'));

  const modules = await loadAppModules();
  store = modules.store;
  retaFinalMod = await import('../../src/js/logic/reta-final.js');
});

describe('activateRetaFinal', () => {
  it('arquiva o plano ativo em planejamentoArquivado', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));

    retaFinalMod.activateRetaFinal({ payload: payload() });

    expect(store.state.planejamentoArquivado).not.toBeNull();
    expect(store.state.planejamentoArquivado.plan.tipo).toBe('ciclo');
    expect(store.state.planejamentoArquivado.plan.ciclosCompletos).toBe(2);
    expect(store.state.planejamentoArquivado.arquivadoEm).toBeTruthy();
  });

  it('sem plano ativo não cria arquivado', () => {
    store.setState(baseStateComEdital());

    retaFinalMod.activateRetaFinal({ payload: payload() });

    expect(store.state.planejamentoArquivado).toBeNull();
  });

  it('re-import sobre reta_final ativa preserva o arquivado original', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));
    retaFinalMod.activateRetaFinal({ payload: payload() });
    const arquivadoOriginal = JSON.parse(JSON.stringify(store.state.planejamentoArquivado));

    retaFinalMod.activateRetaFinal({ payload: payload({ nome: 'Reta Final v2' }) });

    expect(store.state.planejamentoArquivado.plan.tipo).toBe('ciclo');
    expect(store.state.planejamentoArquivado.plan.updatedAt).toBe(
      arquivadoOriginal.plan.updatedAt
    );
  });

  it('monta o plano reta_final com blocos, defaults de minutos e updatedAt', () => {
    store.setState(baseStateComEdital());

    retaFinalMod.activateRetaFinal({ payload: payload() });

    const plan = store.state.planejamento;
    expect(plan.ativo).toBe(true);
    expect(plan.tipo).toBe('reta_final');
    expect(plan.updatedAt).toBeTruthy();
    expect(plan.sequencia).toEqual([]);
    expect(plan.retaFinal.nome).toBe('Reta Final TJ-SP');
    expect(plan.retaFinal.dataFinal).toBe('2026-08-15');
    expect(plan.retaFinal.minutosPadrao).toBe(45);
    expect(plan.retaFinal.blocos).toHaveLength(3);

    const [b1, b2, b3] = plan.retaFinal.blocos;
    expect(b1.id).toMatch(/^rf_/);
    expect(b1.data).toBe('2026-07-10');
    expect(b1.dataOriginal).toBe('2026-07-10');
    expect(b1.discId).toBe('disc_penal');
    expect(b1.minutos).toBe(90);
    expect(b1.status).toBe('pendente');
    expect(b1.rolagens).toBe(0);
    // tópico casado + aula casada
    expect(b1.topicos).toEqual([
      { assId: 'ass_vida', aulaId: null },
      { assId: null, aulaId: 'aula_05' },
    ]);
    // bloco sem minutos usa minutosPadrao do payload
    expect(b2.minutos).toBe(45);
    expect(b3.data).toBe('2026-07-11');
    expect(plan.disciplinas).toContain('disc_penal');
  });

  it('cria disciplina/assunto faltantes no edital principal ativo', () => {
    store.setState(baseStateComEdital());

    retaFinalMod.activateRetaFinal({ payload: payload() });

    const edital = store.state.editais.find((e) => e.id === 'ed_1');
    const portugues = edital.disciplinas.find((d) => d.nome === 'Português');
    expect(portugues).toBeTruthy();
    const crase = portugues.assuntos.find((a) => a.nome === 'Crase');
    expect(crase).toBeTruthy();

    const blocoPt = store.state.planejamento.retaFinal.blocos.find(
      (b) => b.discId === portugues.id
    );
    expect(blocoPt.topicos[0].assId).toBe(crase.id);
  });

  it('sem edital ativo cria um edital "Reta Final"', () => {
    store.setState(
      baseStateComEdital({
        editais: [],
      })
    );

    retaFinalMod.activateRetaFinal({ payload: payload() });

    const edital = store.state.editais.find((e) => e.nome === 'Reta Final');
    expect(edital).toBeTruthy();
    expect(edital.disciplinas.map((d) => d.nome)).toEqual(
      expect.arrayContaining(['Direito Penal', 'Português'])
    );
  });

  it('cria aula faltante na disciplina', () => {
    const state = baseStateComEdital();
    state.editais[0].disciplinas[0].aulas = [];
    store.setState(state);

    retaFinalMod.activateRetaFinal({ payload: payload() });

    const disc = store.state.editais[0].disciplinas.find((d) => d.id === 'disc_penal');
    const aula = (disc.aulas || []).find((a) => a.nome === 'Aula 05');
    expect(aula).toBeTruthy();
    expect(store.state.planejamento.retaFinal.blocos[0].topicos).toContainEqual({
      assId: null,
      aulaId: aula.id,
    });
  });

  it('materializa eventos da reta final e limpa autos antigos do ciclo', () => {
    store.setState(
      baseStateComEdital({
        planejamento: planoCicloAtivo(),
        eventos: [
          {
            id: 'auto_ciclo',
            titulo: 'Estudar X',
            data: HOJE,
            status: 'agendado',
            tempoAcumulado: 0,
            seqId: 'seq_1',
            slotIndex: 0,
            isAutoGenerated: true,
          },
          {
            id: 'ev_estudado',
            titulo: 'Sessão',
            data: '2026-07-01',
            status: 'estudei',
            tempoAcumulado: 3600,
            discId: 'disc_penal',
          },
        ],
      })
    );

    retaFinalMod.activateRetaFinal({ payload: payload() });

    expect(store.state.eventos.some((e) => e.id === 'auto_ciclo')).toBe(false);
    expect(store.state.eventos.some((e) => e.id === 'ev_estudado')).toBe(true);
    expect(store.state.eventos.filter((e) => e.rfBlocoId)).toHaveLength(3);
  });

  it('payload inválido lança erro e não muda o estado', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));

    expect(() => retaFinalMod.activateRetaFinal({ payload: { versao: 2 } })).toThrow();
    expect(store.state.planejamento.tipo).toBe('ciclo');
    expect(store.state.planejamentoArquivado).toBeNull();
  });
});

describe('restaurarPlanejamentoArquivado', () => {
  it('restaura o plano arquivado, limpa o arquivado e os eventos da reta final', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));
    retaFinalMod.activateRetaFinal({ payload: payload() });
    expect(store.state.planejamento.tipo).toBe('reta_final');

    const ok = retaFinalMod.restaurarPlanejamentoArquivado();

    expect(ok).toBe(true);
    expect(store.state.planejamento.tipo).toBe('ciclo');
    expect(store.state.planejamento.ciclosCompletos).toBe(2);
    // restauração é mutação real: reivindica autoria no LWW
    expect(store.state.planejamento.updatedAt).not.toBe('2026-07-01T10:00:00.000Z');
    expect(store.state.planejamentoArquivado).toBeNull();
    expect(store.state.eventos.filter((e) => e.rfBlocoId && e.status !== 'estudei')).toHaveLength(
      0
    );
  });

  it('eventos estudados da reta final sobrevivem à restauração', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));
    retaFinalMod.activateRetaFinal({ payload: payload() });
    const evento = store.state.eventos.find((e) => e.rfBlocoId);
    evento.status = 'estudei';
    evento.tempoAcumulado = 3600;

    retaFinalMod.restaurarPlanejamentoArquivado();

    expect(store.state.eventos.some((e) => e.id === evento.id)).toBe(true);
  });

  it('sem arquivado retorna false e não muda nada', () => {
    store.setState(baseStateComEdital({ planejamento: planoCicloAtivo() }));

    expect(retaFinalMod.restaurarPlanejamentoArquivado()).toBe(false);
    expect(store.state.planejamento.tipo).toBe('ciclo');
  });
});
