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

type ProductFilter = "all" | "active" | "inactive" | "out";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function productPriceRange(product: ManagerProduct) {
  const prices = product.plans
    .map(plan => Number(plan.price))
    .filter(price => Number.isFinite(price) && price >= 0);

  if (!prices.length) return "Sem preço";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? brl(min) : `${brl(min)} até ${brl(max)}`;
}

function productInternalStock(product: ManagerProduct) {
  return product.plans
    .filter(plan => plan.delivery_mode === "internal_stock")
    .reduce((total, plan) => total + Number(plan.available_stock || 0), 0);
}

function productStockMeta(product: ManagerProduct) {
  const internal = product.plans.filter(plan => plan.delivery_mode === "internal_stock");
  const available = productInternalStock(product);

  if (internal.length) {
    return {
      label: String(available),
      detail: available === 1 ? "1 key" : `${available} keys`,
      tone: available === 0 ? "out" : available <= 10 ? "low" : "ok",
    };
  }

  if (product.plans.some(plan => plan.delivery_mode === "ghost_stock")) {
    return { label: "∞", detail: "estoque fantasma", tone: "infinite" };
  }

  if (product.plans.some(plan => ["purincash_supplier", "lzt_account"].includes(plan.delivery_mode))) {
    return { label: "EXT", detail: "fornecedor externo", tone: "external" };
  }

  return { label: "MAN", detail: "entrega manual", tone: "manual" };
}

function planStockMeta(plan: ManagerPlan) {
  if (plan.delivery_mode === "internal_stock") {
    const value = Number(plan.available_stock || 0);
    return {
      label: String(value),
      detail: value === 1 ? "1 disponível" : `${value} disponíveis`,
      tone: value === 0 ? "out" : value <= 10 ? "low" : "ok",
    };
  }
  if (plan.delivery_mode === "ghost_stock") {
    return { label: "∞", detail: "ilimitado / ticket", tone: "infinite" };
  }
  if (["purincash_supplier", "lzt_account"].includes(plan.delivery_mode)) {
    return { label: "EXT", detail: "fornecedor externo", tone: "external" };
  }
  return { label: "MAN", detail: "entrega manual", tone: "manual" };
}

