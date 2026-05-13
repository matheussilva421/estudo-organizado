import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

let store;
let state;
let progress;
let logic;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getElementById: vi.fn(() => null),
  };
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.Notification = { permission: 'default' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn(() => ({ _interval: true }));
  global.sessionStorage = { getItem: vi.fn(), setItem: vi.fn() };

  store = await import('../../src/js/store.js?v=8.37');
  state = store.state;

  // Initialize state structure
  state.config = { ...state.config };
  state.eventos = [];
  state.editais = [];

  progress = await import('../../src/js/logic/progress.js');
  logic = await import('../../src/js/logic.js?v=8.37');
});

describe('logic/progress.js - Module integrity', () => {
  it('exports expected symbols', () => {
    expect(progress.totalStudySeconds).toBeTypeOf('function');
    expect(progress.calculateContentProgress).toBeTypeOf('function');
    expect(progress.invalidateDashCaches).toBeTypeOf('function');
    expect(progress.getAggregatedStats).toBeTypeOf('function');
    expect(progress.getPerformanceStats).toBeTypeOf('function');
    expect(progress.getPagesReadStats).toBeTypeOf('function');
    expect(progress.getSyllabusProgress).toBeTypeOf('function');
    expect(progress.invalidateStreakCache).toBeTypeOf('function');
    expect(progress.getConsistencyStreak).toBeTypeOf('function');
    expect(progress.getSubjectStats).toBeTypeOf('function');
    expect(progress.getCurrentWeekStats).toBeTypeOf('function');
    expect(progress.getAulasWeeklyStats).toBeTypeOf('function');
    expect(progress.getPreviousWeekStats).toBeTypeOf('function');
    expect(progress.getDisciplineSparkline).toBeTypeOf('function');
    expect(progress.getNextSuggestedLesson).toBeTypeOf('function');
    expect(progress.getDisciplineProgressByEdital).toBeTypeOf('function');
    expect(progress.getSyllabusProgressByEdital).toBeTypeOf('function');
    expect(progress.getPredictiveStats).toBeTypeOf('function');
  });

  it('makeProgressAxis is NOT exported (internal)', () => {
    expect(progress.makeProgressAxis).toBeUndefined();
  });
});

describe('logic.js → re-exports from progress.js (same binding)', () => {
  it('re-exports match progress.js functions', () => {
    expect(logic.totalStudySeconds).toBe(progress.totalStudySeconds);
    expect(logic.calculateContentProgress).toBe(progress.calculateContentProgress);
    expect(logic.invalidateDashCaches).toBe(progress.invalidateDashCaches);
    expect(logic.getAggregatedStats).toBe(progress.getAggregatedStats);
    expect(logic.getPerformanceStats).toBe(progress.getPerformanceStats);
    expect(logic.getPagesReadStats).toBe(progress.getPagesReadStats);
    expect(logic.getSyllabusProgress).toBe(progress.getSyllabusProgress);
    expect(logic.invalidateStreakCache).toBe(progress.invalidateStreakCache);
    expect(logic.getConsistencyStreak).toBe(progress.getConsistencyStreak);
    expect(logic.getSubjectStats).toBe(progress.getSubjectStats);
    expect(logic.getCurrentWeekStats).toBe(progress.getCurrentWeekStats);
    expect(logic.getAulasWeeklyStats).toBe(progress.getAulasWeeklyStats);
    expect(logic.getPreviousWeekStats).toBe(progress.getPreviousWeekStats);
    expect(logic.getDisciplineSparkline).toBe(progress.getDisciplineSparkline);
    expect(logic.getNextSuggestedLesson).toBe(progress.getNextSuggestedLesson);
    expect(logic.getDisciplineProgressByEdital).toBe(progress.getDisciplineProgressByEdital);
    expect(logic.getSyllabusProgressByEdital).toBe(progress.getSyllabusProgressByEdital);
    expect(logic.getPredictiveStats).toBe(progress.getPredictiveStats);
  });
});

