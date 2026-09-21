"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  NeonIcon,
  Panel,
  ProgressBar,
  SectionTitle,
  Tabs,
  Toast,
} from "@/core/design-system";
import { catalogCategories } from "@/modules/catalog";
import { useCart } from "@/modules/cart/CartProvider";
import { VerifiedReviewFeed } from "@/modules/reviews";
import { InteractiveImGuiDemo } from "@/modules/interactive-demo";
import {
  getRelatedProducts,
  type ProductDetail,
  type ProductGalleryItem,
} from "./data";

const tabItems = [
  { id: "description", label: "Descrição" },
  { id: "demo", label: "Demo Interativa" },
  { id: "compatibility", label: "Compatibilidade" },
  { id: "reviews", label: "Avaliações" },
  { id: "faq", label: "Dúvidas" },
];

function badgeTone(label: string): "blue" | "pink" | "green" | "gold" {
  if (label === "PROMO") return "pink";
  if (label === "PREMIUM") return "gold";
  if (label === "MAIS VENDIDO") return "green";
  return "blue";
}

function GalleryVisual({ item, productName }: { item: ProductGalleryItem; productName: string }) {
  if (item.image) {
    return (
      <img
        src={item.image}
        alt={productName + " — " + item.label}
        style={{ objectPosition: item.position ?? "center" }}
      />
    );
  }

  return (
    <div className="crz-product-gallery__synthetic">
      <div className="crz-product-gallery__orb" aria-hidden="true" />
      <NeonIcon name={item.icon ?? "cube"} size={92} />
      <span>CRAZZY PROJECT</span>
    </div>
  );
}

