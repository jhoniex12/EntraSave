import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import type { BudgetDTO, CategoryDTO } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/auth/auth-context';
import { applyTheme, readStoredTheme, storeTheme, THEME_OPTIONS, type Theme } from '@/lib/theme';

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyPending, setCurrencyPending] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragEnabled, setDragEnabled] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextCategories, nextBudgets] = await Promise.all([api.categories.list(), api.budgets.list()]);
      setCategories(nextCategories);
      setBudgets(nextBudgets);
    } catch (err) {
      setError(message(err, 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const budgetByCategory = useMemo(() => new Map(budgets.map((budget) => [budget.categoryId, budget])), [budgets]);

  async function updateCurrency(currency: string) {
    setCurrencyPending(true);
    setError(null);
    try {
      await api.users.updateCurrency({ currency });
      await refresh();
    } catch (err) {
      setError(message(err, 'Failed to update currency.'));
    } finally {
      setCurrencyPending(false);
    }
  }

  async function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      setError(null);
      await api.categories.create({ name: String(data.get('name')), kind: String(data.get('kind')) });
      form.reset();
      await load();
    } catch (err) {
      setError(message(err, 'Failed to add category.'));
    }
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setCategories(next);
    try { await api.categories.reorder(next.map((item) => item.id)); }
    catch (err) { setError(message(err, 'Failed to reorder categories.')); await load(); }
  }

  async function sort(mode: 'az' | 'za' | 'type') {
    const next = [...categories].sort((a, b) => {
      if (mode === 'type' && a.kind !== b.kind) return a.kind === 'EXPENSE' ? -1 : 1;
      const comparison = a.name.localeCompare(b.name);
      return mode === 'za' ? -comparison : comparison;
    });
    setCategories(next);
    try { await api.categories.reorder(next.map((item) => item.id)); }
    catch (err) { setError(message(err, 'Failed to sort categories.')); await load(); }
  }

  const incomeCount = categories.filter((category) => category.kind === 'INCOME').length;
  const expenseCount = categories.length - incomeCount;

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-neutral-950 px-5 py-6 text-white shadow-xl shadow-neutral-200/70 sm:px-8 sm:py-8"><div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" /><div className="relative"><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Personal preferences</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Make EntraSave yours.</h1><p className="mt-2 max-w-2xl text-sm text-neutral-400 sm:text-base">Choose how money is displayed and organise the categories used across transactions and reports.</p><div className="mt-6 flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-neutral-300"><strong className="text-white">{categories.length}</strong> categories</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-neutral-300"><strong className="text-emerald-300">{incomeCount}</strong> income</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-neutral-300"><strong className="text-rose-300">{expenseCount}</strong> expense</span></div></div></section>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="border-b border-neutral-100 bg-gradient-to-r from-white to-emerald-50/50 px-5 py-5"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Display preference</p>
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Base currency</h2>
        <p className="mt-1 text-sm text-neutral-500">Used for dashboard and summary totals.</p>
        </div><div className="p-5 sm:p-6">
        <select
          value={user?.baseCurrency ?? 'AUD'}
          disabled={currencyPending}
          onChange={(event) => void updateCurrency(event.target.value)}
          className={`${inputClass} max-w-md`}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>{currency.code} — {currency.name} ({currency.symbol})</option>
          ))}
        </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="border-b border-neutral-100 bg-gradient-to-r from-white to-emerald-50/50 px-5 py-5"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Appearance</p><h2 className="text-xl font-semibold tracking-tight text-neutral-900">Colour theme</h2><p className="mt-1 text-sm text-neutral-500">Use your device preference or choose a theme for EntraSave.</p></div><div className="p-5 sm:p-6"><ThemeForm /></div></section>

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="border-b border-neutral-100 bg-gradient-to-r from-white to-emerald-50/50 px-5 py-5"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Transaction organisation</p><h2 className="text-xl font-semibold tracking-tight text-neutral-900">Categories</h2><p className="mt-1 text-sm text-neutral-500">Add, rename, remove, sort, or drag categories into the order that works for you.</p></div><div className="p-5 sm:p-6">

        <form onSubmit={addCategory} className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
          <label className="text-sm font-medium text-neutral-700">Category name<input name="name" required maxLength={40} placeholder="e.g. Groceries" className={inputClass} /></label>
          <label className="text-sm font-medium text-neutral-700">Type<select name="kind" defaultValue="EXPENSE" className={inputClass}><option value="EXPENSE">Expense · money out</option><option value="INCOME">Income · money in</option></select></label>
          <button className="min-h-11 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Add category</button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-neutral-500"><span className="font-medium text-neutral-600">Sort:</span><button onClick={() => void sort('az')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">A–Z</button><button onClick={() => void sort('za')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">Z–A</button><button onClick={() => void sort('type')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">Type</button><span className="ml-auto hidden text-neutral-400 sm:inline">or drag the ⋮⋮ handle</span></div>
        {loading ? <p className="mt-5 text-sm text-neutral-500">Loading…</p> : <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">{categories.map((category, index) => <div key={category.id} draggable={dragEnabled === index} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) void reorder(dragIndex, index); setDragIndex(null); setDragEnabled(null); }} onDragEnd={() => { setDragIndex(null); setDragEnabled(null); }} className={`${dragIndex === index ? 'opacity-40' : ''} touch-manipulation border-b border-neutral-100 last:border-b-0`}><CategoryRow category={category} budget={budgetByCategory.get(category.id)} currency={user?.baseCurrency ?? 'AUD'} onGrip={() => setDragEnabled(index)} onChanged={load} onError={setError} /></div>)}</div>}
        </div>
      </section>
    </div>
  );
}

function CategoryRow({ category, budget, currency, onGrip, onChanged, onError }: {
  category: CategoryDTO;
  budget?: BudgetDTO;
  currency: string;
  onGrip: () => void;
  onChanged: () => Promise<void>;
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);

  async function saveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    try {
      const kind = String(data.get('kind'));
      await api.categories.update({ id: category.id, name: String(data.get('name')), kind });
      if (kind === 'INCOME' && budget) await api.budgets.remove(category.id);
      setEditing(false);
      await onChanged();
    } catch (err) { onError(message(err, 'Failed to update category.')); }
    finally { setPending(false); }
  }

  async function remove() {
    setPending(true);
    try { await api.categories.remove({ id: category.id }); setDeleting(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to delete category.')); }
    finally { setPending(false); }
  }

  async function saveBudget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = String(new FormData(e.currentTarget).get('amount'));
    setPending(true);
    try { await api.budgets.set({ categoryId: category.id, amount }); setEditingBudget(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to save budget.')); }
    finally { setPending(false); }
  }

  async function removeBudget() {
    setPending(true);
    try { await api.budgets.remove(category.id); setEditingBudget(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to remove budget.')); }
    finally { setPending(false); }
  }

  return (
    <div className="transition hover:bg-neutral-50">
      {editing ? <form onSubmit={saveCategory} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"><input name="name" defaultValue={category.name} required maxLength={40} autoFocus className="min-h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm" /><select name="kind" defaultValue={category.kind} className="min-h-11 rounded-xl border border-neutral-300 px-3 py-2 text-sm"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select><div className="flex gap-2"><button disabled={pending} className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white">Save</button><button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-lg px-3 text-sm text-neutral-500">Cancel</button></div>{budget && <p className="basis-full text-[11px] text-amber-600">Switching this to Income will clear its monthly budget.</p>}</form> : deleting ? <div className="flex flex-col gap-3 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-rose-700">Delete “{category.name}”?</p><p className="text-xs text-rose-600">Existing transactions will retain their history.</p></div><div className="flex gap-2"><button onClick={() => setDeleting(false)} className="min-h-11 rounded-lg px-3 text-sm text-neutral-600">Cancel</button><button disabled={pending} onClick={() => void remove()} className="min-h-11 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white">Delete</button></div></div> : <div className="flex items-center gap-2 px-2 py-2.5 sm:px-3"><button type="button" onMouseDown={onGrip} className="cursor-grab touch-none rounded-lg p-1.5 text-neutral-300 active:cursor-grabbing" title="Drag to reorder" aria-label={`Drag ${category.name} to reorder`}><GripIcon /></button><div className="min-w-0 flex-1 py-0.5 sm:flex sm:items-center sm:gap-2"><div className="flex min-w-0 items-center gap-2 sm:flex-1"><span className="min-w-0 flex-1 text-sm font-medium text-neutral-800 sm:truncate">{category.name}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${category.kind === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{category.kind === 'INCOME' ? 'Income' : 'Expense'}</span></div><div className="mt-1.5 flex min-h-8 items-center justify-between gap-2 sm:mt-0 sm:min-h-0 sm:shrink-0 sm:justify-end"><div className="min-w-0">{category.kind === 'EXPENSE' && <button type="button" onClick={() => setEditingBudget((value) => !value)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${budget ? 'border border-neutral-200 bg-neutral-100 tabular-nums text-neutral-600' : 'text-neutral-400 hover:text-emerald-600'}`}>{budget ? <>{formatMoney(budget.amount, currency)} <span className="text-neutral-400">/mo</span></> : '+ Set budget'}</button>}</div><div className="ml-auto flex shrink-0 items-center gap-0.5"><button type="button" onClick={() => { setEditing(true); setDeleting(false); }} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800" aria-label={`Rename ${category.name}`}><EditIcon /></button><button type="button" onClick={() => { setDeleting(true); setEditing(false); }} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600" aria-label={`Delete ${category.name}`}><TrashIcon /></button></div></div></div></div>}
      {editingBudget && category.kind === 'EXPENSE' && <form onSubmit={saveBudget} className="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3"><span className="text-xs font-medium text-neutral-400">{currency}</span><input key={budget?.id ?? 'none'} name="amount" inputMode="decimal" required autoFocus defaultValue={budget?.amount ?? ''} placeholder="0.00" className="min-h-11 min-w-0 flex-1 basis-32 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" /><button disabled={pending} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">Save</button>{budget && <button type="button" onClick={() => void removeBudget()} className="min-h-11 rounded-lg px-3 text-xs text-rose-600">Remove</button>}<button type="button" onClick={() => setEditingBudget(false)} className="min-h-11 rounded-lg px-2 text-xs text-neutral-500">Cancel</button></form>}
    </div>
  );
}

function EditIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.5 6.5 3 3" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>; }
function GripIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" /><circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /></svg>; }

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ThemeForm() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => { if (readStoredTheme() === 'system') applyTheme('system'); };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  function choose(next: Theme) { storeTheme(next); setTheme(next); }
  const descriptions: Record<Theme, string> = { system: 'Follow your device', light: 'Always use light', dark: 'Always use dark' };
  return <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Colour theme">{THEME_OPTIONS.map((option) => { const selected = theme === option.value; return <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => choose(option.value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${selected ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}>{option.icon}</span><span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-0.5 block text-xs opacity-70">{descriptions[option.value]}</span></span></button>; })}</div>;
}
