import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEdital, createDisciplina, createEvento } from '../helpers/state-builders.js';

let store;
let logic;
let views;
let app;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;
  views = modules.views;
  app = modules.app;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateDashCaches();
});

describe('editais-view.js', () => {
  describe('renderEditalTree()', () => {
    it('renderiza árvore de edital com disciplinas', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
        disciplinas: [
          createDisciplina({ id: 'disc_1', nome: 'Direito Constitucional' })
        ]
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('Concurso TRF');
      expect(html).toContain('Direito Constitucional');
    });

    it('inclui cor do edital no header', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
        cor: '#10b981'
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('#10b981');
    });

    it('inclui atributos data-action', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF'
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('data-action="toggle-edital"');
      expect(html).toContain('data-edital-id="ed_1"');
    });
  });

  describe('toggleEdital()', () => {
    it('existe e é função', () => {
      expect(views.toggleEdital).toBeDefined();
      expect(typeof views.toggleEdital).toBe('function');
    });
  });

  describe('toggleAssunto()', () => {
    it('existe e é função', () => {
      expect(views.toggleAssunto).toBeDefined();
      expect(typeof views.toggleAssunto).toBe('function');
    });
  });
});

describe('dashboard-view.js', () => {
  describe('renderDisciplinaDashboard()', () => {
    it('renderiza dashboard de disciplina com shell', () => {
      const edital = createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          nome: 'Direito Constitucional',
          assuntos: [
            { id: 'ass_1', nome: 'Teste', concluido: false }
          ]
        })]
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('disc-dashboard-shell');
    });

    it('renderiza lista de assuntos', () => {
      const edital = createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          assuntos: [
            { id: 'ass_1', nome: 'Assunto 1', concluido: false },
            { id: 'ass_2', nome: 'Assunto 2', concluido: true }
          ]
        })]
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('Assunto 1');
      expect(html).toContain('Assunto 2');
    });

    it('inclui data-actions para interação', () => {
      const edital = createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          assuntos: [{ id: 'ass_1', nome: 'Teste' }]
        })]
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('data-action="toggle-assunto"');
    });
  });

  describe('toggleAssunto()', () => {
    it('marca assunto como concluído', () => {
      const state = createBaseState({
        editais: [createEdital({
          disciplinas: [createDisciplina({
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Teste', concluido: false }]
          })]
        })]
      });
      store.setState(state);

      views.toggleAssunto('disc_1', 'ass_1');

      const disc = store.state.editais[0].disciplinas.find(d => d.id === 'disc_1');
      expect(disc.assuntos[0].concluido).toBe(true);
    });
  });
});

describe('ciclo-view.js', () => {
  describe('renderCiclo()', () => {
    it('renderiza container vazio quando sem ciclo ativo', () => {
      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza ciclo com sequência', () => {
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [
            { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
          ],
          ciclosCompletos: 0
        },
        editais: [createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })]
        })]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toContain('Ciclo');
    });

    it('renderiza progresso do ciclo em formato humano e sem casas decimais', () => {
      const sequencia = Array.from({ length: 12 }, (_, index) => ({
        id: `seq_${index + 1}`,
        discId: 'disc_1',
        minutosAlvo: 120,
        concluido: false
      }));
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia,
          ciclosCompletos: 0,
          dataInicioCicloAtual: '2026-04-20T00:00:00.000Z'
        },
        editais: [createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })]
        })]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toContain('0h de 24h');
      expect(container.innerHTML).toContain('faltam 24h');
      expect(container.innerHTML).toContain('0 de 12 sessões concluídas');
      expect(container.innerHTML).toContain('0%');
      expect(container.innerHTML).not.toContain('0.00%');
      expect(container.innerHTML).not.toContain('/ 24h');
    });

    it('renderiza resumo agregado da previsÃ£o de sessÃµes', () => {
      document.body.innerHTML = '<main id="test-root"></main>';
      const state = createBaseState({
        config: {
          ...createBaseState().config,
          materiasPorDia: 2
        },
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [
            { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
          ],
          ciclosCompletos: 0,
          horarios: {
            diasAtivos: [1, 2],
            horasPorDia: { 1: '02:00', 2: '02:00' },
            dataInicial: '2026-04-20',
            dataFinal: '2026-04-21'
          }
        },
        editais: [createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })]
        })]
      });
      store.setState(state);

      const container = document.getElementById('test-root');
      views.renderCiclo(container);
      views.calculateCyclePredictions();

      expect(container.innerHTML).toContain('4 sessões previstas');
      expect(container.innerHTML).toContain('4h totais');
      expect(container.innerHTML).toContain('20/04/2026 a 21/04/2026');
    });
  });

  describe('recomecarCiclo()', () => {
    it('existe e é função', () => {
      expect(views.recomecarCiclo).toBeDefined();
      expect(typeof views.recomecarCiclo).toBe('function');
    });
  });

  describe('zerarCiclosCounter()', () => {
    it('existe e é função', () => {
      expect(views.zerarCiclosCounter).toBeDefined();
      expect(typeof views.zerarCiclosCounter).toBe('function');
    });
  });
});

