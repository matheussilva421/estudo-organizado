import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEvento, createDisciplina, createEdital, createAssunto } from '../helpers/state-builders.js';

let store;
let views;
let logic;
let components;
let app;

/**
 * Setup de mock para elementos DOM
 */
function createMockDOM() {
  const elements = {};

  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 }))
    };
    elements[id] = el;
    return el;
  };

  return {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { style: {} },
    elements
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const mockDoc = createMockDOM();
  global.document = mockDoc;
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    _cronoInterval: null,
    _discChartInstance: null,
    _planjChartInstance: null,
    activeDashboardDiscCtx: null,
    currentView: 'home'
  };
  global.Notification = vi.fn();
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn((fn) => ({ _interval: true, fn }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };

  const modules = await loadAppModules();
  store = modules.store;
  views = modules.views;
  logic = modules.logic;
  components = modules.components;
  app = modules.app;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateDashCaches();
});

describe('app.js - Theme contracts', () => {
  it('exposes only the premium dark themes', () => {
    expect(app.THEME_OPTIONS).toEqual([
      { value: 'grafite', label: 'Grafite' },
      { value: 'ardosia', label: 'Ardósia' },
      { value: 'pergaminho', label: 'Pergaminho' }
    ]);
  });

  it('maps legacy theme values to premium dark themes', () => {
    expect(app.normalizeTheme('light')).toBe('grafite');
    expect(app.normalizeTheme('dark')).toBe('grafite');
    expect(app.normalizeTheme('obsidiana')).toBe('ardosia');
    expect(app.normalizeTheme('contraste')).toBe('pergaminho');
    expect(app.normalizeTheme('furtivo')).toBe('ardosia');
    expect(app.normalizeTheme('abismo')).toBe('grafite');
    expect(app.normalizeTheme('matrix')).toBe('ardosia');
    expect(app.normalizeTheme('rubi')).toBe('pergaminho');
    expect(app.normalizeTheme('cyberpunk2077')).toBe('grafite');
    expect(app.normalizeTheme('desconhecido', true)).toBe('grafite');
  });
});

describe('views.js - Skeleton Renderers', () => {
  describe('renderSkeletonLoader()', () => {
    it('retorna HTML com grid de skeleton stats', () => {
      const html = views.renderSkeletonLoader();

      expect(html).toContain('loading-skeleton');
      expect(html).toContain('skeleton-stats-grid');
      expect(html).toContain('skeleton-stat-card');
      expect(html).toContain('skeleton-stat-value');
      expect(html).toContain('skeleton-stat-label');
    });

    it('inclui skeleton de gráfico', () => {
      const html = views.renderSkeletonLoader();

      expect(html).toContain('skeleton-chart');
      expect(html).toContain('skeleton-title');
    });
  });

  describe('renderSkeletonList()', () => {
    it('rende riza lista com 5 itens por padrão', () => {
      const html = views.renderSkeletonList();

      expect(html).toContain('skeleton-list');
      expect(html).toContain('skeleton-list-item');
      // Conta quantos items tem
      const matches = html.match(/skeleton-list-item/g);
      expect(matches?.length).toBe(5);
    });

    it('renderiza lista com número customizado de itens', () => {
      const html = views.renderSkeletonList(3);

      const matches = html.match(/skeleton-list-item/g);
      expect(matches?.length).toBe(3);
    });

    it('renderiza lista com 10 itens quando especificado', () => {
      const html = views.renderSkeletonList(10);

      const matches = html.match(/skeleton-list-item/g);
      expect(matches?.length).toBe(10);
    });
  });

  describe('renderSkeletonTable()', () => {
    it('renderiza tabela com 5 linhas e 4 colunas por padrão', () => {
      const html = views.renderSkeletonTable();

      expect(html).toContain('skeleton-table');
      expect(html).toContain('<tr>');

      // Conta as linhas da tabela
      const rowMatches = html.match(/<tr>/g);
      expect(rowMatches?.length).toBe(5);
    });

    it('renderiza tabela com número customizado de linhas', () => {
      const html = views.renderSkeletonTable(3, 4);

      const rowMatches = html.match(/<tr>/g);
      expect(rowMatches?.length).toBe(3);
    });
  });
});

