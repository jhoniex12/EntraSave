import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { AccountDTO, BudgetStatusDTO, CategoryDTO, MonthResponse, TransactionDTO } from '@/lib/types';
import { formatMoney, toDateTimeLocalValue, dateTimeLocalToISO } from '@/lib/format';
import { useAuth } from '@/auth/auth-context';
import { Modal } from '@/components/modal';
import { BudgetSummary } from '@/components/budget-summary';
import { Link, useSearchParams } from 'react-router-dom';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function TransactionsPage() {
  const { user } = useAuth();
  const currency = user?.baseCurrency ?? 'AUD';
  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const initialMonth = parseMonth(searchParams.get('month'), now);
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [data, setData] = useState<MonthResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatusDTO[]>([]);
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');
  const [accountId, setAccountId] = useState(searchParams.get('account') ?? '');
  const [period, setPeriod] = useState<'month' | 'year'>(searchParams.get('period') === 'year' ? 'year' : 'month');
  const [showBudgets, setShowBudgets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const [editingDelete, setEditingDelete] = useState(false);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  function openEditor(transaction: TransactionDTO, startDeleting = false) {
    setEditingDelete(startDeleting);
    setEditing(transaction);
  }
  function closeEditor() {
    setEditing(null);
    setEditingDelete(false);
  }
  const hasFilters = Boolean(accountId || categoryId);
  // For each transfer leg, the name of the account on the other side, so the
  // list can read "Transfer to/from <account>".
  const transferCounterName = useMemo(() => {
    const byTransfer = new Map<string, TransactionDTO[]>();
    for (const t of data?.items ?? []) {
      if (!t.transferId) continue;
      const legs = byTransfer.get(t.transferId) ?? [];
      legs.push(t);
      byTransfer.set(t.transferId, legs);
    }
    const counter = new Map<string, string>();
    for (const legs of byTransfer.values()) {
      for (const leg of legs) {
        const other = legs.find((l) => l.id !== leg.id);
        if (other) counter.set(leg.id, accountName.get(other.accountId) ?? 'another account');
      }
    }
    return counter;
  }, [data, accountName]);

  const loadMonth = useCallback(async () => {
    setError(null);
    try {
      const [monthData, budgetData] = await Promise.all([
        api.transactions.month({ year, month, categoryId: categoryId || undefined, accountId: accountId || undefined, period }),
        api.budgets.status({ year, month }),
      ]);
      setData(monthData);
      setBudgets(budgetData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [year, month, categoryId, accountId, period]);

  async function loadMore() {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await api.transactions.month({ year, month, categoryId: categoryId || undefined, accountId: accountId || undefined, period, cursor: data.nextCursor });
      setData((prev) => (prev ? { ...next, items: [...prev.items, ...next.items] } : next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more transactions.');
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    Promise.all([api.accounts.list(false), api.categories.list()])
      .then(([a, c]) => { setAccounts(a); setCategories(c); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (searchParams.get('add') === '1') setAdding(true);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('month', `${year}-${String(month + 1).padStart(2, '0')}`);
    if (categoryId) next.set('category', categoryId);
    if (accountId) next.set('account', accountId);
    if (period === 'year') next.set('period', 'year');
    setSearchParams(next, { replace: true });
  }, [year, month, categoryId, accountId, period, setSearchParams]);

  function shift(delta: number) {
    if (period === 'year') { setYear((value) => value + delta); return; }
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  function closeAdd() {
    setAdding(false);
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }

  // When filtered to one category, summarise just that category for the month:
  // its total (server already scopes categorySummary to the filter) and, if it's
  // a budgeted expense category, its budget usage.
  const filteredCategory = categoryId ? categories.find((c) => c.id === categoryId) : null;
  const filteredRows = categoryId && data ? data.categorySummary.filter((s) => s.categoryId === categoryId) : [];
  const filteredTotal = filteredRows.length === 1 && filteredRows[0]
    ? filteredRows[0].amount
    : String(filteredRows.reduce((sum, s) => sum + Number(s.amount), 0));
  const filteredKind = filteredRows[0]?.type ?? filteredCategory?.kind;
  const filteredBudget = categoryId ? budgets.find((b) => b.categoryId === categoryId) : undefined;

  // Client-side search + ordering over the already-loaded page(s). Server keyset
  // pagination is preserved: "Load more" fetches the next page, which then flows
  // through this same filter/sort.
  const visibleItems = useMemo(() => {
    const rows = data?.items ?? [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? rows.filter((t) => {
          const parts = [
            t.description,
            t.notes,
            t.categoryId ? categoryName.get(t.categoryId) : '',
            accountName.get(t.accountId),
            t.amount,
          ];
          return parts.some((p) => p && p.toLowerCase().includes(q));
        })
      : rows;
    const ordered = [...matched].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return sortDir === 'desc' ? ordered.reverse() : ordered;
  }, [data, search, sortDir, categoryName, accountName]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Transactions</h1><p className="mt-0.5 text-sm text-neutral-500">Review your balances and activity, or record something new.</p></div><button onClick={() => setAdding(true)} disabled={accounts.length === 0} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">+ Add transaction</button></div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="space-y-4">
        {/* Controls: period, month navigation, and filters */}
        <div className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 sm:inline-grid sm:w-auto" role="group" aria-label="Summary period">
                <button type="button" onClick={() => setPeriod('month')} aria-pressed={period === 'month'} className={`min-h-10 rounded-lg px-6 text-sm font-semibold transition ${period === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Month</button>
                <button type="button" onClick={() => setPeriod('year')} aria-pressed={period === 'year'} className={`min-h-10 rounded-lg px-6 text-sm font-semibold transition ${period === 'year' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Year</button>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-neutral-200 p-1">
                <button type="button" onClick={() => shift(-1)} aria-label="Previous period" className="grid min-h-9 min-w-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-700"><ChevronLeftIcon /></button>
                <span className="flex flex-1 items-center justify-center gap-2 px-1 text-sm font-semibold text-neutral-800 sm:min-w-[8.5rem] sm:flex-none"><CalendarIcon className="h-4 w-4 text-neutral-400" />{period === 'year' ? year : `${MONTHS[month]} ${year}`}</span>
                {(period === 'year' ? year >= now.getFullYear() : year === now.getFullYear() && month === now.getMonth())
                  ? <span aria-hidden="true" className="grid min-h-9 min-w-9 place-items-center rounded-lg text-neutral-300"><ChevronRightIcon /></span>
                  : <button type="button" onClick={() => shift(1)} aria-label="Next period" className="grid min-h-9 min-w-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-700"><ChevronRightIcon /></button>}
              </div>
            </div>
            <div className="flex items-end gap-3 sm:flex-wrap xl:border-l xl:border-neutral-200 xl:pl-4">
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none"><span className="text-[11px] font-medium text-neutral-500">Account</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-48"><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <button type="button" onClick={() => { setCategoryId(''); setAccountId(''); }} disabled={!hasFilters} title="Clear filters" aria-label="Clear filters" className="relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-medium text-neutral-600 transition enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 enabled:hover:text-emerald-700 disabled:opacity-50"><FilterIcon className="h-4 w-4" />Filters{hasFilters && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}</button>
            </div>
          </div>
          {accountId && <p className="mt-3 text-xs text-neutral-500">Showing balances and totals for {accountName.get(accountId) ?? 'this account'} only.</p>}
        </div>

        {/* Summary tiles */}
        {data && (
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-2 shadow-sm sm:p-3">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
              {period === 'year' || accountId
                ? <StatTile label="Starting balance" value={formatMoney(data.startingBalance, currency)} icon={<WalletIcon />} />
                : <InlineStartingBalance year={year} month={month} data={data} currency={currency} onSaved={loadMonth} />}
              <StatTile label="Current balance" value={formatMoney(data.currentBalance, currency)} icon={<BankIcon />} />
              <StatTile label="Income" value={formatMoney(data.income, currency)} tone="emerald" icon={<ArrowUpIcon />} />
              <StatTile label="Expense" value={`-${formatMoney(data.expense, currency)}`} tone="rose" icon={<ArrowDownIcon />} />
              <StatTile label={period === 'year' ? 'Net this year' : 'Net this month'} value={`${Number(data.net) >= 0 ? '+' : ''}${formatMoney(data.net, currency)}`} tone={Number(data.net) >= 0 ? 'emerald' : 'rose'} icon={<TrendIcon />} />
            </div>
            {period === 'month' && budgets.length > 0 && (
              <div className="mt-1 border-t border-neutral-100 pt-1">
                <button type="button" onClick={() => setShowBudgets((value) => !value)} aria-expanded={showBudgets} aria-controls="budget-overview-panel" className="flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
                  {showBudgets ? 'Hide budget overview' : 'Show budget overview'}
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${showBudgets ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {period === 'month' && showBudgets && budgets.length > 0 && (
          <div id="budget-overview-panel">
            <BudgetSummary budgets={budgets} names={categoryName} currency={currency} selectedCategoryId={categoryId} onSelectCategory={setCategoryId} />
          </div>
        )}

        {/* Filtered-category budget detail */}
        {categoryId && data && (
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-neutral-700">{filteredCategory?.name ?? 'Category'} this {period}</span>
              <span className={`text-base font-semibold tabular-nums ${filteredKind === 'INCOME' ? 'text-emerald-600' : 'text-rose-500'}`}>{filteredKind === 'INCOME' ? '+' : '-'}{formatMoney(filteredTotal, currency)}</span>
            </div>
            {filteredBudget && period === 'month' && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                  <span>Budget</span>
                  <span className="tabular-nums">{formatMoney(filteredBudget.spentAmount, currency)} of {formatMoney(filteredBudget.budgetAmount, currency)} ({filteredBudget.usagePercent.toFixed(0)}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div className={`h-full rounded-full ${filteredBudget.status === 'OVER' ? 'bg-rose-500' : filteredBudget.status === 'NEAR' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(filteredBudget.usagePercent, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transactions list */}
        <div className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="shrink-0 text-sm font-semibold text-neutral-700">{visibleItems.length} transaction{visibleItems.length === 1 ? '' : 's'}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filter by category" className="min-h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-44"><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." aria-label="Search transactions" className="min-h-10 w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-64" />
              </div>
              <div className="inline-flex shrink-0 rounded-xl border border-neutral-200 p-0.5" role="group" aria-label="Sort order">
                <button type="button" onClick={() => setSortDir('desc')} aria-pressed={sortDir === 'desc'} title="Newest first" className={`grid min-h-9 min-w-9 place-items-center rounded-lg transition ${sortDir === 'desc' ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-400 hover:text-neutral-700'}`}><SortDescIcon /></button>
                <button type="button" onClick={() => setSortDir('asc')} aria-pressed={sortDir === 'asc'} title="Oldest first" className={`grid min-h-9 min-w-9 place-items-center rounded-lg transition ${sortDir === 'asc' ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-400 hover:text-neutral-700'}`}><SortAscIcon /></button>
              </div>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-neutral-500">Loading…</p>
          ) : !data || data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-neutral-500">No transactions this {period}.</p>
          ) : visibleItems.length === 0 ? (
            <p className="p-12 text-center text-sm text-neutral-500">No transactions match “{search.trim()}”.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full sm:min-w-[46rem]">
                <div className="hidden grid-cols-[3.25rem_minmax(0,1fr)_8rem_9rem_7rem_6.5rem] gap-4 border-b border-neutral-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 sm:grid">
                  <span className="text-center">Date</span><span>Description</span><span>Category</span><span>Account</span><span className="text-right">Amount</span><span aria-hidden="true"></span>
                </div>
                <ul className="divide-y divide-neutral-100">
                  {visibleItems.map((t) => (
                    <TransactionRow
                      key={t.id}
                      t={t}
                      category={t.categoryId ? categoryById.get(t.categoryId) : undefined}
                      accountLabel={accountName.get(t.accountId) ?? 'Account'}
                      counterName={transferCounterName.get(t.id)}
                      onEdit={() => openEditor(t)}
                      onDelete={() => openEditor(t, true)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}

          {data?.nextCursor && (
            <div className="border-t border-neutral-100 p-4 text-center">
              <button onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>
            </div>
          )}
        </div>
      </div>

      {adding && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onClose={closeAdd}
          onSaved={() => { closeAdd(); void loadMonth(); }}
        />
      )}
      {editing && <TransactionEditor transaction={editing} accountName={accountName.get(editing.accountId) ?? 'Account'} categories={categories} initialConfirmDelete={editingDelete} onClose={closeEditor} onSaved={() => { closeEditor(); void loadMonth(); }} />}
    </div>
  );
}

function InlineStartingBalance({ year, month, data, currency, onSaved }: { year: number; month: number; data: MonthResponse; currency: string; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try { await api.balances.set({ year, month, startingBalance: String(new FormData(e.currentTarget).get('startingBalance')) }); setEditing(false); await onSaved(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to set starting balance.'); }
    finally { setPending(false); }
  }

  async function reset() {
    setPending(true);
    try { await api.balances.reset({ year, month }); setEditing(false); await onSaved(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to reset starting balance.'); }
    finally { setPending(false); }
  }

  return (
    <>
      <StatTile
        label={`Starting balance${data.isManualStart ? ' · manual' : ''}`}
        value={formatMoney(data.startingBalance, currency)}
        icon={<WalletIcon />}
        action={
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit starting balance" className="ml-1 shrink-0 text-neutral-300 transition hover:text-emerald-600">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        }
      />
      {editing && (
        <Modal title="Starting balance" subtitle={data.isManualStart ? 'Manually set for this month' : 'Computed from prior activity'} onClose={() => { if (!pending) setEditing(false); }}>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium text-neutral-700">Amount
              <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-neutral-300 px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                <span className="pr-2 text-sm font-semibold text-neutral-400">{currency}</span>
                <input name="startingBalance" inputMode="decimal" required autoFocus defaultValue={data.startingBalance} className="min-w-0 flex-1 bg-transparent py-2.5 tabular-nums outline-none" />
              </span>
            </label>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {data.isManualStart ? <button type="button" onClick={() => void reset()} disabled={pending} className="min-h-11 self-start text-sm font-semibold text-rose-600 disabled:opacity-50">Reset to computed</button> : <span />}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(false)} disabled={pending} className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 sm:flex-none">Cancel</button>
                <button disabled={pending} className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none">{pending ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function TransactionEditor({ transaction, accountName, categories, onClose, onSaved, initialConfirmDelete = false }: { transaction: TransactionDTO; accountName: string; categories: CategoryDTO[]; onClose: () => void; onSaved: () => void; initialConfirmDelete?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(initialConfirmDelete);
  const isTransfer = transaction.type === 'TRANSFER_OUT' || transaction.type === 'TRANSFER_IN';
  const visibleCategories = categories.filter((category) => category.kind === transaction.type);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const selectedCategory = String(data.get('categoryId') || '');
    setPending(true);
    try {
      await api.transactions.update({
        id: transaction.id,
        categoryId: selectedCategory || null,
        amount: String(data.get('amount')),
        description: String(data.get('description') || '') || null,
        occurredAt: dateTimeLocalToISO(String(data.get('occurredAt'))),
      });
      onSaved();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to update transaction.'); }
    finally { setPending(false); }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try { await api.transactions.remove({ id: transaction.id }); onSaved(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to delete transaction.'); }
    finally { setPending(false); }
  }

  const typeLabel = isTransfer ? 'Transfer' : transaction.type.charAt(0) + transaction.type.slice(1).toLowerCase();

  return <Modal title={confirmingDelete ? (isTransfer ? 'Delete transfer' : 'Delete transaction') : isTransfer ? 'Transfer' : 'Edit transaction'} subtitle={`${accountName} · ${typeLabel}`} size="lg" onClose={onClose}>
    {confirmingDelete ? <div className="space-y-5"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Delete this {isTransfer ? 'transfer' : 'transaction'}?</p><p className="mt-1">{isTransfer ? 'Both sides of the transfer are removed from both accounts, together.' : 'It will be removed from your transaction history and all balance calculations.'}</p></div>{error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-3 border-t border-neutral-100 pt-4"><button type="button" onClick={() => { setConfirmingDelete(false); setError(null); }} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700">Cancel</button><button type="button" onClick={() => void remove()} disabled={pending} className="min-h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Deleting…' : isTransfer ? 'Delete transfer' : 'Delete transaction'}</button></div></div> :
    isTransfer ? <div className="space-y-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"><p className="font-semibold">Transfers can’t be edited.</p><p className="mt-1">A transfer moves money between two accounts as one atomic action. To change it, delete it (both sides are removed) and create a new transfer.</p></div>
      <dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-neutral-500">Amount</dt><dd className="font-semibold tabular-nums">{formatMoney(transaction.amount, transaction.currency)}</dd></div><div className="flex justify-between gap-4"><dt className="text-neutral-500">{transaction.type === 'TRANSFER_OUT' ? 'From account' : 'To account'}</dt><dd className="font-medium">{accountName}</dd></div>{transaction.description && <div className="flex justify-between gap-4"><dt className="text-neutral-500">Description</dt><dd className="min-w-0 truncate font-medium">{transaction.description}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-neutral-500">Date</dt><dd className="font-medium">{new Date(transaction.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</dd></div></dl>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-between gap-3 border-t border-neutral-100 pt-4"><button type="button" onClick={() => { setConfirmingDelete(true); setError(null); }} className="min-h-11 text-sm font-semibold text-rose-600">Delete transfer</button><button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700">Close</button></div>
    </div> :
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-medium text-neutral-700">Amount<span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-neutral-300 px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"><span className="pr-2 text-sm font-semibold text-neutral-400">{transaction.currency}</span><input name="amount" inputMode="decimal" required autoFocus defaultValue={transaction.amount} className="min-w-0 flex-1 bg-transparent py-2.5 outline-none" /></span></label>
      <label className="block text-sm font-medium text-neutral-700"><span className="mb-1.5 flex items-center justify-between gap-3"><span>Category</span><Link to="/settings" className="text-xs font-semibold text-emerald-600 hover:underline">Add or edit categories in Settings →</Link></span><select name="categoryId" required defaultValue={transaction.categoryId ?? visibleCategories[0]?.id ?? ''} className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="block text-sm font-medium text-neutral-700">Description<input name="description" maxLength={200} placeholder="What was this for?" defaultValue={transaction.description ?? ''} className="mt-1.5 min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
      <label className="block text-sm font-medium text-neutral-700">Date and time<input name="occurredAt" type="datetime-local" required defaultValue={transaction.occurredAt.slice(0, 16)} className="mt-1.5 min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => { setConfirmingDelete(true); setError(null); }} className="min-h-11 self-start text-sm font-semibold text-rose-600">Delete</button><div className="flex gap-3"><button type="button" onClick={onClose} disabled={pending} className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 sm:flex-none">Cancel</button><button disabled={pending} className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none">{pending ? 'Saving…' : 'Save changes'}</button></div></div>
    </form>}
  </Modal>;
}

// ── Redesigned presentation pieces ──────────────────────────────────────────

/** A single summary statistic: pastel icon chip, label, and colored value. */
function StatTile({ label, value, tone = 'neutral', icon, action }: { label: string; value: string; tone?: 'neutral' | 'emerald' | 'rose'; icon: ReactNode; action?: ReactNode }) {
  const chip = tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : tone === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600';
  const valueColor = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-500' : 'text-neutral-900';
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${chip}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-neutral-500">{label}</p>
        <p className={`flex items-center text-base font-semibold tabular-nums ${valueColor}`} title={value}><span className="truncate">{value}</span>{action}</p>
      </div>
    </div>
  );
}

const CATEGORY_PALETTE = [
  'bg-emerald-50 text-emerald-700',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-cyan-50 text-cyan-700',
  'bg-fuchsia-50 text-fuchsia-700',
  'bg-indigo-50 text-indigo-700',
];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** A colored category badge. Uses the category's own hex color when set, else a
 *  stable palette color derived from its id so pills stay visually distinct. */
function CategoryPill({ id, color, name }: { id: string; color: string | null; name: string }) {
  if (color && HEX6.test(color)) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${color}1a`, color }}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{name}</span>
      </span>
    );
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return <span className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]}`}>{name}</span>;
}

/** One transaction: a compact stacked card on mobile, an aligned table row on
 *  desktop. Both share the same grid template as the list header. */
function TransactionRow({ t, category, accountLabel, counterName, onEdit, onDelete }: { t: TransactionDTO; category?: CategoryDTO; accountLabel: string; counterName?: string; onEdit: () => void; onDelete: () => void }) {
  const isTransferLeg = t.type === 'TRANSFER_OUT' || t.type === 'TRANSFER_IN';
  const isOutflow = t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT';
  const label = isTransferLeg
    ? (t.description || (t.type === 'TRANSFER_OUT' ? `Transfer to ${counterName ?? 'another account'}` : `Transfer from ${counterName ?? 'another account'}`))
    : (t.description ?? category?.name ?? t.type);
  const d = new Date(t.occurredAt);
  const mon = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
  const amount = `${isOutflow ? '-' : '+'}${formatMoney(t.amount, t.currency)}`;
  const amountColor = isOutflow ? 'text-rose-500' : 'text-emerald-600';
  const chip = isTransferLeg ? 'bg-sky-50 text-sky-600' : isOutflow ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600';
  const glyph = isTransferLeg ? <SwapIcon /> : isOutflow ? <ArrowDownIcon /> : <ArrowUpIcon />;
  const categoryCell = isTransferLeg
    ? <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Transfer</span>
    : category
      ? <CategoryPill id={category.id} color={category.color} name={category.name} />
      : <span className="text-xs text-neutral-400">Uncategorized</span>;
  const dateBlock = (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{mon}</span>
      <span className="text-lg font-semibold leading-none text-neutral-700">{day}</span>
    </div>
  );

  return (
    <li>
      {/* Mobile */}
      <div className="flex items-center gap-3 px-4 py-3 sm:hidden">
        <div className="w-9 shrink-0">{dateBlock}</div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${chip}`}>{glyph}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-800">{label}</p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-neutral-400">{categoryCell}<span className="truncate">{accountLabel}</span></div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-sm font-semibold tabular-nums ${amountColor}`}>{amount}</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={onEdit} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600">Edit</button>
            <RowMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden items-center gap-4 px-4 py-3 transition hover:bg-neutral-50/70 sm:grid sm:grid-cols-[3.25rem_minmax(0,1fr)_8rem_9rem_7rem_6.5rem]">
        {dateBlock}
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${chip}`}>{glyph}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-800">{label}</p>
            {t.notes && <p className="truncate text-xs text-neutral-400">{t.notes}</p>}
          </div>
        </div>
        <div className="min-w-0">{categoryCell}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-500"><CardIcon className="h-4 w-4 shrink-0 text-neutral-400" /><span className="truncate">{accountLabel}</span></div>
        <div className={`text-right text-sm font-semibold tabular-nums ${amountColor}`}>{amount}</div>
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><PencilIcon className="h-3.5 w-3.5" />Edit</button>
          <RowMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </li>
  );
}

/** The per-row "⋮" overflow menu (Edit / Delete). Closes on outside click. */
function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions" className="grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"><DotsIcon /></button>
      {open && (
        <>
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"><PencilIcon className="h-4 w-4 text-neutral-400" />Edit</button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><TrashIcon className="h-4 w-4" />Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline line icons (no external icon dependency) ─────────────────────────
function Svg({ children, className = 'h-4 w-4' }: { children: ReactNode; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>;
}
const WalletIcon = (p: { className?: string }) => <Svg {...p}><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2" /><path d="M3 8.5V17a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 11h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" /></Svg>;
const BankIcon = (p: { className?: string }) => <Svg {...p}><path d="m3 10 9-6 9 6" /><path d="M5 10v8m4-8v8m6-8v8m4-8v8" /><path d="M3 20h18" /></Svg>;
const ArrowUpIcon = (p: { className?: string }) => <Svg {...p}><path d="M12 19V6" /><path d="m6 12 6-6 6 6" /></Svg>;
const ArrowDownIcon = (p: { className?: string }) => <Svg {...p}><path d="M12 5v13" /><path d="m6 12 6 6 6-6" /></Svg>;
const TrendIcon = (p: { className?: string }) => <Svg {...p}><path d="m3 16 6-6 4 4 8-8" /><path d="M17 6h4v4" /></Svg>;
const ChevronLeftIcon = (p: { className?: string }) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
const ChevronRightIcon = (p: { className?: string }) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
const CalendarIcon = (p: { className?: string }) => <Svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>;
const FilterIcon = (p: { className?: string }) => <Svg {...p}><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" /></Svg>;
const SearchIcon = (p: { className?: string }) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></Svg>;
const PencilIcon = (p: { className?: string }) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Svg>;
const TrashIcon = (p: { className?: string }) => <Svg {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></Svg>;
const CardIcon = (p: { className?: string }) => <Svg {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></Svg>;
const SwapIcon = (p: { className?: string }) => <Svg {...p}><path d="m7 4-4 4 4 4" /><path d="M3 8h13" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8" /></Svg>;
const SortDescIcon = (p: { className?: string }) => <Svg {...p}><path d="M4 6h10M4 12h7M4 18h4" /><path d="M18 8v10m0 0 3-3m-3 3-3-3" /></Svg>;
const SortAscIcon = (p: { className?: string }) => <Svg {...p}><path d="M4 6h4M4 12h7M4 18h10" /><path d="M18 18V8m0 0 3 3m-3-3-3 3" /></Svg>;
const DotsIcon = (p: { className?: string }) => <svg viewBox="0 0 24 24" fill="currentColor" className={p.className ?? 'h-4 w-4'} aria-hidden="true"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>;

function TransactionForm({ accounts, categories, onClose, onSaved }: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '');
  const [type, setType] = useState('EXPENSE');
  // One key per open form = one logical create. Retries of this submit (double-
  // click, refresh, timeout) reuse it so the server dedupes instead of inserting
  // a duplicate transaction (or transfer).
  const idempotencyKey = useRef('');
  if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
  const isTransfer = type === 'TRANSFER';
  const visibleCategories = categories.filter((category) => category.kind === type);
  const selectedCurrency = accounts.find((account) => account.id === accountId)?.currency ?? '';
  // The destination must differ from the source; keep the selection valid.
  const toOptions = accounts.filter((account) => account.id !== accountId);
  const effectiveToAccountId = toOptions.some((account) => account.id === toAccountId)
    ? toAccountId
    : (toOptions[0]?.id ?? '');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, pending]);

  function close() {
    if (!pending) {
      setError(null);
      onClose();
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const categoryId = String(f.get('categoryId') || '');
    // A category is required for income/expense (transfers don't use one). Don't
    // proceed until one is picked.
    if (!isTransfer && !categoryId) {
      setError('Please select a category.');
      return;
    }
    setPending(true);
    try {
      if (isTransfer) {
        await api.transactions.transfer({
          fromAccountId: accountId,
          toAccountId: effectiveToAccountId,
          amount: String(f.get('amount')),
          description: String(f.get('description') || '') || undefined,
          occurredAt: dateTimeLocalToISO(String(f.get('occurredAt'))),
          idempotencyKey: idempotencyKey.current,
        });
      } else {
        await api.transactions.create({
          accountId: String(f.get('accountId')),
          type: String(f.get('type')),
          amount: String(f.get('amount')),
          categoryId: categoryId || undefined,
          description: String(f.get('description') || '') || undefined,
          occurredAt: dateTimeLocalToISO(String(f.get('occurredAt'))),
          idempotencyKey: idempotencyKey.current,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setPending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/45 backdrop-blur-[2px]" onClick={close} aria-label="Close add transaction dialog" />
      <section role="dialog" aria-modal="true" aria-labelledby="add-transaction-title" className="relative max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[92vh] sm:max-w-lg sm:rounded-2xl sm:pb-0">
        <div className="flex items-start justify-between border-b border-neutral-100 bg-gradient-to-r from-white to-emerald-50/50 px-6 py-5">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">New activity</p><h2 id="add-transaction-title" className="text-lg font-semibold text-neutral-900">Add a transaction</h2></div>
          <button type="button" onClick={close} disabled={pending} className="grid min-h-11 min-w-11 place-items-center rounded-full text-xl leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 sm:min-h-9 sm:min-w-9" aria-label="Close">×</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">{isTransfer ? 'From account' : 'Account'}</span><select name="accountId" value={accountId} onChange={(event) => setAccountId(event.target.value)} required className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Type</span><select name="type" value={type} onChange={(event) => setType(event.target.value)} className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value="EXPENSE">Expense · money out</option><option value="INCOME">Income · money in</option>{accounts.length >= 2 && <option value="TRANSFER">Transfer · between accounts</option>}</select></label>
          </div>

          {isTransfer ? (
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">To account</span><select value={effectiveToAccountId} onChange={(event) => setToAccountId(event.target.value)} required className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{toOptions.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
          ) : (
            <label className="block"><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-neutral-700"><span>Category</span><Link to="/settings" className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 hover:underline">Add or edit categories in Settings →</Link></span><select name="categoryId" defaultValue="" className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{visibleCategories.length === 0 ? <option value="">No categories available — add one in Settings</option> : <option value="">Select a category</option>}{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          )}

          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Amount</span><div className="flex min-h-12 items-center rounded-xl border border-neutral-300 px-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"><span className="select-none pr-2 text-sm font-semibold text-neutral-400">{selectedCurrency || '—'}</span><input name="amount" inputMode="decimal" placeholder="0.00" autoFocus required className="min-w-0 flex-1 bg-transparent py-2.5 text-neutral-900 outline-none" /></div></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Description <span className="font-normal text-neutral-400">(optional)</span></span><input name="description" placeholder="What was this for?" maxLength={200} className="min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Date and time</span><input name="occurredAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(new Date())} className="min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4"><button type="button" onClick={close} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Adding…' : 'Add transaction'}</button></div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function parseMonth(value: string | null, fallback: Date): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  // Wall-clock model: the default month is the viewer's LOCAL current month.
  if (!match) return { year: fallback.getFullYear(), month: fallback.getMonth() };
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (year < 2000 || year > 2100 || month < 0 || month > 11) return { year: fallback.getFullYear(), month: fallback.getMonth() };
  return { year, month };
}
