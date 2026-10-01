/**
 * Password vault — repository INTERFACE (ARCHITECTURE.md §1 seam). Every method
 * is scoped by `userId`; ownership is enforced in the query `where`.
 */
export interface VaultKeyRecord {
  /** "PIN" | "PASSWORD" (legacy) */
  scheme: string;
  kdfSalt: string;
  kdfIterations: number;
  verifierIv: string | null;
  verifier: string | null;
  pinVerifier: string | null;
  wrappedSecret: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  keyVersion: number;
}

export interface VaultItemRecord {
  id: string;
  iv: string;
  ciphertext: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Server-prepared PIN key material (already peppered/wrapped). */
export interface VaultPinKeyMaterial {
  kdfSalt: string;
  kdfIterations: number;
  pinVerifier: string;
  wrappedSecret: string;
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}

export interface VaultRepository {
  findKey(userId: string): Promise<VaultKeyRecord | null>;
  /** Throws `VAULT_EXISTS` when the user already has a vault key. */
  createKey(userId: string, material: VaultPinKeyMaterial): Promise<VaultKeyRecord>;
  /**
   * Optimistically record a PIN attempt: sets the failure count and lock only
   * if the stored count still equals `expectedFailures`. Returns false when a
   * concurrent attempt won the race, so each attempt is counted exactly once.
   */
  claimUnlockAttempt(
    userId: string,
    expectedFailures: number,
    failures: number,
    lockedUntil: Date | null,
  ): Promise<boolean>;
  clearUnlockAttempts(userId: string): Promise<void>;
  listItems(userId: string): Promise<VaultItemRecord[]>;
  countItems(userId: string): Promise<number>;
  /**
   * Item writes re-read the key version inside their transaction, so a write
   * racing a PIN change cannot persist ciphertext under a superseded key.
   * Throws `VAULT_STALE_KEY` on a mismatch or missing vault.
   */
  createItem(userId: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord>;
  /** Also throws `VAULT_ITEM_NOT_FOUND` when the item is not the user's. */
  updateItem(userId: string, id: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord>;
  deleteItem(userId: string, id: string): Promise<number>;
  /**
   * Atomically switch to new PIN key material and replace every item's
   * ciphertext. Throws `VAULT_STALE_KEY` on a version mismatch and
   * `VAULT_ITEMS_CHANGED` unless `items` covers exactly the user's item ids.
   */
  rekey(
    userId: string,
    keyVersion: number,
    material: VaultPinKeyMaterial,
    items: Array<EncryptedBlob & { id: string }>,
  ): Promise<VaultKeyRecord>;
  /** Permanently remove the key and all items. */
  reset(userId: string): Promise<void>;
}
