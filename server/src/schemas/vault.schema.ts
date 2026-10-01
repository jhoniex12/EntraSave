import { z } from 'zod';

/**
 * Password vault — Zod validation layer (ARCHITECTURE.md §8).
 *
 * Entries are encrypted in the browser; the server only validates the SHAPE
 * of what it stores (base64, IV length, size bounds). The raw PIN never reaches
 * the API — the browser sends a PBKDF2-derived PIN proof instead.
 */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Exactly 32 bytes, base64-encoded. */
const Base64Bytes32 = z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'Invalid value');

/** 96-bit AES-GCM nonce, base64-encoded (16 chars). */
const Iv = z.string().length(16).regex(BASE64, 'Invalid IV');

/**
 * Encrypted entry blob. The plaintext fields are bounded client-side; this cap
 * covers the worst case of those bounds after JSON escaping, UTF-8 expansion,
 * the GCM tag, and base64 overhead (about 24k characters).
 */
const Ciphertext = z.string().min(24).max(32_768).regex(BASE64, 'Invalid ciphertext');

/** OWASP PBKDF2-HMAC-SHA256 guidance is at least 600k; the ceiling bounds client work. */
export const VAULT_MIN_KDF_ITERATIONS = 600_000;

const PinKeyMaterial = {
  kdfSalt: z.string().min(22).max(64).regex(BASE64, 'Invalid salt'),
  kdfIterations: z.number().int().min(VAULT_MIN_KDF_ITERATIONS).max(5_000_000),
  /** HMAC of the PBKDF2-stretched PIN; the server peppers it before storing. */
  pinProof: Base64Bytes32,
  /** Random per-user vault secret; the server stores it wrapped. */
  secret: Base64Bytes32,
};

const KeyVersion = z.number().int().min(1);

export const SetupVaultSchema = z.object(PinKeyMaterial).strict();
export type SetupVaultInput = z.infer<typeof SetupVaultSchema>;

export const UnlockVaultSchema = z.object({
  pinProof: Base64Bytes32,
}).strict();
export type UnlockVaultInput = z.infer<typeof UnlockVaultSchema>;

export const CreateVaultItemSchema = z.object({
  keyVersion: KeyVersion,
  iv: Iv,
  ciphertext: Ciphertext,
}).strict();
export type CreateVaultItemInput = z.infer<typeof CreateVaultItemSchema>;

export const UpdateVaultItemSchema = z.object({
  id: z.string().cuid(),
  keyVersion: KeyVersion,
  iv: Iv,
  ciphertext: Ciphertext,
}).strict();
export type UpdateVaultItemInput = z.infer<typeof UpdateVaultItemSchema>;

export const DeleteVaultItemSchema = z.object({
  id: z.string().cuid(),
}).strict();
export type DeleteVaultItemInput = z.infer<typeof DeleteVaultItemSchema>;

export const VAULT_MAX_ITEMS = 1_000;

/**
 * PIN change (or conversion of a legacy master-password vault to a PIN): every
 * item is re-encrypted client-side under the new key and replaced atomically
 * together with the new key material. PIN vaults must prove the current PIN,
 * which counts toward the attempt lockout.
 */
export const RekeyVaultSchema = z.object({
  ...PinKeyMaterial,
  keyVersion: KeyVersion,
  currentPinProof: Base64Bytes32.optional(),
  items: z.array(z.object({
    id: z.string().cuid(),
    iv: Iv,
    ciphertext: Ciphertext,
  }).strict()).max(VAULT_MAX_ITEMS),
}).strict();
export type RekeyVaultInput = z.infer<typeof RekeyVaultSchema>;

/** Forgotten PIN: the only recovery is deleting the vault. */
export const ResetVaultSchema = z.object({
  confirmation: z.literal('DELETE'),
}).strict();
export type ResetVaultInput = z.infer<typeof ResetVaultSchema>;
