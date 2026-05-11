import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('editais colors and ordering', () => {
  let views;
  let editaisView;
  let storeModule;
  let componentsModule;
  let appModule;

  beforeEach(async () => {
    vi.resetModules();

    storeModule = {
      state: {
        config: {},
        editais: [],
        eventos: [],
        arquivo: [],
        revisoes: [],
        habitos: { questoes: [], simulado: [] },
        planejamento: { ativo: false, sequencia: [], disciplinas: [], relevancia: {} },
      },
      scheduleSave: vi.fn(),
    };
    componentsModule = {
      renderCurrentView: vi.fn(),
      renderEventCard: vi.fn(() => '<div>card</div>'),
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
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisc: vi.fn(),
      getDisciplinaById: vi.fn(),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      calculateContentProgress: vi.fn(() => ({
        topics: { done: 0, total: 0, pct: 0 },
        lessons: { done: 0, total: 0, pct: 0 },
        overall: { done: 0, total: 0, pct: 0 },
      })),
      syncCicloToEventos: vi.fn(),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((value) => value || ''),
      todayStr: vi.fn(() => '2026-05-04'),
      cutoffDateStr: vi.fn(() => '2026-04-29'),
      formatDate: vi.fn((value) => value),
      formatTime: vi.fn((value) => `${value}s`),
      uid: vi.fn(() => 'ed_new'),
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
    vi.doMock('../../src/js/state/chart-state.js?v=8.37', () => ({
      setDiscChartInstance: vi.fn(),
      getDiscChartInstance: vi.fn(() => null),
    }));

    views = await import('../../src/js/views.js?v=8.37');
    editaisView = await import('../../src/js/views/editais-view.js?v=8.37');
  });

  it('renders visible color swatches when opening the edital modal', () => {
    const titleEl = { textContent: '' };
    const bodyEl = { innerHTML: '' };
    const firstSwatch = { classList: { add: vi.fn() } };
    vi.spyOn(document, 'getElementById')
      .mockReturnValueOnce(titleEl)
      .mockReturnValueOnce(bodyEl);
    vi.spyOn(document, 'querySelector').mockReturnValue(firstSwatch);

    views.openEditaModal();

    expect(bodyEl.innerHTML).toContain('style="background:#8aa4bf;"');
    expect(bodyEl.innerHTML).toContain('data-color-value="#8aa4bf"');
    expect(firstSwatch.classList.add).toHaveBeenCalledWith('selected');
    expect(appModule.openModal).toHaveBeenCalledWith('modal-edital');
  });

  it('renders edital ordering controls on edital cards', () => {
    storeModule.state.editais = [
      { id: 'ed_1', nome: 'TCE - RN', cor: '#8aa4bf', disciplinas: [] },
      { id: 'ed_2', nome: 'PGE-RN', cor: '#7dd3a8', disciplinas: [] },
    ];

    const html = editaisView.renderEditalTree(storeModule.state.editais[1]);

    expect(html).toContain('data-action="move-edital"');
    expect(html).toContain('data-dir="-1"');
    expect(html).toContain('data-dir="1"');
  });

  it('moves editais up and down while preserving bounds', () => {
    storeModule.state.editais = [
      { id: 'ed_1', nome: 'TCE - RN', disciplinas: [] },
      { id: 'ed_2', nome: 'PGE-RN', disciplinas: [] },
      { id: 'ed_3', nome: 'TRF', disciplinas: [] },
    ];

    views.moveEdital('ed_2', -1);
    expect(storeModule.state.editais.map((edital) => edital.id)).toEqual(['ed_2', 'ed_1', 'ed_3']);

    views.moveEdital('ed_2', -1);
    expect(storeModule.state.editais.map((edital) => edital.id)).toEqual(['ed_2', 'ed_1', 'ed_3']);

    views.moveEdital('ed_2', 1);
    expect(storeModule.state.editais.map((edital) => edital.id)).toEqual(['ed_1', 'ed_2', 'ed_3']);
    expect(storeModule.scheduleSave).toHaveBeenCalledTimes(2);
    expect(componentsModule.renderCurrentView).toHaveBeenCalledTimes(2);
  });

  it('closes the discipline manager after saving global discipline changes', () => {
    document.body.innerHTML = `
      <input id="dm-nome" value="Direito Administrativo Atualizado">
      <select id="dm-cor"><option value="#7dd3a8" selected>#7dd3a8</option></select>
      <div id="modal-disc-manager-title"></div>
      <div id="modal-disc-manager-body"></div>
    `;
    storeModule.state.editais = [
      {
        id: 'ed_1',
        nome: 'TCE - RN',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Administrativo',
            cor: '#8aa4bf',
            assuntos: [{ id: 'ass_1', nome: 'Atos administrativos' }],
            aulas: [],
          },
        ],
      },
    ];

    views.saveDiscManager('ed_1', 'disc_1');

    expect(storeModule.state.editais[0].disciplinas[0]).toMatchObject({
      nome: 'Direito Administrativo Atualizado',
      cor: '#7dd3a8',
    });
    expect(storeModule.scheduleSave).toHaveBeenCalledTimes(1);
    expect(appModule.closeModal).toHaveBeenCalledWith('modal-disc-manager');
    expect(componentsModule.renderCurrentView).toHaveBeenCalledTimes(1);
    expect(appModule.showToast).toHaveBeenCalledWith('Disciplina atualizada!', 'success');
  });

  it('saves the color selected from the discipline manager color picker', () => {
    document.body.innerHTML = `
      <input id="dm-nome" value="Direito Administrativo">
      <input id="dm-cor-picker" type="color" value="#ef7777">
      <select id="dm-cor"><option value="#8aa4bf" selected>#8aa4bf</option></select>
    `;
    storeModule.state.editais = [
      {
        id: 'ed_1',
        nome: 'TCE - RN',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Administrativo',
            cor: '#8aa4bf',
            assuntos: [],
            aulas: [],
          },
        ],
      },
    ];

    views.saveDiscManager('ed_1', 'disc_1');

    expect(storeModule.state.editais[0].disciplinas[0].cor).toBe('#ef7777');
  });
});
