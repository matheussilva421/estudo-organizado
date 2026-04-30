import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/modais.js', () => {
  let registerAction;
  let appModule;
  let registroSessao;
  let eventModals;
  let planejamentoWizard;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    appModule = { closeModal: vi.fn() };
    registroSessao = {
      onDisciplinaChange: vi.fn(),
      onAulaChange: vi.fn(),
      toggleStudyType: vi.fn(),
      toggleMaterial: vi.fn(),
      addNovoTopico: vi.fn(),
      validateQuestoes: vi.fn(),
      saveRegistroSessao: vi.fn(),
      saveAndStartNew: vi.fn(),
      setPaginaMode: vi.fn(),
      openRegistroSessao: vi.fn(),
    };
    eventModals = { openAddPastSessionModal: vi.fn() };
    planejamentoWizard = { openPlanejamentoWizard: vi.fn() };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/app.js?v=8.32', () => appModule);
    vi.doMock('../../src/js/registro-sessao.js?v=8.32', () => registroSessao);
    vi.doMock('../../src/js/ui/event-modals.js?v=8.32', () => eventModals);
    vi.doMock('../../src/js/planejamento-wizard.js?v=8.32', () => planejamentoWizard);

    await import('../../src/js/ui/actions/modais.js');
  });

  it('registers modal actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('close-modal');
    expect(calls).toContain('open-planejamento-wizard');
    expect(calls).toContain('open-registro-sessao');
    expect(calls).toContain('open-add-past-session');
    expect(calls).toContain('on-disciplina-change');
    expect(calls).toContain('on-aula-change');
    expect(calls).toContain('toggle-study-type');
    expect(calls).toContain('toggle-material');
    expect(calls).toContain('add-novo-topico');
    expect(calls).toContain('validate-questoes');
    expect(calls).toContain('save-registro-sessao');
    expect(calls).toContain('save-and-start-new');
    expect(calls).toContain('set-pagina-mode');
    expect(calls).toContain('stop-propagation');
  });

  it('close-modal handler calls closeModal with modal name', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'close-modal')[1];
    handler({ dataset: { modal: 'registro-sessao' } });
    expect(appModule.closeModal).toHaveBeenCalledWith('registro-sessao');
  });

  it('close-modal handler skips when no modal', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'close-modal')[1];
    handler({ dataset: {} });
    expect(appModule.closeModal).not.toHaveBeenCalled();
  });

  it('open-registro-sessao handler calls openRegistroSessao with eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-registro-sessao')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(registroSessao.openRegistroSessao).toHaveBeenCalledWith('evt_1');
  });

  it('open-add-past-session handler calls openAddPastSessionModal with discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-add-past-session')[1];
    handler({ dataset: { discId: 'disc_1' } });
    expect(eventModals.openAddPastSessionModal).toHaveBeenCalledWith('disc_1');
  });

  it('toggle-study-type handler passes tipo from dataset', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-study-type')[1];
    handler({ dataset: { tipo: 'video' } });
    expect(registroSessao.toggleStudyType).toHaveBeenCalledWith('video');
  });

  it('set-pagina-mode handler passes mode from dataset', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-pagina-mode')[1];
    handler({ dataset: { mode: 'resumo' } });
    expect(registroSessao.setPaginaMode).toHaveBeenCalledWith('resumo');
  });

  it('stop-propagation handler is a no-op', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'stop-propagation')[1];
    expect(handler).toBeDefined();
    expect(handler()).toBeUndefined();
  });

  it('open-planejamento-wizard handler is openPlanejamentoWizard directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-planejamento-wizard')[1];
    expect(handler).toBe(planejamentoWizard.openPlanejamentoWizard);
  });
});
