"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";
import { adminConfirm, adminPrompt } from "@/core/ui/adminDialog";
import type {
  PaymentManagerDetail,
  PaymentManagerRow,
  PaymentsManagerPayload,
} from "./types";

const PAGE_SIZE = 60;

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(value) || 0) / 100);
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

function short(value: string | null | undefined, size = 10) {
  const text = String(value || "");
  if (!text) return "—";
  return text.length > size + 5
    ? text.slice(0, size) + "…" + text.slice(-4)
    : text;
}

function paymentTone(status: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (status === "COMPLETED") return "green";
  if (["CREATING", "ACTIVE", "FULFILLING"].includes(status)) return "blue";
  if (["FAILED", "CANCELLED"].includes(status)) return "pink";
  if (status === "EXPIRED") return "gold";
  return "neutral";
}

function eventTone(severity: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (severity === "error" || severity === "critical") return "pink";
  if (severity === "warn") return "gold";
  if (severity === "info") return "blue";
  return "neutral";
}

export function PaymentsManagerPage() {
  const [result, setResult] = useState<PaymentsManagerPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PaymentManagerRow | null>(null);
  const [detail, setDetail] = useState<PaymentManagerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextOffset = 0) => {
    if (!result) setState("loading");

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (method) params.set("method", method);

      const response = await fetch("/api/admin/payments?" + params.toString(), {
        cache: "no-store",
      });

      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.result) throw new Error("LOAD_FAILED");

      setResult(payload.result as PaymentsManagerPayload);
      setOffset(nextOffset);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [method, query, result, status]);

  const loadDetail = useCallback(async (payment: PaymentManagerRow) => {
    setSelected(payment);
    setDetail(null);
    setDetailLoading(true);

    try {
      const response = await fetch(
        "/api/admin/payments?paymentId=" + encodeURIComponent(payment.id),
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.payment) throw new Error("DETAIL_FAILED");
      setDetail(payload.payment as PaymentManagerDetail);
    } catch {
      setNotice("Não foi possível carregar os detalhes do pagamento.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, []);

  const refreshAll = async () => {
    await load(offset);
    if (selected) await loadDetail(selected);
  };

  const toggleMethod = async (methodName: string, enabled: boolean) => {
    setBusy("method:" + methodName);
    setNotice("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_method",
          method: methodName,
          enabled,
        }),
      });
      if (!response.ok) throw new Error("METHOD_FAILED");
      setNotice((enabled ? "Ativado: " : "Desativado: ") + methodName.toUpperCase());
      await load(offset);
    } catch {
      setNotice("Não foi possível alterar o método de pagamento.");
    } finally {
      setBusy(null);
    }
  };

  const reconcile = async () => {
    if (!selected || busy) return;
    if (!await adminConfirm("Reconciliar pagamento","Consultar a PurinCash agora e reconciliar este pagamento?","Reconciliar")) return;

    setBusy("reconcile");
    setNotice("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reconcile",
          paymentId: selected.id,
          reason: "Reconciliação manual no Payments Manager",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "RECONCILE_FAILED");

      setNotice("Reconciliação concluída com o gateway.");
      await refreshAll();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? "Reconciliação: " + error.message
          : "Falha na reconciliação."
      );
    } finally {
      setBusy(null);
    }
  };

  const registerRefund = async () => {
    if (!selected || !detail || busy) return;
    const raw = await adminPrompt("Reembolso",{label:"Valor do reembolso em R$",defaultValue:(detail.payment.amount_cents / 100).toFixed(2).replace(".", ","),inputMode:"decimal"});
    if (!raw) return;

    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Valor de reembolso inválido.");
      return;
    }

    const reason = await adminPrompt("Reembolso",{label:"Motivo do reembolso",required:true}) || "";
    setBusy("refund");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_refund_case",
          paymentId: selected.id,
          amountCents: Math.round(amount * 100),
          reason,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "REFUND_CASE_FAILED");

      setNotice("Caso de reembolso registrado. Nenhum dinheiro foi movimentado no gateway.");
      await loadDetail(selected);
    } catch {
      setNotice("Não foi possível registrar o caso de reembolso.");
    } finally {
      setBusy(null);
    }
  };

  const registerDispute = async () => {
    if (!selected || busy) return;
    const reason = await adminPrompt("Disputa",{label:"Motivo ou descrição",required:true});
    if (!reason?.trim()) return;

    setBusy("dispute");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_dispute",
          paymentId: selected.id,
          amountCents: selected.amount_cents,
          reason,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "DISPUTE_FAILED");

      setNotice("Disputa registrada para acompanhamento.");
      await loadDetail(selected);
    } catch {
      setNotice("Não foi possível registrar a disputa.");
    } finally {
      setBusy(null);
    }
  };

  const addEvidence = async (disputeId: string) => {
    if (!selected || busy) return;
    const note = await adminPrompt("Disputa",{label:"Evidência ou observação"});
    if (!note?.trim()) return;

    setBusy("evidence:" + disputeId);
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_evidence",
          paymentId: selected.id,
          disputeId,
          note,
        }),
      });
      if (!response.ok) throw new Error("EVIDENCE_FAILED");
      setNotice("Evidência adicionada.");
      await loadDetail(selected);
    } catch {
      setNotice("Não foi possível adicionar a evidência.");
    } finally {
      setBusy(null);
    }
  };

  const summary = result?.summary;
  const methods = result?.methods || [];
  const rows = result?.payments || [];

  const attentionRows = useMemo(
    () => rows.filter((item) => item.attention).length,
    [rows]
  );

  if (state === "loading" && !result) {
    return <main className="crz-payments-state"><span className="crz-spinner" /><strong>Carregando pagamentos...</strong></main>;
  }

  if (state === "auth") {
    return <main className="crz-payments-state"><strong>Entre para continuar.</strong><a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Fpagamentos">Entrar</a></main>;
  }

  if (state === "forbidden") {
    return <main className="crz-payments-state"><strong>Acesso de administrador necessário.</strong></main>;
  }

  if (state === "error" || !result || !summary) {
    return <main className="crz-payments-state"><strong>Payments Manager indisponível.</strong><button type="button" onClick={() => void load(0)}>Tentar novamente</button></main>;
  }

  return (
    <main className="crz-payments-manager">
      <div className="crz-container crz-payments-container">
        <PageHeader
          eyebrow="M29 • CRAZZY PAYMENTS"
          title="Pagamentos sob microscópio"
          description="PurinCash, PIX, cartão, Litecoin, idempotência, eventos, divergências, reconciliação, reembolsos e disputas sem expor segredos do checkout."
          actions={
            <div className="crz-payments-header-actions">
              <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/vendas">Vendas</a>
              <button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void refreshAll()}>↻ Atualizar</button>
            </div>
          }
        />

        <section className="crz-payments-methods">
          {methods.map((item) => (
            <article key={item.method}>
              <div>
                <small>{item.method === "crypto" ? "LTC" : item.method.toUpperCase()}</small>
                <strong>{item.label}</strong>
                <span>Atualizado {dateTime(item.updated_at)}</span>
              </div>
              <button
                type="button"
                className={item.enabled ? "is-on" : "is-off"}
                disabled={busy === "method:" + item.method}
                onClick={() => void toggleMethod(item.method, !item.enabled)}
              >
                <i /> {item.enabled ? "ATIVO" : "DESATIVADO"}
              </button>
            </article>
          ))}
        </section>

        <section className="crz-payments-summary">
          <article><small>TRANSAÇÕES</small><strong>{summary.total}</strong><span>filtro atual</span></article>
          <article><small>APROVADAS</small><strong>{summary.completed}</strong><span>{moneyFromCents(summary.gross_completed_cents)}</span></article>
          <article><small>EM ANDAMENTO</small><strong>{summary.active}</strong><span>criando, ativa ou fulfillment</span></article>
          <article className={summary.needs_reconcile ? "is-alert" : ""}><small>RECONCILIAR</small><strong>{summary.needs_reconcile}</strong><span>{attentionRows} visível(is) nesta página</span></article>
          <article><small>DISPUTAS</small><strong>{summary.open_disputes}</strong><span>{summary.refund_cases} caso(s) de refund</span></article>
        </section>

        {notice && <div className="crz-payments-notice">{notice}</div>}

        <section className="crz-payments-toolbar">
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void load(0); }}
              placeholder="Payment ID, charge, cliente, idempotency..."
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os status</option>
            <option value="COMPLETED">Concluído</option>
            <option value="ACTIVE">Ativo</option>
            <option value="FULFILLING">Fulfillment</option>
            <option value="CREATING">Criando</option>
            <option value="EXPIRED">Expirado</option>
            <option value="FAILED">Falhou</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Todos os métodos</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="crypto">Litecoin</option>
          </select>
          <button className="crz-button crz-button--primary crz-button--sm" type="button" onClick={() => void load(0)}>Filtrar</button>
        </section>

        <div className="crz-payments-layout">
          <section className="crz-payments-list">
            <header className="crz-payments-row crz-payments-row--head">
              <span>Pagamento</span><span>Cliente</span><span>Método</span><span>Status</span><span>Gateway</span><span>Eventos</span><span>Total</span>
            </header>

            {rows.map((payment) => (
              <button
                type="button"
                key={payment.id}
                className={"crz-payments-row crz-payments-row--item" + (selected?.id === payment.id ? " is-selected" : "") + (payment.attention ? " is-attention" : "")}
                onClick={() => void loadDetail(payment)}
              >
                <span><strong>{short(payment.id)}</strong><small>{dateTime(payment.created_at)}</small></span>
                <span><strong>{payment.username}</strong><small>{short(payment.user_id)}</small></span>
                <span><Badge tone="blue">{(payment.payment_method || "—").toUpperCase()}</Badge></span>
                <span><Badge tone={paymentTone(payment.status)}>{payment.status}</Badge><small>{payment.reconcile_status || ""}</small></span>
                <span><strong>{payment.charge_reference || "—"}</strong><small>{payment.idempotency_reference || "sem idempotency"}</small></span>
                <span><strong>{payment.event_count}</strong><small>{payment.last_event?.event_type || "sem eventos"}</small></span>
                <span className="crz-payments-total"><strong>{moneyFromCents(payment.amount_cents)}</strong><small>{payment.attention ? "⚠ revisar" : "ok"}</small></span>
              </button>
            ))}

            {!rows.length && <div className="crz-payments-empty">Nenhum pagamento encontrado.</div>}

            <footer className="crz-payments-pagination">
              <button type="button" disabled={offset <= 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>← Anterior</button>
              <span>{rows.length ? offset + 1 : 0}–{offset + rows.length}</span>
              <button type="button" disabled={rows.length < PAGE_SIZE} onClick={() => void load(offset + PAGE_SIZE)}>Próxima →</button>
            </footer>
          </section>

          <aside className="crz-payments-detail">
            {!selected ? (
              <div className="crz-payments-detail-empty"><strong>Selecione um pagamento</strong><span>Veja a trilha completa sem revelar dados sensíveis.</span></div>
            ) : detailLoading ? (
              <div className="crz-payments-detail-empty"><span className="crz-spinner" /><strong>Carregando...</strong></div>
            ) : detail ? (
              <>
                <header className="crz-payments-detail-head">
                  <div><small>PAYMENT</small><h2>{short(detail.payment.id, 12)}</h2><span>{detail.payment.username}</span></div>
                  <Badge tone={paymentTone(detail.payment.status)}>{detail.payment.status}</Badge>
                </header>

                <div className="crz-payments-detail-actions">
                  <button type="button" disabled={busy === "reconcile"} onClick={() => void reconcile()}>
                    {busy === "reconcile" ? "Consultando..." : "↻ Reconciliar agora"}
                  </button>
                  <button type="button" disabled={busy === "refund" || detail.payment.status !== "COMPLETED"} onClick={() => void registerRefund()}>
                    Registrar refund
                  </button>
                  <button type="button" disabled={busy === "dispute"} onClick={() => void registerDispute()}>
                    + Disputa
                  </button>
                </div>

                <section className="crz-payments-detail-grid">
                  <div><span>Total</span><strong>{moneyFromCents(detail.payment.amount_cents)}</strong></div>
                  <div><span>Método</span><strong>{detail.payment.payment_method?.toUpperCase() || "—"}</strong></div>
                  <div><span>Charge</span><strong>{detail.payment.charge_reference || "—"}</strong></div>
                  <div><span>Idempotency</span><strong>{detail.payment.idempotency_reference || "—"}</strong></div>
                  <div><span>Pago em</span><strong>{dateTime(detail.payment.paid_at)}</strong></div>
                  <div><span>Expira</span><strong>{dateTime(detail.payment.expires_at)}</strong></div>
                </section>

                <section className="crz-payments-detail-section">
                  <header><small>EVENTOS / WEBHOOKS / POLLING</small><strong>{detail.events.length}</strong></header>
                  <div className="crz-payments-event-list">
                    {detail.events.map((event) => (
                      <article key={event.id}>
                        <span><Badge tone={eventTone(event.severity)}>{event.severity.toUpperCase()}</Badge></span>
                        <div><strong>{event.event_type}</strong><small>{event.source} • {dateTime(event.created_at)}</small></div>
                        <div><strong>{event.status_before || "—"} → {event.status_after || event.provider_status || "—"}</strong><small>HTTP {event.http_status || "—"}</small></div>
                      </article>
                    ))}
                    {!detail.events.length && <em>Nenhum evento operacional registrado ainda.</em>}
                  </div>
                </section>

                <section className="crz-payments-detail-section">
                  <header><small>RECONCILIAÇÕES</small><strong>{detail.reconciliations.length}</strong></header>
                  <div className="crz-payments-case-list">
                    {detail.reconciliations.map((item) => (
                      <article key={item.id}><span><strong>{item.status.toUpperCase()}</strong><small>{item.reason || "Reconciliação"}</small></span><span>{item.status_before || "—"} → {item.status_after || item.provider_status || "—"}</span></article>
                    ))}
                    {!detail.reconciliations.length && <em>Nenhuma reconciliação solicitada.</em>}
                  </div>
                </section>

                <section className="crz-payments-detail-section">
                  <header><small>REEMBOLSOS</small><strong>{detail.refunds.length}</strong></header>
                  <div className="crz-payments-case-list">
                    {detail.refunds.map((item) => (
                      <article key={item.id}><span><strong>{moneyFromCents(item.amount_cents)}</strong><small>{item.reason || "Sem motivo"}</small></span><Badge tone={item.status === "completed" ? "green" : "gold"}>{item.status.toUpperCase()}</Badge></article>
                    ))}
                    {!detail.refunds.length && <em>Nenhum caso de reembolso.</em>}
                  </div>
                </section>

                <section className="crz-payments-detail-section">
                  <header><small>DISPUTAS / EVIDÊNCIAS</small><strong>{detail.disputes.length}</strong></header>
                  <div className="crz-payments-case-list">
                    {detail.disputes.map((item) => (
                      <article key={item.id}>
                        <span><strong>{item.status.toUpperCase()}</strong><small>{item.reason || "Sem descrição"} • {item.evidence_count} evidência(s)</small></span>
                        <button type="button" disabled={busy === "evidence:" + item.id} onClick={() => void addEvidence(item.id)}>+ Evidência</button>
                      </article>
                    ))}
                    {!detail.disputes.length && <em>Nenhuma disputa registrada.</em>}
                  </div>
                </section>

                <p className="crz-payments-secret-note">
                  🔐 Checkout proof, QR payload, API key, webhook secret e credenciais entregues nunca são exibidos neste painel.
                </p>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
