/**
 * Password vault — repository INTERFACE (ARCHITECTURE.md §1 seam). Every method
 * is scoped by `userId`; ownership is enforced in the query `where`.
 */
export interface VaultKeyRecord {
  kdfSalt: string;
  kdfIterations: number;
  verifierIv: string;
  verifier: string;
  keyVersion: number;
}

export interface VaultItemRecord {
  id: string;
  iv: string;
  ciphertext: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultKeyMaterial {
  kdfSalt: string;
  kdfIterations: number;
  verifierIv: string;
  verifier: string;
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}

export interface VaultRepository {
  findKey(userId: string): Promise<VaultKeyRecord | null>;
  /** Throws `VAULT_EXISTS` when the user already has a vault key. */
  createKey(userId: string, material: VaultKeyMaterial): Promise<VaultKeyRecord>;
  listItems(userId: string): Promise<VaultItemRecord[]>;
  countItems(userId: string): Promise<number>;
  /**
   * Item writes re-read the key version inside their transaction, so a write
   * racing a master-password change cannot persist ciphertext under a
   * superseded key. Throws `VAULT_STALE_KEY` on a mismatch or missing vault.
   */
  createItem(userId: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord>;
  /** Also throws `VAULT_ITEM_NOT_FOUND` when the item is not the user's. */
  updateItem(userId: string, id: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord>;
  deleteItem(userId: string, id: string): Promise<number>;
  /**
   * Atomically replace the key material and every item's ciphertext. Throws
   * `VAULT_STALE_KEY` on a version mismatch and `VAULT_ITEMS_CHANGED` unless
   * `items` covers exactly the user's current item ids.
   */
  rekey(
    userId: string,
    keyVersion: number,
    material: VaultKeyMaterial,
    items: Array<EncryptedBlob & { id: string }>,
  ): Promise<VaultKeyRecord>;
  /** Permanently remove the key and all items. */
  reset(userId: string): Promise<void>;
}
