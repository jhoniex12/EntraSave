import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme, THEME_OPTIONS, type Theme } from '@/lib/theme';
import { SettingsBackLink } from '@/pages/settings';

export function SettingsAppearancePage() {
  return (
    <div className="space-y-6 pb-10">
      <SettingsBackLink />
      <div><h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Colour theme</h1><p className="mt-1 text-sm text-neutral-500">Use your device preference or choose a theme for EntraSave.</p></div>

      <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm"><div className="p-5 sm:p-6"><ThemeForm /></div></section>
    </div>
  );
}

function ThemeForm() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => { if (readStoredTheme() === 'system') applyTheme('system'); };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  function choose(next: Theme) { storeTheme(next); setTheme(next); }
  const descriptions: Record<Theme, string> = { system: 'Follow your device', light: 'Always use light', dark: 'Always use dark' };
  return <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Colour theme">{THEME_OPTIONS.map((option) => { const selected = theme === option.value; return <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => choose(option.value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${selected ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}>{option.icon}</span><span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-0.5 block text-xs opacity-70">{descriptions[option.value]}</span></span></button>; })}</div>;
}
