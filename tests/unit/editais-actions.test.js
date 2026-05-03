import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/editais.js', () => {
  let registerAction;
  let appModule;
  let componentsModule;
  let logicModule;
  let storeModule;
  let viewsModule;
  let bancaView;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    appModule = { showConfirm: vi.fn(), showToast: vi.fn() };
    componentsModule = { renderCurrentView: vi.fn() };
    logicModule = { archiveDiscipline: vi.fn(), unarchiveDiscipline: vi.fn() };
    storeModule = { scheduleSave: vi.fn() };
    viewsModule = {
      openEditaModal: vi.fn(),
      saveEdital: vi.fn(),
      deleteEdital: vi.fn(),
      openDiscModal: vi.fn(),
      saveDisc: vi.fn(),
      deleteDisc: vi.fn(),
      openDiscManager: vi.fn(),
      addAssunto: vi.fn(),
      deleteAssunto: vi.fn(),
      editSubjectInline: vi.fn(),
      addBulkAulas: vi.fn(),
      deleteAula: vi.fn(),
      toggleAulaEstudada: vi.fn(),
      editLessonInline: vi.fn(),
      selectColor: vi.fn(),
      selectIcon: vi.fn(),
      selectDiscColor: vi.fn(),
      toggleEdital: vi.fn(),
      toggleVertDisc: vi.fn(),
      toggleAssunto: vi.fn(),
      runLessonMapperUI: vi.fn(),
      switchManagerTab: vi.fn(),
      setDiscFilterStatus: vi.fn(),
      openDiscDashboard: vi.fn(),
      addEventoParaAssunto: vi.fn(),
      toggleAulaDashboard: vi.fn(),
      switchDashboardTab: vi.fn(),
      setVertSearch: vi.fn(),
      setVertFilterEdital: vi.fn(),
      setVertFilterStatus: vi.fn(),
      renderVerticalList: vi.fn(),
      filtrarDropdownBanca: vi.fn(),
    };
    bancaView = {
      parseBancaText: vi.fn(),
      applyBancaRanking: vi.fn(),
      filtrarViewPorDisciplina: vi.fn(),
      mudarEditalAnalisador: vi.fn(),
      carregarAnaliseBanca: vi.fn(),
      excluirAnaliseBanca: vi.fn(),
      openMatchCorrector: vi.fn(),
      saveMatchCorrection: vi.fn(),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/app.js?v=8.34', () => appModule);
    vi.doMock('../../src/js/components.js?v=8.34', () => componentsModule);
    vi.doMock('../../src/js/logic.js?v=8.34', () => logicModule);
    vi.doMock('../../src/js/store.js?v=8.34', () => storeModule);
    vi.doMock('../../src/js/views.js?v=8.34', () => viewsModule);
    vi.doMock('../../src/js/views/banca-view.js?v=8.34', () => bancaView);

    await import('../../src/js/ui/actions/editais.js');
  });

  it('registers edital actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('open-edital-modal');
    expect(calls).toContain('save-edital');
    expect(calls).toContain('delete-edital');
    expect(calls).toContain('open-disc-modal');
    expect(calls).toContain('save-disc');
    expect(calls).toContain('delete-disc');
    expect(calls).toContain('archive-disc');
    expect(calls).toContain('unarchive-disc');
    expect(calls).toContain('set-disc-filter');
    expect(calls).toContain('open-disc-dashboard');
    expect(calls).toContain('open-disc-manager');
    expect(calls).toContain('add-assunto');
    expect(calls).toContain('delete-assunto');
    expect(calls).toContain('edit-subject-inline');
    expect(calls).toContain('add-bulk-aulas');
    expect(calls).toContain('delete-aula');
    expect(calls).toContain('toggle-aula-estudada');
    expect(calls).toContain('edit-lesson-inline');
    expect(calls).toContain('select-color');
    expect(calls).toContain('select-icon');
    expect(calls).toContain('select-disc-color');
    expect(calls).toContain('toggle-edital');
    expect(calls).toContain('toggle-vert-disc');
    expect(calls).toContain('toggle-assunto');
    expect(calls).toContain('run-lesson-mapper');
    expect(calls).toContain('switch-manager-tab');
    expect(calls).toContain('add-evento-para-assunto');
    expect(calls).toContain('toggle-aula-dashboard');
    expect(calls).toContain('switch-dashboard-tab');
    expect(calls).toContain('vert-search');
    expect(calls).toContain('set-vert-filter-edital');
    expect(calls).toContain('set-vert-filter-status');
    expect(calls).toContain('filtrar-dropdown-banca');
    expect(calls).toContain('parse-banca-text');
    expect(calls).toContain('apply-banca-ranking');
    expect(calls).toContain('filtrar-view-por-disciplina');
    expect(calls).toContain('mudar-edital-analisador');
    expect(calls).toContain('carregar-analise-banca');
    expect(calls).toContain('excluir-analise-banca');
    expect(calls).toContain('open-match-corrector');
    expect(calls).toContain('save-match-correction');
  });

  it('open-edital-modal handler passes editalId or null', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-edital-modal')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(viewsModule.openEditaModal).toHaveBeenCalledWith('ed_1');
  });

  it('open-edital-modal handler passes null when no editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-edital-modal')[1];
    handler({ dataset: {} });
    expect(viewsModule.openEditaModal).toHaveBeenCalledWith(null);
  });

  it('save-edital handler passes editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-edital')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(viewsModule.saveEdital).toHaveBeenCalledWith('ed_1');
  });

  it('delete-edital handler shows confirmation', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-edital')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('delete-edital handler skips when no editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-edital')[1];
    handler({ dataset: {} });
    expect(appModule.showConfirm).not.toHaveBeenCalled();
  });

  it('open-disc-modal handler passes editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-disc-modal')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(viewsModule.openDiscModal).toHaveBeenCalledWith('ed_1');
  });

  it('open-disc-modal handler skips when no editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-disc-modal')[1];
    handler({ dataset: {} });
    expect(viewsModule.openDiscModal).not.toHaveBeenCalled();
  });

  it('save-disc handler is saveDisc directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-disc')[1];
    expect(handler).toBe(viewsModule.saveDisc);
  });

  it('delete-disc handler shows confirmation with editalId and discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-disc')[1];
    handler({ dataset: { editalId: 'ed_1', discId: 'disc_1' } });
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('delete-disc handler skips when missing ids', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-disc')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(appModule.showConfirm).not.toHaveBeenCalled();
  });

  it('archive-disc handler shows confirmation', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'archive-disc')[1];
    handler({ dataset: { editalId: 'ed_1', discId: 'disc_1' } });
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('unarchive-disc handler calls unarchiveDiscipline', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'unarchive-disc')[1];
    handler({ dataset: { editalId: 'ed_1', discId: 'disc_1' } });
    expect(logicModule.unarchiveDiscipline).toHaveBeenCalledWith('ed_1', 'disc_1');
  });

  it('set-disc-filter handler passes filter', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-disc-filter')[1];
    handler({ dataset: { filter: 'arquivadas' } });
    expect(viewsModule.setDiscFilterStatus).toHaveBeenCalledWith('arquivadas');
  });

  it('add-assunto handler passes discId only', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'add-assunto')[1];
    handler({ dataset: { discId: 'disc_1' } });
    expect(viewsModule.addAssunto).toHaveBeenCalledWith('disc_1');
  });

  it('delete-assunto handler passes discId and assuntoId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-assunto')[1];
    handler({ dataset: { discId: 'disc_1', assuntoId: 'ass_1' } });
    expect(viewsModule.deleteAssunto).toHaveBeenCalledWith('disc_1', 'ass_1');
  });

  it('toggle-aula-estudada handler passes discId and aulaId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-aula-estudada')[1];
    handler({ dataset: { discId: 'disc_1', aulaId: 'aula_1' } });
    expect(viewsModule.toggleAulaEstudada).toHaveBeenCalledWith('disc_1', 'aula_1');
  });

  it('edit-subject-inline handler passes discId, assuntoId, and element', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'edit-subject-inline')[1];
    const el = { dataset: { discId: 'disc_1', assuntoId: 'ass_1' } };
    handler(el);
    expect(viewsModule.editSubjectInline).toHaveBeenCalledWith('disc_1', 'ass_1', el);
  });

  it('edit-lesson-inline handler passes discId, aulaId, and element', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'edit-lesson-inline')[1];
    const el = { dataset: { discId: 'disc_1', aulaId: 'aula_1' } };
    handler(el);
    expect(viewsModule.editLessonInline).toHaveBeenCalledWith('disc_1', 'aula_1', el);
  });

  it('select-color handler passes color and container', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'select-color')[1];
    handler({ dataset: { color: '#ff0000', container: 'disc' } });
    expect(viewsModule.selectColor).toHaveBeenCalledWith('#ff0000', 'disc');
  });

  it('select-icon handler passes icon and element', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'select-icon')[1];
    const el = { dataset: { icon: '📚' } };
    handler(el);
    expect(viewsModule.selectIcon).toHaveBeenCalledWith('📚', el);
  });

  it('toggle-edital handler passes editalId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-edital')[1];
    handler({ dataset: { editalId: 'ed_1' } });
    expect(viewsModule.toggleEdital).toHaveBeenCalledWith('ed_1');
  });

  it('switch-manager-tab handler passes tab', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'switch-manager-tab')[1];
    handler({ dataset: { tab: 'questoes' } });
    expect(viewsModule.switchManagerTab).toHaveBeenCalledWith('questoes');
  });

  it('vert-search handler passes search value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'vert-search')[1];
    handler({ value: 'direito' });
    expect(viewsModule.setVertSearch).toHaveBeenCalledWith('direito');
  });

  it('set-vert-filter-edital handler passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-vert-filter-edital')[1];
    handler({ value: 'ed_1' });
    expect(viewsModule.setVertFilterEdital).toHaveBeenCalledWith('ed_1');
  });

  it('set-vert-filter-status handler passes status', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-vert-filter-status')[1];
    handler({ dataset: { status: 'ativas' } });
    expect(viewsModule.setVertFilterStatus).toHaveBeenCalledWith('ativas');
  });

  it('open-disc-dashboard handler passes editalId and discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-disc-dashboard')[1];
    handler({ dataset: { editalId: 'ed_1', discId: 'disc_1' } });
    expect(viewsModule.openDiscDashboard).toHaveBeenCalledWith('ed_1', 'disc_1');
  });

  it('switch-dashboard-tab handler passes tab', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'switch-dashboard-tab')[1];
    handler({ dataset: { tab: 'assuntos' } });
    expect(viewsModule.switchDashboardTab).toHaveBeenCalledWith('assuntos');
  });

  it('parse-banca-text handler is parseBancaText directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'parse-banca-text')[1];
    expect(handler).toBe(bancaView.parseBancaText);
  });

  it('apply-banca-ranking handler is applyBancaRanking directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'apply-banca-ranking')[1];
    expect(handler).toBe(bancaView.applyBancaRanking);
  });

  it('mudar-edital-analisador handler is mudarEditalAnalisador directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'mudar-edital-analisador')[1];
    expect(handler).toBe(bancaView.mudarEditalAnalisador);
  });
});
