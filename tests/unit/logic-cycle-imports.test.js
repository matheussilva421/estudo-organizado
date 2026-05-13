import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

let store;
let state;
let cycle;
let disc;
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

  // Initialize state structure needed by cycle functions
  state.config = { ...state.config, materiasPorDia: 3 };
  state.planejamento = null;
  state.eventos = [];
  state.editais = [];

  cycle = await import('../../src/js/logic/cycle.js');
  disc = await import('../../src/js/logic/disc.js');
  logic = await import('../../src/js/logic.js?v=8.37');
});

describe('logic/cycle.js - Module integrity', () => {
  it('exports expected symbols', () => {
    expect(cycle.previewClearAutoCicloEvents).toBeTypeOf('function');
    expect(cycle.clearAutoCicloEvents).toBeTypeOf('function');
    expect(cycle.calculateRelevanceWeights).toBeTypeOf('function');
    expect(cycle.generatePlanejamento).toBeTypeOf('function');
    expect(cycle.deletePlanejamento).toBeTypeOf('function');
    expect(cycle.resetCicloAndWipeEvents).toBeTypeOf('function');
    expect(cycle.calculateCyclePredictionsModel).toBeTypeOf('function');
    expect(cycle.iniciarEtapaPlanejamento).toBeTypeOf('function');
    expect(cycle.syncCicloToEventos).toBeTypeOf('function');
    expect(cycle.moveCicloSeq).toBeTypeOf('function');
    expect(cycle.desfazerEtapa).toBeTypeOf('function');
    expect(cycle.marcarEtapaConcluida).toBeTypeOf('function');
    expect(cycle.editCicloSeqHours).toBeTypeOf('function');
  });

  it('getActiveStudyDaysFilter is NOT exported (internal)', () => {
    expect(cycle.getActiveStudyDaysFilter).toBeUndefined();
  });
});

describe('logic/disc.js - Module integrity', () => {
  it('exports expected symbols', () => {
    expect(disc.getDisc).toBeTypeOf('function');
    expect(disc.getAllDisciplinas).toBeTypeOf('function');
    expect(disc.invalidateDiscCache).toBeTypeOf('function');
    expect(disc._discCache).toBeNull();
    expect(disc._discIndex).toBeNull();
  });
});

describe('logic.js → re-exports from cycle.js (same binding)', () => {
  it('re-exports match cycle.js functions', () => {
    expect(logic.previewClearAutoCicloEvents).toBe(cycle.previewClearAutoCicloEvents);
    expect(logic.clearAutoCicloEvents).toBe(cycle.clearAutoCicloEvents);
    expect(logic.calculateRelevanceWeights).toBe(cycle.calculateRelevanceWeights);
    expect(logic.generatePlanejamento).toBe(cycle.generatePlanejamento);
    expect(logic.deletePlanejamento).toBe(cycle.deletePlanejamento);
    expect(logic.resetCicloAndWipeEvents).toBe(cycle.resetCicloAndWipeEvents);
    expect(logic.calculateCyclePredictionsModel).toBe(cycle.calculateCyclePredictionsModel);
    expect(logic.iniciarEtapaPlanejamento).toBe(cycle.iniciarEtapaPlanejamento);
    expect(logic.syncCicloToEventos).toBe(cycle.syncCicloToEventos);
    expect(logic.moveCicloSeq).toBe(cycle.moveCicloSeq);
    expect(logic.desfazerEtapa).toBe(cycle.desfazerEtapa);
    expect(logic.marcarEtapaConcluida).toBe(cycle.marcarEtapaConcluida);
    expect(logic.editCicloSeqHours).toBe(cycle.editCicloSeqHours);
  });

  it('re-exports match disc.js symbols', () => {
    expect(logic.getDisc).toBe(disc.getDisc);
    expect(logic.getAllDisciplinas).toBe(disc.getAllDisciplinas);
    expect(logic.invalidateDiscCache).toBe(disc.invalidateDiscCache);
    expect(logic._discCache).toBe(disc._discCache);
    expect(logic._discIndex).toBe(disc._discIndex);
  });
});

