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
  ): Promise<DashboardOverview> {
    const transactionSum = (type: 'INCOME' | 'EXPENSE', start: Date, end: Date) =>
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          type,
          deletedAt: null,
          occurredAt: { gte: start, lt: end },
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
        where: { userId, deletedAt: null },
      }),
      prisma.account.count({
        where: { userId, deletedAt: null, isArchived: false },
      }),
      Promise.all(
        ranges.flatMap((r) => [
          transactionSum('INCOME', r.start, r.end),
          transactionSum('EXPENSE', r.start, r.end),
        ]),
      ),
      transactionSum('INCOME', yearToDate.start, yearToDate.end),
      transactionSum('EXPENSE', yearToDate.start, yearToDate.end),
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
