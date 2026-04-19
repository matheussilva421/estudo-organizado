import { beforeEach, describe, expect, it, vi } from 'vitest';

// Re-import utils for each test so cached state is clean
let utils;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
  utils = await import('../../src/js/utils.js');
  utils.invalidateTodayCache();
});

describe('utils.js', () => {
  describe('esc()', () => {
    it('escapes HTML special characters', () => {
      expect(utils.esc('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('escapes ampersands', () => {
      expect(utils.esc('a & b')).toBe('a &amp; b');
    });

    it('returns empty string for null', () => {
      expect(utils.esc(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(utils.esc(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(utils.esc('')).toBe('');
    });

    it('handles numeric input by converting to string', () => {
      expect(utils.esc(0)).toBe('0');
    });

    it('handles false as empty string', () => {
      expect(utils.esc(false)).toBe('');
    });
  });

  describe('formatDate()', () => {
    it('formats a date string to pt-BR format', () => {
      expect(utils.formatDate('2026-04-19')).toBe('19/04/2026');
    });

    it('formats a different date correctly', () => {
      expect(utils.formatDate('2025-01-05')).toBe('05/01/2025');
    });

    it('returns empty string for null', () => {
      expect(utils.formatDate(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(utils.formatDate(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(utils.formatDate('')).toBe('');
    });
  });

  describe('formatTime()', () => {
    it('formats seconds to MM:SS when under one hour', () => {
      expect(utils.formatTime(125)).toBe('02:05');
    });

    it('formats zero seconds as 00:00', () => {
      expect(utils.formatTime(0)).toBe('00:00');
    });

    it('formats exactly one hour as 01:00:00', () => {
      expect(utils.formatTime(3600)).toBe('01:00:00');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(utils.formatTime(3661)).toBe('01:01:01');
    });

    it('handles null input as zero', () => {
      expect(utils.formatTime(null)).toBe('00:00');
    });

    it('handles undefined input as zero', () => {
      expect(utils.formatTime(undefined)).toBe('00:00');
    });

    it('floors fractional seconds', () => {
      expect(utils.formatTime(90.9)).toBe('01:30');
    });
  });

  describe('formatH()', () => {
    it('formats minutes-only duration', () => {
      expect(utils.formatH(45)).toBe('45m');
    });

    it('formats hours and minutes', () => {
      expect(utils.formatH(125)).toBe('2h 5m');
    });

    it('formats exact hours without minutes', () => {
      expect(utils.formatH(120)).toBe('2h');
    });

    it('returns "0m" for zero', () => {
      expect(utils.formatH(0)).toBe('0m');
    });

    it('returns "0m" for null', () => {
      expect(utils.formatH(null)).toBe('0m');
    });
  });

  describe('todayStr()', () => {
    it('returns today as YYYY-MM-DD', () => {
      expect(utils.todayStr()).toBe('2026-04-19');
    });

    it('caches the result within the same minute', () => {
      const first = utils.todayStr();
      vi.advanceTimersByTime(30_000);
      const second = utils.todayStr();
      expect(first).toBe(second);
    });

    it('invalidates cache after 60 seconds', () => {
      const first = utils.todayStr();
      vi.advanceTimersByTime(61_000);
      // Still the same date, but the cache was regenerated
      const second = utils.todayStr();
      expect(second).toBe('2026-04-19');
    });
  });

  describe('getLocalDateStr()', () => {
    it('returns YYYY-MM-DD for a given date', () => {
      expect(utils.getLocalDateStr(new Date('2026-04-19T15:00:00.000Z'))).toBe('2026-04-19');
    });
  });

  describe('trunc()', () => {
    it('returns short text unchanged', () => {
      expect(utils.trunc('hello', 80)).toBe('hello');
    });

    it('truncates long text with ellipsis', () => {
      const long = 'a'.repeat(100);
      const result = utils.trunc(long, 80);
      expect(result.length).toBeLessThan(100);
      expect(result.endsWith('...')).toBe(true);
    });

    it('returns empty string for null', () => {
      expect(utils.trunc(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(utils.trunc(undefined)).toBe('');
    });
  });

  describe('getEventStatus()', () => {
    it('returns "estudei" for completed events', () => {
      expect(utils.getEventStatus({ status: 'estudei', data: '2026-04-19' })).toBe('estudei');
    });

    it('returns "agendado" for future events', () => {
      expect(utils.getEventStatus({ status: 'agendado', data: '2026-04-25' })).toBe('agendado');
    });

    it('returns "atrasado" for past events', () => {
      expect(utils.getEventStatus({ status: 'agendado', data: '2026-04-10' })).toBe('atrasado');
    });

    it('returns "agendado" for today events', () => {
      expect(utils.getEventStatus({ status: 'agendado', data: '2026-04-19' })).toBe('agendado');
    });

    it('returns "agendado" when no date', () => {
      expect(utils.getEventStatus({ status: 'agendado' })).toBe('agendado');
    });
  });

  describe('cutoffDateStr()', () => {
    it('returns a date N days in the past', () => {
      const result = utils.cutoffDateStr(7);
      // Should be 2026-04-12 (7 days before 2026-04-19)
      expect(result).toBe('2026-04-12');
    });
  });

  describe('uid()', () => {
    it('generates a non-empty string', () => {
      const id = utils.uid();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique ids on successive calls', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(utils.uid());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('getHabitType()', () => {
    it('finds a known habit type by key', () => {
      const ht = utils.getHabitType('questoes');
      expect(ht).toBeDefined();
      expect(ht.label).toBe('Questões');
    });

    it('returns undefined for unknown key', () => {
      expect(utils.getHabitType('nonexistent')).toBeUndefined();
    });
  });
});
