"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

type AppearanceSettings = {
  defaultTheme: ThemeMode;
  allowUserTheme: boolean;
  accentHex: string;
  motionEnabled: boolean;
  ambientEffects: boolean;
};

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  allowThemeToggle: boolean;
  accentHex: string;
  motionEnabled: boolean;
  ambientEffects: boolean;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  defaultTheme: "dark",
  allowUserTheme: true,
  accentHex: "#0000FF",
  motionEnabled: true,
  ambientEffects: true,
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "crazzy-theme";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function storedTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  root.style.setProperty("--crz-color-blue", settings.accentHex);
  root.style.setProperty("--crz-accent", settings.accentHex);
  root.dataset.motion = settings.motionEnabled ? "on" : "off";
  root.dataset.ambient = settings.ambientEffects ? "on" : "off";
}

function normalize(payload: any): AppearanceSettings {
  const accent = String(payload?.accent_hex || "#0000FF").toUpperCase();
  return {
    defaultTheme: payload?.default_theme === "light" ? "light" : "dark",
    allowUserTheme: payload?.allow_user_theme !== false,
    accentHex: HEX_RE.test(accent) ? accent : "#0000FF",
    motionEnabled: payload?.motion_enabled !== false,
    ambientEffects: payload?.ambient_effects !== false,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let active = true;

    const applyResolved = (settings: AppearanceSettings) => {
      if (!active) return;
      setAppearance(settings);
      applyAppearance(settings);

      const preferred = storedTheme();
      const nextTheme = settings.allowUserTheme && preferred ? preferred : settings.defaultTheme;
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    applyResolved(DEFAULT_APPEARANCE);

    const refresh = async () => {
      try {
        const response = await fetch("/api/appearance", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        applyResolved(normalize(payload));
      } catch {
        // Keep the safe CRAZZY defaults when appearance settings are unavailable.
      }
    };

    const onUpdate = () => void refresh();
    window.addEventListener("crazzy-appearance-updated", onUpdate);
    void refresh();

    return () => {
      active = false;
      window.removeEventListener("crazzy-appearance-updated", onUpdate);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    if (!appearance.allowUserTheme) return;
    setThemeState(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, [appearance.allowUserTheme]);

  const toggleTheme = useCallback(() => {
    if (!appearance.allowUserTheme) return;
    setTheme(theme === "dark" ? "light" : "dark");
  }, [appearance.allowUserTheme, setTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      allowThemeToggle: appearance.allowUserTheme,
      accentHex: appearance.accentHex,
      motionEnabled: appearance.motionEnabled,
      ambientEffects: appearance.ambientEffects,
    }),
    [appearance, setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
