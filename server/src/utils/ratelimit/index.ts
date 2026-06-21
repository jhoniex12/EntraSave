import type { RateLimiter } from '@/utils/ratelimit/rate-limiter';
import { MemoryRateLimiter } from '@/utils/ratelimit/memory-rate-limiter';
import { RateLimitError } from '@/utils/app-error';

/**
 * Process-wide rate limiter selection (ARCHITECTURE.md §13).
 * When REDIS_URL is configured, swap this for a RedisRateLimiter here — the
 * only file that changes.
 */
export const rateLimiter: RateLimiter = new MemoryRateLimiter();

/** Per-action limit policy. Mirrors the table in ARCHITECTURE.md §13. */
export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  'transaction.create': { limit: 60, windowMs: 60_000 },
  'transaction.update': { limit: 60, windowMs: 60_000 },
  'transaction.delete': { limit: 60, windowMs: 60_000 },
  'transaction.list': { limit: 120, windowMs: 60_000 },
  'account.create': { limit: 30, windowMs: 60_000 },
  'account.update': { limit: 30, windowMs: 60_000 },
  'account.delete': { limit: 10, windowMs: 60_000 },
  'account.list': { limit: 120, windowMs: 60_000 },
  'settings.update': { limit: 10, windowMs: 3_600_000 },
  'category.create': { limit: 30, windowMs: 60_000 },
  'category.update': { limit: 60, windowMs: 60_000 },
  'category.delete': { limit: 30, windowMs: 60_000 },
  'category.reorder': { limit: 60, windowMs: 60_000 },
  'balance.set': { limit: 30, windowMs: 60_000 },
  'budget.set': { limit: 30, windowMs: 60_000 },
  'budget.delete': { limit: 20, windowMs: 60_000 },
  'auth.signin': { limit: 10, windowMs: 15 * 60_000 },
  'auth.signup': { limit: 5, windowMs: 60 * 60_000 },
  'auth.oauth': { limit: 20, windowMs: 15 * 60_000 },
  'auth.logout': { limit: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Enforce the per-user policy for `action`. Throws RateLimitError (429) when
 * exceeded. Keyed per-user so one abusive user cannot starve others.
 */
export async function enforceRateLimit(action: RateLimitKey, userId: string): Promise<void> {
  const policy = RATE_LIMITS[action];
  const result = await rateLimiter.consume(`${action}:${userId}`, policy.limit, policy.windowMs);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfter);
  }
}
