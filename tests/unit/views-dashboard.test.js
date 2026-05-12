import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views.js - dashboard, charts, history, MED', () => {
  let views;
  let storeModule;
  let appModule;
  let logicModule;
  let componentsModule;

  beforeEach(async () => {
    vi.resetModules();
    storeModule = {
      state: {
        config: {},
        editais: [],
        disciplinas: [],
        eventos: [],
        arquivo: [],
        revisoes: [],
        habitos: { questoes: [], simulado: [] },
        planejamento: { ativo: false, sequencia: [] },
      },
      scheduleSave: vi.fn(),
    };
    appModule = {
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn((msg, cb) => cb()),
      getLastSaveStatus: vi.fn(() => ({ status: 'ok' })),
      THEME_OPTIONS: [{ value: 'dark', label: 'Dark' }],
      normalizeTheme: vi.fn((t) => t || 'dark'),
      applyTheme: vi.fn(),
    };
    logicModule = {
      getDisc: vi.fn(() => ({
        disc: { id: 'disc_1', nome: 'Direito', cor: '#ff0000', icone: '📚', assuntos: [] },
        edital: { id: 'ed_1', nome: 'Edital A', cor: '#00ff00' },
      })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      syncCicloToEventos: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn(), renderEventCard: vi.fn(() => '<div class="event-card">card</div>') };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      filterEventsBySelectedEdital: vi.fn((events) => events),
      eventBelongsToSelectedEdital: vi.fn(() => true),
      disciplineBelongsToSelectedEdital: vi.fn(() => true),
      getFilteredActiveDisciplinas: vi.fn(() => []),
      getSelectedEditalId: vi.fn(() => null),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      cutoffDateStr: vi.fn((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().slice(0, 10);
      }),
      formatDate: vi.fn((s) => s),
      formatTime: vi.fn((s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`),
      uid: vi.fn(() => 'abc123'),
      HABIT_TYPES: [
        { key: 'questoes', label: 'Questões', icon: '📝', color: '#8aa4bf' },
        { key: 'simulado', label: 'Simulado', icon: '🎯', color: '#ef7777' },
      ],
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
      dashPeriod: 7,
      _chartDaily: null,
      _chartDisc: null,
      destroyDashboardCharts: vi.fn(),
      renderDashboard: vi.fn(),
      setDashPeriod: vi.fn(),
      renderDailyChart: vi.fn(),
      renderDiscChart: vi.fn(),
      renderHabitSummary: vi.fn(() => ''),
      renderDiscProgress: vi.fn(() => ''),
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

  describe('renderHistoricoSessoes()', () => {
    it('renders empty state when no sessions', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [];
      storeModule.state.arquivo = [];
      views.renderHistoricoSessoes(el);
      expect(el.innerHTML).toContain('Nenhuma sessão registrada');
    });

    it('renders sessions grouped by date', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [
        {
          id: 'e1',
          status: 'estudei',
          data: '2026-04-28',
          dataEstudo: '2026-04-28',
          discId: 'disc_1',
          tempoAcumulado: 3600,
          sessao: { questoes: { acertos: 5, erros: 2 } },
        },
      ];
      storeModule.state.arquivo = [];
      views.renderHistoricoSessoes(el);
      expect(el.innerHTML).toContain('session-history-summary');
    });

    it('includes archive events', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [];
      storeModule.state.arquivo = [
        {
          id: 'e2',
          status: 'estudei',
          data: '2026-04-27',
          dataEstudo: '2026-04-27',
          discId: 'disc_1',
          tempoAcumulado: 1800,
        },
      ];
      views.renderHistoricoSessoes(el);
      expect(el.innerHTML).toContain('session-history-summary');
    });
  });

  describe('renderMED()', () => {
    it('renders MED view with today events', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [
        {
          id: 'e1',
          status: 'estudei',
          data: '2026-04-29',
          tempoAcumulado: 3600,
          titulo: 'Estudo Manhã',
        },
      ];
      views.renderMED(el);
      expect(el.innerHTML).toContain('med-stats-row');
    });

    it('renders scheduled events section', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [
        {
          id: 'e1',
          status: 'agendado',
          data: '2026-04-29',
          titulo: 'Estudo Tarde',
        },
      ];
      views.renderMED(el);
      expect(el.innerHTML).toContain('Agendado para Hoje');
    });

    it('renders empty state when no events', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [];
      views.renderMED(el);
      expect(el.innerHTML).toContain('Nenhum evento nos próximos 7 dias');
    });

    it('filters events by today date', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [
        { id: 'e1', status: 'estudei', data: '2026-04-28', tempoAcumulado: 3600 },
      ];
      views.renderMED(el);
      expect(el.innerHTML).toContain('Nenhum evento nos próximos 7 dias');
    });

    it('groups scheduled events for today, tomorrow and next 7 days', () => {
      const el = { innerHTML: '' };
      storeModule.state.eventos = [
        { id: 'e1', status: 'agendado', data: '2026-04-29', titulo: 'Hoje' },
        { id: 'e2', status: 'agendado', data: '2026-04-30', titulo: 'Amanha' },
        { id: 'e3', status: 'agendado', data: '2026-05-04', titulo: 'Semana' },
        { id: 'e4', status: 'agendado', data: '2026-05-08', titulo: 'Fora' },
      ];
      views.renderMED(el);
      expect(el.innerHTML).toContain('Agendado para Hoje');
      expect(el.innerHTML).toContain('Amanhã');
      expect(el.innerHTML).toContain('Próximos 7 dias');
      expect(el.innerHTML).not.toContain('Fora');
    });
  });

  describe('refreshMEDSections()', () => {
    it('re-renders MED when main-content exists', () => {
      const el = { innerHTML: '' };
      vi.spyOn(document, 'getElementById').mockReturnValue(el);
      storeModule.state.eventos = [];
      views.refreshMEDSections();
      expect(el.innerHTML).toBeTruthy();
    });

    it('returns early when main-content not found', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      expect(() => views.refreshMEDSections()).not.toThrow();
    });
  });

  describe('setDashPeriod()', () => {
    it('updates dashboard period', () => {
      views.setDashPeriod(30);
      expect(views.setDashPeriod).toHaveBeenCalledWith(30);
    });

    it('handles null for all-time view', () => {
      views.setDashPeriod(null);
      expect(views.setDashPeriod).toHaveBeenCalledWith(null);
    });
  });
});
