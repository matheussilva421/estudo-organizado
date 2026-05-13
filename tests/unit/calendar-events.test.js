import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('calendar/calendar-events.js', () => {
  let storeModule;
  let editalFilterModule;
  let calendarEvents;

  beforeEach(async () => {
    vi.resetModules();

    storeModule = {
      state: {
        editais: [],
        eventos: [],
      },
    };
    editalFilterModule = {
      filterEventsBySelectedEdital: vi.fn((events) => events),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => editalFilterModule);

    // Reset the module's memo state by re-importing
    calendarEvents = await import(
      '../../src/js/views/calendar/calendar-events.js?v=8.37'
    );
  });

  describe('getDiscColor', () => {
    it('returns empty string for falsy discId', () => {
      expect(calendarEvents.getDiscColor('')).toBe('');
      expect(calendarEvents.getDiscColor(null)).toBe('');
      expect(calendarEvents.getDiscColor(undefined)).toBe('');
    });

    it('returns disc color from editais', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          cor: '#ff0000',
          disciplinas: [
            { id: 'disc_1', cor: '#00ff00' },
            { id: 'disc_2' },
          ],
        },
      ];
      calendarEvents.resetDiscColorMemo();
      expect(calendarEvents.getDiscColor('disc_1')).toBe('#00ff00');
    });

    it('falls back to edital color when disc has no color', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          cor: '#ff0000',
          disciplinas: [{ id: 'disc_2' }],
        },
      ];
      calendarEvents.resetDiscColorMemo();
      expect(calendarEvents.getDiscColor('disc_2')).toBe('#ff0000');
    });

    it('returns empty string for unknown discId', () => {
      storeModule.state.editais = [];
      calendarEvents.resetDiscColorMemo();
      expect(calendarEvents.getDiscColor('disc_unknown')).toBe('');
    });
  });

  describe('resetDiscColorMemo', () => {
    it('clears the memo cache', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          cor: '#ff0000',
          disciplinas: [{ id: 'disc_1', cor: '#00ff00' }],
        },
      ];
      calendarEvents.resetDiscColorMemo();
      expect(calendarEvents.getDiscColor('disc_1')).toBe('#00ff00');

      // Now change state and reset
      storeModule.state.editais = [];
      calendarEvents.resetDiscColorMemo();
      // After reset, memo is rebuilt from new state
      expect(calendarEvents.getDiscColor('disc_1')).toBe('');
    });
  });

  describe('indexEventsByDate', () => {
    it('returns empty object for empty events', () => {
      storeModule.state.eventos = [];
      const result = calendarEvents.indexEventsByDate();
      expect(result).toEqual({});
    });

    it('groups events by date', () => {
      storeModule.state.eventos = [
        { id: 'ev_1', data: '2026-04-29', titulo: 'A' },
        { id: 'ev_2', data: '2026-04-29', titulo: 'B' },
        { id: 'ev_3', data: '2026-04-30', titulo: 'C' },
      ];
      const result = calendarEvents.indexEventsByDate();
      expect(Object.keys(result).sort()).toEqual(['2026-04-29', '2026-04-30']);
      expect(result['2026-04-29']).toHaveLength(2);
      expect(result['2026-04-30']).toHaveLength(1);
    });

    it('uses filterEventsBySelectedEdital', () => {
      editalFilterModule.filterEventsBySelectedEdital = vi.fn(() => [
        { id: 'ev_filtered', data: '2026-04-29' },
      ]);
      storeModule.state.eventos = [
        { id: 'ev_1', data: '2026-04-29' },
        { id: 'ev_2', data: '2026-04-30' },
      ];
      const result = calendarEvents.indexEventsByDate();
      expect(editalFilterModule.filterEventsBySelectedEdital).toHaveBeenCalledWith(
        storeModule.state.eventos,
        { allowAll: false }
      );
      expect(Object.keys(result)).toEqual(['2026-04-29']);
    });
  });
});
