import type { VaultKeyDTO } from '@/lib/types';

/**
 * Zero-knowledge password-vault cryptography (Web Crypto only).
 *
 * The master password never leaves the browser. It is stretched with
 * PBKDF2-HMAC-SHA256 into a NON-EXTRACTABLE AES-256-GCM key that lives only in
 * page memory while the vault is unlocked. The server stores the salt, the
 * iteration count, an encrypted verifier (to detect a wrong master password),
 * and one AES-GCM ciphertext per entry. Every encryption uses a fresh random
 * 96-bit IV. Distinct additional-data labels keep a verifier blob from being
 * accepted as an entry and vice versa.
 */
export const VAULT_KDF_ITERATIONS = 600_000;
export const MASTER_PASSWORD_MIN = 12;
export const MASTER_PASSWORD_MAX = 128;

export const ENTRY_LIMITS = {
  name: 100,
  username: 200,
  password: 256,
  url: 500,
  notes: 2_000,
} as const;

export interface VaultEntry {
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}

export interface VaultKeyMaterial {
  kdfSalt: string;
  kdfIterations: number;
  verifierIv: string;
  verifier: string;
}

/** Web Crypto requires views over a plain (non-shared) ArrayBuffer. */
type Bytes = Uint8Array<ArrayBuffer>;

const VERIFIER_PLAINTEXT = 'entrasave-vault-verifier';
const VERIFIER_AAD = new TextEncoder().encode('entrasave.vault.verifier.v1');
const ENTRY_AAD = new TextEncoder().encode('entrasave.vault.entry.v1');

/** Web Crypto is only exposed in secure contexts (HTTPS or localhost). */
export function isVaultCryptoAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && Boolean(globalThis.crypto?.subtle);
}

/** Create key material for a new master password. */
export async function createVaultKey(masterPassword: string): Promise<{ key: CryptoKey; material: VaultKeyMaterial }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(masterPassword, salt, VAULT_KDF_ITERATIONS);
  const verifier = await encrypt(key, new TextEncoder().encode(VERIFIER_PLAINTEXT), VERIFIER_AAD);
  return {
    key,
    material: {
      kdfSalt: toBase64(salt),
      kdfIterations: VAULT_KDF_ITERATIONS,
      verifierIv: verifier.iv,
      verifier: verifier.ciphertext,
    },
  };
}

/** Derive the key from `masterPassword`; resolves null when it is wrong. */
export async function unlockVaultKey(masterPassword: string, stored: VaultKeyDTO): Promise<CryptoKey | null> {
  const key = await deriveKey(masterPassword, fromBase64(stored.kdfSalt), stored.kdfIterations);
  try {
    const plain = await decrypt(key, { iv: stored.verifierIv, ciphertext: stored.verifier }, VERIFIER_AAD);
    return new TextDecoder().decode(plain) === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    // AES-GCM authentication failure: wrong password (or tampered verifier).
    return null;
  }
}

export async function encryptEntry(key: CryptoKey, entry: VaultEntry): Promise<EncryptedBlob> {
  return encrypt(key, new TextEncoder().encode(JSON.stringify(entry)), ENTRY_AAD);
}

/** Throws when the blob fails authentication or does not hold a valid entry. */
export async function decryptEntry(key: CryptoKey, blob: EncryptedBlob): Promise<VaultEntry> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(await decrypt(key, blob, ENTRY_AAD)));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid vault entry');
  const record = parsed as Record<string, unknown>;
  const field = (name: keyof VaultEntry) => (typeof record[name] === 'string' ? record[name] : '');
  return {
    name: field('name'),
    username: field('username'),
    password: field('password'),
    url: field('url'),
    notes: field('notes'),
  };
}

const CHARSETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
} as const;

/**
 * Cryptographically random password containing at least one character from
 * each set. Uses rejection sampling so every character is uniformly chosen.
 */
export function generatePassword(length = 20): string {
  const sets = Object.values(CHARSETS);
  const all = sets.join('');
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates shuffle so the guaranteed characters are not in fixed slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}

function pick(alphabet: string): string {
  return alphabet.charAt(randomIndex(alphabet.length));
}

function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

async function deriveKey(masterPassword: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  // NFKC so the same password typed on different keyboards/OSes derives the same key.
  const secret = new TextEncoder().encode(masterPassword.normalize('NFKC'));
  const baseKey = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(key: CryptoKey, plaintext: Bytes, additionalData: Bytes): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plaintext);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

async function decrypt(key: CryptoKey, blob: EncryptedBlob, additionalData: Bytes): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv), additionalData },
    key,
    fromBase64(blob.ciphertext),
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Bytes {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
