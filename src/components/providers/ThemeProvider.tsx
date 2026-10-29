'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyThemeToElement,
  getSavedThemeMode,
  persistThemeMode,
  resolveThemeMode,
  THEME_PALETTES,
  type ResolvedTheme,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme';

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => initialTheme || 'dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveThemeMode(initialTheme || 'dark')
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = getSavedThemeMode();
    setThemeState(saved);
    const resolved = resolveThemeMode(saved);
    setResolvedTheme(resolved);
    applyThemeToElement(document.documentElement, resolved);

    // Escuchar cambios de preferencia del sistema si el modo es 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      setThemeState((current) => {
        if (current === 'system') {
          const nextResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
          setResolvedTheme(nextResolved);
          applyThemeToElement(document.documentElement, nextResolved);
        }
        return current;
      });
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else {
      mediaQuery.addListener(handleSystemChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemChange);
      } else {
        mediaQuery.removeListener(handleSystemChange);
      }
    };
  }, []);

  const setTheme = (nextMode: ThemeMode) => {
    setThemeState(nextMode);
    persistThemeMode(nextMode);
    const nextResolved = resolveThemeMode(nextMode);
    setResolvedTheme(nextResolved);
    if (typeof document !== 'undefined') {
      applyThemeToElement(document.documentElement, nextResolved);
    }
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const palette = useMemo(() => THEME_PALETTES[resolvedTheme], [resolvedTheme]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    palette,
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Si se utiliza fuera del provider (ej. en tests sin wrapper), fallback seguro
    return {
      theme: 'dark',
      resolvedTheme: 'dark',
      palette: THEME_PALETTES.dark,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
