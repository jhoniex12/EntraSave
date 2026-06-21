import { useEffect, useRef, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme, THEME_OPTIONS, type Theme } from '@/lib/theme';

/**
 * Colour-theme picker (System / Light / Dark). A native <details> dropdown;
 * the choice is persisted to localStorage and applied instantly, and "System"
 * tracks the OS preference live.
 */
export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('system');
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => {
      if (readStoredTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', syncSystem);
    return () => media.removeEventListener('change', syncSystem);
  }, []);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.removeAttribute('open');
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  function choose(next: Theme): void {
    storeTheme(next);
    setTheme(next);
    detailsRef.current?.removeAttribute('open');
  }

  const selected = THEME_OPTIONS.find((option) => option.value === theme);
  const selectedLabel = selected?.label ?? 'System';
  const selectedIcon = selected?.icon ?? '◐';

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        className="flex h-11 w-11 cursor-pointer touch-manipulation list-none items-center justify-center rounded-lg border border-neutral-200 bg-white text-base text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 [&::-webkit-details-marker]:hidden"
        aria-label={`Colour theme: ${selectedLabel}`}
        title={`Colour theme: ${selectedLabel}`}
      >
        <span aria-hidden="true">{selectedIcon}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
              theme === option.value
                ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            <span className="w-5 text-center text-base" aria-hidden="true">{option.icon}</span>
            <span>{option.label}</span>
            {theme === option.value && <span className="ml-auto text-emerald-600" aria-label="Selected">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