describe('No cross-imports (circular dependency prevention)', () => {
  it('progress.js does not import from logic.js', () => {
    const source = read('src/js/logic/progress.js');
    expect(source).not.toContain("from '../logic.js'");
    expect(source).not.toContain('from "../logic.js"');
  });

  it('progress.js does not import from other logic/ sub-modules', () => {
    const source = read('src/js/logic/progress.js');
    const logicImports = [...source.matchAll(/from\s+['"]\.\/(?!progress)[a-z-]+\.js['"]/g)];
    expect(logicImports).toHaveLength(0);
  });

  it('progress.js only imports from store.js and utils.js', () => {
    const source = read('src/js/logic/progress.js');
    const relativeImports = [...source.matchAll(/from\s+['"]\.\.\//g)];
    expect(relativeImports.length).toBeLessThanOrEqual(2);
    expect(source).toContain("from '../store.js?v=8.37'");
    expect(source).toContain("from '../utils.js?v=8.37'");
  });
});

describe('Functional: totalStudySeconds', () => {
  it('sums tempoAcumulado for estudados', () => {
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 1200, dataEstudo: '2026-04-20' },
      { id: 'ev2', status: 'estudei', tempoAcumulado: 800, dataEstudo: '2026-04-19' },
      { id: 'ev3', status: 'agendado', tempoAcumulado: 500, dataEstudo: '2026-04-20' },
      { id: 'ev4', status: 'estudei', tempoAcumulado: 0, dataEstudo: '2026-04-20' },
    ];
    expect(logic.totalStudySeconds()).toBe(2000);
  });

  it('filters by days cutoff', () => {
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 600, dataEstudo: '2026-04-15' },
      { id: 'ev2', status: 'estudei', tempoAcumulado: 400, dataEstudo: '2026-04-18' },
    ];
    // Only the last 2 days (April 18-20)
    const total = logic.totalStudySeconds(2);
    expect(total).toBe(400);
  });
});

describe('Functional: calculateContentProgress', () => {
  it('computes topics and lessons progress', () => {
    const discs = [
      {
        assuntos: [{ id: 'a1', concluido: true }, { id: 'a2', concluido: false }],
        aulas: [{ estudada: true }, { estudada: true }, { estudada: false }],
      },
      {
        assuntos: [{ id: 'a3', concluido: true }],
        aulas: [{ estudada: false }],
      },
    ];
    const result = logic.calculateContentProgress(discs);
    expect(result.topics).toEqual({ done: 2, total: 3, pct: 67 });
    expect(result.lessons).toEqual({ done: 2, total: 4, pct: 50 });
    expect(result.overall.pct).toBe(59);
  });

  it('handles single disc (non-array)', () => {
    const disc = {
      assuntos: [{ concluido: false }],
      aulas: [{ estudada: true }],
    };
    const result = logic.calculateContentProgress(disc);
    expect(result.topics).toEqual({ done: 0, total: 1, pct: 0 });
    expect(result.lessons).toEqual({ done: 1, total: 1, pct: 100 });
  });

  it('handles empty input', () => {
    const result = logic.calculateContentProgress([]);
    expect(result.topics.pct).toBe(0);
    expect(result.lessons.pct).toBe(0);
    expect(result.overall.pct).toBe(0);
  });
});

describe('Functional: getAggregatedStats', () => {
  it('returns cached result on second call', () => {
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 300, dataEstudo: '2026-04-20' },
    ];
    state.editais = [
      { id: 'ed_1', nome: 'Ed', disciplinas: [{ id: 'd1', nome: 'Disc', aulas: [] }] },
    ];

    const first = logic.getAggregatedStats();
    const second = logic.getAggregatedStats();
    expect(first).toBe(second);
  });

  it('invalidates cache via invalidateDashCaches', () => {
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 300, dataEstudo: '2026-04-20' },
    ];
    state.editais = [
      { id: 'ed_1', nome: 'Ed', disciplinas: [{ id: 'd1', nome: 'Disc', aulas: [] }] },
    ];

    const first = logic.getAggregatedStats();
    logic.invalidateDashCaches();
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 300, dataEstudo: '2026-04-20' },
      { id: 'ev2', status: 'estudei', tempoAcumulado: 600, dataEstudo: '2026-04-20' },
    ];
    const second = logic.getAggregatedStats();
    expect(first).not.toBe(second);
    expect(second.weekTotalSeconds).toBe(900);
  });
});

