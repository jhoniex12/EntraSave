import { z } from 'zod';

/**
 * Transactions — Zod validation layer (ARCHITECTURE.md §8). Money is accepted as
 * a bounded decimal STRING (never a float). All strings are length-capped.
 */
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;

export const CreateTransactionSchema = z.object({
  accountId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  type: z.enum(TRANSACTION_TYPES),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Invalid amount'), // positive decimal, <=4dp
  // No currency field: it is derived server-side from the selected account.
  description: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  occurredAt: z.coerce.date(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export const UpdateTransactionSchema = z.object({
  id: z.string().cuid(),
  categoryId: z.string().cuid().nullable().optional(),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Invalid amount')
    .optional(),
  description: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  occurredAt: z.coerce.date().optional(),
});
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

export const DeleteTransactionSchema = z.object({
  id: z.string().cuid(),
});
export type DeleteTransactionInput = z.infer<typeof DeleteTransactionSchema>;

/** Keyset pagination query (ARCHITECTURE.md §10). */
export const ListTransactionsSchema = z.object({
  accountId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  /** Opaque cursor returned by the previous page. */
  cursor: z.string().optional(),
});
export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;

/**
 * Read query for a single calendar month (UTC). `month` is 0-based (0 = January)
 * to match the API and MonthlyBalance model.
 */
export const GetMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(0).max(11),
  categoryId: z.string().cuid().optional(),
});
export type GetMonthInput = z.infer<typeof GetMonthSchema>;
