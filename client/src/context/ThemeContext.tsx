import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// index.html already set data-theme before React loaded (no flash), so start from that.
function readInitialTheme(): Theme {
  const fromDocument = document.documentElement.dataset.theme;
  if (fromDocument === 'light' || fromDocument === 'dark') return fromDocument;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
  }, [theme]);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    // a short cross-fade while the colours change
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 350);
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not saved, still switches for this visit
    }
    setTheme(next);
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
