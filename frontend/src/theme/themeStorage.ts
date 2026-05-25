export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dex-theme-mode';

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return null;
}

export function resolveTheme(): ThemeMode {
  const saved = readStoredTheme();
  if (saved) return saved;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}
