import type { RateLimiter, RateLimitResult } from '@/utils/ratelimit/rate-limiter';

/**
 * Single-process fixed-window rate limiter (ARCHITECTURE.md §13, §18 Stage 0).
 * Backed by an in-memory map; resets on restart and does NOT coordinate across
 * nodes. Swap for a Redis implementation of `RateLimiter` to scale horizontally.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfter: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((existing.resetAt - now) / 1000),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      retryAfter: 0,
    };
  }
}
