import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { AccountDTO, BudgetStatusDTO, CategoryDTO, DashboardSummaryDTO, TransactionDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { CategorySummary } from '@/components/category-summary';

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [recent, setRecent] = useState<TransactionDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatusDTO[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      api.dashboard.summary(),
      api.accounts.list(false),
      api.categories.list(),
      api.transactions.list({ pageSize: 6 }),
      api.budgets.status({ year: now.getUTCFullYear(), month: now.getUTCMonth() }),
    ])
      .then(([nextSummary, nextAccounts, nextCategories, nextRecent, nextBudgets]) => {
        setSummary(nextSummary);
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setRecent(nextRecent.items);
        setBudgets(nextBudgets);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const accountName = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error) return <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!summary) return null;

  const currency = summary.currency;
  const currentYear = new Date().getUTCFullYear();
  const chartMax = Math.max(1, ...summary.monthly.flatMap((item) => [Number(item.income), Number(item.expense)]));

  return (
    <div className="min-w-0 space-y-6 pb-10 sm:space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-neutral-950 px-5 py-6 text-white shadow-xl shadow-neutral-200/70 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Financial overview</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your money, clearly.</h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-400 sm:text-base">See what came in, what went out, and where your balance stands today.</p>
          </div>
          <Link to="/transactions?add=1" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-xl sm:w-auto"><span className="text-lg leading-none">+</span>Add transaction</Link>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-sm sm:flex sm:items-center sm:justify-between sm:p-3">
        <div className="hidden px-2 sm:block"><p className="text-sm font-semibold text-neutral-800">Summary period</p><p className="mt-0.5 text-xs text-neutral-400">View this month or the current year.</p></div>
        <div className="grid w-full grid-cols-2 rounded-xl bg-neutral-100 p-1 sm:w-auto" role="group" aria-label="Dashboard summary period">
          <button type="button" onClick={() => setPeriod('month')} aria-pressed={period === 'month'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Month</button>
          <button type="button" onClick={() => setPeriod('year')} aria-pressed={period === 'year'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'year' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Year</button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total balance" value={formatMoney(summary.totalBalance, currency)} sub={`${summary.accountCount} active ${summary.accountCount === 1 ? 'account' : 'accounts'}`} />
        <StatCard label={period === 'month' ? 'Income this month' : `Income in ${currentYear}`} value={formatMoney(period === 'month' ? summary.incomeThisMonth : summary.yearToDate.income, currency)} tone="positive" />
        <StatCard label={period === 'month' ? 'Expenses this month' : `Expenses in ${currentYear}`} value={formatMoney(period === 'month' ? summary.expenseThisMonth : summary.yearToDate.expense, currency)} tone="negative" />
        <StatCard label={period === 'month' ? 'Net this month' : `Net in ${currentYear}`} value={formatMoney(period === 'month' ? summary.netThisMonth : summary.yearToDate.net, currency)} tone={Number(period === 'month' ? summary.netThisMonth : summary.yearToDate.net) >= 0 ? 'positive' : 'negative'} />
      </div>

      <CategorySummary items={period === 'month' ? summary.categoryBreakdown : summary.yearToDateCategoryBreakdown} names={categoryName} budgets={period === 'month' ? budgets : []} currency={currency} periodLabel={period} />

      {period === 'year' && <section className="rounded-3xl border border-neutral-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-5 shadow-lg shadow-neutral-200/40 sm:p-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">{currentYear} trend</p><h2 className="text-xl font-semibold tracking-tight">Income vs expenses</h2><p className="mt-1 text-sm text-neutral-500">January through the present month. Select any month to review its transactions.</p></div>
          <div className="flex items-center gap-4 self-start rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm"><Legend className="bg-emerald-500" label="Income" /><Legend className="bg-rose-400" label="Expenses" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {summary.monthly.map((item) => (
            <Link key={item.key} to={`/transactions?month=${item.key}`} className="group relative min-w-0 rounded-2xl border border-neutral-200/80 bg-white/90 p-3 shadow-sm outline-none transition duration-200 hover:-translate-y-1.5 hover:border-emerald-300 hover:shadow-xl">
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-48 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl bg-neutral-900 p-3 text-xs text-white shadow-xl sm:group-hover:block"><p className="mb-2 font-semibold">{item.label} summary</p><p className="flex justify-between"><span className="text-neutral-400">Debit</span><span className="text-emerald-300">{formatMoney(item.income, currency)}</span></p><p className="flex justify-between"><span className="text-neutral-400">Credit</span><span className="text-rose-300">{formatMoney(item.expense, currency)}</span></p><p className="mt-1 flex justify-between border-t border-neutral-700 pt-1"><span>Net income</span><span>{Number(item.net) >= 0 ? '+' : ''}{formatMoney(item.net, currency)}</span></p></div>
              <div className="mb-3 space-y-1 text-center text-[11px] tabular-nums"><p className="truncate font-medium text-emerald-600">+{formatMoney(item.income, currency)}</p><p className="truncate font-medium text-rose-500">-{formatMoney(item.expense, currency)}</p></div>
              <div className="flex h-28 w-full items-end justify-center gap-2 sm:h-32"><Bar heightPct={(Number(item.income) / chartMax) * 100} className="bg-emerald-500" /><Bar heightPct={(Number(item.expense) / chartMax) * 100} className="bg-rose-400" /></div>
              <p className="mt-2 text-center text-xs font-medium text-neutral-600">{item.label}</p><p className={`mt-1 text-center text-xs font-semibold ${Number(item.net) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Net {Number(item.net) >= 0 ? '+' : ''}{formatMoney(item.net, currency)}</p>
            </Link>
          ))}
        </div>
      </section>}

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Recent activity</h2><p className="mt-1 text-xs text-neutral-400">Your latest money movements</p></div><Link to="/transactions" className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50">View all →</Link></div>
          {recent.length === 0 ? <EmptyState title="No transactions yet" to="/transactions" label="Add your first transaction" /> : <ul className="divide-y divide-neutral-100">{recent.map((transaction) => {
            const isExpense = transaction.type === 'EXPENSE';
            return <li key={transaction.id} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-neutral-50"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isExpense ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{isExpense ? '↑' : '↓'}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-800">{transaction.description ?? transaction.type}</p><p className="truncate text-xs text-neutral-400">{transaction.categoryId && categoryName.get(transaction.categoryId) ? `${categoryName.get(transaction.categoryId)} · ` : ''}{accountName.get(transaction.accountId) ?? 'Account'} · {new Date(transaction.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p></div></div><span className={`shrink-0 text-sm font-semibold tabular-nums ${isExpense ? 'text-rose-500' : 'text-emerald-600'}`}>{isExpense ? '-' : '+'}{formatMoney(transaction.amount, transaction.currency)}</span></li>;
          })}</ul>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Accounts</h2><p className="mt-1 text-xs text-neutral-400">Starting balances</p></div><Link to="/accounts" className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50">Manage →</Link></div>
          {accounts.length === 0 ? <EmptyState title="No accounts yet" to="/accounts" label="Create an account" /> : <ul className="space-y-3">{accounts.slice(0, 5).map((account) => <li key={account.id} className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-neutral-50"><div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-800">{account.name}</p><p className="text-xs text-neutral-400">{account.type}</p></div><span className="text-sm font-semibold tabular-nums">{formatMoney(account.balance, account.currency)}</span></li>)}</ul>}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const valueColor = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-500' : 'text-neutral-900';
  const accent = tone === 'positive' ? 'from-emerald-400 to-teal-500' : tone === 'negative' ? 'from-rose-400 to-orange-400' : 'from-neutral-700 to-neutral-950';
  return <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-5"><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} /><div className="flex min-w-0 items-start justify-between gap-2"><p className="min-w-0 text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-neutral-400 sm:text-xs sm:tracking-[0.1em]">{label}</p><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs sm:h-8 sm:w-8 sm:rounded-xl sm:text-sm ${valueColor}`}>{tone === 'positive' ? '↘' : tone === 'negative' ? '↗' : '●'}</span></div><p className={`mt-2 truncate text-lg font-semibold tracking-tight tabular-nums sm:mt-3 sm:text-2xl ${valueColor}`} title={value}>{value}</p><p className="mt-1 truncate text-[10px] text-neutral-400 sm:mt-1.5 sm:text-xs" title={sub ?? 'Updated from your transactions'}>{sub ?? 'Updated from your transactions'}</p></div>;
}

function Bar({ heightPct, className }: { heightPct: number; className: string }) { return <div className={`w-5 max-w-[38%] rounded-t-md shadow-sm transition-all group-hover:brightness-105 sm:w-7 ${className}`} style={{ height: `${Math.max(2, heightPct)}%` }} />; }
function Legend({ className, label }: { className: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${className}`} />{label}</span>; }
function EmptyState({ title, to, label }: { title: string; to: string; label: string }) { return <div className="py-8 text-center"><p className="text-sm text-neutral-500">{title}</p><Link to={to} className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline">{label}</Link></div>; }
