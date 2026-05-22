import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEvento,
  createDisciplina,
  createEdital,
  createAssunto,
} from '../helpers/state-builders.js';

let store;
let logic;

function createMockDOM() {
  const elements = {};

  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      children: [],
      lastElementChild: null,
      firstElementChild: null,
      value: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => true),
      getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
    };
    elements[id] = el;
    return el;
  };

  const mockDocument = {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {} },
    elements,
  };

  return mockDocument;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const mockDoc = createMockDOM();
  global.document = mockDoc;
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    _cronoInterval: null,
    _discChartInstance: null,
    _planjChartInstance: null,
    activeDashboardDiscCtx: null,
    navigate: vi.fn(),
    openDiscDashboard: vi.fn(),
    currentView: 'home',
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn((fn) => ({ _interval: true, fn }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateRevCache();
  logic.invalidatePendingRevCache();
  logic.invalidateDashCaches();
  logic.invalidateStreakCache();

  Object.keys(logic.timerIntervals).forEach((id) => {
    delete logic.timerIntervals[id];
  });
});

describe('logic.js', () => {
  describe('Timer engine', () => {
    describe('toggleTimer', () => {
      it('starts timer for an event', () => {
        const evento = createEvento({ id: 'ev_1', _timerStart: null, tempoAcumulado: 0 });
        store.setState(createBaseState({ eventos: [evento] }));

        logic.toggleTimer('ev_1');

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev._timerStart).toBeGreaterThan(0);
        expect(global.document.dispatchEvent).toHaveBeenCalled();
      });

      it('pauses a running timer', () => {
        const startTime = Date.now() - 5000;
        const evento = createEvento({ id: 'ev_1', _timerStart: startTime, tempoAcumulado: 0 });
        store.setState(createBaseState({ eventos: [evento] }));

        logic.toggleTimer('ev_1');

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev._timerStart).toBeNull();
        expect(ev.tempoAcumulado).toBe(5);
      });

      it('starts crono_livre timer', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
          })
        );

        logic.toggleTimer('crono_livre');

        expect(store.state.cronoLivre._timerStart).toBeGreaterThan(0);
      });

      it('pauses crono_livre timer', () => {
        const startTime = Date.now() - 10000;
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: startTime, tempoAcumulado: 30 },
          })
        );

        logic.toggleTimer('crono_livre');

        expect(store.state.cronoLivre._timerStart).toBeNull();
        expect(store.state.cronoLivre.tempoAcumulado).toBe(40);
      });

      it('does nothing for non-existent event', () => {
        store.setState(createBaseState({ eventos: [] }));

        expect(() => logic.toggleTimer('ev_nonexistent')).not.toThrow();
      });
    });

    describe('isTimerActive', () => {
      it('returns true when event has _timerStart', () => {
        const evento = createEvento({ id: 'ev_1', _timerStart: Date.now() });
        store.setState(createBaseState({ eventos: [evento] }));

        expect(logic.isTimerActive('ev_1')).toBe(true);
      });

      it('returns false when event has no _timerStart', () => {
        const evento = createEvento({ id: 'ev_1', _timerStart: null });
        store.setState(createBaseState({ eventos: [evento] }));

        expect(logic.isTimerActive('ev_1')).toBe(false);
      });

      it('returns true for crono_livre with _timerStart', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: Date.now(), tempoAcumulado: 0 },
          })
        );

        expect(logic.isTimerActive('crono_livre')).toBe(true);
      });

      it('returns false for crono_livre without _timerStart', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
          })
        );

        expect(logic.isTimerActive('crono_livre')).toBe(false);
      });

      it('returns false for non-existent event', () => {
        store.setState(createBaseState({ eventos: [] }));

        expect(logic.isTimerActive('ev_missing')).toBe(false);
      });
    });

    describe('getElapsedSeconds', () => {
      it('returns tempoAcumulado when timer is not running', () => {
        const ev = { tempoAcumulado: 120, _timerStart: null };

        expect(logic.getElapsedSeconds(ev)).toBe(120);
      });

      it('calculates elapsed time from _timerStart', () => {
        const startTime = Date.now() - 30000;
        const ev = { tempoAcumulado: 60, _timerStart: startTime };

        const elapsed = logic.getElapsedSeconds(ev);

        expect(elapsed).toBeGreaterThanOrEqual(90);
        expect(elapsed).toBeLessThanOrEqual(91);
      });

      it('returns 0 when no accumulated time and no timer', () => {
        const ev = { tempoAcumulado: 0, _timerStart: null };

        expect(logic.getElapsedSeconds(ev)).toBe(0);
      });

      it('handles missing tempoAcumulado', () => {
        const ev = { _timerStart: null };

        expect(logic.getElapsedSeconds(ev)).toBe(0);
      });
    });

    describe('addTimerMinutes', () => {
      it('adds minutes to event duracao', () => {
        const evento = createEvento({ id: 'ev_1', duracao: 30 });
        store.setState(createBaseState({ eventos: [evento] }));

        logic.addTimerMinutes('ev_1', 15);

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev.duracao).toBe(45);
      });

      it('adds minutes to crono_livre duracaoMinutos', () => {
        store.setState(
          createBaseState({
            cronoLivre: { duracaoMinutos: 20, _timerStart: null, tempoAcumulado: 0 },
          })
        );

        logic.addTimerMinutes('crono_livre', 10);

        expect(store.state.cronoLivre.duracaoMinutos).toBe(30);
      });

      it('does not go below 0', () => {
        const evento = createEvento({ id: 'ev_1', duracao: 5 });
        store.setState(createBaseState({ eventos: [evento] }));

        logic.addTimerMinutes('ev_1', -10);

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev.duracao).toBe(0);
      });

      it('creates duracao field if missing', () => {
        const evento = createEvento({ id: 'ev_1' });
        store.setState(createBaseState({ eventos: [evento] }));

        logic.addTimerMinutes('ev_1', 25);

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev.duracao).toBe(25);
      });

      it('does nothing for non-existent event', () => {
        store.setState(createBaseState({ eventos: [] }));

        expect(() => logic.addTimerMinutes('ev_missing', 10)).not.toThrow();
      });
    });
  });

  describe('Discard timer', () => {
    it('dispatches confirmation dialog for event', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 100, _timerStart: Date.now() });
      store.setState(createBaseState({ eventos: [evento] }));
      global.document.dispatchEvent.mockClear();

      logic.discardTimer('ev_1');

      expect(global.document.dispatchEvent).toHaveBeenCalled();
      const call = global.document.dispatchEvent.mock.calls[0][0];
      expect(call.type).toBe('app:showConfirm');
      expect(call.detail.msg).toContain('Descartar esta sess');
    });

    it('clears timer state when confirmation is accepted', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 100, _timerStart: Date.now() });
      store.setState(createBaseState({ eventos: [evento] }));
      logic.timerIntervals['ev_1'] = { _mock: true };
      global.document.dispatchEvent.mockClear();

      logic.discardTimer('ev_1');

      const confirmCall = global.document.dispatchEvent.mock.calls[0][0];
      confirmCall.detail.onYes();

      const ev = store.state.eventos.find((e) => e.id === 'ev_1');
      expect(ev.tempoAcumulado).toBe(0);
      expect(ev._timerStart).toBeNull();
      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('handles crono_livre discard', () => {
      store.setState(
        createBaseState({
          cronoLivre: { tempoAcumulado: 200, _timerStart: Date.now() },
        })
      );
      logic.timerIntervals['crono_livre'] = { _mock: true };
      global.document.dispatchEvent.mockClear();

      logic.discardTimer('crono_livre');

      const confirmCall = global.document.dispatchEvent.mock.calls[0][0];
      confirmCall.detail.onYes();

      expect(store.state.cronoLivre.tempoAcumulado).toBe(0);
      expect(store.state.cronoLivre._timerStart).toBeNull();
    });

    it('does nothing for non-existent event', () => {
      store.setState(createBaseState({ eventos: [] }));

      expect(() => logic.discardTimer('ev_missing')).not.toThrow();
    });
  });

  describe('Crono livre', () => {
    describe('setCronoLivreGoal', () => {
      it('sets duracaoMinutos on cronoLivre', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
          })
        );

        logic.setCronoLivreGoal(45);

        expect(store.state.cronoLivre.duracaoMinutos).toBe(45);
      });

      it('creates cronoLivre if not exists', () => {
        store.setState(createBaseState({ cronoLivre: null }));

        logic.setCronoLivreGoal(30);

        expect(store.state.cronoLivre.duracaoMinutos).toBe(30);
      });

      it('parses string input', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
          })
        );

        logic.setCronoLivreGoal('60');

        expect(store.state.cronoLivre.duracaoMinutos).toBe(60);
      });

      it('sets 0 for invalid input', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
          })
        );

        logic.setCronoLivreGoal('abc');

        expect(store.state.cronoLivre.duracaoMinutos).toBe(0);
      });
    });

    describe('setCronoLivreDisc', () => {
      it('sets discId and resets assId', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0, discId: 'old', assId: 'ass_1' },
          })
        );

        logic.setCronoLivreDisc('disc_2');

        expect(store.state.cronoLivre.discId).toBe('disc_2');
        expect(store.state.cronoLivre.assId).toBeNull();
      });

      it('creates cronoLivre if not exists', () => {
        store.setState(createBaseState({ cronoLivre: null }));

        logic.setCronoLivreDisc('disc_1');

        expect(store.state.cronoLivre.discId).toBe('disc_1');
        expect(store.state.cronoLivre.assId).toBeNull();
      });
    });

    describe('setCronoLivreAss', () => {
      it('sets assId', () => {
        store.setState(
          createBaseState({
            cronoLivre: { _timerStart: null, tempoAcumulado: 0, assId: null },
          })
        );

        logic.setCronoLivreAss('ass_5');

        expect(store.state.cronoLivre.assId).toBe('ass_5');
      });

      it('creates cronoLivre if not exists', () => {
        store.setState(createBaseState({ cronoLivre: null }));

        logic.setCronoLivreAss('ass_3');

        expect(store.state.cronoLivre.assId).toBe('ass_3');
      });
    });
  });

  describe('Study actions', () => {
    describe('_marcarEstudeiDirect', () => {
      it('marks event as studied with session data', () => {
        const evento = createEvento({ id: 'ev_1', status: 'agendado' });
        store.setState(createBaseState({ eventos: [evento] }));

        logic._marcarEstudeiDirect('ev_1');

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev.status).toBe('estudei');
        expect(ev.dataEstudo).toBe('2026-04-20');
      });

      it('stops running timer when marking as studied', () => {
        const startTime = Date.now() - 10000;
        const evento = createEvento({
          id: 'ev_1',
          status: 'agendado',
          _timerStart: startTime,
          tempoAcumulado: 0,
        });
        store.setState(createBaseState({ eventos: [evento] }));
        logic.timerIntervals['ev_1'] = { _mock: true };

        logic._marcarEstudeiDirect('ev_1');

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev._timerStart).toBeNull();
        expect(ev.tempoAcumulado).toBe(10);
        expect(global.clearInterval).toHaveBeenCalled();
      });

      it('marks assunto as concluido when event has discId and assId', () => {
        const disc = createDisciplina({
          id: 'disc_1',
          assuntos: [createAssunto({ id: 'ass_1', concluido: false })],
        });
        const edital = createEdital({ disciplinas: [disc] });
        const evento = createEvento({
          id: 'ev_1',
          discId: 'disc_1',
          assId: 'ass_1',
          status: 'agendado',
        });
        store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
        logic.invalidateDiscCache();

        logic._marcarEstudeiDirect('ev_1');

        const ev = store.state.eventos.find((e) => e.id === 'ev_1');
        expect(ev.status).toBe('estudei');
        const storedAss = store.state.editais[0].disciplinas[0].assuntos.find(
          (a) => a.id === 'ass_1'
        );
        expect(storedAss.concluido).toBe(true);
        expect(storedAss.dataConclusao).toBe('2026-04-20');
        expect(storedAss.revisoesFetas).toEqual([]);
      });

      it('does nothing for non-existent event', () => {
        store.setState(createBaseState({ eventos: [] }));

        expect(() => logic._marcarEstudeiDirect('ev_missing')).not.toThrow();
      });

      it('does not mark assunto if already concluido', () => {
        const disc = createDisciplina({
          id: 'disc_1',
          assuntos: [createAssunto({ id: 'ass_1', concluido: true, dataConclusao: '2026-04-15' })],
        });
        const edital = createEdital({ disciplinas: [disc] });
        const evento = createEvento({
          id: 'ev_1',
          discId: 'disc_1',
          assId: 'ass_1',
          status: 'agendado',
        });
        store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
        logic.invalidateDiscCache();

        logic._marcarEstudeiDirect('ev_1');

        const storedAss = store.state.editais[0].disciplinas[0].assuntos.find(
          (a) => a.id === 'ass_1'
        );
        expect(storedAss.dataConclusao).toBe('2026-04-15');
      });
    });
  });

  describe('Delete event', () => {
    it('dispatches confirmation dialog', () => {
      const evento = createEvento({ id: 'ev_1' });
      store.setState(createBaseState({ eventos: [evento] }));
      global.document.dispatchEvent.mockClear();

      logic.deleteEvento('ev_1');

      expect(global.document.dispatchEvent).toHaveBeenCalled();
      const call = global.document.dispatchEvent.mock.calls[0][0];
      expect(call.type).toBe('app:showConfirm');
      expect(call.detail.msg).toContain('Excluir este evento');
    });

    it('removes event from state when confirmed', () => {
      const ev1 = createEvento({ id: 'ev_1' });
      const ev2 = createEvento({ id: 'ev_2' });
      store.setState(createBaseState({ eventos: [ev1, ev2] }));
      global.document.dispatchEvent.mockClear();

      logic.deleteEvento('ev_1');

      const confirmCall = global.document.dispatchEvent.mock.calls[0][0];
      confirmCall.detail.onYes();

      expect(store.state.eventos).toHaveLength(1);
      expect(store.state.eventos[0].id).toBe('ev_2');
    });

    it('clears timer interval when deleting event', () => {
      const evento = createEvento({ id: 'ev_1' });
      store.setState(createBaseState({ eventos: [evento] }));
      logic.timerIntervals['ev_1'] = { _mock: true };
      global.document.dispatchEvent.mockClear();

      logic.deleteEvento('ev_1');

      const confirmCall = global.document.dispatchEvent.mock.calls[0][0];
      confirmCall.detail.onYes();

      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('invalidates pending revision cache', () => {
      const evento = createEvento({ id: 'ev_1' });
      store.setState(createBaseState({ eventos: [evento] }));
      global.document.dispatchEvent.mockClear();

      logic.deleteEvento('ev_1');

      const confirmCall = global.document.dispatchEvent.mock.calls[0][0];
      expect(confirmCall.detail.onYes).toBeDefined();
      expect(typeof confirmCall.detail.onYes).toBe('function');

      confirmCall.detail.onYes();

      expect(store.state.eventos).toHaveLength(0);
    });
  });

  describe('Discipline helpers', () => {
    describe('getDisc', () => {
      it('returns discipline entry by id', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Constitucional' });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidateDiscCache();

        const result = logic.getDisc('disc_1');

        expect(result).toBeDefined();
        expect(result.disc.id).toBe('disc_1');
        expect(result.disc.nome).toBe('Direito Constitucional');
        expect(result.edital.id).toBe('ed_1');
      });

      it('returns null for non-existent discipline', () => {
        store.setState(createBaseState({ editais: [] }));
        logic.invalidateDiscCache();

        const result = logic.getDisc('disc_missing');

        expect(result).toBeNull();
      });

      it('builds cache on first call', () => {
        const disc = createDisciplina({ id: 'disc_1' });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidateDiscCache();

        logic.getDisc('disc_1');

        expect(logic._discCache).toBeDefined();
        expect(logic._discIndex).toBeDefined();
      });
    });

    describe('getActiveDisciplinas', () => {
      it('returns only non-archived disciplines', () => {
        const disc1 = createDisciplina({ id: 'disc_1', nome: 'Ativa', arquivada: false });
        const disc2 = createDisciplina({ id: 'disc_2', nome: 'Arquivada', arquivada: true });
        const edital = createEdital({ disciplinas: [disc1, disc2] });
        store.setState(createBaseState({ editais: [edital] }));

        const result = logic.getActiveDisciplinas();

        expect(result).toHaveLength(1);
        expect(result[0].disc.id).toBe('disc_1');
      });

      it('returns empty array when no disciplines', () => {
        store.setState(createBaseState({ editais: [] }));

        const result = logic.getActiveDisciplinas();

        expect(result).toEqual([]);
      });

      it('handles edital without disciplinas', () => {
        const edital = createEdital({ disciplinas: null });
        store.setState(createBaseState({ editais: [edital] }));

        const result = logic.getActiveDisciplinas();

        expect(result).toEqual([]);
      });

      it('aggregates from multiple editais', () => {
        const disc1 = createDisciplina({ id: 'disc_1', nome: 'Disc 1' });
        const disc2 = createDisciplina({ id: 'disc_2', nome: 'Disc 2' });
        const edital1 = createEdital({ id: 'ed_1', disciplinas: [disc1] });
        const edital2 = createEdital({ id: 'ed_2', disciplinas: [disc2] });
        store.setState(createBaseState({ editais: [edital1, edital2] }));

        const result = logic.getActiveDisciplinas();

        expect(result).toHaveLength(2);
      });
    });
  });

  describe('Cache invalidators', () => {
    it('invalidateDiscCache clears _discCache and _discIndex', () => {
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));

      logic.getAllDisciplinas();
      expect(logic._discCache).toBeDefined();
      expect(logic._discIndex).toBeDefined();

      logic.invalidateDiscCache();

      expect(logic._discCache).toBeNull();
      expect(logic._discIndex).toBeNull();
    });

    it('invalidateRevCache clears _revDateCache', () => {
      logic._revDateCache.set('key', ['value']);

      logic.invalidateRevCache();

      expect(logic._revDateCache.size).toBe(0);
    });

    it('invalidatePendingRevCache clears _pendingRevCache', () => {
      const assunto = createAssunto({
        id: 'ass_1',
        concluido: true,
        dataConclusao: '2026-04-19',
        revisoesFetas: [],
      });
      const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));

      logic.getPendingRevisoes();
      expect(logic._pendingRevCache).toBeDefined();

      logic.invalidatePendingRevCache();

      expect(logic._pendingRevCache).toBeNull();
    });

    it('invalidateTodayCache is exported', () => {
      expect(typeof logic.invalidateTodayCache).toBeDefined();
    });

    it('invalidateStreakCache does not throw', () => {
      expect(() => logic.invalidateStreakCache()).not.toThrow();
    });

    it('invalidateDashCaches does not throw', () => {
      expect(() => logic.invalidateDashCaches()).not.toThrow();
    });
  });

  describe('Pomodoro mode', () => {
    describe('toggleTimerMode', () => {
      it('toggles pomodoro mode and updates config', () => {
        store.setState(
          createBaseState({
            config: { pomodoroMode: false, pomodoroFoco: 25, pomodoroPausa: 5 },
          })
        );

        const initialMode = logic._pomodoroMode;
        logic.toggleTimerMode();

        expect(logic._pomodoroMode).toBe(!initialMode);
        expect(store.state.config.pomodoroMode).toBe(!initialMode);
      });

      it('dispatches toast notification', () => {
        logic.toggleTimerMode();

        const toastCall = global.document.dispatchEvent.mock.calls.find(
          (c) => c[0].type === 'app:showToast'
        );
        expect(toastCall).toBeDefined();
        expect(toastCall[0].detail.msg).toMatch(/Modo (Pomodoro|Cont.nuo) ativado/);
      });
    });

    it('_pomodoroMode flag is exported', () => {
      expect(logic._pomodoroMode).toBeDefined();
      expect(typeof logic._pomodoroMode).toBe('boolean');
    });
  });

  describe('Ciclo', () => {
    describe('syncCicloToEventos', () => {
      it('does nothing when planejamento is not active', () => {
        store.setState(
          createBaseState({
            planejamento: { ativo: false, sequencia: [] },
          })
        );

        expect(() => logic.syncCicloToEventos()).not.toThrow();
      });

      it('does nothing when sequencia is empty', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [],
              disciplinas: [],
              relevancia: {},
              horarios: {},
            },
          })
        );

        logic.syncCicloToEventos();

        expect(store.state.eventos).toEqual([]);
      });

      it('creates auto-generated events from sequencia', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Matemtica' });
        const edital = createEdital({ disciplinas: [disc] });
        const seq = [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }];
        store.setState(
          createBaseState({
            editais: [edital],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: { disc_1: { peso: 100, percentual: 100 } },
              horarios: { diasAtivos: [1, 2, 3, 4, 5], horasSemanais: 20 },
              sequencia: seq,
            },
          })
        );
        logic.invalidateDiscCache();

        logic.syncCicloToEventos();

        const autoEvents = store.state.eventos.filter((e) => e.isAutoGenerated);
        expect(autoEvents.length).toBeGreaterThan(0);
        expect(autoEvents[0].discId).toBe('disc_1');
        expect(autoEvents[0].duracao).toBe(60);
        expect(autoEvents[0].status).toBe('agendado');
      });

      it('respeita a data inicial das previsoes ao gerar sessoes automaticas', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' });
        const edital = createEdital({ disciplinas: [disc] });
        const seq = [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 120, concluido: false }];
        store.setState(
          createBaseState({
            editais: [edital],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: {},
              horarios: {
                dataInicial: '2026-04-25',
                dataFinal: '2026-04-27',
                diasAtivos: [0, 1, 2, 3, 4, 5, 6],
              },
              sequencia: seq,
            },
            config: { materiasPorDia: 2, primeirodiaSemana: 1 },
          })
        );
        logic.invalidateDiscCache();

        logic.syncCicloToEventos();

        const autoDates = store.state.eventos.filter((e) => e.isAutoGenerated).map((e) => e.data);
        expect(autoDates).not.toContain('2026-04-20');
        expect(autoDates[0]).toBe('2026-04-25');
        expect(autoDates).toContain('2026-04-27');
      });

      it('removes future auto-generated events that are not studied', () => {
        const futureEvent = createEvento({
          id: 'auto_future',
          data: '2026-12-01',
          status: 'agendado',
          isAutoGenerated: true,
          tempoAcumulado: 0,
        });
        const studiedEvent = createEvento({
          id: 'auto_studied',
          data: '2026-12-01',
          status: 'estudei',
          isAutoGenerated: true,
          tempoAcumulado: 3600,
        });
        const manualEvent = createEvento({
          id: 'ev_manual',
          data: '2026-12-01',
          status: 'agendado',
          isAutoGenerated: false,
        });
        const seq = [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }];
        const disc = createDisciplina({ id: 'disc_1', nome: 'Matemtica' });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(
          createBaseState({
            eventos: [futureEvent, studiedEvent, manualEvent],
            editais: [edital],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: {},
              horarios: { diasAtivos: [1, 2, 3, 4, 5] },
              sequencia: seq,
            },
          })
        );

        logic.syncCicloToEventos();

        const remainingIds = store.state.eventos.map((e) => e.id);
        expect(remainingIds).toContain('auto_studied');
        expect(remainingIds).toContain('ev_manual');
        expect(remainingIds).not.toContain('auto_future');
      });

      it('removes pending cycle-linked sessions when wiping the planning cycle', () => {
        const pendingFromCycle = createEvento({
          id: 'ev_pending_seq',
          seqId: 'seq_1',
          status: 'agendado',
          tempoAcumulado: 0,
          isAutoGenerated: false,
        });
        const studiedFromCycle = createEvento({
          id: 'ev_studied_seq',
          seqId: 'seq_1',
          status: 'estudei',
          tempoAcumulado: 1800,
          isAutoGenerated: false,
        });
        const manualEvent = createEvento({
          id: 'ev_manual',
          status: 'agendado',
          tempoAcumulado: 0,
          isAutoGenerated: false,
        });
        store.setState(
          createBaseState({
            eventos: [pendingFromCycle, studiedFromCycle, manualEvent],
            planejamento: {
              ativo: false,
              tipo: null,
              disciplinas: [],
              relevancia: {},
              horarios: {},
              sequencia: [],
            },
          })
        );

        logic.resetCicloAndWipeEvents();

        const remainingIds = store.state.eventos.map((e) => e.id);
        expect(remainingIds).not.toContain('ev_pending_seq');
        expect(remainingIds).toContain('ev_studied_seq');
        expect(remainingIds).toContain('ev_manual');
      });

      it('skips a planned calendar slot when deleting its pending generated event', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' });
        const edital = createEdital({ disciplinas: [disc] });
        const seq = [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }];
        const generatedEvent = createEvento({
          id: 'auto_2026-04-21_0_abc',
          data: '2026-04-21',
          status: 'agendado',
          tempoAcumulado: 0,
          discId: 'disc_1',
          seqId: 'seq_1',
          slotIndex: 0,
          isAutoGenerated: true,
        });
        store.setState(
          createBaseState({
            editais: [edital],
            eventos: [generatedEvent],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: {},
              horarios: {
                dataInicial: '2026-04-21',
                dataFinal: '2026-04-21',
                diasAtivos: [0, 1, 2, 3, 4, 5, 6],
              },
              sequencia: seq,
              skippedSlots: [],
            },
            config: { materiasPorDia: 1, primeirodiaSemana: 1 },
          })
        );
        logic.invalidateDiscCache();

        logic.removeEvento('auto_2026-04-21_0_abc');

        expect(store.state.planejamento.sequencia[0]).toMatchObject({
          status: 'pulada',
          concluido: false,
        });
        expect(store.state.planejamento.sequencia[0].puladaEm).toBeTruthy();
        expect(store.state.planejamento.skippedSlots).toEqual([
          expect.objectContaining({
            data: '2026-04-21',
            slotIndex: 0,
            seqId: 'seq_1',
            eventIdOriginal: 'auto_2026-04-21_0_abc',
          }),
        ]);
        expect(store.state.eventos.some((ev) => ev.id === 'auto_2026-04-21_0_abc')).toBe(false);
        expect(
          store.state.eventos.some((ev) => ev.data === '2026-04-21' && ev.slotIndex === 0)
        ).toBe(false);
      });

      it('reduces session predictions when a planned slot was skipped', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(
          createBaseState({
            editais: [edital],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: {},
              horarios: {
                dataInicial: '2026-04-20',
                dataFinal: '2026-04-21',
                diasAtivos: [0, 1, 2, 3, 4, 5, 6],
              },
              sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
              skippedSlots: [
                {
                  data: '2026-04-20',
                  slotIndex: 1,
                  seqId: 'seq_1',
                  eventIdOriginal: 'auto_removed',
                  criadoEm: '2026-04-20T10:00:00.000Z',
                },
              ],
            },
            config: { materiasPorDia: 3, primeirodiaSemana: 1 },
          })
        );
        logic.invalidateDiscCache();

        const projection = logic.calculateCyclePredictionsModel('2026-04-20', '2026-04-21');

        expect(projection.disc_1.sessoes).toBe(5);
        expect(projection.disc_1.minutos).toBe(300);
      });

      it('uses remaining duration for partially studied planning steps in predictions and calendar events', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' });
        const edital = createEdital({ disciplinas: [disc] });
        const studied = createEvento({
          id: 'ev_partial',
          data: '2026-04-20',
          dataEstudo: '2026-04-20',
          status: 'estudei',
          tempoAcumulado: 4260,
          discId: 'disc_1',
          seqId: 'seq_1',
        });
        store.setState(
          createBaseState({
            editais: [edital],
            eventos: [studied],
            planejamento: {
              ativo: true,
              tipo: 'ciclo',
              disciplinas: ['disc_1'],
              relevancia: {},
              horarios: {
                dataInicial: '2026-04-20',
                dataFinal: '2026-04-20',
                diasAtivos: [0, 1, 2, 3, 4, 5, 6],
              },
              sequencia: [
                { id: 'seq_1', discId: 'disc_1', minutosAlvo: 120, concluido: false, status: 'pendente' },
              ],
              skippedSlots: [],
            },
            config: { materiasPorDia: 1, primeirodiaSemana: 1 },
          })
        );
        logic.invalidateDiscCache();

        const projection = logic.calculateCyclePredictionsModel('2026-04-20', '2026-04-20');
        logic.syncCicloToEventos();

        const autoEvent = store.state.eventos.find((ev) => ev.isAutoGenerated);
        expect(projection.disc_1).toEqual({ sessoes: 1, minutos: 49 });
        expect(autoEvent.duracao).toBe(49);
      });
    });

    describe('moveCicloSeq', () => {
      it('swaps sequence items in the specified direction', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [
                { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 },
                { id: 'seq_2', discId: 'disc_2', minutosAlvo: 90 },
              ],
              horarios: {},
            },
          })
        );

        logic.moveCicloSeq(0, 1);

        expect(store.state.planejamento.sequencia[0].id).toBe('seq_2');
        expect(store.state.planejamento.sequencia[1].id).toBe('seq_1');
      });

      it('does nothing when move would go out of bounds', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [
                { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 },
                { id: 'seq_2', discId: 'disc_2', minutosAlvo: 90 },
              ],
              horarios: {},
            },
          })
        );

        logic.moveCicloSeq(0, -1);

        expect(store.state.planejamento.sequencia[0].id).toBe('seq_1');
      });

      it('does nothing when planejamento is null', () => {
        store.setState(createBaseState({ planejamento: null }));

        expect(() => logic.moveCicloSeq(0, 1)).not.toThrow();
      });
    });

    describe('desfazerEtapa', () => {
      it('marks sequence item as not concluido', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: true }],
              horarios: {},
            },
          })
        );

        logic.desfazerEtapa('seq_1');

        expect(store.state.planejamento.sequencia[0].concluido).toBe(false);
      });

      it('reopens a skipped sequence item as pending', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [
                {
                  id: 'seq_1',
                  discId: 'disc_1',
                  minutosAlvo: 60,
                  concluido: false,
                  status: 'pulada',
                  puladaEm: '2026-04-20T10:00:00.000Z',
                },
              ],
              horarios: {},
            },
          })
        );

        logic.desfazerEtapa('seq_1');

        expect(store.state.planejamento.sequencia[0]).toMatchObject({
          concluido: false,
          status: 'pendente',
        });
        expect(store.state.planejamento.sequencia[0].puladaEm).toBeUndefined();
      });

      it('does nothing when seqId not found', () => {
        store.setState(
          createBaseState({
            planejamento: {
              ativo: true,
              sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: true }],
              horarios: {},
            },
          })
        );

        expect(() => logic.desfazerEtapa('seq_missing')).not.toThrow();
      });

      it('does nothing when planejamento is null', () => {
        store.setState(createBaseState({ planejamento: null }));

        expect(() => logic.desfazerEtapa('seq_1')).not.toThrow();
      });
    });

    describe('iniciarEtapaPlanejamento', () => {
      it('creates event from sequence item and starts timer', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Penal' });
        const edital = createEdital({ disciplinas: [disc] });
        const seq = [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 90, concluido: false }];
        store.setState(
          createBaseState({
            editais: [edital],
            planejamento: { ativo: true, sequencia: seq, horarios: {} },
          })
        );
        logic.invalidateDiscCache();

        logic.iniciarEtapaPlanejamento('seq_1');

        const newEvents = store.state.eventos.filter((e) => e.seqId === 'seq_1');
        expect(newEvents).toHaveLength(1);
        expect(newEvents[0].discId).toBe('disc_1');
        expect(newEvents[0].duracao).toBe(90);
        expect(newEvents[0].status).toBe('agendado');
      });

      it('asks before starting a partially studied planning step and uses the remaining duration', () => {
        const disc = createDisciplina({ id: 'disc_1', nome: 'Direito Penal' });
        const edital = createEdital({ disciplinas: [disc] });
        const studied = createEvento({
          id: 'ev_partial',
          status: 'estudei',
          tempoAcumulado: 4260,
          discId: 'disc_1',
          seqId: 'seq_1',
        });
        const seq = [
          { id: 'seq_1', discId: 'disc_1', minutosAlvo: 120, concluido: false, status: 'pendente' },
        ];
        store.setState(
          createBaseState({
            editais: [edital],
            eventos: [studied],
            planejamento: { ativo: true, sequencia: seq, horarios: {} },
          })
        );
        logic.invalidateDiscCache();

        logic.iniciarEtapaPlanejamento('seq_1');

        expect(store.state.eventos.filter((e) => e.seqId === 'seq_1' && e.status === 'agendado')).toHaveLength(0);
        expect(global.document.getElementById('modal-prompt-title').textContent).toBe('Continuar etapa parcial');

        global.document.getElementById('modal-prompt-save').onclick();

        const newEvent = store.state.eventos.find(
          (e) => e.seqId === 'seq_1' && e.status === 'agendado'
        );
        expect(newEvent.duracao).toBe(49);
      });

      it('does nothing when seqId not found', () => {
        store.setState(
          createBaseState({
            planejamento: { ativo: true, sequencia: [], horarios: {} },
          })
        );

        expect(() => logic.iniciarEtapaPlanejamento('seq_missing')).not.toThrow();
      });

      it('does nothing when planejamento is null', () => {
        store.setState(createBaseState({ planejamento: null }));

        expect(() => logic.iniciarEtapaPlanejamento('seq_1')).not.toThrow();
      });
    });
  });

  describe('Revisions', () => {
    describe('getPendingRevisoes', () => {
      it('returns pending revisions due today or before', () => {
        const assunto = createAssunto({
          id: 'ass_1',
          concluido: true,
          dataConclusao: '2026-04-19',
          revisoesFetas: [],
        });
        const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidatePendingRevCache();

        const pending = logic.getPendingRevisoes();

        expect(pending.length).toBeGreaterThan(0);
        expect(pending[0].assunto.id).toBe('ass_1');
      });

      it('skips archived disciplines', () => {
        const assunto = createAssunto({
          id: 'ass_1',
          concluido: true,
          dataConclusao: '2026-04-19',
          revisoesFetas: [],
        });
        const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto], arquivada: true });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidatePendingRevCache();

        const pending = logic.getPendingRevisoes();

        expect(pending).toEqual([]);
      });

      it('skips non-concluded assuntos', () => {
        const assunto = createAssunto({
          id: 'ass_1',
          concluido: false,
          dataConclusao: null,
          revisoesFetas: [],
        });
        const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidatePendingRevCache();

        const pending = logic.getPendingRevisoes();

        expect(pending).toEqual([]);
      });

      it('caches results', () => {
        const assunto = createAssunto({
          id: 'ass_1',
          concluido: true,
          dataConclusao: '2026-04-19',
          revisoesFetas: [],
        });
        const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
        const edital = createEdital({ disciplinas: [disc] });
        store.setState(createBaseState({ editais: [edital] }));
        logic.invalidatePendingRevCache();

        const first = logic.getPendingRevisoes();
        const second = logic.getPendingRevisoes();

        expect(first).toBe(second);
      });
    });

    describe('calcRevisionDates', () => {
      it('calculates revision dates based on completion date', () => {
        const dates = logic.calcRevisionDates('2026-04-01', [], 0);

        expect(dates).toContain('2026-04-02');
        expect(dates).toContain('2026-04-08');
        expect(dates).toContain('2026-05-01');
        expect(dates).toContain('2026-06-30');
      });

      it('skips already completed revisions', () => {
        const dates = logic.calcRevisionDates('2026-04-01', [{ data: '2026-04-02' }], 0);

        expect(dates).not.toContain('2026-04-02');
        expect(dates).toContain('2026-04-08');
      });

      it('applies adiamentos shift', () => {
        const dates = logic.calcRevisionDates('2026-04-01', [], 5);

        expect(dates).toContain('2026-04-07');
        expect(dates).toContain('2026-04-13');
      });

      it('caches results', () => {
        const first = logic.calcRevisionDates('2026-04-01', [], 0);
        const second = logic.calcRevisionDates('2026-04-01', [], 0);

        expect(first).toBe(second);
      });
    });

    describe('calculateContentProgress', () => {
      it('splits progress by topics, lessons, and combined overall percentage', () => {
        const disc = createDisciplina({
          assuntos: [
            createAssunto({ id: 'ass_1', concluido: true }),
            createAssunto({ id: 'ass_2', concluido: false }),
          ],
          aulas: [
            { id: 'aula_1', estudada: true },
            { id: 'aula_2', estudada: true },
            { id: 'aula_3', estudada: false },
            { id: 'aula_4', estudada: false },
          ],
        });

        expect(logic.calculateContentProgress(disc)).toMatchObject({
          topics: { done: 1, total: 2, pct: 50 },
          lessons: { done: 2, total: 4, pct: 50 },
          overall: { done: 3, total: 6, pct: 50 },
        });
      });

      it('uses the only available axis for overall progress when lessons are absent', () => {
        const disc = createDisciplina({
          assuntos: [
            createAssunto({ id: 'ass_1', concluido: true }),
            createAssunto({ id: 'ass_2', concluido: false }),
          ],
          aulas: [],
        });

        expect(logic.calculateContentProgress(disc).overall).toMatchObject({
          done: 1,
          total: 2,
          pct: 50,
        });
      });
    });
  });

  describe('timerIntervals', () => {
    it('is exported as an object', () => {
      expect(logic.timerIntervals).toBeDefined();
      expect(typeof logic.timerIntervals).toBe('object');
    });

    it('allows adding and removing intervals', () => {
      logic.timerIntervals['test_1'] = 123;
      expect(logic.timerIntervals['test_1']).toBe(123);

      delete logic.timerIntervals['test_1'];
      expect(logic.timerIntervals['test_1']).toBeUndefined();
    });
  });

  describe('previewClearAutoCicloEvents', () => {
    // Test "today" via fake timer is 2026-04-20 (set in beforeEach).
    function makeEv(overrides = {}) {
      return createEvento({
        id: overrides.id || 'ev_' + Math.random(),
        data: '2026-04-25',
        status: 'agendado',
        tempoAcumulado: 0,
        isAutoGenerated: true,
        ...overrides,
      });
    }

    it('marks future auto-generated agendados without progress as toDelete', () => {
      const eventos = [makeEv({ id: 'a', data: '2026-04-25' }), makeEv({ id: 'b', data: '2026-05-01' })];
      const result = logic.previewClearAutoCicloEvents(eventos);
      expect(result.toDelete.map((e) => e.id).sort()).toEqual(['a', 'b']);
    });

    it('preserves manual events (no isAutoGenerated flag)', () => {
      const eventos = [
        makeEv({ id: 'auto', isAutoGenerated: true, data: '2026-04-25' }),
        makeEv({ id: 'manual', isAutoGenerated: false, data: '2026-04-25' }),
      ];
      const result = logic.previewClearAutoCicloEvents(eventos);
      expect(result.toDelete.map((e) => e.id)).toEqual(['auto']);
      expect(result.preservedManual.map((e) => e.id)).toEqual(['manual']);
    });

    it('preserves events with tempoAcumulado > 0', () => {
      const eventos = [
        makeEv({ id: 'started', tempoAcumulado: 60, isAutoGenerated: true }),
        makeEv({ id: 'fresh', tempoAcumulado: 0, isAutoGenerated: true }),
      ];
      const result = logic.previewClearAutoCicloEvents(eventos);
      expect(result.toDelete.map((e) => e.id)).toEqual(['fresh']);
      expect(result.preservedWithProgress.map((e) => e.id)).toEqual(['started']);
    });

    it('preserves concluded events (status estudei)', () => {
      const eventos = [
        makeEv({ id: 'done', status: 'estudei', isAutoGenerated: true }),
        makeEv({ id: 'pending', status: 'agendado', isAutoGenerated: true }),
      ];
      const result = logic.previewClearAutoCicloEvents(eventos);
      expect(result.preservedConcluded.map((e) => e.id)).toEqual(['done']);
      expect(result.toDelete.map((e) => e.id)).toEqual(['pending']);
    });

    it('preserves past events (data < today)', () => {
      const eventos = [
        makeEv({ id: 'past', data: '2026-04-10', isAutoGenerated: true }),
        makeEv({ id: 'today', data: '2026-04-20', isAutoGenerated: true }),
        makeEv({ id: 'future', data: '2026-05-01', isAutoGenerated: true }),
      ];
      const result = logic.previewClearAutoCicloEvents(eventos);
      expect(result.preservedPast.map((e) => e.id)).toEqual(['past']);
      expect(result.toDelete.map((e) => e.id).sort()).toEqual(['future', 'today']);
    });

    it('does not mutate the input array', () => {
      const eventos = [makeEv({ id: 'a' }), makeEv({ id: 'b' })];
      const snapshot = JSON.stringify(eventos);
      logic.previewClearAutoCicloEvents(eventos);
      expect(JSON.stringify(eventos)).toBe(snapshot);
    });

    it('handles empty/missing input gracefully', () => {
      const result = logic.previewClearAutoCicloEvents([]);
      expect(result.toDelete).toEqual([]);
      expect(result.preservedManual).toEqual([]);
    });
  });

  describe('clearAutoCicloEvents', () => {
    function makeEv(overrides = {}) {
      return createEvento({
        id: overrides.id || 'ev_' + Math.random(),
        data: '2026-04-25',
        status: 'agendado',
        tempoAcumulado: 0,
        isAutoGenerated: true,
        ...overrides,
      });
    }

    it('removes only events that match the toDelete criteria', () => {
      store.setState(
        createBaseState({
          eventos: [
            makeEv({ id: 'auto-future', isAutoGenerated: true, data: '2026-05-01' }),
            makeEv({ id: 'manual', isAutoGenerated: false, data: '2026-05-01' }),
            makeEv({ id: 'in-progress', isAutoGenerated: true, tempoAcumulado: 30 }),
            makeEv({ id: 'done', status: 'estudei', isAutoGenerated: true }),
            makeEv({ id: 'past-auto', isAutoGenerated: true, data: '2026-04-10' }),
          ],
        })
      );
      const summary = logic.clearAutoCicloEvents();
      expect(summary.deleted).toBe(1);
      const remainingIds = store.state.eventos.map((e) => e.id).sort();
      expect(remainingIds).toEqual(['done', 'in-progress', 'manual', 'past-auto']);
    });

    it('returns zero counts and does not save when nothing matches', () => {
      store.setState(
        createBaseState({
          eventos: [makeEv({ id: 'manual', isAutoGenerated: false, data: '2026-05-01' })],
        })
      );
      const summary = logic.clearAutoCicloEvents();
      expect(summary.deleted).toBe(0);
      expect(summary.preservedManual).toBe(1);
    });

    it('dispatches app:eventosBulkDeleted with the removed ids', () => {
      store.setState(
        createBaseState({
          eventos: [
            makeEv({ id: 'a', isAutoGenerated: true, data: '2026-05-01' }),
            makeEv({ id: 'b', isAutoGenerated: true, data: '2026-05-02' }),
          ],
        })
      );
      global.document.dispatchEvent.mockClear();
      logic.clearAutoCicloEvents();
      const bulkCalls = global.document.dispatchEvent.mock.calls
        .map(([ev]) => ev)
        .filter((ev) => ev.type === 'app:eventosBulkDeleted');
      expect(bulkCalls).toHaveLength(1);
      expect([...bulkCalls[0].detail.ids].sort()).toEqual(['a', 'b']);
    });
  });
});
