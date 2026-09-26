"use client";
import { useMemo, useState } from "react";
import { Badge, Button, NeonIcon, PageHeader } from "@/core/design-system";
import { formatBrl } from "@/modules/catalog/live";
import { useStoreCatalog } from "@/modules/catalog/useStoreCatalog";
import { comboDiscountPercent, comboNextTier } from "./pricing";
import { useCart } from "./CartProvider";
import { getComboProducts } from "./combo-catalog";
import type { ComboPlanFamily } from "@/core/commerce/policy";

export function ComboBuilderPage() {
  const { addItem, openCart, comboTiers, comboStatus, refreshComboRules } = useCart();
  const { products, state, reload } = useStoreCatalog();
  const [plan, setPlan] = useState<ComboPlanFamily>("30d");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const eligible = useMemo(() => getComboProducts(products, plan), [products, plan]);
  const chosen = eligible.filter(({ product }) => selected.includes(product.id));
  const visible = eligible.filter(({ product }) => `${product.name} ${product.game.name}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const discount = comboDiscountPercent(chosen.length, comboTiers);
  const next = comboNextTier(chosen.length, comboTiers);
  const maxDiscount = Math.max(0, ...comboTiers.map(tier => tier.discountPercent));
  const subtotalCents = chosen.reduce((sum, item) => sum + Math.round(Number(item.plan.price) * 100), 0);
  const savingsCents = Math.round(subtotalCents * discount / 100);
  const ready = state === "ready" && comboStatus === "ready";

  function addCombo() {
    if (!ready || chosen.length < 2) return;
    for (const { product, plan: selectedPlan } of chosen) {
      addItem({
        key: `product:${product.id}:${selectedPlan.id}`, kind: "product", productId: product.id,
        slug: product.slug, name: product.name, subtitle: product.description || product.game.name,
        image: product.image_url || product.game.image_url || null,
        planId: selectedPlan.id, planCode: plan, planName: selectedPlan.name,
        durationLabel: plan === "30d" ? "30 dias" : "Vitalício",
        price: Number(selectedPlan.price), priceLabel: formatBrl(Number(selectedPlan.price)),
        category: product.game.name, comboEligible: true,
      });
    }
    openCart();
  }
  return <main className="crz-combo-page">
    <section className="crz-combo-hero"><div className="crz-container">
      <PageHeader eyebrow="MONTE SEU COMBO" title="Seus produtos. Seu combo." description="Combine produtos do catálogo no plano Mensal ou Lifetime. Veja os preços e o desconto antes de adicionar ao carrinho." />
      <div className="crz-combo-plan-switch" aria-label="Duração do combo">
        {(["30d", "lifetime"] as const).map(family => <button key={family} type="button" aria-pressed={plan === family} className={plan === family ? "is-active" : ""} onClick={() => { setPlan(family); setSelected([]); }}>
          <NeonIcon name={family === "30d" ? "lightning" : "crown"} size={26} /><span><small>COMBO</small><strong>{family === "30d" ? "Mensal • 30 dias" : "Lifetime"}</strong></span>
        </button>)}
      </div>
    </div></section>
    <div className="crz-container crz-combo-layout">
      <aside className="crz-combo-progress">
        <div className="crz-combo-progress__ring"><strong>{ready ? `${discount}%` : "—"}</strong><span>OFF</span></div>
        <div aria-live="polite"><small>SELEÇÃO ATUAL</small><h2>{chosen.length} produto{chosen.length === 1 ? "" : "s"}</h2>
          <div className="crz-combo-progress__track"><i style={{ width: `${Math.min(100, chosen.length / 7 * 100)}%` }} /></div>
          {ready && (next ? <p>Adicione <strong>{next.products - chosen.length}</strong> produto(s) diferente(s) para liberar <strong>{next.discountPercent}% OFF</strong>.</p> : <p>{maxDiscount ? `${discount}% OFF: maior faixa disponível.` : "Sem desconto de combo ativo no momento."}</p>)}
        </div>
        <div className="crz-combo-tiers">{comboTiers.map(tier => <span key={tier.products} className={chosen.length >= tier.products ? "is-reached" : ""}><b>{tier.products}{tier.products === 7 ? "+" : ""}</b><small>{tier.discountPercent}%</small></span>)}</div>
        <dl className="crz-combo-totals" aria-live="polite"><div><dt>Produtos</dt><dd>{formatBrl(subtotalCents / 100)}</dd></div><div><dt>Desconto</dt><dd>{ready ? `− ${formatBrl(savingsCents / 100)}` : "Aguardando regras"}</dd></div><div><dt>Total estimado</dt><dd>{ready ? formatBrl((subtotalCents - savingsCents) / 100) : "—"}</dd></div></dl>
        <Button size="lg" disabled={!ready || chosen.length < 2} onClick={addCombo}>Adicionar combo ao carrinho</Button>
        <small className="crz-combo-progress__rule">Produtos diferentes contam para a faixa. Mensal e Lifetime são calculados separadamente. Preço e disponibilidade são confirmados no checkout; cupom e combo não se somam.</small>
      </aside>
      <section className="crz-combo-products">
        <header><div><small>CATÁLOGO DA LOJA</small><h2>{plan === "30d" ? "Combo Mensal" : "Combo Lifetime"}</h2></div>{comboStatus === "ready" && maxDiscount > 0 && <Badge tone="gold">ATÉ {maxDiscount}% OFF</Badge>}</header>
        <label className="crz-combo-search"><span>Buscar produto ou categoria</span><input type="search" className="crz-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome do produto…" /></label>
        {(state === "loading" || comboStatus === "loading") && <p role="status">Carregando catálogo e descontos…</p>}
        {(state === "error" || comboStatus === "error") && <div className="crz-combo-message" role="alert"><p>Não foi possível carregar {state === "error" ? "os produtos" : "as regras de desconto"}. Tente novamente.</p><Button onClick={() => { void reload(); void refreshComboRules(); }}>Tentar novamente</Button></div>}
        {ready && eligible.length === 0 && <div className="crz-combo-message"><h3>Nenhum produto disponível neste plano</h3><p>Os produtos da loja aparecem aqui quando têm um plano {plan === "30d" ? "Mensal" : "Lifetime"} com preço e disponibilidade.</p><a href="/produtos">Ver catálogo da loja →</a></div>}
        {ready && eligible.length > 0 && visible.length === 0 && <p>Nenhum produto encontrado para essa busca.</p>}
        <div className="crz-combo-grid">{state === "ready" && visible.map(({ product, plan: itemPlan }) => {
          const active = selected.includes(product.id);
          const image = product.image_url || product.game.image_url;
          return <button type="button" key={product.id} className={`crz-combo-card ${active ? "is-selected" : ""}`} aria-pressed={active} onClick={() => setSelected(current => current.includes(product.id) ? current.filter(id => id !== product.id) : [...current, product.id])}>
            <div className="crz-combo-card__art">{image ? <img className="crz-combo-card__image" src={image} alt="" loading="lazy" /> : <NeonIcon name="cube" size={48} />}<span className="crz-combo-card__check" aria-hidden="true">{active ? "✓" : "+"}</span></div>
            <div><small>{product.game.name}</small><strong>{product.name}</strong><span>{product.description}</span><em>{itemPlan.name} • {formatBrl(Number(itemPlan.price))}</em></div>
          </button>;
        })}</div>
      </section>
    </div>
  </main>;
}
