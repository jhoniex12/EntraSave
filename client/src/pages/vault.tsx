import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { VaultItemDTO, VaultKeyDTO } from '@/lib/types';
import { Modal } from '@/components/modal';
import {
  ENTRY_LIMITS,
  LEGACY_PASSWORD_MAX,
  PIN_LENGTH,
  createPinKey,
  decryptEntry,
  encryptEntry,
  generatePassword,
  isValidPin,
  isVaultCryptoAvailable,
  preparePin,
  unlockLegacyVaultKey,
  type VaultEntry,
} from '@/lib/vault-crypto';

/**
 * Personal password vault. Entries are encrypted and decrypted in the browser
 * (see lib/vault-crypto.ts) with a key derived from the user's 6-digit PIN and
 * a vault secret the server releases only after a correct PIN. The key lives in
 * this page's state, so leaving the page, signing out, pressing Lock, or
 * AUTO_LOCK_MS of inactivity discards it.
 */
const AUTO_LOCK_MS = 5 * 60_000;
const COPIED_FEEDBACK_MS = 1_500;
const MASK = '••••••••';

type Phase =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }
  | { kind: 'setup' }
  | { kind: 'locked'; stored: VaultKeyDTO }
  // Legacy master-password vault, unlocked, that must switch to a PIN.
  | { kind: 'convert'; stored: VaultKeyDTO; key: CryptoKey }
  | { kind: 'unlocked'; stored: VaultKeyDTO; key: CryptoKey };

interface VaultRow {
  id: string;
  /** null when the ciphertext failed authentication and cannot be shown. */
  entry: VaultEntry | null;
}

class UnreadableEntriesError extends Error {
  constructor() {
    super('Delete unreadable entries before changing your PIN.');
  }
}

