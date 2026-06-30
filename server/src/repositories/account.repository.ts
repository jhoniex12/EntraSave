import type { Account } from '@prisma/client';

/**
 * Accounts — repository INTERFACE (ARCHITECTURE.md §1 seam). The service depends
 * on this, not on Prisma. Today it is implemented by a Prisma adapter; tomorrow
 * it could be an HTTP client to an extracted service — callers don't change.
 *
 * CRITICAL: every method is scoped by `userId`. Ownership isolation is enforced
 * in the query `where`, not after fetch (kills IDOR — ARCHITECTURE.md §11/A01).
 */
export interface CreateAccountData {
  userId: string;
  name: string;
  type: Account['type'];
  currency: string;
  openingBalance: string;
  /** Display order; new accounts append to the end so the newest sits at the bottom. */
  position: number;
  /** When set, a repeat create with the same (userId, key) returns the original row. */
  idempotencyKey?: string;
}

export interface UpdateAccountData {
  name?: string;
  type?: Account['type'];
  balance?: string;
  isArchived?: boolean;
}

export interface AccountFinancialSummaryRecord {
  account: Account;
  currentBalance: string;
  /** Income this month, including transfers received into the account. */
  incomeThisMonth: string;
  /** Expense this month, including transfers sent out of the account. */
  expenseThisMonth: string;
  netThisMonth: string;
}

export interface AccountRepository {
  create(data: CreateAccountData): Promise<Account>;
  /** True when the user already has at least one (non-deleted) account. */
  hasAccounts(userId: string): Promise<boolean>;
  /** Count of the user's (non-deleted) accounts — used to append new ones to the end. */
  countForUser(userId: string): Promise<number>;
  findByIdForUser(userId: string, id: string): Promise<Account | null>;
  listForUser(userId: string, includeArchived: boolean): Promise<Account[]>;
  listSummariesForUser(
    userId: string,
    includeArchived: boolean,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<AccountFinancialSummaryRecord[]>;
  update(userId: string, id: string, data: UpdateAccountData): Promise<Account>;
  /** Persist a new display order. Position = index in `orderedIds`. */
  setPositions(userId: string, orderedIds: string[]): Promise<void>;
  softDeleteWithTransactions(
    userId: string,
    id: string,
  ): Promise<{ accountCount: number; transactionCount: number }>;
  /** Sum of all (non-deleted) account opening balances, as a Decimal string. */
  totalBalance(userId: string): Promise<string>;
}
