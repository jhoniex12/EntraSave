import type { Request, Response } from 'express';
import { env, isProd } from '@/config/env';
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionClaims,
} from '@/utils/jwt';

/**
 * Session cookie I/O (docs/ARCHITECTURE.md §4, SECURITY.md §2).
 *
 * The single place the `entrasave_session` cookie is written, cleared, or read.
 * Production cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and
 * bounded by the configured TTL.
 */
export async function setSessionCookie(
  res: Response,
  input: { userId: string; sessionVersion: number },
): Promise<void> {
  const token = await createSessionToken(input);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL_SECONDS * 1000, // express expects milliseconds
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}

export async function readSessionCookie(req: Request): Promise<SessionClaims | null> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  return token ? verifySessionToken(token) : null;
}
