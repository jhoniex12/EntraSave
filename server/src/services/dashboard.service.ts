import type { AuthContext } from '@/utils/auth-context';
import { dashboardRepository } from '@/repositories/dashboard.prisma';
import type {
  DashboardRepository,
  MonthRange,
} from '@/repositories/dashboard.repository';
import type { DashboardSummaryDTO } from '@/dto/dashboard.dto';
import { transactionService } from '@/services/transaction.service';

/**
 * Dashboard — service layer (ARCHITECTURE.md §8, §10). Owns the (pure) date
 * windowing logic and assembles the summary DTO. Money math stays in the
 * adapter; this layer only arranges already-serialized strings.
 */
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getSummary(ctx: AuthContext): Promise<DashboardSummaryDTO> {
    const ranges = currentYearMonths();
    const now = new Date();
    const yearToDate = {
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
    const [overview, currentSummary] = await Promise.all([
      this.repo.overview(ctx.userId, ranges, yearToDate),
      transactionService.getMonthSummary(ctx, now.getUTCFullYear(), now.getUTCMonth()),
    ]);

    const currentKey = ranges.at(-1)?.key;
    const monthly = overview.months.map((m) =>
      m.key === currentKey
        ? {
            key: m.key,
            label: m.label,
            income: currentSummary.income,
            expense: currentSummary.expense,
            net: currentSummary.net,
          }
        : {
            key: m.key,
            label: m.label,
            income: m.income,
            expense: m.expense,
            net: m.net,
          },
    );
    const current = monthly.at(-1);

    return {
      totalBalance: currentSummary.currentBalance,
      accountCount: overview.accountCount,
      // Display in the user's chosen base currency. Per-account FX conversion is
      // a future feature (Currency/ExchangeRate models).
      currency: ctx.baseCurrency,
      incomeThisMonth: current?.income ?? '0',
      expenseThisMonth: current?.expense ?? '0',
      netThisMonth: current?.net ?? '0',
      yearToDate: overview.yearToDate,
      categoryBreakdown: overview.categoryBreakdown,
      yearToDateCategoryBreakdown: overview.yearToDateCategoryBreakdown,
      monthly,
    };
  }
}

/** Current calendar year (UTC), January → present month. */
function currentYearMonths(): MonthRange[] {
  const now = new Date();
  const ranges: MonthRange[] = [];
  for (let month = 0; month <= now.getUTCMonth(); month++) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), month, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), month + 1, 1));
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    ranges.push({ key, label, start, end });
  }
  return ranges;
}

export const dashboardService = new DashboardService(dashboardRepository);