export function VaultPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  const loadState = useCallback(async () => {
    if (!isVaultCryptoAvailable()) {
      setPhase({ kind: 'unsupported' });
      return;
    }
    try {
      const { key } = await api.vault.state();
      setPhase(key ? { kind: 'locked', stored: key } : { kind: 'setup' });
    } catch (err) {
      setPhase({ kind: 'error', message: message(err, 'Failed to load your vault.') });
    }
  }, []);

  useEffect(() => { void loadState(); }, [loadState]);

  const lock = useCallback(() => {
    setPhase((current) => (
      current.kind === 'unlocked' || current.kind === 'convert' ? { kind: 'locked', stored: current.stored } : current
    ));
  }, []);

  const unlocked = (stored: VaultKeyDTO, key: CryptoKey) => setPhase({ kind: 'unlocked', stored, key });

  return (
    <div className="space-y-6 pb-10">
      <section className="flex items-center gap-4 rounded-2xl bg-neutral-950 p-5 text-white sm:p-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-200"><LockIcon className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-emerald-300">Password vault</p>
          <h1 className="truncate text-2xl font-semibold">Your passwords</h1>
          <p className="text-sm text-neutral-400">Encrypted on this device and unlocked with your {PIN_LENGTH}-digit PIN.</p>
        </div>
        {phase.kind === 'unlocked' && (
          <button type="button" onClick={lock} aria-label="Lock vault" className="flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-white/20 px-3 text-sm font-semibold text-white hover:bg-white/10">
            <LockIcon className="h-4 w-4" /><span className="hidden sm:inline">Lock</span>
          </button>
        )}
      </section>

      {phase.kind === 'loading' && <p className="text-sm text-neutral-500">Loading vault…</p>}
      {phase.kind === 'unsupported' && (
        <Notice>The password vault needs a secure (HTTPS) connection and a browser that supports Web Crypto.</Notice>
      )}
      {phase.kind === 'error' && <Notice>{phase.message}</Notice>}
      {phase.kind === 'setup' && <SetupVault onCreated={unlocked} onAlreadyExists={loadState} />}
      {phase.kind === 'locked' && (phase.stored.scheme === 'PIN' ? (
        <UnlockVault
          stored={phase.stored}
          onUnlocked={(key) => unlocked(phase.stored, key)}
          onReset={() => setPhase({ kind: 'setup' })}
        />
      ) : (
        <UnlockLegacyVault
          stored={phase.stored}
          onUnlocked={(key) => setPhase({ kind: 'convert', stored: phase.stored, key })}
          onReset={() => setPhase({ kind: 'setup' })}
        />
      ))}
      {phase.kind === 'convert' && (
        <ConvertToPin stored={phase.stored} legacyKey={phase.key} onConverted={unlocked} onStale={loadState} />
      )}
      {phase.kind === 'unlocked' && (
        <UnlockedVault
          // Remount on key change so no state derived from the old key survives.
          key={phase.stored.keyVersion}
          stored={phase.stored}
          cryptoKey={phase.key}
          onLock={lock}
          onKeyChanged={unlocked}
          onStale={loadState}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Setup / unlock ───────────────────────────

function SetupVault({ onCreated, onAlreadyExists }: {
  onCreated: (stored: VaultKeyDTO, key: CryptoKey) => void;
  onAlreadyExists: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const pin = String(data.get('pin'));
    if (!isValidPin(pin)) return setError(`Your PIN must be exactly ${PIN_LENGTH} digits.`);
    if (pin !== String(data.get('confirm'))) return setError('The PINs do not match.');
    setPending(true);
    setError(null);
    try {
      const { key, material } = await createPinKey(pin);
      form.reset();
      onCreated(await api.vault.setup(material), key);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        await onAlreadyExists();
        return;
      }
      setError(message(err, 'Failed to create your vault.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Create your vault</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Choose a {PIN_LENGTH}-digit PIN to unlock your vault. It is separate from your EntraSave sign-in.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <PinField name="pin" label="PIN" autoFocus />
        <PinField name="confirm" label="Confirm PIN" />
        <p className="text-xs text-neutral-400">After 5 incorrect PINs the vault locks, for longer after each further mistake.</p>
        <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
          <span>I understand that if I forget my PIN, EntraSave cannot recover my vault. It can only be deleted.</span>
        </label>
        {error && <Notice>{error}</Notice>}
        <PrimaryButton pending={pending} pendingLabel="Creating vault…">Create vault</PrimaryButton>
      </form>
    </section>
  );
}

function UnlockVault({ stored, onUnlocked, onReset }: {
  stored: VaultKeyDTO;
  onUnlocked: (key: CryptoKey) => void;
  onReset: () => void;
}) {
  const [error, setError] = useState<string | null>(lockedMessage(stored.lockedUntil));
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pin = String(new FormData(form).get('pin'));
    if (!isValidPin(pin)) return setError(`Enter your ${PIN_LENGTH}-digit PIN.`);
    setPending(true);
    setError(null);
    try {
      const prepared = await preparePin(pin, stored.kdfSalt, stored.kdfIterations);
      const { secret } = await api.vault.unlock(prepared.pinProof);
      const key = await prepared.deriveKey(secret);
      form.reset();
      onUnlocked(key);
    } catch (err) {
      form.reset();
      setError(message(err, 'Could not unlock the vault in this browser.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <LockedCard title="Vault locked" description={`Enter your ${PIN_LENGTH}-digit PIN to view your saved passwords.`} forgotLabel="Forgot PIN?" onReset={onReset}>
      <form onSubmit={submit} className="space-y-4">
        <PinField name="pin" label="PIN" autoFocus />
        {error && <Notice>{error}</Notice>}
        <PrimaryButton pending={pending} pendingLabel="Unlocking…">Unlock</PrimaryButton>
      </form>
    </LockedCard>
  );
}

function UnlockLegacyVault({ stored, onUnlocked, onReset }: {
  stored: VaultKeyDTO;
  onUnlocked: (key: CryptoKey) => void;
  onReset: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(null);
    try {
      const key = await unlockLegacyVaultKey(String(new FormData(form).get('password')), stored);
      if (!key) {
        setError('Incorrect master password.');
        return;
      }
      form.reset();
      onUnlocked(key);
    } catch {
      setError('Could not unlock the vault in this browser.');
    } finally {
      setPending(false);
    }
  }

  return (
    <LockedCard title="Vault locked" description={`Enter your master password once more. You'll then set a ${PIN_LENGTH}-digit PIN to use from now on.`} forgotLabel="Forgot master password?" onReset={onReset}>
      <form onSubmit={submit} className="space-y-4">
        <PasswordField name="password" label="Master password" maxLength={LEGACY_PASSWORD_MAX} autoFocus />
        {error && <Notice>{error}</Notice>}
        <PrimaryButton pending={pending} pendingLabel="Unlocking…">Unlock</PrimaryButton>
      </form>
    </LockedCard>
  );
}

function ConvertToPin({ stored, legacyKey, onConverted, onStale }: {
  stored: VaultKeyDTO;
  legacyKey: CryptoKey;
  onConverted: (stored: VaultKeyDTO, key: CryptoKey) => void;
  onStale: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pin = String(data.get('pin'));
    if (!isValidPin(pin)) return setError(`Your PIN must be exactly ${PIN_LENGTH} digits.`);
    if (pin !== String(data.get('confirm'))) return setError('The PINs do not match.');
    setPending(true);
    setError(null);
    try {
      const { key, material, items } = await reencryptVault(legacyKey, pin);
      onConverted(await api.vault.rekey({ keyVersion: stored.keyVersion, ...material, items }), key);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        await onStale();
        return;
      }
      setError(message(err, 'Failed to set your PIN.'));
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Set your vault PIN</h2>
      <p className="mt-1 text-sm text-neutral-500">
        The vault now unlocks with a {PIN_LENGTH}-digit PIN instead of a master password. Your entries are re-encrypted with it.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <PinField name="pin" label="New PIN" autoFocus />
        <PinField name="confirm" label="Confirm PIN" />
        {error && <Notice>{error}</Notice>}
        <PrimaryButton pending={pending} pendingLabel="Re-encrypting…">Set PIN</PrimaryButton>
      </form>
    </section>
  );
}

function LockedCard({ title, description, forgotLabel, onReset, children }: {
  title: string;
  description: string;
  forgotLabel: string;
  onReset: () => void;
  children: ReactNode;
}) {
  const [resetting, setResetting] = useState(false);
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <div className="mt-5">{children}</div>
      <button type="button" onClick={() => setResetting(true)} className="mt-4 min-h-11 w-full touch-manipulation text-sm font-medium text-neutral-500 hover:text-rose-600">
        {forgotLabel}
      </button>
      {resetting && <ResetVaultDialog onClose={() => setResetting(false)} onReset={onReset} />}
    </section>
  );
}

function ResetVaultDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.vault.reset();
      onReset();
    } catch (err) {
      setError(message(err, 'Failed to delete the vault.'));
      setPending(false);
    }
  }

  return (
    <Modal title="Delete vault" subtitle="A forgotten PIN cannot be recovered." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          This permanently deletes every saved entry so you can start a new vault. This cannot be undone.
        </p>
        <label className="block text-sm font-medium text-neutral-700">
          Type DELETE to confirm
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" className={inputClass} />
        </label>
        {error && <Notice>{error}</Notice>}
        <DialogActions onCancel={onClose} pending={pending}>
          <button disabled={pending || confirmation !== 'DELETE'} className="min-h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {pending ? 'Deleting…' : 'Delete vault'}
          </button>
        </DialogActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────── Unlocked vault ───────────────────────────

function UnlockedVault({ stored, cryptoKey, onLock, onKeyChanged, onStale }: {
  stored: VaultKeyDTO;
  cryptoKey: CryptoKey;
  onLock: () => void;
  onKeyChanged: (stored: VaultKeyDTO, key: CryptoKey) => void;
  onStale: () => Promise<void>;
}) {
  const [rows, setRows] = useState<VaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<VaultRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<VaultRow | null>(null);
  const [changingPin, setChangingPin] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const items = await api.vault.list();
      setRows(await decryptAll(cryptoKey, items));
    } catch (err) {
      setError(message(err, 'Failed to load vault entries.'));
    } finally {
      setLoading(false);
    }
  }, [cryptoKey]);

  useEffect(() => { void load(); }, [load]);
  useIdleTimeout(AUTO_LOCK_MS, onLock);

  // A CONFLICT on a write can mean the PIN changed in another session; re-read
  // the vault state so this tab locks instead of writing under a stale key.
  const handleWriteError = useCallback(async (err: unknown, fallback: string): Promise<string> => {
    if (err instanceof ApiError && err.code === 'CONFLICT') {
      const { key } = await api.vault.state().catch(() => ({ key: null }));
      if (!key || key.keyVersion !== stored.keyVersion) {
        await onStale();
      }
    }
    return message(err, fallback);
  }, [onStale, stored.keyVersion]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter((row) => !needle || !row.entry || [row.entry.name, row.entry.username, row.entry.url].some((value) => value.toLowerCase().includes(needle)))
      .sort((a, b) => (a.entry?.name ?? '').localeCompare(b.entry?.name ?? ''));
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search vault</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, username, or website" className="min-h-11 w-full rounded-xl border border-neutral-300 bg-white py-2 pl-9 pr-3 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setChangingPin(true)} className="min-h-11 flex-1 touch-manipulation rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 sm:flex-none">Change PIN</button>
          <button type="button" onClick={() => setEditing('new')} className="min-h-11 flex-1 touch-manipulation rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:flex-none">+ Add entry</button>
        </div>
      </div>

      {error && <Notice>{error}</Notice>}

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-neutral-500">Decrypting…</p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-neutral-800">Your vault is empty</p>
            <p className="mt-1 text-sm text-neutral-500">Add a login to keep it safe and close at hand.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">No entries match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map((row) => (
              <VaultRowItem key={row.id} row={row} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} />
            ))}
          </ul>
        )}
      </section>
      <p className="text-center text-xs text-neutral-400">The vault locks automatically after 5 minutes of inactivity.</p>

      {editing && (
        <EntryDialog
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={async (entry) => {
            const blob = await encryptEntry(cryptoKey, entry);
            if (editing === 'new') await api.vault.create({ keyVersion: stored.keyVersion, ...blob });
            else await api.vault.update({ id: editing.id, keyVersion: stored.keyVersion, ...blob });
            setEditing(null);
            await load();
          }}
          onError={handleWriteError}
        />
      )}
      {deleting && (
        <DeleteEntryDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => { setDeleting(null); await load(); }}
        />
      )}
      {changingPin && (
        <ChangePinDialog
          stored={stored}
          cryptoKey={cryptoKey}
          onClose={() => setChangingPin(false)}
          onChanged={onKeyChanged}
          onError={handleWriteError}
        />
      )}
    </div>
  );
}

