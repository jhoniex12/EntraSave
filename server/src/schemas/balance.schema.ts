import { z } from 'zod';

/**
 * Monthly starting balance — Zod validation (ARCHITECTURE.md §8). `month` is
 * 0-based (0 = January) to match the app. Balance may be negative.
 */
export const SetStartingBalanceSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(0).max(11),
  startingBalance: z
    .string()
    .trim()
    .regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Invalid amount'),
});
export type SetStartingBalanceInput = z.infer<typeof SetStartingBalanceSchema>;

export const ResetStartingBalanceSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(0).max(11),
});
export type ResetStartingBalanceInput = z.infer<typeof ResetStartingBalanceSchema>;
