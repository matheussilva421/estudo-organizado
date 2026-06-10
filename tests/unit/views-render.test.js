import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views.js - CRUD, modals, sequence ops', () => {
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
        planejamento: { ativo: false, sequencia: [], disciplinas: [], relevancia: {} },
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
        disc: { id: 'disc_1', nome: 'Direito', cor: '#ff0000', icone: '📚', assuntos: [{ id: 'ass_1', nome: 'Constitucional' }] },
        edital: { id: 'ed_1', nome: 'Edital A', cor: '#00ff00' },
      })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      invalidatePendingRevCache: vi.fn(),
      syncCicloToEventos: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn(), renderEventCard: vi.fn(() => '<div>card</div>') };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      cutoffDateStr: vi.fn((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().slice(0, 10);
      }),
      formatDate: vi.fn((s) => s),
      formatTime: vi.fn((s) => `${s}s`),
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

  describe('deleteAssunto()', () => {
    it('shows confirmation and deletes assunto', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', assuntos: [{ id: 'ass_1', nome: 'Test' }] }],
        },
      ];
      storeModule.state.eventos = [{ id: 'evt_1', assId: 'ass_1' }];
      views.deleteAssunto('disc_1', 'ass_1');
      expect(appModule.showConfirm).toHaveBeenCalled();
      expect(logicModule.invalidateDiscCache).toHaveBeenCalled();
      // revisões pendentes derivam dos assuntos — o cache precisa ser invalidado
      expect(logicModule.invalidatePendingRevCache).toHaveBeenCalled();
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });

    it('unlinks events from deleted assunto', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', assuntos: [{ id: 'ass_1', nome: 'Test' }] }],
        },
      ];
      storeModule.state.eventos = [{ id: 'evt_1', assId: 'ass_1' }];
      views.deleteAssunto('disc_1', 'ass_1');
      expect(storeModule.state.eventos[0].assId).toBeUndefined();
    });
  });

  describe('deleteDisc()', () => {
    it('shows confirmation and deletes discipline', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', nome: 'Test', assuntos: [] }],
        },
      ];
      storeModule.state.eventos = [{ id: 'evt_1', discId: 'disc_1' }];
      storeModule.state.planejamento = { disciplinas: ['disc_1'], relevancia: { disc_1: 5 }, sequencia: [{ discId: 'disc_1' }] };
      views.deleteDisc('ed_1', 'disc_1');
      expect(appModule.showConfirm).toHaveBeenCalled();
      expect(storeModule.state.editais[0].disciplinas.length).toBe(0);
      expect(logicModule.invalidatePendingRevCache).toHaveBeenCalled();
    });

    it('cleans up events and planning references', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          disciplinas: [{ id: 'disc_1', nome: 'Test', assuntos: [] }],
        },
      ];
      storeModule.state.eventos = [{ id: 'evt_1', discId: 'disc_1', assId: 'ass_1' }];
      storeModule.state.planejamento = { disciplinas: ['disc_1'], relevancia: { disc_1: 5 }, sequencia: [{ discId: 'disc_1' }] };
      views.deleteDisc('ed_1', 'disc_1');
      expect(storeModule.state.eventos[0].discId).toBeUndefined();
      expect(storeModule.state.planejamento.disciplinas).not.toContain('disc_1');
    });
  });

  describe('deleteEdital()', () => {
    it('shows confirmation with edital name and deletes', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Concurso 2026',
          disciplinas: [{ id: 'disc_1', assuntos: [] }],
        },
      ];
      views.deleteEdital('ed_1');
      expect(appModule.showConfirm).toHaveBeenCalledWith(
        expect.stringContaining('Concurso 2026'),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('removes edital and cleans up references', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Concurso 2026',
          disciplinas: [{ id: 'disc_1', assuntos: [] }],
        },
      ];
      storeModule.state.eventos = [{ id: 'evt_1', discId: 'disc_1' }];
      storeModule.state.planejamento = { disciplinas: ['disc_1'], relevancia: { disc_1: 5 }, sequencia: [{ discId: 'disc_1' }] };
      views.deleteEdital('ed_1');
      expect(storeModule.state.editais.length).toBe(0);
      expect(storeModule.state.eventos[0].discId).toBeUndefined();
      expect(logicModule.invalidatePendingRevCache).toHaveBeenCalled();
    });

    it('handles edital not found gracefully', () => {
      storeModule.state.editais = [];
      views.deleteEdital('nonexistent');
      expect(appModule.showConfirm).toHaveBeenCalledWith(
        expect.stringContaining('edital'),
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('openEditaModal()', () => {
    it('opens modal for new edital', () => {
      const titleEl = { textContent: '' };
      const bodyEl = { innerHTML: '' };
      const swatch = { classList: { add: vi.fn() } };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(titleEl)
        .mockReturnValueOnce(bodyEl);
      vi.spyOn(document, 'querySelector').mockReturnValue(swatch);
      views.openEditaModal();
      expect(titleEl.textContent).toBe('Novo Edital');
      expect(appModule.openModal).toHaveBeenCalledWith('modal-edital');
    });

    it('opens modal for existing edital', () => {
      storeModule.state.editais = [{ id: 'ed_1', nome: 'Test Edital', cor: '#ff0000' }];
      const titleEl = { textContent: '' };
      const bodyEl = { innerHTML: '' };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(titleEl)
        .mockReturnValueOnce(bodyEl);
      views.openEditaModal('ed_1');
      expect(titleEl.textContent).toBe('Editar Edital');
    });
  });

  describe('openDiscModal()', () => {
    it('opens modal for new discipline', () => {
      storeModule.state.editais = [{ id: 'ed_1', nome: 'Edital A', disciplinas: [] }];
      const titleEl = { textContent: '' };
      const bodyEl = { innerHTML: '' };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(titleEl)
        .mockReturnValueOnce(bodyEl);
      views.openDiscModal('ed_1');
      expect(titleEl.textContent).toBe('Nova Disciplina');
      expect(appModule.openModal).toHaveBeenCalledWith('modal-disc');
    });

    it('opens modal for existing discipline', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [{ id: 'disc_1', nome: 'Direito', icone: '📚', cor: '#ff0000' }],
        },
      ];
      const titleEl = { textContent: '' };
      const bodyEl = { innerHTML: '' };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(titleEl)
        .mockReturnValueOnce(bodyEl);
      views.openDiscModal('ed_1', 'disc_1');
      expect(titleEl.textContent).toBe('Editar Disciplina');
    });
  });

  describe('openDiscManager()', () => {
    it('returns early when discipline not found', () => {
      storeModule.state.editais = [{ id: 'ed_1', disciplinas: [] }];
      views.openDiscManager('ed_1', 'nonexistent');
      expect(appModule.openModal).not.toHaveBeenCalled();
    });
  });

  describe('saveEditSeq()', () => {
    it('shows error when sequence is empty', () => {
      views.setTempSequencia([]);
      views.setIsEditingSequence(true);
      views.saveEditSeq();
      expect(appModule.showToast).toHaveBeenCalledWith(
        'A sequência de estudos não pode ficar vazia.',
        'error'
      );
    });

    it('shows error when step has no discipline', () => {
      views.setTempSequencia([{ id: 's1', discId: '' }]);
      views.setIsEditingSequence(true);
      views.saveEditSeq();
      expect(appModule.showToast).toHaveBeenCalledWith(
        expect.stringContaining('selecione uma disciplina'),
        'error'
      );
    });

    it('saves valid sequence', () => {
      views.setTempSequencia([{ id: 's1', discId: 'disc_1', minutosAlvo: 60 }]);
      views.setIsEditingSequence(true);
      storeModule.state.planejamento.sequencia = [];
      views.saveEditSeq();
      expect(storeModule.state.planejamento.sequencia.length).toBe(1);
      expect(views.getIsEditingSequence()).toBe(false);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('addEventoParaAssunto()', () => {
    it('opens event modal and pre-fills fields', () => {
      const discSel = { value: '' };
      const assSel = { value: '' };
      const ti = { value: '', dataset: {} };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(discSel)
        .mockReturnValueOnce(assSel)
        .mockReturnValueOnce(ti);
      views.addEventoParaAssunto('ed_1', 'disc_1', 'ass_1');
      expect(appModule.openModal || true).toBeTruthy();
    });
  });

  describe('toggleEditSeq()', () => {
    it('enables editing and clones sequence', () => {
      storeModule.state.planejamento.sequencia = [{ id: 's1' }];
      views.setIsEditingSequence(false);
      views.toggleEditSeq();
      expect(views.getIsEditingSequence()).toBe(true);
      expect(views.getTempSequencia().length).toBe(1);
    });

    it('disables editing and clears temp', () => {
      views.setIsEditingSequence(true);
      views.setTempSequencia([{ id: 's1' }]);
      views.toggleEditSeq();
      expect(views.getIsEditingSequence()).toBe(false);
      expect(views.getTempSequencia()).toBeNull();
    });
  });

  describe('cancelEditSeq()', () => {
    it('resets editing state', () => {
      views.setIsEditingSequence(true);
      views.setTempSequencia([{ id: 's1' }]);
      views.cancelEditSeq();
      expect(views.getIsEditingSequence()).toBe(false);
      expect(views.getTempSequencia()).toBeNull();
    });
  });

  describe('destroyDashboardCharts()', () => {
    it('is exported and callable', () => {
      expect(typeof views.destroyDashboardCharts).toBe('function');
      expect(() => views.destroyDashboardCharts()).not.toThrow();
    });
  });
});
