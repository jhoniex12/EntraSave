import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/auth/auth-context';
import { ProviderIcon } from '@/components/provider-icon';

/**
 * Credential and OAuth entry form. On
 * success the API sets the HttpOnly session cookie; we then refresh `/me` and
 * navigate. OAuth uses a server-generated start URL — no provider SDK in the
 * browser, no auth state in local storage (SECURITY.md §2).
 */
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const returnTo = safeReturnTo(params.get('returnTo'));
  const [error, setError] = useState<string | null>(oauthErrorMessage(params.get('error')));
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState({ googleEnabled: false, facebookEnabled: false });

  const strength = passwordStrength(password);

  useEffect(() => {
    api.auth.providers().then(setProviders).catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const displayName = String(form.get('displayName') ?? '') || undefined;
    try {
      if (mode === 'sign-in') await api.auth.signIn({ email, password });
      else await api.auth.signUp({ email, password, displayName });
      await refresh();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const otherMode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
  const otherLabel = mode === 'sign-in' ? 'Create an account' : 'Already have an account?';

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-semibold text-neutral-900">
        {mode === 'sign-in' ? 'Sign in to EntraSave' : 'Create your EntraSave account'}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {mode === 'sign-in' ? 'Access your private finance dashboard.' : 'Start tracking your finances securely.'}
      </p>

      <div className="mt-6 grid gap-3">
        <OAuthLink provider="google" enabled={providers.googleEnabled} returnTo={returnTo} />
        <OAuthLink provider="facebook" enabled={providers.facebookEnabled} returnTo={returnTo} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />or use email<span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'sign-up' && (
          <label className="block text-sm font-medium text-neutral-700">
            Display name
            <input name="displayName" autoComplete="name" maxLength={100} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
        )}
        <label className="block text-sm font-medium text-neutral-700">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Password
          <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          {mode === 'sign-up' && (
            password
              ? <PasswordStrengthMeter strength={strength} />
              : <span className="mt-1 block text-xs font-normal text-neutral-400">At least 8 characters, with an uppercase letter, a number, and a special character.</span>
          )}
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <Link to={`/${otherMode}?returnTo=${encodeURIComponent(returnTo)}`} className="mt-5 block text-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
        {otherLabel}
      </Link>
    </div>
  );
}

function OAuthLink({ provider, enabled, returnTo }: { provider: 'google' | 'facebook'; enabled: boolean; returnTo: string }) {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Facebook';
  if (!enabled) {
    return (
      <span className="flex cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-neutral-200 px-4 py-2.5 text-center text-sm text-neutral-400" title="Provider is not configured">
        <ProviderIcon provider={provider} />{label}
      </span>
    );
  }
  // Full-page navigation to the API's OAuth start endpoint (server-generated URL).
  return (
    <a href={`/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`} className="flex items-center justify-center gap-2.5 rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50">
      <ProviderIcon provider={provider} />{label}
    </a>
  );
}

type Strength = { score: number; label: string; barClass: string; textClass: string };

/**
 * Scores a candidate password against the sign-up policy enforced server-side
 * (StrongPasswordSchema): 8+ chars plus uppercase, lowercase, number, and a
 * special character. Extra length adds bonus points so a fully compliant
 * long password reads as "Strong".
 */
function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: '', barClass: '', textClass: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 16) score++;

  if (score <= 2) return { score, label: 'Weak', barClass: 'bg-rose-500', textClass: 'text-rose-600' };
  if (score <= 4) return { score, label: 'Fair', barClass: 'bg-amber-500', textClass: 'text-amber-600' };
  if (score === 5) return { score, label: 'Good', barClass: 'bg-lime-500', textClass: 'text-lime-600' };
  return { score, label: 'Strong', barClass: 'bg-emerald-600', textClass: 'text-emerald-700' };
}

function PasswordStrengthMeter({ strength }: { strength: Strength }) {
  const segments = 6;
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.barClass : 'bg-neutral-200'}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${strength.textClass}`} aria-live="polite">
        Password strength: {strength.label}
      </p>
    </div>
  );
}

function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === 'provider_unavailable') return 'That login provider is not configured.';
  if (code === 'rate_limited') return 'Too many login attempts. Try again later.';
  if (code === 'account_exists') {
    return 'An account with this email already exists. Sign in with your email and password, then connect this provider from Manage account.';
  }
  return 'The provider login could not be completed. Please try again.';
}
