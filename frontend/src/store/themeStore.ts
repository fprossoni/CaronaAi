/**
 * Theme Store (Dark / Light mode)
 *
 * Dark mode is the primary default aesthetic, with full support for Light mode.
 * Synchronizes the active theme with `<html data-theme="...">` so both
 * CSS custom properties and Tailwind utility classes respond immediately.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function applyDomTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        applyDomTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
        applyDomTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: "carona-theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyDomTheme(state.theme);
        }
      },
    }
  )
);
