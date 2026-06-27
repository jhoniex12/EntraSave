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
  /** When set, a repeat create with the same (userId, key) returns the original row. */
  idempotencyKey?: string;
}

export interface UpdateTransactionData {
  categoryId?: string | null;
  amount?: string;
  description?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}

export interface CreateTransferData {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  description?: string;
  occurredAt: Date;
  /** When set, a repeat create with the same (userId, key) returns the original legs. */
  idempotencyKey?: string;
}

/** The two atomic legs of a transfer: outflow on the source, inflow on the destination. */
export interface TransferLegs {
  out: Transaction;
  in: Transaction;
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
  /** Atomically create both legs of a transfer; idempotent on (userId, key). */
  createTransfer(data: CreateTransferData): Promise<TransferLegs>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  list(params: ListTransactionsParams): Promise<Transaction[]>;
  /**
   * Month income/expense/net plus running starting & current balances.
   * `openingTotal` is the baseline opening balance (sum of all accounts, or a
   * single account's opening balance when `accountId` is set). `startingOverride`
   * (if non-null) is used as the starting balance directly, skipping the computed
   * running balance — only honoured for the all-accounts view. When `accountId`
   * is set the totals and balances are scoped to that account, and transfer legs
   * count toward its running balance (across all accounts they net to zero).
   */
  monthSummary(
    userId: string,
    from: Date,
    to: Date,
    openingTotal: string,
    startingOverride: string | null,
    accountId?: string,
  ): Promise<MonthSummary>;
  monthCategorySummary(
    userId: string,
    from: Date,
    to: Date,
    categoryId?: string,
    accountId?: string,
  ): Promise<MonthCategorySummary[]>;
  update(userId: string, id: string, data: UpdateTransactionData): Promise<Transaction>;
  softDelete(userId: string, id: string): Promise<number>;
}
