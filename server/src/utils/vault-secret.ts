import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';
import { AppError } from '@/utils/app-error';

/**
 * Server-side password-vault secrets (SECURITY.md "Password vault").
 *
 * A 6-digit PIN has only 10^6 values, so the browser-side KDF alone cannot
 * stop an offline guess. Two keys derived from VAULT_SECRET (which lives only
 * in the API environment, never in the database) close that gap:
 *
 * - the PIN verifier is an HMAC under a pepper key, so a database copy cannot
 *   be used to test PIN guesses; online guesses go through the lockout;
 * - each user's random vault secret (an input to the browser's encryption
 *   key) is stored AES-256-GCM-wrapped, bound to the user id as associated
 *   data so rows cannot be swapped between users.
 */
interface VaultServerKeys {
  pepper: Buffer;
  wrap: Buffer;
}

let cached: VaultServerKeys | null = null;

function serverKeys(): VaultServerKeys {
  if (cached) return cached;
  if (!env.VAULT_SECRET) {
    throw new AppError('INTERNAL', 'The password vault is not configured on this server.', 500);
  }
  const ikm = Buffer.from(env.VAULT_SECRET, 'utf8');
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, 32));
  cached = {
    pepper: derive('entrasave.vault.pin-verifier.v1'),
    wrap: derive('entrasave.vault.secret-wrap.v1'),
  };
  return cached;
}

/** Peppered verifier for the browser-derived PIN proof. */
export function createPinVerifier(userId: string, pinProof: string): string {
  return createHmac('sha256', serverKeys().pepper)
    .update(`${userId}\u0000${pinProof}`)
    .digest('base64');
}

export function matchesPinVerifier(userId: string, pinProof: string, stored: string): boolean {
  const expected = Buffer.from(stored, 'base64');
  const actual = Buffer.from(createPinVerifier(userId, pinProof), 'base64');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Wrap a base64 vault secret as `iv.ciphertext.tag` (base64 parts). */
export function wrapVaultSecret(userId: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', serverKeys().wrap, iv);
  cipher.setAAD(Buffer.from(userId, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(secret, 'base64')), cipher.final()]);
  return [iv, ciphertext, cipher.getAuthTag()].map((part) => part.toString('base64')).join('.');
}

export function unwrapVaultSecret(userId: string, wrapped: string): string {
  const [iv, ciphertext, tag] = wrapped.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !ciphertext || !tag) {
    throw new AppError('INTERNAL', 'Your vault key could not be read.', 500);
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', serverKeys().wrap, iv);
    decipher.setAAD(Buffer.from(userId, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('base64');
  } catch {
    // Wrong/rotated VAULT_SECRET or a tampered row — fail closed.
    throw new AppError('INTERNAL', 'Your vault key could not be read.', 500);
  }
}
