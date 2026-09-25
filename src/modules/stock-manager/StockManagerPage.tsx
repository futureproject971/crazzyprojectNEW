"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import type {
  StockManagerCatalog,
  StockManagerItem,
  StockItemsResponse,
} from "./types";

function statusOf(item: StockManagerItem) {
  if (item.used) return "used";
  if (item.disabled) return "disabled";
  if (item.reservation?.status === "reserved" && new Date(item.reservation.expires_at).getTime() > Date.now()) {
    return "reserved";
  }
  return "available";
}

function deliveryLabel(value: string) {
  const labels: Record<string, string> = {
    internal_stock: "Keys / estoque automático",
    purincash_supplier: "Fornecedor PurinCash",
    lzt_account: "Conta LZT",
    manual: "Manual",
    service: "Serviço",
  };
  return labels[value] || value;
}

export function StockManagerPage() {
  const [catalog, setCatalog] = useState<StockManagerCatalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<StockManagerItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadCatalog = async (preserve = true) => {
    setState("loading");
    try {
      const response = await fetch("/api/admin/stock", { cache: "no-store" });
      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.catalog) throw new Error("STOCK_MANAGER_UNAVAILABLE");

      const next = payload.catalog as StockManagerCatalog;
      setCatalog(next);

      const nextPlan =
        next.plans.find((plan) => plan.plan_id === (preserve ? selectedPlanId : null)) ||
        next.plans[0] ||
        null;
      setSelectedPlanId(nextPlan?.plan_id || null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const loadItems = async (planId: string | null) => {
    if (!planId) {
      setItems([]);
      setItemsTotal(0);
      return;
    }

    setItemsLoading(true);
    try {
      const response = await fetch(
        "/api/admin/stock?planId=" + encodeURIComponent(planId) + "&limit=200",
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.result) throw new Error("STOCK_ITEMS_UNAVAILABLE");

      const result = payload.result as StockItemsResponse;
      setItems(result.items || []);
      setItemsTotal(result.total || 0);
    } catch {
      setNotice("Não foi possível carregar os itens deste plano.");
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog(false);
  }, []);

  useEffect(() => {
    if (state === "ready") void loadItems(selectedPlanId);
  }, [selectedPlanId, state]);

  const filteredPlans = useMemo(() => {
    if (!catalog) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.plans;
    return catalog.plans.filter((plan) =>
      [plan.product_name, plan.plan_name, plan.plan_code, plan.game_name, plan.delivery_mode]
        .some((value) => String(value || "").toLowerCase().includes(normalized))
    );
  }, [catalog, query]);

  const selectedPlan = useMemo(
    () => catalog?.plans.find((plan) => plan.plan_id === selectedPlanId) || null,
    [catalog, selectedPlanId]
  );

  const totals = useMemo(() => {
    const plans = catalog?.plans || [];
    return plans.reduce(
      (acc, plan) => {
        acc.available += plan.available_stock;
        acc.reserved += plan.reserved_stock;
        acc.used += plan.used_stock;
        acc.disabled += plan.disabled_stock;
        return acc;
      },
      { available: 0, reserved: 0, used: 0, disabled: 0 }
    );
  }, [catalog]);


  const toggleDisabled = async (item: StockManagerItem) => {
    if (item.used || busy) return;

    let reason: string | null = null;
    if (!item.disabled) {
      reason = window.prompt("Motivo para desativar esta key? (opcional)")?.trim() || null;
    }

    setBusy(item.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: item.id,
          disabled: !item.disabled,
          reason,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error === "STOCK_ITEM_RESERVED"
            ? "Esta key está reservada para uma entrega e não pode ser alterada agora."
            : "Falha ao atualizar a key."
        );
      }

      setNotice(item.disabled ? "Key reativada." : "Key desativada.");
      await loadCatalog(true);
      await loadItems(selectedPlanId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao atualizar a key.");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading" && !catalog) {
    return (
      <main className="crz-stock-manager crz-stock-state">
        <span className="crz-spinner" />
        <strong>Carregando estoque...</strong>
      </main>
    );
  }

  if (state === "auth") {
    return (
      <main className="crz-stock-manager crz-stock-state">
        <NeonIcon name="shield" size={42} />
        <strong>Entre para continuar</strong>
        <a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Festoque">
          Entrar
        </a>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="crz-stock-manager crz-stock-state">
        <NeonIcon name="shield" size={42} />
        <strong>Acesso restrito ao administrador</strong>
      </main>
    );
  }

  if (state === "error" || !catalog) {
    return (
      <main className="crz-stock-manager crz-stock-state">
        <strong>Stock Manager indisponível</strong>
        <button type="button" onClick={() => void loadCatalog(false)}>Tentar novamente</button>
      </main>
    );
  }

  return (
    <main className="crz-stock-manager">
      <div className="crz-container crz-stock-container">
        <PageHeader
          eyebrow="ESTOQUE AVANÇADO"
          title="Auditoria de estoque"
          description="Use esta tela para conferir, localizar e desativar keys. Para adicionar estoque, abra o produto e o plano correspondente."
          actions={
            <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/produtos">
              Produtos
            </a>
          }
        />

        <section className="crz-stock-summary">
          <div><small>DISPONÍVEIS</small><strong>{totals.available}</strong><span>prontas para entrega</span></div>
          <div><small>RESERVADAS</small><strong>{totals.reserved}</strong><span>aguardando consumo</span></div>
          <div><small>UTILIZADAS</small><strong>{totals.used}</strong><span>já entregues</span></div>
          <div><small>DESATIVADAS</small><strong>{totals.disabled}</strong><span>temporariamente bloqueadas</span></div>
        </section>

        {notice && <div className="crz-stock-notice">{notice}</div>}

        <div className="crz-stock-layout">
          <aside className="crz-stock-plans">
            <label className="crz-stock-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto/plano..." />
            </label>

            <div className="crz-stock-plan-list">
              {filteredPlans.map((plan) => (
                <button
                  type="button"
                  key={plan.plan_id}
                  className={plan.plan_id === selectedPlanId ? "is-active" : ""}
                  onClick={() => setSelectedPlanId(plan.plan_id)}
                >
                  <span>
                    <strong>{plan.product_name}</strong>
                    <small>{plan.game_name} • {plan.plan_name}</small>
                    <em>{deliveryLabel(plan.delivery_mode)}</em>
                  </span>
                  <b>{plan.available_stock}</b>
                </button>
              ))}
            </div>
          </aside>

          <section className="crz-stock-workspace">
            {!selectedPlan ? (
              <div className="crz-stock-empty">Nenhum plano configurado.</div>
            ) : (
              <>
                <header className="crz-stock-plan-head">
                  <div>
                    <small>{selectedPlan.game_name}</small>
                    <h2>{selectedPlan.product_name} • {selectedPlan.plan_name}</h2>
                    <span>
                      {deliveryLabel(selectedPlan.delivery_mode)}
                      {selectedPlan.supplier_provider ? ` • fornecedor: ${selectedPlan.supplier_provider}` : ""}
                    </span>
                  </div>
                  <a
                    className="crz-button crz-button--primary crz-button--sm"
                    href="/admin/produtos"
                  >
                    + Adicionar estoque no produto
                  </a>
                </header>

                <div className="crz-stock-plan-metrics">
                  <div><span>Disponível</span><strong>{selectedPlan.available_stock}</strong></div>
                  <div><span>Reservado</span><strong>{selectedPlan.reserved_stock}</strong></div>
                  <div><span>Usado</span><strong>{selectedPlan.used_stock}</strong></div>
                  <div><span>Desativado</span><strong>{selectedPlan.disabled_stock}</strong></div>
                  <div><span>Total local</span><strong>{selectedPlan.local_stock}</strong></div>
                </div>

                <section className="crz-stock-items">
                  <header>
                    <div>
                      <small>KEYS DESTE PLANO</small>
                      <strong>{itemsTotal} item(ns)</strong>
                    </div>
                    <button type="button" disabled={itemsLoading} onClick={() => void loadItems(selectedPlan.plan_id)}>
                      ↻ Atualizar
                    </button>
                  </header>

                  {itemsLoading ? (
                    <div className="crz-stock-empty">Carregando itens...</div>
                  ) : items.length ? (
                    <div className="crz-stock-items-table">
                      <div className="crz-stock-items-row is-head">
                        <span>KEY</span><span>STATUS</span><span>ORIGEM</span><span>DATA</span><span>AÇÃO</span>
                      </div>
                      {items.map((item) => {
                        const status = statusOf(item);
                        return (
                          <div className="crz-stock-items-row" key={item.id}>
                            <code>{item.masked_content}</code>
                            <span><b className={"is-" + status}>{status.toUpperCase()}</b></span>
                            <span>{item.source}</span>
                            <time>{new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                            <span>
                              {!item.used ? (
                                <button
                                  type="button"
                                  disabled={busy === item.id || status === "reserved"}
                                  onClick={() => void toggleDisabled(item)}
                                >
                                  {item.disabled ? "Reativar" : "Desativar"}
                                </button>
                              ) : "Consumida"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="crz-stock-empty">
                      <NeonIcon name="cube" size={30} />
                      <strong>Nenhuma key cadastrada neste plano</strong>
                      <span>Adicione as keys pelo produto e plano correspondente.</span>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>

        <section className="crz-stock-history">
          <article>
            <header><small>LOTES RECENTES</small><strong>Importações</strong></header>
            <div>
              {catalog.recent_batches.length ? catalog.recent_batches.map((batch) => {
                const plan = catalog.plans.find((item) => item.plan_id === batch.product_plan_id);
                return (
                  <div key={batch.id}>
                    <span><strong>{plan?.product_name || "Produto"} • {plan?.plan_name || "Plano"}</strong><small>{batch.source}</small></span>
                    <span><b>{batch.accepted_count}</b> adicionadas</span>
                    <span><b>{batch.duplicate_count}</b> duplicadas</span>
                    <time>{new Date(batch.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                  </div>
                );
              }) : <div className="crz-stock-empty">Nenhum lote importado.</div>}
            </div>
          </article>

          <article>
            <header><small>HISTÓRICO</small><strong>Movimentações de estoque</strong></header>
            <div>
              {catalog.recent_events.length ? catalog.recent_events.map((event) => (
                <div key={event.id}>
                  <span><strong>{event.event_type.replaceAll("_", " ")}</strong><small>{event.stock_item_id ? event.stock_item_id.slice(0, 8) : "lote/sistema"}</small></span>
                  <time>{new Date(event.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                </div>
              )) : <div className="crz-stock-empty">Nenhum evento registrado.</div>}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
