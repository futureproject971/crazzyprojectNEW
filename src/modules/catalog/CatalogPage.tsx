"use client";

import { useEffect, useMemo, useState } from "react";
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
  formatBrl,
  getProductStartingPrice,
  getProductStock,
  type PublicStoreProduct,
} from "./live";

const PAGE_SIZE = 8;
type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "name";

function StockBadge({ product }: { product: PublicStoreProduct }) {
  const stock = getProductStock(product);
  const tone = stock.state === "available" ? "green" : stock.state === "limited" ? "gold" : "neutral";

  return (
    <span className={`crz-catalog-stock crz-catalog-stock--${stock.state}`}>
      <i aria-hidden="true" />
      {stock.label}
      <Badge tone={tone}>{stock.state === "out" ? "OFF" : "ON"}</Badge>
    </span>
  );
}

export function CatalogPage({ initialCategory = "all" }: { initialCategory?: string }) {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory || "all");
  const [sort, setSort] = useState<Sort>("featured");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    setLoadState("loading");
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.products)) throw new Error("CATALOG_UNAVAILABLE");
      setProducts(payload.products);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; label: string; icon: string | null }>();
    for (const product of products) {
      if (!product.game?.slug) continue;
      map.set(product.game.slug, {
        id: product.game.slug,
        label: product.game.name || product.game.slug,
        icon: product.game.icon_url || product.game.image_url || null,
      });
    }
    return [{ id: "all", label: "Todos", icon: "/icons/neon-v2/cube.svg" }, ...map.values()];
  }, [products]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesQuery =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        String(product.description || "").toLowerCase().includes(normalized) ||
        String(product.game?.name || "").toLowerCase().includes(normalized);
      const matchesCategory = category === "all" || product.game?.slug === category;
      const matchesAvailable = !onlyAvailable || getProductStock(product).state !== "out";
      return matchesQuery && matchesCategory && matchesAvailable;
    });

    return [...result].sort((a, b) => {
      if (sort === "newest") return Number(Boolean(b.is_new)) - Number(Boolean(a.is_new)) || b.sort_order - a.sort_order;
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "price-asc") return (getProductStartingPrice(a) ?? Infinity) - (getProductStartingPrice(b) ?? Infinity);
      if (sort === "price-desc") return (getProductStartingPrice(b) ?? -Infinity) - (getProductStartingPrice(a) ?? -Infinity);
      return a.sort_order - b.sort_order;
    });
  }, [products, query, category, onlyAvailable, sort]);

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
    setPage(1);
  };

  const activeFilters = (category !== "all" ? 1 : 0) + (onlyAvailable ? 1 : 0) + (query.trim() ? 1 : 0);

  return (
    <main className="crz-catalog">
      <section className="crz-catalog-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY CATALOG"
            title="Produtos"
            description="Catálogo ao vivo da CRAZZY PROJECT. Preço, plano e disponibilidade vêm direto do sistema comercial."
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
              placeholder="Buscar no catálogo..."
              aria-label="Buscar produtos"
            />

            <Select
              id="catalog-sort"
              value={sort}
              onChange={(event) => updateFilter(() => setSort(event.target.value as Sort))}
              aria-label="Ordenar catálogo"
            >
              <option value="featured">Ordenar: Destaques</option>
              <option value="newest">Ordenar: Novidades</option>
              <option value="price-asc">Ordenar: Menor preço</option>
              <option value="price-desc">Ordenar: Maior preço</option>
              <option value="name">Ordenar: Nome A–Z</option>
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
            {categories.map((item) => {
              const active = category === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => updateFilter(() => setCategory(item.id))}
                >
                  <img src={item.icon || "/icons/neon-v2/cube.svg"} alt="" aria-hidden="true" />
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
            <div><span>REFINAR</span><h2>Filtros</h2></div>
            {activeFilters > 0 && <button type="button" onClick={clearFilters}>Limpar</button>}
          </div>

          <fieldset className="crz-catalog-filter-group">
            <legend>Categoria</legend>
            {categories.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="catalog-category"
                  value={item.id}
                  checked={category === item.id}
                  onChange={() => updateFilter(() => setCategory(item.id))}
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
                onChange={(event) => updateFilter(() => setOnlyAvailable(event.target.checked))}
              />
              <span>Somente disponíveis</span>
            </label>
          </fieldset>

          <div className="crz-catalog-filter-note">
            <NeonIcon name="shield" size={28} />
            <div>
              <strong>Dados comerciais reais</strong>
              <span>O checkout recalcula o preço no servidor antes de cobrar.</span>
            </div>
          </div>
        </aside>

        <section className="crz-catalog-results" aria-labelledby="catalog-results-title">
          <header className="crz-catalog-results__head">
            <div>
              <span className="crz-catalog-results__eyebrow">VITRINE AO VIVO</span>
              <h2 id="catalog-results-title">
                {category === "all" ? "Todos os produtos" : categories.find((item) => item.id === category)?.label}
              </h2>
            </div>
            <div className="crz-catalog-results__meta">
              <strong>{filtered.length}</strong>
              <span>{filtered.length === 1 ? "produto" : "produtos"}</span>
            </div>
          </header>

          {loadState === "loading" ? (
            <div className="crz-integrations-state"><span className="crz-spinner" /><strong>Carregando catálogo real...</strong></div>
          ) : loadState === "error" ? (
            <EmptyState
              title="Catálogo indisponível"
              description="Não foi possível consultar o catálogo agora."
              icon={<NeonIcon name="cube" size={30} />}
              action={<Button variant="secondary" onClick={() => void load()}>Tentar novamente</Button>}
            />
          ) : pageItems.length > 0 ? (
            <>
              <div className="crz-catalog-grid">
                {pageItems.map((product) => {
                  const stock = getProductStock(product);
                  const startingPrice = getProductStartingPrice(product);
                  const image = product.image_url || product.game?.image_url;
                  return (
                    <article key={product.id} className={`crz-catalog-card ${stock.state === "out" ? "is-unavailable" : ""}`}>
                      <div className="crz-catalog-card__art">
                        {image ? (
                          <img src={image} alt="" aria-hidden="true" />
                        ) : (
                          <div className="crz-catalog-card__synthetic">
                            <div className="crz-catalog-card__orb" aria-hidden="true" />
                            <NeonIcon name="gamepad" size={58} />
                          </div>
                        )}
                        <div className="crz-catalog-card__badges">
                          {product.is_new && <Badge tone="blue">NOVO</Badge>}
                          {product.status_label && <Badge tone={product.status === "online" ? "green" : "neutral"}>{product.status_label}</Badge>}
                        </div>
                      </div>

                      <div className="crz-catalog-card__body">
                        <div className="crz-catalog-card__category">{product.game?.name || "CRAZZY PROJECT"}</div>
                        <h3>{product.name}</h3>
                        <p>{product.description || "Produto digital CRAZZY PROJECT."}</p>
                        <StockBadge product={product} />

                        <div className="crz-catalog-card__footer">
                          <span className="crz-catalog-card__mock-price">
                            <small>{startingPrice == null ? "VALOR" : "A PARTIR DE"}</small>
                            <strong>{startingPrice == null ? "Indisponível" : formatBrl(startingPrice)}</strong>
                          </span>
                          <a href={`/produto/${product.slug}`}>
                            Ver produto
                            <span aria-hidden="true">→</span>
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <footer className="crz-catalog-pagination">
                <div>Página <strong>{safePage}</strong> de <strong>{totalPages}</strong></div>
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
              title={products.length ? "Nenhum produto encontrado" : "Catálogo ainda não publicado"}
              description={products.length ? "Altere a busca ou os filtros." : "Cadastre e ative produtos/planos no Product Manager para começar as vendas."}
              icon={<NeonIcon name="cube" size={30} />}
              action={products.length ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : undefined}
            />
          )}
        </section>
      </div>
    </main>
  );
}
