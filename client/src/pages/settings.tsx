import { Link } from 'react-router-dom';

const SETTINGS_ITEMS = [
  {
    to: '/settings/currency',
    label: 'Display preference',
    description: 'Base currency for dashboard and summary totals.',
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5M12 6v1.5M12 16.5V18" /></svg>,
  },
  {
    to: '/settings/appearance',
    label: 'Appearance',
    description: 'Choose a colour theme for EntraSave.',
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11.5" r="1" fill="currentColor" /><circle cx="12" cy="8" r="1" fill="currentColor" /><circle cx="16.5" cy="11.5" r="1" fill="currentColor" /></svg>,
  },
  {
    to: '/settings/categories',
    label: 'Category Settings',
    description: 'Add, rename, and reorder your categories.',
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h12" /></svg>,
  },
  {
    to: '/settings/budget',
    label: 'Budget',
    description: 'Set a monthly spending limit per category.',
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" /><path d="M12 12V3a9 9 0 0 1 9 9h-9Z" /></svg>,
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Settings</h1>

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
        <ul className="divide-y divide-neutral-100">
          {SETTINGS_ITEMS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center gap-4 px-4 py-4 transition hover:bg-neutral-50 sm:px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-800">{item.label}</span>
                  <span className="block truncate text-xs text-neutral-400 sm:text-sm">{item.description}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-300" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Shared "back to Settings" link used by every settings sub-page. */
export function SettingsBackLink() {
  return (
    <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
      Settings
    </Link>
  );
}
