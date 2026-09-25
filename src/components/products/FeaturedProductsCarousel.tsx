"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";
import { formatBrl, getProductStartingPrice, type PublicStoreProduct } from "@/modules/catalog/live";

const mod = (n: number, m: number) => (m ? ((n % m) + m) % m : 0);

export function FeaturedProductsCarousel() {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
        return Array.isArray(payload?.products) ? payload.products as PublicStoreProduct[] : [];
      })
      .then((items) => {
        if (!mounted) return;
        setProducts(items.slice(0, 7));
        setActive(items.length > 2 ? 2 : 0);
      })
      .catch(() => {
        if (mounted) setProducts([]);
      });
    return () => { mounted = false; };
  }, []);

  const total = products.length;
  const cards = useMemo(
    () =>
      products.map((product, index) => {
        let offset = index - active;
        if (offset > total / 2) offset -= total;
        if (offset < -total / 2) offset += total;
        return { product, index, offset };
      }),
    [active, total, products]
  );

  const move = (delta: number) => {
    if (total) setActive((current) => mod(current + delta, total));
  };

  return (
    <section className="featured-section" id="produtos" aria-labelledby="featured-title">
      <div className="featured-head">
        <div className="featured-title-wrap">
          <NeonSectionIcon src="/icons/neon-v2/featured.svg" />
          <div>
            <h2 id="featured-title">Produtos em Destaque</h2>
            <p>Produtos ativos publicados no catálogo.</p>
          </div>
        </div>
        <a href="/produtos" className="section-link">Ver todos os produtos →</a>
      </div>

      {total ? (
        <>
          <div className="coverflow-shell">
            <button type="button" className="coverflow-arrow coverflow-arrow--left" onClick={() => move(-1)} aria-label="Produto anterior">‹</button>
            <div className="coverflow-stage">
              {cards.map(({ product, offset }) => {
                const isActive = offset === 0;
                const image = product.image_url || product.game?.image_url;
                const price = getProductStartingPrice(product);
                return (
                  <article
                    key={product.id}
                    className={`product-card ${isActive ? "is-active" : ""}`}
                    style={{
                      ["--offset" as string]: offset,
                      ["--abs-offset" as string]: Math.abs(offset),
                      zIndex: 10 - Math.abs(offset),
                    }}
                    aria-hidden={!isActive}
                  >
                    {product.is_new && <span className="product-badge">★ NOVO</span>}
                    <div className="product-art">
                      {image ? <img src={image} alt="" aria-hidden="true" /> : null}
                      <div className="product-art-noise" />
                    </div>
                    <div className="product-info">
                      <strong>{product.name}</strong>
                      <span>{product.game?.name || "CRAZZY PROJECT"}{price == null ? "" : " • " + formatBrl(price)}</span>
                      {isActive && <a className="product-view-link" href={"/produto/" + product.slug}>Ver Produto</a>}
                    </div>
                  </article>
                );
              })}
            </div>
            <button type="button" className="coverflow-arrow coverflow-arrow--right" onClick={() => move(1)} aria-label="Próximo produto">›</button>
          </div>

          <div className="coverflow-dots" aria-label="Selecionar produto em destaque">
            {products.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === active ? "is-active" : ""}
                onClick={() => setActive(index)}
                aria-label={`Mostrar ${item.name}`}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="crz-discovery-empty">
          <strong>Confira todos os produtos</strong>
          <p>Veja as opções disponíveis na loja.</p>
          <a className="section-link" href="/produtos">Abrir catálogo →</a>
        </div>
      )}
    </section>
  );
}
