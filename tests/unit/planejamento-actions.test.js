import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/planejamento.js', () => {
  let registerAction;
  let wizard;
  let viewsModule;
  let logicModule;
  let appModule;
  let storeModule;
  let componentsModule;
  let eventModals;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    wizard = {
      pwSelectTipo: vi.fn(),
      pwToggleDisc: vi.fn(),
      pwSearchDisc: vi.fn(),
      pwSelectAllDisc: vi.fn(),
      pwClearDisc: vi.fn(),
      pwUpdateRel: vi.fn(),
      pwUpdateHours: vi.fn(),
      pwToggleDay: vi.fn(),
      pwUpdateDayHour: vi.fn(),
    };
    viewsModule = {
      recomecarCiclo: vi.fn(),
      zerarCiclosCounter: vi.fn(),
      calculateCyclePredictions: vi.fn(),
      toggleEditSeq: vi.fn(),
      saveEditSeq: vi.fn(),
      cancelEditSeq: vi.fn(),
      updateSeqItem: vi.fn(),
      dupSeqItem: vi.fn(),
      remSeqItem: vi.fn(),
      moveSeqItem: vi.fn(),
      addSeqItem: vi.fn(),
      openCicloHistory: vi.fn(),
    };
    logicModule = { desfazerEtapa: vi.fn(), iniciarEtapaPlanejamento: vi.fn() };
    appModule = { showConfirm: vi.fn(), showToast: vi.fn() };
    storeModule = { scheduleSave: vi.fn(), state: { planejamento: { ativo: true } } };
    componentsModule = { renderCurrentView: vi.fn() };
    eventModals = { openEventDetail: vi.fn() };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/planejamento-wizard.js?v=8.29', () => wizard);
    vi.doMock('../../src/js/views.js?v=8.29', () => viewsModule);
    vi.doMock('../../src/js/logic.js?v=8.29', () => logicModule);
    vi.doMock('../../src/js/app.js?v=8.29', () => appModule);
    vi.doMock('../../src/js/store.js?v=8.29', () => storeModule);
    vi.doMock('../../src/js/components.js?v=8.29', () => componentsModule);
    vi.doMock('../../src/js/ui/event-modals.js?v=8.29', () => eventModals);

    await import('../../src/js/ui/actions/planejamento.js');
  });

  it('registers planejamento actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('pw-select-tipo');
    expect(calls).toContain('pw-toggle-disc');
    expect(calls).toContain('pw-search-disc');
    expect(calls).toContain('pw-select-all-disc');
    expect(calls).toContain('pw-clear-disc');
    expect(calls).toContain('pw-update-relevancia');
    expect(calls).toContain('pw-update-hours');
    expect(calls).toContain('pw-toggle-day');
    expect(calls).toContain('pw-update-day-hour');
    expect(calls).toContain('iniciar-etapa-planejamento');
    expect(calls).toContain('move-ciclo-seq');
    expect(calls).toContain('edit-ciclo-seq-hours');
    expect(calls).toContain('desfazer-etapa');
    expect(calls).toContain('open-event-from-ciclo-history');
    expect(calls).toContain('toggle-edit-seq');
    expect(calls).toContain('save-edit-seq');
    expect(calls).toContain('cancel-edit-seq');
    expect(calls).toContain('update-seq-item');
    expect(calls).toContain('dup-seq-item');
    expect(calls).toContain('rem-seq-item');
    expect(calls).toContain('move-seq-item');
    expect(calls).toContain('add-seq-item');
    expect(calls).toContain('recomecar-ciclo');
    expect(calls).toContain('zerar-ciclos-counter');
    expect(calls).toContain('calculate-cycle-predictions');
    expect(calls).toContain('open-ciclo-history');
    expect(calls).toContain('remover-planejamento');
  });

  it('pw-select-tipo handler passes tipo', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-select-tipo')[1];
    handler({ dataset: { tipo: 'concurso' } });
    expect(wizard.pwSelectTipo).toHaveBeenCalledWith('concurso');
  });

  it('pw-toggle-disc handler passes discId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-toggle-disc')[1];
    handler({ dataset: { discId: 'disc_1' } });
    expect(wizard.pwToggleDisc).toHaveBeenCalledWith('disc_1');
  });

  it('pw-search-disc handler passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-search-disc')[1];
    handler({ value: 'direito' });
    expect(wizard.pwSearchDisc).toHaveBeenCalledWith('direito');
  });

  it('pw-select-all-disc handler is pwSelectAllDisc directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-select-all-disc')[1];
    expect(handler).toBe(wizard.pwSelectAllDisc);
  });

  it('pw-clear-disc handler is pwClearDisc directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-clear-disc')[1];
    expect(handler).toBe(wizard.pwClearDisc);
  });

  it('pw-update-relevancia handler passes discId, type, value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-update-relevancia')[1];
    handler({ dataset: { discId: 'disc_1', type: 'peso' }, value: '5' });
    expect(wizard.pwUpdateRel).toHaveBeenCalledWith('disc_1', 'peso', '5');
  });

  it('pw-update-hours handler passes field and value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-update-hours')[1];
    handler({ dataset: { field: 'semanal' }, value: '20' });
    expect(wizard.pwUpdateHours).toHaveBeenCalledWith('semanal', '20');
  });

  it('pw-toggle-day handler parses dayIndex', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-toggle-day')[1];
    handler({ dataset: { dayIndex: '2' } });
    expect(wizard.pwToggleDay).toHaveBeenCalledWith(2);
  });

  it('pw-update-day-hour handler parses dayIndex and passes value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'pw-update-day-hour')[1];
    handler({ dataset: { dayIndex: '1' }, value: '4' });
    expect(wizard.pwUpdateDayHour).toHaveBeenCalledWith(1, '4');
  });

  it('iniciar-etapa-planejamento handler passes seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'iniciar-etapa-planejamento')[1];
    handler({ dataset: { seqId: 'seq_1' } });
    expect(logicModule.iniciarEtapaPlanejamento).toHaveBeenCalledWith('seq_1');
  });

  it('iniciar-etapa-planejamento skips when no seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'iniciar-etapa-planejamento')[1];
    handler({ dataset: {} });
    expect(logicModule.iniciarEtapaPlanejamento).not.toHaveBeenCalled();
  });

  it('desfazer-etapa handler passes seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'desfazer-etapa')[1];
    handler({ dataset: { seqId: 'seq_1' } });
    expect(logicModule.desfazerEtapa).toHaveBeenCalledWith('seq_1');
  });

  it('desfazer-etapa skips when no seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'desfazer-etapa')[1];
    handler({ dataset: {} });
    expect(logicModule.desfazerEtapa).not.toHaveBeenCalled();
  });

  it('open-event-from-ciclo-history handler passes eventId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-event-from-ciclo-history')[1];
    handler({ dataset: { eventId: 'evt_1' } });
    expect(eventModals.openEventDetail).toHaveBeenCalledWith('evt_1');
  });

  it('toggle-edit-seq handler is toggleEditSeq directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-edit-seq')[1];
    expect(handler).toBe(viewsModule.toggleEditSeq);
  });

  it('update-seq-item handler parses index and passes field/value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'update-seq-item')[1];
    handler({ dataset: { index: '2', field: 'horas' }, value: '3' });
    expect(viewsModule.updateSeqItem).toHaveBeenCalledWith(2, 'horas', '3');
  });

  it('update-seq-item skips when invalid index', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'update-seq-item')[1];
    handler({ dataset: { index: 'abc', field: 'horas' }, value: '3' });
    expect(viewsModule.updateSeqItem).not.toHaveBeenCalled();
  });

  it('dup-seq-item handler passes index', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'dup-seq-item')[1];
    handler({ dataset: { index: '1' } });
    expect(viewsModule.dupSeqItem).toHaveBeenCalledWith(1);
  });

  it('rem-seq-item handler passes index', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'rem-seq-item')[1];
    handler({ dataset: { index: '0' } });
    expect(viewsModule.remSeqItem).toHaveBeenCalledWith(0);
  });

  it('move-seq-item handler parses index and dir', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'move-seq-item')[1];
    handler({ dataset: { index: '1', dir: '1' } });
    expect(viewsModule.moveSeqItem).toHaveBeenCalledWith(1, 1);
  });

  it('add-seq-item handler is addSeqItem directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'add-seq-item')[1];
    expect(handler).toBe(viewsModule.addSeqItem);
  });

  it('recomecar-ciclo handler is recomecarCiclo directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'recomecar-ciclo')[1];
    expect(handler).toBe(viewsModule.recomecarCiclo);
  });

  it('open-ciclo-history handler passes seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-ciclo-history')[1];
    handler({ dataset: { seqId: 'seq_1' } });
    expect(viewsModule.openCicloHistory).toHaveBeenCalledWith('seq_1');
  });

  it('open-ciclo-history skips when no seqId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-ciclo-history')[1];
    handler({ dataset: {} });
    expect(viewsModule.openCicloHistory).not.toHaveBeenCalled();
  });

  it('remover-planejamento shows confirmation', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'remover-planejamento')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });
});
