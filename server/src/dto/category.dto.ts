import type { Category } from '@prisma/client';

/**
 * Categories — DTO layer (ARCHITECTURE.md §8). Internal fields (userId,
 * deletedAt) never cross the boundary.
 */
export interface CategoryDTO {
  id: string;
  name: string;
  /** "INCOME" | "EXPENSE" */
  kind: string;
  color: string | null;
}

export function toCategoryDTO(category: Category): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    color: category.color,
  };
}
