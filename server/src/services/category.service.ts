import type { AuthContext } from '@/utils/auth-context';
import { ConflictError, NotFoundError } from '@/utils/app-error';
import { categoryRepository } from '@/repositories/category.prisma';
import type {
  CategoryRepository,
  DefaultCategorySeed,
} from '@/repositories/category.repository';
import { toCategoryDTO, type CategoryDTO } from '@/dto/category.dto';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
} from '@/schemas/category.schema';

/**
 * Categories — service layer (ARCHITECTURE.md §8). Owns the default category set
 * and the lazy-provisioning rule.
 */
const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Groceries', kind: 'EXPENSE' },
  { name: 'Transportation', kind: 'EXPENSE' },
  { name: 'Housing & Bills', kind: 'EXPENSE' },
  { name: 'Dining Out', kind: 'EXPENSE' },
  { name: 'Education', kind: 'EXPENSE' },
  { name: 'Salary', kind: 'INCOME' },
];

export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  async list(ctx: AuthContext): Promise<CategoryDTO[]> {
    const categories = await this.repo.listForUser(ctx.userId);
    return categories.map(toCategoryDTO);
  }

  /**
   * Lazy provisioning: the first time a user has no categories, seed the default
   * set. Idempotent and bounded — a deliberate init, not per-request work.
   */
  async listEnsuringDefaults(ctx: AuthContext): Promise<CategoryDTO[]> {
    let categories = await this.repo.listForUser(ctx.userId);
    if (categories.length === 0) {
      await this.repo.createDefaults(ctx.userId, DEFAULT_CATEGORIES);
      categories = await this.repo.listForUser(ctx.userId);
    }
    return categories.map(toCategoryDTO);
  }

  /** Ownership assertion for use when a transaction references a category. */
  async assertOwned(ctx: AuthContext, id: string): Promise<void> {
    const category = await this.repo.findByIdForUser(ctx.userId, id);
    if (!category) throw new NotFoundError('Category not found');
  }

  async getOwned(ctx: AuthContext, id: string): Promise<CategoryDTO> {
    const category = await this.repo.findByIdForUser(ctx.userId, id);
    if (!category) throw new NotFoundError('Category not found');
    return toCategoryDTO(category);
  }

  async create(ctx: AuthContext, input: CreateCategoryInput): Promise<CategoryDTO> {
    const position = await this.repo.countForUser(ctx.userId); // append to the end
    const category = await this.repo.create({
      userId: ctx.userId,
      name: input.name,
      kind: input.kind,
      color: input.color,
      position,
    });
    return toCategoryDTO(category);
  }

  async update(ctx: AuthContext, input: UpdateCategoryInput): Promise<CategoryDTO> {
    try {
      const category = await this.repo.update(ctx.userId, input.id, {
        name: input.name,
        kind: input.kind,
        color: input.color,
      });
      return toCategoryDTO(category);
    } catch (err) {
      if (err instanceof Error && err.message === 'CATEGORY_NOT_FOUND') {
        throw new NotFoundError('Category not found');
      }
      if (err instanceof Error && err.message === 'CATEGORY_CONFLICT') {
        throw new ConflictError('A category with this name and type already exists');
      }
      throw err;
    }
  }

  /**
   * Hybrid delete: a category that no transaction references is removed
   * permanently (along with its budget) to avoid leaving unused rows behind.
   * If transactions reference it, the FK prevents a hard delete and we'd lose
   * their category label — so it is soft-deleted, preserving history.
   */
  async remove(ctx: AuthContext, id: string): Promise<{ id: string; hardDeleted: boolean }> {
    const category = await this.repo.findByIdForUser(ctx.userId, id);
    if (!category) throw new NotFoundError('Category not found');

    const references = await this.repo.countTransactionsForCategory(ctx.userId, id);
    if (references > 0) {
      await this.repo.softDelete(ctx.userId, id);
      return { id, hardDeleted: false };
    }

    await this.repo.hardDelete(ctx.userId, id);
    return { id, hardDeleted: true };
  }

  async reorder(ctx: AuthContext, input: ReorderCategoriesInput): Promise<{ count: number }> {
    await this.repo.setPositions(ctx.userId, input.orderedIds);
    return { count: input.orderedIds.length };
  }
}

export const categoryService = new CategoryService(categoryRepository);
