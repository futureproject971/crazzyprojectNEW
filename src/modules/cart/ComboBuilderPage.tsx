"use client";

import { useMemo, useState } from "react";
import { Badge, Button, NeonIcon, PageHeader } from "@/core/design-system";
import { catalogCategories, catalogProducts } from "@/modules/catalog";
import { getProductDetail } from "@/modules/product-view";
import { comboDiscountPercent, comboNextTier } from "./pricing";
import { useCart } from "./CartProvider";
import type { ComboPlanFamily } from "@/core/commerce/policy";

const eligibleProducts = catalogProducts.filter(
  (product) =>
    product.stock !== "out" &&
    product.category !== "services" &&
    product.category !== "accounts"
);

function planAvailableForCombo(productId: string, plan: ComboPlanFamily) {
  const product = eligibleProducts.find((item) => item.id === productId);
  if (!product) return false;
  const detail = getProductDetail(product.slug);
  const selectedPlan = detail?.plans.find((candidate) => candidate.code === plan);
  return Boolean(selectedPlan && selectedPlan.stockCount !== 0);
}

export function ComboBuilderPage() {
  const { addItem, openCart } = useCart();
  const [plan, setPlan] = useState<ComboPlanFamily>("30d");
  const [selected, setSelected] = useState<string[]>([]);

  const discount = comboDiscountPercent(selected.length);
  const next = comboNextTier(selected.length);
  const progress = Math.min(100, (selected.length / 7) * 100);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const selectionLabel = useMemo(
    () => selected.length + " produto" + (selected.length === 1 ? "" : "s"),
    [selected.length]
  );

  const addCombo = () => {
    for (const productId of selected) {
      const product = eligibleProducts.find((item) => item.id === productId);
      if (!product) continue;
      const detail = getProductDetail(product.slug);
      const selectedPlan = detail?.plans.find((candidate) => candidate.code === plan);
      if (!selectedPlan || selectedPlan.stockCount === 0) continue;

      addItem({
        key: "product:" + product.id + ":" + selectedPlan.id,
        kind: "product",
        productId: product.id,
        slug: product.slug,
        name: product.name,
        subtitle: product.subtitle,
        image: product.image ?? null,
        planId: selectedPlan.id,
        planCode: selectedPlan.code,
        planName: selectedPlan.name,
        durationLabel: selectedPlan.duration,
        price: selectedPlan.price,
        priceLabel: selectedPlan.priceLabel,
        category: catalogCategories.find((category) => category.id === product.category)?.label,
        comboEligible: true,
      });
    }

    openCart();
  };

  return (
    <main className="crz-combo-page">
      <section className="crz-combo-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="M07 • MONTE SEU COMBO"
            title="Monte seu Combo CRAZZY"
            description="Escolha vários produtos no mesmo plano Mensal ou Lifetime e desbloqueie até 35% de desconto."
          />

          <div className="crz-combo-plan-switch">
            <button
              type="button"
              className={plan === "30d" ? "is-active" : ""}
              onClick={() => {
                setPlan("30d");
                setSelected([]);
              }}
            >
              <NeonIcon name="lightning" size={26} />
              <span>
                <small>COMBO</small>
                <strong>Mensal • 30 dias</strong>
              </span>
            </button>
            <button
              type="button"
              className={plan === "lifetime" ? "is-active" : ""}
              onClick={() => {
                setPlan("lifetime");
                setSelected([]);
              }}
            >
              <NeonIcon name="crown" size={26} />
              <span>
                <small>COMBO</small>
                <strong>Lifetime</strong>
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className="crz-container crz-combo-layout">
        <aside className="crz-combo-progress">
          <div className="crz-combo-progress__ring">
            <strong>{discount}%</strong>
            <span>OFF</span>
          </div>

          <div>
            <small>SELEÇÃO ATUAL</small>
            <h2>{selectionLabel}</h2>
            <div className="crz-combo-progress__track">
              <i style={{ width: progress + "%" }} />
            </div>

            {next ? (
              <p>
                Adicione <strong>{next.products - selected.length}</strong> produto(s) diferente(s)
                para liberar <strong>{next.discountPercent}% OFF</strong>.
              </p>
            ) : (
              <p>
                <strong>35% OFF desbloqueado.</strong> Este é o teto máximo do combo.
              </p>
            )}
          </div>

          <div className="crz-combo-tiers">
            {[2, 3, 4, 5, 6, 7].map((count, index) => {
              const percentages = [10, 15, 20, 25, 30, 35];
              const reached = selected.length >= count;
              return (
                <span key={count} className={reached ? "is-reached" : ""}>
                  <b>{count}{count === 7 ? "+" : ""}</b>
                  <small>{percentages[index]}%</small>
                </span>
              );
            })}
          </div>

          <Button
            size="lg"
            disabled={selected.length < 2}
            onClick={addCombo}
            leadingIcon={<NeonIcon name="crown" size={20} />}
          >
            Adicionar combo ao carrinho
          </Button>

          <small className="crz-combo-progress__rule">
            Só produtos diferentes contam para a faixa. Quantidade repetida não aumenta desconto.
            Mensal e Lifetime são calculados separadamente.
          </small>
        </aside>

        <section className="crz-combo-products">
          <header>
            <div>
              <small>ESCOLHA SEUS PRODUTOS</small>
              <h2>{plan === "30d" ? "Combo Mensal" : "Combo Lifetime"}</h2>
            </div>
            <Badge tone="gold">ATÉ 35% OFF</Badge>
          </header>

          <div className="crz-combo-grid">
            {eligibleProducts
              .filter((product) => planAvailableForCombo(product.id, plan))
              .map((product) => {
              const active = selected.includes(product.id);
              return (
                <button
                  type="button"
                  key={product.id}
                  className={"crz-combo-card " + (active ? "is-selected" : "")}
                  aria-pressed={active}
                  onClick={() => toggle(product.id)}
                >
                  <div className="crz-combo-card__art">
                    {product.image ? (
                      <img src={product.image} alt="" />
                    ) : (
                      <NeonIcon name={product.icon ?? "cube"} size={48} />
                    )}
                    <span className="crz-combo-card__check">{active ? "✓" : "+"}</span>
                  </div>
                  <div>
                    <small>
                      {catalogCategories.find((category) => category.id === product.category)?.label}
                    </small>
                    <strong>{product.name}</strong>
                    <span>{product.subtitle}</span>
                    <em>{plan === "30d" ? "30 dias" : "Lifetime"} • Consultar</em>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
