export function ProviderIcon({ provider, className = 'h-5 w-5' }: { provider: 'google' | 'facebook'; className?: string }) {
  if (provider === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path fill="#fff" d="M13.7 20v-7h2.35l.35-2.73h-2.7V8.53c0-.79.22-1.33 1.35-1.33h1.44V4.76c-.25-.03-1.1-.1-2.1-.1-2.08 0-3.5 1.27-3.5 3.6v2.01H8.55V13h2.34v7h2.81Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.18c0-.64-.06-1.25-.16-1.84H12v3.48h5.25a4.49 4.49 0 0 1-1.95 2.94v2.26h3.16c1.85-1.7 2.89-4.22 2.89-6.84Z" />
      <path fill="#34A853" d="M12 21.72c2.64 0 4.86-.88 6.48-2.38l-3.16-2.46c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.48-4.04H3.26v2.54A9.78 9.78 0 0 0 12 21.72Z" />
      <path fill="#FBBC05" d="M6.52 13.78A5.9 5.9 0 0 1 6.21 12c0-.62.11-1.22.31-1.78V7.68H3.26A9.78 9.78 0 0 0 2.22 12c0 1.58.38 3.08 1.04 4.32l3.26-2.54Z" />
      <path fill="#EA4335" d="M12 6.18c1.44 0 2.73.5 3.75 1.47l2.81-2.81A9.43 9.43 0 0 0 12 2.28a9.78 9.78 0 0 0-8.74 5.4l3.26 2.54C7.29 7.9 9.45 6.18 12 6.18Z" />
    </svg>
  );
}
