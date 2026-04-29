import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();

  global.window = {
    innerWidth: 1024,
    EstudoApp: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  global.document = {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    body: { style: {} },
  };

  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
});

describe('view modules load without errors', () => {
  it('home-view.js loads', async () => {
    const mod = await import('../../src/js/views/home-view.js?v=8.29');
    expect(mod).toBeDefined();
  });

  it('calendar-view.js loads', async () => {
    const mod = await import('../../src/js/views/calendar-view.js?v=8.29');
    expect(mod).toBeDefined();
  });

  it('ciclo-view.js loads', async () => {
    const mod = await import('../../src/js/views/ciclo-view.js?v=8.29');
    expect(mod).toBeDefined();
    expect(typeof mod.setHideConcluidosCiclo).toBe('function');
  });

  it('config-view.js loads', async () => {
    const mod = await import('../../src/js/views/config-view.js?v=8.29');
    expect(mod).toBeDefined();
  });

  it('editais-view.js loads', async () => {
    const mod = await import('../../src/js/views/editais-view.js?v=8.29');
    expect(mod).toBeDefined();
  });

  it('habitos-view.js loads', async () => {
    const mod = await import('../../src/js/views/habitos-view.js?v=8.29');
    expect(mod).toBeDefined();
  });
});
