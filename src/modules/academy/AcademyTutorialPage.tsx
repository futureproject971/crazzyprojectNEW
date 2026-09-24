"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon } from "@/core/design-system";
import { AcademyBlockRenderer } from "./AcademyBlockRenderer";
import type { AcademyTutorial } from "./types";

export function AcademyTutorialPage({ slug }: { slug: string }) {
  const [tutorial, setTutorial] = useState<AcademyTutorial | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [savedPosition, setSavedPosition] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/academy/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Tutorial indisponível.");
        return payload.tutorial as AcademyTutorial;
      })
      .then(value => {
        setTutorial(value);
        setSavedPosition(value.progress?.last_position || 0);
        setState("ready");
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : "Falha ao carregar.");
        setState("error");
      });
  }, [slug]);

  const maxPosition = useMemo(
    () => tutorial?.blocks.reduce((max,b) => Math.max(max,b.position),0) || 0,
    [tutorial]
  );

  const saveProgress = async (position: number, completed = false) => {
    if (!tutorial?.unlocked || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/academy/progress", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({slug:tutorial.slug,lastPosition:position,completed}),
      });
      if (response.ok) setSavedPosition(Math.max(savedPosition, position));
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") {
    return <main className="crz-academy-detail crz-academy-state"><span className="crz-spinner" /><p>Carregando tutorial...</p></main>;
  }
  if (state === "error" || !tutorial) {
    return <main className="crz-academy-detail crz-academy-state"><NeonIcon name="shield" size={42} /><strong>Tutorial indisponível</strong><p>{error}</p><a className="crz-button crz-button--secondary crz-button--sm" href="/academy">Voltar à Academy</a></main>;
  }

  return (
    <main className="crz-academy-detail">
      <div className="crz-container">
        <nav className="crz-academy-breadcrumb"><a href="/academy">Academy</a><span>›</span><span>{tutorial.title}</span></nav>

        <header className="crz-academy-detail__hero">
          <div>
            <div className="crz-academy-detail__badges">
              <Badge tone={tutorial.locked ? "neutral" : "blue"}>{tutorial.access_type === "public" ? "PÚBLICO" : "PRODUTO"}</Badge>
              <span>{tutorial.category}</span>
              <span>{tutorial.estimated_minutes} min</span>
            </div>
            <h1>{tutorial.title}</h1>
            {tutorial.subtitle && <h2>{tutorial.subtitle}</h2>}
            <p>{tutorial.summary}</p>
          </div>
          <div className="crz-academy-detail__hero-icon"><NeonIcon name={tutorial.locked ? "shield" : "book"} size={58} /></div>
        </header>

        {tutorial.locked ? (
          <section className="crz-academy-lock">
            <NeonIcon name="shield" size={46} />
            <strong>Este tutorial é exclusivo de produto</strong>
            <p>Ele é liberado quando sua conta possui acesso ativo a um dos produtos abaixo.</p>
            <div>{tutorial.products.map(product => <span key={product.id}>{product.name}</span>)}</div>
            <a className="crz-button crz-button--primary crz-button--md" href="/produtos">Ver produtos</a>
          </section>
        ) : (
          <div className="crz-academy-detail__layout">
            <aside className="crz-academy-toc">
              <strong>PROGRESSO</strong>
              <div className="crz-academy-toc__track"><i style={{width: maxPosition ? Math.min(100,(savedPosition/maxPosition)*100) + "%" : "0%"}} /></div>
              <span>{tutorial.progress.completed ? "Concluído ✓" : "Em andamento"}</span>
              <nav>
                {tutorial.blocks.filter(b => ["title","subtitle","step"].includes(b.type)).map(block => (
                  <a key={block.id} href={"#academy-block-" + block.position}>
                    {block.type === "step" ? "Passo " + String((block.content as any)?.number || block.position) : String((block.content as any)?.text || (block.content as any)?.title || "Seção")}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="crz-academy-content">
              {tutorial.blocks.map(block => (
                <section
                  id={"academy-block-" + block.position}
                  key={block.id}
                  className="crz-academy-content__block"
                  onMouseEnter={() => {
                    if (block.position > savedPosition) void saveProgress(block.position,false);
                  }}
                >
                  <AcademyBlockRenderer block={block} />
                </section>
              ))}

              <div className="crz-academy-complete">
                <NeonIcon name="verified" size={30} />
                <div><strong>Chegou ao final?</strong><span>Marque o tutorial como concluído e ele ficará registrado no seu painel.</span></div>
                <button
                  type="button"
                  className="crz-button crz-button--primary crz-button--sm"
                  disabled={tutorial.progress.completed || saving}
                  onClick={() => void saveProgress(maxPosition,true)}
                >
                  {tutorial.progress.completed ? "Concluído ✓" : saving ? "Salvando..." : "Marcar como concluído"}
                </button>
              </div>
            </article>
          </div>
        )}
      </div>
    </main>
  );
}