describe('No cross-imports (circular dependency prevention)', () => {
  it('cycle.js does not import from logic.js', () => {
    const source = read('src/js/logic/cycle.js');
    expect(source).not.toContain("from '../logic.js'");
    expect(source).not.toContain('from "../logic.js"');
  });

  it('disc.js does not import from logic.js', () => {
    const source = read('src/js/logic/disc.js');
    expect(source).not.toContain("from '../logic.js'");
    expect(source).not.toContain('from "../logic.js"');
  });

  it('cycle.js does not import from other logic/ sub-modules except timer, disc, revisions', () => {
    const source = read('src/js/logic/cycle.js');
    // Allowed: ./timer.js, ./disc.js, ./revisions.js
    const logicImports = [
      ...source.matchAll(/from\s+['"]\.\/((?!timer|disc|revisions)[a-z-]+)\.js['"]/g),
    ];
    expect(logicImports).toHaveLength(0);
  });

  it('disc.js does not import from other logic/ sub-modules', () => {
    const source = read('src/js/logic/disc.js');
    const logicImports = [...source.matchAll(/from\s+['"]\..*logic\//g)];
    const relativeImports = [...source.matchAll(/from\s+['"]\.\.\//g)];
    // Should only import from ../store.js
    expect(logicImports).toHaveLength(0);
    // Only one relative import: ../store.js
    expect(relativeImports.length).toBe(1);
    expect(source).toContain("from '../store.js?v=8.37'");
  });
});

describe('Functional: clearAutoCicloEvents via logic.js re-export', () => {
  it('categorizes auto-generated eventos correctly', () => {
    state.eventos = [
      {
        id: 'ev1',
        status: 'estudei',
        isAutoGenerated: true,
        data: '2026-04-20',
        tempoAcumulado: 0,
      },
      {
        id: 'ev2',
        status: 'agendado',
        isAutoGenerated: true,
        data: '2026-04-21',
        tempoAcumulado: 0,
      },
      {
        id: 'ev3',
        status: 'agendado',
        isAutoGenerated: false,
        data: '2026-04-21',
        tempoAcumulado: 0,
      },
      {
        id: 'ev4',
        status: 'agendado',
        isAutoGenerated: true,
        data: '2026-04-19',
        tempoAcumulado: 0,
      },
    ];

    const preview = logic.previewClearAutoCicloEvents();
    expect(preview.preservedConcluded.length).toBe(1);
    expect(preview.preservedManual.length).toBe(1);
    expect(preview.preservedPast.length).toBe(1);
    expect(preview.toDelete.length).toBe(1);
    expect(preview.toDelete[0].id).toBe('ev2');
  });

  it('clearAutoCicloEvents removes toDelete events and returns summary', () => {
    state.eventos = [
      {
        id: 'ev1',
        status: 'agendado',
        isAutoGenerated: true,
        data: '2026-04-21',
        tempoAcumulado: 0,
      },
      {
        id: 'ev2',
        status: 'agendado',
        isAutoGenerated: false,
        data: '2026-04-21',
        tempoAcumulado: 0,
      },
    ];

    const summary = logic.clearAutoCicloEvents();
    expect(summary.deleted).toBe(1);
    expect(summary.preservedManual).toBe(1);
    expect(state.eventos.length).toBe(1);
    expect(state.eventos[0].id).toBe('ev2');
  });
});

describe('Functional: calculateRelevanceWeights via logic.js re-export', () => {
  it('computes weights from importancia and conhecimento scores', () => {
    const draft = {
      d1: { importancia: '5', conhecimento: '1' },
      d2: { importancia: '3', conhecimento: '3' },
      d3: { importancia: '1', conhecimento: '5' },
    };
    const weights = logic.calculateRelevanceWeights(draft);
    // d1: 5 * (6-1) = 25, d2: 3 * (6-3) = 9, d3: 1 * (6-5) = 1
    // total = 35
    expect(weights.d1.peso).toBe(25);
    expect(weights.d2.peso).toBe(9);
    expect(weights.d3.peso).toBe(1);
    expect(weights.d1.percentual).toBeCloseTo(71.4, 0);
    expect(weights.d2.percentual).toBeCloseTo(25.7, 0);
    expect(weights.d3.percentual).toBeCloseTo(2.9, 0);
  });

  it('falls back to default 3 when importancia/conhecimento is missing or zero', () => {
    const draft = {
      d1: { importancia: '0', conhecimento: '0' },
      d2: { importancia: '', conhecimento: 'x' },
    };
    const weights = logic.calculateRelevanceWeights(draft);
    // Both get defaults: imp=3, con=3 → peso=3*(6-3)=9 each
    // total=18, each at 50%
    expect(weights.d1.peso).toBe(9);
    expect(weights.d2.peso).toBe(9);
  });

  it('handles empty input', () => {
    const weights = logic.calculateRelevanceWeights({});
    expect(weights).toEqual({});
  });
});

describe('Functional: calculateCyclePredictionsModel via logic.js re-export', () => {
  it('projects sessions within date range', () => {
    state.planejamento = {
      ativo: true,
      sequencia: [
        { id: 'seq1', discId: 'disc1', minutosAlvo: 60, concluido: false },
        { id: 'seq2', discId: 'disc2', minutosAlvo: 30, concluido: false },
      ],
      horarios: { diasAtivos: [] },
      tipo: 'ciclo',
    };
    state.config.materiasPorDia = 3;

    // 3 days * 3 materias = 9 slots → 5 slots for disc1, 4 slots for disc2
    const proj = logic.calculateCyclePredictionsModel('2026-04-20', '2026-04-22');
    expect(proj.disc1.sessoes).toBe(5);
    expect(proj.disc1.minutos).toBe(300); // 5 * 60
    expect(proj.disc2.sessoes).toBe(4);
    expect(proj.disc2.minutos).toBe(120); // 4 * 30
  });

  it('returns empty object when no planejamento', () => {
    state.planejamento = null;
    const proj = logic.calculateCyclePredictionsModel('2026-04-20', '2026-04-22');
    expect(proj).toEqual({});
  });
});
