import { z } from 'zod';

export const SetBudgetSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Invalid budget amount'),
});
export type SetBudgetInput = z.infer<typeof SetBudgetSchema>;

export const DeleteBudgetSchema = z.object({
  categoryId: z.string().cuid(),
});
export type DeleteBudgetInput = z.infer<typeof DeleteBudgetSchema>;

/** Per-month budget usage read (UTC; `month` is 0-based, 0 = January). */
export const BudgetStatusSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(0).max(11),
});
export type BudgetStatusInput = z.infer<typeof BudgetStatusSchema>;
