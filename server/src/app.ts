import express, { type Application, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from '@/config/env';
import { requestContext } from '@/middleware/request-context';
import { securityHeaders } from '@/middleware/security';
import { notFound, errorHandler } from '@/middleware/error-handler';
import { apiRouter } from '@/routes';

/**
 * Express application assembly (docs/ARCHITECTURE.md §3). Order matters:
 *   trust proxy → correlation id → security headers → CORS → body/cookie parse
 *   → /api router → 404 → error safety-net.
 *
 * The React client is a SEPARATE origin, so CORS runs with `credentials: true`
 * and a single allowlisted origin (CLIENT_URL); the session lives in an
 * HttpOnly cookie, never in a header the browser JS can read.
 */
export function createApp(): Application {
  const app = express();

  // Behind Cloudflare/IIS in production; trust the forwarded chain so the real
  // client IP (used for per-IP rate limiting + audit) is read correctly.
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(securityHeaders);
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // Cap the accepted payload (defense in depth; IIS also caps in production).
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, data: { status: 'healthy' } });
  });

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
