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

function statusLabel(value: ReturnType<typeof statusOf>) {
  const labels = {
    available: "DISPONÍVEL",
    reserved: "RESERVADA",
    used: "UTILIZADA",
    disabled: "DESATIVADA",
  };
  return labels[value];
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
  const [reasonItem, setReasonItem] = useState<StockManagerItem | null>(null);
  const [disableReason, setDisableReason] = useState("");

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
      setNotice("Não foi possível carregar as keys deste plano.");
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
      [plan.product_name, plan.plan_name, plan.game_name]
        .some((value) => String(value || "").toLowerCase().includes(normalized))
    );
  }, [catalog, query]);

  const selectedPlan = useMemo(
    () => catalog?.plans.find((plan) => plan.plan_id === selectedPlanId) || null,
    [catalog, selectedPlanId]
  );

  const totalAvailable = useMemo(
    () => (catalog?.plans || []).reduce((sum, plan) => sum + Number(plan.available_stock || 0), 0),
    [catalog]
  );

  const totalKeys = useMemo(
    () => (catalog?.plans || []).reduce((sum, plan) => sum + Number(plan.local_stock || 0), 0),
    [catalog]
  );

  const toggleDisabled = async (item: StockManagerItem, reason: string | null = null) => {
    if (item.used || busy) return;
    setBusy(item.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockItemId: item.id, disabled: !item.disabled, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error === "STOCK_ITEM_RESERVED" ? "Esta key está reservada e não pode ser alterada agora." : "Falha ao atualizar a key.");
      setNotice(item.disabled ? "Key reativada." : "Key desativada.");
      setReasonItem(null); setDisableReason("");
      await loadCatalog(true); await loadItems(selectedPlanId);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao atualizar a key."); }
    finally { setBusy(null); }
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
        <strong>Estoque indisponível</strong>
        <button type="button" onClick={() => void loadCatalog(false)}>Tentar novamente</button>
      </main>
    );
  }

  return (
    <main className="crz-stock-manager">
      <div className="crz-container crz-stock-container">
        <PageHeader
          eyebrow="ESTOQUE"
          title="Keys por plano"
          description="Aqui você só confere e corrige keys. Para criar produto, plano ou adicionar novas keys, use Produtos."
          actions={
            <a className="crz-button crz-button--primary crz-button--sm" href="/admin/produtos">
              Gerenciar produtos
            </a>
          }
        />

        <section className="crz-stock-summary crz-stock-summary--simple">
          <div>
            <small>DISPONÍVEIS</small>
            <strong>{totalAvailable}</strong>
            <span>prontas para entrega</span>
          </div>
          <div>
            <small>TOTAL DE KEYS</small>
            <strong>{totalKeys}</strong>
            <span>somando todos os planos</span>
          </div>
        </section>

        {notice && <div className="crz-stock-notice">{notice}</div>}

        <div className="crz-stock-layout">
          <aside className="crz-stock-plans">
            <label className="crz-stock-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produto ou plano..."
              />
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
                    <small>{plan.plan_name}</small>
                  </span>
                  <b>{plan.available_stock}</b>
                </button>
              ))}
            </div>
          </aside>

          <section className="crz-stock-workspace">
            {!selectedPlan ? (
              <div className="crz-stock-empty">Nenhum plano encontrado.</div>
            ) : (
              <>
                <header className="crz-stock-plan-head">
                  <div>
                    <small>{selectedPlan.game_name}</small>
                    <h2>{selectedPlan.product_name}</h2>
                    <span>{selectedPlan.plan_name}</span>
                  </div>
                  <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/produtos">
                    Editar produto
                  </a>
                </header>

                <div className="crz-stock-plan-metrics crz-stock-plan-metrics--simple">
                  <div><span>Disponível</span><strong>{selectedPlan.available_stock}</strong></div>
                  <div><span>Reservado</span><strong>{selectedPlan.reserved_stock}</strong></div>
                  <div><span>Utilizado</span><strong>{selectedPlan.used_stock}</strong></div>
                </div>

                <section className="crz-stock-items">
                  <header>
                    <div>
                      <small>KEYS</small>
                      <strong>{itemsTotal} item(ns)</strong>
                    </div>
                    <button
                      type="button"
                      disabled={itemsLoading}
                      onClick={() => void loadItems(selectedPlan.plan_id)}
                    >
                      ↻ Atualizar
                    </button>
                  </header>

                  {itemsLoading ? (
                    <div className="crz-stock-empty">Carregando keys...</div>
                  ) : items.length ? (
                    <div className="crz-stock-items-table">
                      <div className="crz-stock-items-row is-head">
                        <span>KEY</span>
                        <span>STATUS</span>
                        <span>DATA</span>
                        <span>AÇÃO</span>
                      </div>

                      {items.map((item) => {
                        const status = statusOf(item);
                        return (
                          <div className="crz-stock-items-row" key={item.id}>
                            <code>{item.masked_content}</code>
                            <span><b className={"is-" + status}>{statusLabel(status)}</b></span>
                            <time>
                              {new Date(item.created_at).toLocaleString("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </time>
                            <span>
                              {!item.used ? (
                                <button
                                  type="button"
                                  disabled={busy === item.id || status === "reserved"}
                                  onClick={() => item.disabled ? void toggleDisabled(item) : (setReasonItem(item), setDisableReason(""))}
                                >
                                  {item.disabled ? "Reativar" : "Desativar"}
                                </button>
                              ) : (
                                "Consumida"
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="crz-stock-empty">
                      <NeonIcon name="cube" size={30} />
                      <strong>Nenhuma key neste plano</strong>
                      <span>Adicione novas keys em Produtos → Planos & Estoque → Adicionar estoque.</span>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
      {reasonItem && (
        <div className="crz-confirm-backdrop" role="presentation" onMouseDown={() => setReasonItem(null)}>
          <section className="crz-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="stock-confirm-title" onMouseDown={event => event.stopPropagation()}>
            <h2 id="stock-confirm-title">Desativar esta key?</h2>
            <p>Ela deixa de ser entregue até você reativá-la.</p>
            <label><span>Motivo opcional</span><input autoFocus value={disableReason} onChange={event => setDisableReason(event.target.value)} placeholder="Ex.: key em revisão" /></label>
            <div><button type="button" onClick={() => setReasonItem(null)}>Cancelar</button><button type="button" onClick={() => void toggleDisabled(reasonItem, disableReason.trim() || null)}>Desativar key</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
