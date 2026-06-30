import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  DashboardRepository,
  DashboardOverview,
  MonthRange,
} from '@/repositories/dashboard.repository';

/**
 * Dashboard — Prisma adapter (ARCHITECTURE.md §1, §10, §11). The ONLY place
 * Prisma is touched for dashboard reads. Uses SQL aggregates (`_sum`, `count`)
 * scoped to `userId`, and does the money math in Decimal here so the service
 * layer only ever handles serialized strings.
 */
class PrismaDashboardRepository implements DashboardRepository {
  async overview(
    userId: string,
    ranges: MonthRange[],
    yearToDate: { start: Date; end: Date },
    accountId?: string,
  ): Promise<DashboardOverview> {
    // When scoped to one account, every transaction aggregate is narrowed to it,
    // and a transfer is treated as income (received) / expense (sent) on that
    // account. The all-accounts view keeps income/expense pure: internal transfers
    // cancel out and would otherwise inflate both totals (and the trend chart).
    const accountScope = accountId ? { accountId } : {};
    const incomeTypes: Array<'INCOME' | 'TRANSFER_IN'> = accountId ? ['INCOME', 'TRANSFER_IN'] : ['INCOME'];
    const expenseTypes: Array<'EXPENSE' | 'TRANSFER_OUT'> = accountId ? ['EXPENSE', 'TRANSFER_OUT'] : ['EXPENSE'];
    const transactionSum = (types: string[], start: Date, end: Date) =>
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          type: { in: types },
          deletedAt: null,
          occurredAt: { gte: start, lt: end },
          ...accountScope,
        },
      });

    const currentMonth = ranges.at(-1);
    const categorySums = (start: Date, end: Date) =>
      prisma.transaction.groupBy({
        by: ['categoryId', 'type'],
        _sum: { amount: true },
        where: {
          userId,
          deletedAt: null,
          type: { in: ['INCOME', 'EXPENSE'] },
          occurredAt: { gte: start, lt: end },
          ...accountScope,
        },
      });

    const [
      balanceAgg,
      accountCount,
      monthAggs,
      ytdIncomeAgg,
      ytdExpenseAgg,
      categoryAggs,
      ytdCategoryAggs,
    ] = await Promise.all([
      prisma.account.aggregate({
        _sum: { balance: true },
        where: { userId, deletedAt: null, ...(accountId ? { id: accountId } : {}) },
      }),
      prisma.account.count({
        where: { userId, deletedAt: null, isArchived: false, ...(accountId ? { id: accountId } : {}) },
      }),
      Promise.all(
        ranges.flatMap((r) => [
          transactionSum(incomeTypes, r.start, r.end),
          transactionSum(expenseTypes, r.start, r.end),
        ]),
      ),
      transactionSum(incomeTypes, yearToDate.start, yearToDate.end),
      transactionSum(expenseTypes, yearToDate.start, yearToDate.end),
      currentMonth
        ? categorySums(currentMonth.start, currentMonth.end)
        : Promise.resolve([]),
      categorySums(yearToDate.start, yearToDate.end),
    ]);

    const months = ranges.map((r, i) => {
      const income = monthAggs[i * 2]?._sum.amount ?? new Prisma.Decimal(0);
      const expense = monthAggs[i * 2 + 1]?._sum.amount ?? new Prisma.Decimal(0);
      return {
        key: r.key,
        label: r.label,
        income: income.toString(),
        expense: expense.toString(),
        net: income.minus(expense).toString(),
      };
    });

    const ytdIncome = ytdIncomeAgg._sum.amount ?? new Prisma.Decimal(0);
    const ytdExpense = ytdExpenseAgg._sum.amount ?? new Prisma.Decimal(0);

    return {
      totalBalance: balanceAgg._sum.balance?.toString() ?? '0',
      accountCount,
      months,
      yearToDate: {
        income: ytdIncome.toString(),
        expense: ytdExpense.toString(),
        net: ytdIncome.minus(ytdExpense).toString(),
      },
      categoryBreakdown: categoryAggs
        .filter((row) => row.type === 'INCOME' || row.type === 'EXPENSE')
        .map((row) => ({
          categoryId: row.categoryId,
          type: row.type === 'INCOME' ? 'INCOME' as const : 'EXPENSE' as const,
          amount: row._sum.amount?.toString() ?? '0',
        })),
      yearToDateCategoryBreakdown: ytdCategoryAggs
        .filter((row) => row.type === 'INCOME' || row.type === 'EXPENSE')
        .map((row) => ({
          categoryId: row.categoryId,
          type: row.type === 'INCOME' ? 'INCOME' as const : 'EXPENSE' as const,
          amount: row._sum.amount?.toString() ?? '0',
        })),
    };
  }
}

export const dashboardRepository: DashboardRepository = new PrismaDashboardRepository();
