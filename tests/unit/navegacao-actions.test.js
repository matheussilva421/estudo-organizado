import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/navegacao.js', () => {
  let registerAction;
  let appModule;
  let viewsModule;
  let calendarView;
  let componentsModule;
  let dashboardContext;
  let editalFilter;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    appModule = {
      navigate: vi.fn(),
      closeSidebar: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleSidebarCollapse: vi.fn(),
      applyTheme: vi.fn(),
      promptDataProva: vi.fn(),
      promptMetas: vi.fn(),
      toggleCicloFin: vi.fn(),
    };
    viewsModule = {
      debouncedOnSearch: vi.fn(),
      onSearchFocus: vi.fn(),
      clearSearch: vi.fn(),
      setDashPeriod: vi.fn(),
      closeDiscDashboard: vi.fn(),
    };
    calendarView = {
      setCalViewMode: vi.fn(),
      calNavigate: vi.fn(),
      setSelectedCalendarDay: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn() };
    dashboardContext = { setActiveDashboardDiscCtx: vi.fn() };
    editalFilter = { setSelectedEditalId: vi.fn() };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/views.js?v=8.37', () => viewsModule);
    vi.doMock('../../src/js/views/calendar-view.js?v=8.37', () => calendarView);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => dashboardContext);
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => editalFilter);

    await import('../../src/js/ui/actions/navegacao.js');
  });

  it('registers navigation actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('navigate');
    expect(calls).toContain('navigate-with-ctx');
    expect(calls).toContain('navigate-clear-search');
    expect(calls).toContain('search-input');
    expect(calls).toContain('search-focus');
    // 'clear-search' removido: registro morto (markup usa 'navigate-clear-search')
    expect(calls).not.toContain('clear-search');
    expect(calls).toContain('set-cal-view-mode');
    expect(calls).toContain('cal-navigate');
    expect(calls).toContain('cal-today');
    expect(calls).toContain('select-calendar-day');
    expect(calls).toContain('set-edital-filter');
    expect(calls).toContain('set-dash-period');
    expect(calls).toContain('close-sidebar');
    expect(calls).toContain('toggle-sidebar');
    expect(calls).toContain('toggle-sidebar-collapse');
    expect(calls).toContain('toggle-theme');
    expect(calls).toContain('prompt-prova');
    expect(calls).toContain('prompt-metas');
    expect(calls).toContain('close-disc-dashboard');
    expect(calls).toContain('toggle-ciclo-fin');
  });

  it('navigate handler calls navigate with view', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'navigate')[1];
    handler({ dataset: { view: 'dashboard' } });
    expect(appModule.navigate).toHaveBeenCalledWith('dashboard');
  });

  it('navigate handler skips when no view', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'navigate')[1];
    handler({ dataset: {} });
    expect(appModule.navigate).not.toHaveBeenCalled();
  });

  it('navigate-with-ctx handler navigates when ctx is provided', async () => {
    const ctx = JSON.stringify({ discId: 'disc_1' });
    const handler = registerAction.mock.calls.find(c => c[0] === 'navigate-with-ctx')[1];
    handler({ dataset: { view: 'dashboard', ctx: encodeURIComponent(ctx) } });
    await new Promise(r => setTimeout(r, 10));
    expect(appModule.navigate).toHaveBeenCalledWith('dashboard');
  });

  it('navigate-with-ctx navigates without ctx', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'navigate-with-ctx')[1];
    handler({ dataset: { view: 'home' } });
    expect(appModule.navigate).toHaveBeenCalledWith('home');
    expect(dashboardContext.setActiveDashboardDiscCtx).not.toHaveBeenCalled();
  });

  it('navigate-clear-search calls navigate and clearSearch', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'navigate-clear-search')[1];
    handler({ dataset: { view: 'eventos' } });
    expect(appModule.navigate).toHaveBeenCalledWith('eventos');
    expect(viewsModule.clearSearch).toHaveBeenCalled();
  });

  it('search-input handler calls debouncedOnSearch with value', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'search-input')[1];
    handler({ value: 'test query' });
    expect(viewsModule.debouncedOnSearch).toHaveBeenCalledWith('test query');
  });

  it('set-cal-view-mode handler passes mode', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-cal-view-mode')[1];
    handler({ dataset: { mode: 'semana' } });
    expect(calendarView.setCalViewMode).toHaveBeenCalledWith('semana');
  });

  it('cal-navigate handler parses direction', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'cal-navigate')[1];
    handler({ dataset: { dir: '1' } });
    expect(calendarView.calNavigate).toHaveBeenCalledWith(1);
  });

  it('cal-today handler calls calNavigate(0)', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'cal-today')[1];
    handler({});
    expect(calendarView.calNavigate).toHaveBeenCalledWith(0);
  });

  it('select-calendar-day handler updates selected day', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'select-calendar-day')[1];
    handler({ dataset: { date: '2026-05-12' } });
    expect(calendarView.setSelectedCalendarDay).toHaveBeenCalledWith('2026-05-12');
  });

  it('set-dash-period handler parses period', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-dash-period')[1];
    handler({ dataset: { period: '30' } });
    expect(viewsModule.setDashPeriod).toHaveBeenCalledWith(30);
  });

  it('set-dash-period handles null period', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-dash-period')[1];
    handler({ dataset: { period: 'null' } });
    expect(viewsModule.setDashPeriod).toHaveBeenCalledWith(null);
  });

  it('toggle-theme calls applyTheme(true) and renderCurrentView', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-theme')[1];
    handler({});
    expect(appModule.applyTheme).toHaveBeenCalledWith(true);
    expect(componentsModule.renderCurrentView).toHaveBeenCalled();
  });

  it('set-edital-filter stores selection and re-renders', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-edital-filter')[1];
    handler({ value: 'ed_2' });
    expect(editalFilter.setSelectedEditalId).toHaveBeenCalledWith('ed_2');
    expect(componentsModule.renderCurrentView).toHaveBeenCalled();
  });

  it('toggle-ciclo-fin handler passes checked state', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'toggle-ciclo-fin')[1];
    handler({ checked: true });
    expect(appModule.toggleCicloFin).toHaveBeenCalledWith(true);
  });
});
