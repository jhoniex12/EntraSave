import { Prisma, type Category } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  CategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
  DefaultCategorySeed,
} from '@/repositories/category.repository';

/**
 * Categories — Prisma adapter (ARCHITECTURE.md §1, §11). The ONLY place Prisma
 * is touched for categories. All queries scoped to `userId` + `deletedAt: null`.
 */
class PrismaCategoryRepository implements CategoryRepository {
  async listForUser(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async findByIdForUser(userId: string, id: string): Promise<Category | null> {
    return prisma.category.findFirst({ where: { id, userId, deletedAt: null } });
  }

  async countForUser(userId: string): Promise<number> {
    return prisma.category.count({ where: { userId, deletedAt: null } });
  }

  async create(data: CreateCategoryData): Promise<Category> {
    return prisma.category.create({
      data: {
        userId: data.userId,
        name: data.name,
        kind: data.kind,
        color: data.color,
        position: data.position,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateCategoryData): Promise<Category> {
    try {
      return await prisma.$transaction(async (tx) => {
        const result = await tx.category.updateMany({
          where: { id, userId, deletedAt: null },
          data,
        });
        if (result.count === 0) throw new Error('CATEGORY_NOT_FOUND');
        if (data.kind === 'INCOME') {
          await tx.budget.updateMany({
            where: { userId, categoryId: id, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        }
        return tx.category.findFirstOrThrow({ where: { id, userId } });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Error('CATEGORY_CONFLICT');
      }
      throw err;
    }
  }

  async softDelete(userId: string, id: string): Promise<number> {
    const result = await prisma.category.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async countTransactionsForCategory(userId: string, id: string): Promise<number> {
    // Count ALL referencing transactions (incl. soft-deleted): the FK constraint
    // counts row existence, not deletedAt, so any reference blocks a hard delete.
    return prisma.transaction.count({ where: { userId, categoryId: id } });
  }

  async hardDelete(userId: string, id: string): Promise<void> {
    // Remove dependent budget rows first (their FK to Category is NoAction),
    // then the category itself — atomically.
    await prisma.$transaction([
      prisma.budget.deleteMany({ where: { userId, categoryId: id } }),
      prisma.category.deleteMany({ where: { id, userId } }),
    ]);
  }

  async setPositions(userId: string, orderedIds: string[]): Promise<void> {
    // Ownership enforced in each WHERE; non-owned ids are simply no-ops.
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.category.updateMany({
          where: { id, userId, deletedAt: null },
          data: { position: index },
        }),
      ),
    );
  }

  async createDefaults(userId: string, defaults: DefaultCategorySeed[]): Promise<void> {
    // Upsert per (userId, name, kind) unique key — idempotent and safe under the
    // rare concurrent first-load (no skipDuplicates on SQL Server).
    for (let i = 0; i < defaults.length; i++) {
      const c = defaults[i]!;
      await prisma.category.upsert({
        where: { userId_name_kind: { userId, name: c.name, kind: c.kind } },
        create: { userId, name: c.name, kind: c.kind, color: c.color, position: i },
        update: {},
      });
    }
  }
}

export const categoryRepository: CategoryRepository = new PrismaCategoryRepository();
