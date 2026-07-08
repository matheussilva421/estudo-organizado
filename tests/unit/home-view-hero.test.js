import { describe, expect, it, vi } from 'vitest';

// Hero "PRÓXIMA AÇÃO" da Página Inicial: com plano reta_final ativo mostra o
// próximo bloco pendente do cronograma (disciplina + tópico); sem plano
// reta_final continua caindo em getNextSuggestedLesson.

function mockLogic(overrides = {}) {
  return {
    getAggregatedStats: vi.fn(() => ({ totalSeconds: 0 })),
    getPerformanceStats: vi.fn(() => ({
      questionsCorrect: 0,
      questionsWrong: 0,
      totalQuestions: 0,
    })),
    getSyllabusProgressByEdital: vi.fn(() => ({ totalAssuntos: 0, totalConcluidos: 0 })),
    getPagesReadStats: vi.fn(() => 0),
    getConsistencyStreak: vi.fn(() => ({
      currentStreak: 0,
      maxStreak: 0,
      heatmap: new Array(30).fill(false),
    })),
    getSubjectStats: vi.fn(() => []),
    getCurrentWeekStats: vi.fn(() => ({
      totalSeconds: 0,
      totalQuestions: 0,
      questionsCorrect: 0,
      questionsWrong: 0,
      totalPages: 0,
      dailySeconds: new Array(7).fill(0),
    })),
    getPreviousWeekStats: vi.fn(() => ({
      totalSeconds: 0,
      totalQuestions: 0,
      questionsCorrect: 0,
      questionsWrong: 0,
      totalPages: 0,
      dailySeconds: new Array(7).fill(0),
    })),
    getPredictiveStats: vi.fn(() => ({
      status: 'verde',
      daysRemaining: 5,
      burnRate: 0,
      projectedPerc: 0,
      suggestion: 'Sem dados suficientes.',
    })),
    getNextSuggestedLesson: vi.fn(() => null),
    getAulasWeeklyStats: vi.fn(() => ({ thisWeek: 0, prevWeek: 0, totalPending: 0 })),
    getDisciplineProgressByEdital: vi.fn(() => []),
    getDisc: vi.fn(() => null),
    ...overrides,
  };
}

function mockCommonModules({ state, logic }) {
  vi.doMock('../../src/js/store.js?v=8.37', () => ({ state }));
  vi.doMock('../../src/js/utils.js?v=8.37', () => ({
    esc: vi.fn((s) => s || ''),
    formatDate: vi.fn((s) => s),
    formatTime: vi.fn(() => '0h00'),
    todayStr: vi.fn(() => '2026-07-10'),
  }));
  vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
    filterEventsBySelectedEdital: vi.fn((events) => events),
    getSelectedEditalId: vi.fn(() => 'ed_1'),
  }));
  vi.doMock('../../src/js/logic.js?v=8.37', () => logic);
}

describe('renderHome — hero PRÓXIMA AÇÃO', () => {
  it('com reta_final ativa mostra disciplina + tópico do próximo bloco pendente', async () => {
    vi.resetModules();
    const state = {
      config: { metas: { horasSemana: 20, questoesSemana: 150 } },
      eventos: [],
      editais: [],
      planejamento: {
        ativo: true,
        tipo: 'reta_final',
        retaFinal: {
          nome: 'Reta Final TJCE',
          dataFinal: '2026-08-15',
          blocos: [
            {
              id: 'rf_done',
              data: '2026-07-10',
              discId: 'disc_1',
              topicos: [{ assId: 'ass_1', aulaId: null }],
              minutos: 60,
              status: 'concluido',
            },
            {
              id: 'rf_next',
              data: '2026-07-10',
              discId: 'disc_1',
              topicos: [{ assId: 'ass_1', aulaId: null }],
              minutos: 90,
              status: 'pendente',
            },
          ],
        },
      },
    };
    const logic = mockLogic({
      getDisc: vi.fn(() => ({
        disc: {
          id: 'disc_1',
          nome: 'Direito Penal',
          cor: '#123456',
          assuntos: [{ id: 'ass_1', nome: 'Crimes contra a vida' }],
          aulas: [],
        },
        edital: { id: 'ed_1', nome: 'TJCE', cor: '#123456' },
      })),
    });
    mockCommonModules({ state, logic });

    const { renderHome } = await import('../../src/js/views/home-view.js');
    const el = { innerHTML: '' };
    renderHome(el);

    expect(el.innerHTML).toContain('Direito Penal');
    expect(el.innerHTML).toContain('Crimes contra a vida');
    expect(logic.getNextSuggestedLesson).not.toHaveBeenCalled();
  });

  it('sem plano reta_final cai no fallback getNextSuggestedLesson', async () => {
    vi.resetModules();
    const state = {
      config: { metas: { horasSemana: 20, questoesSemana: 150 } },
      eventos: [],
      editais: [],
      planejamento: { ativo: false, tipo: null },
    };
    const logic = mockLogic({
      getNextSuggestedLesson: vi.fn(() => ({
        edital: { id: 'ed_1', nome: 'TJCE', cor: '#123456' },
        disc: { id: 'disc_1', nome: 'Português' },
        aula: { id: 'aula_1', nome: 'Crase avançada' },
      })),
    });
    mockCommonModules({ state, logic });

    const { renderHome } = await import('../../src/js/views/home-view.js');
    const el = { innerHTML: '' };
    renderHome(el);

    expect(el.innerHTML).toContain('Crase avançada');
    expect(logic.getNextSuggestedLesson).toHaveBeenCalled();
  });

  it('reta_final sem bloco pendente cai no fallback do edital', async () => {
    vi.resetModules();
    const state = {
      config: { metas: { horasSemana: 20, questoesSemana: 150 } },
      eventos: [],
      editais: [],
      planejamento: {
        ativo: true,
        tipo: 'reta_final',
        retaFinal: {
          nome: 'Reta Final TJCE',
          dataFinal: '2026-08-15',
          blocos: [
            {
              id: 'rf_done',
              data: '2026-07-10',
              discId: 'disc_1',
              topicos: [],
              minutos: 60,
              status: 'concluido',
            },
          ],
        },
      },
    };
    const logic = mockLogic({
      getNextSuggestedLesson: vi.fn(() => null),
    });
    mockCommonModules({ state, logic });

    const { renderHome } = await import('../../src/js/views/home-view.js');
    const el = { innerHTML: '' };
    renderHome(el);

    expect(logic.getNextSuggestedLesson).toHaveBeenCalled();
    expect(el.innerHTML).toContain('PRÓXIMA AÇÃO');
  });
});
