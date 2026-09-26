"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { ManagerCatalog, ManagerPlan, ManagerPlanCode, ManagerProduct } from "./types";
import { adminConfirm } from "@/core/ui/adminDialog";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SupplierImportModal } from "./SupplierImportModal";

const planCodes: Array<[ManagerPlanCode, string]> = [
  ["trial", "Trial"],
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

type ProductFilter = "all" | "active" | "inactive" | "new" | "updating" | "out";

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

const compatibilityGroups = [
  ["Windows", ["Windows 10","Windows 11"]],
  ["GPU", ["NVIDIA","AMD","Intel"]],
  ["CPU", ["Intel","AMD"]],
  ["HVCI", ["ON","OFF"]],
  ["Secure Boot", ["Suportado","Não suportado","Tanto faz"]],
] as const;

function toggleFeatureOption(features: Array<{id:string;label:string;value:string;sort_order:number}>, label:string, option:string, sortOrder:number) {
  const current = features.find(item => item.label === label);
  const values = String(current?.value || "").split(",").map(value=>value.trim()).filter(Boolean);
  const next = values.includes(option) ? values.filter(value=>value!==option) : [...values,option];
  const others = features.filter(item=>item.label!==label);
  if (!next.length) return others;
  return [...others,{id:current?.id||("draft-"+label),label,value:next.join(", "),sort_order:sortOrder}]
    .sort((a,b)=>a.sort_order-b.sort_order);
}

function hasFeatureOption(features: Array<{label:string;value:string}>, label:string, option:string) {
  return String(features.find(item=>item.label===label)?.value||"").split(",").map(value=>value.trim()).includes(option);
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
  const draggedPlan = useRef<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ManagerProduct | null>(null);
  const [planDraft, setPlanDraft] = useState<ManagerPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const stockText = planDraft ? stockDrafts[planDraft.id] || "" : "";
  const setStockText = (value: string) => { if (planDraft) setStockDrafts(current => ({...current, [planDraft.id]: value})); };
  const pendingPlans = useRef<Record<string, ManagerPlan>>({});
  const editPlan = (plan: ManagerPlan) => { pendingPlans.current[plan.id] = plan; setPlanDraft(plan); };
  const [stockBusy, setStockBusy] = useState(false);
  const [stockNotice, setStockNotice] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image"|"youtube"|"streamable"|"video">("image");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"general" | "fields">("general");

  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [supplierImportFor, setSupplierImportFor] = useState<{
    productId: string;
    productName: string;
    replacePlanId?: string | null;
  } | null>(null);
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
    status: "offline",
    isNew: true,
    presetPlans: [] as ManagerPlanCode[],
    startMode: "empty" as "empty" | "presets" | "supplier",
    media: [] as Array<{id:string;media_type:string;url:string;sort_order:number}>,
    features: [] as Array<{id:string;label:string;value:string;sort_order:number}>,
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
      setPlanDraft(wantedPlan ? pendingPlans.current[wantedPlan.id] || clonePlan(wantedPlan) : null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  useEffect(() => {
    if (!creatingProduct && !editorOpen) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy || stockBusy || imageUploading) return;

      if (creatingProduct) return setCreatingProduct(false);
      setEditorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [creatingProduct, editorOpen, busy, stockBusy, imageUploading]);

  const stockItems = useMemo(
    () => stockText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
    [stockText]
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
      if (productFilter === "active") return product.active && !["offline","updating"].includes(product.status);
      if (productFilter === "inactive") return !product.active || product.status === "offline";
      if (productFilter === "new") return product.is_new;
      if (productFilter === "updating") return String(product.status || "").toLowerCase() === "updating";
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
    setPlanDraft(first ? pendingPlans.current[first.id] || clonePlan(first) : null);
    setStockNotice("");
    setNotice("");
  };

  const openProductEditor = (
    product: ManagerProduct,
    tab: "general" | "fields" = "general"
  ) => {
    selectProduct(product);
    setEditorTab(tab);
    setEditorOpen(true);
  };

  const selectPlan = (plan: ManagerPlan) => {
    setSelectedPlanId(plan.id);
    setExpandedPlanId(plan.id);
    setPlanDraft(pendingPlans.current[plan.id] || clonePlan(plan));
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
    setNotice("Produto atualizado.");
  };

  const saveEditorChanges = async () => {
    if (!productDraft || busy || imageUploading) return;
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

      const plansToSave = productDraft.plans.filter(plan => pendingPlans.current[plan.id] || stockDrafts[plan.id]?.trim() || plan.id === planDraft?.id);
      for (const plan of plansToSave) await persistPlan(pendingPlans.current[plan.id] || (plan.id === planDraft?.id ? planDraft : null) || clonePlan(plan));

      await load(true, productDraft.id, planDraft?.id || null);
      setNotice("Alterações salvas.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao salvar alterações.");
    } finally {
      setBusy(false);
    }
  };

  const managePlans = async (action: "reorder_plans" | "archive_plan", planId: string, targetId?: string) => {
    if (!productDraft || busy || stockBusy) return;
    if (action === "archive_plan" && !await adminConfirm("Excluir plano", "O plano sai da venda e do editor. Compras, entregas e keys permanecem no histórico.", "Excluir plano")) return;
    const ids = productDraft.plans.map(p => p.id);
    if (action === "reorder_plans") {
      if (!targetId || targetId === planId) return;
      const from = ids.indexOf(planId), to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1); ids.splice(to, 0, planId);
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/products", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action, productId: productDraft.id, planId, planIds: ids}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar os planos.");
      if (action === "reorder_plans") ids.forEach((id, order) => { if (pendingPlans.current[id]) pendingPlans.current[id].sort_order = order; });
      else { delete pendingPlans.current[planId]; setStockDrafts(current => { const next = {...current}; delete next[planId]; return next; }); }
      await load(true, productDraft.id, action === "archive_plan" ? null : selectedPlanId);
      setNotice(action === "archive_plan" ? "Plano excluído. Histórico preservado." : "Ordem dos planos salva.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível atualizar os planos."); }
    finally { setBusy(false); }
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


  const createProduct = async () => {
    if (busy || imageUploading || !newProduct.name.trim() || !newProduct.gameId) return;
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
          createDefaultPlans: false,
          description: newProduct.description,
          iconUrl: newProduct.iconUrl,
          bannerUrl: newProduct.bannerUrl,
          autoDelivery: newProduct.autoDelivery,
          hideDeliveryBadge: newProduct.hideDeliveryBadge,
          status: newProduct.status,
          isNew: newProduct.isNew,
          presetPlans: newProduct.startMode === "presets" ? newProduct.presetPlans : [],
          media: newProduct.media,
          features: newProduct.features,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.created?.id) throw new Error("Falha ao criar produto.");

      const createdId = String(payload.created.id);
      const createdName = newProduct.name.trim();
      const openSupplierAfterCreate = newProduct.startMode === "supplier";
      setCreatingProduct(false);
      setNewProduct(current => ({
        ...current,
        name: "",
        description: "",
        iconUrl: "",
        bannerUrl: "",
        status: "offline",
        isNew: true,
        presetPlans: [],
        startMode: "empty",
        media: [],
        features: [],
      }));
      await load(true, createdId, null);
      setEditorTab("fields");
      setEditorOpen(true);
      if (openSupplierAfterCreate) {
        setSupplierImportFor({ productId: createdId, productName: createdName });
        setNotice("Produto criado. Agora selecione as variações do provedor.");
      } else {
        setNotice("Produto criado. Agora adicione as variações, preços e estoque.");
      }
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


  const persistPlan = async (plan: ManagerPlan) => {
    const response = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "plan",
        plan: {
          ...plan,
          tutorial_ids: plan.tutorials.map(item => item.id),
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Falha ao salvar " + plan.name);
    delete pendingPlans.current[plan.id];
    const keys = plan.delivery_mode === "internal_stock"
      ? (stockDrafts[plan.id] || "").split("\n").map(key => key.trim()).filter(Boolean)
      : [];
    if (keys.length) {
      if (keys.length > 5000) throw new Error("Plano salvo. Limite de 5.000 keys por lote.");
      const imported = await fetch("/api/admin/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({productPlanId: plan.id, items: keys, source: "product-manager"}) });
      const batch = await imported.json().catch(() => ({}));
      if (!imported.ok || !batch.batch) throw new Error("Plano salvo, mas o estoque não foi adicionado. As keys continuam no campo para tentar novamente.");
      setStockDrafts(current => ({...current, [plan.id]: ""}));
      return batch.batch.accepted_count + " key(s) adicionada(s); " + batch.batch.duplicate_count + " duplicada(s) ignorada(s).";
    }
    return "Plano salvo.";
  };

  const savePlan = async () => {
    if (!planDraft || busy || stockBusy) return;
    setBusy(true); setNotice("");
    try { const message = await persistPlan(planDraft); await load(true); setNotice(message); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar plano."); }
    finally { setBusy(false); }
  };

  const createPresetPlans = async () => {
    if (!productDraft || busy) return;
    setBusy(true); setNotice("");
    try {
      const existing = new Set(productDraft.plans.map(plan => plan.plan_code));
      for (const [code, name] of planCodes.filter(([code]) => ["1d", "3d", "7d", "15d", "30d", "90d", "lifetime"].includes(code) && !existing.has(code))) {
        const response = await fetch("/api/admin/products", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"create_plan",productId:productDraft.id,name,planCode:code,price:0}) });
        if (!response.ok) throw new Error("Alguns planos não foram criados. Tente novamente; os existentes serão preservados.");
      }
      await load(true); setNotice("Planos prontos. Ajuste os nomes, preços e keys de cada plano e libere as vendas.");
    } catch(error) { await load(true); setNotice(error instanceof Error ? error.message : "Falha ao criar planos."); }
    finally { setBusy(false); }
  };

  const syncSupplierPlan = async (planId: string) => {
    if (busy || stockBusy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/purincash/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", planId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Não foi possível sincronizar o provedor.");
      await load(true, productDraft?.id || null, planId);
      setNotice("Fornecedor sincronizado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível sincronizar o provedor.");
    } finally {
      setBusy(false);
    }
  };

  const removeSupplierBinding = async (plan: ManagerPlan) => {
    if (busy || stockBusy) return;
    const confirmed = await adminConfirm(
      "Remover fornecedor",
      "Este plano passará a usar estoque próprio. O vínculo externo será removido, mas o histórico de vendas será preservado.",
      "Remover vínculo",
    );
    if (!confirmed) return;

    const automationFlags = { ...plan.automation_flags };
    for (const key of Object.keys(automationFlags)) {
      if (key.startsWith("supplier_")) delete automationFlags[key];
    }
    const next: ManagerPlan = {
      ...clonePlan(plan),
      delivery_mode: "internal_stock",
      supplier_provider: null,
      supplier_product_id: null,
      supplier_variation_id: null,
      automation_flags: { ...automationFlags, auto_delivery: true },
    };

    setBusy(true);
    setNotice("");
    try {
      const message = await persistPlan(next);
      await load(true, productDraft?.id || null, plan.id);
      setNotice(message + " O plano agora usa estoque próprio.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível remover o vínculo.");
    } finally {
      setBusy(false);
    }
  };

  const uploadProductAsset = async (
    file: File,
    target: "icon" | "banner" | "gallery" | "video",
    mode: "create" | "edit"
  ) => {
    if (imageUploading) return;

    setImageUploading(true);
    setNotice("");

    try {
      let url = "";
      {
        const max = target === "video" ? 48 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size <= 0 || file.size > max) throw new Error(target === "video" ? "Vídeo acima de 48 MB." : "Imagem acima de 10 MB.");
        const signedResponse = await fetch("/api/admin/products/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: target, contentType: file.type, size: file.size }),
        });
        const signed = await signedResponse.json().catch(() => ({}));
        if (!signedResponse.ok || !signed?.path || !signed?.token || !signed?.url) {
          throw new Error(signed?.error || "Falha ao preparar upload.");
        }
        const supabase = createBrowserSupabaseClient();
        const uploaded = await supabase.storage.from("site-branding").uploadToSignedUrl(
          String(signed.path),
          String(signed.token),
          file,
          { contentType: file.type }
        );
        if (uploaded.error) throw new Error("Falha ao enviar mídia.");
        url = String(signed.url);
      }
      if (mode === "create") {
        setNewProduct(current => {
          if (target === "icon") return { ...current, iconUrl: url };
          if (target === "banner") return { ...current, bannerUrl: url };
          return {...current,media:[...current.media,{id:crypto.randomUUID(),media_type:target==="video"?"video":"image",url,sort_order:current.media.length}]};
        });
      } else {
        setProductDraft(current => {
          if (!current) return current;
          if (target === "icon") return { ...current, icon_url: url };
          if (target === "banner") return { ...current, banner_url: url, image_url: url };
          return {...current,media:[...(current.media||[]),{id:crypto.randomUUID(),media_type:target==="video"?"video":"image",url,sort_order:(current.media||[]).length}]};
        });
      }

      setNotice(target === "icon" ? "Ícone enviado." : target === "banner" ? "Banner enviado." : target === "video" ? "Vídeo adicionado." : "Imagem adicionada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao enviar imagem.");
    } finally {
      setImageUploading(false);
    }
  };

  const importPlanStock = async () => {
    if (!planDraft || busy || stockBusy || !stockItems.length || stockItems.length > 5000) return;
    setStockBusy(true); setStockNotice("");
    try { const message = await persistPlan(planDraft); await load(true, productDraft?.id || null, planDraft.id); setStockNotice(message); setNotice(message); }
    catch (error) { setStockNotice(error instanceof Error ? error.message : "Falha ao adicionar estoque."); }
    finally { setStockBusy(false); }
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

        {supplierImportFor && (
          <SupplierImportModal
            productId={supplierImportFor.productId}
            productName={supplierImportFor.productName}
            replacePlanId={supplierImportFor.replacePlanId}
            onClose={() => setSupplierImportFor(null)}
            onImported={async () => {
              await load(true, supplierImportFor.productId, supplierImportFor.replacePlanId || null);
              setEditorTab("fields");
              setEditorOpen(true);
            }}
          />
        )}

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
                  <button
                    type="button"
                    className="is-save"
                    disabled={
                      busy ||
                      !newProduct.name.trim() ||
                      !newProduct.gameId ||
                      (newProduct.startMode === "presets" && newProduct.presetPlans.length === 0)
                    }
                    onClick={() => void createProduct()}
                  >
                    {busy ? "Criando..." : "Criar produto"}
                  </button>
                </div>

                <button
                  type="button"
                  className="crz-purin-dialog__close"
                  aria-label="Fechar"
                  disabled={busy || stockBusy || imageUploading}
                  onClick={() => setCreatingProduct(false)}
                >
                  ×
                </button>
              </header>

              <div className="crz-purin-create-note">Preencha o essencial. Planos, estoque, mídia e integrações continuam neste mesmo módulo.</div>

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
                      <div className="crz-pm-category-buttons">{catalog.games.filter(game => game.active).map(game => <button type="button" key={game.id} className={newProduct.gameId===game.id?"is-active":""} onClick={()=>setNewProduct({...newProduct,gameId:game.id})}>{game.name}</button>)}</div>
                      <select className="crz-pm-category-fallback"
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
                      placeholder="Uma descrição principal. O resto o site organiza."
                    />
                  </label>

                  <section className="crz-pm-quick-block crz-pm-start-mode">
                    <header><strong>Como quer começar?</strong><span>Escolha só a estrutura inicial. Você pode alterar tudo depois.</span></header>
                    <div className="crz-pm-start-mode__choices">
                      <button type="button" className={newProduct.startMode==="empty"?"is-active":""} onClick={()=>setNewProduct({...newProduct,startMode:"empty",presetPlans:[]})}>
                        <strong>Vazio</strong><small>Criar só o produto.</small>
                      </button>
                      <button type="button" className={newProduct.startMode==="presets"?"is-active":""} onClick={()=>setNewProduct({...newProduct,startMode:"presets"})}>
                        <strong>Planos predefinidos</strong><small>Escolher durações agora.</small>
                      </button>
                      <button type="button" className={newProduct.startMode==="supplier"?"is-active":""} onClick={()=>setNewProduct({...newProduct,startMode:"supplier",presetPlans:[]})}>
                        <strong>🌐 Importar do provedor</strong><small>Criar vazio e abrir o catálogo PurinCash.</small>
                      </button>
                    </div>
                    {newProduct.startMode==="presets" && (
                      <div className="crz-pm-plan-presets crz-pm-plan-presets--create">
                        {planCodes.filter(([code])=>["1d","3d","7d","15d","30d","90d","lifetime"].includes(code)).map(([code,label])=>{
                          const active=newProduct.presetPlans.includes(code);
                          return <button type="button" key={code} className={active?"is-active":""} onClick={()=>setNewProduct({
                            ...newProduct,
                            presetPlans:active?newProduct.presetPlans.filter(item=>item!==code):[...newProduct.presetPlans,code],
                          })}>{active?"✓ ":""}{label}</button>;
                        })}
                      </div>
                    )}
                  </section>

                  <section className="crz-pm-quick-block">
                    <header><strong>Status</strong><span>Clique. Não precisa escrever.</span></header>
                    <div className="crz-pm-status-presets">
                      {[["online","ONLINE"],["updating","EM UPDATE"],["offline","OFFLINE"]].map(([value,label])=><button type="button" key={value} className={newProduct.status===value?"is-active":""} onClick={()=>setNewProduct({...newProduct,status:value})}>{label}</button>)}
                      <button type="button" className={newProduct.isNew?"is-active":""} onClick={()=>setNewProduct({...newProduct,isNew:!newProduct.isNew})}>NOVO ✨</button>
                    </div>
                  </section>

                  <section className="crz-pm-quick-block">
                    <header><strong>Compatibilidade</strong><span>Marque apenas o que vale para este produto.</span></header>
                    {compatibilityGroups.map(([label,options],groupIndex)=><div className="crz-pm-compat" key={label}><span>{label}</span><div>{options.map(option=><button type="button" key={option} className={hasFeatureOption(newProduct.features,label,option)?"is-active":""} onClick={()=>setNewProduct({...newProduct,features:toggleFeatureOption(newProduct.features,label,option,groupIndex)})}>{option}</button>)}</div></div>)}
                  </section>

                  <section className="crz-pm-quick-block">
                    <header><strong>Demonstração</strong><span>Imagem, vídeo enviado, YouTube ou Streamable.</span></header>
                    <div className="crz-pm-media-compose">
                      <select value={mediaType} onChange={event=>setMediaType(event.target.value as typeof mediaType)}><option value="image">Imagem</option><option value="video">Vídeo</option><option value="youtube">YouTube</option><option value="streamable">Streamable</option></select>
                      <input value={mediaUrl} onChange={event=>setMediaUrl(event.target.value)} placeholder="Cole a URL da mídia"/>
                      <button type="button" onClick={()=>{const url=mediaUrl.trim();if(!url)return;setNewProduct({...newProduct,media:[...newProduct.media,{id:crypto.randomUUID(),media_type:mediaType,url,sort_order:newProduct.media.length}]});setMediaUrl("")}}>Adicionar</button>
                      <label className="crz-purin-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={imageUploading} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadProductAsset(file,"gallery","create");event.currentTarget.value=""}}/>+ Imagem</label>
                      <label className="crz-purin-upload"><input type="file" accept="video/mp4,video/webm" disabled={imageUploading} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadProductAsset(file,"video","create");event.currentTarget.value=""}}/>+ Vídeo</label>
                    </div>
                    {newProduct.media.length>0&&<div className="crz-pm-media-list">{newProduct.media.map((item,index)=><div key={item.id}><span><b>{item.media_type}</b>{item.url}</span><button type="button" onClick={()=>setNewProduct({...newProduct,media:newProduct.media.filter((_,i)=>i!==index)})}>Remover</button></div>)}</div>}
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
                  <button type="button" className="is-save" disabled={busy || stockBusy || imageUploading} onClick={() => void saveEditorChanges()}>
                    {busy ? "Salvando..." : "Salvar alterações"}
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
                  Planos & Estoque
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
                        <div className="crz-pm-category-buttons">{catalog.games.filter(game => game.active).map(game => <button type="button" key={game.id} className={productDraft.game_id===game.id?"is-active":""} onClick={()=>setProductDraft({...productDraft,game_id:game.id,game_name:game.name})}>{game.name}</button>)}</div>
                        <select className="crz-pm-category-fallback"
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
                        placeholder="Uma descrição principal."
                      />
                    </label>

                    <section className="crz-pm-quick-block">
                      <header><strong>Compatibilidade</strong><span>Botões rápidos.</span></header>
                      {compatibilityGroups.map(([label,options],groupIndex)=><div className="crz-pm-compat" key={label}><span>{label}</span><div>{options.map(option=><button type="button" key={option} className={hasFeatureOption(productDraft.features||[],label,option)?"is-active":""} onClick={()=>setProductDraft({...productDraft,features:toggleFeatureOption(productDraft.features||[],label,option,groupIndex)})}>{option}</button>)}</div></div>)}
                    </section>

                    <section className="crz-pm-quick-block">
                      <header><strong>Galeria e vídeo</strong><span>Upload, YouTube ou Streamable.</span></header>
                      <div className="crz-pm-media-compose">
                        <select value={mediaType} onChange={event=>setMediaType(event.target.value as typeof mediaType)}><option value="image">Imagem</option><option value="video">Vídeo</option><option value="youtube">YouTube</option><option value="streamable">Streamable</option></select>
                        <input value={mediaUrl} onChange={event=>setMediaUrl(event.target.value)} placeholder="Cole a URL da mídia"/>
                        <button type="button" onClick={()=>{const url=mediaUrl.trim();if(!url)return;setProductDraft({...productDraft,media:[...(productDraft.media||[]),{id:crypto.randomUUID(),media_type:mediaType,url,sort_order:(productDraft.media||[]).length}]});setMediaUrl("")}}>Adicionar</button>
                        <label className="crz-purin-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={imageUploading} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadProductAsset(file,"gallery","edit");event.currentTarget.value=""}}/>+ Imagem</label>
                        <label className="crz-purin-upload"><input type="file" accept="video/mp4,video/webm" disabled={imageUploading} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadProductAsset(file,"video","edit");event.currentTarget.value=""}}/>+ Vídeo</label>
                      </div>
                      {(productDraft.media||[]).length>0&&<div className="crz-pm-media-list">{(productDraft.media||[]).map((item,index)=><div key={item.id}><span><b>{item.media_type}</b>{item.url}</span><button type="button" onClick={()=>setProductDraft({...productDraft,media:(productDraft.media||[]).filter((_,i)=>i!==index)})}>Remover</button></div>)}</div>}
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
                        <strong>Status do produto</strong>
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
                      <div className="crz-pm-status-presets" aria-label="Status interno">
                        {[
                          ["online","ONLINE"],
                          ["offline","OFFLINE"],
                          ["updating","EM UPDATE"],
                        ].map(([value,label]) => <button type="button" key={value} className={String(productDraft.status||"").toLowerCase()===value?"is-active":""} onClick={()=>setProductDraft({...productDraft,status:value,status_label:label,active:value==="online"?true:value==="offline"?false:productDraft.active})}>{label}</button>)}
                      </div>
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

                {editorTab === "general" && <section className="crz-pm-product-access">
                  <h3>Acesso do cliente</h3>
                  <p>A compra libera os tutoriais deste produto na CRAZZY ACADEMY e envia ao bot o cargo Cliente global e o cargo abaixo. Todos os planos usam o mesmo cargo do produto.</p>
                  <label><span>Cargo do produto no Discord</span><input value={productDraft.discord_role_id || ""} onChange={event => setProductDraft({...productDraft, discord_role_id: event.target.value.trim()})} placeholder="ID do cargo no Discord" inputMode="numeric" /><small>{productDraft.discord_role_id ? "Cargo vinculado ao produto" : "Vincule o cargo deste produto para ativar a sincronização."}</small></label>
                  <label><span>Nome do cargo</span><input value={productDraft.discord_role_name || ("Cliente " + productDraft.name)} onChange={event => setProductDraft({...productDraft, discord_role_name: event.target.value})} /></label>
                  <a href="/admin/discord-bridge">Configurar o cargo Cliente global e consultar o bot →</a>
                  <h4>Tutoriais do produto</h4>
                  <div className="crz-purin-tutorial-buttons">{catalog.tutorials.map(tutorial => <button key={tutorial.id} type="button" className={productDraft.tutorials.some(item=>item.id===tutorial.id)?"is-active":""} onClick={()=>toggleProductTutorial(tutorial.id)}>{productDraft.tutorials.some(item=>item.id===tutorial.id)?"✓ ":""}{tutorial.title}</button>)}</div>
                  {!catalog.tutorials.length && <p>Nenhum tutorial cadastrado. <a href="/admin/academy">Criar tutorial →</a></p>}
                </section>}

                {editorTab === "fields" && (
                  <section className="crz-purin-fields">
                    <header className="crz-purin-fields__head">
                      <strong>Planos ({productDraft.plans.length})</strong>
                      <div>
                        <button
                          type="button"
                          className="crz-purin-add-button"
                          onClick={() => setCreatingPlan(value => !value)}
                        >
                          ＋ Adicionar Plano
                        </button>
                        <button type="button" className="crz-purin-add-button" disabled={busy || stockBusy} onClick={() => void createPresetPlans()}>⚡ Criar predefinidos</button>
                        <button
                          type="button"
                          className="crz-purin-add-button"
                          disabled={busy || stockBusy}
                          onClick={() => setSupplierImportFor({ productId: productDraft.id, productName: productDraft.name })}
                        >
                          🌐 Importar do provedor
                        </button>
                      </div>
                    </header>

                    {creatingPlan && (
                      <>
                      <div className="crz-pm-plan-presets crz-pm-plan-presets--editor">
                        {planCodes.map(([code,label])=><button type="button" key={code} className={newPlan.planCode===code?"is-active":""} onClick={()=>setNewPlan({...newPlan,planCode:code,name:code==="custom"?"Plano personalizado":label.charAt(0).toUpperCase()+label.slice(1)})}>{label}</button>)}
                      </div>
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
                          {busy ? "Criando..." : "Criar plano"}
                        </button>
                      </div>
                      </>
                    )}

                    <div className="crz-purin-variation-list">
                      {productDraft.plans.map((plan, planIndex) => {
                        const isExpanded = expandedPlanId === plan.id;
                        const stock = planStockMeta(plan);
                        const workingPlan = selectedPlanId === plan.id && planDraft ? planDraft : plan;

                        return (
                          <article key={plan.id} className={"crz-purin-variation " + (isExpanded ? "is-expanded" : "")} onDragOver={event => {event.preventDefault(); event.dataTransfer.dropEffect="move";}} onDrop={event => {event.preventDefault(); const source=draggedPlan.current; draggedPlan.current=null; if(source)void managePlans("reorder_plans",source,plan.id);}}>
                            <div className="crz-plan-row-tools">
                              <button type="button" className="crz-purin-drag" draggable={!busy} onDragStart={event=>{draggedPlan.current=plan.id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",plan.id);}} onDragEnd={()=>{draggedPlan.current=null;}} aria-label={"Arrastar " + plan.name} title="Segure e arraste para ordenar">⠿</button>
                              <button type="button" disabled={busy || planIndex===0} aria-label={"Mover " + plan.name + " para cima"} onClick={()=>void managePlans("reorder_plans",plan.id,productDraft.plans[planIndex-1]?.id)}>↑</button>
                              <button type="button" disabled={busy || planIndex===productDraft.plans.length-1} aria-label={"Mover " + plan.name + " para baixo"} onClick={()=>void managePlans("reorder_plans",plan.id,productDraft.plans[planIndex+1]?.id)}>↓</button>
                              <button type="button" className="crz-plan-delete" disabled={busy} aria-label={"Excluir " + plan.name} onClick={()=>void managePlans("archive_plan",plan.id)}>Excluir 🗑</button>
                            </div>
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

                              <span className="crz-purin-flame">🔥</span>
                              <span className="crz-purin-variation__name">
                                <strong>{plan.name}</strong><small>{
                                  !Number(plan.price)
                                    ? "Rascunho · falta preço"
                                    : !plan.active
                                      ? "Pausado"
                                      : plan.delivery_mode === "purincash_supplier"
                                        ? "Fornecedor automático"
                                        : plan.delivery_mode === "internal_stock"
                                          ? Number(plan.available_stock)>0 ? "Disponível" : "Sem estoque"
                                          : stock.detail
                                }</small>
                                <small>{Number(plan.price).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:2})}</small>
                              </span>
                              <span className={"crz-purin-stock-pill is-" + stock.tone}>
                                {plan.delivery_mode === "internal_stock" ? `${stock.label} em estoque` : stock.label}
                              </span>
                              <span className="crz-purin-chevron">{isExpanded ? "⌃" : "⌄"}</span>
                            </button>

                            {isExpanded && selectedPlanId === plan.id && planDraft && (
                              <div className="crz-purin-variation__editor">
                                <div className="crz-purin-variation__grid">
                                  <label>
                                    <span>Nome</span>
                                    <input
                                      value={workingPlan.name}
                                      onChange={event => editPlan({...planDraft,name:event.target.value})}
                                    />
                                  </label>
                                  <label>
                                    <span>Valor</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={workingPlan.price}
                                      onChange={event => editPlan({...planDraft,price:Number(event.target.value)})}
                                    />
                                  </label>
                                  <label>
                                    <span>Duração</span>
                                    <select
                                      value={workingPlan.plan_code || "custom"}
                                      onChange={event => editPlan({...planDraft,plan_code:event.target.value as ManagerPlanCode})}
                                    >
                                      {planCodes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                  </label>
                                </div>

                                {workingPlan.plan_code==="custom"&&<label><span>Duração personalizada (minutos)</span><input type="number" min="1" max="5256000" placeholder="Sem expiração" value={workingPlan.entitlement_duration_minutes??""} onChange={event=>editPlan({...planDraft,entitlement_duration_minutes:event.target.value?Number(event.target.value):null})}/></label>}

                                <button
                                  type="button"
                                  className={"crz-purin-hidden-sale " + (!workingPlan.active ? "is-on" : "")}
                                  onClick={() => editPlan({...planDraft,active:!planDraft.active})}
                                >
                                  <span>
                                    <strong>Pausar vendas</strong>
                                    <small>Este plano fica indisponível para novas compras.</small>
                                  </span>
                                  <i />
                                </button>

                                {workingPlan.delivery_mode === "internal_stock" && (
                                  <section className="crz-purin-stock-simple">
                                    <header><div><strong>Estoque do plano</strong><small>Entrega automática após a confirmação do pagamento.</small></div>
                                      <span className={"crz-purin-stock-pill is-" + (Number(workingPlan.available_stock) > 0 ? "ok" : "out")}>{Number(workingPlan.available_stock || 0)} em estoque</span>
                                    </header>
                                    <label className="crz-pm-inline-stock"><span>Keys deste plano — uma por linha</span><textarea rows={5} value={stockText} onChange={event => setStockText(event.target.value)} placeholder={"COLE-UMA-KEY-AQUI\nOUTRA-KEY-DO-MESMO-PLANO"} spellCheck={false} disabled={busy || stockBusy} /><small>{stockItems.length} key(s) no lote. Máximo de 5.000. Duplicadas são ignoradas.</small></label>
                                    {stockNotice && <p role="status">{stockNotice}</p>}
                                    <div className="crz-purin-stock-simple__controls">
                                      <button type="button" className="crz-purin-add-stock" disabled={busy || stockBusy || !stockItems.length || stockItems.length > 5000} onClick={() => void importPlanStock()}>{stockBusy ? "Adicionando…" : "Adicionar " + stockItems.length + " key(s)"}</button>
                                      <a className="crz-purin-secondary-button" href={"/admin/estoque?planId=" + plan.id}>Consultar estoque</a>
                                      <button type="button" className="crz-purin-save-field" disabled={busy || stockBusy} onClick={() => void savePlan()}>{busy ? "Salvando..." : "Salvar plano"}</button>
                                    </div>
                                    <p className="crz-purin-stock-simple__hint">As keys ficam vinculadas somente a este plano. A quantidade é calculada pelas keys disponíveis.</p>
                                  </section>
                                )}

                                {workingPlan.delivery_mode === "purincash_supplier" && (() => {
                                  const flags = workingPlan.automation_flags || {};
                                  const providerName = String(flags.supplier_display_name || "PurinCash");
                                  const variationName = String(flags.supplier_variation_name || workingPlan.name);
                                  const synced = String(flags.supplier_sync_status || "") === "synced";
                                  const unlimited = flags.supplier_unlimited === true;
                                  const supplierStock = Number(flags.supplier_stock);
                                  const catalogCents = Number(flags.supplier_catalog_price_cents || 0);
                                  return (
                                    <section className="crz-supplier-binding-card">
                                      <header>
                                        <div><strong>🌐 Estoque automático</strong><small>Entrega direta pelo provedor, sem keys locais.</small></div>
                                        <span className={synced ? "is-ok" : "is-warn"}>{synced ? "● Sincronizado" : "● Revisar"}</span>
                                      </header>
                                      <div className="crz-supplier-binding-grid">
                                        <span><small>PROVEDOR</small><strong>PurinCash</strong></span>
                                        <span><small>PRODUTO</small><strong>{providerName}</strong></span>
                                        <span><small>VARIAÇÃO</small><strong>{variationName}</strong></span>
                                        <span><small>ESTOQUE</small><strong>{unlimited ? "∞" : Number.isFinite(supplierStock) ? supplierStock : "Externo"}</strong></span>
                                        <span><small>PREÇO INFORMADO</small><strong>{catalogCents > 0 ? brl(catalogCents / 100) : "Não informado"}</strong></span>
                                        <span><small>SEU PREÇO</small><strong>{brl(Number(workingPlan.price || 0))}</strong></span>
                                      </div>
                                      <div className="crz-supplier-binding-actions">
                                        <button type="button" disabled={busy || stockBusy} onClick={() => void syncSupplierPlan(plan.id)}>Sincronizar</button>
                                        <button type="button" disabled={busy || stockBusy} onClick={() => setSupplierImportFor({ productId: productDraft.id, productName: productDraft.name, replacePlanId: plan.id })}>Trocar</button>
                                        <button type="button" className="is-danger" disabled={busy || stockBusy} onClick={() => void removeSupplierBinding(workingPlan)}>Remover vínculo</button>
                                        <button type="button" className="crz-purin-save-field" disabled={busy || stockBusy} onClick={() => void savePlan()}>{busy ? "Salvando..." : "Salvar preço"}</button>
                                      </div>
                                      <p>O conteúdo do fornecedor não é copiado para o estoque CRAZZY. A entrega só é revelada ao comprador pela Biblioteca após o pagamento confirmado.</p>
                                    </section>
                                  );
                                })()}

                                {!["internal_stock","purincash_supplier"].includes(workingPlan.delivery_mode) && (
                                  <section className="crz-purin-stock-simple">
                                    <header><div><strong>Modo de entrega</strong><small>{workingPlan.delivery_mode === "ghost_stock" ? "Estoque virtual / atendimento por ticket." : "Este plano não utiliza o estoque local de keys."}</small></div><span className="crz-purin-stock-pill is-manual">{workingPlan.delivery_mode}</span></header>
                                    <div className="crz-purin-stock-simple__controls">
                                      <button type="button" className="crz-purin-save-field" disabled={busy || stockBusy} onClick={() => void savePlan()}>{busy ? "Salvando..." : "Salvar plano"}</button>
                                    </div>
                                  </section>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {!productDraft.plans.length && (
                        <div className="crz-purin-fields__empty">
                          <strong>Nenhum plano criado ainda.</strong>
                          <span>Crie manualmente, gere as durações mais usadas ou importe estoque automático do provedor.</span>
                          <div>
                            <button type="button" onClick={() => setCreatingPlan(true)}>＋ Adicionar plano</button>
                            <button type="button" onClick={() => void createPresetPlans()}>⚡ Criar predefinidos</button>
                            <button type="button" onClick={() => setSupplierImportFor({ productId: productDraft.id, productName: productDraft.name })}>🌐 Importar do provedor</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}


              </div>
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
                ["active", "Online"],
                ["inactive", "Offline"],
                ["new", "Novos"],
                ["updating", "Atualizando"],
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
                        {product.icon_url || product.image_url ? <img src={product.icon_url || product.image_url || ""} alt="" /> : product.emoji || "◆"}
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

      </div>
    </main>
  );
}
