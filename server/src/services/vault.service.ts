import type { AuthContext } from '@/utils/auth-context';
import { ConflictError, NotFoundError } from '@/utils/app-error';
import { vaultRepository } from '@/repositories/vault.prisma';
import type { VaultRepository } from '@/repositories/vault.repository';
import {
  toVaultItemDTO,
  toVaultKeyDTO,
  type VaultItemDTO,
  type VaultKeyDTO,
  type VaultStateDTO,
} from '@/dto/vault.dto';
import {
  VAULT_MAX_ITEMS,
  type CreateVaultItemInput,
  type RekeyVaultInput,
  type SetupVaultInput,
  type UpdateVaultItemInput,
} from '@/schemas/vault.schema';

/**
 * Password vault — service layer (ARCHITECTURE.md §8).
 *
 * Zero-knowledge by design: the service stores and returns opaque ciphertext
 * and never receives the master password or a derived key, so it cannot
 * verify, recover, or read vault contents. Its rules are ownership, item
 * limits, and key-version consistency across master-password changes.
 */
const STALE_KEY_MESSAGE = 'Your vault key changed in another session. Unlock the vault again.';

export class VaultService {
  constructor(private readonly repo: VaultRepository) {}

  async getState(ctx: AuthContext): Promise<VaultStateDTO> {
    const key = await this.repo.findKey(ctx.userId);
    return { key: key ? toVaultKeyDTO(key) : null };
  }

  async setup(ctx: AuthContext, input: SetupVaultInput): Promise<VaultKeyDTO> {
    try {
      return toVaultKeyDTO(await this.repo.createKey(ctx.userId, input));
    } catch (err) {
      if (err instanceof Error && err.message === 'VAULT_EXISTS') {
        throw new ConflictError('Your vault is already set up');
      }
      throw err;
    }
  }

  async listItems(ctx: AuthContext): Promise<VaultItemDTO[]> {
    const items = await this.repo.listItems(ctx.userId);
    return items.map(toVaultItemDTO);
  }

  async createItem(ctx: AuthContext, input: CreateVaultItemInput): Promise<VaultItemDTO> {
    if (await this.repo.countItems(ctx.userId) >= VAULT_MAX_ITEMS) {
      throw new ConflictError(`A vault can hold up to ${VAULT_MAX_ITEMS} entries`);
    }
    try {
      const item = await this.repo.createItem(ctx.userId, input.keyVersion, input);
      return toVaultItemDTO(item);
    } catch (err) {
      throw mapWriteError(err);
    }
  }

  async updateItem(ctx: AuthContext, input: UpdateVaultItemInput): Promise<VaultItemDTO> {
    try {
      const item = await this.repo.updateItem(ctx.userId, input.id, input.keyVersion, input);
      return toVaultItemDTO(item);
    } catch (err) {
      throw mapWriteError(err);
    }
  }

  async deleteItem(ctx: AuthContext, id: string): Promise<{ id: string }> {
    const deleted = await this.repo.deleteItem(ctx.userId, id);
    if (deleted === 0) throw new NotFoundError('Vault entry not found');
    return { id };
  }

  async rekey(ctx: AuthContext, input: RekeyVaultInput): Promise<VaultKeyDTO> {
    try {
      const key = await this.repo.rekey(
        ctx.userId,
        input.keyVersion,
        {
          kdfSalt: input.kdfSalt,
          kdfIterations: input.kdfIterations,
          verifierIv: input.verifierIv,
          verifier: input.verifier,
        },
        input.items,
      );
      return toVaultKeyDTO(key);
    } catch (err) {
      if (err instanceof Error && err.message === 'VAULT_ITEMS_CHANGED') {
        throw new ConflictError('Your vault changed while updating. Reload and try again.');
      }
      throw mapWriteError(err);
    }
  }

  async reset(ctx: AuthContext): Promise<{ reset: true }> {
    await this.repo.reset(ctx.userId);
    return { reset: true };
  }
}

function mapWriteError(err: unknown): unknown {
  if (err instanceof Error && err.message === 'VAULT_STALE_KEY') {
    return new ConflictError(STALE_KEY_MESSAGE);
  }
  if (err instanceof Error && err.message === 'VAULT_ITEM_NOT_FOUND') {
    return new NotFoundError('Vault entry not found');
  }
  return err;
}

export const vaultService = new VaultService(vaultRepository);
