"use client";

import { useEffect, useState } from "react";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon_url: string | null;
  emoji: string | null;
  accent_color: string | null;
  product_count: number;
};

export function StoreShowcase() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/categories", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("CATEGORIES_UNAVAILABLE");
        return Array.isArray(payload?.categories) ? payload.categories as PublicCategory[] : [];
      })
      .then((items) => {
        if (mounted) setCategories(items.filter((item) => Number(item.product_count || 0) > 0).slice(0, 8));
      })
      .catch(() => {
        if (mounted) setCategories([]);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <section className="store-showcase" id="loja" aria-labelledby="store-title">
      <div className="store-head">
        <div className="store-title-wrap">
          <NeonSectionIcon src="/icons/neon-v2/cube.svg" />
          <div>
            <h2 id="store-title">Explore Nossa Loja</h2>
            <p>Encontre produtos por jogo e categoria.</p>
          </div>
        </div>
        <a href="/categorias" className="section-link">Ver todas as categorias →</a>
      </div>

      {categories.length ? (
        <div className="store-grid">
          {categories.map((item, index) => (
            <a href="/produtos" className={`store-card store-card--live-${index % 4}`} key={item.id}>
              <div
                className="store-card-art"
                style={item.image_url ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.7)),url("${item.image_url}")` } : undefined}
              />
              <div className="store-card-footer">
                <img
                  className="store-category-icon"
                  src={item.icon_url || "/icons/neon-v2/gamepad.svg"}
                  alt=""
                  aria-hidden="true"
                />
                <div>
                  <strong>{item.emoji ? item.emoji + " " : ""}{item.name}</strong>
                  <span>{item.product_count} {item.product_count === 1 ? "produto" : "produtos"}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="crz-discovery-empty">
          <strong>Explore a loja</strong>
          <p>Veja todos os produtos disponíveis.</p>
        </div>
      )}
    </section>
  );
}
