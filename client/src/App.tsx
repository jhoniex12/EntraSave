import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { AppLayout } from '@/components/app-layout';
import { LandingPage } from '@/pages/landing';
import { SignInPage } from '@/pages/sign-in';
import { SignUpPage } from '@/pages/sign-up';
import { DashboardPage } from '@/pages/dashboard';
import { AccountsPage } from '@/pages/accounts';
import { SettingsPage } from '@/pages/settings';
import { ManageAccountPage } from '@/pages/manage-account';
import { TransactionsPage } from '@/pages/transactions';
import { PrivacyPage } from '@/pages/privacy';
import { TermsPage } from '@/pages/terms';
import { CookiesPage } from '@/pages/cookies';
import { DataDeletionPage } from '@/pages/data-deletion';

/**
 * Route table. Public routes are reachable signed-out; everything under
 * <AppLayout> requires a session (the layout redirects to /sign-in otherwise).
 * The API independently enforces auth on every request — this is only a UX gate
 * (mirrors the "middleware is a coarse navigation gate" rule, SECURITY.md §2).
 */
export function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />

      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/data-deletion" element={<DataDeletionPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/manage-account" element={<ManageAccountPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
