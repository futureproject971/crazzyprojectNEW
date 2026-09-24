"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";

type AssetField =
  | "logo_hero_url"
  | "logo_navbar_url"
  | "favicon_url"
  | "site_wallpaper_url"
  | "hero_cover_url"
  | "discord_invite_cover_url";

type Appearance = {
  id?: string;
  default_theme: "dark" | "light";
  allow_user_theme: boolean;
  accent_hex: string;
  secondary_hex: string;
  background_hex: string;
  surface_hex: string;
  text_hex: string;
  motion_enabled: boolean;
  ambient_effects: boolean;
  white_label_enabled: boolean;
  show_powered_by: boolean;
  brand_name: string;
  tagline: string;
  logo_hero_url: string;
  logo_navbar_url: string;
  favicon_url: string;
  site_wallpaper_url: string;
  hero_cover_url: string;
  discord_invite_cover_url: string;
  updated_at?: string;
};

const DEFAULT: Appearance = {
  default_theme: "dark",
  allow_user_theme: true,
  accent_hex: "#0000FF",
  secondary_hex: "#00A3FF",
  background_hex: "#02060C",
  surface_hex: "#07101D",
  text_hex: "#F5F8FF",
  motion_enabled: true,
  ambient_effects: true,
  white_label_enabled: false,
  show_powered_by: true,
  brand_name: "CRAZZY PROJECT",
  tagline: "QUEM NAO XITA NAO BRILHA",
  logo_hero_url: "/brand/crazzy-logo-hero.png",
  logo_navbar_url: "/brand/crazzy-logo-navbar.png",
  favicon_url: "/favicon.ico",
  site_wallpaper_url: "",
  hero_cover_url: "/backgrounds/hero-tokyo.webp",
  discord_invite_cover_url: "",
};

const logoAssets: Array<{ field: AssetField; kind: string; label: string }> = [
  { field: "logo_hero_url", kind: "logo-hero", label: "Logo principal / hero" },
  { field: "logo_navbar_url", kind: "logo-navbar", label: "Logo da navegação" },
  { field: "favicon_url", kind: "favicon", label: "Favicon" },
];

const coverAssets: Array<{ field: AssetField; kind: string; label: string }> = [
  { field: "hero_cover_url", kind: "hero-cover", label: "Capa do início" },
  { field: "site_wallpaper_url", kind: "site-wallpaper", label: "Wallpaper geral do site" },
  { field: "discord_invite_cover_url", kind: "discord-invite-cover", label: "Capa da tela de convite do Discord" },
];

const colorFields = [
  ["accent_hex", "Cor principal"],
  ["secondary_hex", "Cor secundária"],
  ["background_hex", "Fundo"],
  ["surface_hex", "Cards / superfícies"],
  ["text_hex", "Texto principal"],
] as const;

