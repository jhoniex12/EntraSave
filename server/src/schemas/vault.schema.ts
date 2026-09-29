import { z } from 'zod';

/**
 * Password vault — Zod validation layer (ARCHITECTURE.md §8).
 *
 * The vault is zero-knowledge: the browser encrypts every entry with an AES-GCM
 * key derived from a master password the server never receives. The server can
 * only validate the SHAPE of the envelope (base64, IV length, size bounds).
 */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

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

const KeyMaterial = {
  kdfSalt: z.string().min(22).max(64).regex(BASE64, 'Invalid salt'),
  kdfIterations: z.number().int().min(VAULT_MIN_KDF_ITERATIONS).max(5_000_000),
  verifierIv: Iv,
  verifier: z.string().min(24).max(256).regex(BASE64, 'Invalid verifier'),
};

const KeyVersion = z.number().int().min(1);

export const SetupVaultSchema = z.object(KeyMaterial).strict();
export type SetupVaultInput = z.infer<typeof SetupVaultSchema>;

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
 * Master-password change: every item is re-encrypted client-side under the new
 * key and replaced atomically together with the new key material.
 */
export const RekeyVaultSchema = z.object({
  ...KeyMaterial,
  keyVersion: KeyVersion,
  items: z.array(z.object({
    id: z.string().cuid(),
    iv: Iv,
    ciphertext: Ciphertext,
  }).strict()).max(VAULT_MAX_ITEMS),
}).strict();
export type RekeyVaultInput = z.infer<typeof RekeyVaultSchema>;

/** Forgotten master password: the only recovery is deleting the vault. */
export const ResetVaultSchema = z.object({
  confirmation: z.literal('DELETE'),
}).strict();
export type ResetVaultInput = z.infer<typeof ResetVaultSchema>;
