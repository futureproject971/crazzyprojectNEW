"use client";

import { useMemo, useState } from "react";
import { NeonIcon } from "@/core/design-system";
import { discoveryCategories, discoveryItems, discoveryNews, discoveryTags } from "./data";

export function DiscoveryPage({
  variant = "news",
}: {
  variant?: "news" | "categories" | "highlights";
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState(variant === "highlights" ? "destaques" : "all");

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      discoveryItems.filter((item) => {
        const matchesCategory = category === "all" || item.category === category;
        const matchesTag = tag === "all" || item.tags?.includes(tag);
        const matchesQuery =
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.subtitle.toLowerCase().includes(normalizedQuery);
        return matchesCategory && matchesTag && matchesQuery;
      }),
    [category, tag, normalizedQuery]
  );

  const featured = discoveryItems.filter((item) => item.featured);

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
                : "Descubra o universo CRAZZY"}
          </h1>
          <p>
            {variant === "categories"
              ? "Navegue pelas principais áreas da loja e encontre o tipo de produto que você procura."
              : variant === "highlights"
                ? "Uma seleção visual dos produtos e áreas que merecem atenção agora."
                : "Encontre novidades, categorias e destaques sem precisar caçar pela plataforma inteira."}
          </p>

          <label className="crz-discovery-search">
            <span
              className="crz-discovery-search__icon"
              aria-hidden="true"
              style={{
                WebkitMaskImage: 'url("/icons/search.svg")',
                maskImage: 'url("/icons/search.svg")',
              }}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jogos, categorias, softwares..."
              aria-label="Buscar na CRAZZY PROJECT"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
                ×
              </button>
            )}
          </label>

          <div className="crz-discovery-categories" aria-label="Filtrar por categoria">
            {discoveryCategories.map((item) => {
              const active = category === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => setCategory(item.id)}
                >
                  <img src={item.icon} alt="" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="crz-discovery-tags" aria-label="Filtrar por tendência">
            {discoveryTags.map((item) => {
              const active = tag === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => setTag(item.id)}
                >
                  #{item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="crz-container crz-discovery-content">
        {!normalizedQuery && category === "all" && tag === "all" && (
          <section className="crz-discovery-section" aria-labelledby="trending-title">
            <header className="crz-discovery-section__head">
              <div>
                <span className="crz-discovery-eyebrow">SELEÇÃO CRAZZY</span>
                <h2 id="trending-title">Em alta agora</h2>
              </div>
              <span className="crz-discovery-count">{featured.length} destaques</span>
            </header>

            <div className="crz-discovery-featured">
              {featured.map((item, index) => (
                <article className={`crz-discovery-feature crz-discovery-card--${item.tone}`} key={item.id}>
                  {item.image && <img src={item.image} alt="" aria-hidden="true" />}
                  <div className="crz-discovery-feature__shade" />
                  <div className="crz-discovery-feature__rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="crz-discovery-feature__body">
                    {item.badge && <span>{item.badge}</span>}
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="crz-discovery-section" aria-labelledby="results-title">
          <header className="crz-discovery-section__head">
            <div>
              <span className="crz-discovery-eyebrow">
                {normalizedQuery ? "RESULTADOS" : category === "all" ? "EXPLORE" : "CATEGORIA"}
              </span>
              <h2 id="results-title">
                {normalizedQuery
                  ? `Resultados para “${query.trim()}”`
                  : category === "all"
                    ? "Novidades e categorias"
                    : discoveryCategories.find((item) => item.id === category)?.label}
              </h2>
            </div>
            <span className="crz-discovery-count">{filtered.length} encontrados</span>
          </header>

          {filtered.length > 0 ? (
            <div className="crz-discovery-grid">
              {filtered.map((item) => (
                <article className={`crz-discovery-card crz-discovery-card--${item.tone}`} key={item.id}>
                  <div className="crz-discovery-card__art">
                    {item.image ? (
                      <img src={item.image} alt="" aria-hidden="true" />
                    ) : (
                      <div className="crz-discovery-card__synthetic">
                        <NeonIcon
                          name={
                            item.category === "creation"
                              ? "ai"
                              : item.category === "premium"
                                ? "crown"
                                : "gear"
                          }
                          size={54}
                        />
                      </div>
                    )}
                    {item.badge && <span className="crz-discovery-card__badge">{item.badge}</span>}
                  </div>
                  <div className="crz-discovery-card__body">
                    <small>{discoveryCategories.find((cat) => cat.id === item.category)?.label ?? "CRAZZY"}</small>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                    <a href="/#produtos">Explorar <span aria-hidden="true">→</span></a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="crz-discovery-empty">
              <NeonIcon name="cube" size={52} />
              <h3>Nada encontrado</h3>
              <p>Tente outra busca ou escolha uma categoria diferente.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setTag("all");
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </section>

        {!normalizedQuery && category === "all" && tag === "all" && (
          <section className="crz-discovery-section crz-discovery-news" aria-labelledby="news-title">
            <header className="crz-discovery-section__head">
              <div>
                <span className="crz-discovery-eyebrow">NEWSROOM</span>
                <h2 id="news-title">O que está rolando</h2>
              </div>
            </header>

            <div className="crz-discovery-news__grid">
              {discoveryNews.map((item) => (
                <article key={item.id}>
                  <span>{item.date}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
