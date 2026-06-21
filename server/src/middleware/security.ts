import type { NextFunction, Request, Response } from 'express';
import { isProd } from '@/config/env';

/**
 * Hardened security headers. This API serves JSON only, so its CSP is the
 * strict API variant (`default-src 'none'`). Set headers in one place and do
 * not introduce conflicting values elsewhere.
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
