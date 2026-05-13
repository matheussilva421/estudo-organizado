import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('calendar/calendar-day-panel.js', () => {
  let storeModule;
  let utilsModule;
  let editalFilterModule;
  let calendarDayPanel;

  beforeEach(async () => {
    vi.resetModules();

    storeModule = {
      state: {
        eventos: [],
      },
    };
    utilsModule = {
      esc: vi.fn((s) => s || ''),
      getEventStatus: vi.fn(() => 'pendente'),
    };
    editalFilterModule = {
      filterEventsBySelectedEdital: vi.fn((events) => events),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/utils.js?v=8.37', () => utilsModule);
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => editalFilterModule);

    calendarDayPanel = await import(
      '../../src/js/views/calendar/calendar-day-panel.js?v=8.37'
    );
  });

  describe('renderSelectedDayPanel', () => {
    it('renders panel with selected date', () => {
      const html = calendarDayPanel.renderSelectedDayPanel('2026-04-29');
      expect(html).toContain('data-testid="calendar-day-panel"');
      expect(html).toContain('29/04/2026');
      expect(html).toContain('data-action="open-event-modal-date"');
    });

    it('renders empty message when no events for the day', () => {
      const html = calendarDayPanel.renderSelectedDayPanel('2026-04-29');
      expect(html).toContain('Nada agendado para este dia.');
    });

    it('renders events filtered by date', () => {
      editalFilterModule.filterEventsBySelectedEdital = vi.fn(() => [
        { id: 'ev_1', data: '2026-04-29', titulo: 'Direito Admin' },
        { id: 'ev_2', data: '2026-04-29', titulo: 'Matemática' },
        { id: 'ev_3', data: '2026-04-30', titulo: 'Outro' },
      ]);
      storeModule.state.eventos = [
        { id: 'ev_1', data: '2026-04-29', titulo: 'Direito Admin' },
        { id: 'ev_2', data: '2026-04-29', titulo: 'Matemática' },
        { id: 'ev_3', data: '2026-04-30', titulo: 'Outro' },
      ];

      const html = calendarDayPanel.renderSelectedDayPanel('2026-04-29');
      expect(html).toContain('data-testid="calendar-day-panel-event"');
      expect(html).toContain('Direito Admin');
      expect(html).toContain('Matemática');
      expect(html).not.toContain('Outro');
    });

    it('renders events sorted alphabetically', () => {
      editalFilterModule.filterEventsBySelectedEdital = vi.fn(() => [
        { id: 'ev_2', data: '2026-04-29', titulo: 'Zoo' },
        { id: 'ev_1', data: '2026-04-29', titulo: 'Abc' },
      ]);
      storeModule.state.eventos = [
        { id: 'ev_2', data: '2026-04-29', titulo: 'Zoo' },
        { id: 'ev_1', data: '2026-04-29', titulo: 'Abc' },
      ];

      const html = calendarDayPanel.renderSelectedDayPanel('2026-04-29');
      const idxAbc = html.indexOf('Abc');
      const idxZoo = html.indexOf('Zoo');
      expect(idxAbc).toBeLessThan(idxZoo);
    });

    it('renders add session button with correct date', () => {
      const html = calendarDayPanel.renderSelectedDayPanel('2026-05-15');
      expect(html).toContain('data-date="2026-05-15"');
      expect(html).toContain('Adicionar sessão');
    });
  });
});
