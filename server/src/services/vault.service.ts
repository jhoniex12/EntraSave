import type { AuthContext } from '@/utils/auth-context';
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from '@/utils/app-error';
import {
  createPinVerifier,
  matchesPinVerifier,
  unwrapVaultSecret,
  wrapVaultSecret,
} from '@/utils/vault-secret';
import { vaultRepository } from '@/repositories/vault.prisma';
import type {
  VaultKeyRecord,
  VaultPinKeyMaterial,
  VaultRepository,
} from '@/repositories/vault.repository';
import {
  toVaultItemDTO,
  toVaultKeyDTO,
  type VaultItemDTO,
  type VaultKeyDTO,
  type VaultStateDTO,
  type VaultUnlockDTO,
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
 * Entries are encrypted in the browser under a key derived from the PIN and a
 * per-user vault secret. This service never sees the PIN or the key: it
 * verifies a peppered PIN proof, enforces the attempt lockout, and releases the
 * vault secret only after a correct PIN. It also owns item limits and
 * key-version consistency across PIN changes.
 */
const STALE_KEY_MESSAGE = 'Your vault PIN changed in another session. Unlock the vault again.';

/** Wrong PINs allowed before the vault locks. */
export const VAULT_MAX_PIN_ATTEMPTS = 5;
const BASE_LOCK_MS = 15 * 60_000;
const MAX_LOCK_MS = 24 * 60 * 60_000;

/**
 * Lock duration once `failures` reaches the limit. It doubles with each further
 * wrong PIN (15 min, 30 min, 1 h, … capped at 24 h) and only resets after a
 * correct PIN, which keeps online guessing of 10^6 PINs infeasible.
 */
function lockDurationMs(failures: number): number {
  return Math.min(BASE_LOCK_MS * 2 ** (failures - VAULT_MAX_PIN_ATTEMPTS), MAX_LOCK_MS);
}

function describeWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export class VaultService {
  constructor(private readonly repo: VaultRepository) {}

  async getState(ctx: AuthContext): Promise<VaultStateDTO> {
    const key = await this.repo.findKey(ctx.userId);
    return { key: key ? toVaultKeyDTO(key) : null };
  }

  async setup(ctx: AuthContext, input: SetupVaultInput): Promise<VaultKeyDTO> {
    try {
      return toVaultKeyDTO(await this.repo.createKey(ctx.userId, this.pinMaterial(ctx, input)));
    } catch (err) {
      if (err instanceof Error && err.message === 'VAULT_EXISTS') {
        throw new ConflictError('Your vault is already set up');
      }
      throw err;
    }
  }

  async unlock(ctx: AuthContext, pinProof: string): Promise<VaultUnlockDTO> {
    const key = await this.verifyPin(ctx, pinProof);
    if (!key.wrappedSecret) throw new NotFoundError('Vault not found');
    return { secret: unwrapVaultSecret(ctx.userId, key.wrappedSecret) };
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

  /**
   * Change the PIN, or convert a legacy master-password vault to a PIN. A PIN
   * vault must prove its current PIN (counted toward the lockout); a legacy
   * vault's password is checked in the browser, as it always was.
   */
  async rekey(ctx: AuthContext, input: RekeyVaultInput): Promise<VaultKeyDTO> {
    const current = await this.repo.findKey(ctx.userId);
    if (!current) throw new ConflictError(STALE_KEY_MESSAGE);
    if (current.scheme === 'PIN') {
      if (!input.currentPinProof) {
        throw new ValidationError({ currentPin: ['Enter your current PIN'] }, 'Enter your current PIN');
      }
      await this.verifyPin(ctx, input.currentPinProof);
    }

    try {
      const key = await this.repo.rekey(ctx.userId, input.keyVersion, this.pinMaterial(ctx, input), input.items);
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

  private pinMaterial(ctx: AuthContext, input: SetupVaultInput): VaultPinKeyMaterial {
    return {
      kdfSalt: input.kdfSalt,
      kdfIterations: input.kdfIterations,
      pinVerifier: createPinVerifier(ctx.userId, input.pinProof),
      wrappedSecret: wrapVaultSecret(ctx.userId, input.secret),
    };
  }

  /**
   * Check a PIN proof under the lockout policy. The attempt is claimed (and the
   * lock set pessimistically once the limit is reached) BEFORE comparing, so
   * parallel guesses cannot slip past the limit; a correct PIN clears both.
   */
  private async verifyPin(ctx: AuthContext, pinProof: string): Promise<VaultKeyRecord> {
    const key = await this.repo.findKey(ctx.userId);
    if (!key || key.scheme !== 'PIN' || !key.pinVerifier) throw new NotFoundError('Vault not found');

    const now = Date.now();
    if (key.lockedUntil && key.lockedUntil.getTime() > now) {
      throw lockedError(key.lockedUntil.getTime() - now);
    }

    const failures = key.failedAttempts + 1;
    const lockMs = failures >= VAULT_MAX_PIN_ATTEMPTS ? lockDurationMs(failures) : 0;
    const claimed = await this.repo.claimUnlockAttempt(
      ctx.userId,
      key.failedAttempts,
      failures,
      lockMs ? new Date(now + lockMs) : null,
    );
    if (!claimed) throw new ConflictError('Another unlock attempt is in progress. Try again.');

    if (matchesPinVerifier(ctx.userId, pinProof, key.pinVerifier)) {
      await this.repo.clearUnlockAttempts(ctx.userId);
      return key;
    }

    if (lockMs) throw lockedError(lockMs, 'Incorrect PIN.');
    const remaining = VAULT_MAX_PIN_ATTEMPTS - failures;
    const text = `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left before your vault is locked.`;
    throw new ValidationError({ pin: [text] }, text);
  }
}

function lockedError(ms: number, reason = 'Too many incorrect PINs.'): RateLimitError {
  return new RateLimitError(Math.ceil(ms / 1000), `${reason} Your vault is locked for ${describeWait(ms)}.`);
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
