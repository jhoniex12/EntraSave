import type { VaultItemRecord, VaultKeyRecord } from '@/repositories/vault.repository';

/**
 * Password vault — DTO layer (ARCHITECTURE.md §8). Only KDF parameters,
 * opaque ciphertext, and lock state cross the boundary. The PIN verifier,
 * wrapped vault secret, attempt counter, and ownership fields never do.
 */
export interface VaultKeyDTO {
  /** PIN for current vaults; PASSWORD for legacy vaults awaiting conversion. */
  scheme: 'PIN' | 'PASSWORD';
  kdf: 'PBKDF2-SHA256';
  kdfSalt: string;
  kdfIterations: number;
  /** Legacy PASSWORD vaults only: verifier the browser checks itself. */
  verifierIv: string | null;
  verifier: string | null;
  /** ISO time until which PIN unlock is refused, or null. */
  lockedUntil: string | null;
  keyVersion: number;
}

export interface VaultStateDTO {
  /** null until the user creates a vault. */
  key: VaultKeyDTO | null;
}

export interface VaultUnlockDTO {
  /** Per-user vault secret, combined in the browser with the stretched PIN. */
  secret: string;
}

export interface VaultItemDTO {
  id: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
}

export function toVaultKeyDTO(key: VaultKeyRecord, now = new Date()): VaultKeyDTO {
  const legacy = key.scheme !== 'PIN';
  return {
    scheme: legacy ? 'PASSWORD' : 'PIN',
    kdf: 'PBKDF2-SHA256',
    kdfSalt: key.kdfSalt,
    kdfIterations: key.kdfIterations,
    verifierIv: legacy ? key.verifierIv : null,
    verifier: legacy ? key.verifier : null,
    lockedUntil: key.lockedUntil && key.lockedUntil > now ? key.lockedUntil.toISOString() : null,
    keyVersion: key.keyVersion,
  };
}

export function toVaultItemDTO(item: VaultItemRecord): VaultItemDTO {
  return {
    id: item.id,
    iv: item.iv,
    ciphertext: item.ciphertext,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
