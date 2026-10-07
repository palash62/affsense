"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_THEME,
  FIXED_PORTAL_THEME,
  THEME_STORAGE_KEY,
  type ThemeId,
  isFixedThemePath,
  isThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locked = isFixedThemePath(pathname);
  const [storedTheme, setStoredTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);
  const theme = locked ? FIXED_PORTAL_THEME : storedTheme;

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setStoredTheme(stored && isThemeId(stored) ? stored : DEFAULT_THEME);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, mounted]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      if (locked) return;
      setStoredTheme(next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
    },
    [locked],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