function VaultRowItem({ row, onEdit, onDelete }: { row: VaultRow; onEdit: () => void; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<'username' | 'password' | 'failed' | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const { entry } = row;
  if (!entry) {
    return (
      <li className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">!</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-800">Unreadable entry</p>
          <p className="text-xs text-neutral-500">This entry could not be decrypted with your key.</p>
        </div>
        <IconButton label="Delete unreadable entry" onClick={onDelete} danger><TrashIcon /></IconButton>
      </li>
    );
  }

  async function copy(kind: 'username' | 'password', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
  }

  const link = safeWebsiteUrl(entry.url);
  const site = link ? new URL(link).hostname : entry.url;

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
          {(entry.name.trim().charAt(0) || '?').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-800">{entry.name}</p>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-emerald-700 hover:underline">{site}</a>
          ) : site ? (
            <p className="truncate text-xs text-neutral-500">{site}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton label={`Edit ${entry.name}`} onClick={onEdit}><EditIcon /></IconButton>
          <IconButton label={`Delete ${entry.name}`} onClick={onDelete} danger><TrashIcon /></IconButton>
        </div>
      </div>

      <dl className="mt-2 space-y-1 rounded-xl bg-neutral-50 px-3 py-1.5 sm:ml-[52px]">
        <div className="flex items-center gap-2">
          <dt className="w-[4.5rem] shrink-0 text-xs text-neutral-500">Username</dt>
          <dd className="min-w-0 flex-1 truncate text-sm text-neutral-800">{entry.username || <span className="text-neutral-400">—</span>}</dd>
          {entry.username && (
            <IconButton label={`Copy username for ${entry.name}`} onClick={() => void copy('username', entry.username)}>
              {copied === 'username' ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
          )}
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-[4.5rem] shrink-0 text-xs text-neutral-500">Password</dt>
          <dd className={`min-w-0 flex-1 font-mono text-sm text-neutral-800 ${revealed ? 'break-all' : 'truncate'}`}>
            {entry.password ? (revealed ? entry.password : MASK) : <span className="font-sans text-neutral-400">—</span>}
          </dd>
          {entry.password && (
            <>
              <IconButton label={revealed ? `Hide password for ${entry.name}` : `Show password for ${entry.name}`} onClick={() => setRevealed((v) => !v)}>
                {revealed ? <EyeOffIcon /> : <EyeIcon />}
              </IconButton>
              <IconButton label={`Copy password for ${entry.name}`} onClick={() => void copy('password', entry.password)}>
                {copied === 'password' ? <CheckIcon /> : <CopyIcon />}
              </IconButton>
            </>
          )}
        </div>
      </dl>
      <p role="status" className="sr-only">
        {copied === 'username' ? 'Username copied' : copied === 'password' ? 'Password copied' : copied === 'failed' ? 'Copy failed' : ''}
      </p>
      {copied === 'failed' && <p className="mt-1 text-xs text-rose-600 sm:ml-[52px]">Copy failed. Your browser blocked clipboard access.</p>}
    </li>
  );
}

// ─────────────────────────── Dialogs ───────────────────────────

function EntryDialog({ row, onClose, onSubmit, onError }: {
  row: VaultRow | null;
  onClose: () => void;
  onSubmit: (entry: VaultEntry) => Promise<void>;
  onError: (err: unknown, fallback: string) => Promise<string>;
}) {
  const initial = row?.entry;
  const [password, setPassword] = useState(initial?.password ?? '');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        name: String(data.get('name')).trim(),
        username: String(data.get('username')).trim(),
        password,
        url: String(data.get('url')).trim(),
        notes: String(data.get('notes')),
      });
    } catch (err) {
      setError(await onError(err, 'Failed to save the entry.'));
      setPending(false);
    }
  }

  return (
    <Modal title={row ? 'Edit entry' : 'New entry'} subtitle="Encrypted on this device before it is saved." size="lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-neutral-700">
          Name
          <input name="name" defaultValue={initial?.name} required maxLength={ENTRY_LIMITS.name} autoFocus placeholder="e.g. Online banking" autoComplete="off" className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Username or email
          <input name="username" defaultValue={initial?.username} maxLength={ENTRY_LIMITS.username} autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} />
        </label>
        <div>
          <label htmlFor="vault-entry-password" className="block text-sm font-medium text-neutral-700">Password</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="vault-entry-password"
              type={revealed ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={ENTRY_LIMITS.password}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <IconButton label={revealed ? 'Hide password' : 'Show password'} onClick={() => setRevealed((v) => !v)} bordered>
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </IconButton>
            <IconButton label="Generate a strong password" onClick={() => { setPassword(generatePassword()); setRevealed(true); }} bordered>
              <DiceIcon />
            </IconButton>
          </div>
        </div>
        <label className="block text-sm font-medium text-neutral-700">
          Website
          <input name="url" defaultValue={initial?.url} maxLength={ENTRY_LIMITS.url} placeholder="https://example.com" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Notes
          <textarea name="notes" defaultValue={initial?.notes} maxLength={ENTRY_LIMITS.notes} rows={3} className={inputClass} />
        </label>
        {error && <Notice>{error}</Notice>}
        <DialogActions onCancel={onClose} pending={pending}>
          <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {pending ? 'Saving…' : row ? 'Save changes' : 'Add entry'}
          </button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function DeleteEntryDialog({ row, onClose, onDeleted }: { row: VaultRow; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api.vault.remove(row.id);
      await onDeleted();
    } catch (err) {
      setError(message(err, 'Failed to delete the entry.'));
      setPending(false);
    }
  }

  return (
    <Modal title="Delete entry" onClose={onClose}>
      <p className="text-sm text-neutral-600">
        Permanently delete <span className="font-semibold text-neutral-900">{row.entry?.name ?? 'this unreadable entry'}</span>? This cannot be undone.
      </p>
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      <div className="mt-5">
        <DialogActions onCancel={onClose} pending={pending}>
          <button type="button" disabled={pending} onClick={() => void remove()} className="min-h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </DialogActions>
      </div>
    </Modal>
  );
}

