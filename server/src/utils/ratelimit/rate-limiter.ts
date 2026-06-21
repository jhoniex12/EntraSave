
/**
 * Rate limiter abstraction (ARCHITECTURE.md §13).
 *
 * Callers depend on this interface, never a concrete backend. Today:
 * MemoryRateLimiter (single node). Future: RedisRateLimiter (distributed) —
 * a drop-in swap with NO caller changes. NOTE: the in-memory limiter is correct
 * only for a single process; moving to multi-node REQUIRES the Redis backend
 * before horizontal scaling (see ARCHITECTURE.md §18 Stage 1).
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
  remaining: number;
}

export interface RateLimiter {
  /** Consume one unit for `key` under a fixed window of `windowMs`. */
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}
