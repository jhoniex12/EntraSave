import type { Category } from '@prisma/client';

/**
 * Categories — repository INTERFACE (ARCHITECTURE.md §1 seam). Every method is
 * scoped by `userId`; ownership is enforced in the query `where`. Listing is
 * ordered by the user-defined `position`.
 */
export interface DefaultCategorySeed {
  name: string;
  kind: string;
  color?: string;
}

export interface CreateCategoryData {
  userId: string;
  name: string;
  kind: string;
  color?: string;
  position: number;
}

export interface UpdateCategoryData {
  name?: string;
  kind?: string;
  color?: string;
}

export interface CategoryRepository {
  listForUser(userId: string): Promise<Category[]>;
  findByIdForUser(userId: string, id: string): Promise<Category | null>;
  countForUser(userId: string): Promise<number>;
  create(data: CreateCategoryData): Promise<Category>;
  update(userId: string, id: string, data: UpdateCategoryData): Promise<Category>;
  softDelete(userId: string, id: string): Promise<number>;
  /** How many transactions reference this category (any state) — blocks hard delete. */
  countTransactionsForCategory(userId: string, id: string): Promise<number>;
  /** Permanently remove the category and its dependent budget rows. */
  hardDelete(userId: string, id: string): Promise<void>;
  /** Persist a new ordering: position = index for each owned id. */
  setPositions(userId: string, orderedIds: string[]): Promise<void>;
  /** Idempotent: creates each default only if it doesn't already exist. */
  createDefaults(userId: string, defaults: DefaultCategorySeed[]): Promise<void>;
}
