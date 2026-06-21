import type { Request, Response } from 'express';
import { defineRoute } from '@/utils/define-route';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import {
  EmptyAuthSchema,
  SignInSchema,
  SignUpSchema,
} from '@/schemas/auth.schema';
import { setSessionCookie, clearSessionCookie } from '@/utils/session-cookie';
import { requireAuth } from '@/utils/require-auth';
import { isOAuthProviderEnabled } from '@/utils/oauth';
import { isAppError } from '@/utils/app-error';
import { ok, fail } from '@/utils/result';

/**
 * Auth — controllers (docs/ARCHITECTURE.md §4, SECURITY.md §2). Credential
 * sign-in/sign-up use the explicit PUBLIC defineRoute mode with mandatory per-IP
 * rate limits; logout is a normal protected route. The session cookie is set or
 * cleared here (the only mutation site besides the OAuth callback).
 */
export const signIn = defineRoute({
  name: 'auth.signin',
  authentication: 'public',
  rateLimit: 'auth.signin',
  schema: SignInSchema,
  handler: async ({ input, res }) => {
    const session = await authService.signIn(input);
    await setSessionCookie(res, session);
    return { authenticated: true as const };
  },
  audit: false,
});

export const signUp = defineRoute({
  name: 'auth.signup',
  authentication: 'public',
  rateLimit: 'auth.signup',
  schema: SignUpSchema,
  handler: async ({ input, res }) => {
    const session = await authService.signUp(input);
    await setSessionCookie(res, session);
    return { authenticated: true as const };
  },
  audit: false,
});

export const logout = defineRoute({
  name: 'auth.logout',
  rateLimit: 'auth.logout',
  schema: EmptyAuthSchema,
  handler: async ({ ctx, res }) => {
    await authService.logout(ctx.userId);
    clearSessionCookie(res);
    return { authenticated: false as const };
  },
  audit: ({ ctx }) => ({
    action: 'auth.logout',
    resourceType: 'session',
    targetUserId: ctx.userId,
  }),
});

/**
 * Session bootstrap for the SPA. Returns the current identity (reloaded from
 * SQL Server by requireAuth) or 401. Never exposes credentials or tokens — only
 * display fields plus the resolved roles/permissions the UI may use to hint
 * (authorization itself is always re-checked server-side per request).
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await requireAuth(req);
    const profile = await userService.getProfile(ctx);
    res.status(200).json(ok({
      authenticated: true,
      user: {
        email: ctx.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        baseCurrency: ctx.baseCurrency,
        roles: ctx.roles,
        permissions: [...ctx.permissions],
        hasPassword: profile.hasPassword,
        googleLinked: profile.googleLinked,
        facebookLinked: profile.facebookLinked,
      },
    }));
  } catch (err) {
    if (isAppError(err)) {
      res.status(err.status).json(fail({ code: err.code, message: err.message }));
      return;
    }
    res.status(401).json(fail({ code: 'UNAUTHENTICATED', message: 'Not authenticated' }));
  }
}

/**
 * Public: which OAuth providers are configured. The (unauthenticated) sign-in
 * screen needs this to enable/disable its provider buttons.
 */
export function providers(_req: Request, res: Response): void {
  res.status(200).json(ok({
    googleEnabled: isOAuthProviderEnabled('google'),
    facebookEnabled: isOAuthProviderEnabled('facebook'),
  }));
}
