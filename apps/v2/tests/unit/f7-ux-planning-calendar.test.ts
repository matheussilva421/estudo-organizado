import { describe, expect, it } from 'vitest';
import {
  firstDayOfMonth,
  lastDayOfMonth,
  monthKeyOf,
  shiftMonth,
} from '../../src/domain/planning-time';

describe('F7-UX civil month boundaries', () => {
  it('handles 28, 29, 30 and 31 day months', () => {
    expect(lastDayOfMonth('2027-01-15')).toBe('2027-01-31');
    expect(lastDayOfMonth('2027-02-10')).toBe('2027-02-28');
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(lastDayOfMonth('2027-04-10')).toBe('2027-04-30');
    expect(firstDayOfMonth('2027-04-10')).toBe('2027-04-01');
  });

  it('crosses the year boundary in both directions', () => {
    expect(firstDayOfMonth('2028-01-10', -1)).toBe('2027-12-01');
    expect(lastDayOfMonth('2027-12-10', 1)).toBe('2028-01-31');
    expect(shiftMonth('2027-12-31', 1)).toBe('2028-01-01');
  });

  it('derives a stable month key', () => {
    expect(monthKeyOf('2027-03-15')).toBe('2027-03');
    expect(monthKeyOf('2028-01-01')).toBe('2028-01');
  });
});

