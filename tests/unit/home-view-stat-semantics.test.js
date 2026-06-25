import { describe, expect, it, vi } from 'vitest';

describe('home stat semantics', () => {
  it('renders pending lessons as neutral detail, not negative/error detail', async () => {
    vi.resetModules();

    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      state: {
        config: { metas: { horasSemana: 20, questoesSemana: 150 } },
        eventos: [],
      },
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      formatDate: vi.fn((s) => s),
      formatTime: vi.fn((seconds) => `${Math.floor(seconds / 3600)}h00`),
    }));
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      filterEventsBySelectedEdital: vi.fn((events) => events),
      getSelectedEditalId: vi.fn(() => 'ed_1'),
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getAggregatedStats: vi.fn(() => ({ totalSeconds: 0 })),
      getPerformanceStats: vi.fn(() => ({
        questionsCorrect: 4,
        questionsWrong: 1,
        totalQuestions: 5,
      })),
      getSyllabusProgressByEdital: vi.fn(() => ({
        totalAssuntos: 3,
        totalConcluidos: 1,
      })),
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
      getAulasWeeklyStats: vi.fn(() => ({ thisWeek: 0, prevWeek: 0, totalPending: 2 })),
      getDisciplineProgressByEdital: vi.fn(() => [
        {
          edital: {
            id: 'ed_1',
            disciplinas: [
              { aulas: [{ estudada: true }, { estudada: false }, { estudada: false }] },
            ],
          },
          disciplinas: [],
        },
      ]),
    }));

    const { renderHome } = await import('../../src/js/views/home-view.js');
    const el = { innerHTML: '' };

    renderHome(el);

    expect(el.innerHTML).toContain('Aulas Pendentes');
    expect(el.innerHTML).toContain('dashboard-stat-detail--neutral');
    expect(el.innerHTML).not.toMatch(/dashboard-stat-detail--negative">[^<]*Aulas Pendentes/);
  });
});
