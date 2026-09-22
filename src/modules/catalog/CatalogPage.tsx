"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  NeonIcon,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from "@/core/design-system";
import {
  catalogCategories,
  catalogProducts,
  catalogSortOptions,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogSort,
} from "./data";

const PAGE_SIZE = 8;

function ProductIcon({ product }: { product: CatalogProduct }) {
  const name = product.icon ?? "cube";
  return <NeonIcon name={name} size={58} />;
}

function StockBadge({ product }: { product: CatalogProduct }) {
  const tone =
    product.stock === "available" ? "green" : product.stock === "limited" ? "gold" : "neutral";

  return (
    <span className={`crz-catalog-stock crz-catalog-stock--${product.stock}`}>
      <i aria-hidden="true" />
      {product.stockLabel}
      <Badge tone={tone}>{product.stock === "out" ? "OFF" : "ON"}</Badge>
    </span>
  );
}

function ProductBadges({ product }: { product: CatalogProduct }) {
  if (!product.badges?.length) return null;

  return (
    <div className="crz-catalog-card__badges">
      {product.badges.map((badge) => (
        <Badge
          key={badge}
          tone={
            badge === "PROMO"
              ? "pink"
              : badge === "PREMIUM"
                ? "gold"
                : badge === "NOVO"
                  ? "blue"
                  : "green"
          }
        >
          {badge}
        </Badge>
      ))}
    </div>
  );
}

