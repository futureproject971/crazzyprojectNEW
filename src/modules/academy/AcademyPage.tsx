"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { AcademyTutorialCard } from "./types";

export function AcademyPage({ onlyUnlocked = false }: { onlyUnlocked?: boolean }) {
  const [tutorials, setTutorials] = useState<AcademyTutorialCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/academy", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "A Academy não abriu agora.");
      setTutorials(payload.tutorials || []);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Os tutoriais deram uma engasgada.");
      setState("error");
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tutorials.filter((item) => {
      if (onlyUnlocked && !item.unlocked) return false;
      if (!q) return true;
      return [item.title,item.subtitle,item.summary,item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [tutorials, query, onlyUnlocked]);

  return (
    <main className="crz-academy-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY ACADEMY"
          title={onlyUnlocked ? "Teus tutoriais destravados" : "Guia rápido pra não entrar perdido"}
          description={onlyUnlocked
            ? "Guia público e tutorial dos produtos que já estão na tua bag."
            : "Pega o jeito da plataforma e destrava tutorial protegido junto com teus produtos."}
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href={onlyUnlocked ? "/painel" : "/"}>Voltar</a>}
        />

        <div className="crz-academy-search">
          <span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caça um tutorial..." />
          <a href="/status">Status</a>
        </div>

        {state === "loading" && (
          <section className="crz-academy-state"><span className="crz-spinner" /><p>Abrindo a Academy...</p></section>
        )}
        {state === "error" && (
          <section className="crz-academy-state"><NeonIcon name="shield" size={40} /><strong>Não abriu agora</strong><p>{error}</p><button type="button" className="crz-button crz-button--secondary crz-button--sm" onClick={() => void load()}>TENTAR DE NOVO</button></section>
        )}

        {state === "ready" && (
          <>
            <section className="crz-academy-summary">
              <div><strong>{filtered.filter(x => x.unlocked).length}</strong><span>liberados</span></div>
              <div><strong>{filtered.filter(x => x.progress.completed).length}</strong><span>concluídos</span></div>
              <div><strong>{filtered.filter(x => x.locked).length}</strong><span>protegidos</span></div>
            </section>

            {!filtered.length ? (
              <section className="crz-academy-state">
                <NeonIcon name="book" size={42} />
                <strong>Nada bateu nessa busca</strong>
                <p>Mexe na busca ou volta depois. Conteúdo novo entra sem bater na porta.</p>
              </section>
            ) : (
              <section className="crz-academy-grid">
                {filtered.map((item) => (
                  <article key={item.id} className={(item.locked ? "is-locked " : "") + (item.featured ? "is-featured" : "")}>
                    <div className="crz-academy-card__art">
                      {item.cover_url ? <img src={item.cover_url} alt="" /> : <NeonIcon name={item.locked ? "shield" : "book"} size={50} />}
                      {item.featured && <Badge tone="blue">DESTAQUE</Badge>}
                    </div>
                    <div className="crz-academy-card__body">
                      <div className="crz-academy-card__meta">
                        <span>{item.category}</span>
                        <span>{item.estimated_minutes} min</span>
                      </div>
                      <h2>{item.title}</h2>
                      {item.subtitle && <strong>{item.subtitle}</strong>}
                      <p>{item.summary}</p>

                      {item.access_type === "product" && (
                        <div className="crz-academy-card__products">
                          {item.products.slice(0,3).map(product => <span key={product.id}>{product.name}</span>)}
                        </div>
                      )}

                      {item.unlocked && item.progress.last_position > 0 && (
                        <div className="crz-academy-card__progress">
                          <i style={{ width: item.progress.completed ? "100%" : Math.min(90, Math.max(10, item.progress.last_position * 8)) + "%" }} />
                        </div>
                      )}

                      <footer>
                        <Badge tone={item.locked ? "neutral" : item.progress.completed ? "green" : "blue"}>
                          {item.locked ? "BLOQUEADO" : item.progress.completed ? "CONCLUÍDO" : item.access_type === "public" ? "PÚBLICO" : "LIBERADO"}
                        </Badge>
                        <a className={"crz-button crz-button--" + (item.locked ? "secondary" : "primary") + " crz-button--sm"} href={"/academy/" + item.slug}>
                          {item.locked ? "VER O QUE FALTA" : item.progress.completed ? "Rever" : "ABRIR E METER FICHA"}
                        </a>
                      </footer>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
