import { z } from 'zod';
import { defineRoute } from '@/utils/define-route';
import { budgetService } from '@/services/budget.service';
import {
  SetBudgetSchema,
  DeleteBudgetSchema,
  BudgetStatusSchema,
} from '@/schemas/budget.schema';

/**
 * Budgets — controllers (docs/ARCHITECTURE.md §8). Reads (`/list`, `/status`)
 * plus write mutations, all owner-scoped via ctx.userId.
 */
export const listBudgets = defineRoute({
  name: 'budget.list',
  permission: 'budgets.read',
  rateLimit: 'budget.set',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => budgetService.list(ctx),
  audit: false,
});

export const budgetStatus = defineRoute({
  name: 'budget.status',
  permission: 'budgets.read',
  rateLimit: 'budget.set',
  schema: BudgetStatusSchema,
  handler: ({ ctx, input }) => budgetService.getMonthStatus(ctx, input.year, input.month),
  audit: false,
});

export const setBudget = defineRoute({
  name: 'budget.set',
  permission: 'budgets.write',
  rateLimit: 'budget.set',
  schema: SetBudgetSchema,
  handler: ({ ctx, input }) => budgetService.set(ctx, input),
  audit: ({ input, output }) => ({
    action: 'budget.set',
    resourceType: 'budget',
    resourceId: output.id,
    metadata: { categoryId: input.categoryId },
  }),
});

export const deleteBudget = defineRoute({
  name: 'budget.delete',
  permission: 'budgets.write',
  rateLimit: 'budget.delete',
  schema: DeleteBudgetSchema,
  handler: ({ ctx, input }) => budgetService.remove(ctx, input.categoryId),
  audit: ({ input }) => ({
    action: 'budget.delete',
    resourceType: 'budget',
    resourceId: input.categoryId,
  }),
});
