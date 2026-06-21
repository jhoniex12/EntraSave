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
import { requireAuth } from '@/utils/require-auth';
import { enforceRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/request-context';
import { isAppError } from '@/utils/app-error';
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

/**
 * Authenticated "connect this provider to my account" start. Unlike `startOAuth`
 * (which signs in / creates a user), this embeds the current user's id in the
 * signed flow cookie so the callback links instead of authenticating. Always
 * returns the user to /manage-account.
 */
export async function startOAuthLink(req: Request, res: Response): Promise<void> {
  const parsed = OAuthProviderSchema.safeParse(req.params.provider);
  if (!parsed.success || !isOAuthProviderEnabled(parsed.data)) {
    redirectToClient(res, '/manage-account?error=provider_unavailable');
    return;
  }

  let userId: string;
  try {
    ({ userId } = await requireAuth(req));
  } catch {
    redirectToClient(res, '/sign-in?error=oauth_failed');
    return;
  }

  try {
    await enforceRateLimit('auth.oauth', userId);
  } catch {
    redirectToClient(res, '/manage-account?error=rate_limited');
    return;
  }

  const { authorizationUrl, flowCookie } = createOAuthAuthorization(parsed.data, '/manage-account', {
    linkUserId: userId,
  });
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

    // Link flow: attach the verified identity to the user who started it. The
    // signed cookie names that user; we still re-check it against the live
    // session so a changed/foreign session cannot complete someone else's link.
    if (flow.link) {
      const ctx = await requireAuth(req).catch(() => null);
      if (!ctx || ctx.userId !== flow.link) {
        clearFlowCookie(res, provider);
        redirectToClient(res, '/sign-in?error=oauth_failed');
        return;
      }
      await authService.linkOAuthIdentity(ctx.userId, identity);
      clearFlowCookie(res, provider);
      redirectToClient(res, appendQuery(flow.returnTo, `linked=${provider}`));
      return;
    }

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
    const isConflict = isAppError(error) && error.code === 'CONFLICT';
    if (flow.link) {
      redirectToClient(res, `/manage-account?error=${isConflict ? 'link_conflict' : 'link_failed'}`);
    } else {
      // A CONFLICT here means the email already belongs to an existing account
      // (e.g. registered with a password). Tell the user how to recover instead
      // of a generic failure.
      redirectToClient(res, `/sign-in?error=${isConflict ? 'account_exists' : 'oauth_failed'}`);
    }
  }
}

/** Append a query string to a local path, respecting any existing `?`. */
function appendQuery(path: string, query: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
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
