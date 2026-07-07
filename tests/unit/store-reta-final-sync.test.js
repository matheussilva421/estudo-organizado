import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';
import { loadAppModules } from '../helpers/module-loader.js';
import { mergeStudyStates } from '../../src/js/sync/sync-center.js';

let store;

function createRetaFinalPlan(overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    disciplinas: ['disc_1'],
    relevancia: {},
    horarios: { dataFinal: '2026-08-15' },
    materiasPorDia: 3,
    sequencia: [],
    slotOverrides: [],
    ciclosCompletos: 0,
    dataInicioCicloAtual: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
    retaFinal: {
      nome: 'Reta Final',
      dataFinal: '2026-08-15',
      minutosPadrao: 60,
      importadoEm: '2026-07-07T10:00:00.000Z',
      blocos: [
        {
          id: 'rf_1',
          data: '2026-07-10',
          dataOriginal: '2026-07-10',
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 90,
          status: 'pendente',
          rolagens: 0,
        },
      ],
    },
    ...overrides,
  };
}

function createArquivado(overrides = {}) {
  return {
    plan: {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      relevancia: {},
      horarios: { horasSemanais: 20 },
      sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
      ciclosCompletos: 2,
      dataInicioCicloAtual: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
    arquivadoEm: '2026-07-07T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  ({ store } = await loadAppModules());
  store.setState(createBaseState());
  localStorage.clear();
  sessionStorage.clear();
});

describe('store — reta final e planejamentoArquivado', () => {
  // setState normaliza para uma whitelist fixa de chaves; sem
  // planejamentoArquivado na lista, todo pull/restore/boot apagaria o plano
  // arquivado e a restauração pós-prova ficaria impossível.
  describe('setState preserva planejamentoArquivado', () => {
    it('mantém planejamentoArquivado no replace (pull/boot)', () => {
      const incoming = createBaseState();
      incoming.planejamentoArquivado = createArquivado();

      store.setState(incoming);

      expect(store.state.planejamentoArquivado).toEqual(createArquivado());
    });

    it('estado sem o campo (cliente antigo) vira null, sem crash', () => {
      const incoming = createBaseState();
      delete incoming.planejamentoArquivado;

      store.setState(incoming);

      expect(store.state.planejamentoArquivado).toBeNull();
    });

    it('replace com null limpa o plano arquivado (restauração)', () => {
      store.setState(
        createBaseState({ planejamentoArquivado: createArquivado() })
      );

      const incoming = createBaseState();
      incoming.planejamentoArquivado = null;
      store.setState(incoming);

      expect(store.state.planejamentoArquivado).toBeNull();
    });
  });

  describe('setState preserva planejamento.retaFinal', () => {
    it('mantém retaFinal e tipo reta_final no replace', () => {
      const incoming = createBaseState({ planejamento: createRetaFinalPlan() });

      store.setState(incoming);

      expect(store.state.planejamento.tipo).toBe('reta_final');
      expect(store.state.planejamento.retaFinal.blocos).toHaveLength(1);
      expect(store.state.planejamento.retaFinal.blocos[0].id).toBe('rf_1');
    });

    it('merge:true mescla retaFinal.blocos por id', () => {
      store.setState(createBaseState({ planejamento: createRetaFinalPlan() }));

      const incoming = createBaseState({
        planejamento: createRetaFinalPlan({
          retaFinal: {
            nome: 'Reta Final',
            dataFinal: '2026-08-15',
            minutosPadrao: 60,
            importadoEm: '2026-07-07T10:00:00.000Z',
            blocos: [
              {
                id: 'rf_1',
                data: '2026-07-11', // bloco rolado no outro lado
                status: 'pendente',
              },
              {
                id: 'rf_2',
                data: '2026-07-12',
                dataOriginal: '2026-07-12',
                discId: 'disc_1',
                topicos: [],
                minutos: 60,
                status: 'pendente',
                rolagens: 0,
              },
            ],
          },
        }),
      });

      store.setState(incoming, { merge: true });

      const blocos = store.state.planejamento.retaFinal.blocos;
      expect(blocos).toHaveLength(2);
      const rf1 = blocos.find((b) => b.id === 'rf_1');
      // novo vence, campos antigos ausentes no novo são preservados
      expect(rf1.data).toBe('2026-07-11');
      expect(rf1.discId).toBe('disc_1');
      expect(rf1.minutos).toBe(90);
      expect(blocos.some((b) => b.id === 'rf_2')).toBe(true);
    });
  });

  describe('mergeStudyStates (LWW do planejamento)', () => {
    it('plano reta_final remoto mais novo vence inteiro e leva planejamentoArquivado', () => {
      const local = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [],
          updatedAt: '2026-07-01T10:00:00.000Z',
        },
      });
      local.planejamentoArquivado = null;

      const remote = createBaseState({ planejamento: createRetaFinalPlan() });
      remote.planejamentoArquivado = createArquivado();

      const merged = mergeStudyStates(local, remote);

      expect(merged.planejamento.tipo).toBe('reta_final');
      expect(merged.planejamento.retaFinal.blocos[0].id).toBe('rf_1');
      // arquivar + substituir é mutação atômica: o arquivado viaja com o plano
      expect(merged.planejamentoArquivado).toEqual(createArquivado());
    });

    it('plano local mais novo mantém plano e arquivado locais', () => {
      const local = createBaseState({
        planejamento: createRetaFinalPlan({ updatedAt: '2026-07-08T10:00:00.000Z' }),
      });
      local.planejamentoArquivado = createArquivado();

      const remote = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [],
          updatedAt: '2026-07-01T10:00:00.000Z',
        },
      });
      remote.planejamentoArquivado = null;

      const merged = mergeStudyStates(local, remote);

      expect(merged.planejamento.tipo).toBe('reta_final');
      expect(merged.planejamentoArquivado).toEqual(createArquivado());
    });

    it('restauração propaga: remoto mais novo com plano ciclo e arquivado null', () => {
      const local = createBaseState({
        planejamento: createRetaFinalPlan({ updatedAt: '2026-07-08T10:00:00.000Z' }),
      });
      local.planejamentoArquivado = createArquivado();

      const remote = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [],
          updatedAt: '2026-07-09T10:00:00.000Z',
        },
      });
      remote.planejamentoArquivado = null;

      const merged = mergeStudyStates(local, remote);

      expect(merged.planejamento.tipo).toBe('ciclo');
      expect(merged.planejamentoArquivado).toBeNull();
    });
  });

  describe('createExportableState', () => {
    it('inclui planejamentoArquivado e retaFinal no export', () => {
      store.setState(
        createBaseState({
          planejamento: createRetaFinalPlan(),
          planejamentoArquivado: createArquivado(),
        })
      );

      const exported = store.createExportableState();

      expect(exported.planejamento.retaFinal.blocos).toHaveLength(1);
      expect(exported.planejamentoArquivado).toEqual(createArquivado());
    });
  });
});
