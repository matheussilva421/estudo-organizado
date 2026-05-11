import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/revisoes.js', () => {
  let registerAction;
  let revisaoView;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    revisaoView = {
      switchRevTab: vi.fn(),
      marcarRevisao: vi.fn(),
      adiarRevisao: vi.fn(),
      deletarRevisao: vi.fn(),
      updateRevisionFrequency: vi.fn(),
      clearVisibleRevisions: vi.fn(),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/revisao-view.js', () => revisaoView);

    await import('../../src/js/ui/actions/revisoes.js');
  });

  it('registers revision actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('switch-revision-tab');
    expect(calls).toContain('mark-revision');
    expect(calls).toContain('postpone-revision');
    expect(calls).toContain('delete-revision');
    expect(calls).toContain('delete-upcoming-revision');
    expect(calls).toContain('update-revision-frequency');
    expect(calls).toContain('clear-visible-revisions');
  });

  it('mark-revision handler calls marcarRevisao with assuntoId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'mark-revision')[1];
    handler({ dataset: { assuntoId: 'assunto_1' } });
    expect(revisaoView.marcarRevisao).toHaveBeenCalledWith('assunto_1');
  });

  it('mark-revision handler skips when no assuntoId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'mark-revision')[1];
    handler({ dataset: {} });
    expect(revisaoView.marcarRevisao).not.toHaveBeenCalled();
  });

  it('postpone-revision handler calls adiarRevisao with assuntoId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'postpone-revision')[1];
    handler({ dataset: { assuntoId: 'assunto_2' } });
    expect(revisaoView.adiarRevisao).toHaveBeenCalledWith('assunto_2');
  });

  it('delete-revision handler calls deletarRevisao with assuntoId', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-revision')[1];
    handler({ dataset: { assuntoId: 'assunto_3' } });
    expect(revisaoView.deletarRevisao).toHaveBeenCalledWith('assunto_3');
  });

  it('delete-upcoming-revision handler passes revision date when present', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'delete-upcoming-revision')[1];
    handler({ dataset: { assuntoId: 'assunto_3', revisionDate: '2026-04-21' } });
    expect(revisaoView.deletarRevisao).toHaveBeenCalledWith('assunto_3', '2026-04-21');
  });

  it('switch-revision-tab handler passes tab and element', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'switch-revision-tab')[1];
    const el = { dataset: { tab: 'proximas' } };
    handler(el);
    expect(revisaoView.switchRevTab).toHaveBeenCalledWith('proximas', el);
  });
});
