import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { CategoryDTO } from '@/lib/types';
import { Modal } from '@/components/modal';
import { SettingsBackLink } from '@/pages/settings';

export function SettingsCategoriesPage() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Reordering uses Pointer Events (not the HTML5 drag API, which never fires on
  // touch screens) so it works with both a mouse and a finger.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const draggingIdRef = useRef<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const movedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCategories(await api.categories.list());
    } catch (err) {
      setError(message(err, 'Failed to load categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function moveTo(clientY: number) {
    const draggingCategoryId = draggingIdRef.current;
    if (!draggingCategoryId) return;
    const order = orderRef.current;
    const fromIndex = order.indexOf(draggingCategoryId);
    if (fromIndex === -1) return;
    // Insert before the first row whose vertical midpoint is below the pointer;
    // if past every midpoint, drop at the end. Midpoint hit-testing removes dead
    // zones and lets the dragged row reach the very top or bottom.
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
    setCategories((prev) => {
      const byId = new Map(prev.map((category) => [category.id, category]));
      return next.map((id) => byId.get(id)).filter((category): category is CategoryDTO => Boolean(category));
    });
  }

  async function endDrag() {
    if (!draggingIdRef.current) return;
    draggingIdRef.current = null;
    setDraggingId(null);
    if (!movedRef.current) return;
    movedRef.current = false;
    try { await api.categories.reorder(orderRef.current); }
    catch (err) { setError(message(err, 'Failed to reorder categories.')); await load(); }
  }

  function gripProps(id: string): ComponentPropsWithoutRef<'button'> {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.preventDefault();
        draggingIdRef.current = id;
        movedRef.current = false;
        orderRef.current = categories.map((category) => category.id);
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

  return (
    <div className="space-y-6 pb-10">
      <SettingsBackLink />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Categories</h1><p className="mt-1 text-sm text-neutral-500">Add, rename, remove, sort, or drag categories into the order that works for you.</p></div>
        <button onClick={() => setAdding(true)} className="min-h-11 shrink-0 touch-manipulation rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">+ Add category</button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500"><span className="font-medium text-neutral-600">Sort:</span><button onClick={() => void sort('az')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">A–Z</button><button onClick={() => void sort('za')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">Z–A</button><button onClick={() => void sort('type')} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-600 shadow-sm hover:bg-neutral-50">Type</button><span className="ml-auto hidden text-neutral-400 sm:inline">or drag the ⋮⋮ handle</span></div>
        {loading ? <p className="mt-5 text-sm text-neutral-500">Loading…</p> : <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">{categories.map((category) => <div key={category.id} ref={(el) => { rowRefs.current[category.id] = el; }} className={`border-b border-neutral-100 last:border-b-0 ${draggingId === category.id ? 'relative z-10 opacity-70' : ''}`}><CategoryRow category={category} gripProps={gripProps(category.id)} onChanged={load} onError={setError} /></div>)}</div>}
      </div></section>

      {adding && <AddCategoryForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function AddCategoryForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api.categories.create({ name: String(data.get('name')), kind: String(data.get('kind')) });
      onSaved();
    } catch (err) {
      setError(message(err, 'Failed to add category.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="New category" subtitle="Group your transactions for clearer summaries." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-neutral-700">Category name<input name="name" required maxLength={40} autoFocus placeholder="e.g. Groceries" className={inputClass} /></label>
        <label className="block text-sm font-medium text-neutral-700">Type<select name="kind" defaultValue="EXPENSE" className={inputClass}><option value="EXPENSE">Expense · money out</option><option value="INCOME">Income · money in</option></select></label>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
          <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? 'Adding…' : 'Add category'}</button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

function CategoryRow({ category, gripProps, onChanged, onError }: {
  category: CategoryDTO;
  gripProps: ComponentPropsWithoutRef<'button'>;
  onChanged: () => Promise<void>;
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try { await api.categories.remove({ id: category.id }); setDeleting(false); await onChanged(); }
    catch (err) { onError(message(err, 'Failed to delete category.')); }
    finally { setPending(false); }
  }

  return (
    <div className="transition hover:bg-neutral-50">
      {deleting ? <div className="flex flex-col gap-3 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-rose-700">Delete “{category.name}”?</p><p className="text-xs text-rose-600">Existing transactions will retain their history.</p></div><div className="flex gap-2"><button onClick={() => setDeleting(false)} className="min-h-11 rounded-lg px-3 text-sm text-neutral-600">Cancel</button><button disabled={pending} onClick={() => void remove()} className="min-h-11 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white">Delete</button></div></div> : <div className="flex items-center gap-2 px-2 py-2.5 sm:px-3"><button type="button" {...gripProps} className="cursor-grab touch-none select-none rounded-lg p-1.5 text-neutral-300 hover:text-neutral-500 active:cursor-grabbing" title="Drag to reorder" aria-label={`Drag ${category.name} to reorder`}><GripIcon /></button><div className="flex min-w-0 flex-1 items-center gap-2 py-0.5"><span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">{category.name}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${category.kind === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{category.kind === 'INCOME' ? 'Income' : 'Expense'}</span><div className="ml-auto flex shrink-0 items-center gap-0.5"><button type="button" onClick={() => setEditing(true)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800" aria-label={`Rename ${category.name}`}><EditIcon /></button><button type="button" onClick={() => { setDeleting(true); setEditing(false); }} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600" aria-label={`Delete ${category.name}`}><TrashIcon /></button></div></div></div>}
      {editing && <EditCategoryForm category={category} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void onChanged(); }} />}
    </div>
  );
}

function EditCategoryForm({ category, onClose, onSaved }: { category: CategoryDTO; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api.categories.update({ id: category.id, name: String(data.get('name')), kind: String(data.get('kind')) });
      onSaved();
    } catch (err) {
      setError(message(err, 'Failed to update category.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Edit category" subtitle="Rename it or change whether it tracks income or expense." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-neutral-700">Category name<input name="name" defaultValue={category.name} required maxLength={40} autoFocus className={inputClass} /></label>
        <label className="block text-sm font-medium text-neutral-700">Type<select name="kind" defaultValue={category.kind} className={inputClass}><option value="EXPENSE">Expense · money out</option><option value="INCOME">Income · money in</option></select></label>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
          <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.5 6.5 3 3" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>; }
function GripIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" /><circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /></svg>; }

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
