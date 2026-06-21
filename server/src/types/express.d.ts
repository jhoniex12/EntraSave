import type { AuthContext } from '@/utils/auth-context';

/**
 * Express request augmentation. `requestId` is stamped by the requestContext
 * middleware for log/audit correlation; `auth` is attached by the route
 * pipeline once `requireAuth` resolves the caller (docs/ARCHITECTURE.md §4).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthContext;
    }
  }
}

export {};
