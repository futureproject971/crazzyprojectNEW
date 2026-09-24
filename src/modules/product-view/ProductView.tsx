"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  NeonIcon,
  Panel,
  SectionTitle,
  Tabs,
  Toast,
} from "@/core/design-system";
import { useCart } from "@/modules/cart/CartProvider";
import { VerifiedReviewFeed } from "@/modules/reviews";
import { InteractiveImGuiDemo } from "@/modules/interactive-demo";
import { HelpFaqPreview } from "@/modules/help";
import {
  formatBrl,
  getProductStartingPrice,
  getProductStock,
  type PublicStoreMedia,
  type PublicStorePlan,
  type PublicStoreProduct,
} from "@/modules/catalog/live";

const tabItems = [
  { id: "description", label: "Descrição" },
  { id: "demo", label: "Demo Interativa" },
  { id: "features", label: "Recursos" },
  { id: "reviews", label: "Avaliações" },
  { id: "faq", label: "Dúvidas" },
];

function durationLabel(plan: PublicStorePlan) {
  const code = String(plan.plan_code || "").toLowerCase();
  const known: Record<string, string> = {
    "1d": "1 dia",
    "3d": "3 dias",
    "7d": "7 dias",
    "15d": "15 dias",
    "30d": "30 dias",
    "90d": "90 dias",
    lifetime: "Vitalício",
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
    <div className="crz-product-gallery__synthetic">
      <div className="crz-product-gallery__orb" aria-hidden="true" />
      <NeonIcon name="gamepad" size={92} />
      <span>CRAZZY PROJECT</span>
    </div>
  );
}

