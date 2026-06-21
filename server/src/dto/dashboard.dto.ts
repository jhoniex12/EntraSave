/**
 * Dashboard — DTO layer (ARCHITECTURE.md §8). All money is serialized as a
 * string (Decimal precision preserved). No internal fields cross this boundary.
 */
export interface DashboardMonthDTO {
  /** "YYYY-MM" */
  key: string;
  /** Short month label, e.g. "Jun". */
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
  yearToDate: {
    income: string;
    expense: string;
    net: string;
  };
  categoryBreakdown: Array<{
    categoryId: string | null;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
  }>;
  yearToDateCategoryBreakdown: Array<{
    categoryId: string | null;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
  }>;
  /** Current calendar year, January → present month. */
  monthly: DashboardMonthDTO[];
}
