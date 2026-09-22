"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { SaleDetail, SalesManagerPayload, SalesRow } from "./types";

const PAGE_SIZE = 60;

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(value) || 0) / 100);
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function shortId(value: string) {
  if (!value) return "—";
  return value.length > 15 ? value.slice(0, 8) + "…" + value.slice(-4) : value;
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    CREATING: "CRIANDO",
    ACTIVE: "AGUARDANDO",
    FULFILLING: "ENTREGANDO",
    COMPLETED: "PAGO",
    EXPIRED: "EXPIRADO",
    FAILED: "FALHOU",
    CANCELLED: "CANCELADO",
  };
  return labels[value] || value;
}

function fulfillmentLabel(value: string) {
  const labels: Record<string, string> = {
    waiting_payment: "Aguardando pagamento",
    processing: "Em processamento",
    delivered: "Entregue",
    attention: "Precisa atenção",
    missing: "Entrega ausente",
  };
  return labels[value] || value;
}

function toneForPayment(value: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (value === "COMPLETED") return "green";
  if (value === "ACTIVE" || value === "CREATING" || value === "FULFILLING") return "blue";
  if (value === "FAILED" || value === "CANCELLED") return "pink";
  if (value === "EXPIRED") return "gold";
  return "neutral";
}

function toneForFulfillment(value: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (value === "delivered") return "green";
  if (value === "processing" || value === "waiting_payment") return "blue";
  if (value === "attention" || value === "missing") return "pink";
  return "neutral";
}

function toneForDiscord(value: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (value === "granted") return "green";
  if (value === "pending" || value === "mixed") return "blue";
  if (value === "failed") return "pink";
  if (value === "revoked") return "gold";
  return "neutral";
}

