import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Stamps a per-request correlation id (docs/ARCHITECTURE.md §3, §14) used to
 * stitch logs + audit together. In Next.js this lived in edge middleware.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
