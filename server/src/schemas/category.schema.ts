import { z } from 'zod';

/**
 * Categories — Zod validation layer (ARCHITECTURE.md §8).
 */
export const CATEGORY_KINDS = ['INCOME', 'EXPENSE'] as const;

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  kind: z.enum(CATEGORY_KINDS),
  color: z.string().trim().max(20).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(CATEGORY_KINDS),
  color: z.string().trim().max(20).optional(),
});
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

export const DeleteCategorySchema = z.object({
  id: z.string().cuid(),
});
export type DeleteCategoryInput = z.infer<typeof DeleteCategorySchema>;

export const ReorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1).max(200),
});
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesSchema>;
