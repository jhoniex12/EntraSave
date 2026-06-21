import { z } from 'zod';
import { env } from '@/config/env';

const HeaderSchema = z.object({ alg: z.literal('HS256'), typ: z.literal('JWT') }).strict();
const SessionClaimsSchema = z.object({
  sub: z.string().min(1),
  sv: z.number().int().nonnegative(),
  iss: z.literal(env.JWT_ISSUER),
  aud: z.literal(env.JWT_AUDIENCE),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().uuid(),
}).strict();

export type SessionClaims = z.infer<typeof SessionClaimsSchema>;
export const SESSION_COOKIE_NAME = 'entrasave_session';

export async function createSessionToken(input: { userId: string; sessionVersion: number }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: input.userId,
    sv: input.sessionVersion,
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE,
    iat: now,
    exp: now + env.SESSION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  });
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  const parts = token.split('.');
  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signaturePart = parts[2];
  if (parts.length !== 3 || !headerPart || !payloadPart || !signaturePart) return null;

  try {
    HeaderSchema.parse(JSON.parse(decodeText(headerPart)));
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      decodeBytes(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return null;

    const claims = SessionClaimsSchema.parse(JSON.parse(decodeText(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now || claims.iat > now + 60 || claims.exp - claims.iat > env.SESSION_TTL_SECONDS) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

async function sign(payload: SessionClaims): Promise<string> {
  const header = encodeText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeText(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(),
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${encodeBytes(new Uint8Array(signature))}`;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function encodeText(value: string): string {
  return encodeBytes(new TextEncoder().encode(value));
}

function encodeBytes(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeText(value: string): string {
  return new TextDecoder().decode(decodeBytes(value));
}

function decodeBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
