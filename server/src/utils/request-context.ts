import type { Request } from 'express';

/**
 * Request-derived context primitives (docs/ARCHITECTURE.md §4, §13).
 *
 * The edge (Cloudflare/IIS) is the trust boundary for forwarded headers; behind
 * it we read the client IP for per-IP rate limiting and audit. In Next.js this
 * came from `headers()`; here it comes from the Express request.
 */
export function clientIp(req: Request): string | undefined {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp) return cfIp;

  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const candidate = firstForwarded?.split(',')[0]?.trim();
  if (candidate) return candidate;

  return req.ip ?? undefined;
}

/** Per-request correlation id, stamped by the requestContext middleware. */
export function requestId(req: Request): string | undefined {
  return req.requestId;
}
