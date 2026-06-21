import { z } from 'zod';
import { defineRoute } from '@/utils/define-route';
import { categoryService } from '@/services/category.service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  DeleteCategorySchema,
  ReorderCategoriesSchema,
} from '@/schemas/category.schema';

/**
 * Categories — controllers (docs/ARCHITECTURE.md §8). Mutations require
 * `categories.write` and are audited. `/list` lazily seeds the default set the
 * first time a user has none (same behaviour the original pages relied on).
 */
export const listCategories = defineRoute({
  name: 'category.list',
  permission: 'categories.read',
  rateLimit: 'category.update',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => categoryService.listEnsuringDefaults(ctx),
  audit: false,
});

export const createCategory = defineRoute({
  name: 'category.create',
  permission: 'categories.write',
  rateLimit: 'category.create',
  schema: CreateCategorySchema,
  handler: ({ ctx, input }) => categoryService.create(ctx, input),
  audit: ({ output }) => ({
    action: 'category.create',
    resourceType: 'category',
    resourceId: output.id,
  }),
});

export const updateCategory = defineRoute({
  name: 'category.update',
  permission: 'categories.write',
  rateLimit: 'category.update',
  schema: UpdateCategorySchema,
  ownership: ({ ctx, input }) => categoryService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => categoryService.update(ctx, input),
  audit: ({ input }) => ({
    action: 'category.update',
    resourceType: 'category',
    resourceId: input.id,
  }),
});

export const deleteCategory = defineRoute({
  name: 'category.delete',
  permission: 'categories.write',
  rateLimit: 'category.delete',
  schema: DeleteCategorySchema,
  ownership: ({ ctx, input }) => categoryService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => categoryService.remove(ctx, input.id),
  audit: ({ input, output }) => ({
    action: 'category.delete',
    resourceType: 'category',
    resourceId: input.id,
    metadata: { hardDeleted: output.hardDeleted },
  }),
});

export const reorderCategories = defineRoute({
  name: 'category.reorder',
  permission: 'categories.write',
  rateLimit: 'category.reorder',
  schema: ReorderCategoriesSchema,
  handler: ({ ctx, input }) => categoryService.reorder(ctx, input),
  audit: false, // high-frequency during drag/reorder
});
