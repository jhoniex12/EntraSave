import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { AccountDTO, BudgetStatusDTO, CategoryDTO, MonthResponse, TransactionDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/auth/auth-context';
import { Modal } from '@/components/modal';
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TransactionDTO | null>(null);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
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

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Transactions</h1><p className="mt-0.5 text-sm text-neutral-500">Review your balances and activity, or record something new.</p></div><button onClick={() => setAdding(true)} disabled={accounts.length === 0} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">+ Add transaction</button></div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 sm:mx-auto sm:w-64" role="group" aria-label="Summary period">
        <button type="button" onClick={() => setPeriod('month')} aria-pressed={period === 'month'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Month</button>
        <button type="button" onClick={() => setPeriod('year')} aria-pressed={period === 'year'} className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition ${period === 'year' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>Year</button>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-emerald-50">← Prev</button>
        </div>
        <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">{period === 'year' ? 'Yearly overview' : 'Monthly overview'}</p><h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{period === 'year' ? year : `${MONTHS[month]} ${year}`}</h2></div>
        {(period === 'year' ? year >= now.getUTCFullYear() : year === now.getUTCFullYear() && month === now.getUTCMonth()) ? <span className="px-3 py-2 text-sm text-neutral-300">Next →</span> : <button onClick={() => shift(1)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-emerald-50">Next →</button>}
      </div>

      {data && (
        <div className="mb-6 grid grid-cols-1 gap-0.5 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm sm:p-3">
          {period === 'year'
            ? <SummaryRow label="Starting balance" value={formatMoney(data.startingBalance, currency)} tone="neutral" />
            : <InlineStartingBalance year={year} month={month} data={data} currency={currency} onSaved={loadMonth} />}
          <SummaryRow label="Current balance" value={formatMoney(data.currentBalance, currency)} tone="neutral" />
          <SummaryRow label="Income" value={formatMoney(data.income, currency)} tone="emerald" />
          <SummaryRow label="Expense" value={formatMoney(data.expense, currency)} tone="rose" />
          <SummaryRow label={period === 'year' ? 'Net this year' : 'Net this month'} value={`${Number(data.net) >= 0 ? '+' : ''}${formatMoney(data.net, currency)}`} tone={Number(data.net) >= 0 ? 'emerald' : 'rose'} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="w-full min-w-0 flex-1 text-sm font-medium text-neutral-700 sm:min-w-56">Filter by account<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={inputClass}><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label className="w-full min-w-0 flex-1 text-sm font-medium text-neutral-700 sm:min-w-56">Filter by category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {(categoryId || accountId) && <button onClick={() => { setCategoryId(''); setAccountId(''); }} className="min-h-11 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600">Clear filters</button>}
      </div>

      {categoryId && data && (
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
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

      <div className="overflow-hidden border-t border-neutral-100 pt-3">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading…</p>
        ) : !data || data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-500">No transactions this {period}.</p>
        ) : (
          <ul className="space-y-1">
            {data.items.map((t) => {
              const isTransferLeg = t.type === 'TRANSFER_OUT' || t.type === 'TRANSFER_IN';
              const isOutflow = t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT';
              const category = t.categoryId ? categoryName.get(t.categoryId) : null;
              const counter = transferCounterName.get(t.id);
              const label = isTransferLeg
                ? (t.description || (t.type === 'TRANSFER_OUT' ? `Transfer to ${counter ?? 'another account'}` : `Transfer from ${counter ?? 'another account'}`))
                : (t.description ?? category ?? t.type);
              return (
                <li key={t.id} className="group flex items-center justify-between gap-3 rounded-2xl px-2 py-3 transition hover:bg-neutral-50 sm:px-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm transition group-hover:scale-105 ${isTransferLeg ? 'bg-sky-50 text-sky-600' : isOutflow ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{isTransferLeg ? '⇄' : isOutflow ? '↑' : '↓'}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-800">{label}</p><p className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-400">{isTransferLeg ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Transfer</span> : category && <span className="max-w-32 truncate rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">{category}</span>}<span>{new Date(t.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span></p></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className={`text-sm font-semibold tabular-nums ${isOutflow ? 'text-rose-500' : 'text-emerald-600'}`}>{isOutflow ? '-' : '+'}{formatMoney(t.amount, t.currency)}</span>
                    <button onClick={() => setEditing(t)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 sm:min-h-0" aria-label={`Edit ${label}`}><span aria-hidden="true">✎</span><span className="hidden sm:inline">Edit</span></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data?.nextCursor && (
          <div className="pt-4 text-center">
            <button onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>
          </div>
        )}
      </div>
      </section>

      {adding && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onClose={closeAdd}
          onSaved={() => { closeAdd(); void loadMonth(); }}
        />
      )}
      {editing && <TransactionEditor transaction={editing} accountName={accountName.get(editing.accountId) ?? 'Account'} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void loadMonth(); }} />}
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
    <div className="rounded-2xl px-3 py-2">
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <span className="text-sm font-medium text-neutral-600">Starting balance{data.isManualStart && <span className="text-amber-500"> · manual</span>}</span>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-neutral-400">{currency}</span>
            <input name="startingBalance" inputMode="decimal" required autoFocus defaultValue={data.startingBalance} className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <button disabled={pending} className="min-h-11 shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Save</button>
            {data.isManualStart && <button type="button" onClick={() => void reset()} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-rose-600">Reset</button>}
            <button type="button" onClick={() => setEditing(false)} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-neutral-500">Cancel</button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-neutral-600">Starting balance{data.isManualStart && <span className="text-amber-500"> · manual</span>}</span>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatMoney(data.startingBalance, currency)} <span className="text-amber-500">✎</span></button>
        </div>
      )}
    </div>
  );
}

function TransactionEditor({ transaction, accountName, categories, onClose, onSaved }: { transaction: TransactionDTO; accountName: string; categories: CategoryDTO[]; onClose: () => void; onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
        occurredAt: new Date(String(data.get('occurredAt'))).toISOString(),
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

function SummaryRow({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'rose' | 'neutral' }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-neutral-900';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${color}`} title={value}>{value}</span>
    </div>
  );
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

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
    setPending(true);
    const f = new FormData(e.currentTarget);
    const categoryId = String(f.get('categoryId') || '');
    try {
      if (isTransfer) {
        await api.transactions.transfer({
          fromAccountId: accountId,
          toAccountId: effectiveToAccountId,
          amount: String(f.get('amount')),
          description: String(f.get('description') || '') || undefined,
          occurredAt: new Date(String(f.get('occurredAt'))).toISOString(),
          idempotencyKey: idempotencyKey.current,
        });
      } else {
        await api.transactions.create({
          accountId: String(f.get('accountId')),
          type: String(f.get('type')),
          amount: String(f.get('amount')),
          categoryId: categoryId || undefined,
          description: String(f.get('description') || '') || undefined,
          occurredAt: new Date(String(f.get('occurredAt'))).toISOString(),
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
            <label className="block"><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-neutral-700"><span>Category</span><Link to="/settings" className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 hover:underline">Add or edit categories in Settings →</Link></span><select name="categoryId" required className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{visibleCategories.length === 0 && <option value="">No categories available — add one in Settings</option>}{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          )}

          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Amount</span><div className="flex min-h-12 items-center rounded-xl border border-neutral-300 px-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"><span className="select-none pr-2 text-sm font-semibold text-neutral-400">{selectedCurrency || '—'}</span><input name="amount" inputMode="decimal" placeholder="0.00" autoFocus required className="min-w-0 flex-1 bg-transparent py-2.5 text-neutral-900 outline-none" /></div></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Description <span className="font-normal text-neutral-400">(optional)</span></span><input name="description" placeholder="What was this for?" maxLength={200} className="min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-neutral-700">Date and time</span><input name="occurredAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} className="min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
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
  if (!match) return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() };
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (year < 2000 || year > 2100 || month < 0 || month > 11) return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() };
  return { year, month };
}
