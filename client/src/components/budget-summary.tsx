import { Link } from 'react-router-dom';
import type { BudgetStatusDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';

export function BudgetSummary({ budgets, names, currency, className = '' }: {
  budgets: BudgetStatusDTO[];
  names: Map<string, string>;
  currency: string;
  className?: string;
}) {
  // Most at-risk first so the rows that need attention sit at the top.
  const sorted = [...budgets].sort((a, b) => b.usagePercent - a.usagePercent);
  // Totals across every budget. Sum in integer cents so the displayed total
  // can't accumulate floating-point drift.
  const totalBudget = sumCents(budgets.map((b) => b.budgetAmount));
  const totalSpent = sumCents(budgets.map((b) => b.spentAmount));
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const totalBar = totalPct >= 100 ? 'bg-rose-500' : totalPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <section className={`overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
      <div className="flex items-end justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-emerald-50/40 px-3 py-3 sm:px-4 sm:py-4">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-neutral-800">Budget</h3><p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:mt-1 sm:text-xs">This month's spending against your limits.</p></div>
        <Link to="/settings" className="shrink-0 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline sm:text-xs"><span className="sm:hidden">Manage →</span><span className="hidden sm:inline">Set budgets in Settings →</span></Link>
      </div>
      {sorted.length > 0 && (
        <div className="border-b border-neutral-100 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-neutral-800">Total spending</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">{formatMoney(centsToString(totalSpent), currency)} <span className="font-medium text-neutral-400">/ {formatMoney(centsToString(totalBudget), currency)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className={`h-full rounded-full ${totalBar}`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-neutral-500">{totalPct.toFixed(0)}%</span>
          </div>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-neutral-400">No budgets yet. <Link to="/settings" className="font-medium text-emerald-600 hover:underline">Set one in Settings</Link>.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {sorted.map((budget) => {
            const bar = budget.status === 'OVER' ? 'bg-rose-500' : budget.status === 'NEAR' ? 'bg-amber-500' : 'bg-emerald-500';
            const badge = budget.status === 'OVER' ? 'bg-rose-100 text-rose-700' : budget.status === 'NEAR' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700';
            return (
              <li key={budget.categoryId}>
                <Link to={`/transactions?category=${budget.categoryId}`} className="block px-3 py-3 transition hover:bg-neutral-50 sm:px-4 sm:py-3.5" aria-label={`View ${names.get(budget.categoryId) ?? 'category'} transactions`}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-medium text-neutral-700">{names.get(budget.categoryId) ?? 'Category'}</span>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-neutral-300" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-neutral-500 sm:text-xs">{formatMoney(budget.spentAmount, currency)} / {formatMoney(budget.budgetAmount, currency)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(budget.usagePercent, 100)}%` }} />
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badge}`}>{budget.usagePercent.toFixed(0)}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Display-only money math: sum a list of money strings as integer cents to avoid
// floating-point drift, then format back to a string for formatMoney.
function sumCents(values: string[]): number {
  return values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
}
function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}