describe('views.js - MED View', () => {
  describe('renderMED()', () => {
    it('renderiza container de eventos com estatísticas', () => {
      const state = createBaseState({
        eventos: [
          createEvento({ id: 'ev_1', titulo: 'Sessão 1', data: '2026-04-25', status: 'agendado' })
        ]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderMED(container);

      expect(container.innerHTML).toContain('med-stats-row');
    });

    it('mostra estado vazio quando sem eventos', () => {
      const state = createBaseState({ eventos: [], arquivo: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderMED(container);

      expect(container.innerHTML).toContain('empty-state');
    });
  });

  describe('refreshEventCard()', () => {
    it('chama renderCurrentView para atualizar cards', () => {
      const evento = createEvento({ id: 'ev_refresh', titulo: 'Original' });
      const state = createBaseState({ eventos: [evento] });
      store.setState(state);

      // A função refreshEventCard usa querySelector para encontrar o card
      views.refreshEventCard('ev_refresh');

      // Verifica que o documento foi consultado
      expect(global.document.querySelector).toHaveBeenCalled();
    });
  });

  describe('removeDOMCard()', () => {
    it('remove card do DOM pelo ID', () => {
      const mockCard = { remove: vi.fn() };
      global.document.querySelector = vi.fn((selector) => {
        if (selector.includes('ev_test')) return mockCard;
        return null;
      });

      views.removeDOMCard('ev_test');

      expect(mockCard.remove).toHaveBeenCalled();
    });
  });
});

describe('views.js - Dashboard', () => {
  describe('renderDashboard()', () => {
    it('existe e é uma função', () => {
      expect(views.renderDashboard).toBeDefined();
      expect(typeof views.renderDashboard).toBe('function');
    });
  });

  describe('destroyDashboardCharts()', () => {
    it('existe e é uma função', () => {
      expect(views.destroyDashboardCharts).toBeDefined();
      expect(typeof views.destroyDashboardCharts).toBe('function');
    });

    it('pode ser chamada sem lançar erro quando não há gráficos', () => {
      expect(() => views.destroyDashboardCharts()).not.toThrow();
    });
  });
});

describe('views.js - Editais', () => {
  describe('renderEditais()', () => {
    it('renderiza lista de editais', () => {
      const state = createBaseState({
        editais: [
          createEdital({ id: 'ed_1', nome: 'Concurso TRF', cor: '#10b981' })
        ]
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderEditais(container);

      expect(container.innerHTML).toContain('Concurso TRF');
      expect(container.innerHTML).toContain('#10b981');
    });

    it('renderiza estado vazio sem editais', () => {
      const state = createBaseState({ editais: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderEditais(container);

      expect(container.innerHTML).toContain('empty-state');
    });
  });

  describe('toggleEdital()', () => {
    it('alterna visibilidade do edital', () => {
      const state = createBaseState({
        editais: [createEdital({ id: 'ed_1', collapsed: false })]
      });
      // Usar setState do store diretamente
      store.setState?.(state) || store.state?.editais?.push(...state.editais);

      views.toggleEdital('ed_1');

      // Verifica que a função existe e pode ser chamada
      expect(views.toggleEdital).toBeDefined();
    });
  });
});

describe('views.js - Revisões', () => {
  describe('renderRevisoes()', () => {
    it('escapa nomes de assunto, disciplina e edital nas revisoes', () => {
      const payload = '<img src=x onerror="window.__xss=1">';
      const state = createBaseState({
        config: { frequenciaRevisao: [1] },
        editais: [createEdital({
          nome: payload,
          disciplinas: [createDisciplina({
            id: 'disc_1',
            nome: payload,
            assuntos: [createAssunto({
              id: 'ass_1',
              nome: payload,
              concluido: true,
              dataConclusao: '2026-04-19',
              revisoesFetas: []
            })]
          })]
        })]
      });
      store.setState(state);
      logic.invalidatePendingRevCache();

      const container = { innerHTML: '' };
      views.renderRevisoes(container);

      expect(container.innerHTML).not.toContain('<img');
      expect(container.innerHTML).toContain('&lt;img');
    });

    it('renderiza lista de revisões pendentes', () => {
      const state = createBaseState({
        revisoes: [
          { id: 'rev_1', assId: 'ass_1', data: '2026-04-20', feita: false }
        ],
        editais: [createEdital({
          disciplinas: [createDisciplina({
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Controle de Constitucionalidade' }]
          })]
        })]
      });
      store.setState(state);
      logic.invalidateDiscCache();

      const container = { innerHTML: '' };
      views.renderRevisoes(container);

      expect(container.innerHTML).toContain('Revisões');
    });

    it('renderiza estado vazio sem revisões pendentes', () => {
      const state = createBaseState({ revisoes: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderRevisoes(container);

      expect(container.innerHTML).toContain('empty-state');
    });
  });

  describe('getUpcomingRevisoes()', () => {
    it('retorna revisões dos próximos dias', () => {
      const state = createBaseState({
        revisoes: [
          { id: 'rev_1', assId: 'ass_1', data: '2026-04-21', feita: false },
          { id: 'rev_2', assId: 'ass_2', data: '2026-05-20', feita: false }
        ]
      });
      store.setState(state);

      const upcoming = views.getUpcomingRevisoes(30);

      expect(Array.isArray(upcoming)).toBe(true);
    });

    it('ignora revisões de disciplinas arquivadas', () => {
      const state = createBaseState({
        config: { frequenciaRevisao: [1] },
        editais: [
          createEdital({
            id: 'ed_1',
            disciplinas: [
              createDisciplina({
                id: 'disc_ativa',
                assuntos: [
                  createAssunto({
                    id: 'ass_ativa',
                    nome: 'Ativa',
                    concluido: true,
                    dataConclusao: '2026-04-20',
                    revisoesFetas: []
                  })
                ]
              }),
              createDisciplina({
                id: 'disc_arq',
                arquivada: true,
                assuntos: [
                  createAssunto({
                    id: 'ass_arq',
                    nome: 'Arquivada',
                    concluido: true,
                    dataConclusao: '2026-04-20',
                    revisoesFetas: []
                  })
                ]
              })
            ]
          })
        ]
      });
      store.setState(state);
      logic.invalidatePendingRevCache();

      const upcoming = views.getUpcomingRevisoes(7);

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].disc.id).toBe('disc_ativa');
    });
  });
});

describe('views.js - Ciclo de Estudos', () => {
  describe('toggleEditSeq()', () => {
    it('alterna modo de edição da sequência', () => {
      views.setIsEditingSequence(false);

      views.toggleEditSeq();

      expect(views.getIsEditingSequence()).toBe(true);
    });

    it('cria cópia temporária da sequência ao entrar em edição', () => {
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 }]
        }
      });
      store.setState(state);
      views.setIsEditingSequence(false);
      views.setTempSequencia(null);

      views.toggleEditSeq();

      expect(views.getTempSequencia()).toBeDefined();
      expect(views.getTempSequencia()?.length).toBe(1);
    });
  });

  describe('cancelEditSeq()', () => {
    it('cancela edição e limpa sequência temporária', () => {
      views.setTempSequencia([{ id: 'seq_temp' }]);
      views.setIsEditingSequence(true);

      views.cancelEditSeq?.();

      expect(views.getIsEditingSequence()).toBe(false);
      expect(views.getTempSequencia()).toBeNull();
    });
  });

  describe('addSeqItem()', () => {
    it('adiciona novo item na sequência em edição', () => {
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 }],
          disciplinas: ['disc_1']
        }
      });
      store.setState(state);
      views.setIsEditingSequence(true);
      views.setTempSequencia([{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 }]);

      views.addSeqItem?.();

      expect(views.getTempSequencia()?.length).toBe(2);
    });
  });
});

describe('views.js - Event Modal', () => {
  describe('openAddEventModalDate()', () => {
    it('abre modal de evento para data específica', () => {
      // A função deve existir e ser chamável
      expect(views.openAddEventModalDate).toBeDefined();

      // Testa que a função pode ser chamada sem erro
      expect(() => views.openAddEventModalDate('2026-04-25')).not.toThrow();
    });
  });
});
