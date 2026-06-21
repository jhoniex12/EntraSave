import type { Account } from '@prisma/client';
import { decimalToString } from '@/utils/money';

/**
 * Accounts — DTO layer (ARCHITECTURE.md §8). The ONLY shape that crosses the
 * service boundary back to the UI/API. Internal fields (userId, deletedAt) are
 * never exposed. Money is serialized to a string to preserve Decimal precision.
 */
export interface AccountDTO {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSummaryDTO extends AccountDTO {
  currentBalance: string;
  incomeThisMonth: string;
  expenseThisMonth: string;
  netThisMonth: string;
}

export function toAccountDTO(account: Account): AccountDTO {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    balance: decimalToString(account.balance),
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