export function ProductView({
  product,
  relatedProducts = [],
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
  const preferred = plans.find((plan) => plan.plan_code === "30d" && planAvailable(plan)) || plans.find(planAvailable) || plans[0];
  const [activeGallery, setActiveGallery] = useState(productGallery[0]?.id || "");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(preferred?.id || "");
  const [activeTab, setActiveTab] = useState("description");
  const [notice, setNotice] = useState<string | null>(null);

  const activeMedia = productGallery.find((item) => item.id === activeGallery) || productGallery[0];
  const selectedPlanData = plans.find((plan) => plan.id === selectedPlan) || preferred;
  const stock = getProductStock(product);
  const canBuy = Boolean(selectedPlanData && planAvailable(selectedPlanData) && Number(selectedPlanData.price) >= 0);
  const featureLines = [
    ...(product.features || []).map((item) => ({ label: item.label, value: item.value })),
    ...String(product.features_text || "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({ label: "Recurso", value })),
  ];

  const handlePurchase = () => {
    if (!selectedPlanData || !canBuy) {
      setNotice("Este plano não está disponível para compra agora.");
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

    setNotice(selectedPlanData.name + " adicionado ao carrinho.");
    openCart();
  };

  return (
    <main className="crz-product-view">
      <div className="crz-container">
        <nav className="crz-product-breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span>›</span><a href="/produtos">Produtos</a><span>›</span>
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
              <ProductVisual product={product} media={activeMedia} />
              <span className="crz-product-gallery__zoom"><span aria-hidden="true">⌕</span>Ampliar</span>
            </button>

            {productGallery.length > 1 && (
              <div className="crz-product-gallery__thumbs" aria-label="Galeria do produto">
                {productGallery.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === activeGallery ? "is-active" : ""}
                    aria-pressed={item.id === activeGallery}
                    onClick={() => setActiveGallery(item.id)}
                  >
                    <ProductVisual product={product} media={item} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="crz-product-summary">
            <div className="crz-product-summary__badges">
              {product.is_new && <Badge tone="blue">NOVO</Badge>}
              {product.status_label && <Badge tone={product.status === "online" ? "green" : "neutral"}>{product.status_label}</Badge>}
              <Badge tone={stock.state === "available" ? "green" : stock.state === "limited" ? "gold" : "neutral"}>{stock.label}</Badge>
            </div>

            <span className="crz-product-summary__eyebrow">{product.game?.name || "CRAZZY PROJECT"}</span>
            <h1>{product.name}</h1>
            <p className="crz-product-summary__subtitle">{product.description || "Produto digital CRAZZY PROJECT."}</p>

            <div className="crz-product-status-grid">
              <div><span>STATUS</span><strong className={"is-" + stock.state}><i aria-hidden="true" />{stock.label}</strong></div>
              <div><span>PREÇO</span><strong>{getProductStartingPrice(product) == null ? "Indisponível" : "A partir de " + formatBrl(getProductStartingPrice(product)!)}</strong></div>
              <div><span>SUPORTE</span><strong>CRAZZY</strong></div>
            </div>

            <div className="crz-product-plan-block" id="planos">
              <div className="crz-product-plan-block__head">
                <span>ESCOLHA UMA OPÇÃO</span>
                <strong>{selectedPlanData ? durationLabel(selectedPlanData) : "Sem plano"}</strong>
              </div>

              <div className="crz-product-plans">
                {plans.map((plan) => {
                  const available = planAvailable(plan);
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      className={plan.id === selectedPlan ? "is-selected" : ""}
                      aria-pressed={plan.id === selectedPlan}
                      disabled={!available}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {plan.plan_code === "30d" && <b>POPULAR</b>}
                      <strong>{plan.name}</strong>
                      <span>{durationLabel(plan)}</span>
                      <small>
                        {!plan.stock_managed
                          ? "Disponível"
                          : available
                            ? Number(plan.stock_count || 0) + " em estoque"
                            : "ESGOTADO"}
                      </small>
                      <em>{formatBrl(Number(plan.price))}</em>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="crz-product-buy-box">
              <div>
                <small>PLANO SELECIONADO</small>
                <strong>{selectedPlanData?.name || "Nenhum plano disponível"}</strong>
                <span>{selectedPlanData ? formatBrl(Number(selectedPlanData.price)) : "Indisponível"}</span>
              </div>

              <Button
                size="lg"
                disabled={!canBuy}
                onClick={handlePurchase}
                leadingIcon={<NeonIcon name="lightning" size={20} />}
              >
                {canBuy ? "Adicionar ao carrinho" : "Indisponível"}
              </Button>

              
            </div>

            {notice && (
              <div className="crz-product-notice">
                <Toast tone={canBuy ? "success" : "error"}>{notice}</Toast>
              </div>
            )}
          </aside>
        </section>

        <section className="crz-product-benefits" aria-label="Benefícios">
          <div><NeonIcon name="shield" size={30} /><span><strong>Compra segura</strong><small>Confira o resumo antes de finalizar o pagamento.</small></span></div>
          <div><NeonIcon name="lightning" size={30} /><span><strong>Entrega rápida</strong><small>Receba conforme a modalidade do plano escolhido.</small></span></div>
          <div><NeonIcon name="verified" size={30} /><span><strong>Tudo no seu perfil</strong><small>Acompanhe seus pedidos, produtos e acessos em um só lugar.</small></span></div>
          <div><NeonIcon name="community" size={30} /><span><strong>Suporte CRAZZY</strong><small>Fale com nossa equipe sempre que precisar.</small></span></div>
        </section>

        <section className="crz-product-info">
          <div className="crz-product-info__tabs">
            <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} ariaLabel="Informações do produto" />
          </div>

          <Panel className="crz-product-info__panel">
            {activeTab === "description" && (
              <div className="crz-product-info__description">
                <SectionTitle icon={<NeonIcon name="cube" size={28} />} title="Sobre este produto" description="Tudo o que você precisa saber antes de escolher seu plano." />
                <p>{product.description || "Sem descrição publicada ainda."}</p>
                {product.features_text && <p>{product.features_text}</p>}
              </div>
            )}

            {activeTab === "demo" && (
              <div className="crz-product-demo-tab">
                <SectionTitle icon={<NeonIcon name="customization" size={28} />} title="Teste o menu no navegador" description="Simulação visual para conhecer a interface antes da compra." />
                <InteractiveImGuiDemo title={product.name} />
              </div>
            )}

            {activeTab === "features" && (
              <div className="crz-product-compatibility">
                <div>
                  <SectionTitle icon={<NeonIcon name="gear" size={28} />} title="Recursos publicados" description="Veja os principais recursos disponíveis neste produto." />
                  {featureLines.length ? (
                    <ul>{featureLines.map((item, index) => <li key={item.label + index}><strong>{item.label}:</strong> {item.value}</li>)}</ul>
                  ) : (
                    <p>Confira a descrição e escolha o plano que combina com você.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="crz-product-reviews">
                <SectionTitle icon={<NeonIcon name="verified" size={28} />} title="Avaliações verificadas" description="Somente compras elegíveis podem publicar feedback." />
                <VerifiedReviewFeed productId={product.id} limit={20} />
                <a className="crz-button crz-button--secondary crz-button--sm" href="/feedbacks">Ver todos os feedbacks</a>
              </div>
            )}

            {activeTab === "faq" && (
              <div className="crz-product-faq">
                <SectionTitle icon={<NeonIcon name="book" size={28} />} title="Ajuda e dúvidas" description="Respostas da Central de Ajuda da CRAZZY PROJECT." />
                <HelpFaqPreview query={product.name} limit={5} />
                <a className="crz-button crz-button--secondary crz-button--sm" href="/help">Pesquisar na Central de Ajuda</a>
              </div>
            )}
          </Panel>
        </section>

        {relatedProducts.length > 0 && (
          <section className="crz-product-related" aria-labelledby="related-title">
            <SectionTitle icon={<NeonIcon name="featured" size={30} />} title="Você também pode gostar" description="Outras opções que podem combinar com você." />
            <h2 id="related-title" className="sr-only">Produtos relacionados</h2>
            <div className="crz-product-related__grid">
              {relatedProducts.slice(0, 4).map((item) => {
                const itemStock = getProductStock(item);
                return (
                  <a href={"/produto/" + item.slug} key={item.id}>
                    <div className="crz-product-related__art">
                      {item.image_url || item.game?.image_url ? <img src={item.image_url || item.game.image_url || ""} alt="" aria-hidden="true" /> : <NeonIcon name="gamepad" size={48} />}
                    </div>
                    <div>
                      <small>{item.game?.name || "CRAZZY PROJECT"}</small>
                      <strong>{item.name}</strong>
                      <span>{itemStock.label}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {zoomOpen && (
        <div className="crz-product-zoom" role="dialog" aria-modal="true" aria-label="Imagem ampliada do produto" onClick={() => setZoomOpen(false)}>
          <button type="button" onClick={() => setZoomOpen(false)} aria-label="Fechar zoom">×</button>
          <div onClick={(event) => event.stopPropagation()}><ProductVisual product={product} media={activeMedia} /></div>
        </div>
      )}
    </main>
  );
}
