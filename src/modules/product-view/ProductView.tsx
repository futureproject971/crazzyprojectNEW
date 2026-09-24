"use client";

import { useMemo, useState } from "react";
import { Badge, Button, NeonIcon, Toast } from "@/core/design-system";
import { useCart } from "@/modules/cart/CartProvider";
import { VerifiedReviewFeed } from "@/modules/reviews";
import {
  formatBrl,
  type PublicStoreMedia,
  type PublicStorePlan,
  type PublicStoreProduct,
} from "@/modules/catalog/live";

function durationLabel(plan: PublicStorePlan) {
  const code = String(plan.plan_code || "").toLowerCase();
  const known: Record<string, string> = {
    "1d": "Acesso por 24 horas",
    "3d": "Acesso por 3 dias",
    "7d": "Acesso por 7 dias",
    "15d": "Acesso por 15 dias",
    "30d": "Acesso por 30 dias",
    "90d": "Acesso por 90 dias",
    lifetime: "Acesso vitalício",
  };
  return known[code] || plan.name;
}

function cartPlanCode(plan: PublicStorePlan) {
  const code = String(plan.plan_code || "").toLowerCase();
  if (["1d", "3d", "7d", "15d", "30d", "90d", "lifetime"].includes(code)) {
    return code as "1d" | "3d" | "7d" | "15d" | "30d" | "90d" | "lifetime";
  }
  return "custom" as const;
}

function planAvailable(plan: PublicStorePlan) {
  return !plan.stock_managed || Number(plan.stock_count || 0) > 0;
}

function gallery(product: PublicStoreProduct) {
  const media = (product.media || [])
    .filter((item) => item?.url)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const items: Array<PublicStoreMedia & { label: string }> = media.map((item, index) => ({
    ...item,
    label: index === 0 ? "Principal" : "Mídia " + (index + 1),
  }));

  if (product.image_url && !items.some((item) => item.url === product.image_url)) {
    items.unshift({
      id: "cover",
      media_type: "image",
      url: product.image_url,
      sort_order: -1,
      label: "Capa",
    });
  }

  return items;
}

function ProductVisual({ product, media }: { product: PublicStoreProduct; media?: PublicStoreMedia }) {
  const src = media?.url || product.image_url || product.game?.image_url;
  if (src) return <img src={src} alt={product.name} />;

  return (
    <div className="crz-ref-product-fallback">
      <NeonIcon name="gamepad" size={76} />
      <strong>CRAZZY PROJECT</strong>
    </div>
  );
}

