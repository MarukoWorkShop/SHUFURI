import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'shufuri-theme';

type Theme = 'light' | 'dark';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return 'dark';
  } catch { /* ignore */ }
  return 'light';
}

function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function useDarkMode(): { isDark: boolean; toggleDark: () => void } {
  const [isDark, setIsDark] = useState<boolean>(() => readStoredTheme() === 'dark');

  // Apply theme on mount and when isDark changes
  useEffect(() => {
    applyTheme(isDark ? 'dark' : 'light');
    writeStoredTheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return { isDark, toggleDark };
}
