"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

type AppearanceSettings = {
  defaultTheme: ThemeMode;
  allowUserTheme: boolean;
  accentHex: string;
  secondaryHex: string;
  backgroundHex: string;
  surfaceHex: string;
  textHex: string;
  motionEnabled: boolean;
  ambientEffects: boolean;
  whiteLabelEnabled: boolean;
  showPoweredBy: boolean;
  brandName: string;
  tagline: string;
  logoHeroUrl: string;
  logoNavbarUrl: string;
  faviconUrl: string;
  siteWallpaperUrl: string;
  heroCoverUrl: string;
  discordInviteCoverUrl: string;
};

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  allowThemeToggle: boolean;
  accentHex: string;
  secondaryHex: string;
  backgroundHex: string;
  surfaceHex: string;
  textHex: string;
  motionEnabled: boolean;
  ambientEffects: boolean;
  whiteLabelEnabled: boolean;
  showPoweredBy: boolean;
  brandName: string;
  tagline: string;
  logoHeroUrl: string;
  logoNavbarUrl: string;
  faviconUrl: string;
  siteWallpaperUrl: string;
  heroCoverUrl: string;
  discordInviteCoverUrl: string;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  defaultTheme: "dark",
  allowUserTheme: true,
  accentHex: "#0000FF",
  secondaryHex: "#00A3FF",
  backgroundHex: "#02060C",
  surfaceHex: "#07101D",
  textHex: "#F5F8FF",
  motionEnabled: true,
  ambientEffects: true,
  whiteLabelEnabled: false,
  showPoweredBy: true,
  brandName: "CRAZZY PROJECT",
  tagline: "QUEM NAO XITA NAO BRILHA",
  logoHeroUrl: "/brand/crazzy-logo-hero.png",
  logoNavbarUrl: "/brand/crazzy-logo-hero.png",
  faviconUrl: "/favicon.ico",
  siteWallpaperUrl: "",
  heroCoverUrl: "/backgrounds/hero-tokyo.webp",
  discordInviteCoverUrl: "",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "crazzy-theme";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function safeAssetUrl(value: unknown, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("/") || /^https:\/\//i.test(raw)) return raw;
  return fallback;
}

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
  root.style.setProperty("--crz-brand-secondary", settings.secondaryHex);
  root.style.setProperty("--crz-brand-background", settings.backgroundHex);
  root.style.setProperty("--crz-brand-surface", settings.surfaceHex);
  root.style.setProperty("--crz-brand-text", settings.textHex);
  root.style.setProperty("--crz-site-wallpaper-image", settings.siteWallpaperUrl ? 'url("' + settings.siteWallpaperUrl.replace(/"/g, "%22") + '")' : "none");
  root.style.setProperty("--crz-hero-cover-image", 'url("' + settings.heroCoverUrl.replace(/"/g, "%22") + '")');
  root.style.setProperty("--crz-discord-cover-image", settings.discordInviteCoverUrl ? 'url("' + settings.discordInviteCoverUrl.replace(/"/g, "%22") + '")' : "none");
  root.dataset.motion = settings.motionEnabled ? "on" : "off";
  root.dataset.ambient = settings.ambientEffects ? "on" : "off";
  root.dataset.whiteLabel = settings.whiteLabelEnabled ? "on" : "off";

  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement("link");
  favicon.rel = "icon";
  favicon.href = settings.faviconUrl;
  if (!favicon.parentNode) document.head.appendChild(favicon);
}

function normalize(payload: any): AppearanceSettings {
  const accent = String(payload?.accent_hex || "#0000FF").toUpperCase();
  const secondary = String(payload?.secondary_hex || "#00A3FF").toUpperCase();
  const background = String(payload?.background_hex || "#02060C").toUpperCase();
  const surface = String(payload?.surface_hex || "#07101D").toUpperCase();
  const text = String(payload?.text_hex || "#F5F8FF").toUpperCase();
  return {
    defaultTheme: payload?.default_theme === "light" ? "light" : "dark",
    allowUserTheme: payload?.allow_user_theme !== false,
    accentHex: HEX_RE.test(accent) ? accent : "#0000FF",
    secondaryHex: HEX_RE.test(secondary) ? secondary : "#00A3FF",
    backgroundHex: HEX_RE.test(background) ? background : "#02060C",
    surfaceHex: HEX_RE.test(surface) ? surface : "#07101D",
    textHex: HEX_RE.test(text) ? text : "#F5F8FF",
    motionEnabled: payload?.motion_enabled !== false,
    ambientEffects: payload?.ambient_effects !== false,
    whiteLabelEnabled: payload?.white_label_enabled === true,
    showPoweredBy: payload?.show_powered_by !== false,
    brandName: String(payload?.brand_name || "CRAZZY PROJECT").trim().slice(0, 60) || "CRAZZY PROJECT",
    tagline: String(payload?.tagline || "QUEM NAO XITA NAO BRILHA").trim().slice(0, 120),
    logoHeroUrl: safeAssetUrl(payload?.logo_hero_url, "/brand/crazzy-logo-hero.png"),
    logoNavbarUrl: safeAssetUrl(payload?.logo_navbar_url, "/brand/crazzy-logo-hero.png"),
    faviconUrl: safeAssetUrl(payload?.favicon_url, "/favicon.ico"),
    siteWallpaperUrl: safeAssetUrl(payload?.site_wallpaper_url, ""),
    heroCoverUrl: safeAssetUrl(payload?.hero_cover_url, "/backgrounds/hero-tokyo.webp"),
    discordInviteCoverUrl: safeAssetUrl(payload?.discord_invite_cover_url, ""),
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
      secondaryHex: appearance.secondaryHex,
      backgroundHex: appearance.backgroundHex,
      surfaceHex: appearance.surfaceHex,
      textHex: appearance.textHex,
      motionEnabled: appearance.motionEnabled,
      ambientEffects: appearance.ambientEffects,
      whiteLabelEnabled: appearance.whiteLabelEnabled,
      showPoweredBy: appearance.showPoweredBy,
      brandName: appearance.brandName,
      tagline: appearance.tagline,
      logoHeroUrl: appearance.logoHeroUrl,
      logoNavbarUrl: appearance.logoNavbarUrl,
      faviconUrl: appearance.faviconUrl,
      siteWallpaperUrl: appearance.siteWallpaperUrl,
      heroCoverUrl: appearance.heroCoverUrl,
      discordInviteCoverUrl: appearance.discordInviteCoverUrl,
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