function compatibility(product: PublicStoreProduct) {
  const raw = [
    ...(product.features || []).map((item) => ({ label: item.label, value: item.value })),
    ...String(product.features_text || "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({ label: "RECURSO", value })),
  ].filter((item) => item.value);

  if (raw.length >= 4) return raw.slice(0, 4);

  const defaults = [
    { label: "GPU", value: "Compatível com AMD & NVIDIA" },
    { label: "SISTEMA OPERACIONAL", value: "Windows 10 & 11 (64 bits)" },
    { label: "CPU", value: "Intel & AMD" },
    { label: "SUPORTE", value: "Configuração acompanhada pela CRAZZY PROJECT" },
  ];

  return [...raw, ...defaults].slice(0, 4);
}

export function ProductView({
  product,
}: {
  product: PublicStoreProduct;
  relatedProducts?: PublicStoreProduct[];
}) {
  const { addItem, openCart } = useCart();
  const productGallery = useMemo(() => gallery(product), [product]);
  const plans = useMemo(
    () => [...(product.plans || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [product.plans]
  );
  const preferred = plans.find(planAvailable) || plans[0];
  const [activeGallery, setActiveGallery] = useState(productGallery[0]?.id || "");
  const [selectedPlan, setSelectedPlan] = useState(preferred?.id || "");
  const [notice, setNotice] = useState<string | null>(null);

  const activeMedia = productGallery.find((item) => item.id === activeGallery) || productGallery[0];
  const selectedPlanData = plans.find((plan) => plan.id === selectedPlan) || preferred;
  const canBuy = Boolean(selectedPlanData && planAvailable(selectedPlanData) && Number(selectedPlanData.price) >= 0);
  const compatibilityItems = compatibility(product);

  const addSelectedToCart = (open = false) => {
    if (!selectedPlanData || !canBuy) {
      setNotice("Este plano está sem estoque ou indisponível.");
      return;
    }

    const code = cartPlanCode(selectedPlanData);
    addItem({
      key: "product:" + product.id + ":" + selectedPlanData.id,
      kind: "product",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      subtitle: product.description || product.game?.name || "",
      image: product.image_url || product.game?.image_url || null,
      planId: selectedPlanData.id,
      planCode: code,
      planName: selectedPlanData.name,
      durationLabel: durationLabel(selectedPlanData),
      price: Number(selectedPlanData.price),
      priceLabel: formatBrl(Number(selectedPlanData.price)),
      category: product.game?.name || "CRAZZY PROJECT",
      comboEligible: code === "30d" || code === "lifetime",
    });

    if (open) openCart();
    setNotice(selectedPlanData.name + " adicionado ao carrinho.");
  };

  const buyNow = () => {
    addSelectedToCart(false);
    if (selectedPlanData && canBuy) {
      window.setTimeout(() => {
        window.location.assign("/checkout");
      }, 50);
    }
  };

  return (
    <main className="crz-ref-product-page">
      <div className="crz-container">
        <nav className="crz-ref-product-breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span>›</span>
          <a href="/produtos">{product.game?.name || "Produtos"}</a><span>›</span>
          <strong>{product.name}</strong>
        </nav>

        <section className="crz-ref-product-grid">
          <div className="crz-ref-product-left">
            <div className="crz-ref-product-gallery">
              <div className="crz-ref-product-gallery__stage">
                <ProductVisual product={product} media={activeMedia} />
              </div>

              {productGallery.length > 1 && (
                <div className="crz-ref-product-gallery__thumbs">
                  {productGallery.slice(0, 6).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={item.id === activeGallery ? "is-active" : ""}
                      onClick={() => setActiveGallery(item.id)}
                      aria-label={"Ver " + item.label}
                    >
                      <ProductVisual product={product} media={item} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="crz-ref-product-compatibility">
              {compatibilityItems.map((item, index) => (
                <article key={item.label + index}>
                  <span className="crz-ref-product-compatibility__icon">
                    <NeonIcon name={index % 2 === 0 ? "gear" : "verified"} size={26} />
                  </span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="crz-ref-product-right">
            <div className="crz-ref-product-title">
              <small>{product.game?.name || "CRAZZY PROJECT"}</small>
              <h1>{product.name}</h1>
              {product.description && <p>{product.description}</p>}
            </div>

            <section className="crz-ref-plan-card">
              <header>
                <span>ESCOLHA SEU PLANO</span>
                <Badge tone="blue">ENTREGA DIGITAL</Badge>
              </header>

              <div className="crz-ref-plan-list">
                {plans.map((plan) => {
                  const available = planAvailable(plan);
                  const selected = plan.id === selectedPlan;
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      className={(selected ? "is-selected " : "") + (!available ? "is-disabled" : "")}
                      disabled={!available}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <span className="crz-ref-plan-radio"><i /></span>
                      <span className="crz-ref-plan-copy">
                        <strong>{plan.name}</strong>
                        <small>{available ? durationLabel(plan) : "Sem estoque"}</small>
                      </span>
                      <b>{formatBrl(Number(plan.price))}</b>
                    </button>
                  );
                })}
              </div>

              <div className="crz-ref-plan-total">
                <span>Total</span>
                <strong>{selectedPlanData ? formatBrl(Number(selectedPlanData.price)) : "Indisponível"}</strong>
              </div>

              <div className="crz-ref-plan-actions">
                <Button
                  size="lg"
                  disabled={!canBuy}
                  onClick={buyNow}
                  leadingIcon={<NeonIcon name="lightning" size={19} />}
                >
                  COMPRAR AGORA
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!canBuy}
                  onClick={() => addSelectedToCart(true)}
                  leadingIcon={<NeonIcon name="cube" size={18} />}
                >
                  Carrinho
                </Button>
              </div>

              {notice && <Toast tone={canBuy ? "success" : "error"}>{notice}</Toast>}
            </section>

            <section className="crz-ref-reviews-card">
              <header>
                <span>AVALIAÇÕES</span>
              </header>
              <VerifiedReviewFeed productId={product.id} limit={3} />
              <a href="/feedbacks">Ver todas as avaliações</a>
            </section>
          </aside>
        </section>

        <section className="crz-ref-product-trust">
          <article>
            <NeonIcon name="lightning" size={30} />
            <div><strong>Entrega Instantânea</strong><span>Receba seu produto após a confirmação.</span></div>
          </article>
          <article>
            <NeonIcon name="shield" size={30} />
            <div><strong>Pagamento Seguro</strong><span>Checkout validado no servidor.</span></div>
          </article>
          <article>
            <NeonIcon name="community" size={30} />
            <div><strong>Suporte CRAZZY</strong><span>Atendimento pelo ecossistema CRAZZY PROJECT.</span></div>
          </article>
        </section>
      </div>
    </main>
  );
}
