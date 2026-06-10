import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/eventos.js', () => {
  let registerAction;
  let logicModule;
  let eventModals;
  let appModule;
  let viewsModule;
  let registroSessao;
  let storeModule;
  let historicoView;
  let componentsModule;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    logicModule = {
      toggleTimer: vi.fn(),
      discardTimer: vi.fn(),
      toggleTimerMode: vi.fn(),
      addTimerMinutes: vi.fn(),
      setCronoLivreGoal: vi.fn(),
      setCronoLivreDisc: vi.fn(),
      setCronoLivreAss: vi.fn(),
      deleteEvento: vi.fn(),
      removeEvento: vi.fn(),
      marcarEstudei: vi.fn(),
    };
    eventModals = {
      openAddEventModal: vi.fn(),
      updateDayLoad: vi.fn(),
      loadAssuntos: vi.fn(),
      saveEvent: vi.fn(),
      savePastEvent: vi.fn(),
      openEventDetail: vi.fn(),
    };
    appModule = { showConfirm: vi.fn(), closeModal: vi.fn() };
    viewsModule = { clearSearch: vi.fn() };
    registroSessao = {
      openRegistroSessao: vi.fn(),
      cancelRegistro: vi.fn(),
      discardTimerUI: vi.fn(),
      voltarPastSessionUI: vi.fn(),
      deleteCompletedSession: vi.fn(),
    };
    storeModule = { state: { cronoLivre: { duracaoMinutos: 30 } } };
    historicoView = {
      setHistoricoFilter: vi.fn(),
      loadMoreHistorico: vi.fn(),
      exportHistoricoCsv: vi.fn(() => true),
      exportHistoricoJson: vi.fn(() => true),
    };
    componentsModule = { renderCurrentView: vi.fn() };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/historico-view.js?v=8.37', () => historicoView);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/ui/event-modals.js?v=8.37', () => eventModals);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/views.js?v=8.37', () => viewsModule);
    vi.doMock('../../src/js/registro-sessao.js?v=8.37', () => registroSessao);
    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);

    await import('../../src/js/ui/actions/eventos.js');
  });

  it('registers eventos actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('toggle-timer');
    expect(calls).toContain('discard-timer');
    expect(calls).toContain('mark-studied');
    expect(calls).toContain('toggle-timer-mode');
    expect(calls).toContain('edit-event');
    expect(calls).toContain('delete-event');
    expect(calls).toContain('delete-event-from-modal');
    expect(calls).toContain('open-add-event');
    expect(calls).toContain('open-event-modal-date');
    // 'open-event-from-calo' removido: registro morto (nenhum markup o usava)
    expect(calls).not.toContain('open-event-from-calo');
    expect(calls).toContain('open-event-detail');
    expect(calls).toContain('switch-to-event-timer');
    expect(calls).toContain('add-minutes');
    expect(calls).toContain('save-event');
    expect(calls).toContain('save-past-event');
    expect(calls).toContain('update-day-load');
    expect(calls).toContain('load-assuntos');
    expect(calls).toContain('cancel-registro');
    expect(calls).toContain('discard-timer-ui');
    expect(calls).toContain('voltar-past-session-ui');
    expect(calls).toContain('delete-completed-session');
    expect(calls).toContain('set-crono-livre-disc');
    expect(calls).toContain('set-crono-livre-ass');
    expect(calls).toContain('set-crono-livre-goal');
    expect(calls).toContain('open-search-event');
    expect(calls).toContain('edit-session-record');
    expect(calls).toContain('delete-session-record');
    expect(calls).toContain('historico-clear-filters');
  });

  it('historico-set-busca aplica o filtro após o debounce', () => {
    vi.useFakeTimers();
    const busca = registerAction.mock.calls.find(c => c[0] === 'historico-set-busca')[1];
    busca({ value: 'constitucional' });
    expect(historicoView.setHistoricoFilter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(historicoView.setHistoricoFilter).toHaveBeenCalledWith({ busca: 'constitucional' });
    vi.useRealTimers();
  });

  it('historico-clear-filters cancela debounce pendente da busca', () => {
    vi.useFakeTimers();
    const busca = registerAction.mock.calls.find(c => c[0] === 'historico-set-busca')[1];
    const clear = registerAction.mock.calls.find(c => c[0] === 'historico-clear-filters')[1];
    busca({ value: 'abc' });
    clear();
    vi.advanceTimersByTime(300);
    // o debounce antigo não pode reaplicar a busca depois do clear
    expect(historicoView.setHistoricoFilter).toHaveBeenCalledTimes(1);
    expect(historicoView.setHistoricoFilter).toHaveBeenCalledWith({
      rangeDays: '30',
      disciplinaId: '',
      busca: '',
    });
    vi.useRealTimers();
  });

  it('historico-clear-filters resets all filters and re-renders', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'historico-clear-filters')[1];
    handler();
    expect(historicoView.setHistoricoFilter).toHaveBeenCalledWith({
      rangeDays: '30',
      disciplinaId: '',
      busca: '',
    });
    expect(componentsModule.renderCurrentView).toHaveBeenCalled();
  });

  it('toggle-timer handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-timer')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(logicModule.toggleTimer).toHaveBeenCalledWith('evt_1');
  });

  it('toggle-timer skips when no eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-timer')[1];
    handler({ dataset: {} });
    expect(logicModule.toggleTimer).not.toHaveBeenCalled();
  });

  it('discard-timer handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'discard-timer')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(logicModule.discardTimer).toHaveBeenCalledWith('evt_1');
  });

  it('mark-studied handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'mark-studied')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(logicModule.marcarEstudei).toHaveBeenCalledWith('evt_1');
  });

  it('toggle-timer-mode handler is toggleTimerMode directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-timer-mode')[1];
    expect(handler).toBe(logicModule.toggleTimerMode);
  });

  it('edit-event handler passes eventId as edit target', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'edit-event')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(eventModals.openAddEventModal).toHaveBeenCalledWith(null, 'evt_1');
  });

  it('delete-event handler shows confirmation', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-event')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('delete-event handler removes event after confirmation', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-event')[1];
    handler({ dataset: { eventId: 'evt_1' } });

    const onConfirm = appModule.showConfirm.mock.calls[0][1];
    onConfirm();

    expect(logicModule.removeEvento).toHaveBeenCalledWith('evt_1');
  });

  it('delete-event skips when no eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-event')[1];
    handler({ dataset: {} });
    expect(appModule.showConfirm).not.toHaveBeenCalled();
  });

  it('delete-event-from-modal handler closes modal after delete', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-event-from-modal')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(appModule.showConfirm).toHaveBeenCalled();

    const onConfirm = appModule.showConfirm.mock.calls[0][1];
    onConfirm();

    expect(logicModule.removeEvento).toHaveBeenCalledWith('evt_1');
    expect(appModule.closeModal).toHaveBeenCalledWith('modal-event-detail');
  });

  it('open-add-event handler calls openAddEventModal without args', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-add-event')[1];
    handler({});
    expect(eventModals.openAddEventModal).toHaveBeenCalledWith();
  });

  it('open-event-modal-date handler passes date', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-event-modal-date')[1];
    handler({ dataset: { date: '2026-04-29' } });
    expect(eventModals.openAddEventModal).toHaveBeenCalledWith('2026-04-29');
  });

  it('open-event-detail handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-event-detail')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(eventModals.openEventDetail).toHaveBeenCalledWith('evt_1');
  });

  it('add-minutes handler parses minutes', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'add-minutes')[1];
    handler({ dataset: { eventId: 'evt_1', minutes: '5' } });
    expect(logicModule.addTimerMinutes).toHaveBeenCalledWith('evt_1', 5);
  });

  it('save-event handler is saveEvent directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-event')[1];
    expect(handler).toBe(eventModals.saveEvent);
  });

  it('save-past-event handler passes discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-past-event')[1];
    handler({ dataset: { discId: 'disc_1' } });
    expect(eventModals.savePastEvent).toHaveBeenCalledWith('disc_1');
  });

  it('save-past-event skips when no discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-past-event')[1];
    handler({ dataset: {} });
    expect(eventModals.savePastEvent).not.toHaveBeenCalled();
  });

  it('update-day-load handler passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'update-day-load')[1];
    handler({ value: '4' });
    expect(eventModals.updateDayLoad).toHaveBeenCalledWith('4');
  });

  it('load-assuntos handler is loadAssuntos directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'load-assuntos')[1];
    expect(handler).toBe(eventModals.loadAssuntos);
  });

  it('cancel-registro handler is cancelRegistro directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'cancel-registro')[1];
    expect(handler).toBe(registroSessao.cancelRegistro);
  });

  it('discard-timer-ui handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'discard-timer-ui')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(registroSessao.discardTimerUI).toHaveBeenCalledWith('evt_1');
  });

  it('voltar-past-session-ui handler passes eventId and discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'voltar-past-session-ui')[1];
    handler({ dataset: { eventId: 'evt_1', discId: 'disc_1' } });
    expect(registroSessao.voltarPastSessionUI).toHaveBeenCalledWith('evt_1', 'disc_1');
  });

  it('delete-completed-session handler passes sessionId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-completed-session')[1];
    handler({ dataset: { sessionId: 'sess_1' } });
    expect(registroSessao.deleteCompletedSession).toHaveBeenCalledWith('sess_1');
  });

  it('set-crono-livre-disc handler passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-crono-livre-disc')[1];
    handler({ value: 'matematica' });
    expect(logicModule.setCronoLivreDisc).toHaveBeenCalledWith('matematica');
  });

  it('set-crono-livre-ass handler passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-crono-livre-ass')[1];
    handler({ value: 'algebra' });
    expect(logicModule.setCronoLivreAss).toHaveBeenCalledWith('algebra');
  });

  it('set-crono-livre-goal handler parses absolute value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-crono-livre-goal')[1];
    handler({ dataset: { value: '45' }, value: '45' });
    expect(logicModule.setCronoLivreGoal).toHaveBeenCalledWith(45);
  });

  it('set-crono-livre-goal handler adds relative value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-crono-livre-goal')[1];
    handler({ dataset: { value: '+10' }, value: '+10' });
    expect(logicModule.setCronoLivreGoal).toHaveBeenCalledWith(40);
  });

  it('set-crono-livre-goal handler subtracts relative value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-crono-livre-goal')[1];
    handler({ dataset: { value: '-5' }, value: '-5' });
    expect(logicModule.setCronoLivreGoal).toHaveBeenCalledWith(25);
  });

  it('open-search-event handler clears search and opens detail', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-search-event')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(viewsModule.clearSearch).toHaveBeenCalled();
    expect(eventModals.openEventDetail).toHaveBeenCalledWith('evt_1');
  });

  it('open-search-event skips when no eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-search-event')[1];
    handler({ dataset: {} });
    expect(viewsModule.clearSearch).not.toHaveBeenCalled();
  });

  it('edit-session-record handler passes sessionId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'edit-session-record')[1];
    handler({ dataset: { sessionId: 'sess_1' } });
    expect(registroSessao.openRegistroSessao).toHaveBeenCalledWith('sess_1');
  });

  it('delete-session-record handler passes sessionId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-session-record')[1];
    handler({ dataset: { sessionId: 'sess_1' } });
    expect(registroSessao.deleteCompletedSession).toHaveBeenCalledWith('sess_1');
  });
});
