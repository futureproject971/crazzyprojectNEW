"use client";

import { useMemo, useState } from "react";
import { featuredProducts } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

const mod = (n: number, m: number) => ((n % m) + m) % m;

const productImages: Record<string, string> = {
  rdr2: "/products/rdr2.jpg",
  cod: "/products/cod.jpg",
  gta: "/products/gta.jpg",
  valorant: "/products/valorant.jpg",
};

export function FeaturedProductsCarousel() {
  const [active, setActive] = useState(2);
  const total = featuredProducts.length;

  const cards = useMemo(
    () =>
      featuredProducts.map((product, index) => {
        let offset = index - active;
        if (offset > total / 2) offset -= total;
        if (offset < -total / 2) offset += total;
        return { product, index, offset };
      }),
    [active, total]
  );

  const move = (delta: number) => setActive((current) => mod(current + delta, total));

  return (
    <section className="featured-section" id="produtos" aria-labelledby="featured-title">
      <div className="featured-head">
        <div className="featured-title-wrap">
          <NeonSectionIcon src="/icons/neon-v2/featured.svg" />
          <div>
            <h2 id="featured-title">Produtos em Destaque</h2>
            <p>Selecionados especialmente para você.</p>
          </div>
        </div>
        <a href="#loja" className="section-link">Ver todos os produtos →</a>
      </div>

      <div className="coverflow-shell">
        <button type="button" className="coverflow-arrow coverflow-arrow--left" onClick={() => move(-1)} aria-label="Produto anterior">‹</button>

        <div className="coverflow-stage">
          {cards.map(({ product, offset }) => {
            const isActive = offset === 0;
            const image = productImages[product.art];

            return (
              <article
                key={product.id}
                className={`product-card product-card--${product.art} ${isActive ? "is-active" : ""}`}
                style={{
                  ["--offset" as string]: offset,
                  ["--abs-offset" as string]: Math.abs(offset),
                  zIndex: 10 - Math.abs(offset),
                }}
                aria-hidden={!isActive}
              >
                {product.badge && <span className="product-badge">★ {product.badge}</span>}

                <div className="product-art">
                  {image ? <img src={image} alt="" aria-hidden="true" /> : null}
                  <div className="product-art-noise" />
                  <span className="product-art-brand">{product.name}</span>
                </div>

                <div className="product-info">
                  <strong>{product.name}</strong>
                  <span>{product.subtitle}</span>
                  {isActive && <button type="button">Ver Produto</button>}
                </div>
              </article>
            );
          })}
        </div>

        <button type="button" className="coverflow-arrow coverflow-arrow--right" onClick={() => move(1)} aria-label="Próximo produto">›</button>
      </div>

      <div className="coverflow-dots" aria-label="Selecionar produto em destaque">
        {featuredProducts.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={index === active ? "is-active" : ""}
            onClick={() => setActive(index)}
            aria-label={`Mostrar ${item.name}`}
          />
        ))}
      </div>
    </section>
  );
}