export function CatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CatalogCategory>("all");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const result = catalogProducts.filter((product) => {
      const matchesQuery =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        product.subtitle.toLowerCase().includes(normalized);

      const matchesCategory = category === "all" || product.category === category;
      const matchesAvailable = !onlyAvailable || product.stock !== "out";
      const matchesPromo = !onlyPromo || product.promo;

      return matchesQuery && matchesCategory && matchesAvailable && matchesPromo;
    });

    return [...result].sort((a, b) => {
      if (sort === "popular") return b.popularity - a.popularity;
      if (sort === "newest") return b.createdOrder - a.createdOrder;
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");

      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.popularity - a.popularity;
    });
  }, [query, category, onlyAvailable, onlyPromo, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateFilter = (callback: () => void) => {
    callback();
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setSort("featured");
    setOnlyAvailable(false);
    setOnlyPromo(false);
    setPage(1);
  };

  const activeFilters =
    (category !== "all" ? 1 : 0) +
    (onlyAvailable ? 1 : 0) +
    (onlyPromo ? 1 : 0) +
    (query.trim() ? 1 : 0);

  return (
    <main className="crz-catalog">
      <section className="crz-catalog-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY CATALOG"
            title="Produtos"
            description="Vasculha o arsenal por categoria, novidade, destaque e o que tá pronto pra jogo."
            actions={
              <a className="crz-catalog-discovery-link" href="/destaques">
                <NeonIcon name="featured" size={22} />
                Ver destaques
              </a>
            }
          />

          <div className="crz-catalog-toolbar">
            <SearchInput
              id="catalog-search"
              value={query}
              onChange={(event) => updateFilter(() => setQuery(event.target.value))}
              placeholder="Caça teu próximo item..."
              aria-label="Caçar produtos"
            />

            <Select
              id="catalog-sort"
              value={sort}
              onChange={(event) => updateFilter(() => setSort(event.target.value as CatalogSort))}
              aria-label="Ordenar catálogo"
            >
              {catalogSortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  Ordenar: {option.label}
                </option>
              ))}
            </Select>

            <Button
              className="crz-catalog-filter-button"
              variant="secondary"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
            >
              Filtros{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
          </div>

          <div className="crz-catalog-category-strip" aria-label="Categorias do catálogo">
            {catalogCategories.map((item) => {
              const active = category === item.id;

              return (
                <button
                  type="button"
                  key={item.id}
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() =>
                    updateFilter(() => setCategory(item.id as "all" | CatalogCategory))
                  }
                >
                  <img src={item.icon} alt="" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="crz-container crz-catalog-layout">
        <aside className={`crz-catalog-filters ${filtersOpen ? "is-open" : ""}`}>
          <div className="crz-catalog-filters__head">
            <div>
              <span>REFINAR</span>
              <h2>Filtros</h2>
            </div>
            {activeFilters > 0 && (
              <button type="button" onClick={clearFilters}>
                Limpar
              </button>
            )}
          </div>

          <fieldset className="crz-catalog-filter-group">
            <legend>Categoria</legend>
            {catalogCategories.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="catalog-category"
                  value={item.id}
                  checked={category === item.id}
                  onChange={() =>
                    updateFilter(() => setCategory(item.id as "all" | CatalogCategory))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="crz-catalog-filter-group">
            <legend>Disponibilidade</legend>
            <label>
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) =>
                  updateFilter(() => setOnlyAvailable(event.target.checked))
                }
              />
              <span>Só o que tá no jogo</span>
            </label>
          </fieldset>

          <fieldset className="crz-catalog-filter-group">
            <legend>Ofertas</legend>
            <label>
              <input
                type="checkbox"
                checked={onlyPromo}
                onChange={(event) => updateFilter(() => setOnlyPromo(event.target.checked))}
              />
              <span>Preço no chão</span>
            </label>
          </fieldset>

          <div className="crz-catalog-filter-note">
            <NeonIcon name="shield" size={28} />
            <div>
              <strong>Compra rápida, sem labirinto</strong>
              <span>Escolhe o bagulho, confere tudo e só depois mete ficha.</span>
            </div>
          </div>
        </aside>

        <section className="crz-catalog-results" aria-labelledby="catalog-results-title">
          <header className="crz-catalog-results__head">
            <div>
              <span className="crz-catalog-results__eyebrow">VITRINE</span>
              <h2 id="catalog-results-title">
                {category === "all"
                  ? "O arsenal todo"
                  : catalogCategories.find((item) => item.id === category)?.label}
              </h2>
            </div>

            <div className="crz-catalog-results__meta">
              <strong>{filtered.length}</strong>
              <span>{filtered.length === 1 ? "produto" : "produtos"}</span>
            </div>
          </header>

          {pageItems.length > 0 ? (
            <>
              <div className="crz-catalog-grid">
                {pageItems.map((product) => (
                  <article
                    key={product.id}
                    className={`crz-catalog-card ${product.stock === "out" ? "is-unavailable" : ""}`}
                  >
                    <div className="crz-catalog-card__art">
                      {product.image ? (
                        <img src={product.image} alt="" aria-hidden="true" />
                      ) : (
                        <div className="crz-catalog-card__synthetic">
                          <div className="crz-catalog-card__orb" aria-hidden="true" />
                          <ProductIcon product={product} />
                        </div>
                      )}

                      <ProductBadges product={product} />

                      <button
                        type="button"
                        className="crz-catalog-card__favorite"
                        aria-label={`Favoritar ${product.name}`}
                      >
                        ♡
                      </button>
                    </div>

                    <div className="crz-catalog-card__body">
                      <div className="crz-catalog-card__category">
                        {catalogCategories.find((item) => item.id === product.category)?.label}
                      </div>

                      <h3>{product.name}</h3>
                      <p>{product.subtitle}</p>

                      <StockBadge product={product} />

                      <div className="crz-catalog-card__footer">
                        <span className="crz-catalog-card__mock-price">
                          <small>VALOR</small>
                          <strong>Consultar</strong>
                        </span>

                        <a
                          href={`/produto/${product.slug}`}
                          aria-disabled={product.stock === "out" ? true : undefined}
                          className={product.stock === "out" ? "is-disabled" : ""}
                        >
                          Ver produto
                          <span aria-hidden="true">→</span>
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <footer className="crz-catalog-pagination">
                <div>
                  Página <strong>{safePage}</strong> de <strong>{totalPages}</strong>
                </div>
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onChange={(nextPage) => {
                    setPage(nextPage);
                    window.scrollTo({ top: 360, behavior: "smooth" });
                  }}
                />
              </footer>
            </>
          ) : (
            <EmptyState
              title="Nada caiu nessa busca"
              description="Mexe na busca ou nos filtros e tenta outro caminho."
              icon={<NeonIcon name="cube" size={30} />}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
