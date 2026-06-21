import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/config/env';
import type { OAuthProvider } from '@/schemas/auth.schema';

const FLOW_TTL_SECONDS = 600;
const FlowSchema = z.object({
  provider: z.enum(['google', 'facebook']),
  state: z.string().min(32),
  verifier: z.string().min(43),
  nonce: z.string().min(32),
  returnTo: z.string().startsWith('/'),
  exp: z.number().int(),
  /**
   * Present only for an authenticated "link this provider to my account" flow.
   * Carries the initiating user's id. The cookie is HMAC-signed, so this id is
   * tamper-proof; the callback still re-checks it against the live session.
   */
  link: z.string().min(1).optional(),
}).strict();

type OAuthFlow = z.infer<typeof FlowSchema>;
export interface VerifiedOAuthIdentity {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export function oauthFlowCookieName(provider: OAuthProvider): string {
  return `entrasave_oauth_${provider}`;
}

export function createOAuthAuthorization(
  provider: OAuthProvider,
  returnTo: string,
  options?: { linkUserId?: string },
): {
  authorizationUrl: string;
  flowCookie: string;
} {
  const flow: OAuthFlow = {
    provider,
    state: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    returnTo: safeReturnTo(returnTo),
    exp: Math.floor(Date.now() / 1000) + FLOW_TTL_SECONDS,
    ...(options?.linkUserId ? { link: options.linkUserId } : {}),
  };
  return {
    authorizationUrl: provider === 'google'
      ? googleAuthorizationUrl(flow)
      : facebookAuthorizationUrl(flow),
    flowCookie: signFlow(flow),
  };
}

export function verifyOAuthFlow(
  provider: OAuthProvider,
  encoded: string | undefined,
  state: string | null,
): OAuthFlow | null {
  if (!encoded || !state) return null;
  const separator = encoded.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = encoded.slice(0, separator);
  const suppliedSignature = encoded.slice(separator + 1);
  const expectedSignature = flowSignature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const flow = FlowSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (flow.provider !== provider || flow.state !== state || flow.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return flow;
  } catch {
    return null;
  }
}

export async function exchangeAndVerifyOAuthCode(
  flow: OAuthFlow,
  code: string,
): Promise<VerifiedOAuthIdentity> {
  return flow.provider === 'google'
    ? exchangeGoogle(flow, code)
    : exchangeFacebook(flow, code);
}

export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  return provider === 'google'
    ? Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    : Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && env.FACEBOOK_GRAPH_VERSION);
}

function googleAuthorizationUrl(flow: OAuthFlow): string {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth is not configured');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl('google'),
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

function facebookAuthorizationUrl(flow: OAuthFlow): string {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET || !env.FACEBOOK_GRAPH_VERSION) {
    throw new Error('Facebook OAuth is not configured');
  }
  const url = new URL(`https://www.facebook.com/${env.FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: callbackUrl('facebook'),
    response_type: 'code',
    scope: 'email,public_profile',
    state: flow.state,
  }).toString();
  return url.toString();
}

async function exchangeGoogle(flow: OAuthFlow, code: string): Promise<VerifiedOAuthIdentity> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth is not configured');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl('google'),
      grant_type: 'authorization_code',
      code_verifier: flow.verifier,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Google token exchange failed');
  const token = z.object({ id_token: z.string().min(1) }).passthrough().parse(await response.json());

  // Google's tokeninfo endpoint validates the signature and standard ID-token claims.
  const verification = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`,
    { cache: 'no-store' },
  );
  if (!verification.ok) throw new Error('Google ID token verification failed');
  const claims = z.object({
    sub: z.string().min(1),
    aud: z.string(),
    iss: z.enum(['accounts.google.com', 'https://accounts.google.com']),
    exp: z.coerce.number().int(),
    email: z.string().email(),
    email_verified: z.union([z.literal('true'), z.literal(true)]),
    nonce: z.string(),
    name: z.string().max(200).optional(),
    picture: z.string().url().max(2048).optional(),
  }).passthrough().parse(await verification.json());
  if (claims.aud !== env.GOOGLE_CLIENT_ID || claims.nonce !== flow.nonce || claims.exp <= Date.now() / 1000) {
    throw new Error('Google ID token claims are invalid');
  }
  return {
    provider: 'google',
    providerId: claims.sub,
    email: claims.email,
    displayName: claims.name,
    avatarUrl: claims.picture,
  };
}

async function exchangeFacebook(flow: OAuthFlow, code: string): Promise<VerifiedOAuthIdentity> {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET || !env.FACEBOOK_GRAPH_VERSION) {
    throw new Error('Facebook OAuth is not configured');
  }
  const graphBase = `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`;
  const tokenResponse = await fetch(`${graphBase}/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      redirect_uri: callbackUrl('facebook'),
      code,
    }),
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error('Facebook token exchange failed');
  const { access_token: accessToken } = z.object({ access_token: z.string().min(1) })
    .passthrough().parse(await tokenResponse.json());

  const debugUrl = new URL(`${graphBase}/debug_token`);
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`);
  const debugResponse = await fetch(debugUrl, { cache: 'no-store' });
  if (!debugResponse.ok) throw new Error('Facebook token verification failed');
  const debug = z.object({
    data: z.object({
      app_id: z.string(),
      is_valid: z.literal(true),
      user_id: z.string().min(1),
      expires_at: z.number().int(),
    }).passthrough(),
  }).parse(await debugResponse.json());
  if (debug.data.app_id !== env.FACEBOOK_APP_ID || debug.data.expires_at <= Date.now() / 1000) {
    throw new Error('Facebook token claims are invalid');
  }

  const profileUrl = new URL(`${graphBase}/me`);
  profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
  profileUrl.searchParams.set(
    'appsecret_proof',
    createHmac('sha256', env.FACEBOOK_APP_SECRET).update(accessToken).digest('hex'),
  );
  const profileResponse = await fetch(profileUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!profileResponse.ok) throw new Error('Facebook profile lookup failed');
  const profile = z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().max(200).optional(),
    picture: z.object({
      data: z.object({
        url: z.string().url().max(2048),
        is_silhouette: z.boolean(),
      }),
    }).optional(),
  }).parse(await profileResponse.json());
  if (profile.id !== debug.data.user_id) throw new Error('Facebook identity mismatch');
  return {
    provider: 'facebook',
    providerId: profile.id,
    email: profile.email,
    displayName: profile.name,
    avatarUrl: profile.picture && !profile.picture.data.is_silhouette
      ? profile.picture.data.url
      : undefined,
  };
}

function callbackUrl(provider: OAuthProvider): string {
  return new URL(`/api/auth/oauth/${provider}/callback`, env.APP_URL).toString();
}

function signFlow(flow: OAuthFlow): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
  return `${payload}.${flowSignature(payload)}`;
}

function flowSignature(payload: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`oauth-flow:${payload}`).digest('base64url');
}

function safeReturnTo(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}
