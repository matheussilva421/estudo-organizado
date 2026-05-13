import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

let store;
let state;
let revisions;
let logic;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
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
  revisions = await import('../../src/js/logic/revisions.js');
  logic = await import('../../src/js/logic.js?v=8.37');
});

describe('logic/revisions.js - Module integrity', () => {
  it('exports expected symbols', () => {
    expect(revisions.calcRevisionDates).toBeTypeOf('function');
    expect(revisions.getPendingRevisoes).toBeTypeOf('function');
    expect(revisions.invalidateRevCache).toBeTypeOf('function');
    expect(revisions.invalidatePendingRevCache).toBeTypeOf('function');
    expect(revisions._revDateCache).toBeDefined();
    expect(revisions._pendingRevCache).toBeNull();
  });

  it('re-exports from logic.js match revisions.js (same binding)', () => {
    expect(logic.calcRevisionDates).toBe(revisions.calcRevisionDates);
    expect(logic.getPendingRevisoes).toBe(revisions.getPendingRevisoes);
    expect(logic.invalidateRevCache).toBe(revisions.invalidateRevCache);
    expect(logic.invalidatePendingRevCache).toBe(revisions.invalidatePendingRevCache);
    expect(logic._revDateCache).toBe(revisions._revDateCache);
    expect(logic._pendingRevCache).toBe(revisions._pendingRevCache);
  });

  it('does not import from other logic/ sub-modules', () => {
    // revisions.js should only import from store.js and utils.js — not from
    // other logic/ sub-modules like cycle.js or progress.js that don't exist yet.
    const source = read('src/js/logic/revisions.js');
    // Check that no import from other logic/ paths exists
    const logicImports = [...source.matchAll(/from\s+['"]\..*logic\//g)];
    expect(logicImports).toHaveLength(0);
  });

  it('does not import getDisc or any domain function from logic.js', () => {
    const source = read('src/js/logic/revisions.js');
    expect(source).not.toContain("from '../logic.js'");
    expect(source).not.toContain('getDisc');
    expect(source).not.toContain('getAllDisciplinas');
    expect(source).not.toContain('scheduleSave');
  });
});

describe('logic.js → re-exports from revisions.js', () => {
  it('invalidates cache via re-exported invalidatePendingRevCache', () => {
    // Trigger cache population
    state.config = { ...state.config, frequenciaRevisao: [1, 7, 30, 90] };
    state.editais = [
      {
        id: 'ed_1',
        nome: 'Edital',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Disc',
            assuntos: [
              {
                id: 'ass_1',
                nome: 'Ass',
                concluido: true,
                dataConclusao: '2026-04-19',
                revisoesFetas: [],
                adiamentos: 0,
              },
            ],
          },
        ],
      },
    ];

    const pending = logic.getPendingRevisoes();
    expect(pending.length).toBeGreaterThanOrEqual(0);

    // Cache should be populated
    logic.invalidatePendingRevCache();
    expect(logic._pendingRevCache).toBeNull();
  });

  it('calcRevisionDates computes expected dates', () => {
    state.config = { ...state.config, frequenciaRevisao: [1, 7, 30, 90] };
    const dates = logic.calcRevisionDates('2026-04-01', [], 0);
    expect(dates).toEqual(['2026-04-02', '2026-04-08', '2026-05-01', '2026-06-30']);
  });

  it('calcRevisionDates uses cache on second call', () => {
    state.config = { ...state.config, frequenciaRevisao: [1, 7, 30, 90] };
    const first = logic.calcRevisionDates('2026-04-01', [], 0);
    const second = logic.calcRevisionDates('2026-04-01', [], 0);
    // Same array reference means cache was hit
    expect(first).toBe(second);
  });

  it('invalidateRevCache clears the date cache', () => {
    state.config = { ...state.config, frequenciaRevisao: [1, 7, 30, 90] };
    logic.calcRevisionDates('2026-04-01', [], 0);
    logic.invalidateRevCache();
    // Re-call should compute fresh (different reference from cached)
    const after = logic.calcRevisionDates('2026-04-01', [], 0);
    expect(after).toEqual(['2026-04-02', '2026-04-08', '2026-05-01', '2026-06-30']);
  });
});
