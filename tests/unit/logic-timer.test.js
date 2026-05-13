import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

let store;
let state;
let timer;

function createMockDocument() {
  const elements = {};
  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
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

  return {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { contains: vi.fn(() => true), style: {} },
    elements,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  global.document = createMockDocument();
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn((fn) => ({ _interval: true, fn }));

  // Load store first (timer depends on it)
  store = await import('../../src/js/store.js?v=8.37');
  state = store.state;
  store.setState(createBaseState());

  // Load timer module from new path
  timer = await import('../../src/js/logic/timer.js?v=8.37');
});

describe('logic/timer.js - Exports exist', () => {
  it('exports timerIntervals', () => {
    expect(timer.timerIntervals).toBeDefined();
    expect(typeof timer.timerIntervals).toBe('object');
  });

  it('exports _pomodoroMode', () => {
    expect('_pomodoroMode' in timer).toBe(true);
    expect(typeof timer._pomodoroMode).toBe('boolean');
  });

  it('exports _pomodoroAlarm', () => {
    expect(timer._pomodoroAlarm).toBeDefined();
    expect(typeof timer._pomodoroAlarm.play).toBe('function');
  });

  it('exports isTimerActive', () => {
    expect(typeof timer.isTimerActive).toBe('function');
  });

  it('exports getElapsedSeconds', () => {
    expect(typeof timer.getElapsedSeconds).toBe('function');
  });

  it('exports toggleTimerMode', () => {
    expect(typeof timer.toggleTimerMode).toBe('function');
  });

  it('exports setCronoLivreGoal', () => {
    expect(typeof timer.setCronoLivreGoal).toBe('function');
  });

  it('exports setCronoLivreDisc', () => {
    expect(typeof timer.setCronoLivreDisc).toBe('function');
  });

  it('exports setCronoLivreAss', () => {
    expect(typeof timer.setCronoLivreAss).toBe('function');
  });

  it('exports reattachTimers', () => {
    expect(typeof timer.reattachTimers).toBe('function');
  });

  it('exports startTimerForEvent', () => {
    expect(typeof timer.startTimerForEvent).toBe('function');
  });

  it('exports addTimerMinutes', () => {
    expect(typeof timer.addTimerMinutes).toBe('function');
  });

  it('exports toggleTimer', () => {
    expect(typeof timer.toggleTimer).toBe('function');
  });

  it('exports discardTimer', () => {
    expect(typeof timer.discardTimer).toBe('function');
  });
});

describe('logic/timer.js - isTimerActive()', () => {
  it('returns false for event without timer', () => {
    const evento = createEvento({ id: 'ev_1', _timerStart: null });
    store.setState(createBaseState({ eventos: [evento] }));

    expect(timer.isTimerActive('ev_1')).toBe(false);
  });

  it('returns true for event with active timer', () => {
    const evento = createEvento({ id: 'ev_1', _timerStart: Date.now() });
    store.setState(createBaseState({ eventos: [evento] }));

    expect(timer.isTimerActive('ev_1')).toBe(true);
  });

  it('returns false for non-existent eventId', () => {
    store.setState(createBaseState({ eventos: [] }));
    expect(timer.isTimerActive('nonexistent')).toBe(false);
  });

  it('returns true for crono_livre when timer is active', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: Date.now(), tempoAcumulado: 600 },
    }));
    expect(timer.isTimerActive('crono_livre')).toBe(true);
  });

  it('returns false for crono_livre when timer is stopped', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: null, tempoAcumulado: 600 },
    }));
    expect(timer.isTimerActive('crono_livre')).toBe(false);
  });
});