function ChangePinDialog({ stored, cryptoKey, onClose, onChanged, onError }: {
  stored: VaultKeyDTO;
  cryptoKey: CryptoKey;
  onClose: () => void;
  onChanged: (stored: VaultKeyDTO, key: CryptoKey) => void;
  onError: (err: unknown, fallback: string) => Promise<string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const current = String(data.get('current'));
    const next = String(data.get('next'));
    if (!isValidPin(current) || !isValidPin(next)) return setError(`PINs must be exactly ${PIN_LENGTH} digits.`);
    if (next !== String(data.get('confirm'))) return setError('The new PINs do not match.');
    setPending(true);
    setError(null);
    try {
      // The server verifies the current PIN (counted toward the lockout).
      const { pinProof: currentPinProof } = await preparePin(current, stored.kdfSalt, stored.kdfIterations);
      const { key, material, items } = await reencryptVault(cryptoKey, next);
      onChanged(await api.vault.rekey({ keyVersion: stored.keyVersion, ...material, currentPinProof, items }), key);
    } catch (err) {
      setError(await onError(err, 'Failed to change your PIN.'));
      setPending(false);
    }
  }

  return (
    <Modal title="Change PIN" subtitle="Every entry is re-encrypted with your new PIN." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <PinField name="current" label="Current PIN" autoFocus />
        <PinField name="next" label="New PIN" />
        <PinField name="confirm" label="Confirm new PIN" />
        {error && <Notice>{error}</Notice>}
        <DialogActions onCancel={onClose} pending={pending}>
          <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {pending ? 'Re-encrypting…' : 'Change PIN'}
          </button>
        </DialogActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

async function decryptAll(key: CryptoKey, items: VaultItemDTO[]): Promise<VaultRow[]> {
  return Promise.all(items.map(async (item) => {
    try {
      return { id: item.id, entry: await decryptEntry(key, item) };
    } catch {
      return { id: item.id, entry: null };
    }
  }));
}

/** Decrypt every entry with `oldKey` and re-encrypt it under a new PIN key. */
async function reencryptVault(oldKey: CryptoKey, pin: string) {
  const rows = await decryptAll(oldKey, await api.vault.list());
  const readable = rows.flatMap((row) => (row.entry ? [{ id: row.id, entry: row.entry }] : []));
  if (readable.length !== rows.length) throw new UnreadableEntriesError();
  const { key, material } = await createPinKey(pin);
  const items = await Promise.all(readable.map(async (row) => ({ id: row.id, ...(await encryptEntry(key, row.entry)) })));
  return { key, material, items };
}

/** Lock after `ms` without pointer, keyboard, or scroll activity. */
function useIdleTimeout(ms: number, onIdle: () => void) {
  useEffect(() => {
    let timer = window.setTimeout(onIdle, ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, ms);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [ms, onIdle]);
}

/**
 * Only http(s) links are rendered: a stored `javascript:` or `data:` URL must
 * never become a clickable href. Bare hosts ("example.com") get https://.
 */
function safeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function lockedMessage(lockedUntil: string | null): string | null {
  if (!lockedUntil) return null;
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000));
  const hours = Math.ceil(minutes / 60);
  const wait = minutes < 60 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`;
  return `Too many incorrect PINs. Try again in ${wait}.`;
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof UnreadableEntriesError ? error.message : fallback;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

function PinField({ name, label, autoFocus }: { name: string; label: string; autoFocus?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const id = `vault-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">{label}</label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          name={name}
          type={revealed ? 'text' : 'password'}
          inputMode="numeric"
          pattern={`[0-9]{${PIN_LENGTH}}`}
          minLength={PIN_LENGTH}
          maxLength={PIN_LENGTH}
          required
          title={`${PIN_LENGTH} digits`}
          autoComplete="off"
          autoFocus={autoFocus}
          onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, PIN_LENGTH); }}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.5em] text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        <IconButton label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setRevealed((v) => !v)} bordered>
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
      </div>
    </div>
  );
}