describe('Functional: getPredictiveStats via logic.js re-export', () => {
  it('returns verde status when on track', () => {
    state.eventos = [
      {
        id: 'ev1',
        status: 'estudei',
        tempoAcumulado: 7200,
        dataEstudo: '2026-04-20',
      },
    ];
    state.editais = [
      { id: 'ed_1', nome: 'Ed', disciplinas: [{ id: 'd1', nome: 'Disc', aulas: [] }] },
    ];

    const result = logic.getPredictiveStats(1); // 1h meta
    expect(result.status).toBe('verde');
    expect(result.projectedPerc).toBeGreaterThanOrEqual(100);
  });

  it('calculates projection correctly', () => {
    state.eventos = [
      {
        id: 'ev1',
        status: 'estudei',
        tempoAcumulado: 3600,
        dataEstudo: '2026-04-20',
      },
    ];
    state.editais = [
      { id: 'ed_1', nome: 'Ed', disciplinas: [{ id: 'd1', nome: 'Disc', aulas: [] }] },
    ];

    const result = logic.getPredictiveStats(10); // 10h meta = 36000s
    // 3600 done in 1 day → burn rate 3600/day → projected = 3600 + 3600*6 = 25200
    expect(result.projectedSeconds).toBeCloseTo(25200, -1);
    expect(result.projectedPerc).toBeCloseTo(70, 0);
  });
});

describe('Functional: getNextSuggestedLesson', () => {
  it('finds first non-studied lesson', () => {
    state.editais = [
      {
        id: 'ed_1',
        nome: 'Edital',
        disciplinas: [
          {
            id: 'd1',
            nome: 'Disc',
            aulas: [
              { id: 'a1', nome: 'Aula 1', estudada: true },
              { id: 'a2', nome: 'Aula 2', estudada: false },
            ],
          },
        ],
      },
    ];
    const lesson = logic.getNextSuggestedLesson();
    expect(lesson).toBeTruthy();
    expect(lesson.aula.id).toBe('a2');
  });

  it('skips archived disciplines', () => {
    state.editais = [
      {
        id: 'ed_1',
        nome: 'Edital',
        disciplinas: [
          {
            id: 'd1',
            nome: 'Disc',
            arquivada: true,
            aulas: [{ id: 'a1', estudada: false }],
          },
          {
            id: 'd2',
            nome: 'Active',
            aulas: [{ id: 'a2', estudada: false }],
          },
        ],
      },
    ];
    const lesson = logic.getNextSuggestedLesson();
    expect(lesson.aula.id).toBe('a2');
  });

  it('returns null when no pending lessons', () => {
    state.editais = [
      {
        id: 'ed_1',
        nome: 'Edital',
        disciplinas: [
          {
            id: 'd1',
            nome: 'Disc',
            aulas: [{ id: 'a1', estudada: true }],
          },
        ],
      },
    ];
    expect(logic.getNextSuggestedLesson()).toBeNull();
  });
});

describe('Functional: getConsistencyStreak via logic.js re-export', () => {
  it('computes streak from study dates', () => {
    state.eventos = [
      { id: 'ev1', status: 'estudei', tempoAcumulado: 100, dataEstudo: '2026-04-20' },
      { id: 'ev2', status: 'estudei', tempoAcumulado: 100, dataEstudo: '2026-04-19' },
      { id: 'ev3', status: 'estudei', tempoAcumulado: 100, dataEstudo: '2026-04-18' },
    ];
    state.editais = [
      { id: 'ed_1', nome: 'Ed', disciplinas: [{ id: 'd1', nome: 'Disc', aulas: [] }] },
    ];

    // Need to invalidate dash cache since getConsistencyStreak reads from getAggregatedStats
    logic.invalidateDashCaches();
    logic.invalidateStreakCache();

    const streak = logic.getConsistencyStreak();
    expect(streak.currentStreak).toBeGreaterThanOrEqual(3);
  });
});

describe('Functional: getDisciplineProgressByEdital', () => {
  it('groups progress by edital', () => {
    state.eventos = [];
    state.editais = [
      {
        id: 'ed_1',
        nome: 'Edital 1',
        disciplinas: [
          {
            id: 'd1',
            nome: 'Disc A',
            aulas: [{ estudada: true }, { estudada: false }, { estudada: false }],
          },
          {
            id: 'd2',
            nome: 'Disc B',
            aulas: [{ estudada: true }],
          },
        ],
      },
    ];
    logic.invalidateDashCaches();

    const result = logic.getDisciplineProgressByEdital();
    expect(result.length).toBe(1);
    expect(result[0].edital.nome).toBe('Edital 1');
    expect(result[0].disciplinas.length).toBe(2);

    const discA = result[0].disciplinas.find((d) => d.disc.nome === 'Disc A');
    expect(discA.total).toBe(3);
    expect(discA.estudadas).toBe(1);
    expect(discA.percent).toBe(33);

    const discB = result[0].disciplinas.find((d) => d.disc.nome === 'Disc B');
    expect(discB.total).toBe(1);
    expect(discB.estudadas).toBe(1);
    expect(discB.percent).toBe(100);
  });
});
