export const REVIEW_PAGE_SIZE = 25;

export type PageSlice<T> = {
  items: T[];
  hasMore: boolean;
  remaining: number;
};

/** Stable, id-order-preserving slices; pagination never reorders input. */
export function pageItems<T>(items: readonly T[], limit: number): PageSlice<T> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : REVIEW_PAGE_SIZE;
  const slice = items.slice(0, safeLimit);
  return {
    items: slice,
    hasMore: items.length > slice.length,
    remaining: Math.max(0, items.length - slice.length),
  };
}

export function nextPageLimit(
  current: number,
  total: number,
  step = REVIEW_PAGE_SIZE,
): number {
  return Math.min(total, Math.max(0, current) + Math.max(1, step));
}