function PasswordField({ name, label, maxLength, autoFocus }: { name: string; label: string; maxLength: number; autoFocus?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const id = `vault-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">{label}</label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          name={name}
          type={revealed ? 'text' : 'password'}
          required
          maxLength={maxLength}
          autoComplete="off"
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        <IconButton label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setRevealed((v) => !v)} bordered>
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
      </div>
    </div>
  );
}

function PrimaryButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <button disabled={pending} className="min-h-11 w-full touch-manipulation rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
      {pending ? pendingLabel : children}
    </button>
  );
}

function DialogActions({ onCancel, pending, children }: { onCancel: () => void; pending: boolean; children: ReactNode }) {
  return (
    <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
      <button type="button" onClick={onCancel} disabled={pending} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
      {children}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{children}</p>;
}

function IconButton({ label, onClick, danger, bordered, children }: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid min-h-11 min-w-11 shrink-0 touch-manipulation place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 ${danger ? 'hover:text-rose-600' : 'hover:text-neutral-800'} ${bordered ? 'border border-neutral-300 bg-white' : 'sm:min-h-9 sm:min-w-9'}`}
    >
      {children}
    </button>
  );
}

function LockIcon({ className = 'h-4 w-4' }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>; }
function SearchIcon({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>; }
function CopyIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>; }
function EditIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.5 6.5 3 3" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>; }
function EyeIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>; }
function EyeOffIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>; }
function DiceIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></svg>; }
