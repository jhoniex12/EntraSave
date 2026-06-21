import { z } from 'zod';
import { isSupportedCurrency } from '@/utils/currencies';

/**
 * Users — Zod validation layer (ARCHITECTURE.md §8). The currency must be one of
 * the supported ISO codes; arbitrary input is rejected.
 */
export const UpdateBaseCurrencySchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .toUpperCase()
    .refine(isSupportedCurrency, { message: 'Unsupported currency' }),
});
export type UpdateBaseCurrencyInput = z.infer<typeof UpdateBaseCurrencySchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(100),
}).strict();
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
