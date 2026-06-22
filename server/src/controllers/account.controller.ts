import { defineRoute } from '@/utils/define-route';
import { accountService } from '@/services/account.service';
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  DeleteAccountSchema,
  ListAccountsSchema,
  ReorderAccountsSchema,
} from '@/schemas/account.schema';

/**
 * Accounts — controllers (docs/ARCHITECTURE.md §8). THIN handlers only: each
 * declares its security policy (permission, rate limit, audit) and delegates to
 * the service via defineRoute. No business logic, no Prisma here. Routes wire
 * these to URLs in routes/account.routes.ts.
 */
export const listAccounts = defineRoute({
  name: 'account.list',
  permission: 'accounts.read',
  rateLimit: 'account.list',
  schema: ListAccountsSchema,
  handler: ({ ctx, input }) => accountService.list(ctx, input),
  audit: false, // high-volume read; not audited
});

export const accountSummary = defineRoute({
  name: 'account.summary',
  permission: 'accounts.read',
  rateLimit: 'account.list',
  schema: ListAccountsSchema,
  handler: ({ ctx, input }) => accountService.listWithSummary(ctx, input),
  audit: false,
});

export const createAccount = defineRoute({
  name: 'account.create',
  permission: 'accounts.write',
  rateLimit: 'account.create',
  schema: CreateAccountSchema,
  handler: ({ ctx, input }) => accountService.create(ctx, input),
  audit: ({ ctx, output }) => ({
    action: 'account.create',
    resourceType: 'account',
    resourceId: output.id,
    targetUserId: ctx.userId,
    metadata: { type: output.type, currency: output.currency }, // no balance
  }),
});

export const updateAccount = defineRoute({
  name: 'account.update',
  permission: 'accounts.write',
  rateLimit: 'account.update',
  schema: UpdateAccountSchema,
  // Per-resource ownership check (the "what is YOURS" gate).
  ownership: ({ ctx, input }) => accountService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => accountService.update(ctx, input),
  audit: ({ input }) => ({
    action: 'account.update',
    resourceType: 'account',
    resourceId: input.id,
  }),
});

export const reorderAccounts = defineRoute({
  name: 'account.reorder',
  permission: 'accounts.write',
  rateLimit: 'account.reorder',
  schema: ReorderAccountsSchema,
  handler: ({ ctx, input }) => accountService.reorder(ctx, input),
  audit: false, // high-frequency during drag/reorder
});

export const deleteAccount = defineRoute({
  name: 'account.delete',
  permission: 'accounts.write',
  rateLimit: 'account.delete',
  schema: DeleteAccountSchema,
  ownership: ({ ctx, input }) => accountService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => accountService.remove(ctx, input),
  audit: ({ input, output }) => ({
    action: 'account.delete',
    resourceType: 'account',
    resourceId: input.id,
    metadata: { deletedTransactions: output.deletedTransactions },
  }),
});
