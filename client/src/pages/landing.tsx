import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { ThemeSelector } from '@/components/theme-selector';

/**
 * Public EntraSave marketing landing page.
 * Presentation only: no business logic, no data access. Signed-in state comes
 * from the session context (`/me`); Next's `next/link` / `next/image` become
 * react-router `Link` + inline SVG, and the server `readSessionCookie` becomes
 * the `useAuth` hook.
 */
const features = [
  {
    title: 'Accounts & balances',
    description:
      'Track checking, savings, cash, cards and investments — each with its own currency and starting balance.',
    icon: <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 5h3" />,
  },
  {
    title: 'Monthly overview',
    description:
      'See each month’s starting balance, income, expenses and running total — page back through your history.',
    icon: <path d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" />,
  },
  {
    title: 'Budgets & alerts',
    description:
      'Set monthly category budgets and get flagged the moment you’re near — or over — your limit.',
    icon: <path d="M12 3v18m0-18a9 9 0 1 0 9 9h-9" />,
  },
  {
    title: 'Smart categories',
    description:
      'Organise spending with custom categories you can rename, reorder by drag-and-drop, and budget.',
    icon: <path d="M4 7h16M4 12h10M4 17h7" />,
  },
  {
    title: 'Multi-currency',
    description:
      'Record in AUD, USD, PHP and more. Every account keeps its own currency; pick your display default.',
    icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.4 2.5 13.6 0 18M12 3c-2.5 2.4-2.5 13.6 0 18" />,
  },
  {
    title: 'Private & secure',
    description:
      'Per-user isolation, encrypted at rest, and a full audit trail. Your financial data is only ever yours.',
    icon: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm0 7v4m-2-2h4" />,
  },
];

const steps = [
  { title: 'Add your accounts', description: 'Tell EntraSave where your money lives and the balance each one started with.' },
  { title: 'Record transactions', description: 'Log income and expenses, tagged by category, in seconds — on desktop or mobile.' },
  { title: 'See the full picture', description: 'Monthly overviews, budgets and category trends keep you on track all year.' },
];

const budgetRows: Array<{ name: string; spent: string; budget: string; pct: number; status: 'SAFE' | 'NEAR' | 'OVER' }> = [
  { name: 'Groceries', spent: 'A$445.56', budget: 'A$400.00', pct: 111, status: 'OVER' },
  { name: 'Transportation', spent: 'A$338.00', budget: 'A$400.00', pct: 85, status: 'NEAR' },
  { name: 'Eat Out', spent: 'A$212.40', budget: 'A$300.00', pct: 71, status: 'SAFE' },
  { name: 'House Bills', spent: 'A$181.00', budget: 'A$260.00', pct: 70, status: 'SAFE' },
];

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      {children}
    </svg>
  );
}

