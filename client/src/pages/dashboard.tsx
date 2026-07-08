import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { AccountDTO, BudgetStatusDTO, CategoryDTO, DashboardSummaryDTO, TransactionDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { CategorySummary } from '@/components/category-summary';
import { BudgetSummary } from '@/components/budget-summary';
import { SpendingOverview } from '@/components/spending-overview';
import { IncomeExpenseChart } from '@/components/income-expense-chart';
import { useAuth } from '@/auth/auth-context';

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [recent, setRecent] = useState<TransactionDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatusDTO[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Accounts, categories and budgets don't depend on the account filter, so they
  // load once on mount.
  useEffect(() => {
    const now = new Date();
    Promise.all([
      api.accounts.list(false),
      api.categories.list(),
      api.budgets.status({ year: now.getUTCFullYear(), month: now.getUTCMonth() }),
    ])
      .then(([nextAccounts, nextCategories, nextBudgets]) => {
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setBudgets(nextBudgets);
      })
      .catch(() => undefined);
  }, []);

  // Summary + recent activity are scoped to the selected account, so they reload
  // whenever the filter changes.
  useEffect(() => {
    setError(null);
    Promise.all([
      api.dashboard.summary(accountId ? { accountId } : {}),
      api.transactions.list({ pageSize: 6, accountId: accountId || undefined }),
    ])
      .then(([nextSummary, nextRecent]) => {
        setSummary(nextSummary);
        setRecent(nextRecent.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, [accountId]);

  const accountName = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there';

  if (loading && !summary) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error && !summary) return <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!summary) return null;

  const currency = summary.currency;
  const currentYear = new Date().getUTCFullYear();
  const overviewLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const net = period === 'month' ? summary.netThisMonth : summary.yearToDate.net;

  // Month-over-month deltas for the stat cards. `monthly` runs Jan→present, so the
  // last two entries are this month and last month; there is no delta in January.
  const curMonth = summary.monthly[summary.monthly.length - 1];
  const prevMonth = summary.monthly.length > 1 ? summary.monthly[summary.monthly.length - 2] : undefined;
  const pctChange = (current?: string, previous?: string): number | null => {
    if (current === undefined || previous === undefined) return null;
    const prev = Number(previous);
    if (prev === 0) return null;
    return ((Number(current) - prev) / Math.abs(prev)) * 100;
  };
  // Net kept as a share of income; negative (spent more than earned) shows as 0%.
  const savingsRateOf = (income: string, netAmount: string): number => {
    const inc = Number(income);
    return inc > 0 ? Math.max(0, Math.round((Number(netAmount) / inc) * 100)) : 0;
  };
  const savingsRate = period === 'month'
    ? savingsRateOf(summary.incomeThisMonth, summary.netThisMonth)
    : savingsRateOf(summary.yearToDate.income, summary.yearToDate.net);

  return (
    <div className="min-w-0 space-y-6 pb-10 sm:space-y-10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Hi {firstName}! <span aria-hidden="true">👋</span></h1>
          <p className="mt-1 text-sm text-neutral-500">Here's your financial overview for {overviewLabel}.</p>
        </div>
        <Link to="/transactions?add=1" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md sm:px-5 sm:py-3"><span className="text-lg leading-none">+</span>Add transaction</Link>
      </div>

      <section className="rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          {accounts.length > 0 && (
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-neutral-500">Account</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 sm:w-56"><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
            </label>
          )}
          <div className="grid w-full grid-cols-2 rounded-xl bg-neutral-100 p-1 sm:ml-auto sm:flex sm:w-auto" role="group" aria-label="Dashboard summary period">
            <button type="button" onClick={() => setPeriod('month')} aria-pressed={period === 'month'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Month</button>
            <button type="button" onClick={() => setPeriod('year')} aria-pressed={period === 'year'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'year' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Year</button>
          </div>
        </div>
        {accountId && <p className="mt-2 px-0.5 text-xs text-neutral-500">Showing balances and totals for {accountName.get(accountId) ?? 'this account'} only.</p>}
      </section>

      <section className="rounded-3xl border border-neutral-200/80 bg-white p-2 shadow-sm sm:p-3">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Total balance" value={formatMoney(summary.totalBalance, currency)} icon={<WalletIcon />}
            footer={<span className="text-neutral-400">{accountId ? accountName.get(accountId) ?? 'This account' : 'All accounts'}</span>} />
          <StatTile label={period === 'month' ? 'Income this month' : `Income in ${currentYear}`} value={formatMoney(period === 'month' ? summary.incomeThisMonth : summary.yearToDate.income, currency)} tone="emerald" icon={<TrendUpIcon />}
            footer={period === 'month' ? <Delta changePct={pctChange(curMonth?.income, prevMonth?.income)} goodWhenUp sinceLabel={prevMonth?.label} /> : <span className="text-neutral-400">This year</span>} />
          <StatTile label={period === 'month' ? 'Expenses this month' : `Expenses in ${currentYear}`} value={`-${formatMoney(period === 'month' ? summary.expenseThisMonth : summary.yearToDate.expense, currency)}`} tone="rose" icon={<TrendDownIcon />}
            footer={period === 'month' ? <Delta changePct={pctChange(curMonth?.expense, prevMonth?.expense)} goodWhenUp={false} sinceLabel={prevMonth?.label} /> : <span className="text-neutral-400">This year</span>} />
          <StatTile label={period === 'month' ? 'Net this month' : `Net in ${currentYear}`} value={`${Number(net) >= 0 ? '+' : ''}${formatMoney(net, currency)}`} tone={Number(net) >= 0 ? 'emerald' : 'rose'} icon={<ActivityIcon />}
            footer={period === 'month' ? <Delta changePct={pctChange(curMonth?.net, prevMonth?.net)} goodWhenUp sinceLabel={prevMonth?.label} /> : <span className="text-neutral-400">This year</span>} />
          <StatTile label="Savings rate" value={`${savingsRate}%`} icon={<PercentIcon />}
            footer={period === 'month' && prevMonth ? <span className="text-neutral-400">vs {prevMonth.label}: {savingsRateOf(prevMonth.income, prevMonth.net)}%</span> : <span className="text-neutral-400">{period === 'month' ? 'This month' : 'This year'}</span>} />
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <SpendingOverview items={period === 'month' ? summary.categoryBreakdown : summary.yearToDateCategoryBreakdown} names={categoryName} currency={currency} periodLabel={period} />
        <IncomeExpenseChart months={summary.monthly} currency={currency} accountId={accountId} yearLabel={currentYear} />
      </div>

      {period === 'month' ? (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
          <CategorySummary items={summary.categoryBreakdown} names={categoryName} budgets={budgets} currency={currency} periodLabel={period} showBudget={false} />
          <BudgetSummary budgets={budgets} names={categoryName} currency={currency} />
        </div>
      ) : (
        <CategorySummary items={summary.yearToDateCategoryBreakdown} names={categoryName} budgets={budgets} currency={currency} periodLabel={period} showBudget={false} />
      )}

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

function EmptyState({ title, to, label }: { title: string; to: string; label: string }) { return <div className="py-8 text-center"><p className="text-sm text-neutral-500">{title}</p><Link to={to} className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline">{label}</Link></div>; }

/** A tile within the single balance card, matching the transactions page: a round
 *  icon chip beside a stacked label, value, and a small footer/delta line. */
function StatTile({ label, value, tone = 'neutral', icon, footer }: { label: string; value: string; tone?: 'neutral' | 'emerald' | 'rose'; icon: ReactNode; footer: ReactNode }) {
  const chip = tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : tone === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600';
  const valueColor = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-500' : 'text-neutral-900';
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${chip}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-neutral-500">{label}</p>
        <p className={`truncate text-base font-semibold tabular-nums ${valueColor}`} title={value}>{value}</p>
        <p className="truncate text-[11px]">{footer}</p>
      </div>
    </div>
  );
}

/** A month-over-month change chip. Color follows whether the movement is good for
 *  the metric (income up = good; expense up = bad), not the direction alone. */
function Delta({ changePct, goodWhenUp, sinceLabel }: { changePct: number | null; goodWhenUp: boolean; sinceLabel?: string }) {
  if (changePct === null || sinceLabel === undefined) return <span className="text-neutral-400">This month</span>;
  const up = changePct >= 0;
  const flat = Math.abs(changePct) < 0.05;
  const cls = flat ? 'text-neutral-400' : up === goodWhenUp ? 'text-emerald-600' : 'text-rose-500';
  return <span><span className={`font-semibold ${cls}`}>{up ? '↑' : '↓'}{Math.abs(changePct).toFixed(1)}%</span> <span className="text-neutral-400">vs {sinceLabel}</span></span>;
}

const ICON_PROPS = { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
function WalletIcon() { return <svg {...ICON_PROPS}><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H16" /><path d="M4 7.5V16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H6.2A2.2 2.2 0 0 1 4 7.8" /><circle cx="16.5" cy="13" r="1.1" fill="currentColor" stroke="none" /></svg>; }
function TrendUpIcon() { return <svg {...ICON_PROPS}><path d="M4 15l5-5 3 3 5-6" /><path d="M14 7h4v4" /></svg>; }
function TrendDownIcon() { return <svg {...ICON_PROPS}><path d="M4 9l5 5 3-3 5 6" /><path d="M14 17h4v-4" /></svg>; }
function ActivityIcon() { return <svg {...ICON_PROPS}><path d="M3 12h4l2.5-7 4 14 2.5-7H21" /></svg>; }
function PercentIcon() { return <svg {...ICON_PROPS}><path d="M18 6 6 18" /><circle cx="7.5" cy="7.5" r="2.2" /><circle cx="16.5" cy="16.5" r="2.2" /></svg>; }
