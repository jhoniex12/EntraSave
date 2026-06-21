/**
 * Dashboard — repository INTERFACE (ARCHITECTURE.md §1 seam, §10). Aggregation
 * is pushed into the persistence layer (SQL `SUM`/`COUNT`), not done by loading
 * rows into JS — avoids N+1 and keeps money math in Decimal.
 *
 * NOTE: this is a read-heavy summary; ARCHITECTURE.md §18 marks dashboard
 * summary caching (Redis) as a future optimization behind this same interface.
 */
export interface MonthRange {
  key: string;
  label: string;
  /** UTC, inclusive. */
  start: Date;
  /** UTC, exclusive. */
  end: Date;
}

export interface DashboardMonthAggregate {
  key: string;
  label: string;
  income: string;
  expense: string;
  net: string;
}

export interface DashboardOverview {
  totalBalance: string;
  accountCount: number;
  months: DashboardMonthAggregate[];
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
}

export interface DashboardRepository {
  overview(
    userId: string,
    ranges: MonthRange[],
    yearToDate: { start: Date; end: Date },
  ): Promise<DashboardOverview>;
}