function Logo() {
  return (
    <Link to="/" aria-label="EntraSave home" className="flex items-center gap-2">
      <img src="/brand/logo-mark.svg" alt="" width={36} height={36} className="h-9 w-9 dark:hidden" />
      <img src="/brand/logo-mark-light.svg" alt="" width={36} height={36} className="hidden h-9 w-9 dark:block" />
      <span className="text-xl font-semibold tracking-tight">
        <span className="text-slate-900 dark:text-white">Entra</span>
        <span className="text-emerald-500">Save</span>
      </span>
    </Link>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
    >
      Sign out
    </button>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const signedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-neutral-600 md:flex">
            <a href="#how" className="hover:text-neutral-900">How it works</a>
            <a href="#budgets" className="hover:text-neutral-900">Budgets</a>
            <a href="#features" className="hover:text-neutral-900">Features</a>
            <a href="#security" className="hover:text-neutral-900">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSelector />
            {signedIn ? (
              <>
                <Link to="/dashboard" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">Dashboard</Link>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link to="/sign-in" className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900">Sign in</Link>
                <Link to="/sign-up" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-gradient-to-b from-emerald-100/70 via-white to-white blur-2xl dark:from-emerald-950/30" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Private by design
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl">
            Save Smarter.
            <span className="text-emerald-600"> Live Better.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            EntraSave is a private, secure tracker for your accounts, budgets and goals.
            See exactly where your money goes — without spreadsheets.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {signedIn ? (
              <Link to="/dashboard" className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md sm:w-auto">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link to="/sign-up" className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md sm:w-auto">
                  Start tracking — free
                </Link>
                <a href="#how" className="w-full rounded-lg border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto">
                  See how it works
                </a>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-neutral-400">No credit card required.</p>

          {/* Hero preview card */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl shadow-neutral-200/60">
              <div className="rounded-xl bg-neutral-50 p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-800">June 2026 overview</p>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">+ A$2,292 this month</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Current balance', value: 'A$26,824', tone: 'text-neutral-900' },
                    { label: 'Income', value: 'A$3,780', tone: 'text-emerald-600' },
                    { label: 'Expenses', value: 'A$1,488', tone: 'text-rose-500' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-neutral-200 bg-white p-4 text-left">
                      <p className="text-xs text-neutral-500">{stat.label}</p>
                      <p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Income</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Expenses</span>
                  </div>
                  <div className="flex items-end gap-3">
                    {[
                      { m: 'Jan', a: 70, b: 40 },
                      { m: 'Feb', a: 85, b: 55 },
                      { m: 'Mar', a: 60, b: 48 },
                      { m: 'Apr', a: 95, b: 62 },
                      { m: 'May', a: 78, b: 50 },
                      { m: 'Jun', a: 90, b: 38 },
                    ].map((d) => (
                      <div key={d.m} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-28 w-full items-end justify-center gap-1">
                          <div className="w-2.5 rounded-t bg-emerald-500 sm:w-3" style={{ height: `${d.a}%` }} />
                          <div className="w-2.5 rounded-t bg-rose-400 sm:w-3" style={{ height: `${d.b}%` }} />
                        </div>
                        <span className="text-[11px] text-neutral-400">{d.m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-neutral-200/70 bg-neutral-50/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5 text-xs font-medium text-neutral-500">
          {['Multi-currency (AUD · USD · PHP +)', 'Monthly budgets & alerts', 'Per-user isolation', 'Light & dark mode', 'Works great on mobile'].map((item) => (
            <span key={item} className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold text-emerald-600">How it works</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Set up in minutes, stay on top all year</h2>
          <p className="mt-4 text-neutral-600">Three steps from spreadsheet chaos to a clear, private view of your money.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-neutral-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-5 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Budgets by category showcase */}
      <section id="budgets" className="border-t border-neutral-200/70 bg-neutral-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Visual */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800">Budget by category</p>
                <span className="text-xs text-neutral-400">June 2026</span>
              </div>
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <strong>Groceries is over budget.</strong> A$445.56 of A$400.00 used (111%).
              </div>
              <div className="space-y-4">
                {budgetRows.map((b) => {
                  const bar = b.status === 'OVER' ? 'bg-rose-500' : b.status === 'NEAR' ? 'bg-amber-500' : 'bg-emerald-500';
                  const badge =
                    b.status === 'OVER'
                      ? 'bg-rose-100 text-rose-700'
                      : b.status === 'NEAR'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700';
                  return (
                    <div key={b.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-neutral-700">{b.name}</span>
                        <span className="flex items-center gap-2 tabular-nums text-neutral-500">
                          <span className="text-xs">{b.spent} / {b.budget}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>{b.pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Copy */}
            <div>
              <span className="text-sm font-semibold text-emerald-600">Budgets &amp; alerts</span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">A budget for every category</h2>
              <p className="mt-4 text-neutral-600">
                Set a monthly limit on any spending category and watch usage fill up as you go. EntraSave flags a category the moment it gets close — and again when it tips over — so nothing sneaks up on you.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                {[
                  'Set a monthly budget on any expense category',
                  'Near-limit and over-budget alerts, right where you spend',
                  'Live usage percentage at a glance',
                  'Budgets carry forward to every new month',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 flex-none text-emerald-600" aria-hidden="true">
                      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-neutral-200/70 bg-neutral-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-emerald-600">Features</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Everything you need, nothing you don&apos;t</h2>
            <p className="mt-4 text-neutral-600">Purpose-built for personal finance — fast, focused and yours alone.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:scale-105">
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                </div>
                <h3 className="mt-5 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-emerald-600">Security first</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your data, locked down by default</h2>
            <p className="mt-4 text-neutral-600">
              Built on a security-first architecture: every record is isolated to its owner, encrypted in transit and at rest, and every change is recorded in a tamper-resistant audit log.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-neutral-700">
              {[
                'Per-user data isolation — you only ever see your own data',
                'Secure self-managed sessions with direct Google and Facebook sign-in options',
                'Full audit trail of every create, update and delete',
                'Financial values never written to application logs',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 flex-none text-emerald-600" aria-hidden="true">
                    <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                  <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
                </svg>
              </span>
              <p className="font-semibold">Designed to OWASP best practices</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-300">
              Server-side authorization on every action, validated input end-to-end, and protection against the most common web vulnerabilities — so you can focus on your money, not the plumbing.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-200/70 bg-neutral-50/60">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Start understanding your money today</h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-600">It takes a minute to set up your first account. Your data stays private — always.</p>
          <div className="mt-8 flex justify-center">
            {signedIn ? (
              <Link to="/dashboard" className="rounded-lg bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md">
                Open your dashboard
              </Link>
            ) : (
              <Link to="/sign-up" className="rounded-lg bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md">
                Create your free account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-neutral-500">Save Smarter. Live Better.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
            <a href="#how" className="hover:text-neutral-900">How it works</a>
            <a href="#budgets" className="hover:text-neutral-900">Budgets</a>
            <a href="#features" className="hover:text-neutral-900">Features</a>
            <a href="#security" className="hover:text-neutral-900">Security</a>
            <Link to="/privacy" className="hover:text-neutral-900">Privacy</Link>
            <Link to="/terms" className="hover:text-neutral-900">Terms</Link>
            <Link to="/cookies" className="hover:text-neutral-900">Cookies</Link>
            <Link to="/data-deletion" className="hover:text-neutral-900">Data deletion</Link>
          </nav>
        </div>
        <div className="border-t border-neutral-200/70">
          <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} EntraSave. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
