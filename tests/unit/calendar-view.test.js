import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views/calendar-view.js', () => {
  let storeModule;
  let componentsModule;
  let utilsModule;
  let calendarView;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    storeModule = {
      state: {
        config: { primeirodiaSemana: 1 },
        eventos: [],
      },
    };
    componentsModule = { renderCurrentView: vi.fn() };
    utilsModule = {
      esc: vi.fn((s) => s || ''),
      getEventStatus: vi.fn(() => 'pendente'),
      todayStr: vi.fn(() => '2026-04-29'),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/utils.js?v=8.37', () => utilsModule);

    calendarView = await import('../../src/js/views/calendar-view.js?v=8.37');
  });

  describe('state getters/setters', () => {
    it('getCalDate returns current calendar date', () => {
      const d = calendarView.getCalDate();
      expect(d).toBeInstanceOf(Date);
    });

    it('getCalViewMode returns default mes', () => {
      expect(calendarView.getCalViewMode()).toBe('mes');
    });

    it('setCalDate updates calendar date', () => {
      const newDate = new Date(2026, 0, 15);
      calendarView.setCalDate(newDate);
      expect(calendarView.getCalDate()).toBe(newDate);
    });

    it('setCalViewMode updates mode and re-renders', () => {
      calendarView.setCalViewMode('semana');
      expect(calendarView.getCalViewMode()).toBe('semana');
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('calNavigate()', () => {
    it('navigates forward by 1 month in mes mode', () => {
      const start = new Date(calendarView.getCalDate());
      calendarView.calNavigate(1);
      const end = calendarView.getCalDate();
      expect(end.getMonth()).toBe((start.getMonth() + 1) % 12);
    });

    it('navigates backward by 1 month in mes mode', () => {
      const start = new Date(calendarView.getCalDate());
      calendarView.calNavigate(-1);
      const end = calendarView.getCalDate();
      expect(end.getMonth()).toBe((start.getMonth() - 1 + 12) % 12);
    });

    it('navigates by 7 days in semana mode', () => {
      calendarView.setCalViewMode('semana');
      const start = new Date(calendarView.getCalDate());
      calendarView.calNavigate(1);
      const end = calendarView.getCalDate();
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('navigates backward by 7 days in semana mode', () => {
      calendarView.setCalViewMode('semana');
      const start = new Date(calendarView.getCalDate());
      calendarView.calNavigate(-1);
      const end = calendarView.getCalDate();
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(-7);
    });
  });

  describe('resetCalDate()', () => {
    it('resets to current date and re-renders', () => {
      calendarView.setCalDate(new Date(2025, 0, 1));
      calendarView.resetCalDate();
      const now = new Date();
      const cal = calendarView.getCalDate();
      expect(cal.getFullYear()).toBe(now.getFullYear());
      expect(cal.getMonth()).toBe(now.getMonth());
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('updateCalendarHeader()', () => {
    it('updates title element when present', () => {
      const titleEl = { textContent: '' };
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'cal-title') return titleEl;
        return null;
      });
      calendarView.updateCalendarHeader();
      expect(titleEl.textContent).toBeTruthy();
    });

    it('handles missing title element gracefully', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      expect(() => calendarView.updateCalendarHeader()).not.toThrow();
    });
  });

  describe('renderCalendarMonth()', () => {
    it('returns HTML with calendar structure', () => {
      const html = calendarView.renderCalendarMonth();
      expect(html).toContain('cal-grid');
    });

    it('includes weekday headers', () => {
      const html = calendarView.renderCalendarMonth();
      expect(html).toContain('cal-dow');
    });
  });

  describe('renderCalendarGrid()', () => {
    it('returns month grid HTML', () => {
      const html = calendarView.renderCalendarGrid();
      expect(html).toContain('cal-grid');
    });
  });

  describe('renderCalendarWeek()', () => {
    it('returns week view HTML', () => {
      calendarView.setCalViewMode('semana');
      const html = calendarView.renderCalendarWeek();
      expect(html).toContain('grid-template-columns');
    });
  });

  describe('renderCalendarMobileMonth()', () => {
    it('returns mobile month HTML', () => {
      const html = calendarView.renderCalendarMobileMonth();
      expect(html).toContain('cal-mobile-day');
    });
  });

  describe('renderCalendarMobileWeek()', () => {
    it('returns mobile week HTML', () => {
      const html = calendarView.renderCalendarMobileWeek();
      expect(html).toContain('cal-mobile-day');
    });
  });

  describe('renderCalendar()', () => {
    it('renders calendar into element', () => {
      const el = { innerHTML: '', querySelector: vi.fn(() => null) };
      calendarView.renderCalendar(el);
      expect(el.innerHTML).toContain('cal-header');
      expect(el.innerHTML).toContain('cal-grid');
    });

    it('uses a dedicated shell class so month content can escape generic card clipping', () => {
      const el = { innerHTML: '', querySelector: vi.fn(() => null) };
      calendarView.renderCalendar(el);
      expect(el.innerHTML).toContain('calendar-shell-card');
    });

    it('includes navigation buttons with data-action', () => {
      const el = { innerHTML: '', querySelector: vi.fn(() => null) };
      calendarView.renderCalendar(el);
      expect(el.innerHTML).toContain('data-action="cal-navigate"');
      expect(el.innerHTML).toContain('data-action="cal-today"');
    });

    it('includes view mode tabs', () => {
      const el = { innerHTML: '', querySelector: vi.fn(() => null) };
      calendarView.renderCalendar(el);
      expect(el.innerHTML).toContain('data-action="set-cal-view-mode"');
      expect(el.innerHTML).toContain('data-mode="mes"');
      expect(el.innerHTML).toContain('data-mode="semana"');
    });
  });
});
