"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import type { PublicCategory } from "./types";

export function CategoryDirectoryPage() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = async () => {
    setState("loading");
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("CATEGORIES_UNAVAILABLE");
      setCategories(Array.isArray(payload.categories) ? payload.categories : []);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) =>
      [category.name, category.slug, category.description]
        .some((value) => String(value || "").toLowerCase().includes(normalized))
    );
  }, [categories, query]);

  return (
    <main className="crz-category-directory">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY CATEGORIES"
          title="Explore as categorias"
          description="As categorias ativas da CRAZZY PROJECT, organizadas diretamente pela nossa vitrine."
        />

        <label className="crz-category-directory__search">
          <span>⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogo ou categoria..."
            aria-label="Buscar categorias"
          />
        </label>

        {state === "loading" ? (
          <section className="crz-category-directory__state">
            <span className="crz-spinner" />
            <strong>Carregando categorias...</strong>
          </section>
        ) : state === "error" ? (
          <section className="crz-category-directory__state">
            <NeonIcon name="shield" size={36} />
            <strong>Não foi possível carregar as categorias.</strong>
            <button type="button" onClick={() => void load()}>Tentar novamente</button>
          </section>
        ) : filtered.length ? (
          <section className="crz-category-directory__grid">
            {filtered.map((category) => (
              <a
                key={category.id}
                href={"/produtos?game=" + encodeURIComponent(category.slug || category.id)}
                className="crz-category-directory__card"
                style={{ "--accent": category.accent_color || "#1687ff" } as React.CSSProperties}
              >
                <div className="crz-category-directory__art">
                  {category.image_url ? <img src={category.image_url} alt="" /> : null}
                  <span className="crz-category-directory__icon">
                    {category.icon_url ? <img src={category.icon_url} alt="" /> : category.emoji || "◆"}
                  </span>
                </div>
                <div className="crz-category-directory__body">
                  <small>{category.product_count} produto(s)</small>
                  <h2>{category.name}</h2>
                  <p>{category.description || "Explore os produtos disponíveis nesta categoria."}</p>
                  <span>Explorar categoria →</span>
                </div>
              </a>
            ))}
          </section>
        ) : (
          <section className="crz-category-directory__state">
            <NeonIcon name="cube" size={36} />
            <strong>Nenhuma categoria encontrada.</strong>
            <button type="button" onClick={() => setQuery("")}>Limpar busca</button>
          </section>
        )}
      </div>
    </main>
  );
}
