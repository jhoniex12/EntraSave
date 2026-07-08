import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@/lib/format';

type CategoryItem = { categoryId: string | null; type: 'INCOME' | 'EXPENSE'; amount: string };

/** CVD-validated categorical hues (dataviz reference palette), assigned to slices
 *  in order so every slice is a visibly distinct color from its neighbours. */
const SLICE_HUES = ['#2a78d6', '#1baf7a', '#eda100', '#e34948', '#4a3aa7', '#eb6834', '#e87ba4', '#008300'];
const OTHER_HUE = '#94a3b8';
const MAX_SLICES = 6;

/** Donut of expense spending by category with a labelled legend. Money in is
 *  ignored here; this answers "where did the money go?". */
export function SpendingOverview({ items, names, currency, periodLabel = 'month', className = '' }: {
  items: CategoryItem[];
  names: Map<string, string>;
  currency: string;
  periodLabel?: 'month' | 'year';
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  const expenses = items
    .filter((item) => item.type === 'EXPENSE' && Number(item.amount) > 0)
    .map((item) => ({
      id: item.categoryId ?? 'none',
      name: item.categoryId ? names.get(item.categoryId) ?? 'Deleted category' : 'No category',
      amount: Number(item.amount),
      to: item.categoryId ? `/transactions?category=${item.categoryId}${periodLabel === 'year' ? '&period=year' : ''}` : null,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Fold everything past the top slices into a single neutral "Other" slice so
  // the donut stays legible no matter how many categories exist, then give each
  // remaining slice its own hue in order (Other keeps the neutral gray).
  const grouped = expenses.length > MAX_SLICES + 1
    ? [
        ...expenses.slice(0, MAX_SLICES),
        {
          id: '__other__',
          name: `Other (${expenses.length - MAX_SLICES})`,
          amount: expenses.slice(MAX_SLICES).reduce((sum, e) => sum + e.amount, 0),
          to: null,
        },
      ]
    : expenses;
  const slices = grouped.map((slice, i) => ({
    ...slice,
    color: slice.id === '__other__' ? OTHER_HUE : SLICE_HUES[i % SLICE_HUES.length] ?? OTHER_HUE,
  }));

  const total = slices.reduce((sum, s) => sum + s.amount, 0);

  const header = (
    <div className="flex items-end justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-emerald-50/40 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0"><h3 className="text-sm font-semibold text-neutral-800">Spending overview</h3><p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:text-xs">Where your money went this {periodLabel}.</p></div>
      <Link to="/transactions" className="shrink-0 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline sm:text-xs">View all →</Link>
    </div>
  );

  if (slices.length === 0) {
    return (
      <section className={`overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
        {header}
        <p className="px-4 py-10 text-center text-sm text-neutral-400">No expenses this {periodLabel}.</p>
      </section>
    );
  }

  // Donut geometry. A single SVG circle per slice, each drawn as one dash arc and
  // rotated into place; a small dash gap leaves a surface-colored seam between
  // slices. The whole ring is rotated -90° so it starts at 12 o'clock.
  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 2.5 : 0;
  let offset = 0;
  const arcs = slices.map((slice) => {
    const frac = slice.amount / total;
    const len = Math.max(frac * C - GAP, 0.5);
    const arc = { ...slice, frac, len, dashOffset: -offset };
    offset += frac * C;
    return arc;
  });

  const focused = active ? arcs.find((a) => a.id === active) ?? null : null;
  const centerAmount = focused ? focused.amount : total;
  const centerLabel = focused ? focused.name : 'Total expenses';
  const centerPct = focused ? ` · ${((focused.amount / total) * 100).toFixed(1)}%` : '';

  return (
    <section className={`overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
      {header}
      <div className="flex flex-col items-center gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="relative shrink-0" onMouseLeave={() => setActive(null)}>
          <svg viewBox="0 0 120 120" className="h-40 w-40 sm:h-44 sm:w-44" role="img" aria-label={`Expenses by category, total ${formatMoney(total.toFixed(2), currency)}`}>
            <g transform="rotate(-90 60 60)">
              {arcs.map((arc) => (
                <circle
                  key={arc.id}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={active && active !== arc.id ? 12 : 15}
                  strokeDasharray={`${arc.len} ${C - arc.len}`}
                  strokeDashoffset={arc.dashOffset}
                  className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                  opacity={active && active !== arc.id ? 0.35 : 1}
                  onMouseEnter={() => setActive(arc.id)}
                >
                  <title>{arc.name}: {formatMoney(arc.amount.toFixed(2), currency)} ({((arc.amount / total) * 100).toFixed(1)}%)</title>
                </circle>
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="max-w-full truncate text-lg font-semibold tabular-nums text-neutral-900 sm:text-xl">{formatMoney(centerAmount.toFixed(2), currency)}</span>
            <span className="mt-0.5 max-w-full truncate text-[11px] text-neutral-400">{centerLabel}{centerPct}</span>
          </div>
        </div>

        <ul className="w-full min-w-0 space-y-1">
          {arcs.map((arc) => {
            const pct = ((arc.amount / total) * 100).toFixed(1);
            const row = (
              <span className="flex w-full items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-700">{arc.name}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">{formatMoney(arc.amount.toFixed(2), currency)}</span>
                <span className="w-11 shrink-0 text-right text-xs tabular-nums text-neutral-400">{pct}%</span>
              </span>
            );
            const base = `flex items-center rounded-lg px-2 py-1.5 transition ${active === arc.id ? 'bg-neutral-50' : ''}`;
            return (
              <li key={arc.id} onMouseEnter={() => setActive(arc.id)} onMouseLeave={() => setActive(null)}>
                {arc.to
                  ? <Link to={arc.to} className={`${base} hover:bg-neutral-50`}>{row}</Link>
                  : <div className={base}>{row}</div>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