export function SalesManagerPage() {
  const [result, setResult] = useState<SalesManagerPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SalesRow | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async (nextOffset = offset) => {
    setState("loading");
    setNotice("");

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);

      const response = await fetch("/api/admin/sales?" + params.toString(), {
        cache: "no-store",
      });

      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.result) {
        throw new Error("SALES_MANAGER_UNAVAILABLE");
      }

      setResult(payload.result as SalesManagerPayload);
      setOffset(nextOffset);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const loadDetail = async (sale: SalesRow) => {
    setSelected(sale);
    setDetail(null);
    setDetailLoading(true);

    try {
      const response = await fetch(
        "/api/admin/sales?paymentId=" + encodeURIComponent(sale.payment_id),
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.sale) throw new Error("SALE_DETAIL_UNAVAILABLE");
      setDetail(payload.sale as SaleDetail);
    } catch {
      setNotice("Não foi possível carregar os detalhes desta venda.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
  }, []);

  const rows = result?.sales || [];
  const hasPrevious = offset > 0;
  const hasNext = rows.length === PAGE_SIZE;

  const summary = result?.summary;
  const selectedFlags = useMemo(() => {
    if (!selected) return [];
    const flags: string[] = [];
    if (selected.payment_status === "COMPLETED" && selected.ticket_total === 0) {
      flags.push("Pagamento concluído sem ticket de entrega");
    }
    if (selected.ticket_attention > 0) {
      flags.push(selected.ticket_attention + " entrega(s) aguardando ação");
    }
    if (selected.discord_status === "failed") {
      flags.push("Falha na sincronização de cargo Discord");
    }
    if (selected.entitlement_total === 0 && selected.payment_status === "COMPLETED") {
      flags.push("Entitlement ainda não localizado");
    }
    return flags;
  }, [selected]);

  if (state === "loading" && !result) {
    return (
      <main className="crz-sales-manager crz-sales-state">
        <span className="crz-spinner" />
        <strong>Carregando vendas...</strong>
      </main>
    );
  }

  if (state === "auth") {
    return (
      <main className="crz-sales-manager crz-sales-state">
        <NeonIcon name="shield" size={42} />
        <strong>Entre para continuar</strong>
        <a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Fvendas">
          Entrar
        </a>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="crz-sales-manager crz-sales-state">
        <NeonIcon name="shield" size={42} />
        <strong>Acesso restrito ao administrador</strong>
      </main>
    );
  }

  if (state === "error" || !result || !summary) {
    return (
      <main className="crz-sales-manager crz-sales-state">
        <strong>Sales Manager indisponível</strong>
        <button type="button" onClick={() => void load(0)}>Tentar novamente</button>
      </main>
    );
  }

  return (
    <main className="crz-sales-manager">
      <div className="crz-container crz-sales-container">
        <PageHeader
          eyebrow="M28 • CRAZZY SALES"
          title="Venda inteira em uma única linha"
          description="Pagamento, entrega, entitlement, tutorial, Discord e histórico comercial conectados sem expor keys ou credenciais."
          actions={
            <div className="crz-sales-header-actions">
              <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/estoque">Estoque</a>
              <a className="crz-button crz-button--secondary crz-button--sm" href="/admin">Control Center</a>
            </div>
          }
        />

        <section className="crz-sales-summary">
          <article>
            <small>VENDAS</small>
            <strong>{summary.total_sales}</strong>
            <span>no filtro atual</span>
          </article>
          <article>
            <small>PAGAS</small>
            <strong>{summary.completed}</strong>
            <span>{moneyFromCents(summary.gross_completed_cents)}</span>
          </article>
          <article>
            <small>PENDENTES</small>
            <strong>{summary.pending}</strong>
            <span>criando, aguardando ou entregando</span>
          </article>
          <article className={summary.needs_attention > 0 ? "is-alert" : ""}>
            <small>ATENÇÃO</small>
            <strong>{summary.needs_attention}</strong>
            <span>fluxos incompletos</span>
          </article>
          <article>
            <small>FALHAS</small>
            <strong>{summary.failed}</strong>
            <span>expiradas, falhas ou canceladas</span>
          </article>
        </section>

        {notice && <div className="crz-sales-notice">{notice}</div>}

        <section className="crz-sales-toolbar">
          <label className="crz-sales-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load(0);
              }}
              placeholder="Pedido, charge, cliente, user ID..."
            />
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os pagamentos</option>
            <option value="COMPLETED">Pagos</option>
            <option value="ACTIVE">Aguardando</option>
            <option value="FULFILLING">Entregando</option>
            <option value="CREATING">Criando</option>
            <option value="FAILED">Falhou</option>
            <option value="EXPIRED">Expirado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>

          <button
            type="button"
            className="crz-button crz-button--primary crz-button--sm"
            onClick={() => void load(0)}
          >
            Filtrar
          </button>
        </section>

        <div className="crz-sales-layout">
          <section className="crz-sales-list">
            <header className="crz-sales-row crz-sales-row--head">
              <span>Venda</span>
              <span>Cliente</span>
              <span>Pagamento</span>
              <span>Fulfillment</span>
              <span>Direitos</span>
              <span>Discord</span>
              <span>Total</span>
            </header>

            {rows.length === 0 ? (
              <div className="crz-sales-empty">
                <NeonIcon name="shopping-bag" size={34} />
                <strong>Nenhuma venda encontrada</strong>
                <span>Altere o filtro ou aguarde as primeiras compras.</span>
              </div>
            ) : (
              rows.map((sale) => (
                <button
                  type="button"
                  key={sale.payment_id}
                  className={
                    "crz-sales-row crz-sales-row--sale" +
                    (selected?.payment_id === sale.payment_id ? " is-selected" : "")
                  }
                  onClick={() => void loadDetail(sale)}
                >
                  <span className="crz-sales-order">
                    <strong>{shortId(sale.payment_id)}</strong>
                    <small>{dateTime(sale.created_at)}</small>
                  </span>
                  <span className="crz-sales-customer">
                    <strong>{sale.username || "Cliente"}</strong>
                    <small>{shortId(sale.user_id)}</small>
                  </span>
                  <span>
                    <Badge tone={toneForPayment(sale.payment_status)}>
                      {paymentLabel(sale.payment_status)}
                    </Badge>
                  </span>
                  <span>
                    <Badge tone={toneForFulfillment(sale.fulfillment_status)}>
                      {fulfillmentLabel(sale.fulfillment_status)}
                    </Badge>
                    <small>{sale.ticket_delivered}/{sale.ticket_total} entrega(s)</small>
                  </span>
                  <span className="crz-sales-mini-count">
                    <strong>{sale.entitlement_active}/{sale.entitlement_total}</strong>
                    <small>{sale.tutorial_unlock_count} tutorial(is)</small>
                  </span>
                  <span>
                    <Badge tone={toneForDiscord(sale.discord_status)}>
                      {sale.discord_status === "none" ? "SEM CARGO" : sale.discord_status.toUpperCase()}
                    </Badge>
                  </span>
                  <span className="crz-sales-total">
                    <strong>{moneyFromCents(sale.amount_cents)}</strong>
                    <small>{sale.payment_method?.toUpperCase() || "—"}</small>
                  </span>
                </button>
              ))
            )}

            <footer className="crz-sales-pagination">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Anterior
              </button>
              <span>{offset + 1}–{offset + rows.length}</span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => void load(offset + PAGE_SIZE)}
              >
                Próxima →
              </button>
            </footer>
          </section>

          <aside className="crz-sales-detail">
            {!selected ? (
              <div className="crz-sales-detail-empty">
                <NeonIcon name="shopping-bag" size={38} />
                <strong>Selecione uma venda</strong>
                <span>Veja toda a trilha comercial sem abrir cinco telas.</span>
              </div>
            ) : detailLoading ? (
              <div className="crz-sales-detail-empty">
                <span className="crz-spinner" />
                <strong>Carregando venda...</strong>
              </div>
            ) : detail ? (
              <>
                <header className="crz-sales-detail-head">
                  <div>
                    <small>VENDA</small>
                    <h2>{shortId(detail.payment.id)}</h2>
                    <span>{detail.payment.username}</span>
                  </div>
                  <Badge tone={toneForPayment(detail.payment.status)}>
                    {paymentLabel(detail.payment.status)}
                  </Badge>
                </header>

                {selectedFlags.length > 0 && (
                  <section className="crz-sales-alerts">
                    {selectedFlags.map((flag) => <p key={flag}>⚠ {flag}</p>)}
                  </section>
                )}

                <section className="crz-sales-detail-grid">
                  <div><span>Total</span><strong>{moneyFromCents(detail.payment.amount_cents)}</strong></div>
                  <div><span>Desconto</span><strong>{money(detail.payment.discount_amount)}</strong></div>
                  <div><span>Método</span><strong>{detail.payment.payment_method?.toUpperCase() || "—"}</strong></div>
                  <div><span>Pago em</span><strong>{dateTime(detail.payment.paid_at)}</strong></div>
                  <div><span>Charge</span><strong>{detail.payment.charge_reference || "—"}</strong></div>
                  <div><span>Atualizado</span><strong>{dateTime(detail.payment.updated_at)}</strong></div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>CARRINHO</small><strong>{detail.cart.length} item(ns)</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.cart.map((item, index) => (
                      <article key={(item.product_id || "item") + index}>
                        <span>
                          <strong>{item.product_name || "Produto"}</strong>
                          <small>{item.plan_name || "Plano"} • {item.quantity}x</small>
                        </span>
                        <b>{money(item.unit_price)}</b>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>FULFILLMENT</small><strong>{detail.tickets.length} ticket(s)</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.tickets.length === 0 ? <em>Nenhum ticket de entrega.</em> : detail.tickets.map((ticket) => (
                      <article key={ticket.id}>
                        <span>
                          <strong>{ticket.product_name} • {ticket.plan_name}</strong>
                          <small>{ticket.delivery_mode} • {ticket.status_label}</small>
                        </span>
                        <Badge tone={ticket.status === "delivered" ? "green" : "gold"}>
                          {ticket.status.toUpperCase()}
                        </Badge>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>ENTITLEMENTS</small><strong>{detail.entitlements.length}</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.entitlements.length === 0 ? <em>Nenhum entitlement.</em> : detail.entitlements.map((item) => (
                      <article key={item.id}>
                        <span>
                          <strong>{item.product_name} • {item.plan_name || "Plano"}</strong>
                          <small>Expira: {dateTime(item.expires_at)}</small>
                        </span>
                        <Badge tone={item.status === "active" ? "green" : "neutral"}>{item.status.toUpperCase()}</Badge>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>ENTREGAS NA BIBLIOTECA</small><strong>{detail.deliveries.length}</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.deliveries.length === 0 ? <em>Nenhuma entrega registrada.</em> : detail.deliveries.map((delivery) => (
                      <article key={delivery.id}>
                        <span>
                          <strong>{delivery.delivery_type.toUpperCase()}</strong>
                          <small>{dateTime(delivery.delivered_at)} • revelado {delivery.reveal_count}x</small>
                        </span>
                        <Badge tone={delivery.status === "available" ? "green" : "neutral"}>{delivery.status.toUpperCase()}</Badge>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>DISCORD</small><strong>{detail.discord_roles.length} cargo(s)</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.discord_roles.length === 0 ? <em>Nenhum cargo solicitado.</em> : detail.discord_roles.map((role) => (
                      <article key={role.id}>
                        <span>
                          <strong>{role.role_name || "Cargo Discord"}</strong>
                          <small>{role.last_error_code ? "Erro: " + role.last_error_code : "Atualizado " + dateTime(role.updated_at)}</small>
                        </span>
                        <Badge tone={toneForDiscord(role.status)}>{role.status.toUpperCase()}</Badge>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="crz-sales-detail-section">
                  <header><small>TUTORIAIS LIBERADOS</small><strong>{detail.tutorials.length}</strong></header>
                  <div className="crz-sales-detail-list">
                    {detail.tutorials.length === 0 ? <em>Nenhum tutorial liberado.</em> : detail.tutorials.map((tutorial) => (
                      <article key={tutorial.id}>
                        <span>
                          <strong>{tutorial.title}</strong>
                          <small>/{tutorial.slug}</small>
                        </span>
                        <Badge tone={tutorial.active ? "blue" : "neutral"}>{tutorial.active ? "ATIVO" : "INATIVO"}</Badge>
                      </article>
                    ))}
                  </div>
                </section>

                <p className="crz-sales-secret-note">
                  🔐 Conteúdo entregue, keys e credenciais não são exibidos no Sales Manager.
                </p>
              </>
            ) : (
              <div className="crz-sales-detail-empty">
                <strong>Detalhes indisponíveis</strong>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
