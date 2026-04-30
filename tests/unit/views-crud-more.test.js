import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views.js - CRUD, inline editing, dashboard ops', () => {
  let views;
  let storeModule;
  let appModule;
  let logicModule;
  let componentsModule;
  let dashboardCtx;

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
        disc: { id: 'disc_1', nome: 'Direito', cor: '#ff0000', icone: '📚', assuntos: [], aulas: [] },
        edital: { id: 'ed_1', nome: 'Edital A', cor: '#00ff00' },
      })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      syncCicloToEventos: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn(), renderEventCard: vi.fn(() => '<div>card</div>') };
    dashboardCtx = {
      getActiveDashboardDiscCtx: vi.fn(() => null),
      setActiveDashboardDiscCtx: vi.fn(),
      clearActiveDashboardDiscCtx: vi.fn(),
      setActiveDashboardTab: vi.fn(),
      resetActiveDashboardTab: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.31', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.31', () => appModule);
    vi.doMock('../../src/js/logic.js?v=8.31', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.31', () => componentsModule);
    vi.doMock('../../src/js/utils.js?v=8.31', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      cutoffDateStr: vi.fn((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().slice(0, 10);
      }),
      formatDate: vi.fn((s) => s),
      formatTime: vi.fn((s) => `${Math.floor(s / 3600)}h`),
      uid: vi.fn(() => 'abc123'),
      HABIT_TYPES: [
        { key: 'questoes', label: 'Questões', icon: '📝', color: '#8aa4bf' },
        { key: 'simulado', label: 'Simulado', icon: '🎯', color: '#ef7777' },
      ],
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.31', () => dashboardCtx);
    vi.doMock('../../src/js/ui/event-modals.js?v=8.31', () => ({
      openAddEventModal: vi.fn(),
      loadAssuntos: vi.fn(),
    }));
    vi.doMock('../../src/js/views/dashboard-view.js', () => ({
      renderDisciplinaDashboard: vi.fn(() => '<div>dashboard</div>'),
    }));
    vi.doMock('../../src/js/views/editais-view.js', () => ({
      renderVerticalList: vi.fn(),
    }));
    vi.doMock('../../src/js/state/chart-state.js?v=8.31', () => ({
      setDiscChartInstance: vi.fn(),
      getDiscChartInstance: vi.fn(() => null),
    }));

    views = await import('../../src/js/views.js?v=8.31');
  });

  describe('toggleAssunto()', () => {
    it('marks assunto as completed', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Constitucional', concluido: false }],
          }],
        },
      ];
      views.toggleAssunto('disc_1', 'ass_1');
      expect(storeModule.state.editais[0].disciplinas[0].assuntos[0].concluido).toBe(true);
      expect(storeModule.state.editais[0].disciplinas[0].assuntos[0].dataConclusao).toBe('2026-04-29');
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });

    it('unmarks assunto when already completed', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Constitucional', concluido: true }],
          }],
        },
      ];
      views.toggleAssunto('disc_1', 'ass_1');
      expect(storeModule.state.editais[0].disciplinas[0].assuntos[0].concluido).toBe(false);
      expect(storeModule.state.editais[0].disciplinas[0].assuntos[0].dataConclusao).toBeNull();
    });

    it('clears revisoesFetas when completing', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Constitucional', concluido: false, revisoesFetas: [1, 2] }],
          }],
        },
      ];
      views.toggleAssunto('disc_1', 'ass_1');
      expect(storeModule.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas).toEqual([]);
    });

    it('does nothing when assunto not found', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', assuntos: [] }],
        },
      ];
      views.toggleAssunto('disc_1', 'nonexistent');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe('toggleAulaDashboard()', () => {
    it('marks aula as studied', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{
            id: 'disc_1',
            aulas: [{ id: 'aula_1', nome: 'Aula 1', estudada: false }],
          }],
        },
      ];
      views.toggleAulaDashboard('ed_1', 'disc_1', 'aula_1');
      expect(storeModule.state.editais[0].disciplinas[0].aulas[0].estudada).toBe(true);
      expect(storeModule.state.editais[0].disciplinas[0].aulas[0].dataEstudo).toBe('2026-04-29');
      expect(appModule.showToast).toHaveBeenCalledWith('Aula marcada como estudada.', 'success');
    });

    it('unmarks aula when already studied', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{
            id: 'disc_1',
            aulas: [{ id: 'aula_1', nome: 'Aula 1', estudada: true }],
          }],
        },
      ];
      views.toggleAulaDashboard('ed_1', 'disc_1', 'aula_1');
      expect(storeModule.state.editais[0].disciplinas[0].aulas[0].estudada).toBe(false);
      expect(storeModule.state.editais[0].disciplinas[0].aulas[0].dataEstudo).toBeNull();
      expect(appModule.showToast).toHaveBeenCalledWith('Aula desmarcada.', 'success');
    });

    it('does nothing when aula not found', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', aulas: [] }],
        },
      ];
      views.toggleAulaDashboard('ed_1', 'disc_1', 'nonexistent');
      expect(appModule.showToast).not.toHaveBeenCalled();
    });
  });

  describe('toggleAulaEstudada()', () => {
    it('does nothing when disc not found', () => {
      logicModule.getDisc.mockReturnValue(null);
      views.toggleAulaEstudada('disc_1', 'aula_1');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });

    it('does nothing when aula not found', () => {
      logicModule.getDisc.mockReturnValue({
        disc: { id: 'disc_1', aulas: [] },
        edital: {},
      });
      views.toggleAulaEstudada('disc_1', 'aula_1');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe('addBulkAulas()', () => {
    it('shows error when textarea is empty', () => {
      const textarea = { value: '' };
      vi.spyOn(document, 'getElementById').mockReturnValue(textarea);
      views.addBulkAulas('disc_1');
      expect(appModule.showToast).toHaveBeenCalledWith('Nenhum texto de aula encontrado.', 'error');
    });

    it('returns early when textarea not found', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      views.addBulkAulas('disc_1');
      expect(appModule.showToast).not.toHaveBeenCalled();
    });
  });

  describe('addAssunto()', () => {
    it('returns early when disc not found', () => {
      const inputEl = { value: 'Test' };
      vi.spyOn(document, 'getElementById').mockReturnValue(inputEl);
      logicModule.getDisc.mockReturnValue(null);
      views.addAssunto('disc_1');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe('deleteAula()', () => {
    it('exists and is callable', () => {
      expect(typeof views.deleteAula).toBe('function');
    });
  });

  describe('editSubjectInline()', () => {
    it('creates input element and replaces content', () => {
      const el = {
        innerText: 'Old Name',
        innerHTML: '',
        appendChild: vi.fn(),
      };
      const input = {
        type: '',
        value: '',
        style: {},
        focus: vi.fn(),
        onblur: null,
        onkeydown: null,
      };
      vi.spyOn(document, 'createElement').mockReturnValue(input);
      views.editSubjectInline('disc_1', 'ass_1', el);
      expect(el.innerHTML).toBe('');
      expect(el.appendChild).toHaveBeenCalledWith(input);
      expect(input.focus).toHaveBeenCalled();
    });
  });

  describe('editLessonInline()', () => {
    it('creates input for lesson editing', () => {
      logicModule.getDisc.mockReturnValue({
        disc: {
          id: 'disc_1',
          aulas: [{ id: 'aula_1', nome: 'Aula Test' }],
        },
        edital: {},
      });
      const el = { innerHTML: '', appendChild: vi.fn() };
      const input = {
        type: '', value: '', className: '', style: {},
        focus: vi.fn(), select: vi.fn(),
        onblur: null, onkeydown: null,
      };
      vi.spyOn(document, 'createElement').mockReturnValue(input);
      views.editLessonInline('disc_1', 'aula_1', el);
      expect(el.appendChild).toHaveBeenCalledWith(input);
      expect(input.focus).toHaveBeenCalled();
      expect(input.select).toHaveBeenCalled();
    });

    it('returns early when aula not found', () => {
      logicModule.getDisc.mockReturnValue({
        disc: { id: 'disc_1', aulas: [] },
        edital: {},
      });
      views.editLessonInline('disc_1', 'nonexistent', { innerHTML: '', appendChild: vi.fn() });
    });
  });

  describe('switchManagerTab()', () => {
    it('updates active tab', () => {
      views.switchManagerTab('aulas');
      expect(views.getActiveDiscManagerTab()).toBe('aulas');
    });
  });

  describe('saveDiscManager()', () => {
    it('returns early when edital not found', () => {
      storeModule.state.editais = [];
      views.saveDiscManager('nonexistent', 'disc_1');
      expect(appModule.showToast).not.toHaveBeenCalled();
    });

    it('returns early when discipline not found', () => {
      storeModule.state.editais = [{ id: 'ed_1', disciplinas: [] }];
      views.saveDiscManager('ed_1', 'nonexistent');
      expect(appModule.showToast).not.toHaveBeenCalled();
    });
  });

  describe('moveSubject()', () => {
    it('exists and is callable', () => {
      expect(typeof views.moveSubject).toBe('function');
    });
  });

  describe('closeDiscDashboard()', () => {
    it('clears context and re-renders', () => {
      views.closeDiscDashboard();
      expect(dashboardCtx.clearActiveDashboardDiscCtx).toHaveBeenCalled();
      expect(dashboardCtx.resetActiveDashboardTab).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('switchDashboardTab()', () => {
    it('updates tab and re-renders when context is invalid', () => {
      dashboardCtx.getActiveDashboardDiscCtx.mockReturnValue(null);
      views.switchDashboardTab('topicos');
      expect(dashboardCtx.setActiveDashboardTab).toHaveBeenCalledWith('topicos');
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });
});
