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
    const mod = await import('../../src/js/views/home-view.js?v=8.37');
    expect(mod).toBeDefined();
  });

  it('calendar-view.js loads', async () => {
    const mod = await import('../../src/js/views/calendar-view.js?v=8.37');
    expect(mod).toBeDefined();
  });

  it('calendar/calendar-state.js loads and re-exports', async () => {
    const mod = await import(
      '../../src/js/views/calendar/calendar-state.js?v=8.37'
    );
    expect(mod).toBeDefined();
    expect(typeof mod.getCalDate).toBe('function');
    expect(typeof mod.getCalViewMode).toBe('function');
    expect(typeof mod.setCalDate).toBe('function');
    expect(typeof mod.setCalViewMode).toBe('function');
    expect(typeof mod.getSelectedDayStr).toBe('function');
    expect(typeof mod.setSelectedCalendarDay).toBe('function');
    expect(typeof mod.isMobileCalendar).toBe('function');
    expect(typeof mod.updateCalendarHeader).toBe('function');
    expect(typeof mod.resetCalDate).toBe('function');
  });

  it('calendar/calendar-events.js loads and re-exports', async () => {
    const mod = await import(
      '../../src/js/views/calendar/calendar-events.js?v=8.37'
    );
    expect(mod).toBeDefined();
    expect(typeof mod.getDiscColor).toBe('function');
    expect(typeof mod.resetDiscColorMemo).toBe('function');
    expect(typeof mod.indexEventsByDate).toBe('function');
  });

  it('calendar/calendar-day-panel.js loads and re-exports', async () => {
    const mod = await import(
      '../../src/js/views/calendar/calendar-day-panel.js?v=8.37'
    );
    expect(mod).toBeDefined();
    expect(typeof mod.renderSelectedDayPanel).toBe('function');
  });

  it('calendar-view.js re-exports from sub-modules', async () => {
    const mod = await import('../../src/js/views/calendar-view.js?v=8.37');
    // Verify re-exports from calendar-state
    expect(typeof mod.getCalDate).toBe('function');
    expect(typeof mod.setCalViewMode).toBe('function');
    expect(typeof mod.setSelectedCalendarDay).toBe('function');
    // Verify re-exports from calendar-events
    expect(typeof mod.getDiscColor).toBe('function');
    expect(typeof mod.indexEventsByDate).toBe('function');
    // Verify re-exports from calendar-day-panel
    expect(typeof mod.renderSelectedDayPanel).toBe('function');
    // Verify orchestrator's own exports
    expect(typeof mod.renderCalendar).toBe('function');
    expect(typeof mod.calNavigate).toBe('function');
    expect(typeof mod.renderCalendarMonth).toBe('function');
    expect(typeof mod.renderCalendarGrid).toBe('function');
    expect(typeof mod.renderCalendarWeek).toBe('function');
    expect(typeof mod.renderCalendarMobileMonth).toBe('function');
    expect(typeof mod.renderCalendarMobileWeek).toBe('function');
  });

  it('ciclo-view.js loads', async () => {
    const mod = await import('../../src/js/views/ciclo-view.js?v=8.37');
    expect(mod).toBeDefined();
    expect(typeof mod.setHideConcluidosCiclo).toBe('function');
  });

  it('config-view.js loads', async () => {
    const mod = await import('../../src/js/views/config-view.js?v=8.37');
    expect(mod).toBeDefined();
  });

  it('editais-view.js loads', async () => {
    const mod = await import('../../src/js/views/editais-view.js?v=8.37');
    expect(mod).toBeDefined();
  });

  it('habitos-view.js loads', async () => {
    const mod = await import('../../src/js/views/habitos-view.js?v=8.37');
    expect(mod).toBeDefined();
  });
});
