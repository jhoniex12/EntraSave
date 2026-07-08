import { Link } from 'react-router-dom';
import type { DashboardMonthDTO } from '@/lib/types';
import { formatMoney, SUPPORTED_CURRENCIES } from '@/lib/format';

/** Round a value up to a clean 1/2/2.5/5 × 10ⁿ step so gridline labels land on
 *  readable numbers. Feeding it roughly a quarter of the data max yields ~4
 *  evenly divided, readable ticks that keep the tallest bar near the top. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * pow;
}

/** Short axis label, e.g. A$6K / A$1.5M. */
function compact(value: number, symbol: string): string {
  if (value >= 1_000_000) return `${symbol}${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${symbol}${trim(value / 1_000)}K`;
  return `${symbol}${Math.round(value)}`;
}
function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

/** Grouped income-vs-expense bars across the current year, with a value axis and
 *  a per-month hover tooltip. Each column links to that month's transactions. */
export function IncomeExpenseChart({ months, currency, accountId = '', yearLabel, className = '' }: {
  months: DashboardMonthDTO[];
  currency: string;
  accountId?: string;
  yearLabel: number;
  className?: string;
}) {
  const symbol = SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$';
  const rawMax = Math.max(1, ...months.flatMap((m) => [Number(m.income), Number(m.expense)]));
  const step = niceStep(rawMax / 4);
  const axisMax = Math.ceil(rawMax / step) * step;
  const tickCount = Math.round(axisMax / step);
  // Top gridline first so array index maps directly to top-down position.
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => axisMax - i * step);

  return (
    <section className={`rounded-3xl border border-neutral-200/80 bg-white shadow-sm ${className}`}>
      <div className="flex items-end justify-between gap-3 rounded-t-3xl border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-emerald-50/40 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-neutral-800">Income vs expense</h3><p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:text-xs">Monthly totals across {yearLabel}.</p></div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] font-medium text-neutral-500 sm:text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Income</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Expense</span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex">
          {/* Value axis */}
          <div className="relative mr-2 hidden h-56 w-12 shrink-0 sm:block">
            {ticks.map((t, i) => (
              <span key={i} className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-neutral-400" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>{compact(t, symbol)}</span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* Plot area with gridlines behind the bars */}
            <div className="relative h-56">
              {ticks.map((_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-neutral-100" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end justify-between gap-1 sm:gap-2">
                {months.map((m) => {
                  const income = Number(m.income);
                  const expense = Number(m.expense);
                  const net = Number(m.net);
                  return (
                    <Link
                      key={m.key}
                      to={`/transactions?month=${m.key}${accountId ? `&account=${accountId}` : ''}`}
                      className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-1 rounded-lg outline-none hover:bg-neutral-50/70"
                      aria-label={`${m.label} ${yearLabel}: income ${formatMoney(m.income, currency)}, expense ${formatMoney(m.expense, currency)}`}
                    >
                      <div className="w-2.5 rounded-t-md bg-emerald-500 transition-all group-hover:brightness-105 sm:w-3.5" style={{ height: `${(income / axisMax) * 100}%` }} />
                      <div className="w-2.5 rounded-t-md bg-rose-400 transition-all group-hover:brightness-105 sm:w-3.5" style={{ height: `${(expense / axisMax) * 100}%` }} />
                      {/* Hover tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-44 -translate-x-1/2 rounded-xl bg-neutral-900 p-3 text-xs text-white shadow-xl sm:group-hover:block">
                        <p className="mb-2 font-semibold">{m.label} {yearLabel}</p>
                        <p className="flex justify-between gap-3"><span className="text-neutral-400">Income</span><span className="tabular-nums text-emerald-300">{formatMoney(m.income, currency)}</span></p>
                        <p className="flex justify-between gap-3"><span className="text-neutral-400">Expense</span><span className="tabular-nums text-rose-300">{formatMoney(m.expense, currency)}</span></p>
                        <p className="mt-1 flex justify-between gap-3 border-t border-neutral-700 pt-1"><span>Net</span><span className="tabular-nums">{net >= 0 ? '+' : ''}{formatMoney(m.net, currency)}</span></p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Month labels */}
            <div className="mt-2 flex justify-between gap-1 sm:gap-2">
              {months.map((m) => (
                <span key={m.key} className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-neutral-500">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
