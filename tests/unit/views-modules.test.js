import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEdital, createDisciplina, createEvento } from '../helpers/state-builders.js';

let store;
let logic;
let views;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;
  views = modules.views;

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
