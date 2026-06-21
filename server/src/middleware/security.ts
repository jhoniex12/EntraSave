import type { NextFunction, Request, Response } from 'express';
import { isProd } from '@/config/env';

/**
 * Hardened security headers (docs/ARCHITECTURE.md §11.2, SECURITY.md §2). In
 * Next.js these were set in edge middleware with a nonce-based document CSP.
 * This API serves JSON only (the React client is a separate origin), so the CSP
 * is the strict API variant (`default-src 'none'`). Set in one place; do not set
 * conflicting headers elsewhere.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Content-Security-Policy',
    [
      `default-src 'none'`,
      `frame-ancestors 'none'`,
      `base-uri 'none'`,
      `form-action 'none'`,
    ].join('; '),
  );
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}
