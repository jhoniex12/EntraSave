import type { Request } from 'express';
import type { AuthContext } from '@/utils/auth-context';
import { loadIdentityByUserId } from '@/repositories/rbac.repository';
import { readSessionCookie } from '@/utils/session-cookie';
import { clientIp, requestId } from '@/utils/request-context';
import { AuthError, ForbiddenError } from '@/utils/app-error';

/**
 * Resolve the authenticated request context (docs/ARCHITECTURE.md §4).
 *
 * 1. The HttpOnly cookie must contain a valid, unexpired application JWT.
 * 2. The local User must exist, be ACTIVE, and have the same session version.
 *    Suspended/deleted/unprovisioned users are rejected here, server-side.
 *
 * This is the single entrypoint for "who is calling"; the route pipeline calls
 * it before anything else. Authorization NEVER trusts the JWT payload: roles,
 * permissions, status, and sessionVersion are reloaded from SQL Server here.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const session = await readSessionCookie(req);
  if (!session) throw new AuthError();

  const identity = await loadIdentityByUserId(session.sub);
  if (!identity || identity.sessionVersion !== session.sv) {
    throw new AuthError('Session is no longer valid.');
  }
  if (identity.status !== 'ACTIVE') {
    throw new ForbiddenError('This account is not active.');
  }

  return {
    userId: identity.userId,
    email: identity.email,
    sessionVersion: identity.sessionVersion,
    baseCurrency: identity.baseCurrency,
    roles: identity.roles,
    permissions: new Set(identity.permissions),
    ip: clientIp(req),
    requestId: requestId(req),
  };
}
