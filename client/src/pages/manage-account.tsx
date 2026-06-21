import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { UserProfileDTO } from '@/lib/types';
import { useAuth } from '@/auth/auth-context';
import { ProviderIcon } from '@/components/provider-icon';

export function ManageAccountPage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.users.profile().then(setProfile).catch((error) => setMessage({ ok: false, text: error instanceof ApiError ? error.message : 'Failed to load profile.' }));
  }, []);

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

  if (!profile) return <p className="text-sm text-neutral-500">Loading profile…</p>;
  const name = profile.displayName || profile.email.split('@')[0] || 'Account';

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-2xl bg-neutral-950 p-6 text-white">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-500/20 text-xl font-semibold text-emerald-100">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-emerald-300">Manage account</p><h1 className="truncate text-2xl font-semibold">{name}</h1><p className="truncate text-sm text-neutral-400">{profile.email}</p></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Profile</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-neutral-700">Display name<input name="displayName" defaultValue={name} required maxLength={100} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}
            <button disabled={pending} className="min-h-11 touch-manipulation rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save profile'}</button>
          </form>
          <div className="mt-5 border-t border-neutral-100 pt-4"><p className="text-xs uppercase tracking-wide text-neutral-400">Email address</p><p className="mt-1 text-sm font-medium text-neutral-800">{profile.email}</p><p className="mt-1 text-xs text-neutral-400">Email changes are not available yet.</p></div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Sign-in methods</h2>
          <div className="mt-4 space-y-3">
            <SignInMethod label="Email and password" connected={profile.hasPassword} />
            <SignInMethod label="Google" connected={profile.googleLinked} provider="google" />
            <SignInMethod label="Facebook" connected={profile.facebookLinked} provider="facebook" />
          </div>
        </section>
      </div>
    </div>
  );
}

function SignInMethod({ label, connected, provider }: { label: string; connected: boolean; provider?: 'google' | 'facebook' }) {
  return <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"><span className="flex items-center gap-2 text-sm font-medium text-neutral-700">{provider && <ProviderIcon provider={provider} />}{label}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{connected ? 'Connected' : 'Not connected'}</span></div>;
}
