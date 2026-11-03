import { describe, expect, it } from 'vitest';
import { nextPageLimit, pageItems, REVIEW_PAGE_SIZE } from '../../src/presentation/pagination';

describe('f6 pagination', () => {
  it('keeps order and reports how many remain', () => {
    const items = Array.from({ length: 60 }, (_, index) => 'item-' + index);
    const page = pageItems(items, REVIEW_PAGE_SIZE);
    expect(page.items).toHaveLength(REVIEW_PAGE_SIZE);
    expect(page.items[0]).toBe('item-0');
    expect(page.hasMore).toBe(true);
    expect(page.remaining).toBe(35);
  });

  it('does not paginate short lists', () => {
    const page = pageItems(['a', 'b'], 25);
    expect(page.items).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(false);
    expect(page.remaining).toBe(0);
  });

  it('advances deterministically and clamps at the total', () => {
    expect(nextPageLimit(25, 60)).toBe(50);
    expect(nextPageLimit(50, 60)).toBe(60);
    expect(nextPageLimit(60, 60)).toBe(60);
  });

  it('falls back to the default for invalid limits', () => {
    const page = pageItems(['a', 'b', 'c'], 0);
    expect(page.items).toHaveLength(3);
  });
});

