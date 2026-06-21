import { defineRoute } from '@/utils/define-route';
import { transactionService } from '@/services/transaction.service';
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  DeleteTransactionSchema,
  ListTransactionsSchema,
  GetMonthSchema,
} from '@/schemas/transaction.schema';

/**
 * Transactions — controllers (docs/ARCHITECTURE.md §8). Thin handlers via
 * defineRoute; no business logic, no Prisma here.
 */
export const listTransactions = defineRoute({
  name: 'transaction.list',
  permission: 'transactions.read',
  rateLimit: 'transaction.list',
  schema: ListTransactionsSchema,
  handler: ({ ctx, input }) => transactionService.list(ctx, input),
  audit: false,
});

export const transactionMonth = defineRoute({
  name: 'transaction.month',
  permission: 'transactions.read',
  rateLimit: 'transaction.list',
  schema: GetMonthSchema,
  handler: ({ ctx, input }) =>
    transactionService.getMonth(ctx, input.year, input.month, input.categoryId),
  audit: false,
});

export const createTransaction = defineRoute({
  name: 'transaction.create',
  permission: 'transactions.write',
  rateLimit: 'transaction.create',
  schema: CreateTransactionSchema,
  handler: ({ ctx, input }) => transactionService.create(ctx, input),
  audit: ({ output }) => ({
    action: 'transaction.create',
    resourceType: 'transaction',
    resourceId: output.id,
    // Redacted: type/account only — NEVER the amount (docs/ARCHITECTURE.md §14).
    metadata: { type: output.type, accountId: output.accountId },
  }),
});

export const updateTransaction = defineRoute({
  name: 'transaction.update',
  permission: 'transactions.write',
  rateLimit: 'transaction.update',
  schema: UpdateTransactionSchema,
  ownership: ({ ctx, input }) => transactionService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => transactionService.update(ctx, input),
  audit: ({ input }) => ({
    action: 'transaction.update',
    resourceType: 'transaction',
    resourceId: input.id,
  }),
});

export const deleteTransaction = defineRoute({
  name: 'transaction.delete',
  permission: 'transactions.write',
  rateLimit: 'transaction.delete',
  schema: DeleteTransactionSchema,
  ownership: ({ ctx, input }) => transactionService.assertOwned(ctx, input.id),
  handler: ({ ctx, input }) => transactionService.softDelete(ctx, input.id),
  audit: ({ input }) => ({
    action: 'transaction.delete',
    resourceType: 'transaction',
    resourceId: input.id,
  }),
});
