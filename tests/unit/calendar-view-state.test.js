import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('calendar-view.js', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('calendar state getters/setters', () => {
    it('getCalDate returns current calendar date', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const date = cal.getCalDate();
      expect(date).toBeInstanceOf(Date);
    });

    it('getCalViewMode returns default "mes"', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      expect(cal.getCalViewMode()).toBe('mes');
    });

    it('setCalDate updates calendar date', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const newDate = new Date(2024, 5, 15);
      cal.setCalDate(newDate);
      expect(cal.getCalDate()).toBe(newDate);
    });

    it('setCalViewMode updates view mode', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      cal.setCalViewMode('semana');
      expect(cal.getCalViewMode()).toBe('semana');
    });
  });

  describe('calNavigate()', () => {
    it('navigates forward by positive offset', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const startMonth = cal.getCalDate().getMonth();
      cal.calNavigate(1);
      expect(cal.getCalDate().getMonth()).toBe((startMonth + 1) % 12);
    });

    it('navigates backward by negative offset', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const startMonth = cal.getCalDate().getMonth();
      cal.calNavigate(-1);
      expect(cal.getCalDate().getMonth()).toBe((startMonth - 1 + 12) % 12);
    });

    it('navigates to current month when offset is 0', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const today = new Date();
      cal.calNavigate(0);
      const result = cal.getCalDate();
      expect(result.getMonth()).toBe(today.getMonth());
      expect(result.getFullYear()).toBe(today.getFullYear());
    });
  });

  describe('renderCalendarMobileMonth()', () => {
    it('returns HTML string with days', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const html = cal.renderCalendarMobileMonth();
      expect(typeof html).toBe('string');
      expect(html).toContain('cal-mobile-list');
    });

    it('includes day headers with date numbers', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const html = cal.renderCalendarMobileMonth();
      expect(html).toContain('cal-mobile-date');
    });

    it('includes day of week names', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const html = cal.renderCalendarMobileMonth();
      expect(html).toContain('cal-mobile-dow');
    });
  });

  describe('renderCalendarMobileWeek()', () => {
    it('returns HTML string with 7 days', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const html = cal.renderCalendarMobileWeek();
      expect(typeof html).toBe('string');
      expect(html).toContain('cal-mobile-list');
    });

    it('includes day headers', async () => {
      const cal = await import('../../src/js/views/calendar-view.js?v=8.31');
      const html = cal.renderCalendarMobileWeek();
      expect(html).toContain('cal-mobile-date');
    });
  });
});
