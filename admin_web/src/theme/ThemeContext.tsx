import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'qomaruddin_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemOrTimeTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';

  // 1. Cek preferensi OS dark mode
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) return 'dark';

  // 2. Cek waktu malam cerdas (Pukul 18:00 sore s/d 05:59 subuh)
  const currentHour = new Date().getHours();
  if (currentHour >= 18 || currentHour < 6) {
    return 'dark';
  }

  return 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return getSystemOrTimeTheme();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        return saved;
      }
    }
    return 'light'; // Default mode awal terang khas Qomaruddin
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(themeMode));

  // Terapkan class .dark ke <html> dengan dukungan View Transitions API jika ada
  const applyThemeToDOM = (resolved: ResolvedTheme) => {
    const root = document.documentElement;

    const updateDOM = () => {
      if (resolved === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
    };

    // Jalankan View Transitions API untuk animasi transisi layar halus kelas dunia
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      try {
        (document as any).startViewTransition(updateDOM);
      } catch {
        updateDOM();
      }
    } else {
      updateDOM();
    }
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  };

  const toggleTheme = () => {
    // 2 Mode Langsung: Terang <-> Gelap
    const nextMode: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  // Pantau perubahan mode sistem & perubahan waktu jika dalam mode 'auto'
  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);

    if (themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const nextResolved = getSystemOrTimeTheme();
        setResolvedTheme(nextResolved);
        applyThemeToDOM(nextResolved);
      };

      mediaQuery.addEventListener('change', handleChange);

      // Cek berkala tiap 1 menit untuk pergantian jam malam otomatis
      const interval = setInterval(handleChange, 60000);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
        clearInterval(interval);
      };
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