export function AppearanceManagerPage() {
  const [value, setValue] = useState<Appearance>(DEFAULT);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState<AssetField | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/appearance", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.appearance) throw new Error();
      setValue({ ...DEFAULT, ...payload.appearance });
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const customized = useMemo(() => (
    value.brand_name !== DEFAULT.brand_name ||
    value.accent_hex.toUpperCase() !== DEFAULT.accent_hex ||
    value.white_label_enabled
  ), [value]);

  const uploadAsset = async (kind: string, field: AssetField, file?: File) => {
    if (!file || uploading) return;
    setUploading(field);
    setNotice("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/admin/appearance/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || "UPLOAD_FAILED");
      setValue(current => ({ ...current, [field]: String(payload.url) }));
      setNotice("Imagem enviada. Clique em “Salvar marca e aparência” para publicar.");
    } catch (error) {
      setNotice(error instanceof Error ? "Upload falhou: " + error.message : "Upload falhou.");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTheme: value.default_theme,
          allowUserTheme: value.allow_user_theme,
          accentHex: value.accent_hex,
          secondaryHex: value.secondary_hex,
          backgroundHex: value.background_hex,
          surfaceHex: value.surface_hex,
          textHex: value.text_hex,
          motionEnabled: value.motion_enabled,
          ambientEffects: value.ambient_effects,
          whiteLabelEnabled: value.white_label_enabled,
          showPoweredBy: value.show_powered_by,
          brandName: value.brand_name,
          tagline: value.tagline,
          logoHeroUrl: value.logo_hero_url,
          logoNavbarUrl: value.logo_navbar_url,
          faviconUrl: value.favicon_url,
          siteWallpaperUrl: value.site_wallpaper_url,
          heroCoverUrl: value.hero_cover_url,
          discordInviteCoverUrl: value.discord_invite_cover_url,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.appearance) throw new Error(payload.error || "SAVE_FAILED");
      setValue({ ...DEFAULT, ...payload.appearance });
      setNotice("Marca e aparência salvas. A vitrine atualiza sem redeploy.");
      window.dispatchEvent(new Event("crazzy-appearance-updated"));
    } catch (error) {
      setNotice(error instanceof Error ? "Falha: " + error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <main className="crz-appearance-state"><span className="crz-spinner" /></main>;
  if (state === "error") return <main className="crz-appearance-state"><strong>Personalização indisponível.</strong><button onClick={() => void load()}>Tentar novamente</button></main>;

  return (
    <main className="crz-appearance">
      <div className="crz-container">
        <PageHeader
          eyebrow="ADMIN • MARCA & APARÊNCIA"
          title="Personalização completa e marca branca"
          description="Troque identidade, capas, wallpaper, favicon e cores. Tudo fica centralizado no painel administrativo."
          actions={<Badge tone={value.white_label_enabled ? "gold" : customized ? "blue" : "green"}>{value.white_label_enabled ? "WHITE LABEL ATIVO" : customized ? "PERSONALIZADO" : "CRAZZY PADRÃO"}</Badge>}
        />

        <div className="crz-appearance-layout">
          <section className="crz-appearance-editor">
            <div className="crz-appearance-section">
              <header><strong>Identidade da marca</strong><span>Nome, slogan e modo marca branca.</span></header>
              <div className="crz-appearance-grid">
                <label><span>Nome da marca</span><input value={value.brand_name} maxLength={60} onChange={(e) => setValue(v => ({ ...v, brand_name: e.target.value }))} /></label>
                <label><span>Slogan / frase principal</span><input value={value.tagline} maxLength={120} onChange={(e) => setValue(v => ({ ...v, tagline: e.target.value }))} /></label>
              </div>
              <div className="crz-appearance-toggles">
                <label><input type="checkbox" checked={value.white_label_enabled} onChange={(e) => setValue(v => ({ ...v, white_label_enabled: e.target.checked }))} /><span><strong>Modo marca branca</strong><small>Opera com outra identidade visual sem misturar ferramentas administrativas com a experiência do cliente.</small></span></label>
                <label><input type="checkbox" checked={value.show_powered_by} onChange={(e) => setValue(v => ({ ...v, show_powered_by: e.target.checked }))} /><span><strong>Mostrar “Powered by CRAZZY PROJECT”</strong><small>Opcional quando a marca branca estiver ativa.</small></span></label>
              </div>
            </div>

            <div className="crz-appearance-section">
              <header><strong>Logos e ícone</strong><span>Envie a imagem direto do PC ou cole uma URL HTTPS.</span></header>
              {logoAssets.map(asset => (
                <div className="crz-appearance-asset-field" key={asset.field}>
                  <span>{asset.label}</span>
                  <div className="crz-appearance-asset">
                    <input value={value[asset.field]} onChange={(e) => setValue(v => ({ ...v, [asset.field]: e.target.value }))} />
                    <label className={"crz-appearance-upload " + (uploading === asset.field ? "is-busy" : "")}>
                      {uploading === asset.field ? "Enviando..." : "Enviar arquivo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                        disabled={Boolean(uploading)}
                        onChange={(e) => void uploadAsset(asset.kind, asset.field, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="crz-appearance-section">
              <header><strong>Capas e wallpaper</strong><span>Upload direto, sem precisar hospedar a imagem em outro lugar.</span></header>
              {coverAssets.map(asset => (
                <div className="crz-appearance-asset-field" key={asset.field}>
                  <span>{asset.label}</span>
                  <div className="crz-appearance-asset">
                    <input placeholder="Opcional" value={value[asset.field]} onChange={(e) => setValue(v => ({ ...v, [asset.field]: e.target.value }))} />
                    <label className={"crz-appearance-upload " + (uploading === asset.field ? "is-busy" : "")}>
                      {uploading === asset.field ? "Enviando..." : "Enviar arquivo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={Boolean(uploading)}
                        onChange={(e) => void uploadAsset(asset.kind, asset.field, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="crz-appearance-section">
              <header><strong>Paleta</strong><span>Cores globais da identidade.</span></header>
              <div className="crz-appearance-color-grid">
                {colorFields.map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <div className="crz-appearance-color">
                      <input type="color" value={value[key]} onChange={(e) => setValue(v => ({ ...v, [key]: e.target.value.toUpperCase() }))} />
                      <input value={value[key]} maxLength={7} onChange={(e) => setValue(v => ({ ...v, [key]: e.target.value.toUpperCase().slice(0, 7) }))} />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="crz-appearance-section">
              <header><strong>Comportamento visual</strong><span>Tema e efeitos.</span></header>
              <label><span>Tema padrão</span><select value={value.default_theme} onChange={(e) => setValue(v => ({ ...v, default_theme: e.target.value === "light" ? "light" : "dark" }))}><option value="dark">Dark</option><option value="light">Light</option></select></label>
              <div className="crz-appearance-toggles">
                <label><input type="checkbox" checked={value.allow_user_theme} onChange={(e) => setValue(v => ({ ...v, allow_user_theme: e.target.checked }))} /><span><strong>Cliente pode trocar tema</strong><small>Se desligado, o tema definido acima é obrigatório.</small></span></label>
                <label><input type="checkbox" checked={value.motion_enabled} onChange={(e) => setValue(v => ({ ...v, motion_enabled: e.target.checked }))} /><span><strong>Animações globais</strong><small>Transições e movimento do site.</small></span></label>
                <label><input type="checkbox" checked={value.ambient_effects} onChange={(e) => setValue(v => ({ ...v, ambient_effects: e.target.checked }))} /><span><strong>Efeitos ambientes</strong><small>Fumaça, brilho e efeitos decorativos.</small></span></label>
              </div>
            </div>

            {notice && <p className="crz-appearance-notice">{notice}</p>}
            <button className="crz-button crz-button--primary crz-button--md" disabled={busy} onClick={() => void save()}>{busy ? "Salvando..." : "Salvar marca e aparência"}</button>
          </section>

          <aside className="crz-appearance-preview" style={{ backgroundColor: value.background_hex, color: value.text_hex, borderColor: value.accent_hex }}>
            <header><small>PREVIEW AO VIVO</small><Badge tone="blue">{value.default_theme.toUpperCase()}</Badge></header>
            <div className="crz-appearance-preview__frame" style={{ backgroundColor: value.surface_hex, backgroundImage: value.hero_cover_url ? "linear-gradient(rgba(2,6,12,.38),rgba(2,6,12,.82)),url(\"" + value.hero_cover_url + "\")" : undefined, borderColor: value.accent_hex }}>
              <img src={value.logo_hero_url || DEFAULT.logo_hero_url} alt={value.brand_name} />
              <span style={{ color: value.secondary_hex }}>{value.tagline}</span>
              <h2>{value.brand_name || "Sua marca"}</h2>
              <p>{value.white_label_enabled ? "Marca branca pronta para sua operação." : "Identidade CRAZZY PROJECT personalizável."}</p>
              <button type="button" style={{ backgroundColor: value.accent_hex, borderColor: value.secondary_hex }}>Ver produtos</button>
            </div>
            <dl>
              <dt>Marca branca</dt><dd>{value.white_label_enabled ? "Ativa" : "Desligada"}</dd>
              <dt>Logo navbar</dt><dd>{value.logo_navbar_url ? "Configurada" : "Padrão"}</dd>
              <dt>Wallpaper</dt><dd>{value.site_wallpaper_url ? "Configurado" : "Sem wallpaper extra"}</dd>
              <dt>Capa Discord</dt><dd>{value.discord_invite_cover_url ? "Configurada" : "Padrão"}</dd>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
