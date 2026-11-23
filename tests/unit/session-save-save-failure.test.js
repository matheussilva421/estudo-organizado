/* global process, setImmediate */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: {
    eventos: [],
    habitos: { teoria: [] },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    planejamento: { ativo: false, sequencia: [] },
  },
  saveStateToDB: vi.fn(),
  describeSaveFailure: vi.fn(),
  getDisc: vi.fn(),
  syncCicloToEventos: vi.fn(),
  getCycleProgress: vi.fn(() => ({})),
  touchPlanejamento: vi.fn(),
  substitutePlanejamentoSlot: vi.fn(),
  invalidateDashCaches: vi.fn(),
  invalidateStreakCache: vi.fn(),
  invalidatePendingRevCache: vi.fn(),
  showToast: vi.fn(),
  closeModal: vi.fn(),
  openModal: vi.fn(),
  showConfirm: vi.fn(),
  renderCurrentView: vi.fn(),
  updateBadges: vi.fn(),
  esc: vi.fn((value) => String(value ?? '')),
  todayStr: vi.fn(() => '2026-11-23'),
  uid: vi.fn(() => 'generated'),
  applyTopicosToEvent: vi.fn(),
  sumTopicQuestoes: vi.fn(() => null),
  sumTopicPaginas: vi.fn(() => null),
}));

vi.mock('../../src/js/store.js?v=8.37', () => ({
  state: mocks.state,
  saveStateToDB: mocks.saveStateToDB,
  describeSaveFailure: mocks.describeSaveFailure,
}));

vi.mock('../../src/js/logic.js?v=8.37', () => ({
  getDisc: mocks.getDisc,
  syncCicloToEventos: mocks.syncCicloToEventos,
  getCycleProgress: mocks.getCycleProgress,
  touchPlanejamento: mocks.touchPlanejamento,
  substitutePlanejamentoSlot: mocks.substitutePlanejamentoSlot,
  invalidateDashCaches: mocks.invalidateDashCaches,
  invalidateStreakCache: mocks.invalidateStreakCache,
  invalidatePendingRevCache: mocks.invalidatePendingRevCache,
}));

vi.mock('../../src/js/app.js?v=8.37', () => ({
  showToast: mocks.showToast,
  closeModal: mocks.closeModal,
  openModal: mocks.openModal,
  showConfirm: mocks.showConfirm,
}));

vi.mock('../../src/js/utils.js?v=8.37', () => ({
  esc: mocks.esc,
  todayStr: mocks.todayStr,
  uid: mocks.uid,
}));

vi.mock('../../src/js/components.js?v=8.37', () => ({
  updateBadges: mocks.updateBadges,
  renderCurrentView: mocks.renderCurrentView,
}));

vi.mock('../../src/js/registro-sessao/session-topics.js', () => ({
  applyTopicosToEvent: mocks.applyTopicosToEvent,
  sumTopicQuestoes: mocks.sumTopicQuestoes,
  sumTopicPaginas: mocks.sumTopicPaginas,
}));

import * as sessionSave from '../../src/js/registro-sessao/session-save.js?v=8.37';

function saveArgs() {
  return {
    currentEventId: 'ev_save',
    selectedTipos: ['teoria'],
    selectedMateriais: [],
    sessionStartTime: null,
    sessionEndTime: null,
    sessionMode: 'timer',
  };
}

function resetState() {
  mocks.state.eventos = [
    {
      id: 'ev_save',
      titulo: 'Sessao',
      data: '2026-11-23',
      status: 'agendado',
      tempoAcumulado: 3600,
      discId: 'disc_a',
    },
  ];
  mocks.state.habitos = { teoria: [] };
  mocks.state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  mocks.state.planejamento = { ativo: false, sequencia: [] };
  mocks.getDisc.mockReturnValue(null);
}

async function monitorUnhandled(run) {
  const unhandled = [];
  const listener = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  try {
    await run();
    await new Promise((resolve) => setImmediate(resolve));
    return unhandled;
  } finally {
    process.off('unhandledRejection', listener);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
  mocks.describeSaveFailure.mockReturnValue('IndexedDB indisponível (InvalidStateError: closed)');
  document.body.innerHTML = `
    <input id="reg-disciplina" value="disc_a">
    <input id="reg-data-estudo" value="2026-11-23">
    <input id="reg-tempo-mins" value="60">
  `;
});

describe('registro-sessao/session-save.js — rejeicoes de persistencia', () => {
  it('mantem o modal aberto, mostra erro e permite nova tentativa quando o save falha', async () => {
    const error = new Error('IndexedDB unavailable');
    mocks.saveStateToDB.mockRejectedValueOnce(error);

    const unhandled = await monitorUnhandled(async () => {
      expect(sessionSave.performSave(saveArgs())).toBe(true);
      await vi.waitFor(() => {
        expect(mocks.showToast).toHaveBeenCalledWith(
          expect.stringContaining('IndexedDB indisponível'),
          'error'
        );
      });
    });

    expect(unhandled).toEqual([]);
    expect(mocks.describeSaveFailure).toHaveBeenCalledWith(error);
    expect(mocks.closeModal).not.toHaveBeenCalledWith('modal-registro-sessao');
    expect(mocks.showToast).not.toHaveBeenCalledWith(
      expect.stringContaining('Sessão registrada com sucesso'),
      'success'
    );

    mocks.saveStateToDB.mockResolvedValueOnce(undefined);
    expect(sessionSave.performSave(saveArgs())).toBe(true);
    await vi.waitFor(() => {
      expect(mocks.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
      expect(mocks.showToast).toHaveBeenCalledWith(
        'Sessão registrada com sucesso! ✅',
        'success'
      );
    });
  });

  it('nao mostra sucesso ao falhar a conclusao manual de etapa do planejamento', async () => {
    mocks.state.eventos[0].seqId = 'seq_a';
    mocks.state.planejamento = {
      ativo: true,
      sequencia: [
        { id: 'seq_a', discId: 'disc_a', minutosAlvo: 60, status: 'pendente', concluido: false },
      ],
    };
    mocks.getCycleProgress.mockReturnValue({ seq_a: { usedMins: 0 } });
    mocks.saveStateToDB.mockResolvedValueOnce(undefined);

    expect(sessionSave.performSave(saveArgs())).toBe(true);
    await vi.waitFor(() => {
      expect(mocks.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
      expect(mocks.showToast).toHaveBeenCalledWith(
        'Sessão registrada com sucesso! ✅',
        'success'
      );
    });
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);

    mocks.showToast.mockClear();
    mocks.closeModal.mockClear();
    mocks.renderCurrentView.mockClear();
    const error = new Error('transaction closed');
    mocks.saveStateToDB.mockRejectedValueOnce(error);

    const unhandled = await monitorUnhandled(async () => {
      mocks.showConfirm.mock.calls[0][1]();
      await vi.waitFor(() => {
        expect(mocks.showToast).toHaveBeenCalledWith(
          expect.stringContaining('IndexedDB indisponível'),
          'error'
        );
      });
    });

    expect(unhandled).toEqual([]);
    expect(mocks.describeSaveFailure).toHaveBeenCalledWith(error);
    expect(mocks.showToast).not.toHaveBeenCalledWith(
      expect.stringContaining('Etapa concluída manualmente'),
      'success'
    );
    expect(mocks.renderCurrentView).not.toHaveBeenCalled();
    expect(mocks.closeModal).not.toHaveBeenCalledWith('modal-registro-sessao');
  });
});
