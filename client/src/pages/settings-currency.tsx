import { useState } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { useAuth } from '@/auth/auth-context';
import { SettingsBackLink } from '@/pages/settings';

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

export function SettingsCurrencyPage() {
  const { user, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function updateCurrency(currency: string) {
    setPending(true);
    setError(null);
    try {
      await api.users.updateCurrency({ currency });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update currency.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <SettingsBackLink />
      <div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Base currency</h1><p className="mt-1 text-sm text-neutral-500">Used for dashboard and summary totals.</p></div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="p-5 sm:p-6">
        <select
          value={user?.baseCurrency ?? 'AUD'}
          disabled={pending}
          onChange={(event) => void updateCurrency(event.target.value)}
          className={`${inputClass} max-w-md`}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>{currency.code} — {currency.name} ({currency.symbol})</option>
          ))}
        </select>
      </div></section>
    </div>
  );
}
