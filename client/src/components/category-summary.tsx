import { Link } from 'react-router-dom';
import type { BudgetStatusDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';

type CategoryItem = { categoryId: string | null; type: 'INCOME' | 'EXPENSE'; amount: string };

export function CategorySummary({ items, names, budgets, currency, periodLabel = 'month', showBudget = true, selectedCategoryId = '', onSelect, className = '' }: {
  items: CategoryItem[];
  names: Map<string, string>;
  budgets: BudgetStatusDTO[];
  currency: string;
  periodLabel?: 'month' | 'year';
  showBudget?: boolean;
  selectedCategoryId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const relevantBudgets = !showBudget ? [] : selectedCategoryId ? budgets.filter((budget) => budget.categoryId === selectedCategoryId) : budgets;
  const budgetMap = new Map(relevantBudgets.map((budget) => [budget.categoryId, budget]));
  const alerts = relevantBudgets.filter((budget) => budget.status !== 'SAFE');
  const rows = new Map<string, { categoryId: string | null; debit?: string; credit?: string }>();
  for (const item of items) {
    const key = item.categoryId ?? 'none';
    const row = rows.get(key) ?? { categoryId: item.categoryId };
    if (item.type === 'INCOME') row.debit = item.amount;
    else row.credit = item.amount;
    rows.set(key, row);
  }
  for (const budget of relevantBudgets) {
    if (!rows.has(budget.categoryId)) rows.set(budget.categoryId, { categoryId: budget.categoryId, credit: budget.spentAmount });
  }
  const sorted = [...rows.values()].sort((a, b) => Math.max(Number(b.debit ?? 0), Number(b.credit ?? 0)) - Math.max(Number(a.debit ?? 0), Number(a.credit ?? 0)));
  const gridCols = showBudget
    ? 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] sm:grid-cols-[1.6fr_1fr_1fr_1.4fr]'
    : 'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[2fr_1fr_1fr]';

  return (
    <section className={`overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
      <div className="flex items-end justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-emerald-50/40 px-3 py-3 sm:px-4 sm:py-4">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-neutral-800">Category summary</h3><p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:mt-1 sm:text-xs">Debit is money in; credit is money out.</p></div>
        <Link to="/settings" className="shrink-0 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline sm:text-xs"><span className="sm:hidden">Manage →</span><span className="hidden sm:inline">Add or edit categories in Settings →</span></Link>
      </div>
      {alerts.length > 0 && <div className="space-y-2 border-b border-neutral-100 p-2.5 sm:p-3">{alerts.map((budget) => <div key={budget.categoryId} role="status" className={`rounded-xl border px-2.5 py-2 text-[11px] leading-4 sm:px-3 sm:text-xs ${budget.status === 'OVER' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><strong>{names.get(budget.categoryId) ?? 'Category'} is {budget.status === 'OVER' ? 'over budget' : 'almost at budget'}.</strong> {formatMoney(budget.spentAmount, currency)} of {formatMoney(budget.budgetAmount, currency)} used ({budget.usagePercent.toFixed(0)}%).</div>)}</div>}
      {sorted.length === 0 ? <p className="px-4 py-5 text-center text-sm text-neutral-400">No category activity this {periodLabel}.</p> : <div>
        <div className={`grid ${gridCols} gap-2 bg-neutral-50/70 px-3 py-2 text-[9px] font-medium uppercase tracking-wide text-neutral-400 sm:px-4 sm:py-2.5 sm:text-xs`}><span>Category</span><span className="text-right"><span className="sm:hidden">In</span><span className="hidden sm:inline">Debit</span></span><span className="text-right"><span className="sm:hidden">Out</span><span className="hidden sm:inline">Credit</span></span>{showBudget && <span className="text-right">Budget</span>}</div>
        <div className="divide-y divide-neutral-100">{sorted.map((row) => {
          const budget = row.categoryId ? budgetMap.get(row.categoryId) : undefined;
          const name = row.categoryId ? names.get(row.categoryId) ?? 'Deleted category' : 'No category';
          const rowClass = `grid w-full ${gridCols} items-center gap-2 px-3 py-2.5 text-left text-xs transition sm:px-4 sm:py-3 sm:text-sm ${selectedCategoryId === row.categoryId ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`;
          const cells = <><span className="min-w-0 truncate font-medium text-neutral-700">{name}</span><span className="min-w-0 truncate text-right text-[10px] font-semibold tabular-nums text-emerald-600 sm:text-sm">{row.debit ? formatMoney(row.debit, currency) : '—'}</span><span className="min-w-0 truncate text-right text-[10px] font-semibold tabular-nums text-rose-500 sm:text-sm">{row.credit ? formatMoney(row.credit, currency) : '—'}</span>{showBudget && <span className="min-w-0 text-right">{budget ? <span className="inline-flex max-w-full items-center justify-end gap-1 tabular-nums sm:gap-2"><span className="min-w-0 truncate text-[10px] font-semibold text-neutral-700 sm:text-sm">{formatMoney(budget.budgetAmount, currency)}</span><span className={`shrink-0 rounded-full px-1 py-0.5 text-[8px] font-semibold sm:px-2 sm:text-[10px] ${budget.status === 'OVER' ? 'bg-rose-100 text-rose-700' : budget.status === 'NEAR' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{budget.usagePercent.toFixed(0)}%</span></span> : <span className="text-[10px] font-medium text-neutral-400 sm:text-sm">—</span>}</span>}</>;
          if (!row.categoryId) return <div key="none" className={rowClass}>{cells}</div>;
          if (onSelect) return <button key={row.categoryId} type="button" onClick={() => onSelect(row.categoryId as string)} className={rowClass} aria-label={`Filter transactions by ${name}`}>{cells}</button>;
          return <Link key={row.categoryId} to={`/transactions?category=${row.categoryId}${periodLabel === 'year' ? '&period=year' : ''}`} className={rowClass}>{cells}</Link>;
        })}</div>
      </div>}
    </section>
  );
}
