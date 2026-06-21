import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared EntraSave chrome for legal pages, using the public brand assets and
 * React Router links.
 */
export const LEGAL_UPDATED = '20 June 2026';

export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-6">
          <Link to="/" aria-label="EntraSave home" className="flex items-center gap-2">
            <img src="/brand/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8 dark:hidden" />
            <img src="/brand/logo-mark-light.svg" alt="" width={32} height={32} className="hidden h-8 w-8 dark:block" />
            <span className="text-lg font-semibold tracking-tight">Entra<span className="text-emerald-600">Save</span></span>
          </Link>
          <Link to="/" className="text-sm font-medium text-neutral-600 hover:text-emerald-700">Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600 sm:text-base">{summary}</p>
          <p className="mt-3 text-xs text-neutral-400">Last updated: {LEGAL_UPDATED}</p>
          <div className="mt-10 space-y-8 text-sm leading-7 text-neutral-700 sm:text-base">{children}</div>
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <nav className="mx-auto flex max-w-4xl flex-wrap gap-x-5 gap-y-2 px-5 py-6 text-sm text-neutral-500 sm:px-6" aria-label="Legal">
          <Link to="/privacy" className="hover:text-emerald-700">Privacy</Link>
          <Link to="/terms" className="hover:text-emerald-700">Terms</Link>
          <Link to="/cookies" className="hover:text-emerald-700">Cookies</Link>
          <Link to="/data-deletion" className="hover:text-emerald-700">Data deletion</Link>
        </nav>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900 sm:text-xl">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5 marker:text-emerald-600">{children}</ul>;
}
