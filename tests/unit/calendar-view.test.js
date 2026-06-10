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
        editais: [],
        eventos: [],
      },
    };
    componentsModule = { renderCurrentView: vi.fn() };
    utilsModule = {
      esc: vi.fn((s) => s || ''),
      getEventStatus: vi.fn(() => 'pendente'),
      todayStr: vi.fn(() => '2026-04-29'),
      addCleanupListener: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/utils.js?v=8.37', () => utilsModule);
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      filterEventsBySelectedEdital: vi.fn((events) => events),
    }));

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

  describe('primeiro dia da semana', () => {
    it('Domingo (0) é respeitado no cabeçalho do mês (|| descartava o 0)', () => {
      storeModule.state.config.primeirodiaSemana = 0;
      const html = calendarView.renderCalendarMonth();
      const firstDow = html.match(/cal-dow">([^<]+)</)[1];
      expect(firstDow).toBe('Dom');
    });

    it('Segunda (1) continua sendo o default', () => {
      delete storeModule.state.config.primeirodiaSemana;
      const html = calendarView.renderCalendarMonth();
      const firstDow = html.match(/cal-dow">([^<]+)</)[1];
      expect(firstDow).toBe('Seg');
    });
  });

  describe('views mobile — acessibilidade por teclado', () => {
    it('dias do mês mobile são acionáveis (role=button) e chips de evento também', () => {
      storeModule.state.eventos = [
        { id: 'e1', titulo: 'Estudo', data: '2026-04-29', status: 'agendado' },
      ];
      const html = calendarView.renderCalendarMobileMonth();

      const dayTag = html.match(/<div class="cal-mobile-day[^>]*>/)[0];
      expect(dayTag).toContain('role="button"');
      expect(dayTag).toContain('tabindex="0"');

      const chipTag = html.match(/<div class="cal-event-chip[^>]*>/)[0];
      expect(chipTag).toContain('role="button"');
      expect(chipTag).toContain('tabindex="0"');
    });

    it('semana mobile segue o mesmo contrato', () => {
      storeModule.state.eventos = [
        { id: 'e1', titulo: 'Estudo', data: '2026-04-29', status: 'agendado' },
      ];
      const html = calendarView.renderCalendarMobileWeek();
      const dayTag = html.match(/<div class="cal-mobile-day[^>]*>/)[0];
      expect(dayTag).toContain('role="button"');
      const chipTag = html.match(/<div class="cal-event-chip[^>]*>/)[0];
      expect(chipTag).toContain('role="button"');
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

    it('cells are keyboard-operable with roving tabindex (exactly one tabindex=0)', () => {
      document.body.innerHTML = calendarView.renderCalendarMonth();
      const cells = [...document.querySelectorAll('.cal-cell')];
      expect(cells.length).toBeGreaterThan(27);
      cells.forEach((c) => {
        expect(c.getAttribute('role')).toBe('button');
        expect(c.getAttribute('aria-label')).toBeTruthy();
      });
      const focusable = cells.filter((c) => c.getAttribute('tabindex') === '0');
      expect(focusable).toHaveLength(1);
      // hoje (2026-04-29) está visível no mês renderizado → recebe o foco inicial
      expect(focusable[0].dataset.date).toBe('2026-04-29');
    });
  });

  describe('handleCalGridKeydown()', () => {
    function buildGrid() {
      document.body.innerHTML = `
        <div class="cal-grid">
          ${Array.from({ length: 14 }, (_, i) =>
            `<div class="cal-cell" data-date="d${i}" role="button" tabindex="${i === 0 ? '0' : '-1'}"></div>`
          ).join('')}
        </div>
      `;
      return [...document.querySelectorAll('.cal-cell')];
    }

    function press(cell, key) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: cell });
      calendarView.handleCalGridKeydown(event);
      return event;
    }

    it('ArrowRight moves focus to the next cell and updates roving tabindex', () => {
      const cells = buildGrid();
      cells[0].focus();
      const event = press(cells[0], 'ArrowRight');
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(cells[1]);
      expect(cells[0].getAttribute('tabindex')).toBe('-1');
      expect(cells[1].getAttribute('tabindex')).toBe('0');
    });

    it('ArrowDown moves focus one week ahead (7 cells)', () => {
      const cells = buildGrid();
      cells[2].focus();
      press(cells[2], 'ArrowDown');
      expect(document.activeElement).toBe(cells[9]);
    });

    it('does not move past the grid edges', () => {
      const cells = buildGrid();
      cells[0].focus();
      const event = press(cells[0], 'ArrowLeft');
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(cells[0]);
    });

    it('ignores non-arrow keys and targets outside the grid', () => {
      const cells = buildGrid();
      cells[0].focus();
      press(cells[0], 'a');
      expect(document.activeElement).toBe(cells[0]);
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      expect(() => press(outside, 'ArrowRight')).not.toThrow();
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

    it('includes selected day panel with add button for the current day', () => {
      const el = { innerHTML: '', querySelector: vi.fn(() => null) };
      storeModule.state.eventos = [
        { id: 'ev_1', titulo: 'Direito Administrativo', data: '2026-04-29', status: 'agendado' },
      ];
      calendarView.renderCalendar(el);
      expect(el.innerHTML).toContain('data-testid="calendar-day-panel"');
      expect(el.innerHTML).toContain('data-testid="calendar-day-panel-event"');
      expect(el.innerHTML).toContain('data-action="open-event-modal-date" data-date="2026-04-29"');
    });
  });
});
