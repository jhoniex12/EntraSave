import type { NextFunction, Request, Response } from 'express';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Explicit CSRF defense for the cookie-based session (SECURITY.md §Cross-origin).
 *
 * The session lives in a `SameSite=Lax` cookie, which already blocks most
 * cross-site sends. This is the deliberate, defense-in-depth companion OWASP
 * recommends: every state-changing request must originate from the single
 * allowlisted client origin — the same origin CORS trusts. The browser always
 * sends `Origin` on non-GET/HEAD requests (same- or cross-origin), so a missing
 * or foreign origin on an unsafe method is rejected before auth, body parsing,
 * or any handler runs.
 *
 * Safe methods (GET/HEAD/OPTIONS) pass through: by contract they must not mutate
 * state, and the OAuth start/callback GETs are protected by signed state + PKCE
 * instead. CORS controls whether JS may *read* a response; it does not stop the
 * request from being processed — that is precisely what this guard adds.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_ORIGIN = new URL(env.CLIENT_URL).origin;

export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (requestOrigin(req) === ALLOWED_ORIGIN) {
    next();
    return;
  }

  logger.warn('csrf.blocked', { requestId: req.requestId, method: req.method, path: req.path });
  res.status(403).json({
    ok: false,
    error: { code: 'FORBIDDEN', message: 'Cross-site request blocked.', requestId: req.requestId },
  });
}

/** The request's initiating origin: the `Origin` header, or the `Referer`'s origin. */
function requestOrigin(req: Request): string | null {
  const origin = req.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
