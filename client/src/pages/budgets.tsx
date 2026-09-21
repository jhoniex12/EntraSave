import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { ApiError } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { formatMoney } from '@/lib/format';
import type { BudgetStatusDTO, CategoryDTO } from '@/lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONEY_SCALE = 10_000n;

/** Yearly budget report. Select a month to inspect its category-level results. */
export function BudgetsPage() {
  const { user } = useAuth();
  const currency = user?.baseCurrency ?? 'AUD';
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<BudgetStatusDTO[][]>([]);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCategories, statuses] = await Promise.all([
        api.categories.list(),
        api.budgets.yearStatus(year),
      ]);
      setCategories(nextCategories);
      setMonthlyBudgets(statuses.months);
      setExpandedMonth(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load budget data.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const annualBudget = useMemo(() => monthlyBudgets.flat().reduce((sum, status) => sum + moneyToScaledInteger(status.budgetAmount), 0n), [monthlyBudgets]);
  const annualSpent = useMemo(() => monthlyBudgets.flat().reduce((sum, status) => sum + moneyToScaledInteger(status.spentAmount), 0n), [monthlyBudgets]);
  const annualRemaining = annualBudget - annualSpent;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Budgets</h1>
          <p className="mt-1 text-sm text-neutral-500">Review your monthly budget performance and drill into category details.</p>
        </div>
        <Link to="/settings/budget" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Manage budgets</Link>
      </div>

      <section className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setYear((value) => value - 1)} aria-label="Previous year" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-700"><ChevronLeftIcon /></button>
          <h2 className="text-base font-semibold text-neutral-800">{year}</h2>
          {year >= currentYear
            ? <span aria-hidden="true" className="grid min-h-11 min-w-11 place-items-center text-neutral-300"><ChevronRightIcon /></span>
            : <button type="button" onClick={() => setYear((value) => value + 1)} aria-label="Next year" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-700"><ChevronRightIcon /></button>}
        </div>
        {!loading && monthlyBudgets.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-3">
            <Summary label="Annual budget" value={formatMoney(scaledIntegerToMoney(annualBudget), currency)} />
            <Summary label="Annual spent" value={formatMoney(scaledIntegerToMoney(annualSpent), currency)} tone="rose" />
            <Summary label={annualRemaining < 0n ? 'Over budget' : 'Remaining'} value={formatMoney(scaledIntegerToMoney(annualRemaining < 0n ? -annualRemaining : annualRemaining), currency)} tone={annualRemaining < 0n ? 'rose' : 'emerald'} />
          </div>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-neutral-800">Monthly budget data</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Select a month to show its category breakdown.</p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">Loading…</p>
        ) : monthlyBudgets.every((statuses) => statuses.length === 0) ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">No budgets are set. <Link to="/settings/budget" className="font-medium text-emerald-600 hover:underline">Set a monthly budget</Link> to start tracking it.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[42rem] w-full text-left text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                <tr><th className="px-4 py-3 sm:px-5">Month</th><th className="px-3 py-3 text-right">Monthly budget</th><th className="px-3 py-3 text-right">Spent</th><th className="px-4 py-3 text-right sm:px-5">Remaining</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {MONTHS.map((name, month) => <MonthlyBudgetRow key={name} name={name} month={month} year={year} statuses={monthlyBudgets[month] ?? []} categoryName={categoryName} currency={currency} expanded={expandedMonth === month} onToggle={() => setExpandedMonth((current) => current === month ? null : month)} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MonthlyBudgetRow({ name, month, year, statuses, categoryName, currency, expanded, onToggle }: { name: string; month: number; year: number; statuses: BudgetStatusDTO[]; categoryName: Map<string, string>; currency: string; expanded: boolean; onToggle: () => void }) {
  const budget = statuses.reduce((sum, status) => sum + moneyToScaledInteger(status.budgetAmount), 0n);
  const spent = statuses.reduce((sum, status) => sum + moneyToScaledInteger(status.spentAmount), 0n);
  const remaining = budget - spent;
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  return (
    <>
      <tr className="transition hover:bg-neutral-50">
        <th scope="row" className="px-4 py-3 text-left sm:px-5"><button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`budget-details-${month}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-neutral-800 hover:text-emerald-700"><ChevronDownIcon expanded={expanded} />{name}</button></th>
        <td className="px-3 py-3 text-right tabular-nums text-neutral-600">{formatMoney(scaledIntegerToMoney(budget), currency)}</td>
        <td className="px-3 py-3 text-right tabular-nums text-neutral-800">{formatMoney(scaledIntegerToMoney(spent), currency)}</td>
        <td className={`px-4 py-3 text-right font-semibold tabular-nums sm:px-5 ${remaining < 0n ? 'text-rose-600' : 'text-emerald-700'}`}>{remaining < 0n ? '-' : ''}{formatMoney(scaledIntegerToMoney(remaining < 0n ? -remaining : remaining), currency)}</td>
      </tr>
      {expanded && (
        <tr id={`budget-details-${month}`} className="bg-neutral-50/70">
          <td colSpan={4} className="p-3 sm:p-4">
            {statuses.length === 0 ? <p className="py-2 text-center text-sm text-neutral-400">No budget data for {name}.</p> : <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white"><table className="min-w-[34rem] w-full text-left text-xs"><thead className="border-b border-neutral-100 bg-neutral-50 text-[10px] font-semibold uppercase tracking-wide text-neutral-400"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Budget</th><th className="px-3 py-2 text-right">Spent</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-right">Status</th></tr></thead><tbody className="divide-y divide-neutral-100">{statuses.map((status) => <BudgetDetailRow key={status.categoryId} status={status} name={categoryName.get(status.categoryId) ?? 'Category'} currency={currency} monthKey={monthKey} />)}</tbody></table></div>}
          </td>
        </tr>
      )}
    </>
  );
}

function BudgetDetailRow({ status, name, currency, monthKey }: { status: BudgetStatusDTO; name: string; currency: string; monthKey: string }) {
  const remaining = moneyToScaledInteger(status.budgetAmount) - moneyToScaledInteger(status.spentAmount);
  const statusClass = status.status === 'OVER' ? 'bg-rose-50 text-rose-700' : status.status === 'NEAR' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  const statusLabel = status.status === 'OVER' ? 'Over' : status.status === 'NEAR' ? 'Near limit' : 'On track';
  return <tr><td className="px-3 py-2"><Link to={`/transactions?month=${monthKey}&category=${status.categoryId}`} className="font-medium text-neutral-700 hover:text-emerald-700 hover:underline">{name}</Link></td><td className="px-3 py-2 text-right tabular-nums text-neutral-500">{formatMoney(status.budgetAmount, currency)}</td><td className="px-3 py-2 text-right tabular-nums text-neutral-700">{formatMoney(status.spentAmount, currency)}</td><td className={`px-3 py-2 text-right font-semibold tabular-nums ${remaining < 0n ? 'text-rose-600' : 'text-emerald-700'}`}>{remaining < 0n ? '-' : ''}{formatMoney(scaledIntegerToMoney(remaining < 0n ? -remaining : remaining), currency)}</td><td className="px-3 py-2 text-right"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span></td></tr>;
}

function Summary({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'emerald' | 'rose' }) {
  const color = tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-600' : 'text-neutral-900';
  return <div className="rounded-2xl bg-neutral-50 px-3 py-2.5"><p className="text-xs font-medium text-neutral-500">{label}</p><p className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</p></div>;
}

function moneyToScaledInteger(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * MONEY_SCALE + BigInt(fraction.padEnd(4, '0').slice(0, 4) || '0');
}

function scaledIntegerToMoney(value: bigint): string {
  const whole = value / MONEY_SCALE;
  const fraction = (value % MONEY_SCALE).toString().padStart(4, '0');
  return `${whole.toString()}.${fraction}`;
}

function ChevronLeftIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
}

function ChevronRightIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;
}

function ChevronDownIcon({ expanded }: { expanded: boolean }) {
  return <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}
