import type { Transaction } from '@prisma/client';
import { decimalToString } from '@/utils/money';

/**
 * Transactions — DTO layer (ARCHITECTURE.md §8). Internal fields (userId,
 * deletedAt) are never exposed; money is serialized as a string.
 */
export interface TransactionDTO {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export function toTransactionDTO(tx: Transaction): TransactionDTO {
  return {
    id: tx.id,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    type: tx.type,
    amount: decimalToString(tx.amount),
    currency: tx.currency,
    description: tx.description,
    notes: tx.notes,
    occurredAt: tx.occurredAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}
