import type { Transaction } from '@prisma/client';

/**
 * Transactions — repository INTERFACE (ARCHITECTURE.md §1 seam). Every method is
 * scoped by `userId`; ownership isolation is enforced in the query `where`.
 * Listing uses keyset pagination (ARCHITECTURE.md §10) for stable O(1) pages.
 */
export interface CreateTransactionData {
  userId: string;
  accountId: string;
  categoryId?: string;
  type: Transaction['type'];
  amount: string;
  currency: string;
  description?: string;
  notes?: string;
  occurredAt: Date;
}

export interface UpdateTransactionData {
  categoryId?: string | null;
  amount?: string;
  description?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}

export interface ListTransactionsParams {
  userId: string;
  accountId?: string;
  categoryId?: string;
  pageSize: number;
  /** Inclusive lower bound on occurredAt (UTC). */
  from?: Date;
  /** Exclusive upper bound on occurredAt (UTC). */
  to?: Date;
  /** Decoded keyset cursor: list rows strictly older than this. */
  cursor?: { occurredAt: Date; id: string };
}

export interface MonthSummary {
  /** This month's income (debit). */
  income: string;
  /** This month's expense (credit). */
  expense: string;
  /** This month's net change (income - expense). */
  net: string;
  /** Running balance at the start of the month: openingTotal + net of all prior transactions. */
  startingBalance: string;
  /** startingBalance + this month's net. */
  currentBalance: string;
  /** True when the starting balance came from a user override (not computed). */
  isManualStart: boolean;
}

export interface MonthCategorySummary {
  categoryId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
}

export interface TransactionRepository {
  create(data: CreateTransactionData): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  list(params: ListTransactionsParams): Promise<Transaction[]>;
  /**
   * Month income/expense/net plus running starting & current balances.
   * `openingTotal` is the sum of account opening balances (the baseline used
   * when there is no override). `startingOverride` (if non-null) is used as the
   * starting balance directly, skipping the computed running balance.
   */
  monthSummary(
    userId: string,
    from: Date,
    to: Date,
    openingTotal: string,
    startingOverride: string | null,
  ): Promise<MonthSummary>;
  monthCategorySummary(
    userId: string,
    from: Date,
    to: Date,
    categoryId?: string,
  ): Promise<MonthCategorySummary[]>;
  update(userId: string, id: string, data: UpdateTransactionData): Promise<Transaction>;
  softDelete(userId: string, id: string): Promise<number>;
}
