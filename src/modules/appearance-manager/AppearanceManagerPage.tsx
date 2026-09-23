"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";

type Appearance = {
  id?: string;
  default_theme: "dark" | "light";
  allow_user_theme: boolean;
  accent_hex: string;
  motion_enabled: boolean;
  ambient_effects: boolean;
  updated_at?: string;
};

const DEFAULT: Appearance = {
  default_theme: "dark",
  allow_user_theme: true,
  accent_hex: "#0000FF",
  motion_enabled: true,
  ambient_effects: true,
};

export function AppearanceManagerPage() {
  const [value, setValue] = useState<Appearance>(DEFAULT);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/appearance", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.appearance) throw new Error();
      setValue(payload.appearance as Appearance);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changedFromBrand = useMemo(
    () => value.accent_hex.toUpperCase() !== "#0000FF",
    [value.accent_hex]
  );

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
          motionEnabled: value.motion_enabled,
          ambientEffects: value.ambient_effects,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.appearance) throw new Error(payload.error || "SAVE_FAILED");

      setValue(payload.appearance);
      setNotice("Aparência global salva.");
      window.dispatchEvent(new Event("crazzy-appearance-updated"));
    } catch (error) {
      setNotice(error instanceof Error ? "Falha: " + error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return <main className="crz-appearance-state"><span className="crz-spinner" /></main>;
  }
  if (state === "error") {
    return <main className="crz-appearance-state"><strong>Appearance Manager indisponível.</strong><button onClick={() => void load()}>Tentar novamente</button></main>;
  }

  return (
    <main className="crz-appearance">
      <div className="crz-container">
        <PageHeader
          eyebrow="M39 • APPEARANCE"
          title="A identidade continua CRAZZY"
          description="Controle tema e efeitos globais sem alterar nome, logo ou estrutura oficial da marca."
          actions={<Badge tone={changedFromBrand ? "gold" : "blue"}>{changedFromBrand ? "ACCENT CUSTOM" : "AZUL OFICIAL #0000FF"}</Badge>}
        />

        <div className="crz-appearance-layout">
          <section className="crz-appearance-editor">
            <header><strong>Configuração global</strong><span>Vale para visitantes e clientes.</span></header>

            <label>
              <span>Tema padrão</span>
              <select value={value.default_theme} onChange={(event) => setValue(current => ({ ...current, default_theme: event.target.value === "light" ? "light" : "dark" }))}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>

            <label>
              <span>Cor de destaque</span>
              <div className="crz-appearance-color">
                <input type="color" value={value.accent_hex} onChange={(event) => setValue(current => ({ ...current, accent_hex: event.target.value.toUpperCase() }))} />
                <input value={value.accent_hex} onChange={(event) => setValue(current => ({ ...current, accent_hex: event.target.value.toUpperCase().slice(0, 7) }))} />
                <button type="button" onClick={() => setValue(current => ({ ...current, accent_hex: "#0000FF" }))}>Reset #0000FF</button>
              </div>
            </label>

            <div className="crz-appearance-toggles">
              <label><input type="checkbox" checked={value.allow_user_theme} onChange={(event) => setValue(current => ({ ...current, allow_user_theme: event.target.checked }))} /><span><strong>Usuário pode trocar tema</strong><small>Quando desligado, o tema padrão é obrigatório.</small></span></label>
              <label><input type="checkbox" checked={value.motion_enabled} onChange={(event) => setValue(current => ({ ...current, motion_enabled: event.target.checked }))} /><span><strong>Animações globais</strong><small>Desliga transições decorativas quando necessário.</small></span></label>
              <label><input type="checkbox" checked={value.ambient_effects} onChange={(event) => setValue(current => ({ ...current, ambient_effects: event.target.checked }))} /><span><strong>Efeitos ambientes</strong><small>Controle para fumaça, brilho e efeitos decorativos compatíveis.</small></span></label>
            </div>

            {notice && <p className="crz-appearance-notice">{notice}</p>}
            <button className="crz-button crz-button--primary crz-button--md" disabled={busy} onClick={() => void save()}>{busy ? "Salvando..." : "Salvar aparência global"}</button>
          </section>

          <aside className="crz-appearance-preview" style={{ ["--preview-accent" as string]: value.accent_hex }}>
            <header><small>PREVIEW</small><Badge tone="blue">{value.default_theme.toUpperCase()}</Badge></header>
            <div className={"crz-appearance-preview__frame is-" + value.default_theme}>
              <img src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />
              <span>QUEM NAO XITA NAO BRILHA</span>
              <h2>CRAZZY PROJECT</h2>
              <p>Branco, preto e azul continuam mandando no tabuleiro.</p>
              <button type="button">Ver produtos</button>
            </div>
            <dl>
              <dt>Troca de tema</dt><dd>{value.allow_user_theme ? "Liberada" : "Bloqueada"}</dd>
              <dt>Movimento</dt><dd>{value.motion_enabled ? "Ativo" : "Reduzido"}</dd>
              <dt>Ambiente</dt><dd>{value.ambient_effects ? "Ativo" : "Desligado"}</dd>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
