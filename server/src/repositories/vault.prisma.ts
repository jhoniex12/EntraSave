import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  EncryptedBlob,
  VaultItemRecord,
  VaultKeyMaterial,
  VaultKeyRecord,
  VaultRepository,
} from '@/repositories/vault.repository';

/**
 * Password vault — Prisma adapter (ARCHITECTURE.md §1, §11). The ONLY place
 * Prisma is touched for the vault. Every query is scoped to `userId`. Items are
 * hard-deleted: a removed secret should not linger in the database.
 */
const KEY_SELECT = {
  kdfSalt: true,
  kdfIterations: true,
  verifierIv: true,
  verifier: true,
  keyVersion: true,
} as const;

const ITEM_SELECT = {
  id: true,
  iv: true,
  ciphertext: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Item writes read the key row under REPEATABLE READ, which holds its shared
// lock until commit. A rekey takes the exclusive lock on that same row as its
// first statement, so the two serialize cleanly instead of interleaving.
const HOLD_KEY_LOCK = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

async function assertKeyVersion(tx: Prisma.TransactionClient, userId: string, keyVersion: number): Promise<void> {
  const key = await tx.vaultKey.findUnique({ where: { userId }, select: { keyVersion: true } });
  if (!key || key.keyVersion !== keyVersion) throw new Error('VAULT_STALE_KEY');
}

class PrismaVaultRepository implements VaultRepository {
  async findKey(userId: string): Promise<VaultKeyRecord | null> {
    return prisma.vaultKey.findUnique({ where: { userId }, select: KEY_SELECT });
  }

  async createKey(userId: string, material: VaultKeyMaterial): Promise<VaultKeyRecord> {
    try {
      return await prisma.vaultKey.create({ data: { userId, ...material }, select: KEY_SELECT });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Error('VAULT_EXISTS');
      }
      throw err;
    }
  }

  async listItems(userId: string): Promise<VaultItemRecord[]> {
    return prisma.vaultItem.findMany({
      where: { userId },
      select: ITEM_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async countItems(userId: string): Promise<number> {
    return prisma.vaultItem.count({ where: { userId } });
  }

  async createItem(userId: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord> {
    return prisma.$transaction(async (tx) => {
      await assertKeyVersion(tx, userId, keyVersion);
      return tx.vaultItem.create({
        data: { userId, iv: blob.iv, ciphertext: blob.ciphertext },
        select: ITEM_SELECT,
      });
    }, HOLD_KEY_LOCK);
  }

  async updateItem(userId: string, id: string, keyVersion: number, blob: EncryptedBlob): Promise<VaultItemRecord> {
    return prisma.$transaction(async (tx) => {
      await assertKeyVersion(tx, userId, keyVersion);
      const result = await tx.vaultItem.updateMany({
        where: { id, userId },
        data: { iv: blob.iv, ciphertext: blob.ciphertext },
      });
      if (result.count === 0) throw new Error('VAULT_ITEM_NOT_FOUND');
      return tx.vaultItem.findFirstOrThrow({ where: { id, userId }, select: ITEM_SELECT });
    }, HOLD_KEY_LOCK);
  }

  async deleteItem(userId: string, id: string): Promise<number> {
    const result = await prisma.vaultItem.deleteMany({ where: { id, userId } });
    return result.count;
  }

  async rekey(
    userId: string,
    keyVersion: number,
    material: VaultKeyMaterial,
    items: Array<EncryptedBlob & { id: string }>,
  ): Promise<VaultKeyRecord> {
    return prisma.$transaction(async (tx) => {
      const bumped = await tx.vaultKey.updateMany({
        where: { userId, keyVersion },
        data: { ...material, keyVersion: { increment: 1 } },
      });
      if (bumped.count === 0) throw new Error('VAULT_STALE_KEY');

      const current = await tx.vaultItem.findMany({ where: { userId }, select: { id: true } });
      const submitted = new Set(items.map((item) => item.id));
      if (
        submitted.size !== items.length
        || current.length !== submitted.size
        || current.some((item) => !submitted.has(item.id))
      ) {
        throw new Error('VAULT_ITEMS_CHANGED');
      }

      for (const item of items) {
        await tx.vaultItem.updateMany({
          where: { id: item.id, userId },
          data: { iv: item.iv, ciphertext: item.ciphertext },
        });
      }

      return tx.vaultKey.findUniqueOrThrow({ where: { userId }, select: KEY_SELECT });
    }, { timeout: 30_000 });
  }

  async reset(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.vaultItem.deleteMany({ where: { userId } }),
      prisma.vaultKey.deleteMany({ where: { userId } }),
    ]);
  }
}

export const vaultRepository: VaultRepository = new PrismaVaultRepository();
