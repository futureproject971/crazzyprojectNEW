"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";

type RuntimePayload = {
  mode: "embed" | "external";
  url: string;
  source: "environment" | "default";
  health: {
    reachable: boolean;
    status: number | null;
    latencyMs: number;
  };
};

const FALLBACK_URL = "https://mtsounds.vercel.app/";

export function MtSoundsPage() {
  const [runtime, setRuntime] = useState<RuntimePayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const via = String(params.get("via") || "").trim().toLowerCase();
    if (via) {
      void fetch("/api/referral/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: via, source: "mtsounds" }),
      }).finally(() => {
        params.delete("via");
        const next = params.toString() ? "/mtsounds?" + params.toString() : "/mtsounds";
        window.history.replaceState({}, "", next);
      });
    }

    let active = true;

    void fetch("/api/mtsounds", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("STATUS_UNAVAILABLE");
        return response.json() as Promise<RuntimePayload>;
      })
      .then((payload) => {
        if (active) setRuntime(payload);
      })
      .catch(() => {
        if (active) {
          setRuntime({
            mode: "embed",
            url: FALLBACK_URL,
            source: "default",
            health: { reachable: false, status: null, latencyMs: 0 },
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loaded) return;
    const slowTimer = window.setTimeout(() => setSlow(true), 6000);
    const failTimer = window.setTimeout(() => setFrameFailed(true), 12000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(failTimer);
    };
  }, [loaded]);

  const partnerUrl = runtime?.url || FALLBACK_URL;
  const externalOnly = runtime?.mode === "external";
  const badge = useMemo(() => {
    if (!runtime) return { tone: "blue" as const, text: "CHECANDO" };
    if (runtime.health.reachable) return { tone: "green" as const, text: "ONLINE" };
    return { tone: "gold" as const, text: "FALLBACK" };
  }, [runtime]);

  return (
    <main className="crz-mtsounds-page">
      <div className="crz-container crz-mtsounds-container">
        <PageHeader
          eyebrow="M46 • PARCEIRO CRAZZY"
          title="MTSOUNDS"
          description="MTSOUNDS integrado dentro da CRAZZY PROJECT, com fallback externo somente se o parceiro bloquear o embed."
          actions={
            <div className="crz-mtsounds-actions">
              <Badge tone="green">GRÁTIS</Badge>
              <Badge tone={badge.tone}>{badge.text}</Badge>
            </div>
          }
        />

        <section className="crz-mtsounds-notice">
          <NeonIcon name="community" size={29} />
          <div>
            <strong>MTSOUNDS dentro da CRAZZY PROJECT</strong>
            <span>
              Nenhum login, token ou dado privado da CRAZZY PROJECT é enviado para o app parceiro.
            </span>
          </div>
        </section>

        <section className="crz-mtsounds-frame-shell">
          <header>
            <div>
              <i className="is-red" />
              <i className="is-yellow" />
              <i className="is-green" />
            </div>
            <span>MTSOUNDS • M46 COMPAT</span>
            <strong>
              {externalOnly
                ? "MODO EXTERNO"
                : loaded
                  ? "EMBED ATIVO"
                  : frameFailed
                    ? "FALLBACK"
                    : "CONECTANDO..."}
            </strong>
          </header>

          <div className="crz-mtsounds-frame-wrap">
            {externalOnly ? (
              <div className="crz-mtsounds-external">
                <NeonIcon name="community" size={42} />
                <strong>MTSOUNDS está configurado para abrir externamente</strong>
                <p>
                  Esse modo evita iframe quando o parceiro aplica bloqueio de embed ou política de segurança própria.
                </p>
                <a
                  className="crz-button crz-button--primary crz-button--md"
                  href={partnerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir MTSOUNDS
                </a>
              </div>
            ) : (
              <>
                {!loaded && (
                  <div className="crz-mtsounds-loading">
                    <span className="crz-spinner" />
                    <strong>{frameFailed ? "O embed não confirmou carregamento" : "Carregando MTSOUNDS"}</strong>
                    <p>
                      {frameFailed
                        ? "O parceiro pode estar offline ou bloqueando iframe. Use a abertura externa sem perder a rota CRAZZY."
                        : "A ferramenta está sendo aberta numa área isolada da CRAZZY PROJECT."}
                    </p>
                    {(slow || frameFailed) && (
                      <a
                        className="crz-button crz-button--secondary crz-button--sm"
                        href={partnerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir em nova aba
                      </a>
                    )}
                  </div>
                )}

                <iframe
                  className={loaded ? "is-loaded" : ""}
                  src={partnerUrl}
                  title="MTSOUNDS"
                  onLoad={() => {
                    setLoaded(true);
                    setFrameFailed(false);
                  }}
                  onError={() => setFrameFailed(true)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                  allow="autoplay; clipboard-read; clipboard-write"
                  referrerPolicy="no-referrer"
                />
              </>
            )}
          </div>
        </section>

        <section className="crz-mtsounds-footer-note">
          <NeonIcon name="shield" size={25} />
          <div>
            <strong>MTSOUNDS • integração CRAZZY ativa</strong>
            <span>
              A migração 100% nativa do código continua sendo uma troca de implementação quando o source/repo original estiver disponível, sem mudar a rota pública.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
