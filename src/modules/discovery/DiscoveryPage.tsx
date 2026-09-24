"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonIcon } from "@/core/design-system";
import {
  formatBrl,
  getProductStartingPrice,
  getProductStock,
  type PublicStoreProduct,
} from "@/modules/catalog/live";

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  image_url: string | null;
  product_count: number;
};

export function DiscoveryPage({
  variant = "news",
}: {
  variant?: "news" | "categories" | "highlights";
}) {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState<"all" | "new" | "available">(
    variant === "highlights" ? "available" : "all"
  );

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      fetch("/api/products", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("CATALOG");
        return Array.isArray(payload?.products) ? payload.products as PublicStoreProduct[] : [];
      }),
      fetch("/api/categories", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("CATEGORIES");
        return Array.isArray(payload?.categories) ? payload.categories as PublicCategory[] : [];
      }),
    ])
      .then(([productRows, categoryRows]) => {
        if (!mounted) return;
        setProducts(productRows);
        setCategories(categoryRows);
        setState("ready");
      })
      .catch(() => {
        if (mounted) setState("error");
      });
    return () => { mounted = false; };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return products
      .filter((item) => {
        const matchesCategory = category === "all" || item.game?.slug === category;
        const matchesTag =
          tag === "all" ||
          (tag === "new" && item.is_new) ||
          (tag === "available" && getProductStock(item).state !== "out");
        const matchesQuery =
          !normalizedQuery ||
          item.name.toLowerCase().includes(normalizedQuery) ||
          String(item.description || "").toLowerCase().includes(normalizedQuery) ||
          String(item.game?.name || "").toLowerCase().includes(normalizedQuery);
        return matchesCategory && matchesTag && matchesQuery;
      })
      .sort((a, b) => {
        if (variant === "news") return Number(Boolean(b.is_new)) - Number(Boolean(a.is_new)) || a.sort_order - b.sort_order;
        return a.sort_order - b.sort_order;
      });
  }, [products, category, tag, normalizedQuery, variant]);

  const featured = products
    .filter((item) => getProductStock(item).state !== "out")
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5);

  return (
    <main className="crz-discovery">
      <section className="crz-discovery-hero">
        <div className="crz-discovery-hero__glow" aria-hidden="true" />
        <div className="crz-container crz-discovery-hero__inner">
          <div className="crz-discovery-kicker">
            <NeonIcon name="featured" size={34} />
            <span>{variant === "categories" ? "CRAZZY CATEGORIES" : variant === "highlights" ? "CRAZZY HIGHLIGHTS" : "CRAZZY DISCOVERY"}</span>
          </div>
          <h1>
            {variant === "categories"
              ? "Explore as categorias"
              : variant === "highlights"
                ? "Destaques da CRAZZY"
                : "Novidades do catálogo"}
          </h1>
          <p>
            {variant === "categories"
              ? "Categorias e produtos ativos publicados no sistema comercial."
              : variant === "highlights"
                ? "Produtos ativos em evidência no catálogo CRAZZY PROJECT."
                : "Produtos novos e alterações publicadas no catálogo real."}
          </p>

          <label className="crz-discovery-search">
            <span className="crz-discovery-search__icon" aria-hidden="true" style={{ WebkitMaskImage: 'url("/icons/search.svg")', maskImage: 'url("/icons/search.svg")' }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produtos ou jogos..."
              aria-label="Buscar na CRAZZY PROJECT"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}
          </label>

          <div className="crz-discovery-categories" aria-label="Filtrar por categoria">
            <button type="button" className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>
              <img src="/icons/neon-v2/cube.svg" alt="" aria-hidden="true" /><span>Tudo</span>
            </button>
            {categories.map((item) => (
              <button
                type="button"
                key={item.id}
                className={category === item.slug ? "is-active" : ""}
                aria-pressed={category === item.slug}
                onClick={() => setCategory(item.slug)}
              >
                <img src={item.icon_url || item.image_url || "/icons/neon-v2/gamepad.svg"} alt="" aria-hidden="true" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="crz-discovery-tags" aria-label="Filtrar catálogo">
            {[
              { id: "all" as const, label: "Todos" },
              { id: "new" as const, label: "Novos" },
              { id: "available" as const, label: "Disponíveis" },
            ].map((item) => (
              <button type="button" key={item.id} className={tag === item.id ? "is-active" : ""} onClick={() => setTag(item.id)}>
                #{item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="crz-container crz-discovery-content">
        {state === "loading" ? (
          <div className="crz-discovery-empty"><span className="crz-spinner" /><h3>Carregando catálogo...</h3></div>
        ) : state === "error" ? (
          <div className="crz-discovery-empty"><NeonIcon name="cube" size={52} /><h3>Catálogo indisponível</h3><p>Tente novamente em instantes.</p></div>
        ) : (
          <>
            {!normalizedQuery && category === "all" && variant === "highlights" && featured.length > 0 && (
              <section className="crz-discovery-section" aria-labelledby="trending-title">
                <header className="crz-discovery-section__head">
                  <div><span className="crz-discovery-eyebrow">CATÁLOGO ATIVO</span><h2 id="trending-title">Em destaque</h2></div>
                  <span className="crz-discovery-count">{featured.length} produtos</span>
                </header>
                <div className="crz-discovery-featured">
                  {featured.map((item, index) => (
                    <a className="crz-discovery-feature crz-discovery-card--blue" key={item.id} href={"/produto/" + item.slug}>
                      {(item.image_url || item.game?.image_url) && <img src={item.image_url || item.game.image_url || ""} alt="" aria-hidden="true" />}
                      <div className="crz-discovery-feature__shade" />
                      <div className="crz-discovery-feature__rank">{String(index + 1).padStart(2, "0")}</div>
                      <div className="crz-discovery-feature__body">
                        {item.is_new && <span>NOVO</span>}
                        <h3>{item.name}</h3>
                        <p>{item.description || item.game?.name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section className="crz-discovery-section" aria-labelledby="results-title">
              <header className="crz-discovery-section__head">
                <div>
                  <span className="crz-discovery-eyebrow">{normalizedQuery ? "RESULTADOS" : "CATÁLOGO REAL"}</span>
                  <h2 id="results-title">
                    {normalizedQuery
                      ? `Resultados para “${query.trim()}”`
                      : category === "all"
                        ? variant === "categories" ? "Produtos por categoria" : "Produtos ativos"
                        : categories.find((item) => item.slug === category)?.name}
                  </h2>
                </div>
                <span className="crz-discovery-count">{filtered.length} encontrados</span>
              </header>

              {filtered.length > 0 ? (
                <div className="crz-discovery-grid">
                  {filtered.map((item) => {
                    const price = getProductStartingPrice(item);
                    const stock = getProductStock(item);
                    return (
                      <article className="crz-discovery-card crz-discovery-card--blue" key={item.id}>
                        <div className="crz-discovery-card__art">
                          {item.image_url || item.game?.image_url ? (
                            <img src={item.image_url || item.game.image_url || ""} alt="" aria-hidden="true" />
                          ) : (
                            <div className="crz-discovery-card__synthetic"><NeonIcon name="gamepad" size={54} /></div>
                          )}
                          {item.is_new && <span className="crz-discovery-card__badge">NOVO</span>}
                        </div>
                        <div className="crz-discovery-card__body">
                          <small>{item.game?.name || "CRAZZY"}</small>
                          <h3>{item.name}</h3>
                          <p>{price == null ? stock.label : formatBrl(price) + " • " + stock.label}</p>
                          <a href={"/produto/" + item.slug}>Ver produto <span aria-hidden="true">→</span></a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="crz-discovery-empty">
                  <NeonIcon name="cube" size={52} />
                  <h3>{products.length ? "Nada encontrado" : "Nenhum produto publicado"}</h3>
                  <p>{products.length ? "Tente outra busca ou categoria." : "Os produtos aparecem aqui automaticamente quando forem ativados."}</p>
                  {products.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("all"); setTag("all"); }}>Limpar filtros</button>}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
