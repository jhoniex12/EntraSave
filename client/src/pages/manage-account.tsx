import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { UserProfileDTO } from '@/lib/types';
import { useAuth } from '@/auth/auth-context';
import { ProviderIcon } from '@/components/provider-icon';

type Provider = 'google' | 'facebook';

export function ManageAccountPage() {
  const { refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [providers, setProviders] = useState({ googleEnabled: false, facebookEnabled: false });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.users.profile().then(setProfile).catch((error) => setMessage({ ok: false, text: error instanceof ApiError ? error.message : 'Failed to load profile.' }));
    api.auth.providers().then(setProviders).catch(() => undefined);
  }, []);

  // Surface the outcome of the OAuth link redirect, then strip the query so a
  // refresh doesn't replay the message.
  useEffect(() => {
    const linked = params.get('linked');
    const error = params.get('error');
    if (!linked && !error) return;
    if (linked) setMessage({ ok: true, text: `${providerName(linked)} connected.` });
    else setMessage({ ok: false, text: linkErrorMessage(error) });
    setParams({}, { replace: true });
  }, [params, setParams]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const displayName = String(new FormData(e.currentTarget).get('displayName'));
      await api.users.updateProfile({ displayName });
      await Promise.all([refresh(), api.users.profile().then(setProfile)]);
      setMessage({ ok: true, text: 'Profile updated.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : 'Failed to update profile.' });
    } finally { setPending(false); }
  }

  async function disconnect(provider: Provider) {
    setPending(true);
    setMessage(null);
    try {
      await api.auth.unlink(provider);
      await Promise.all([refresh(), api.users.profile().then(setProfile)]);
      setMessage({ ok: true, text: `${providerName(provider)} disconnected.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : 'Failed to disconnect.' });
    } finally { setPending(false); }
  }

  if (!profile) return <p className="text-sm text-neutral-500">Loading profile…</p>;
  const name = profile.displayName || profile.email.split('@')[0] || 'Account';

  // Count active sign-in methods so we can block removing the last one client-side
  // (the server enforces this too).
  const methodCount = Number(profile.hasPassword) + Number(profile.googleLinked) + Number(profile.facebookLinked);

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-2xl bg-neutral-950 p-6 text-white">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-500/20 text-xl font-semibold text-emerald-100">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-emerald-300">Manage account</p><h1 className="truncate text-2xl font-semibold">{name}</h1><p className="truncate text-sm text-neutral-400">{profile.email}</p></div>
      </section>

      {message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Profile</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-neutral-700">Display name<input name="displayName" defaultValue={name} required maxLength={100} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            <button disabled={pending} className="min-h-11 touch-manipulation rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save profile'}</button>
          </form>
          <div className="mt-5 border-t border-neutral-100 pt-4"><p className="text-xs uppercase tracking-wide text-neutral-400">Email address</p><p className="mt-1 text-sm font-medium text-neutral-800">{profile.email}</p><p className="mt-1 text-xs text-neutral-400">Email changes are not available yet.</p></div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Sign-in methods</h2>
          <div className="mt-4 space-y-3">
            <SignInMethod label="Email and password" connected={profile.hasPassword} />
            <SignInMethod
              label="Google"
              provider="google"
              connected={profile.googleLinked}
              enabled={providers.googleEnabled}
              isOnlyMethod={methodCount <= 1}
              pending={pending}
              onDisconnect={() => disconnect('google')}
            />
            <SignInMethod
              label="Facebook"
              provider="facebook"
              connected={profile.facebookLinked}
              enabled={providers.facebookEnabled}
              isOnlyMethod={methodCount <= 1}
              pending={pending}
              onDisconnect={() => disconnect('facebook')}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-400">Connect a provider to sign in with one tap. You must keep at least one sign-in method.</p>
        </section>
      </div>
    </div>
  );
}

function SignInMethod({ label, connected, provider, enabled, isOnlyMethod, pending, onDisconnect }: {
  label: string;
  connected: boolean;
  provider?: Provider;
  enabled?: boolean;
  isOnlyMethod?: boolean;
  pending?: boolean;
  onDisconnect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium text-neutral-700">{provider && <ProviderIcon provider={provider} />}{label}</span>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{connected ? 'Connected' : 'Not connected'}</span>
        {provider && (connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={pending || isOnlyMethod}
            title={isOnlyMethod ? 'This is your only sign-in method.' : undefined}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            Disconnect
          </button>
        ) : enabled ? (
          <a
            href={`/api/auth/oauth/${provider}/link?returnTo=${encodeURIComponent('/manage-account')}`}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Connect
          </a>
        ) : (
          <span className="text-xs font-medium text-neutral-300" title="Provider is not configured">Unavailable</span>
        ))}
      </div>
    </div>
  );
}

function providerName(provider: string): string {
  return provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Provider';
}

function linkErrorMessage(code: string | null): string {
  if (code === 'link_conflict') return 'That provider account is already linked to another EntraSave account.';
  if (code === 'provider_unavailable') return 'That login provider is not configured.';
  if (code === 'rate_limited') return 'Too many attempts. Please try again later.';
  return 'Could not connect the provider. Please try again.';
}
