import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/settings', label: 'Settings' },
];

const MOBILE_ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
  wallet: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 5h3',
  activity: 'M4 7h11M4 7l3-3M4 7l3 3M20 17H9M20 17l-3-3M20 17l-3 3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.6 7.6 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5H9.2L8.8 6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h5.6l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.06-.32.1-.66.1-1Z',
} as const;

const MOBILE_LEFT = [
  { to: '/dashboard', label: 'Home', icon: MOBILE_ICONS.home },
  { to: '/accounts', label: 'Accounts', icon: MOBILE_ICONS.wallet },
];

const MOBILE_RIGHT = [
  { to: '/transactions', label: 'Activity', icon: MOBILE_ICONS.activity },
  { to: '/settings', label: 'Settings', icon: MOBILE_ICONS.settings },
];

/**
 * Authenticated application shell and responsive navigation.
 * Redirects to /sign-in when there is no session — the server still enforces
 * auth on every API call, so this is purely a navigation gate.
 */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Navigate to="/sign-in" replace />;

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const initial = (user.displayName ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900" aria-label="EntraSave home">
            <img src="/brand/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8 dark:hidden" />
            <img src="/brand/logo-mark-light.svg" alt="" width={32} height={32} className="hidden h-8 w-8 dark:block" />
            <span>Entra<span className="text-emerald-500">Save</span></span>
          </NavLink>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          </div>

          <div className="flex items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-11 w-11 touch-manipulation place-items-center overflow-hidden rounded-full border-2 border-white bg-emerald-100 text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-neutral-200 transition hover:ring-2 hover:ring-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-10 sm:w-10"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user.avatarUrl ? <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initial}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-md" role="menu">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-neutral-900">{user.displayName ?? 'Account'}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                    <NavLink to="/manage-account" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50" role="menuitem">Manage account</NavLink>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mobile-main mx-auto w-full min-w-0 max-w-5xl px-6 py-8">
        <Outlet />
      </main>

      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur sm:hidden" aria-label="Mobile navigation">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {MOBILE_LEFT.map((item) => <MobileNavItem key={item.to} {...item} />)}

          <div className="flex flex-1 justify-center">
            <NavLink
              to="/transactions?add=1"
              aria-label="Add transaction"
              className="-mt-6 flex h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white transition hover:bg-emerald-700 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-7 w-7" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </NavLink>
          </div>

          {MOBILE_RIGHT.map((item) => <MobileNavItem key={item.to} {...item} />)}
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 touch-manipulation flex-col items-center gap-0.5 py-2 text-[10px] ${
          isActive ? 'text-emerald-600' : 'text-neutral-500'
        }`
      }
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d={icon} />
      </svg>
      <span>{label}</span>
    </NavLink>
  );
}