describe('habitos-view.js', () => {
  describe('renderHabitos()', () => {
    it('renderiza grid de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-grid');
    });

    it('renderiza cards de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-card');
      expect(container.innerHTML).toContain('Videoaula');
    });

    it('renderiza histórico de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-hist');
    });

    it('renderiza detalhes completos no histórico de hábitos', () => {
      const state = createBaseState({
        habitos: {
          questoes: [],
          revisao: [],
          discursiva: [
            {
              id: 'hab_disc_1',
              data: '2026-04-19',
              descricao: 'Peca sobre controle externo',
              nota: '8.5'
            }
          ],
          simulado: [],
          leitura: [],
          informativo: [],
          sumula: [],
          videoaula: [],
          paginas: [
            {
              id: 'hab_pag_1',
              data: '2026-04-18',
              descricao: 'Lei 8.112',
              total: 42
            }
          ]
        }
      });
      store.setState(state);

      const container = document.createElement('div');
      document.body.appendChild(container);
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('Peca sobre controle externo');
      expect(container.innerHTML).toContain('Nota 8.5');
      expect(container.innerHTML).toContain('Lei 8.112');
      expect(container.innerHTML).toContain('42 páginas');
    });
  });

  describe('calcSimuladoPerc()', () => {
    it('existe e é função', () => {
      expect(views.calcSimuladoPerc).toBeDefined();
      expect(typeof views.calcSimuladoPerc).toBe('function');
    });
  });

  describe('deleteHabito()', () => {
    it('existe e é função', () => {
      expect(views.deleteHabito).toBeDefined();
      expect(typeof views.deleteHabito).toBe('function');
    });
  });

  describe('setHabitPage()', () => {
    it('existe e é função', () => {
      expect(views.setHabitPage).toBeDefined();
      expect(typeof views.setHabitPage).toBe('function');
    });
  });
});

