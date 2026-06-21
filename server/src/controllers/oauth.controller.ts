import type { Request, Response } from 'express';
import { OAuthProviderSchema, type OAuthProvider } from '@/schemas/auth.schema';
import { authService } from '@/services/auth.service';
import {
  createOAuthAuthorization,
  exchangeAndVerifyOAuthCode,
  isOAuthProviderEnabled,
  oauthFlowCookieName,
  verifyOAuthFlow,
} from '@/utils/oauth';
import { setSessionCookie } from '@/utils/session-cookie';
import { enforceRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/request-context';
import { logger } from '@/utils/logger';
import { env, isProd } from '@/config/env';

/**
 * OAuth — external protocol boundary (docs/ARCHITECTURE.md §4, SECURITY.md §2).
 *
 * These handlers orchestrate protocol I/O only — parse provider/callback,
 * enforce the IP rate limit, delegate verification + the account decision to the
 * OAuth helper and AuthService, set/clear the signed flow cookie, and redirect.
 * Account creation/linking decisions stay in AuthService. Post-auth redirects
 * target the React client origin (CLIENT_URL) and only accept local return paths.
 */
const FLOW_COOKIE_MAX_AGE_MS = 600 * 1000;

export async function startOAuth(req: Request, res: Response): Promise<void> {
  const parsed = OAuthProviderSchema.safeParse(req.params.provider);
  if (!parsed.success || !isOAuthProviderEnabled(parsed.data)) {
    redirectToClient(res, '/sign-in?error=provider_unavailable');
    return;
  }

  try {
    await enforceRateLimit('auth.oauth', clientIp(req) ?? 'unknown');
  } catch {
    redirectToClient(res, '/sign-in?error=rate_limited');
    return;
  }

  const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/dashboard';
  const { authorizationUrl, flowCookie } = createOAuthAuthorization(parsed.data, returnTo);
  setFlowCookie(res, parsed.data, flowCookie, FLOW_COOKIE_MAX_AGE_MS);
  res.redirect(authorizationUrl);
}

export async function oauthCallback(req: Request, res: Response): Promise<void> {
  const parsed = OAuthProviderSchema.safeParse(req.params.provider);
  if (!parsed.success) {
    redirectToClient(res, '/sign-in?error=oauth_failed');
    return;
  }
  const provider = parsed.data;

  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const flow = verifyOAuthFlow(provider, req.cookies?.[oauthFlowCookieName(provider)], state);

  if (!flow || !code || 'error' in req.query) {
    clearFlowCookie(res, provider);
    redirectToClient(res, '/sign-in?error=oauth_failed');
    return;
  }

  try {
    const identity = await exchangeAndVerifyOAuthCode(flow, code);
    const session = await authService.signInWithOAuth(identity);
    await setSessionCookie(res, session);
    clearFlowCookie(res, provider);
    redirectToClient(res, flow.returnTo);
  } catch (error) {
    logger.warn('auth.oauth.failed', {
      provider,
      error: error instanceof Error ? error.message : 'unknown',
    });
    clearFlowCookie(res, provider);
    redirectToClient(res, '/sign-in?error=oauth_failed');
  }
}

function setFlowCookie(res: Response, provider: OAuthProvider, value: string, maxAge: number): void {
  res.cookie(oauthFlowCookieName(provider), value, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: `/api/auth/oauth/${provider}/callback`,
    maxAge,
  });
}

function clearFlowCookie(res: Response, provider: OAuthProvider): void {
  res.clearCookie(oauthFlowCookieName(provider), {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: `/api/auth/oauth/${provider}/callback`,
  });
}

/** Redirect to a LOCAL path on the React client origin only (never an open redirect). */
function redirectToClient(res: Response, localPath: string): void {
  const safe = localPath.startsWith('/') && !localPath.startsWith('//') ? localPath : '/dashboard';
  res.redirect(`${env.CLIENT_URL}${safe}`);
}
