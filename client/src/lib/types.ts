/**
 * Client-side mirror of the API DTO contracts. These intentionally duplicate the
 * server's `*.dto.ts` shapes (the two apps are separate packages — see
 * CODING_STANDARDS.md §3). Money is always a string; dates are ISO strings.
 */

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  retryAfter?: number;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export interface SessionUser {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  baseCurrency: string;
  roles: string[];
  permissions: string[];
  hasPassword: boolean;
  googleLinked: boolean;
  facebookLinked: boolean;
}

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

export interface CategoryDTO {
  id: string;
  name: string;
  kind: string; // INCOME | EXPENSE
  color: string | null;
}

export interface BudgetDTO {
  id: string;
  categoryId: string;
  amount: string;
  period: 'MONTHLY';
}

export interface BudgetStatusDTO {
  categoryId: string;
  budgetAmount: string;
  spentAmount: string;
  usagePercent: number;
  status: 'SAFE' | 'NEAR' | 'OVER';
}

export interface UserProfileDTO {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  facebookLinked: boolean;
}

export interface TransactionDTO {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  notes: string | null;
  transferId: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MonthResponse {
  items: TransactionDTO[];
  nextCursor: string | null;
  income: string;
  expense: string;
  net: string;
  startingBalance: string;
  currentBalance: string;
  isManualStart: boolean;
  categorySummary: Array<{
    categoryId: string | null;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
  }>;
}

export interface DashboardMonthDTO {
  key: string;
  label: string;
  income: string;
  expense: string;
  net: string;
}

export interface DashboardSummaryDTO {
  totalBalance: string;
  accountCount: number;
  currency: string;
  incomeThisMonth: string;
  expenseThisMonth: string;
  netThisMonth: string;
  yearToDate: { income: string; expense: string; net: string };
  categoryBreakdown: Array<{ categoryId: string | null; type: 'INCOME' | 'EXPENSE'; amount: string }>;
  yearToDateCategoryBreakdown: Array<{ categoryId: string | null; type: 'INCOME' | 'EXPENSE'; amount: string }>;
  /** Current calendar year, January through the present month. */
  monthly: DashboardMonthDTO[];
}

export const ACCOUNT_TYPES = [
  'SAVINGS',
  'CASH',
  'OTHER',
] as const;

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
