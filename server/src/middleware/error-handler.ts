import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/utils/logger';

/**
 * Terminal HTTP handlers (docs/ARCHITECTURE.md §15). Typed errors are already
 * mapped to a safe ActionResult inside defineRoute; these are the safety nets
 * for unmatched routes and anything that escapes a handler. Stack traces are
 * logged server-side, never returned to the client.
 */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error('http.unhandled', {
    requestId: req.requestId,
    error: err instanceof Error ? err.message : 'unknown',
    stack: err instanceof Error ? err.stack : undefined,
  });
  if (res.headersSent) return;
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.', requestId: req.requestId },
  });
}
