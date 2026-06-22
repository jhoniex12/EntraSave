import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { AccountSummaryDTO } from '@/lib/types';
import { ACCOUNT_TYPES } from '@/lib/types';
import { accountTypeLabel, formatMoney, SUPPORTED_CURRENCIES } from '@/lib/format';
import { Modal } from '@/components/modal';
import { useAuth } from '@/auth/auth-context';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; account: AccountSummaryDTO }
  | { kind: 'delete'; account: AccountSummaryDTO }
  | null;

export function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  // Reordering uses Pointer Events (not the HTML5 drag API, which never fires on
  // touch screens) so it works with both a mouse and a finger.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const draggingIdRef = useRef<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const movedRef = useRef(false);

  async function load() {
    setError(null);
    try {
      setAccounts(await api.accounts.summary(true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function moveTo(clientY: number) {
    const draggingAccountId = draggingIdRef.current;
    if (!draggingAccountId) return;
    const order = orderRef.current;
    const fromIndex = order.indexOf(draggingAccountId);
    if (fromIndex === -1) return;
    // Insert before the first row whose vertical midpoint is below the pointer;
    // if the pointer is past every midpoint, drop at the end. Midpoint hit-testing
    // (rather than top/bottom bounds) removes dead zones and lets the dragged row
    // reach the very top or bottom.
    let targetIndex = order.length - 1;
    for (let i = 0; i < order.length; i++) {
      const el = rowRefs.current[order[i] as string];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { targetIndex = i; break; }
    }
    if (targetIndex === fromIndex) return;
    const next = [...order];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved as string);
    orderRef.current = next;
    movedRef.current = true;
    setAccounts((prev) => {
      const byId = new Map(prev.map((account) => [account.id, account]));
      return next.map((id) => byId.get(id)).filter((account): account is AccountSummaryDTO => Boolean(account));
    });
  }

  async function endDrag() {
    if (!draggingIdRef.current) return;
    draggingIdRef.current = null;
    setDraggingId(null);
    if (!movedRef.current) return;
    movedRef.current = false;
    try { await api.accounts.reorder(orderRef.current); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to reorder accounts.'); void load(); }
  }

  function gripProps(id: string): ComponentPropsWithoutRef<'button'> {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.preventDefault();
        draggingIdRef.current = id;
        movedRef.current = false;
        orderRef.current = accounts.map((account) => account.id);
        setDraggingId(id);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (draggingIdRef.current === id) moveTo(event.clientY);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        void endDrag();
      },
      onPointerCancel: () => void endDrag(),
    };
  }

  return (
    <div className="space-y-8 pb-10">
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Your money</p><h2 className="text-xl font-semibold tracking-tight text-neutral-900">Your accounts</h2><p className="mt-1 text-sm text-neutral-500">Edit starting balances, categories, names, or account status.</p></div><button onClick={() => setDialog({ kind: 'create' })} className="min-h-11 touch-manipulation rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">+ Add account</button></div>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-600">$</div><p className="mt-4 font-medium text-neutral-800">No accounts yet</p><p className="mt-1 text-sm text-neutral-500">Use the “Add account” button above to create your first one.</p></div>
      ) : (
        <>
        {accounts.length > 1 && <p className="mb-3 text-xs text-neutral-400">Drag the ⋮⋮ handle to reorder your accounts.</p>}
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li
              key={a.id}
              ref={(el) => { rowRefs.current[a.id] = el; }}
              className={draggingId === a.id ? 'relative z-10 opacity-70' : ''}
            >
              <AccountCard account={a} onEdit={() => setDialog({ kind: 'edit', account: a })} gripProps={gripProps(a.id)} dragging={draggingId === a.id} />
            </li>
          ))}
        </ul>
        </>
      )}
      </section>

      {dialog?.kind === 'create' && (
        <AccountForm title="New account" defaultCurrency={user?.baseCurrency ?? 'AUD'} isFirstAccount={accounts.length === 0} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />
      )}
      {dialog?.kind === 'edit' && (
        <AccountForm title="Edit account" account={dialog.account} onDelete={() => setDialog({ kind: 'delete', account: dialog.account })} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteAccount account={dialog.account} onClose={() => setDialog(null)} onDeleted={() => { setDialog(null); void load(); }} />
      )}
    </div>
  );
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

