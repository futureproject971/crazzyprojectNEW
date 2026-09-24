"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type {
  StockManagerCatalog,
  StockManagerItem,
  StockItemsResponse,
  StockPlanSummary,
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
    internal_stock: "Estoque interno",
    ghost_stock: "Estoque Fantasma",
    purincash_supplier: "PurinCash supplier",
    lzt_account: "Conta LZT",
    manual: "Manual",
    service: "Serviço",
  };
  return labels[value] || value;
}

const sourcePresets = [
  ["manual", "Manual"],
  ["reposicao", "Reposição"],
  ["supplier", "Supplier"],
  ["migracao", "Migração"],
  ["teste", "Teste"],
] as const;

const stockFilters = [
  ["all", "Todos"],
  ["available", "Disponíveis"],
  ["reserved", "Reservadas"],
  ["used", "Utilizadas"],
  ["disabled", "Desativadas"],
] as const;

export function StockManagerPage() {
  const searchParams = useSearchParams();
  const requestedPlanId = String(searchParams.get("planId") || "").trim();
  const requestedRestock = searchParams.get("repor") === "1";

  const [catalog, setCatalog] = useState<StockManagerCatalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<StockManagerItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemFilter, setItemFilter] = useState<(typeof stockFilters)[number][0]>("all");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState("manual");
  const [importNote, setImportNote] = useState("");
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
        next.plans.find((plan) => plan.plan_id === requestedPlanId) ||
        next.plans.find((plan) => plan.plan_id === (preserve ? selectedPlanId : null)) ||
        next.plans[0] ||
        null;
      setSelectedPlanId(nextPlan?.plan_id || null);
      if (requestedRestock && nextPlan?.plan_id) {
        setShowImport(true);
        setImportSource("reposicao");
      }
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

  const importItems = useMemo(
    () =>
      importText
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    [importText]
  );

  const importBatch = async () => {
    if (!selectedPlan || busy || !importItems.length) return;
    setBusy("import");
    setNotice("");

    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productPlanId: selectedPlan.plan_id,
          items: importItems,
          source: importSource,
          note: importNote,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.batch) throw new Error("Falha ao importar o lote.");

      const batch = payload.batch as {
        accepted_count: number;
        duplicate_count: number;
        submitted_count: number;
      };

      setNotice(
        `Lote processado: ${batch.accepted_count} adicionada(s), ${batch.duplicate_count} duplicada(s) ignorada(s).`
      );
      setImportText("");
      setImportNote("");
      setShowImport(false);
      await loadCatalog(true);
      await loadItems(selectedPlan.plan_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao importar lote.");
    } finally {
      setBusy(null);
    }
  };

  const toggleDisabled = async (item: StockManagerItem) => {
    if (item.used || busy) return;

    const reason = item.disabled ? null : "Desativada pelo administrador";

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
          eyebrow="M27 • CRAZZY STOCK"
          title="Estoque de keys por variação"
          description="Cada plano/variação tem o próprio stock. Selecione a variação, reponha keys e acompanhe disponíveis, reservadas, usadas e desativadas."
          actions={
            <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/produtos">
              Product Manager
            </a>
          }
        />

        <section className="crz-stock-summary">
          <div><small>DISPONÍVEIS</small><strong>{totals.available}</strong><span>prontas para entrega</span></div>
          <div><small>RESERVADAS</small><strong>{totals.reserved}</strong><span>aguardando consumo</span></div>
          <div><small>UTILIZADAS</small><strong>{totals.used}</strong><span>nunca retornam ao pool</span></div>
          <div><small>DESATIVADAS</small><strong>{totals.disabled}</strong><span>fora da entrega automática</span></div>
        </section>

        {notice && <div className="crz-stock-notice">{notice}</div>}

        <div className="crz-stock-layout">
          <aside className="crz-stock-plans">
            <label className="crz-stock-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto/plano..." />
            </label>

            <div className="crz-stock-plan-list__label">
              <span>VARIAÇÕES / PLANOS</span>
              <small>Cada variação tem stock separado</small>
            </div>

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
                  <button
                    type="button"
                    className="crz-button crz-button--primary crz-button--sm crz-stock-restock-button"
                    onClick={() => {
                      setImportSource("reposicao");
                      setShowImport((value) => !value);
                    }}
                  >
                    {showImport ? "FECHAR REPOSIÇÃO" : "+ REPOR STOCK DESTA VARIAÇÃO"}
                  </button>
                </header>

                <div className="crz-stock-plan-metrics">
                  <div><span>Disponível</span><strong>{selectedPlan.available_stock}</strong></div>
                  <div><span>Reservado</span><strong>{selectedPlan.reserved_stock}</strong></div>
                  <div><span>Usado</span><strong>{selectedPlan.used_stock}</strong></div>
                  <div><span>Desativado</span><strong>{selectedPlan.disabled_stock}</strong></div>
                  <div><span>Total local</span><strong>{selectedPlan.local_stock}</strong></div>
                </div>

                {showImport && (
                  <section className="crz-stock-import">
                    <header>
                      <div>
                        <small>REPOSIÇÃO DE STOCK • {selectedPlan.plan_name}</small>
                        <strong>Cole as keys desta variação, uma por linha</strong>
                      </div>
                      <Badge tone={importItems.length > 5000 ? "pink" : "blue"}>
                        {importItems.length} linha(s)
                      </Badge>
                    </header>
                    <textarea
                      rows={10}
                      value={importText}
                      onChange={(event) => setImportText(event.target.value)}
                      placeholder={"KEY-0001\nKEY-0002\nKEY-0003"}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <div className="crz-stock-import-fields crz-stock-import-fields--guided">
                      <div className="crz-stock-import-source">
                        <span>Origem do lote</span>
                        <div>
                          {sourcePresets.map(([value,label]) => (
                            <button
                              type="button"
                              key={value}
                              className={importSource === value ? "is-selected" : ""}
                              onClick={() => setImportSource(value)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label>
                        <span>Observação do lote</span>
                        <input value={importNote} onChange={(event) => setImportNote(event.target.value.slice(0, 500))} placeholder="Opcional. Ex.: reposição setembro" />
                      </label>
                    </div>
                    <div className="crz-stock-import-foot">
                      <span>Duplicatas são bloqueadas por hash SHA-256 e não entram novamente no estoque.</span>
                      <button
                        type="button"
                        className="crz-button crz-button--primary crz-button--sm"
                        disabled={busy === "import" || !importItems.length || importItems.length > 5000}
                        onClick={() => void importBatch()}
                      >
                        {busy === "import" ? "Importando..." : "Processar lote"}
                      </button>
                    </div>
                  </section>
                )}

                <section className="crz-stock-items">
                  <header>
                    <div>
                      <small>ITENS LOCAIS</small>
                      <strong>{itemsTotal} item(ns) • {visibleItems.length} visível(is)</strong>
                    </div>
                    <button type="button" disabled={itemsLoading} onClick={() => void loadItems(selectedPlan.plan_id)}>
                      ↻ Atualizar
                    </button>
                  </header>

                  <div className="crz-stock-item-tools">
                    <label>
                      <span>⌕</span>
                      <input
                        value={itemQuery}
                        onChange={(event) => setItemQuery(event.target.value)}
                        placeholder="Buscar key mascarada, origem..."
                      />
                    </label>
                    <div>
                      {stockFilters.map(([value,label]) => (
                        <button
                          type="button"
                          key={value}
                          className={itemFilter === value ? "is-selected" : ""}
                          onClick={() => setItemFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {itemsLoading ? (
                    <div className="crz-stock-empty">Carregando itens...</div>
                  ) : visibleItems.length ? (
                    <div className="crz-stock-items-table">
                      <div className="crz-stock-items-row is-head">
                        <span>KEY</span><span>STATUS</span><span>ORIGEM</span><span>DATA</span><span>AÇÃO</span>
                      </div>
                      {visibleItems.map((item) => {
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
                      <strong>{items.length ? "Nenhum item nesse filtro" : "Sem estoque local neste plano"}</strong>
                      <span>{items.length ? "Troque o filtro ou limpe a busca." : "Importe um lote ou configure fornecedor externo no Product Manager."}</span>
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
            <header><small>AUDITORIA</small><strong>Eventos de estoque</strong></header>
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
