import { defineRoute } from '@/utils/define-route';
import { balanceService } from '@/services/balance.service';
import {
  SetStartingBalanceSchema,
  ResetStartingBalanceSchema,
} from '@/schemas/balance.schema';

/**
 * Monthly balance — controllers (docs/ARCHITECTURE.md §8). Reuses
 * `transactions.write` (managing the month's figures); owner-scoped.
 */
export const setStartingBalance = defineRoute({
  name: 'balance.set',
  permission: 'transactions.write',
  rateLimit: 'balance.set',
  schema: SetStartingBalanceSchema,
  handler: async ({ ctx, input }) => {
    await balanceService.setStartingBalance(ctx, input);
    return { ok: true };
  },
  audit: ({ input }) => ({
    action: 'balance.set',
    resourceType: 'monthlyBalance',
    metadata: { year: input.year, month: input.month }, // no amount
  }),
});

export const resetStartingBalance = defineRoute({
  name: 'balance.reset',
  permission: 'transactions.write',
  rateLimit: 'balance.set',
  schema: ResetStartingBalanceSchema,
  handler: async ({ ctx, input }) => {
    await balanceService.resetStartingBalance(ctx, input);
    return { ok: true };
  },
  audit: ({ input }) => ({
    action: 'balance.reset',
    resourceType: 'monthlyBalance',
    metadata: { year: input.year, month: input.month },
  }),
});
