"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { HelpSearchResult } from "./types";

const quickSearches = [
  "cupom",
  "ticket",
  "tutorial",
  "rank",
  "roleta",
  "compra",
];

export function HelpPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<HelpSearchResult>({
    query: "",
    faqs: [],
    tutorials: [],
  });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      setError("");

      try {
        const params = new URLSearchParams({ limit: "60" });
        if (query.trim()) params.set("q", query.trim());

        const response = await fetch("/api/help?" + params.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "A busca deu uma engasgada.");
        }

        setResult({
          query: payload.query || "",
          faqs: payload.faqs || [],
          tutorials: payload.tutorials || [],
        });
        setState("ready");
      } catch (requestError) {
        if ((requestError as Error).name === "AbortError") return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "A Central de Ajuda tropeçou. Já já volta pro mapa."
        );
        setState("error");
      }
    }, query ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const count = result.faqs.length + result.tutorials.length;
  const searched = query.trim().length > 0;

  const categories = useMemo(() => {
    const values = new Set(result.faqs.map(item => item.category));
    return Array.from(values);
  }, [result.faqs]);

  return (
    <main className="crz-help-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY HELP"
          title="Travou? Joga a dúvida aqui."
          description="Manda a dúvida e a gente caça resposta, tutorial e atalho sem te fazer rodar o mapa inteiro."
          actions={
            <a className="crz-button crz-button--secondary crz-button--sm" href="/tickets">
              CHAMAR O SUPORTE
            </a>
          }
        />

        <section className="crz-help-search-hero">
          <div className="crz-help-search-box">
            <NeonIcon name="book" size={25} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value.slice(0, 120))}
              placeholder="Ex.: como eu uso esse cupom aqui?"
              autoComplete="off"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
                ×
              </button>
            )}
          </div>

          <div className="crz-help-quick-search">
            <span>ATALHOS RÁPIDOS</span>
            <div>
              {quickSearches.map(item => (
                <button type="button" key={item} onClick={() => setQuery(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        {state === "loading" && (
          <section className="crz-help-state">
            <span className="crz-spinner" />
            <p>Caçando a resposta...</p>
          </section>
        )}

        {state === "error" && (
          <section className="crz-help-state">
            <NeonIcon name="shield" size={38} />
            <strong>A busca bugou por um segundo</strong>
            <p>{error}</p>
          </section>
        )}

        {state === "ready" && (
          <>
            <section className="crz-help-overview">
              <div>
                <small>{searched ? "RESULTADOS" : "QG DE AJUDA"}</small>
                <strong>{count}</strong>
                <span>{searched ? "coisa(s) útil(eis) achada(s)" : "atalhos na mesa"}</span>
              </div>
              <div>
                <small>FAQ</small>
                <strong>{result.faqs.length}</strong>
                <span>resposta sem enrolação</span>
              </div>
              <div>
                <small>ACADEMY</small>
                <strong>{result.tutorials.length}</strong>
                <span>tutorial(is) na pista</span>
              </div>
            </section>

            {count === 0 ? (
              <section className="crz-help-empty">
                <NeonIcon name="ticket" size={42} />
                <strong>Nada bateu com essa busca</strong>
                <p>
                  Tenta outra palavra. Se continuar zoado, chama o suporte que a gente entra no round contigo.
                </p>
                <a className="crz-button crz-button--primary crz-button--md" href="/tickets/novo">
                  Abrir ticket
                </a>
              </section>
            ) : (
              <div className="crz-help-layout">
                <section className="crz-help-faqs">
                  <header>
                    <div>
                      <small>FAQ</small>
                      <h2>Resposta sem enrolação</h2>
                    </div>
                    {categories.length > 0 && (
                      <span>{categories.slice(0, 3).join(" • ")}</span>
                    )}
                  </header>

                  <div className="crz-help-faq-list">
                    {result.faqs.map(item => (
                      <details key={item.id}>
                        <summary>
                          <span>{item.question}</span>
                          <b>+</b>
                        </summary>
                        <div>
                          <small>{item.category}</small>
                          <p>{item.answer}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>

                <aside className="crz-help-tutorials">
                  <header>
                    <small>CRAZZY ACADEMY</small>
                    <h2>Tutoriais pra meter ficha</h2>
                  </header>

                  {!result.tutorials.length ? (
                    <div className="crz-help-tutorials__empty">
                      <NeonIcon name="book" size={32} />
                      <span>Nenhum tutorial casou com essa busca.</span>
                    </div>
                  ) : (
                    <div className="crz-help-tutorial-list">
                      {result.tutorials.map(item => (
                        <a href={"/academy/" + item.slug} key={item.id}>
                          <div>
                            {item.cover_url
                              ? <img src={item.cover_url} alt="" />
                              : <NeonIcon name="book" size={29} />}
                          </div>
                          <span>
                            <small>{item.category}</small>
                            <strong>{item.title}</strong>
                            <p>{item.summary}</p>
                            <em>{item.estimated_minutes} min</em>
                          </span>
                          {item.featured && <Badge tone="blue">DESTAQUE</Badge>}
                        </a>
                      ))}
                    </div>
                  )}

                  <a className="crz-button crz-button--secondary crz-button--sm" href="/academy">
                    COLAR NA CRAZZY ACADEMY
                  </a>
                </aside>
              </div>
            )}

            <section className="crz-help-support">
              <NeonIcon name="ticket" size={31} />
              <div>
                <strong>Ainda tá pegando fogo?</strong>
                <span>
                  Abre um ticket e fica no papo por aqui mesmo.
                </span>
              </div>
              <a className="crz-button crz-button--primary crz-button--sm" href="/tickets/novo">
                CHAMAR AGORA
              </a>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