export function ProductView({ detail }: { detail: ProductDetail }) {
  const { product } = detail;
  const { addItem, openCart } = useCart();
  const [activeGallery, setActiveGallery] = useState(detail.gallery[0].id);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(
    detail.plans.find((plan) => plan.featured)?.id ?? detail.plans[0].id
  );
  const [activeTab, setActiveTab] = useState("description");
  const [notice, setNotice] = useState<string | null>(null);

  const activeImage =
    detail.gallery.find((item) => item.id === activeGallery) ?? detail.gallery[0];
  const selectedPlanData =
    detail.plans.find((plan) => plan.id === selectedPlan) ?? detail.plans[0];

  const related = useMemo(() => getRelatedProducts(product), [product]);

  const stockTone =
    product.stock === "available" ? "green" : product.stock === "limited" ? "gold" : "neutral";

  const handlePurchase = () => {
    if (product.stock === "out" || selectedPlanData.stockCount === 0) {
      setNotice("Este plano está esgotado no momento.");
      return;
    }

    addItem({
      key: "product:" + product.id + ":" + selectedPlanData.id,
      kind: "product",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle,
      image: product.image ?? null,
      planId: selectedPlanData.id,
      planCode: selectedPlanData.code,
      planName: selectedPlanData.name,
      durationLabel: selectedPlanData.duration,
      price: selectedPlanData.price,
      priceLabel: selectedPlanData.priceLabel,
      category: catalogCategories.find((category) => category.id === product.category)?.label,
      comboEligible: selectedPlanData.code === "30d" || selectedPlanData.code === "lifetime",
    });

    setNotice(selectedPlanData.name + " adicionado ao carrinho.");
    openCart();
  };

  return (
    <main className="crz-product-view">
      <div className="crz-container">
        <nav className="crz-product-breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a>
          <span>›</span>
          <a href="/produtos">Produtos</a>
          <span>›</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <section className="crz-product-main">
          <div className="crz-product-gallery">
            <button
              type="button"
              className="crz-product-gallery__stage"
              onClick={() => setZoomOpen(true)}
              aria-label="Ampliar imagem do produto"
            >
              <GalleryVisual item={activeImage} productName={product.name} />
              <span className="crz-product-gallery__zoom">
                <span aria-hidden="true">⌕</span>
                Ampliar
              </span>
            </button>

            <div className="crz-product-gallery__thumbs" aria-label="Galeria do produto">
              {detail.gallery.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === activeGallery ? "is-active" : ""}
                  aria-pressed={item.id === activeGallery}
                  onClick={() => setActiveGallery(item.id)}
                >
                  <GalleryVisual item={item} productName={product.name} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="crz-product-summary">
            <div className="crz-product-summary__badges">
              {product.badges?.map((badge) => (
                <Badge key={badge} tone={badgeTone(badge)}>
                  {badge}
                </Badge>
              ))}
              <Badge tone={stockTone}>{product.stockLabel}</Badge>
            </div>

            <span className="crz-product-summary__eyebrow">{detail.eyebrow}</span>
            <h1>{product.name}</h1>
            <p className="crz-product-summary__subtitle">{detail.description}</p>

            <div className="crz-product-rating">
              <span
                className="crz-product-rating__stars"
                aria-label={detail.rating + " de 5 estrelas"}
              >
                ★★★★★
              </span>
              <strong>{detail.rating.toFixed(1)}</strong>
              <span>({detail.ratingCount} avaliações)</span>
            </div>

            <div className="crz-product-status-grid">
              <div>
                <span>STATUS</span>
                <strong className={"is-" + product.stock}>
                  <i aria-hidden="true" />
                  {product.stockLabel}
                </strong>
              </div>
              <div>
                <span>ENTREGA</span>
                <strong>Digital</strong>
              </div>
              <div>
                <span>SUPORTE</span>
                <strong>CRAZZY</strong>
              </div>
            </div>

            <div className="crz-product-plan-block" id="planos">
              <div className="crz-product-plan-block__head">
                <span>ESCOLHA UMA OPÇÃO</span>
                <strong>{selectedPlanData.duration}</strong>
              </div>

              <div className="crz-product-plans">
                {detail.plans.map((plan) => (
                  <button
                    type="button"
                    key={plan.id}
                    className={plan.id === selectedPlan ? "is-selected" : ""}
                    aria-pressed={plan.id === selectedPlan}
                    disabled={plan.stockCount === 0}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.featured && <b>RECOMENDADO</b>}
                    <strong>{plan.name}</strong>
                    <span>{plan.duration}</span>
                    <small>{plan.stockCount === 0 ? "ESGOTADO" : plan.note}</small>
                    <em>{plan.priceLabel}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="crz-product-buy-box">
              <div>
                <small>PLANO SELECIONADO</small>
                <strong>{selectedPlanData.name}</strong>
                <span>{selectedPlanData.priceLabel}</span>
              </div>

              <Button
                size="lg"
                disabled={product.stock === "out" || selectedPlanData.stockCount === 0}
                onClick={handlePurchase}
                leadingIcon={<NeonIcon name="lightning" size={20} />}
              >
                {product.stock === "out" || selectedPlanData.stockCount === 0
                  ? "Plano esgotado"
                  : "Adicionar ao carrinho"}
              </Button>

              <p>
                Seu plano escolhido fica salvo no carrinho até a finalização da compra.
              </p>
            </div>

            {notice && (
              <div className="crz-product-notice">
                <Toast tone={product.stock === "out" ? "error" : "success"}>
                  {notice}
                </Toast>
              </div>
            )}
          </aside>
        </section>

        <section className="crz-product-benefits" aria-label="Benefícios">
          {detail.benefits.map((benefit) => (
            <div key={benefit.title}>
              <NeonIcon name={benefit.icon} size={30} />
              <span>
                <strong>{benefit.title}</strong>
                <small>{benefit.text}</small>
              </span>
            </div>
          ))}
        </section>

        <section className="crz-product-info">
          <div className="crz-product-info__tabs">
            <Tabs
              items={tabItems}
              value={activeTab}
              onChange={setActiveTab}
              ariaLabel="Informações do produto"
            />
          </div>

          <Panel className="crz-product-info__panel">
            {activeTab === "description" && (
              <div className="crz-product-info__description">
                <SectionTitle
                  icon={<NeonIcon name="cube" size={28} />}
                  title="Sobre este produto"
                  description="Informações organizadas antes da etapa de compra."
                />
                <p>{detail.longDescription}</p>

                <div className="crz-product-highlight-grid">
                  {detail.highlights.map((item) => (
                    <div key={item}>
                      <NeonIcon name="verified" size={22} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "demo" && (
              <div className="crz-product-demo-tab">
                <SectionTitle
                  icon={<NeonIcon name="customization" size={28} />}
                  title="Teste o menu no navegador"
                  description="Uma simulação interativa do painel para você experimentar abas, botões, sliders e o preview antes da compra."
                />
                <InteractiveImGuiDemo title={product.name} />
              </div>
            )}

            {activeTab === "compatibility" && (
              <div className="crz-product-compatibility">
                <div>
                  <SectionTitle
                    icon={<NeonIcon name="gear" size={28} />}
                    title="Compatibilidade"
                    description="Exemplo visual até os dados reais do produto serem conectados."
                  />
                  <ul>
                    {detail.compatibility.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div>
                  <SectionTitle
                    icon={<NeonIcon name="shield" size={28} />}
                    title="Requisitos"
                    description="Checklist de preparação."
                  />
                  <ul>
                    {detail.requirements.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="crz-product-reviews">
                <SectionTitle
                  icon={<NeonIcon name="verified" size={28} />}
                  title="Avaliações verificadas"
                  description="Somente compras reais recebem o selo de cliente verificado."
                />
                <VerifiedReviewFeed
                  productId={/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(product.id) ? product.id : undefined}
                  limit={20}
                />
                <a className="crz-button crz-button--secondary crz-button--sm" href="/feedbacks">
                  Ver todos os feedbacks
                </a>
              </div>
            )}

            {activeTab === "faq" && (
              <div className="crz-product-faq">
                {detail.faq.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="crz-product-related" aria-labelledby="related-title">
          <SectionTitle
            icon={<NeonIcon name="featured" size={30} />}
            title="Você também pode gostar"
            description="Produtos relacionados da CRAZZY PROJECT."
          />

          <h2 id="related-title" className="sr-only">Produtos relacionados</h2>

          <div className="crz-product-related__grid">
            {related.map((item) => (
              <a href={"/produto/" + item.slug} key={item.id}>
                <div className="crz-product-related__art">
                  {item.image ? (
                    <img src={item.image} alt="" aria-hidden="true" />
                  ) : (
                    <NeonIcon name={item.icon ?? "cube"} size={48} />
                  )}
                </div>
                <div>
                  <small>
                    {catalogCategories.find((category) => category.id === item.category)?.label}
                  </small>
                  <strong>{item.name}</strong>
                  <span>{item.stockLabel}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      {zoomOpen && (
        <div
          className="crz-product-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada do produto"
          onClick={() => setZoomOpen(false)}
        >
          <button type="button" onClick={() => setZoomOpen(false)} aria-label="Fechar zoom">
            ×
          </button>
          <div onClick={(event) => event.stopPropagation()}>
            <GalleryVisual item={activeImage} productName={product.name} />
          </div>
        </div>
      )}
    </main>
  );
}
