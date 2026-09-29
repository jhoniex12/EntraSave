import type { VaultItemRecord, VaultKeyRecord } from '@/repositories/vault.repository';

/**
 * Password vault — DTO layer (ARCHITECTURE.md §8). Only opaque ciphertext and
 * key-derivation parameters cross the boundary; ownership fields never do.
 */
export interface VaultKeyDTO {
  kdf: 'PBKDF2-SHA256';
  kdfSalt: string;
  kdfIterations: number;
  verifierIv: string;
  verifier: string;
  keyVersion: number;
}

export interface VaultStateDTO {
  /** null until the user creates a vault master password. */
  key: VaultKeyDTO | null;
}

export interface VaultItemDTO {
  id: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
}

export function toVaultKeyDTO(key: VaultKeyRecord): VaultKeyDTO {
  return {
    kdf: 'PBKDF2-SHA256',
    kdfSalt: key.kdfSalt,
    kdfIterations: key.kdfIterations,
    verifierIv: key.verifierIv,
    verifier: key.verifier,
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
