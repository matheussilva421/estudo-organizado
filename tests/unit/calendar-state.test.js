import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('calendar/calendar-state.js', () => {
  let storeModule;
  let componentsModule;
  let utilsModule;
  let calendarState;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));

    storeModule = {
      state: {
        config: { primeirodiaSemana: 1 },
        editais: [],
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

    calendarState = await import(
      '../../src/js/views/calendar/calendar-state.js?v=8.37'
    );
  });

  describe('state getters', () => {
    it('getCalDate returns a Date instance', () => {
      const d = calendarState.getCalDate();
      expect(d).toBeInstanceOf(Date);
    });

    it('getCalViewMode returns default "mes"', () => {
      expect(calendarState.getCalViewMode()).toBe('mes');
    });

    it('getSelectedDayStr returns today string', () => {
      expect(calendarState.getSelectedDayStr()).toBe('2026-04-29');
    });
  });

  describe('state setters', () => {
    it('setCalDate updates calendar date', () => {
      const newDate = new Date(2026, 0, 15);
      calendarState.setCalDate(newDate);
      expect(calendarState.getCalDate()).toBe(newDate);
    });

    it('setCalViewMode updates mode and calls renderCurrentView', () => {
      calendarState.setCalViewMode('semana');
      expect(calendarState.getCalViewMode()).toBe('semana');
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });

    it('setSelectedCalendarDay updates day and calls renderCurrentView', () => {
      calendarState.setSelectedCalendarDay('2026-05-01');
      expect(calendarState.getSelectedDayStr()).toBe('2026-05-01');
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });

    it('setSelectedCalendarDay uses todayStr when given null', () => {
      calendarState.setSelectedCalendarDay(null);
      expect(calendarState.getSelectedDayStr()).toBe('2026-04-29');
    });
  });

  describe('isMobileCalendar', () => {
    it('returns true when innerWidth < 768', () => {
      window.innerWidth = 500;
      expect(calendarState.isMobileCalendar()).toBe(true);
    });

    it('returns false when innerWidth >= 768', () => {
      window.innerWidth = 1024;
      expect(calendarState.isMobileCalendar()).toBe(false);
    });
  });

  describe('updateCalendarHeader', () => {
    it('updates title element when present', () => {
      const titleEl = { textContent: '' };
      const todayBtn = { classList: { contains: vi.fn(() => true), toggle: vi.fn() } };
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'cal-title') return titleEl;
        if (id === 'cal-today-btn') return todayBtn;
        return null;
      });
      calendarState.updateCalendarHeader();
      expect(titleEl.textContent).toBeTruthy();
    });

    it('handles missing title element gracefully', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      expect(() => calendarState.updateCalendarHeader()).not.toThrow();
    });
  });

  describe('resetCalDate', () => {
    it('resets to current date and re-renders', () => {
      calendarState.setCalDate(new Date(2025, 0, 1));
      calendarState.resetCalDate();
      const now = new Date();
      const cal = calendarState.getCalDate();
      expect(cal.getFullYear()).toBe(now.getFullYear());
      expect(cal.getMonth()).toBe(now.getMonth());
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });
});
