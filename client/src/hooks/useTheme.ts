import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getTheme as getStoredTheme,
  setTheme as setStoredTheme,
  type ThemeMode,
} from '@client/src/lib/storage';

function applyThemeClass(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

interface UseThemeReturn {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    typeof window !== 'undefined' ? getStoredTheme() : 'system',
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(
    () => getSystemTheme(),
  );

  // 初始化 + 主题变更时应用
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, [theme]);

  // system 模式监听系统变化
  useEffect(() => {
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      const next = e.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyThemeClass(next);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    try {
      setStoredTheme(next);
      setThemeState(next);
    } catch (err) {
      logger.error('setTheme failed', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return { theme, resolvedTheme, setTheme, toggleTheme };
}
