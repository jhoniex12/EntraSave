import type { VaultKeyDTO } from '@/lib/types';

/**
 * Password-vault cryptography (Web Crypto only).
 *
 * The vault is unlocked with a 6-digit PIN that never leaves the browser:
 *
 *   pinBits  = PBKDF2-HMAC-SHA256(PIN, salt, 600k)
 *   pinProof = HMAC-SHA256(pinBits, label)   → sent to the server, which
 *              checks it under a server-held pepper with an attempt lockout
 *   secret   = random 32 bytes per vault     → released by the server only
 *              after a correct PIN proof
 *   key      = HKDF-SHA256(secret ‖ pinBits) → NON-EXTRACTABLE AES-256-GCM key
 *
 * The key lives only in page memory while the vault is unlocked. Every
 * encryption uses a fresh random 96-bit IV, and distinct additional-data
 * labels keep different blob types from being accepted for one another.
 *
 * Vaults created before PINs used a master password checked against a stored
 * verifier; `unlockLegacyVaultKey` exists only so they can be converted.
 */
export const VAULT_KDF_ITERATIONS = 600_000;
export const PIN_LENGTH = 6;
export const LEGACY_PASSWORD_MAX = 128;

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

/** Sent to `/vault/setup` and `/vault/rekey`. */
export interface PinKeyMaterial {
  kdfSalt: string;
  kdfIterations: number;
  pinProof: string;
  secret: string;
}

export interface PreparedPin {
  /** What the server verifies; the raw PIN is never sent. */
  pinProof: string;
  /** Combine the server-released vault secret with the stretched PIN. */
  deriveKey: (secret: string) => Promise<CryptoKey>;
}

/** Web Crypto requires views over a plain (non-shared) ArrayBuffer. */
type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const PIN_PROOF_LABEL = encoder.encode('entrasave.vault.pin-proof.v1');
const KEY_INFO = encoder.encode('entrasave.vault.key.v2');
const LEGACY_VERIFIER_PLAINTEXT = 'entrasave-vault-verifier';
const LEGACY_VERIFIER_AAD = encoder.encode('entrasave.vault.verifier.v1');
const ENTRY_AAD = encoder.encode('entrasave.vault.entry.v1');

/** Web Crypto is only exposed in secure contexts (HTTPS or localhost). */
export function isVaultCryptoAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && Boolean(globalThis.crypto?.subtle);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Stretch a PIN with stored KDF parameters, ready to unlock. */
export async function preparePin(pin: string, kdfSalt: string, kdfIterations: number): Promise<PreparedPin> {
  return prepare(pin, fromBase64(kdfSalt), kdfIterations);
}

/** Fresh key material for a new PIN (new salt and new vault secret). */
export async function createPinKey(pin: string): Promise<{ key: CryptoKey; material: PinKeyMaterial }> {
  const salt = randomBytes(16);
  const prepared = await prepare(pin, salt, VAULT_KDF_ITERATIONS);
  const secret = toBase64(randomBytes(32));
  return {
    key: await prepared.deriveKey(secret),
    material: {
      kdfSalt: toBase64(salt),
      kdfIterations: VAULT_KDF_ITERATIONS,
      pinProof: prepared.pinProof,
      secret,
    },
  };
}

/** Legacy master-password vaults: resolves null when the password is wrong. */
export async function unlockLegacyVaultKey(password: string, stored: VaultKeyDTO): Promise<CryptoKey | null> {
  if (!stored.verifierIv || !stored.verifier) return null;
  const secret = encoder.encode(password.normalize('NFKC'));
  const baseKey = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(stored.kdfSalt), iterations: stored.kdfIterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  try {
    const plain = await decrypt(key, { iv: stored.verifierIv, ciphertext: stored.verifier }, LEGACY_VERIFIER_AAD);
    return new TextDecoder().decode(plain) === LEGACY_VERIFIER_PLAINTEXT ? key : null;
  } catch {
    // AES-GCM authentication failure: wrong password (or tampered verifier).
    return null;
  }
}

export async function encryptEntry(key: CryptoKey, entry: VaultEntry): Promise<EncryptedBlob> {
  return encrypt(key, encoder.encode(JSON.stringify(entry)), ENTRY_AAD);
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

async function prepare(pin: string, salt: Bytes, iterations: number): Promise<PreparedPin> {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const pinBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, baseKey, 256),
  );
  const proofKey = await crypto.subtle.importKey('raw', pinBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const pinProof = toBase64(new Uint8Array(await crypto.subtle.sign('HMAC', proofKey, PIN_PROOF_LABEL)));

  return {
    pinProof,
    deriveKey: async (secret: string) => {
      const ikm = new Uint8Array(64);
      ikm.set(fromBase64(secret), 0);
      ikm.set(pinBits, 32);
      const hkdfKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: KEY_INFO },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    },
  };
}

async function encrypt(key: CryptoKey, plaintext: Bytes, additionalData: Bytes): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
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

function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
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