describe('logic/timer.js - getElapsedSeconds()', () => {
  it('returns accumulated time when timer is stopped', () => {
    const ev = { tempoAcumulado: 1800, _timerStart: null };
    expect(timer.getElapsedSeconds(ev)).toBe(1800);
  });

  it('returns 0 for empty event', () => {
    const ev = { tempoAcumulado: 0, _timerStart: null };
    expect(timer.getElapsedSeconds(ev)).toBe(0);
  });

  it('returns accumulated + elapsed when timer is running', () => {
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));
    const startTime = new Date('2026-04-20T09:50:00Z').getTime();
    const ev = { tempoAcumulado: 600, _timerStart: startTime };
    // 10 minutes * 60 = 600 seconds elapsed + 600 accumulated = 1200
    expect(timer.getElapsedSeconds(ev)).toBe(1200);
  });

  it('defaults accumulated to 0 when not present', () => {
    const startTime = new Date('2026-04-20T09:59:30Z').getTime();
    const ev = { _timerStart: startTime };
    // 30 seconds elapsed, no accumulated
    expect(timer.getElapsedSeconds(ev)).toBe(30);
  });
});

describe('logic/timer.js - toggleTimer()', () => {
  it('starts timer on paused event', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    }));
    timer.toggleTimer('crono_livre');
    const s = state;
    expect(s.cronoLivre._timerStart).toBeGreaterThan(0);
    expect(s.cronoLivre.tempoAcumulado).toBe(0);
  });

  it('pauses timer on running event', () => {
    const startTime = new Date('2026-04-20T09:55:00Z').getTime();
    store.setState(createBaseState({
      cronoLivre: { _timerStart: startTime, tempoAcumulado: 0 },
    }));
    timer.toggleTimer('crono_livre');
    const s = state;
    expect(s.cronoLivre._timerStart).toBeNull();
    expect(s.cronoLivre.tempoAcumulado).toBe(300); // 5 minutes
  });
});

describe('logic/timer.js - addTimerMinutes()', () => {
  it('adds minutes to cronoLivre goal', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: null, tempoAcumulado: 0, duracaoMinutos: 30 },
    }));
    timer.addTimerMinutes('crono_livre', 15);
    const s = state;
    expect(s.cronoLivre.duracaoMinutos).toBe(45);
  });

  it('adds minutes to event duration', () => {
    const evento = createEvento({ id: 'ev_1', duracao: 60 });
    store.setState(createBaseState({ eventos: [evento] }));
    timer.addTimerMinutes('ev_1', 10);
    const s = state;
    const ev = s.eventos.find((e) => e.id === 'ev_1');
    expect(ev.duracao).toBe(70);
  });

  it('does not go below 0', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: null, tempoAcumulado: 0, duracaoMinutos: 5 },
    }));
    timer.addTimerMinutes('crono_livre', -20);
    const s = state;
    expect(s.cronoLivre.duracaoMinutos).toBe(0);
  });
});

describe('logic/timer.js - setCronoLivreGoal()', () => {
  it('sets timer goal in minutes', () => {
    store.setState(createBaseState({ cronoLivre: null }));
    timer.setCronoLivreGoal(45);
    const s = state;
    expect(s.cronoLivre.duracaoMinutos).toBe(45);
  });

  it('parses string input to integer', () => {
    store.setState(createBaseState({ cronoLivre: null }));
    timer.setCronoLivreGoal('60');
    const s = state;
    expect(s.cronoLivre.duracaoMinutos).toBe(60);
  });
});

describe('logic/timer.js - setCronoLivreDisc() and setCronoLivreAss()', () => {
  it('sets discipline on cronoLivre', () => {
    store.setState(createBaseState({ cronoLivre: null }));
    timer.setCronoLivreDisc('disc_42');
    const s = state;
    expect(s.cronoLivre.discId).toBe('disc_42');
    expect(s.cronoLivre.assId).toBeNull();
  });

  it('sets subject on cronoLivre', () => {
    store.setState(createBaseState({ cronoLivre: null }));
    timer.setCronoLivreAss('ass_7');
    const s = state;
    expect(s.cronoLivre.assId).toBe('ass_7');
  });
});

describe('logic/timer.js - reattachTimers()', () => {
  it('clears existing intervals and recreates for active timers', () => {
    store.setState(createBaseState({
      cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
      eventos: [],
    }));
    // Should not throw
    expect(() => timer.reattachTimers()).not.toThrow();
  });
});
