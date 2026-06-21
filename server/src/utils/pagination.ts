/**
 * Keyset (seek) pagination primitives (docs/ARCHITECTURE.md §10). Preferred over
 * OFFSET for large owned tables: O(1) per page and stable under inserts.
 */
export interface Page<T> {
  items: T[];
  /** Opaque cursor for the next page, or null when there are no more rows. */
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function clampPageSize(size: number | undefined): number {
  if (!size || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(size, MAX_PAGE_SIZE);
}