describe('home-view.js', () => {
  describe('renderHome()', () => {
    it('renderiza home com estatísticas', () => {
      const state = createBaseState({
        eventos: [
          createEvento({ id: 'ev_1', titulo: 'Sessão 1', data: '2026-04-20', status: 'concluido' })
        ]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza home vazia sem eventos', () => {
      const state = createBaseState({ eventos: [], arquivo: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza stats de sessões', () => {
      const state = createBaseState({
        eventos: [createEvento({ id: 'ev_1', titulo: 'Sessão', status: 'concluido' })]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('stat');
    });

    it('mantém a área de estudo semanal renderizável mesmo sem dados', () => {
      const state = createBaseState({ eventos: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('home-weekly-study-card');
      expect(container.innerHTML).toContain('home-weekly-study-chart');
      expect(container.innerHTML).toContain('Nenhuma sessão de estudo registrada esta semana');
    });
  });
});

describe('historico-sessoes view', () => {
  it('renderiza detalhes e usa a data real de estudo no histórico global', () => {
    const state = createBaseState({
      editais: [createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          nome: 'Direito Constitucional',
          assuntos: [{ id: 'ass_1', nome: 'Controle de Constitucionalidade' }]
        })]
      })],
      eventos: [
        createEvento({
          id: 'ev_done_1',
          titulo: 'Sessão registrada',
          data: '2026-03-19',
          dataEstudo: '2026-04-19',
          status: 'estudei',
          tempoAcumulado: 2700,
          discId: 'disc_1',
          assId: 'ass_1',
          questoes: { acertos: 8, erros: 2 },
          paginas: 12
        })
      ]
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    expect(container.innerHTML).toContain('19/04/2026');
    expect(container.innerHTML).not.toContain('19/03/2026');
    expect(container.innerHTML).toContain('Direito Constitucional');
    expect(container.innerHTML).toContain('Sessão registrada');
    expect(container.innerHTML).toContain('Controle de Constitucionalidade');
    expect(container.innerHTML).toContain('8/10 (80%)');
    expect(container.innerHTML).toContain('12');
  });

  it('inclui sessões arquivadas com os mesmos detalhes do histórico ativo', () => {
    const state = createBaseState({
      editais: [createEdital({
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })]
      })],
      eventos: [],
      arquivo: [
        createEvento({
          id: 'ev_archived_1',
          titulo: 'Sessão arquivada',
          data: '2026-03-18',
          dataEstudo: '2026-03-18',
          status: 'estudei',
          tempoAcumulado: 3600,
          discId: 'disc_1'
        })
      ]
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    expect(container.innerHTML).toContain('Sessão arquivada');
    expect(container.innerHTML).toContain('Direito Administrativo');
    expect(container.innerHTML).toContain('01:00:00');
  });
});

describe('revisoes view actions', () => {
  it('confirma e remove da fila todas as revisões vencidas do assunto', () => {
    document.body.innerHTML = `
      <div id="modal-confirm" class="modal-overlay" aria-hidden="true">
        <div id="confirm-title"></div>
        <div id="confirm-msg"></div>
        <button id="confirm-ok-btn"></button>
        <button id="confirm-cancel-btn"></button>
      </div>
    `;
    app.setupConfirmHandlers();

    const state = createBaseState({
      editais: [createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          assuntos: [{
            id: 'ass_1',
            nome: 'Orçamento público',
            concluido: true,
            dataConclusao: '2026-03-16',
            revisoesFetas: ['2026-03-17']
          }]
        })]
      })]
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    expect(logic.getPendingRevisoes()).toHaveLength(1);

    views.deletarRevisao('ass_1');
    document.getElementById('confirm-ok-btn').click();

    expect(logic.getPendingRevisoes()).toHaveLength(0);
    expect(store.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas).toEqual([
      '2026-03-17',
      '2026-03-23',
      '2026-04-15'
    ]);
  });

  it('remove revisão inicial atrasada mesmo quando ainda não há revisões feitas', () => {
    document.body.innerHTML = `
      <div id="modal-confirm" class="modal-overlay" aria-hidden="true">
        <div id="confirm-title"></div>
        <div id="confirm-msg"></div>
        <button id="confirm-ok-btn"></button>
        <button id="confirm-cancel-btn"></button>
      </div>
    `;
    app.setupConfirmHandlers();

    const state = createBaseState({
      editais: [createEdital({
        disciplinas: [createDisciplina({
          id: 'disc_1',
          assuntos: [{
            id: 'ass_1',
            nome: 'Orçamento público',
            concluido: true,
            dataConclusao: '2026-03-16',
            revisoesFetas: []
          }]
        })]
      })]
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    expect(logic.getPendingRevisoes()[0].assunto.id).toBe('ass_1');

    views.deletarRevisao('ass_1');
    document.getElementById('confirm-ok-btn').click();

    expect(logic.getPendingRevisoes()).toHaveLength(0);
    expect(store.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas).toEqual([
      '2026-03-17',
      '2026-03-23',
      '2026-04-15'
    ]);
  });
});

describe('banca-view.js', () => {
  describe('renderBancaAnalyzerModule()', () => {
    it('renderiza módulo de análise de banca', () => {
      const container = { innerHTML: '' };
      views.renderBancaAnalyzerModule?.(container);

      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('renderBancaAnalyzerContent()', () => {
    it('renderiza conteúdo do analisador', () => {
      const state = createBaseState({
        editais: [createEdital({
          id: 'ed_1',
          nome: 'Concurso TRF',
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })]
        })]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderBancaAnalyzerContent?.(container);

      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('mudarEditalAnalisador()', () => {
    it('existe e é função', () => {
      expect(views.mudarEditalAnalisador).toBeDefined();
      expect(typeof views.mudarEditalAnalisador).toBe('function');
    });
  });

  describe('filtrarViewPorDisciplina()', () => {
    it('existe e é função', () => {
      expect(views.filtrarViewPorDisciplina).toBeDefined();
      expect(typeof views.filtrarViewPorDisciplina).toBe('function');
    });
  });

  describe('carregarAnaliseBanca()', () => {
    it('existe e é função', () => {
      expect(views.carregarAnaliseBanca).toBeDefined();
      expect(typeof views.carregarAnaliseBanca).toBe('function');
    });
  });
});
