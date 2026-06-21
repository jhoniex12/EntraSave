/** Theme persistence + application (ported from the original shared/theme.ts). */
export type Theme = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
];

export function readStoredTheme(): Theme {
  const stored = localStorage.getItem('theme');
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
  document.documentElement.dataset.theme = theme;
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}
