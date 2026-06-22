import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { BudgetDTO, CategoryDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/auth/auth-context';
import { SettingsBackLink } from '@/pages/settings';

export function SettingsBudgetPage() {
  const { user } = useAuth();
  const currency = user?.baseCurrency ?? 'AUD';
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextCategories, nextBudgets] = await Promise.all([api.categories.list(), api.budgets.list()]);
      setCategories(nextCategories);
      setBudgets(nextBudgets);
    } catch (err) {
      setError(message(err, 'Failed to load budgets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const budgetByCategory = useMemo(() => new Map(budgets.map((budget) => [budget.categoryId, budget])), [budgets]);
  const expenseCategories = useMemo(() => categories.filter((category) => category.kind === 'EXPENSE'), [categories]);

  return (
    <div className="space-y-6 pb-10">
      <SettingsBackLink />
      <div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Budgets</h1><p className="mt-1 text-sm text-neutral-500">Set a monthly spending limit for each expense category.</p></div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
        {loading ? (
          <p className="px-5 py-6 text-sm text-neutral-500">Loading…</p>
        ) : expenseCategories.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-neutral-400">No expense categories yet. <Link to="/settings/categories" className="font-medium text-emerald-600 hover:underline">Add one</Link> to set a budget.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {expenseCategories.map((category) => (
              <BudgetRow key={category.id} category={category} budget={budgetByCategory.get(category.id)} currency={currency} onChanged={load} onError={setError} />
            ))}
          </div>
        )}
      </section>

      <Link to="/settings/categories" className="flex items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50 sm:px-5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Add categories
      </Link>
    </div>
  );
}

function BudgetRow({ category, budget, currency, onChanged, onError }: {
  category: CategoryDTO;
  budget?: BudgetDTO;
  currency: string;
  onChanged: () => Promise<void>;
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = String(new FormData(e.currentTarget).get('amount')).trim();
    setPending(true);
    onError(null);
    try { await api.budgets.set({ categoryId: category.id, amount }); setEditing(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to save budget.')); }
    finally { setPending(false); }
  }

  async function remove() {
    setPending(true);
    try { await api.budgets.remove(category.id); setEditing(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to remove budget.')); }
    finally { setPending(false); }
  }

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-neutral-800">{category.name}</span>
        {!editing && (
          <button type="button" onClick={() => { onError(null); setEditing(true); }} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${budget ? 'border border-neutral-200 bg-neutral-100 tabular-nums text-neutral-700' : 'text-neutral-400 hover:text-emerald-600'}`}>{budget ? <>{formatMoney(budget.amount, currency)} <span className="text-neutral-400">/mo</span></> : '+ Set budget'}</button>
        )}
      </div>
      {editing && (
        <form onSubmit={save} className="mt-2 space-y-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 sm:flex-1">
            <span className="shrink-0 text-xs font-medium text-neutral-400">{currency}</span>
            <input key={budget?.id ?? 'none'} name="amount" inputMode="decimal" required autoFocus defaultValue={budget?.amount ?? ''} placeholder="0.00" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pending} className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-60 sm:flex-none">Save</button>
            {budget && <button type="button" onClick={() => void remove()} className="min-h-11 rounded-lg px-3 text-xs font-medium text-rose-600">Remove</button>}
            <button type="button" onClick={() => { onError(null); setEditing(false); }} className="min-h-11 rounded-lg px-3 text-xs font-medium text-neutral-500">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function message(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  // Validation failures carry the real reason per field; the top-level message
  // is just a generic "Invalid input", so prefer the specific field error.
  const fieldError = error.fieldErrors && Object.values(error.fieldErrors).flat()[0];
  return fieldError ?? error.message;
}
