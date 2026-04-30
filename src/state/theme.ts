/**
 * Theme state — light / dark, persisted to localStorage["theme/v1"].
 *
 * Default is 'dark' to preserve the previous look for users already on the app.
 * The `dark` class is applied to `<html>` so Tailwind's `dark:` variants engage.
 *
 * Bootstrap order: an inline script in index.html applies the class on first paint
 * to avoid a light-flash; this hook then re-applies on every change.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'theme/v1';

function readStorage(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export interface UseTheme {
  theme: Theme;
  toggle(): void;
}

export function useTheme(): UseTheme {
  const [theme, setTheme] = useState<Theme>(() => readStorage());

  useEffect(() => {
    applyTheme(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
