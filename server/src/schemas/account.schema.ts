import { z } from 'zod';
import { isSupportedCurrency, DEFAULT_CURRENCY } from '@/utils/currencies';

/**
 * Accounts — Zod validation layer (ARCHITECTURE.md §8). All untrusted input is
 * parsed here before reaching the service. Every string is length-bounded
 * (request-size / abuse defense).
 */
export const ACCOUNT_TYPES = [
  'CHECKING',
  'SAVINGS',
  'CASH',
  'CREDIT_CARD',
  'INVESTMENT',
  'OTHER',
] as const;

export const CreateAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  type: z.enum(ACCOUNT_TYPES),
  currency: z
    .string()
    .trim()
    .length(3)
    .toUpperCase()
    .refine(isSupportedCurrency, { message: 'Unsupported currency' })
    .default(DEFAULT_CURRENCY),
  // Money as a string -> validated to a 2-or-4dp decimal; never parsed as float.
  openingBalance: z
    .string()
    .trim()
    .regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Invalid amount')
    .default('0'),
});
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(80).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  openingBalance: z
    .string()
    .trim()
    .regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Invalid amount')
    .optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

export const DeleteAccountSchema = z.object({
  id: z.string().cuid(),
  confirmation: z.string().trim().min(1).max(80),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

export const ListAccountsSchema = z.object({
  includeArchived: z.boolean().default(false),
});
export type ListAccountsInput = z.infer<typeof ListAccountsSchema>;
