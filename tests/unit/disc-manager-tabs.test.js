import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('discipline manager tabs', () => {
  let views;
  let storeModule;
  let appModule;

  beforeEach(async () => {
    vi.resetModules();

    storeModule = {
      state: {
        config: {},
        editais: [
          {
            id: 'ed_1',
            disciplinas: [
              {
                id: 'disc_1',
                nome: 'Direito Administrativo',
                cor: '#8aa4bf',
                assuntos: [{ id: 'ass_1', nome: 'Atos administrativos' }],
                aulas: [{ id: 'aula_1', nome: 'Aula 01 - Atos administrativos' }],
              },
            ],
          },
        ],
        eventos: [],
        arquivo: [],
        revisoes: [],
        habitos: { questoes: [], simulado: [] },
        planejamento: { ativo: false, sequencia: [], disciplinas: [], relevancia: {} },
      },
      scheduleSave: vi.fn(),
    };
    appModule = {
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn((message, callback) => callback()),
      getLastSaveStatus: vi.fn(() => ({ status: 'ok' })),
      THEME_OPTIONS: [{ value: 'grafite', label: 'Grafite' }],
      normalizeTheme: vi.fn((theme) => theme || 'grafite'),
      applyTheme: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisc: vi.fn(() => ({
        disc: storeModule.state.editais[0].disciplinas[0],
        edital: storeModule.state.editais[0],
      })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      syncCicloToEventos: vi.fn(),
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
      renderEventCard: vi.fn(() => '<div>card</div>'),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((value) => value || ''),
      todayStr: vi.fn(() => '2026-05-04'),
      cutoffDateStr: vi.fn(() => '2026-04-29'),
      formatDate: vi.fn((value) => value),
      formatTime: vi.fn((value) => `${value}s`),
      uid: vi.fn(() => 'abc123'),
      HABIT_TYPES: [],
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      getActiveDashboardDiscCtx: vi.fn(() => null),
      setActiveDashboardDiscCtx: vi.fn(),
      clearActiveDashboardDiscCtx: vi.fn(),
      setActiveDashboardTab: vi.fn(),
      resetActiveDashboardTab: vi.fn(),
    }));
    vi.doMock('../../src/js/ui/event-modals.js?v=8.37', () => ({
      openAddEventModal: vi.fn(),
      loadAssuntos: vi.fn(),
    }));
    vi.doMock('../../src/js/views/dashboard-view.js', () => ({
      renderDisciplinaDashboard: vi.fn(),
    }));
    vi.doMock('../../src/js/views/editais-view.js', () => ({
      renderVerticalList: vi.fn(),
    }));
    vi.doMock('../../src/js/state/chart-state.js?v=8.37', () => ({
      setDiscChartInstance: vi.fn(),
      getDiscChartInstance: vi.fn(() => null),
    }));

    views = await import('../../src/js/views.js?v=8.37');
  });

  it('marks the active topics tab as visible when editing a discipline', () => {
    const titleEl = { textContent: '' };
    const bodyEl = { innerHTML: '' };
    vi.spyOn(document, 'getElementById')
      .mockReturnValueOnce(titleEl)
      .mockReturnValueOnce(bodyEl);

    views.openDiscManager('ed_1', 'disc_1');

    expect(bodyEl.innerHTML).toContain('id="tab-manager-topicos" class="tab-content active"');
    expect(bodyEl.innerHTML).toContain('Atos administrativos');
    expect(appModule.openModal).toHaveBeenCalledWith('modal-disc-manager');
  });
});