function AccountForm({ title, account, defaultCurrency = 'AUD', isFirstAccount = false, onDelete, onClose, onSaved }: {
  title: string;
  account?: AccountSummaryDTO;
  defaultCurrency?: string;
  /** Only the very first account lets the user pick the currency; that choice
   *  becomes the single base currency (Settings). Later accounts inherit it. */
  isFirstAccount?: boolean;
  onDelete?: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One key per open form so a retried create (double-click, refresh, timeout)
  // returns the original account instead of inserting a duplicate.
  const idempotencyKey = useRef('');
  if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    try {
      if (account) {
        await api.accounts.update({
          id: account.id,
          name: String(f.get('name')),
          type: String(f.get('type')),
          openingBalance: String(f.get('openingBalance')),
          isArchived: f.get('isArchived') === 'on',
        });
      } else {
        // Only the first account offers a currency choice; every other account
        // inherits the single base currency from Settings.
        const currency = isFirstAccount ? String(f.get('currency')) : defaultCurrency;
        await api.accounts.create({
          name: String(f.get('name')),
          type: String(f.get('type')),
          currency,
          openingBalance: String(f.get('openingBalance') || '0'),
          idempotencyKey: idempotencyKey.current,
        });
        // The first-account choice sets the base currency so Settings reflects it.
        if (isFirstAccount && currency !== defaultCurrency) {
          await api.users.updateCurrency({ currency });
          await refresh();
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={title} subtitle={account ? `${account.type} · ${account.currency}` : 'Add a place where your money lives'} size="lg" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-neutral-700">
          Account name
          <input name="name" required maxLength={80} autoFocus defaultValue={account?.name} className="mt-1.5 min-h-12 w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Account category
          <select name="type" defaultValue={account?.type ?? 'SAVINGS'} className="mt-1.5 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{accountTypeLabel(t)}</option>)}
          </select>
        </label>
        {!account && isFirstAccount && (
          <label className="block text-sm font-medium text-neutral-700">
            Currency
            <select name="currency" defaultValue={defaultCurrency} className="mt-1.5 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
              {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
            <span className="mt-1.5 block text-xs font-normal text-neutral-400">This sets your currency for EntraSave. You can change it later in Settings.</span>
          </label>
        )}
        <label className="block text-sm font-medium text-neutral-700">
          Starting balance
          <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-neutral-300 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
            <span className="pr-2 text-sm font-semibold text-neutral-400">{account?.currency ?? defaultCurrency}</span>
            <input name="openingBalance" inputMode="decimal" defaultValue={account?.balance ?? '0'} className="min-w-0 flex-1 bg-transparent py-2.5 outline-none" />
          </span>
          <span className="mt-1.5 block text-xs font-normal text-neutral-400">The balance before any recorded transactions are applied.</span>
        </label>
        {account && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700">
            <input type="checkbox" name="isArchived" defaultChecked={account.isArchived} className="mt-0.5 h-4 w-4 rounded border-neutral-300" />
            <span><span className="block font-medium">Archive account</span><span className="mt-0.5 block text-xs font-normal text-neutral-400">Hide it from active account lists without deleting its transactions.</span></span>
          </label>
        )}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {account && onDelete ? <button type="button" onClick={onDelete} className="min-h-11 self-start rounded-lg px-0 text-sm font-medium text-rose-600 hover:text-rose-700">Delete account</button> : <span />}
          <div className="flex gap-3 sm:ml-auto"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 sm:flex-none">Cancel</button><button disabled={pending} className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none">{pending ? 'Saving…' : account ? 'Save changes' : 'Add account'}</button></div>
        </div>
      </form>
    </Modal>
  );
}

function AccountCard({ account: a, onEdit, gripProps, dragging }: { account: AccountSummaryDTO; onEdit: () => void; gripProps: ComponentPropsWithoutRef<'button'>; dragging: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${dragging ? 'border-emerald-300 shadow-lg' : 'border-neutral-200/80 hover:border-emerald-200 hover:shadow-md'}`}>
      <div className="flex items-center">
        <button type="button" {...gripProps} className="flex shrink-0 cursor-grab touch-none select-none items-center self-stretch rounded-l-2xl pl-2.5 pr-1 text-neutral-300 hover:text-neutral-500 active:cursor-grabbing" title="Drag to reorder" aria-label={`Drag ${a.name} to reorder`}><GripIcon /></button>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2.5 py-3.5 pl-1 pr-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xs font-bold text-emerald-700">{accountInitials(a.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-neutral-800">{a.name}</span>
            <span className="mt-0.5 block truncate text-xs text-neutral-400">{accountTypeLabel(a.type)}{a.isArchived ? ' · Archived' : ''}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap text-right">
            <span className="block text-sm font-semibold tabular-nums text-neutral-900">{formatMoney(a.currentBalance, a.currency)}</span>
            <span className="block text-[10px] uppercase tracking-wide text-neutral-400">Current</span>
          </span>
          <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-neutral-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-neutral-100 p-4">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-3"><AccountMetric label="Starting balance" value={formatMoney(a.balance, a.currency)} /><span className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-500">{a.currency}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-200/70 pt-4"><AccountMetric label="Current balance" value={formatMoney(a.currentBalance, a.currency)} /><AccountMetric label="Net this month" value={formatMoney(a.netThisMonth, a.currency)} tone={Number(a.netThisMonth) >= 0 ? 'positive' : 'negative'} /><AccountMetric label="Income this month" value={formatMoney(a.incomeThisMonth, a.currency)} tone="positive" /><AccountMetric label="Expenses this month" value={formatMoney(a.expenseThisMonth, a.currency)} tone="negative" /></div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${a.isArchived ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{a.isArchived ? 'Archived' : 'Active'}</span>
            <button onClick={onEdit} className="min-h-11 touch-manipulation rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100">✎ Edit account</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GripIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" /><circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /></svg>; }

function AccountMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-500' : 'text-neutral-900';
  return <div className="min-w-0"><p className="text-[11px] font-medium text-neutral-400">{label}</p><p className={`mt-1 truncate text-sm font-semibold tracking-tight tabular-nums ${color}`} title={value}>{value}</p></div>;
}

function accountInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'A';
}

function DeleteAccount({ account, onClose, onDeleted }: {
  account: AccountSummaryDTO;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setError(null);
    setPending(true);
    try {
      await api.accounts.remove({ id: account.id, confirmation });
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Delete account" onClose={onClose}>
      <p className="text-sm text-neutral-600">
        This soft-deletes <strong>{account.name}</strong> and its transactions. Type the account
        name to confirm.
      </p>
      <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={account.name} maxLength={80} className={`${inputClass} mt-3`} />
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button disabled={pending || confirmation !== account.name} onClick={onDelete} className="mt-4 w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
        {pending ? 'Deleting…' : 'Delete account'}
      </button>
    </Modal>
  );
}
