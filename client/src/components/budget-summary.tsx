import { Link } from 'react-router-dom';
import type { BudgetStatusDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';

export function BudgetSummary({ budgets, names, currency, selectedCategoryId = '', onSelectCategory, className = '' }: {
  budgets: BudgetStatusDTO[];
  names: Map<string, string>;
  currency: string;
  /** Highlighted row when the parent filters by a category. */
  selectedCategoryId?: string;
  /** When provided, a row sets this category filter in place instead of navigating. */
  onSelectCategory?: (categoryId: string) => void;
  className?: string;
}) {
  // Most at-risk first so the rows that need attention sit at the top.
  const sorted = [...budgets].sort((a, b) => b.usagePercent - a.usagePercent);
  // Totals across every budget, summed in integer cents to avoid float drift.
  const totalBudget = sumCents(budgets.map((b) => b.budgetAmount));
  const totalSpent = sumCents(budgets.map((b) => b.spentAmount));
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const totalBar = totalPct >= 100 ? 'bg-rose-500' : totalPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <section className={`overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
      <div className="flex items-end justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-emerald-50/40 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-neutral-800">Budget overview</h3><p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:text-xs">This month's spending against your limits.</p></div>
        <Link to="/settings" className="shrink-0 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline sm:text-xs">View all budgets →</Link>
      </div>
      {sorted.length > 0 && (
        <div className="border-b border-neutral-100 bg-neutral-50/60 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">Total spending</span>
            <div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-200 sm:block sm:w-24">
              <div className={`h-full rounded-full ${totalBar}`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
            </div>
            <span className="shrink-0 text-right text-[11px] font-medium tabular-nums text-neutral-500 sm:w-44 sm:text-xs">{formatMoney(centsToString(totalSpent), currency)} / {formatMoney(centsToString(totalBudget), currency)}</span>
            <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700 sm:text-sm">{totalPct.toFixed(0)}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200 sm:hidden">
            <div className={`h-full rounded-full ${totalBar}`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
          </div>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-neutral-400">No budgets yet. <Link to="/settings" className="font-medium text-emerald-600 hover:underline">Set one in Settings</Link>.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {sorted.map((budget) => {
            const bar = budget.status === 'OVER' ? 'bg-rose-500' : budget.status === 'NEAR' ? 'bg-amber-500' : 'bg-emerald-500';
            const pctColor = budget.status === 'OVER' ? 'text-rose-600' : budget.status === 'NEAR' ? 'text-amber-600' : 'text-neutral-500';
            const name = names.get(budget.categoryId) ?? 'Category';
            const rowClass = `block w-full px-3 py-2 text-left transition sm:px-4 sm:py-2.5 ${selectedCategoryId === budget.categoryId ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`;
            const rowContent = (
              <>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-700">{name}</span>
                  <div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100 sm:block sm:w-24">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(budget.usagePercent, 100)}%` }} />
                  </div>
                  <span className="shrink-0 text-right text-[11px] tabular-nums text-neutral-400 sm:w-44 sm:text-xs">{formatMoney(budget.spentAmount, currency)} / {formatMoney(budget.budgetAmount, currency)}</span>
                  <span className={`w-9 shrink-0 text-right text-xs font-semibold tabular-nums sm:text-sm ${pctColor}`}>{budget.usagePercent.toFixed(0)}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100 sm:hidden">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(budget.usagePercent, 100)}%` }} />
                </div>
              </>
            );
            return (
              <li key={budget.categoryId}>
                {onSelectCategory
                  ? <button type="button" onClick={() => onSelectCategory(budget.categoryId)} className={rowClass} aria-label={`Filter transactions by ${name}`} aria-pressed={selectedCategoryId === budget.categoryId}>{rowContent}</button>
                  : <Link to={`/transactions?category=${budget.categoryId}`} className={rowClass} aria-label={`View ${name} transactions`}>{rowContent}</Link>}
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
