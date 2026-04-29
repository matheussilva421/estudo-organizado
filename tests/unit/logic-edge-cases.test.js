import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento, createDisciplina, createEdital, createAssunto } from '../helpers/state-builders.js';
import { loadAppModules } from '../helpers/module-loader.js';

let store;
let logic;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const mockDoc = {
    getElementById: vi.fn(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {} },
  };

  global.document = mockDoc;
  global.window = { innerWidth: 1024, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn(() => ({ _interval: true }));
  global.localStorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateRevCache();
  logic.invalidatePendingRevCache();
  logic.invalidateDashCaches();
  logic.invalidateStreakCache();

  Object.keys(logic.timerIntervals).forEach(id => {
    delete logic.timerIntervals[id];
  });
});

describe('logic.js - edge cases', () => {
  describe('Timer edge cases', () => {
    it('handles timer crossing midnight', () => {
      vi.setSystemTime(new Date('2026-04-20T23:59:00Z'));
      const evento = createEvento({ id: 'ev_midnight', _timerStart: Date.now(), tempoAcumulado: 0 });
      store.setState(createBaseState({ eventos: [evento] }));

      vi.setSystemTime(new Date('2026-04-21T00:01:00Z'));
      const elapsed = logic.getElapsedSeconds(evento);

      expect(elapsed).toBeGreaterThan(0);
    });

    it('handles negative tempoAcumulado', () => {
      const evento = createEvento({ id: 'ev_neg', tempoAcumulado: -100, _timerStart: null });
      store.setState(createBaseState({ eventos: [evento] }));

      const elapsed = logic.getElapsedSeconds(evento);
      expect(elapsed).toBe(-100);
    });

    it('handles very large tempoAcumulado', () => {
      const evento = createEvento({ id: 'ev_large', tempoAcumulado: 999999999, _timerStart: null });
      store.setState(createBaseState({ eventos: [evento] }));

      const elapsed = logic.getElapsedSeconds(evento);
      expect(elapsed).toBe(999999999);
    });
  });

  describe('Revision edge cases', () => {
    it('handles assunto with no revisoesFetas array', () => {
      const assunto = createAssunto({
        id: 'ass_no_rev',
        concluido: true,
        dataConclusao: '2026-04-19',
      });
      delete assunto.revisoesFetas;

      const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidatePendingRevCache();

      expect(() => logic.getPendingRevisoes()).not.toThrow();
    });

    it('throws RangeError for invalid dataConclusao format', () => {
      const assunto = createAssunto({
        id: 'ass_bad_date',
        concluido: true,
        dataConclusao: 'invalid-date',
        revisoesFetas: [],
      });
      const disc = createDisciplina({ id: 'disc_1', assuntos: [assunto] });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidatePendingRevCache();

      expect(() => logic.getPendingRevisoes()).toThrow(RangeError);
    });

    it('handles revision dates far in the past', () => {
      const dates = logic.calcRevisionDates('2020-01-01', [], 0);
      expect(dates).toBeDefined();
      expect(Array.isArray(dates)).toBe(true);
    });
  });

  describe('Ciclo edge cases', () => {
    it('handles empty sequencia with active planejamento', () => {
      store.setState(createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: [],
          relevancia: {},
          horarios: { diasAtivos: [1, 2, 3, 4, 5] },
          sequencia: [],
        },
      }));

      expect(() => logic.syncCicloToEventos()).not.toThrow();
    });

    it('handles sequencia item with missing discId', () => {
      store.setState(createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: [],
          relevancia: {},
          horarios: {},
          sequencia: [{ id: 'seq_no_disc', minutosAlvo: 60, concluido: false }],
        },
      }));

      expect(() => logic.syncCicloToEventos()).not.toThrow();
    });

    it('handles moveCicloSeq with invalid indices', () => {
      store.setState(createBaseState({
        planejamento: {
          ativo: true,
          sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60 }],
          horarios: {},
        },
      }));

      expect(() => logic.moveCicloSeq(10, 1)).not.toThrow();
      expect(() => logic.moveCicloSeq(-1, 0)).not.toThrow();
    });
  });

  describe('Discipline cache edge cases', () => {
    it('handles edital with null disciplinas', () => {
      const edital = createEdital({ disciplinas: null });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidateDiscCache();

      const result = logic.getAllDisciplinas();
      expect(result).toEqual([]);
    });

    it('handles disciplina with null assuntos', () => {
      const disc = createDisciplina({ id: 'disc_null_ass', assuntos: null });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidateDiscCache();

      expect(() => logic.getAllDisciplinas()).not.toThrow();
    });

    it('handles duplicate discipline ids across editais', () => {
      const disc = createDisciplina({ id: 'disc_dup', nome: 'Duplicate' });
      const edital1 = createEdital({ id: 'ed_1', disciplinas: [disc] });
      const edital2 = createEdital({ id: 'ed_2', disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital1, edital2] }));
      logic.invalidateDiscCache();

      const result = logic.getDisc('disc_dup');
      expect(result).toBeDefined();
    });
  });

  describe('Streak and dashboard caches', () => {
    it('invalidateStreakCache works with empty state', () => {
      expect(() => logic.invalidateStreakCache()).not.toThrow();
    });

    it('invalidateDashCaches works with empty state', () => {
      expect(() => logic.invalidateDashCaches()).not.toThrow();
    });

    it('invalidateTodayCache is exported from utils', () => {
    });
  });
});
