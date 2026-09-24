"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { ManagerCatalog, ManagerPlan, ManagerPlanCode, ManagerProduct } from "./types";

const deliveryModes = [
  ["internal_stock", "Estoque interno"],
  ["ghost_stock", "Estoque Fantasma • ilimitado / ticket"],
  ["purincash_supplier", "Supplier PurinCash"],
  ["lzt_account", "Conta externa"],
  ["manual", "Entrega manual"],
  ["service", "Serviço"],
] as const;

const automationKeys = [
  ["auto_delivery", "Entrega automática"],
  ["auto_discord_role", "Cargo Discord automático"],
  ["auto_tutorial_unlock", "Tutorial automático"],
  ["auto_expire", "Expiração automática"],
] as const;

const planCodes: Array<[ManagerPlanCode, string]> = [
  ["1d", "1 dia"],
  ["3d", "3 dias"],
  ["7d", "7 dias"],
  ["15d", "15 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["lifetime", "Lifetime"],
  ["single", "Uso único"],
  ["custom", "Personalizado"],
];

function cloneProduct(product: ManagerProduct): ManagerProduct {
  return JSON.parse(JSON.stringify(product));
}

function clonePlan(plan: ManagerPlan): ManagerPlan {
  return JSON.parse(JSON.stringify(plan));
}

function checkedFlags(flags: Record<string, unknown>, key: string) {
  return flags?.[key] === true;
}

export function ProductManagerPage() {
  const [catalog, setCatalog] = useState<ManagerCatalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ManagerProduct | null>(null);
  const [planDraft, setPlanDraft] = useState<ManagerPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stockText, setStockText] = useState("");
  const [stockBusy, setStockBusy] = useState(false);
  const [stockNotice, setStockNotice] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newProduct, setNewProduct] = useState({
    gameId: "",
    name: "",
    emoji: "🎮",
    accentColor: "#1687FF",
    createDefaultPlans: true,
  });
  const [newPlan, setNewPlan] = useState<{
    name: string;
    planCode: ManagerPlanCode;
    price: number;
  }>({
    name: "Novo plano",
    planCode: "custom",
    price: 0,
  });

  const load = async (preserveSelection = true) => {
    setState("loading");
    setNotice("");

    try {
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json();
      if (!response.ok) throw new Error("PRODUCT_MANAGER_LOAD_FAILED");

      const next = payload.catalog as ManagerCatalog;
      setCatalog(next);
      setNewProduct(current => ({
        ...current,
        gameId: current.gameId || next.games.find(game => game.active)?.id || next.games[0]?.id || "",
      }));

      const wantedId = preserveSelection ? selectedProductId : null;
      const selected =
        next.products.find(product => product.id === wantedId) ||
        next.products[0] ||
        null;

      setSelectedProductId(selected?.id || null);
      setProductDraft(selected ? cloneProduct(selected) : null);

      const wantedPlan = selected?.plans.find(plan => plan.id === selectedPlanId) || selected?.plans[0] || null;
      setSelectedPlanId(wantedPlan?.id || null);
      setPlanDraft(wantedPlan ? clonePlan(wantedPlan) : null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  const stockItems = useMemo(
    () => stockText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
    [stockText]
  );

  const productAvailableStock = useMemo(
    () => productDraft?.plans.reduce((total, plan) => total + Number(plan.available_stock || 0), 0) || 0,
    [productDraft]
  );

  const activePlans = useMemo(
    () => productDraft?.plans.filter(plan => plan.active).length || 0,
    [productDraft]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!catalog) return [];
    if (!q) return catalog.products;
    return catalog.products.filter(product =>
      [product.name, product.game_name, product.status_label]
        .some(value => String(value || "").toLowerCase().includes(q))
    );
  }, [catalog, query]);

  const selectProduct = (product: ManagerProduct) => {
    setSelectedProductId(product.id);
    setProductDraft(cloneProduct(product));
    const first = product.plans[0] || null;
    setSelectedPlanId(first?.id || null);
    setPlanDraft(first ? clonePlan(first) : null);
    setStockText("");
    setStockNotice("");
    setNotice("");
  };

  const selectPlan = (plan: ManagerPlan) => {
    setSelectedPlanId(plan.id);
    setPlanDraft(clonePlan(plan));
    setStockText("");
    setStockNotice("");
    setNotice("");
  };

  const toggleProductTutorial = (id: string) => {
    if (!productDraft) return;
    const exists = productDraft.tutorials.some(item => item.id === id);
    const tutorial = catalog?.tutorials.find(item => item.id === id);
    if (!tutorial) return;

    setProductDraft({
      ...productDraft,
      tutorials: exists
        ? productDraft.tutorials.filter(item => item.id !== id)
        : [...productDraft.tutorials, tutorial],
    });
  };

  const togglePlanTutorial = (id: string) => {
    if (!planDraft) return;
    const exists = planDraft.tutorials.some(item => item.id === id);
    const tutorial = catalog?.tutorials.find(item => item.id === id);
    if (!tutorial) return;

    setPlanDraft({
      ...planDraft,
      tutorials: exists
        ? planDraft.tutorials.filter(item => item.id !== id)
        : [...planDraft.tutorials, tutorial],
    });
  };

  const createProduct = async () => {
    if (busy || !newProduct.name.trim() || !newProduct.gameId) return;
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_product",
          gameId: newProduct.gameId,
          name: newProduct.name,
          emoji: newProduct.emoji,
          accentColor: newProduct.accentColor,
          createDefaultPlans: newProduct.createDefaultPlans,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.created?.id) throw new Error("Falha ao criar produto.");

      setCreatingProduct(false);
      setNewProduct(current => ({ ...current, name: "" }));
      setSelectedProductId(String(payload.created.id));
      setNotice("Produto criado desativado. Configure os preços antes de ativar.");
      await load(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao criar produto.");
    } finally {
      setBusy(false);
    }
  };

  const createPlan = async () => {
    if (!productDraft || busy || !newPlan.name.trim()) return;
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_plan",
          productId: productDraft.id,
          name: newPlan.name,
          planCode: newPlan.planCode,
          price: newPlan.price,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.created?.id) throw new Error("Falha ao criar plano.");

      setCreatingPlan(false);
      setSelectedPlanId(String(payload.created.id));
      setNotice("Plano criado desativado. Revise entrega, preço e automações antes de ativar.");
      await load(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao criar plano.");
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    if (!productDraft || busy) return;
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "product",
          product: {
            ...productDraft,
            tutorial_ids: productDraft.tutorials.map(item => item.id),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao salvar produto.");
      setNotice("Produto salvo.");
      await load(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao salvar produto.");
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async () => {
    if (!planDraft || busy) return;
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "plan",
          plan: {
            ...planDraft,
            tutorial_ids: planDraft.tutorials.map(item => item.id),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao salvar plano.");
      setNotice("Plano salvo.");
      await load(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao salvar plano.");
    } finally {
      setBusy(false);
    }
  };

  const uploadProductImage = async (file: File) => {
    if (!productDraft || imageUploading) return;

    setImageUploading(true);
    setNotice("");

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Falha ao enviar imagem.");
      }

      setProductDraft(current => current ? { ...current, image_url: String(payload.url) } : current);
      setNotice("Imagem enviada. Clique em Salvar produto para publicar.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao enviar imagem.");
    } finally {
      setImageUploading(false);
    }
  };

  const importPlanStock = async () => {
    if (!planDraft || stockBusy || !stockItems.length || stockItems.length > 5000) return;

    setStockBusy(true);
    setStockNotice("");

    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productPlanId: planDraft.id,
          items: stockItems,
          source: "product-manager",
          note: productDraft ? `Produto: ${productDraft.name} • Plano: ${planDraft.name}` : `Plano: ${planDraft.name}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.batch) {
        throw new Error(payload?.error || "Falha ao adicionar estoque.");
      }

      setStockNotice(
        `${payload.batch.accepted_count} key(s) adicionada(s). ${payload.batch.duplicate_count} duplicada(s) ignorada(s).`
      );
      setStockText("");
      await load(true);
    } catch (error) {
      setStockNotice(error instanceof Error ? error.message : "Falha ao adicionar estoque.");
    } finally {
      setStockBusy(false);
    }
  };

  const prepareAutomaticStock = () => {
    if (!planDraft) return;
    setPlanDraft({
      ...planDraft,
      delivery_mode: "internal_stock",
      automation_flags: {
        ...planDraft.automation_flags,
        auto_delivery: true,
      },
    });
    setStockNotice("Entrega automática preparada. Salve o plano para publicar essa configuração.");
  };

  if (state === "loading" && !catalog) {
    return <main className="crz-product-manager-page crz-pm-state"><span className="crz-spinner" /><p>Carregando produtos...</p></main>;
  }
  if (state === "auth") {
    return <main className="crz-product-manager-page crz-pm-state"><NeonIcon name="shield" size={44} /><strong>Entre para continuar</strong><a className="crz-button crz-button--primary crz-button--sm" href="/login">Entrar</a></main>;
  }
  if (state === "forbidden") {
    return <main className="crz-product-manager-page crz-pm-state"><NeonIcon name="shield" size={44} /><strong>Acesso restrito ao administrador</strong><a className="crz-button crz-button--secondary crz-button--sm" href="/">Voltar</a></main>;
  }
  if (state === "error" || !catalog) {
    return <main className="crz-product-manager-page crz-pm-state"><NeonIcon name="shield" size={44} /><strong>Product Manager indisponível</strong><button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load(false)}>Tentar novamente</button></main>;
  }

  return (
    <main className="crz-product-manager-page">
      <div className="crz-container crz-pm-container">
        <PageHeader
          eyebrow="CRAZZY PRODUCT MANAGER"
          title="Produtos, planos e estoque"
          description="Crie, edite e acompanhe cada produto de forma visual. Preço, imagem, planos e estoque ficam no mesmo lugar."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/admin">Control Center</a>}
        />

        {notice && <div className="crz-pm-notice">{notice}</div>}

        <div className="crz-pm-layout">
          <aside className="crz-pm-products">
            <div className="crz-pm-products__head">
              <span>CATÁLOGO</span>
              <button type="button" onClick={() => setCreatingProduct(value => !value)}>
                {creatingProduct ? "Cancelar" : "+ Produto"}
              </button>
            </div>

            {creatingProduct && (
              <div className="crz-pm-create-card">
                <strong>Novo produto</strong>
                <select value={newProduct.gameId} onChange={event => setNewProduct({...newProduct,gameId:event.target.value})}>
                  {catalog.games.map(game => <option key={game.id} value={game.id}>{game.name}{game.active ? "" : " (inativa)"}</option>)}
                </select>
                <input value={newProduct.name} onChange={event => setNewProduct({...newProduct,name:event.target.value.slice(0,120)})} placeholder="Nome do produto" />
                <div className="crz-pm-create-inline">
                  <input value={newProduct.emoji} onChange={event => setNewProduct({...newProduct,emoji:event.target.value.slice(0,32)})} aria-label="Emoji" />
                  <input type="color" value={newProduct.accentColor} onChange={event => setNewProduct({...newProduct,accentColor:event.target.value})} aria-label="Cor" />
                </div>
                <button type="button" className={newProduct.createDefaultPlans ? "is-on" : ""} onClick={() => setNewProduct({...newProduct,createDefaultPlans:!newProduct.createDefaultPlans})}>
                  <i /> Criar planos padrão 1d → Lifetime
                </button>
                <button type="button" className="crz-button crz-button--primary crz-button--sm" disabled={busy || !newProduct.name.trim() || !newProduct.gameId} onClick={() => void createProduct()}>
                  {busy ? "Criando..." : "Criar produto"}
                </button>
              </div>
            )}

            <div className="crz-pm-search">
              <span>⌕</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto..." />
            </div>

            <div className="crz-pm-products__list">
              {filtered.map(product => (
                <button
                  type="button"
                  key={product.id}
                  className={selectedProductId === product.id ? "is-active" : ""}
                  onClick={() => selectProduct(product)}
                >
                  <div className="crz-pm-product-art" style={{ "--accent": product.accent_color || "#1687ff" } as React.CSSProperties}>
                    {product.image_url ? <img src={product.image_url} alt="" /> : <span>{product.emoji || "◆"}</span>}
                  </div>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.game_name} • {product.plans.length} plano(s)</small>
                  </span>
                  <Badge tone={product.active ? "green" : "neutral"}>{product.active ? "ATIVO" : "OFF"}</Badge>
                </button>
              ))}
            </div>
          </aside>

          <section className="crz-pm-editor">
            {!productDraft ? (
              <div className="crz-pm-state"><p>Nenhum produto selecionado.</p></div>
            ) : (
              <>
                <section className="crz-pm-visual-summary">
                  <div
                    className="crz-pm-visual-cover"
                    style={{ "--accent": productDraft.accent_color || "#1687ff" } as React.CSSProperties}
                  >
                    {productDraft.image_url ? (
                      <img src={productDraft.image_url} alt={productDraft.name} />
                    ) : (
                      <span>{productDraft.emoji || "🎮"}</span>
                    )}
                    {productDraft.is_new && <b>NOVO</b>}
                  </div>

                  <div className="crz-pm-visual-copy">
                    <div className="crz-pm-visual-kicker">
                      <Badge tone={productDraft.active ? "green" : "neutral"}>
                        {productDraft.active ? "PRODUTO ATIVO" : "PRODUTO DESATIVADO"}
                      </Badge>
                      <span>{productDraft.game_name}</span>
                    </div>
                    <h2>{productDraft.name}</h2>
                    <p>{productDraft.description || "Adicione uma descrição clara para o cliente entender exatamente o que está comprando."}</p>
                    <div className="crz-pm-visual-metrics">
                      <div><small>PLANOS</small><strong>{productDraft.plans.length}</strong><span>{activePlans} ativos</span></div>
                      <div><small>ESTOQUE TOTAL</small><strong>{productAvailableStock}</strong><span>keys disponíveis</span></div>
                      <div><small>STATUS</small><strong>{productDraft.status_label || "Sem status"}</strong><span>visível no catálogo</span></div>
                    </div>
                  </div>

                  <div className="crz-pm-visual-actions">
                    <button className="crz-button crz-button--primary crz-button--md" type="button" disabled={busy} onClick={() => void saveProduct()}>
                      {busy ? "Salvando..." : "Salvar produto"}
                    </button>
                    <a className="crz-button crz-button--secondary crz-button--md" href="/admin/estoque">
                      Gerenciar estoque
                    </a>
                  </div>
                </section>

                <nav className="crz-pm-section-nav" aria-label="Seções do produto">
                  <a href="#pm-geral">Geral</a>
                  <a href="#pm-planos">Planos & Estoque</a>
                  <a href="#pm-automacao">Automação</a>
                  <a href="#pm-academy">Academy</a>
                </nav>

                <div id="pm-geral" className="crz-pm-editor__header crz-pm-editor__header--section">
                  <div>
                    <small>INFORMAÇÕES DO PRODUTO</small>
                    <h2>Apresentação e catálogo</h2>
                    <span>Campos grandes, legíveis e organizados para editar sem caça ao tesouro.</span>
                  </div>
                </div>

                <div className="crz-pm-form-grid">
                  <label><span>Nome</span><input value={productDraft.name} onChange={e => setProductDraft({...productDraft,name:e.target.value})} /></label>
                  <label><span>Jogo / categoria</span><select value={productDraft.game_id} onChange={e => {
                    const game = catalog.games.find(item => item.id === e.target.value);
                    setProductDraft({...productDraft,game_id:e.target.value,game_name:game?.name || productDraft.game_name});
                  }}>{catalog.games.map(game => <option key={game.id} value={game.id}>{game.name}{game.active ? "" : " (inativa)"}</option>)}</select></label>
                  <label><span>Emoji</span><input value={productDraft.emoji || ""} onChange={e => setProductDraft({...productDraft,emoji:e.target.value})} placeholder="🎮" /></label>
                  <label><span>Cor</span><div className="crz-pm-color"><input type="color" value={productDraft.accent_color || "#1687ff"} onChange={e => setProductDraft({...productDraft,accent_color:e.target.value})} /><input value={productDraft.accent_color || ""} onChange={e => setProductDraft({...productDraft,accent_color:e.target.value})} placeholder="#1687FF" /></div></label>
                  <label><span>Status interno</span><input value={productDraft.status} onChange={e => setProductDraft({...productDraft,status:e.target.value})} /></label>
                  <label><span>Label de status</span><input value={productDraft.status_label} onChange={e => setProductDraft({...productDraft,status_label:e.target.value})} /></label>
                  <label><span>Ordem</span><input type="number" value={productDraft.sort_order} onChange={e => setProductDraft({...productDraft,sort_order:Number(e.target.value)})} /></label>
                  <div className="crz-pm-media-field is-wide">
                    <div className="crz-pm-media-preview" style={{ "--accent": productDraft.accent_color || "#1687ff" } as React.CSSProperties}>
                      {productDraft.image_url ? <img src={productDraft.image_url} alt="" /> : <span>{productDraft.emoji || "🎮"}</span>}
                    </div>
                    <div className="crz-pm-media-controls">
                      <span>Capa / imagem do produto</span>
                      <p>Envie PNG, JPG, WEBP ou GIF de até 10 MB. A prévia aparece na hora.</p>
                      <label className="crz-pm-upload-button">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={imageUploading}
                          onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) void uploadProductImage(file);
                            event.currentTarget.value = "";
                          }}
                        />
                        {imageUploading ? "Enviando..." : "Escolher imagem do PC"}
                      </label>
                      <input
                        value={productDraft.image_url || ""}
                        onChange={e => setProductDraft({...productDraft,image_url:e.target.value})}
                        placeholder="Ou cole uma URL https://..."
                      />
                    </div>
                  </div>
                  <label className="is-wide"><span>Descrição</span><textarea value={productDraft.description || ""} onChange={e => setProductDraft({...productDraft,description:e.target.value})} rows={3} /></label>
                  <label className="is-wide"><span>Features</span><textarea value={productDraft.features_text || ""} onChange={e => setProductDraft({...productDraft,features_text:e.target.value})} rows={3} /></label>
                </div>

                <div className="crz-pm-switch-row">
                  <button type="button" className={productDraft.active ? "is-on" : ""} onClick={() => setProductDraft({...productDraft,active:!productDraft.active})}><i /> Produto ativo</button>
                  <button type="button" className={productDraft.is_new ? "is-on" : ""} onClick={() => setProductDraft({...productDraft,is_new:!productDraft.is_new})}><i /> Marcar como novo</button>
                </div>

                <div id="pm-automacao" className="crz-pm-subsection crz-pm-anchor-section">
                  <header><small>AUTOMAÇÃO DO PRODUTO</small><strong>Comportamentos padrão</strong></header>
                  <div className="crz-pm-automation">
                    {automationKeys.map(([key,label]) => {
                      const active = checkedFlags(productDraft.automation_flags,key);
                      return <button type="button" key={key} className={active ? "is-on" : ""} onClick={() => setProductDraft({...productDraft,automation_flags:{...productDraft.automation_flags,[key]:!active}})}><i />{label}</button>;
                    })}
                  </div>
                </div>

                <section id="pm-academy" className="crz-pm-tutorials crz-pm-anchor-section">
                  <header><small>ACADEMY</small><h3>Tutorial por produto</h3></header>
                  <div>
                    {catalog.tutorials.map(tutorial => {
                      const active = productDraft.tutorials.some(item => item.id === tutorial.id);
                      return <button type="button" key={tutorial.id} className={active ? "is-active" : ""} onClick={() => toggleProductTutorial(tutorial.id)}>{active ? "✓ " : ""}{tutorial.title}</button>;
                    })}
                  </div>
                </section>

                <section id="pm-planos" className="crz-pm-plans crz-pm-anchor-section">
                  <header>
                    <div><small>PLANOS</small><h3>Configuração de entrega</h3></div>
                    <div className="crz-pm-plans__actions">
                      <span>{productDraft.plans.length} plano(s)</span>
                      <button type="button" onClick={() => setCreatingPlan(value => !value)}>{creatingPlan ? "Cancelar" : "+ Plano"}</button>
                    </div>
                  </header>

                  {creatingPlan && (
                    <div className="crz-pm-create-plan">
                      <label><span>Nome</span><input value={newPlan.name} onChange={event => setNewPlan({...newPlan,name:event.target.value.slice(0,80)})} /></label>
                      <label><span>Código</span><select value={newPlan.planCode} onChange={event => setNewPlan({...newPlan,planCode:event.target.value as ManagerPlanCode})}>{planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label><span>Preço inicial</span><input type="number" min="0" step="0.01" value={newPlan.price} onChange={event => setNewPlan({...newPlan,price:Number(event.target.value)})} /></label>
                      <button type="button" className="crz-button crz-button--primary crz-button--sm" disabled={busy || !newPlan.name.trim()} onClick={() => void createPlan()}>{busy ? "Criando..." : "Criar plano"}</button>
                    </div>
                  )}

                  <div className="crz-pm-plan-tabs">
                    {productDraft.plans.map(plan => (
                      <button type="button" key={plan.id} className={selectedPlanId === plan.id ? "is-active" : ""} onClick={() => selectPlan(plan)}>
                        <span className="crz-pm-plan-tab__top">
                          <strong>{plan.name}</strong>
                          <i className={plan.active ? "is-live" : "is-off"}>{plan.active ? "ATIVO" : "OFF"}</i>
                        </span>
                        <b>R$ {Number(plan.price).toFixed(2)}</b>
                        <span className="crz-pm-plan-tab__stock">
                          <em>{plan.available_stock}</em> disponível(is)
                        </span>
                      </button>
                    ))}
                  </div>

                  {planDraft && (
                    <div className="crz-pm-plan-editor">
                      <div className="crz-pm-form-grid">
                        <label><span>Nome do plano</span><input value={planDraft.name} onChange={e => setPlanDraft({...planDraft,name:e.target.value})} /></label>
                        <label><span>Preço</span><input type="number" step="0.01" value={planDraft.price} onChange={e => setPlanDraft({...planDraft,price:Number(e.target.value)})} /></label>
                        <label><span>Código</span><select value={planDraft.plan_code || "custom"} onChange={e => setPlanDraft({...planDraft,plan_code:e.target.value as ManagerPlanCode})}>{planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label><span>Modo de entrega</span><select value={planDraft.delivery_mode} onChange={e => setPlanDraft({...planDraft,delivery_mode:e.target.value as ManagerPlan["delivery_mode"]})}>{deliveryModes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        {planDraft.delivery_mode==="ghost_stock"&&<div className="crz-pm-ghost-note">👻 Estoque Fantasma: sempre disponível na loja, não consome key e abre entrega por suporte após o pagamento.</div>}
                        <label><span>Emoji</span><input value={planDraft.emoji || ""} onChange={e => setPlanDraft({...planDraft,emoji:e.target.value})} /></label>
                        <label><span>Cor</span><div className="crz-pm-color"><input type="color" value={planDraft.accent_color || productDraft.accent_color || "#1687ff"} onChange={e => setPlanDraft({...planDraft,accent_color:e.target.value})} /><input value={planDraft.accent_color || ""} onChange={e => setPlanDraft({...planDraft,accent_color:e.target.value})} /></div></label>
                        <label><span>Duração entitlement (min)</span><input type="number" value={planDraft.entitlement_duration_minutes ?? ""} onChange={e => setPlanDraft({...planDraft,entitlement_duration_minutes:e.target.value ? Number(e.target.value) : null})} placeholder="vazio = sem expiração" /></label>
                        <label><span>Ordem</span><input type="number" value={planDraft.sort_order} onChange={e => setPlanDraft({...planDraft,sort_order:Number(e.target.value)})} /></label>
                      </div>

                      <div className="crz-pm-stock-section">
                        <header className="crz-pm-stock-head">
                          <div>
                            <small>ESTOQUE DESTE PLANO</small>
                            <strong>Keys separadas por plano, sem misturar produtos</strong>
                            <span>Cada linha abaixo vira 1 unidade vendável deste plano.</span>
                          </div>
                          <div className="crz-pm-stock-head__actions">
                            <Badge tone={planDraft.available_stock > 0 ? "green" : "pink"}>
                              {planDraft.available_stock} DISPONÍVEL
                            </Badge>
                            <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/estoque">
                              Estoque avançado
                            </a>
                          </div>
                        </header>

                        <div className="crz-pm-stock-flow">
                          <div>
                            <b>1</b>
                            <span><strong>Crie o plano</strong><small>Ex.: Diário • R$ 10,00</small></span>
                          </div>
                          <div>
                            <b>2</b>
                            <span><strong>Cole as keys</strong><small>Ex.: 100 linhas = 100 unidades</small></span>
                          </div>
                          <div>
                            <b>3</b>
                            <span><strong>Cliente compra</strong><small>1 unidade sai deste plano</small></span>
                          </div>
                        </div>

                        {planDraft.delivery_mode === "internal_stock" && checkedFlags(planDraft.automation_flags, "auto_delivery") ? (
                          <div className="crz-pm-stock-ready">✓ Entrega automática pronta para usar o estoque interno deste plano.</div>
                        ) : (
                          <div className="crz-pm-stock-warning">
                            <span>As keys podem ser cadastradas agora, mas para entrega automática o plano precisa usar <strong>Estoque interno</strong> + <strong>Entrega automática</strong>.</span>
                            <button type="button" onClick={prepareAutomaticStock}>Preparar automaticamente</button>
                          </div>
                        )}

                        <label className="crz-pm-stock-import">
                          <span>Adicionar keys / códigos ao estoque</span>
                          <textarea
                            rows={8}
                            value={stockText}
                            onChange={event => setStockText(event.target.value)}
                            placeholder={"KEY-0001\nKEY-0002\nKEY-0003"}
                            spellCheck={false}
                          />
                        </label>

                        <div className="crz-pm-stock-footer">
                          <div>
                            <strong>{stockItems.length} key(s) para adicionar</strong>
                            <small>Máximo de 5.000 por lote. Duplicatas são ignoradas com segurança.</small>
                          </div>
                          <button
                            type="button"
                            className="crz-button crz-button--primary crz-button--md"
                            disabled={stockBusy || !stockItems.length || stockItems.length > 5000}
                            onClick={() => void importPlanStock()}
                          >
                            {stockBusy ? "Adicionando..." : "Adicionar ao estoque"}
                          </button>
                        </div>

                        {stockItems.length > 5000 && (
                          <div className="crz-pm-stock-error">Este lote passou de 5.000 linhas. Divida em dois lotes.</div>
                        )}
                        {stockNotice && <div className="crz-pm-stock-notice">{stockNotice}</div>}
                      </div>

                      <div className="crz-pm-subsection">
                        <header><small>DISCORD</small><strong>Cargo automático</strong></header>
                        <div className="crz-pm-form-grid">
                          <label><span>Role ID</span><input value={planDraft.discord_role_id || ""} onChange={e => setPlanDraft({...planDraft,discord_role_id:e.target.value})} /></label>
                          <label><span>Nome</span><input value={planDraft.discord_role_name || ""} onChange={e => setPlanDraft({...planDraft,discord_role_name:e.target.value})} /></label>
                          <label><span>Cor</span><input value={planDraft.discord_role_color || ""} onChange={e => setPlanDraft({...planDraft,discord_role_color:e.target.value})} placeholder="#0000FF" /></label>
                          <label><span>Prioridade</span><input type="number" value={planDraft.discord_role_position ?? ""} onChange={e => setPlanDraft({...planDraft,discord_role_position:e.target.value ? Number(e.target.value) : null})} /></label>
                        </div>
                      </div>

                      <div className="crz-pm-subsection">
                        <header><small>SUPPLIER</small><strong>Vínculo externo opcional</strong></header>
                        <div className="crz-pm-form-grid">
                          <label><span>Provider</span><input value={planDraft.supplier_provider || ""} onChange={e => setPlanDraft({...planDraft,supplier_provider:e.target.value})} placeholder="purincash" /></label>
                          <label><span>Produto externo</span><input value={planDraft.supplier_product_id || ""} onChange={e => setPlanDraft({...planDraft,supplier_product_id:e.target.value})} /></label>
                          <label className="is-wide"><span>Variação externa</span><input value={planDraft.supplier_variation_id || ""} onChange={e => setPlanDraft({...planDraft,supplier_variation_id:e.target.value})} /></label>
                        </div>
                      </div>

                      <div className="crz-pm-automation">
                        {automationKeys.map(([key,label]) => {
                          const active = checkedFlags(planDraft.automation_flags,key);
                          return <button type="button" key={key} className={active ? "is-on" : ""} onClick={() => setPlanDraft({...planDraft,automation_flags:{...planDraft.automation_flags,[key]:!active}})}><i />{label}</button>;
                        })}
                      </div>

                      <section className="crz-pm-tutorials">
                        <header><small>ACADEMY</small><h3>Tutorial específico do plano</h3></header>
                        <div>
                          {catalog.tutorials.map(tutorial => {
                            const active = planDraft.tutorials.some(item => item.id === tutorial.id);
                            return <button type="button" key={tutorial.id} className={active ? "is-active" : ""} onClick={() => togglePlanTutorial(tutorial.id)}>{active ? "✓ " : ""}{tutorial.title}</button>;
                          })}
                        </div>
                      </section>

                      <div className="crz-pm-plan-footer">
                        <div className="crz-pm-switch-row">
                          <button type="button" className={planDraft.active ? "is-on" : ""} onClick={() => setPlanDraft({...planDraft,active:!planDraft.active})}><i /> Plano ativo</button>
                          <button type="button" className={planDraft.show_when_out_of_stock ? "is-on" : ""} onClick={() => setPlanDraft({...planDraft,show_when_out_of_stock:!planDraft.show_when_out_of_stock})}><i /> Mostrar sem estoque</button>
                        </div>
                        <button className="crz-button crz-button--primary crz-button--sm" type="button" disabled={busy} onClick={() => void savePlan()}>{busy ? "Salvando..." : "Salvar plano"}</button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