export function ProductManagerPage() {
  const [catalog, setCatalog] = useState<ManagerCatalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"general" | "fields" | "hooks">("general");
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newProduct, setNewProduct] = useState({
    gameId: "",
    name: "",
    emoji: "🎮",
    accentColor: "#1687FF",
    description: "",
    iconUrl: "",
    bannerUrl: "",
    autoDelivery: true,
    hideDeliveryBadge: false,
    createDefaultPlans: false,
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

  const load = async (
    preserveSelection = true,
    preferredProductId: string | null = null,
    preferredPlanId: string | null = null
  ) => {
    setState("loading");

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

      const wantedId = preferredProductId ?? (preserveSelection ? selectedProductId : null);
      const selected =
        next.products.find(product => product.id === wantedId) ||
        next.products[0] ||
        null;

      setSelectedProductId(selected?.id || null);
      setProductDraft(selected ? cloneProduct(selected) : null);

      const wantedPlanId = preferredPlanId ?? (preserveSelection ? selectedPlanId : null);
      const wantedPlan = selected?.plans.find(plan => plan.id === wantedPlanId) || selected?.plans[0] || null;
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

  useEffect(() => {
    if (!creatingProduct && !editorOpen && !stockModalOpen) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy || stockBusy || imageUploading) return;
      if (stockModalOpen) return setStockModalOpen(false);
      if (creatingProduct) return setCreatingProduct(false);
      setEditorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [creatingProduct, editorOpen, stockModalOpen, busy, stockBusy, imageUploading]);

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

    return catalog.products.filter(product => {
      const queryMatch =
        !q ||
        [product.name, product.game_name, product.status_label]
          .some(value => String(value || "").toLowerCase().includes(q));

      if (!queryMatch) return false;
      if (productFilter === "active") return product.active;
      if (productFilter === "inactive") return !product.active;
      if (productFilter === "out") {
        const internalPlans = product.plans.filter(plan => plan.delivery_mode === "internal_stock");
        return internalPlans.length > 0 && productInternalStock(product) === 0;
      }

      return true;
    });
  }, [catalog, query, productFilter]);

  const selectProduct = (product: ManagerProduct) => {
    setSelectedProductId(product.id);
    setProductDraft(cloneProduct(product));
    const first = product.plans[0] || null;
    setSelectedPlanId(first?.id || null);
    setExpandedPlanId(first?.id || null);
    setPlanDraft(first ? clonePlan(first) : null);
    setStockText("");
    setStockNotice("");
    setNotice("");
  };

  const openProductEditor = (
    product: ManagerProduct,
    tab: "general" | "fields" | "hooks" = "general"
  ) => {
    selectProduct(product);
    setEditorTab(tab);
    setEditorOpen(true);
  };

  const selectPlan = (plan: ManagerPlan) => {
    setSelectedPlanId(plan.id);
    setExpandedPlanId(plan.id);
    setPlanDraft(clonePlan(plan));
    setStockText("");
    setStockNotice("");
    setNotice("");
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copiado.`);
    } catch {
      setNotice(`Não consegui copiar ${label.toLowerCase()} automaticamente.`);
    }
  };

  const syncCurrentProduct = async () => {
    if (!productDraft) return;
    await load(true, productDraft.id, planDraft?.id || null);
    setNotice("Produto sincronizado com o banco.");
  };

  const saveEditorChanges = async () => {
    if (!productDraft || busy) return;
    setBusy(true);
    setNotice("");

    try {
      const productResponse = await fetch("/api/admin/products", {
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
      const productPayload = await productResponse.json().catch(() => ({}));
      if (!productResponse.ok) {
        throw new Error(productPayload?.error || "Falha ao salvar produto.");
      }

      if (planDraft) {
        const planResponse = await fetch("/api/admin/products", {
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
        const planPayload = await planResponse.json().catch(() => ({}));
        if (!planResponse.ok) {
          throw new Error(planPayload?.error || "Produto salvo, mas o plano selecionado falhou.");
        }
      }

      await load(true, productDraft.id, planDraft?.id || null);
      setNotice("Alterações salvas.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao salvar alterações.");
    } finally {
      setBusy(false);
    }
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
          description: newProduct.description,
          iconUrl: newProduct.iconUrl,
          bannerUrl: newProduct.bannerUrl,
          autoDelivery: newProduct.autoDelivery,
          hideDeliveryBadge: newProduct.hideDeliveryBadge,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.created?.id) throw new Error("Falha ao criar produto.");

      const createdId = String(payload.created.id);
      setCreatingProduct(false);
      setNewProduct(current => ({
        ...current,
        name: "",
        description: "",
        iconUrl: "",
        bannerUrl: "",
      }));
      await load(true, createdId, null);
      setEditorTab("fields");
      setEditorOpen(true);
      setNotice("Produto criado. Agora adicione as variações, preços e estoque.");
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

      const createdPlanId = String(payload.created.id);
      setCreatingPlan(false);
      setExpandedPlanId(createdPlanId);
      setEditorTab("fields");
      await load(true, productDraft.id, createdPlanId);
      setNotice("Variação criada. Agora configure preço, estoque e visibilidade.");
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
      await load(true);
      setNotice("Produto salvo.");
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
      await load(true);
      setNotice("Plano salvo.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao salvar plano.");
    } finally {
      setBusy(false);
    }
  };

  const uploadProductAsset = async (
    file: File,
    target: "icon" | "banner",
    mode: "create" | "edit"
  ) => {
    if (imageUploading) return;

    setImageUploading(true);
    setNotice("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", target);

      const response = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Falha ao enviar imagem.");
      }

      const url = String(payload.url);
      if (mode === "create") {
        setNewProduct(current =>
          target === "icon"
            ? { ...current, iconUrl: url }
            : { ...current, bannerUrl: url }
        );
      } else {
        setProductDraft(current => {
          if (!current) return current;
          if (target === "icon") return { ...current, icon_url: url };
          return { ...current, banner_url: url, image_url: url };
        });
      }

      setNotice(target === "icon" ? "Ícone enviado." : "Banner enviado.");
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
      if (
        planDraft.delivery_mode === "internal_stock" &&
        checkedFlags(planDraft.automation_flags, "auto_delivery")
      ) {
        const planResponse = await fetch("/api/admin/products", {
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
        const planPayload = await planResponse.json().catch(() => ({}));
        if (!planResponse.ok) {
          throw new Error(planPayload?.error || "Falha ao preparar estoque automático.");
        }
      }

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

      const stockMessage =
        `${payload.batch.accepted_count} key(s) adicionada(s). ${payload.batch.duplicate_count} duplicada(s) ignorada(s).`;
      setStockNotice(stockMessage);
      setNotice(stockMessage);
      setStockText("");
      setStockModalOpen(false);
      await load(true, productDraft?.id || null, planDraft.id);
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

        {creatingProduct && (
          <div
            className="crz-purin-modal"
            role="presentation"
            onMouseDown={event => {
              if (event.target === event.currentTarget && !busy && !imageUploading) setCreatingProduct(false);
            }}
          >
            <section
              className="crz-purin-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crz-purin-create-title"
            >
              <header className="crz-purin-dialog__top">
                <div className="crz-purin-dialog__title">
                  <span className="crz-purin-dialog__cube">◇</span>
                  <strong id="crz-purin-create-title">NOVO PRODUTO</strong>
                </div>

                <div className="crz-purin-dialog__actions">
                  <button type="button" className="is-muted" disabled>ProductID</button>
                  <button type="button" className="is-green-outline" disabled>➤ Enviar Embed</button>
                  <button type="button" className="is-blue-outline" disabled>⤨ Sincronizar</button>
                  <button
                    type="button"
                    className="is-save"
                    disabled={busy || !newProduct.name.trim() || !newProduct.gameId}
                    onClick={() => void createProduct()}
                  >
                    {busy ? "Criando..." : "Salvar alterações"}
                  </button>
                  <button type="button" className="is-icon" disabled>⧉</button>
                  <button type="button" className="is-icon" disabled>⌘</button>
                  <button type="button" className="is-danger-icon" disabled>♲</button>
                </div>

                <button
                  type="button"
                  className="crz-purin-dialog__close"
                  aria-label="Fechar"
                  disabled={busy || imageUploading}
                  onClick={() => setCreatingProduct(false)}
                >
                  ×
                </button>
              </header>

              <nav className="crz-purin-tabs" aria-label="Etapas do produto">
                <button type="button" className="is-active">Geral</button>
                <button type="button" disabled>Campos</button>
                <button type="button" disabled>Hooks</button>
              </nav>

              <div className="crz-purin-dialog__scroll">
                <section className="crz-purin-general">
                  <div className="crz-purin-general__grid">
                    <label>
                      <span>Nome</span>
                      <input
                        autoFocus
                        value={newProduct.name}
                        onChange={event => setNewProduct({...newProduct,name:event.target.value.slice(0,120)})}
                        placeholder="Nome do produto"
                      />
                    </label>

                    <label>
                      <span>Categoria</span>
                      <select
                        value={newProduct.gameId}
                        onChange={event => setNewProduct({...newProduct,gameId:event.target.value})}
                      >
                        {catalog.games.map(game => (
                          <option key={game.id} value={game.id}>
                            {game.name}{game.active ? "" : " (inativa)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="crz-purin-media-row">
                    <div className="crz-purin-media-card">
                      <span>Ícone</span>
                      <div className="crz-purin-media-preview is-icon">
                        {newProduct.iconUrl ? <img src={newProduct.iconUrl} alt="" /> : <b>{newProduct.emoji || "🎮"}</b>}
                      </div>
                      <label className="crz-purin-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={imageUploading}
                          onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) void uploadProductAsset(file, "icon", "create");
                            event.currentTarget.value = "";
                          }}
                        />
                        {imageUploading ? "Enviando..." : "Upload"}
                      </label>
                      <input
                        value={newProduct.iconUrl}
                        onChange={event => setNewProduct({...newProduct,iconUrl:event.target.value})}
                        placeholder="ou URL"
                      />
                    </div>

                    <div className="crz-purin-media-card is-banner">
                      <span>Banner</span>
                      <div className="crz-purin-media-preview is-banner">
                        {newProduct.bannerUrl ? <img src={newProduct.bannerUrl} alt="" /> : <b>Banner do produto</b>}
                      </div>
                      <label className="crz-purin-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={imageUploading}
                          onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) void uploadProductAsset(file, "banner", "create");
                            event.currentTarget.value = "";
                          }}
                        />
                        {imageUploading ? "Enviando..." : "Upload"}
                      </label>
                      <input
                        value={newProduct.bannerUrl}
                        onChange={event => setNewProduct({...newProduct,bannerUrl:event.target.value})}
                        placeholder="ou URL"
                      />
                    </div>
                  </div>

                  <label className="crz-purin-description">
                    <span>Descrição</span>
                    <textarea
                      rows={8}
                      value={newProduct.description}
                      onChange={event => setNewProduct({...newProduct,description:event.target.value.slice(0,6000)})}
                      placeholder="Descrição completa do produto..."
                    />
                  </label>

                  <section className="crz-purin-delivery">
                    <span>Tipo de Entrega</span>
                    <div>
                      <button
                        type="button"
                        className={!newProduct.autoDelivery ? "is-active" : ""}
                        onClick={() => setNewProduct({...newProduct,autoDelivery:false})}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        className={newProduct.autoDelivery ? "is-active" : ""}
                        onClick={() => setNewProduct({...newProduct,autoDelivery:true})}
                      >
                        Automática
                      </button>
                    </div>
                  </section>

                  <section className="crz-purin-display">
                    <div>
                      <span className="crz-purin-eye">◉</span>
                      <strong>Exibição</strong>
                    </div>
                    <button
                      type="button"
                      className={"crz-purin-toggle-row " + (newProduct.hideDeliveryBadge ? "is-on" : "")}
                      onClick={() => setNewProduct({...newProduct,hideDeliveryBadge:!newProduct.hideDeliveryBadge})}
                    >
                      <span>
                        <strong>Ocultar selo de entrega</strong>
                        <small>Não mostra "Entrega Automática/Manual" nos embeds.</small>
                      </span>
                      <i />
                    </button>
                  </section>

                </section>
              </div>
            </section>
          </div>
        )}

        {editorOpen && productDraft && (
          <div
            className="crz-purin-modal crz-purin-editor-modal"
            role="presentation"
            onMouseDown={event => {
              if (
                event.target === event.currentTarget &&
                !busy &&
                !stockBusy &&
                !imageUploading
              ) {
                setEditorOpen(false);
              }
            }}
          >
            <section
              className="crz-purin-dialog crz-purin-dialog--editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crz-purin-editor-title"
            >
              <header className="crz-purin-dialog__top">
                <div className="crz-purin-dialog__title">
                  <span className="crz-purin-dialog__cube">◇</span>
                  <strong id="crz-purin-editor-title">{productDraft.name}</strong>
                </div>

                <div className="crz-purin-dialog__actions">
                  <button
                    type="button"
                    className="is-muted"
                    onClick={() => void copyText(productDraft.id, "ProductID")}
                  >
                    ProductID
                  </button>
                  <a
                    className="is-green-outline"
                    href={`/admin/campanhas?product=${encodeURIComponent(productDraft.id)}`}
                  >
                    ➤ Enviar Embed
                  </a>
                  <button
                    type="button"
                    className="is-blue-outline"
                    disabled={busy}
                    onClick={() => void syncCurrentProduct()}
                  >
                    ⤨ Sincronizar
                  </button>
                  <button
                    type="button"
                    className="is-save"
                    disabled={busy || stockBusy || imageUploading}
                    onClick={() => void saveEditorChanges()}
                  >
                    {busy ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button
                    type="button"
                    className="is-icon"
                    title="Copiar ProductID"
                    onClick={() => void copyText(productDraft.id, "ProductID")}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="is-icon"
                    title="Hooks e automações"
                    onClick={() => setEditorTab("hooks")}
                  >
                    ⌘
                  </button>
                  <button
                    type="button"
                    className="is-danger-icon"
                    title="Exclusão protegida"
                    onClick={() => setNotice("Exclusão de produto permanece protegida para evitar remoção acidental.")}
                  >
                    ♲
                  </button>
                </div>

                <button
                  type="button"
                  className="crz-purin-dialog__close"
                  aria-label="Fechar"
                  disabled={busy || stockBusy || imageUploading}
                  onClick={() => setEditorOpen(false)}
                >
                  ×
                </button>
              </header>

              <nav className="crz-purin-tabs" aria-label="Editor do produto">
                <button
                  type="button"
                  className={editorTab === "general" ? "is-active" : ""}
                  onClick={() => setEditorTab("general")}
                >
                  Geral
                </button>
                <button
                  type="button"
                  className={editorTab === "fields" ? "is-active" : ""}
                  onClick={() => setEditorTab("fields")}
                >
                  Campos
                </button>
                <button
                  type="button"
                  className={editorTab === "hooks" ? "is-active" : ""}
                  onClick={() => setEditorTab("hooks")}
                >
                  Hooks
                </button>
              </nav>

              <div className="crz-purin-dialog__scroll">
                {editorTab === "general" && (
                  <section className="crz-purin-general">
                    <div className="crz-purin-general__grid">
                      <label>
                        <span>Nome</span>
                        <input
                          value={productDraft.name}
                          onChange={event => setProductDraft({...productDraft,name:event.target.value})}
                        />
                      </label>

                      <label>
                        <span>Categoria</span>
                        <select
                          value={productDraft.game_id}
                          onChange={event => {
                            const game = catalog.games.find(item => item.id === event.target.value);
                            setProductDraft({
                              ...productDraft,
                              game_id:event.target.value,
                              game_name:game?.name || productDraft.game_name,
                            });
                          }}
                        >
                          {catalog.games.map(game => (
                            <option key={game.id} value={game.id}>
                              {game.name}{game.active ? "" : " (inativa)"}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="crz-purin-media-row">
                      <div className="crz-purin-media-card">
                        <span>Ícone</span>
                        <div className="crz-purin-media-preview is-icon">
                          {productDraft.icon_url || productDraft.image_url ? (
                            <img src={productDraft.icon_url || productDraft.image_url || ""} alt="" />
                          ) : (
                            <b>{productDraft.emoji || "🎮"}</b>
                          )}
                        </div>
                        <label className="crz-purin-upload">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            disabled={imageUploading}
                            onChange={event => {
                              const file = event.target.files?.[0];
                              if (file) void uploadProductAsset(file, "icon", "edit");
                              event.currentTarget.value = "";
                            }}
                          />
                          {imageUploading ? "Enviando..." : "Upload"}
                        </label>
                        <input
                          value={productDraft.icon_url || ""}
                          onChange={event => setProductDraft({...productDraft,icon_url:event.target.value})}
                          placeholder="ou URL"
                        />
                      </div>

                      <div className="crz-purin-media-card is-banner">
                        <span>Banner</span>
                        <div className="crz-purin-media-preview is-banner">
                          {productDraft.banner_url || productDraft.image_url ? (
                            <img src={productDraft.banner_url || productDraft.image_url || ""} alt="" />
                          ) : (
                            <b>Banner do produto</b>
                          )}
                        </div>
                        <label className="crz-purin-upload">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            disabled={imageUploading}
                            onChange={event => {
                              const file = event.target.files?.[0];
                              if (file) void uploadProductAsset(file, "banner", "edit");
                              event.currentTarget.value = "";
                            }}
                          />
                          {imageUploading ? "Enviando..." : "Upload"}
                        </label>
                        <input
                          value={productDraft.banner_url || ""}
                          onChange={event => setProductDraft({
                            ...productDraft,
                            banner_url:event.target.value,
                            image_url:event.target.value,
                          })}
                          placeholder="ou URL"
                        />
                      </div>
                    </div>

                    <label className="crz-purin-description">
                      <span>Descrição</span>
                      <textarea
                        rows={9}
                        value={productDraft.description || ""}
                        onChange={event => setProductDraft({...productDraft,description:event.target.value})}
                      />
                    </label>

                    <section className="crz-purin-delivery">
                      <span>Tipo de Entrega</span>
                      <div>
                        <button
                          type="button"
                          className={!checkedFlags(productDraft.automation_flags,"auto_delivery") ? "is-active" : ""}
                          onClick={() => setProductDraft({
                            ...productDraft,
                            automation_flags:{...productDraft.automation_flags,auto_delivery:false},
                          })}
                        >
                          Manual
                        </button>
                        <button
                          type="button"
                          className={checkedFlags(productDraft.automation_flags,"auto_delivery") ? "is-active" : ""}
                          onClick={() => setProductDraft({
                            ...productDraft,
                            automation_flags:{...productDraft.automation_flags,auto_delivery:true},
                          })}
                        >
                          Automática
                        </button>
                      </div>
                    </section>

                    <section className="crz-purin-display">
                      <div>
                        <span className="crz-purin-eye">◉</span>
                        <strong>Exibição</strong>
                      </div>

                      <button
                        type="button"
                        className={"crz-purin-toggle-row " + (productDraft.hide_delivery_badge ? "is-on" : "")}
                        onClick={() => setProductDraft({
                          ...productDraft,
                          hide_delivery_badge:!productDraft.hide_delivery_badge,
                        })}
                      >
                        <span>
                          <strong>Ocultar selo de entrega</strong>
                          <small>Não mostra "Entrega Automática/Manual" nos embeds.</small>
                        </span>
                        <i />
                      </button>
                    </section>

                    <section className="crz-purin-display crz-purin-display--compact">
                      <div>
                        <span className="crz-purin-eye">◆</span>
                        <strong>Catálogo</strong>
                      </div>
                      <button
                        type="button"
                        className={"crz-purin-toggle-row " + (productDraft.active ? "is-on" : "")}
                        onClick={() => setProductDraft({...productDraft,active:!productDraft.active})}
                      >
                        <span>
                          <strong>Produto ativo</strong>
                          <small>Quando desligado, o produto não fica disponível para compra.</small>
                        </span>
                        <i />
                      </button>
                      <button
                        type="button"
                        className={"crz-purin-toggle-row " + (productDraft.is_new ? "is-on" : "")}
                        onClick={() => setProductDraft({...productDraft,is_new:!productDraft.is_new})}
                      >
                        <span>
                          <strong>Selo NOVO</strong>
                          <small>Destaca o produto no catálogo.</small>
                        </span>
                        <i />
                      </button>
                    </section>
                  </section>
                )}

                {editorTab === "fields" && (
                  <section className="crz-purin-fields">
                    <header className="crz-purin-fields__head">
                      <strong>Variações ({productDraft.plans.length})</strong>
                      <div>
                        <button
                          type="button"
                          className="crz-purin-secondary-button"
                          onClick={() => setEditorTab("hooks")}
                        >
                          ◉ Importar do fornecedor
                        </button>
                        <button
                          type="button"
                          className="crz-purin-add-button"
                          onClick={() => setCreatingPlan(value => !value)}
                        >
                          ＋ Adicionar Campo ＋
                        </button>
                      </div>
                    </header>

                    {creatingPlan && (
                      <div className="crz-purin-add-field">
                        <label>
                          <span>Nome</span>
                          <input
                            autoFocus
                            value={newPlan.name}
                            onChange={event => setNewPlan({...newPlan,name:event.target.value.slice(0,80)})}
                            placeholder="Ex.: 1 DIA"
                          />
                        </label>
                        <label>
                          <span>Duração</span>
                          <select
                            value={newPlan.planCode}
                            onChange={event => setNewPlan({...newPlan,planCode:event.target.value as ManagerPlanCode})}
                          >
                            {planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Valor</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newPlan.price}
                            onChange={event => setNewPlan({...newPlan,price:Number(event.target.value)})}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy || !newPlan.name.trim()}
                          onClick={() => void createPlan()}
                        >
                          {busy ? "Criando..." : "Criar campo"}
                        </button>
                      </div>
                    )}

                    <div className="crz-purin-variation-list">
                      {productDraft.plans.map(plan => {
                        const isExpanded = expandedPlanId === plan.id;
                        const stock = planStockMeta(plan);
                        const workingPlan = selectedPlanId === plan.id && planDraft ? planDraft : plan;

                        return (
                          <article key={plan.id} className={"crz-purin-variation " + (isExpanded ? "is-expanded" : "")}>
                            <button
                              type="button"
                              className="crz-purin-variation__row"
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedPlanId(null);
                                  return;
                                }
                                selectPlan(plan);
                              }}
                            >
                              <span className="crz-purin-drag">⠿</span>
                              <span className="crz-purin-flame">🔥</span>
                              <span className="crz-purin-variation__name">
                                <strong>{plan.name}</strong>
                                <small>{Number(plan.price).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:2})}</small>
                              </span>
                              <span className={"crz-purin-stock-pill is-" + stock.tone}>
                                {stock.tone === "infinite" ? "∞ em estoque" : `${stock.label} em estoque`}
                              </span>
                              <span className="crz-purin-chevron">{isExpanded ? "⌃" : "⌄"}</span>
                            </button>

                            <div className="crz-purin-variation__tools">
                              <button
                                type="button"
                                title="Copiar ID da variação"
                                onClick={() => void copyText(plan.id, "ProductID da variação")}
                              >
                                ⧉
                              </button>
                              <button
                                type="button"
                                title="Exclusão protegida"
                                onClick={() => setNotice("Exclusão de variação permanece protegida para evitar perda de estoque.")}
                              >
                                ♲
                              </button>
                            </div>

                            {isExpanded && selectedPlanId === plan.id && planDraft && (
                              <div className="crz-purin-variation__editor">
                                <div className="crz-purin-variation__grid">
                                  <label>
                                    <span>Nome</span>
                                    <input
                                      value={workingPlan.name}
                                      onChange={event => setPlanDraft({...planDraft,name:event.target.value})}
                                    />
                                  </label>
                                  <label>
                                    <span>Produto ID</span>
                                    <div className="crz-purin-copy-input">
                                      <input value={workingPlan.id} readOnly />
                                      <button
                                        type="button"
                                        onClick={() => void copyText(workingPlan.id, "ProductID da variação")}
                                      >
                                        ⧉
                                      </button>
                                    </div>
                                  </label>
                                  <label>
                                    <span>Valor</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={workingPlan.price}
                                      onChange={event => setPlanDraft({...planDraft,price:Number(event.target.value)})}
                                    />
                                  </label>
                                  <label>
                                    <span>Duração</span>
                                    <select
                                      value={workingPlan.plan_code || "custom"}
                                      onChange={event => setPlanDraft({...planDraft,plan_code:event.target.value as ManagerPlanCode})}
                                    >
                                      {planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                  </label>
                                </div>

                                <button
                                  type="button"
                                  className={"crz-purin-hidden-sale " + (!workingPlan.active ? "is-on" : "")}
                                  onClick={() => setPlanDraft({...planDraft,active:!planDraft.active})}
                                >
                                  <span>
                                    <strong>Venda oculta</strong>
                                    <small>Não será exibido no produto e só pode ser comprado via URL.</small>
                                  </span>
                                  <i />
                                </button>

                                <section className="crz-purin-custom-stock">
                                  <header>
                                    <div>
                                      <strong>Estoque Personalizado</strong>
                                      <span>•</span>
                                      <b>{workingPlan.available_stock} em estoque</b>
                                    </div>
                                  </header>

                                  <div className="crz-purin-custom-stock__row">
                                    <button
                                      type="button"
                                      className={"crz-purin-toggle-row " + (workingPlan.delivery_mode === "internal_stock" ? "is-on" : "")}
                                      onClick={() => setPlanDraft({
                                        ...planDraft,
                                        delivery_mode: planDraft.delivery_mode === "internal_stock" ? "manual" : "internal_stock",
                                        automation_flags:{
                                          ...planDraft.automation_flags,
                                          auto_delivery: planDraft.delivery_mode !== "internal_stock",
                                        },
                                      })}
                                    >
                                      <span>
                                        <strong>Usar estoque</strong>
                                        <small>Usar estoque para esse campo.</small>
                                      </span>
                                      <i />
                                    </button>

                                    <button
                                      type="button"
                                      className="crz-purin-add-stock"
                                      onClick={() => {
                                        setStockText("");
                                        setStockNotice("");
                                        setStockModalOpen(true);
                                      }}
                                    >
                                      ＋ Adicionar Estoque
                                    </button>
                                  </div>
                                </section>

                                <div className="crz-purin-variation__advanced">
                                  <label>
                                    <span>Modo de entrega</span>
                                    <select
                                      value={planDraft.delivery_mode}
                                      onChange={event => setPlanDraft({
                                        ...planDraft,
                                        delivery_mode:event.target.value as ManagerPlan["delivery_mode"],
                                      })}
                                    >
                                      {deliveryModes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className="crz-purin-save-field"
                                    disabled={busy}
                                    onClick={() => void savePlan()}
                                  >
                                    {busy ? "Salvando..." : "Salvar campo"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {!productDraft.plans.length && (
                        <div className="crz-purin-fields__empty">
                          <strong>Nenhuma variação criada.</strong>
                          <span>Clique em "Adicionar Campo +" para criar Diário, Semanal, Mensal ou qualquer outro plano.</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {editorTab === "hooks" && (
                  <section className="crz-purin-hooks">
                    <header>
                      <strong>Hooks & Automação</strong>
                      <span>Integrações e comportamentos do produto selecionado.</span>
                    </header>

                    <div className="crz-purin-hooks__block">
                      <strong>Produto</strong>
                      <div className="crz-pm-automation">
                        {automationKeys.map(([key,label]) => {
                          const active = checkedFlags(productDraft.automation_flags,key);
                          return (
                            <button
                              type="button"
                              key={key}
                              className={active ? "is-on" : ""}
                              onClick={() => setProductDraft({
                                ...productDraft,
                                automation_flags:{...productDraft.automation_flags,[key]:!active},
                              })}
                            >
                              <i />{label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {planDraft ? (
                      <>
                        <div className="crz-purin-hooks__block">
                          <strong>Discord • {planDraft.name}</strong>
                          <div className="crz-purin-hooks__grid">
                            <label><span>Role ID</span><input value={planDraft.discord_role_id || ""} onChange={event => setPlanDraft({...planDraft,discord_role_id:event.target.value})} /></label>
                            <label><span>Nome do cargo</span><input value={planDraft.discord_role_name || ""} onChange={event => setPlanDraft({...planDraft,discord_role_name:event.target.value})} /></label>
                            <label><span>Cor</span><input value={planDraft.discord_role_color || ""} onChange={event => setPlanDraft({...planDraft,discord_role_color:event.target.value})} placeholder="#0000FF" /></label>
                            <label><span>Prioridade</span><input type="number" value={planDraft.discord_role_position ?? ""} onChange={event => setPlanDraft({...planDraft,discord_role_position:event.target.value ? Number(event.target.value) : null})} /></label>
                          </div>
                        </div>

                        <div className="crz-purin-hooks__block">
                          <strong>Fornecedor</strong>
                          <div className="crz-purin-hooks__grid">
                            <label><span>Provider</span><input value={planDraft.supplier_provider || ""} onChange={event => setPlanDraft({...planDraft,supplier_provider:event.target.value})} placeholder="purincash" /></label>
                            <label><span>Produto externo</span><input value={planDraft.supplier_product_id || ""} onChange={event => setPlanDraft({...planDraft,supplier_product_id:event.target.value})} /></label>
                            <label className="is-wide"><span>Variação externa</span><input value={planDraft.supplier_variation_id || ""} onChange={event => setPlanDraft({...planDraft,supplier_variation_id:event.target.value})} /></label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="crz-purin-hooks__empty">Selecione uma variação na aba Campos para editar hooks específicos.</div>
                    )}

                    <div className="crz-purin-hooks__block">
                      <strong>Academy</strong>
                      <div className="crz-purin-tutorial-buttons">
                        {catalog.tutorials.map(tutorial => {
                          const active = productDraft.tutorials.some(item => item.id === tutorial.id);
                          return (
                            <button
                              type="button"
                              key={tutorial.id}
                              className={active ? "is-active" : ""}
                              onClick={() => toggleProductTutorial(tutorial.id)}
                            >
                              {active ? "✓ " : ""}{tutorial.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        )}

        {stockModalOpen && planDraft && (
          <div
            className="crz-purin-stock-modal"
            role="presentation"
            onMouseDown={event => {
              if (event.target === event.currentTarget && !stockBusy) setStockModalOpen(false);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="crz-stock-modal-title">
              <header>
                <div>
                  <small>ADICIONAR ESTOQUE</small>
                  <h3 id="crz-stock-modal-title">{planDraft.name}</h3>
                  <span>Uma linha = uma key. As chaves ficam presas somente a esta variação.</span>
                </div>
                <button type="button" disabled={stockBusy} onClick={() => setStockModalOpen(false)}>×</button>
              </header>

              <div className="crz-purin-stock-modal__body">
                <div className="crz-purin-stock-modal__summary">
                  <span>Estoque atual</span>
                  <strong>{planDraft.available_stock}</strong>
                  <small>key(s) disponíveis</small>
                </div>

                {planDraft.delivery_mode !== "internal_stock" && (
                  <div className="crz-pm-stock-warning">
                    <span>Este campo ainda não usa estoque interno. Ative para a compra consumir uma key automaticamente.</span>
                    <button type="button" onClick={prepareAutomaticStock}>Ativar estoque automático</button>
                  </div>
                )}

                <label>
                  <span>Keys / códigos</span>
                  <textarea
                    autoFocus
                    rows={13}
                    value={stockText}
                    onChange={event => setStockText(event.target.value)}
                    placeholder={"KEY-0001\nKEY-0002\nKEY-0003"}
                    spellCheck={false}
                  />
                </label>

                <div className="crz-purin-stock-modal__counter">
                  <strong>{stockItems.length}</strong>
                  <span>key(s) detectadas</span>
                  <small>Máximo de 5.000 por lote. Duplicadas são ignoradas.</small>
                </div>
                {stockItems.length > 5000 && <div className="crz-pm-stock-error">Divida este lote: o limite é 5.000 linhas.</div>}
                {stockNotice && <div className="crz-pm-stock-notice">{stockNotice}</div>}
              </div>

              <footer>
                <button type="button" className="crz-purin-secondary-button" disabled={stockBusy} onClick={() => setStockModalOpen(false)}>Cancelar</button>
                <button
                  type="button"
                  className="crz-purin-add-button"
                  disabled={stockBusy || !stockItems.length || stockItems.length > 5000}
                  onClick={() => void importPlanStock()}
                >
                  {stockBusy ? "Adicionando..." : "Adicionar ao estoque"}
                </button>
              </footer>
            </section>
          </div>
        )}

        <section className="crz-pm-overview">
          <header className="crz-pm-overview__head">
            <div>
              <small>VISÃO GERAL DO CATÁLOGO</small>
              <h2>{catalog.products.length} produto(s)</h2>
              <p>Produto, categoria, planos, estoque e faixa de preço em uma tela só.</p>
            </div>
            <button
              type="button"
              className="crz-button crz-button--primary crz-button--md"
              onClick={() => setCreatingProduct(true)}
            >
              + Criar produto
            </button>
          </header>

          <div className="crz-pm-overview__toolbar">
            <label className="crz-pm-overview__search">
              <span>⌕</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Pesquisar produto, categoria ou status..."
              />
            </label>
            <div className="crz-pm-overview__filters" aria-label="Filtros de produto">
              {([
                ["all", "Todos"],
                ["active", "Ativos"],
                ["inactive", "Desativados"],
                ["out", "Sem estoque"],
              ] as Array<[ProductFilter, string]>).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={productFilter === value ? "is-active" : ""}
                  onClick={() => setProductFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="crz-pm-overview__table-wrap">
            <div className="crz-pm-overview__table">
              <div className="crz-pm-overview__row is-head">
                <span>Produto</span>
                <span>Categoria</span>
                <span>Planos</span>
                <span>Estoque</span>
                <span>Preço</span>
                <span>Status</span>
              </div>

              {filtered.length ? filtered.map(product => {
                const stock = productStockMeta(product);
                return (
                  <button
                    type="button"
                    key={product.id}
                    className={"crz-pm-overview__row " + (selectedProductId === product.id ? "is-selected" : "")}
                    onClick={() => openProductEditor(product, "general")}
                  >
                    <span className="crz-pm-overview__product">
                      <i style={{ "--accent": product.accent_color || "#1687ff" } as React.CSSProperties}>
                        {product.image_url ? <img src={product.image_url} alt="" /> : product.emoji || "◆"}
                      </i>
                      <b>
                        <strong>{product.name}</strong>
                        <small>{product.status_label || "Sem status"}</small>
                      </b>
                    </span>
                    <span className="crz-pm-overview__category">{product.game_name}</span>
                    <span className="crz-pm-overview__plans">{product.plans.length} plano(s)</span>
                    <span className={"crz-pm-overview__stock is-" + stock.tone}>
                      <strong>{stock.label}</strong>
                      <small>{stock.detail}</small>
                    </span>
                    <span className="crz-pm-overview__price">{productPriceRange(product)}</span>
                    <span>
                      <Badge tone={product.active ? "green" : "neutral"}>
                        {product.active ? "ATIVO" : "OFF"}
                      </Badge>
                    </span>
                  </button>
                );
              }) : (
                <div className="crz-pm-overview__empty">
                  Nenhum produto corresponde aos filtros.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="crz-pm-layout">
          <aside className="crz-pm-products">
            <div className="crz-pm-products__head">
              <span>CATÁLOGO</span>
              <button type="button" onClick={() => setCreatingProduct(value => !value)}>
                {creatingProduct ? "Cancelar" : "+ Produto"}
              </button>
            </div>

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

          <section id="pm-editor" className="crz-pm-editor">
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
                  <a href="#pm-planos-rapido">Planos & Estoque</a>
                  <a href="#pm-geral">Geral</a>
                  <a href="#pm-automacao">Automação</a>
                  <a href="#pm-academy">Academy</a>
                </nav>

                <section id="pm-planos-rapido" className="crz-pm-plan-quick crz-pm-anchor-section">
                  <header className="crz-pm-plan-quick__head">
                    <div>
                      <small>PLANOS & ESTOQUE</small>
                      <h2>Venda por plano, estoque por plano</h2>
                      <p>Crie o plano aqui e cole as keys logo abaixo. Não precisa descer a página para achar o estoque.</p>
                    </div>
                    <div className="crz-pm-plan-quick__actions">
                      <Badge tone={productDraft.plans.length ? "blue" : "pink"}>
                        {productDraft.plans.length} PLANO(S)
                      </Badge>
                      <button
                        type="button"
                        className="crz-button crz-button--primary crz-button--md"
                        onClick={() => setCreatingPlan(value => !value)}
                      >
                        {creatingPlan ? "Fechar criador" : "+ Criar plano"}
                      </button>
                    </div>
                  </header>

                  {creatingPlan && (
                    <div className="crz-pm-plan-quick__creator">
                      <label>
                        <span>Nome do plano</span>
                        <input
                          autoFocus
                          value={newPlan.name}
                          onChange={event => setNewPlan({...newPlan,name:event.target.value.slice(0,80)})}
                          placeholder="Ex.: Diário"
                        />
                      </label>
                      <label>
                        <span>Duração</span>
                        <select
                          value={newPlan.planCode}
                          onChange={event => setNewPlan({...newPlan,planCode:event.target.value as ManagerPlanCode})}
                        >
                          {planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Preço</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newPlan.price}
                          onChange={event => setNewPlan({...newPlan,price:Number(event.target.value)})}
                          placeholder="10,00"
                        />
                      </label>
                      <button
                        type="button"
                        className="crz-button crz-button--primary crz-button--md"
                        disabled={busy || !newPlan.name.trim()}
                        onClick={() => void createPlan()}
                      >
                        {busy ? "Criando..." : "Criar e abrir plano"}
                      </button>
                    </div>
                  )}

                  {productDraft.plans.length === 0 ? (
                    <div className="crz-pm-plan-quick__empty">
                      <div className="crz-pm-plan-quick__empty-icon">＋</div>
                      <div>
                        <strong>Este produto ainda não tem nenhum plano.</strong>
                        <span>Crie Diário, Semanal, Mensal ou o período que quiser. Depois o campo de estoque aparece aqui mesmo.</span>
                      </div>
                      {!creatingPlan && (
                        <button
                          type="button"
                          className="crz-button crz-button--primary crz-button--md"
                          onClick={() => setCreatingPlan(true)}
                        >
                          + Criar primeiro plano
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="crz-pm-plan-quick__cards">
                        {productDraft.plans.map(plan => {
                          const stock = planStockMeta(plan);
                          return (
                            <button
                              type="button"
                              key={plan.id}
                              className={selectedPlanId === plan.id ? "is-active" : ""}
                              onClick={() => selectPlan(plan)}
                            >
                              <span className="crz-pm-plan-quick__card-top">
                                <strong>{plan.name}</strong>
                                <i className={plan.active ? "is-live" : ""}>{plan.active ? "ATIVO" : "OFF"}</i>
                              </span>
                              <b>{brl(Number(plan.price))}</b>
                              <span className={"crz-pm-plan-quick__card-stock is-" + stock.tone}>
                                <em>{stock.label}</em>
                                <small>{stock.detail}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {planDraft && (
                        <div className="crz-pm-plan-quick__stock">
                          <header>
                            <div>
                              <small>ESTOQUE DO PLANO SELECIONADO</small>
                              <h3>{planDraft.name}</h3>
                              <p>Uma linha = uma key. Ex.: 100 linhas adicionadas = 100 unidades deste plano.</p>
                            </div>
                            <div>
                              <Badge tone={planDraft.available_stock > 0 ? "green" : "pink"}>
                                {planDraft.available_stock} DISPONÍVEL
                              </Badge>
                              <button
                                type="button"
                                className="crz-button crz-button--secondary crz-button--sm"
                                onClick={() => document.getElementById("pm-planos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                              >
                                Configurar plano completo
                              </button>
                            </div>
                          </header>

                          {planDraft.delivery_mode === "internal_stock" && checkedFlags(planDraft.automation_flags, "auto_delivery") ? (
                            <div className="crz-pm-stock-ready">✓ Estoque interno + entrega automática configurados.</div>
                          ) : (
                            <div className="crz-pm-stock-warning">
                              <span>Para entregar a key automaticamente após a compra, use <strong>Estoque interno</strong> + <strong>Entrega automática</strong>.</span>
                              <button type="button" onClick={prepareAutomaticStock}>Preparar automaticamente</button>
                            </div>
                          )}

                          <label className="crz-pm-stock-import">
                            <span>Colar keys / códigos deste plano</span>
                            <textarea
                              rows={7}
                              value={stockText}
                              onChange={event => setStockText(event.target.value)}
                              placeholder={"KEY-0001\nKEY-0002\nKEY-0003"}
                              spellCheck={false}
                            />
                          </label>

                          <div className="crz-pm-stock-footer">
                            <div>
                              <strong>{stockItems.length} key(s) prontas para adicionar</strong>
                              <small>Duplicadas são ignoradas. Limite de 5.000 por lote.</small>
                            </div>
                            <button
                              type="button"
                              className="crz-button crz-button--primary crz-button--md"
                              disabled={stockBusy || !stockItems.length || stockItems.length > 5000}
                              onClick={() => void importPlanStock()}
                            >
                              {stockBusy ? "Adicionando..." : "Adicionar ao estoque deste plano"}
                            </button>
                          </div>

                          {stockItems.length > 5000 && (
                            <div className="crz-pm-stock-error">Este lote passou de 5.000 linhas. Divida em dois lotes.</div>
                          )}
                          {stockNotice && <div className="crz-pm-stock-notice">{stockNotice}</div>}
                        </div>
                      )}
                    </>
                  )}
                </section>

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
                            if (file) void uploadProductAsset(file, "banner", "edit");
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
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingPlan(true);
                          document.getElementById("pm-planos-rapido")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        + Criar plano
                      </button>
                    </div>
                  </header>

                  <div className="crz-pm-plan-tabs">
                    {productDraft.plans.map(plan => {
                      const stock = planStockMeta(plan);
                      return (
                        <button type="button" key={plan.id} className={selectedPlanId === plan.id ? "is-active" : ""} onClick={() => selectPlan(plan)}>
                          <span className="crz-pm-plan-tab__top">
                            <strong>{plan.name}</strong>
                            <i className={plan.active ? "is-live" : "is-off"}>{plan.active ? "ATIVO" : "OFF"}</i>
                          </span>
                          <b>{brl(Number(plan.price))}</b>
                          <span className={"crz-pm-plan-tab__stock is-" + stock.tone}>
                            <em>{stock.label}</em> {stock.detail}
                          </span>
                        </button>
                      );
                    })}
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

                      <div id="pm-stock-detalhado" className="crz-pm-stock-section">
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
