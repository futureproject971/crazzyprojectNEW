"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";
import type {
  FinanceMethodRow,
  FinancePayload,
  FinancePaymentRow,
} from "./types";

type RangePreset = "7d" | "30d" | "90d" | "custom";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) / 100);
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

function dateOnly(value: string) {
  const date = new Date(value + "T12:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function rangeForPreset(preset: Exclude<RangePreset, "custom">) {
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function localInputDate(value: Date) {
  const copy = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function shortId(value: string) {
  return value.length > 14 ? value.slice(0, 8) + "…" + value.slice(-4) : value;
}

function feeSourceLabel(value: FinancePaymentRow["fee_source"]) {
  const map = {
    provider: "REAL / PROVIDER",
    manual: "REAL / MANUAL",
    estimated: "ESTIMADA",
    unconfigured: "NÃO PRECIFICADA",
  };
  return map[value] || value;
}

function feeSourceTone(
  value: FinancePaymentRow["fee_source"]
): "green" | "blue" | "gold" | "pink" | "neutral" {
  if (value === "provider") return "green";
  if (value === "manual") return "blue";
  if (value === "estimated") return "gold";
  if (value === "unconfigured") return "pink";
  return "neutral";
}

function FeeRuleEditor({
  row,
  busy,
  onSave,
  onClear,
}: {
  row: FinanceMethodRow;
  busy: boolean;
  onSave: (
    method: string,
    percent: number,
    fixedCents: number,
    sourceLabel: string,
    notes: string
  ) => Promise<void>;
  onClear: (method: string) => Promise<void>;
}) {
  const [percent, setPercent] = useState(
    row.fee_rule ? (row.fee_rule.percent_bps / 100).toFixed(2) : ""
  );
  const [fixed, setFixed] = useState(
    row.fee_rule ? (row.fee_rule.fixed_cents / 100).toFixed(2) : ""
  );
  const [source, setSource] = useState(row.fee_rule?.source_label || "");
  const [notes, setNotes] = useState(row.fee_rule?.notes || "");

  useEffect(() => {
    setPercent(row.fee_rule ? (row.fee_rule.percent_bps / 100).toFixed(2) : "");
    setFixed(row.fee_rule ? (row.fee_rule.fixed_cents / 100).toFixed(2) : "");
    setSource(row.fee_rule?.source_label || "");
    setNotes(row.fee_rule?.notes || "");
  }, [
    row.fee_rule?.id,
    row.fee_rule?.percent_bps,
    row.fee_rule?.fixed_cents,
    row.fee_rule?.source_label,
    row.fee_rule?.notes,
  ]);

  const save = async () => {
    const p = Number(String(percent).replace(",", "."));
    const fixedValue = Number(String(fixed).replace(",", "."));
    if (
      !Number.isFinite(p) ||
      p < 0 ||
      p > 100 ||
      !Number.isFinite(fixedValue) ||
      fixedValue < 0
    ) {
      return;
    }

    await onSave(
      row.method,
      p,
      Math.round(fixedValue * 100),
      source,
      notes
    );
  };

  return (
    <article className="crz-finance-method-card">
      <header>
        <div>
          <small>{row.method === "crypto" ? "LTC" : row.method.toUpperCase()}</small>
          <strong>{row.label}</strong>
        </div>
        <Badge tone={row.fee_rule ? "gold" : "pink"}>
          {row.fee_rule ? "REGRA ESTIMADA" : "SEM TAXA"}
        </Badge>
      </header>

      <div className="crz-finance-method-metrics">
        <div>
          <span>Receita</span>
          <strong>{money(row.gross_cents)}</strong>
        </div>
        <div>
          <span>Taxas conhecidas</span>
          <strong>{money(row.known_fee_cents)}</strong>
        </div>
        <div>
          <span>Não precificados</span>
          <strong>{row.unpriced_count}</strong>
        </div>
        <div>
          <span>Líquido</span>
          <strong>{money(row.net_estimated_cents)}</strong>
        </div>
      </div>

      <div className="crz-finance-fee-editor">
        <label>
          <span>Taxa %</span>
          <input
            inputMode="decimal"
            value={percent}
            placeholder="ex. 1,99"
            onChange={(event) => setPercent(event.target.value.slice(0, 10))}
          />
        </label>
        <label>
          <span>Fixa R$</span>
          <input
            inputMode="decimal"
            value={fixed}
            placeholder="ex. 0,50"
            onChange={(event) => setFixed(event.target.value.slice(0, 12))}
          />
        </label>
        <label className="is-wide">
          <span>Fonte da regra</span>
          <input
            value={source}
            placeholder="Ex.: contrato / tabela comercial"
            onChange={(event) => setSource(event.target.value.slice(0, 120))}
          />
        </label>
        <label className="is-wide">
          <span>Observação</span>
          <input
            value={notes}
            placeholder="Opcional"
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
          />
        </label>
      </div>

      <footer>
        <span>
          {row.fee_rule
            ? "Estimativa ativa desde " + dateTime(row.fee_rule.effective_from)
            : "Sem regra. Transações ficam como não precificadas."}
        </span>
        <div>
          {row.fee_rule && (
            <button
              type="button"
              className="is-danger"
              disabled={busy}
              onClick={() => void onClear(row.method)}
            >
              Remover regra
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando..." : "Salvar regra"}
          </button>
        </div>
      </footer>
    </article>
  );
}

export function FinanceManagerPage() {
  const [data, setData] = useState<FinancePayload | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "auth" | "forbidden" | "error"
  >("loading");
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [method, setMethod] = useState("");
  const [customFrom, setCustomFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return localInputDate(date);
  });
  const [customTo, setCustomTo] = useState(() => localInputDate(new Date()));
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState("loading");

      try {
        const params = new URLSearchParams();

        if (preset === "custom") {
          const from = new Date(customFrom + "T00:00:00");
          const to = new Date(customTo + "T23:59:59.999");
          if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new Error("INVALID_DATE");
          }
          params.set("from", from.toISOString());
          params.set("to", to.toISOString());
        } else {
          const range = rangeForPreset(preset);
          params.set("from", range.from);
          params.set("to", range.to);
        }

        if (method) params.set("method", method);

        const response = await fetch("/api/admin/finance?" + params.toString(), {
          cache: "no-store",
        });

        if (response.status === 401) return setState("auth");
        if (response.status === 403) return setState("forbidden");

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.finance) throw new Error("LOAD_FAILED");

        setData(payload.finance as FinancePayload);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [customFrom, customTo, method, preset]
  );

  useEffect(() => {
    void load();
  }, []);

  const saveFeeRule = async (
    feeMethod: string,
    percent: number,
    fixedCents: number,
    sourceLabel: string,
    notes: string
  ) => {
    setBusy("fee:" + feeMethod);
    setNotice("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_fee_rule",
          method: feeMethod,
          percent,
          fixedCents,
          sourceLabel,
          notes,
        }),
      });

      if (!response.ok) throw new Error("SAVE_FAILED");

      setNotice(
        "Regra de taxa salva como estimativa. Pagamentos com custo real continuam tendo prioridade."
      );
      await load(true);
    } catch {
      setNotice("Não foi possível salvar a regra de taxa.");
    } finally {
      setBusy(null);
    }
  };

  const clearFeeRule = async (feeMethod: string) => {
    if (
      !window.confirm(
        "Remover esta regra estimada? Pagamentos sem custo real voltarão a ficar como não precificados."
      )
    ) {
      return;
    }

    setBusy("fee:" + feeMethod);
    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_fee_rule",
          method: feeMethod,
        }),
      });

      if (!response.ok) throw new Error("CLEAR_FAILED");
      setNotice("Regra removida. Nenhuma taxa será inventada para esse método.");
      await load(true);
    } catch {
      setNotice("Não foi possível remover a regra.");
    } finally {
      setBusy(null);
    }
  };

  const setExactPaymentCost = async (payment: FinancePaymentRow) => {
    const rawFee = window.prompt(
      "Taxa REAL desta transação em R$:",
      payment.fee_cents !== null
        ? (payment.fee_cents / 100).toFixed(2).replace(".", ",")
        : ""
    );
    if (rawFee === null) return;

    const fee = Number(rawFee.replace(",", "."));
    if (!Number.isFinite(fee) || fee < 0) {
      setNotice("Taxa inválida.");
      return;
    }

    const rawNet = window.prompt(
      "Líquido informado pelo provider em R$ (opcional):",
      payment.provider_net_cents !== null
        ? (payment.provider_net_cents / 100).toFixed(2).replace(".", ",")
        : ""
    );

    const net =
      rawNet && rawNet.trim()
        ? Number(rawNet.replace(",", "."))
        : null;

    if (net !== null && (!Number.isFinite(net) || net < 0)) {
      setNotice("Líquido do provider inválido.");
      return;
    }

    const note = window.prompt("Fonte/observação deste custo real:") || "";

    setBusy("cost:" + payment.payment_id);
    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_payment_cost",
          paymentId: payment.payment_id,
          gatewayFeeCents: Math.round(fee * 100),
          providerNetCents: net === null ? null : Math.round(net * 100),
          note,
        }),
      });

      if (!response.ok) throw new Error("COST_FAILED");
      setNotice("Custo real da transação salvo.");
      await load(true);
    } catch {
      setNotice("Não foi possível salvar o custo da transação.");
    } finally {
      setBusy(null);
    }
  };

  const createHold = async () => {
    const raw = window.prompt("Valor da retenção em R$:");
    if (!raw) return;
    const value = Number(raw.replace(",", "."));

    if (!Number.isFinite(value) || value <= 0) {
      setNotice("Valor de retenção inválido.");
      return;
    }

    const paymentId =
      window.prompt("Payment ID relacionado (opcional):")?.trim() || "";
    const reason = window.prompt("Motivo da retenção:") || "";
    const providerRef =
      window.prompt("Referência externa/provider (opcional):") || "";

    setBusy("hold:create");
    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_hold",
          amountCents: Math.round(value * 100),
          paymentId: paymentId || null,
          reason,
          providerRef,
        }),
      });

      if (!response.ok) throw new Error("HOLD_FAILED");
      setNotice("Retenção registrada.");
      await load(true);
    } catch {
      setNotice("Não foi possível registrar a retenção.");
    } finally {
      setBusy(null);
    }
  };

  const updateHold = async (
    holdId: string,
    status: "released" | "cancelled"
  ) => {
    setBusy("hold:" + holdId);
    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_hold_status",
          holdId,
          status,
        }),
      });

      if (!response.ok) throw new Error("HOLD_UPDATE_FAILED");
      setNotice(
        status === "released" ? "Retenção liberada." : "Retenção cancelada."
      );
      await load(true);
    } catch {
      setNotice("Não foi possível atualizar a retenção.");
    } finally {
      setBusy(null);
    }
  };

  const summary = data?.summary;
  const dailyMax = useMemo(() => {
    return Math.max(1, ...(data?.daily || []).map((row) => row.gross_cents));
  }, [data?.daily]);

  if (state === "loading" && !data) {
    return (
      <main className="crz-finance-state">
        <span className="crz-spinner" />
        <strong>Calculando financeiro...</strong>
      </main>
    );
  }

  if (state === "auth") {
    return (
      <main className="crz-finance-state">
        <strong>Entre para continuar.</strong>
        <a
          className="crz-button crz-button--primary crz-button--sm"
          href="/login?next=%2Fadmin%2Ffinance"
        >
          Entrar
        </a>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="crz-finance-state">
        <strong>Acesso de administrador necessário.</strong>
      </main>
    );
  }

  if (state === "error" || !data || !summary) {
    return (
      <main className="crz-finance-state">
        <strong>Finance Manager indisponível.</strong>
        <button type="button" onClick={() => void load()}>
          Tentar novamente
        </button>
      </main>
    );
  }

  const hasUnknown =
    summary.unpriced_payments > 0 ||
    summary.chargebacks_unknown_count > 0;

  return (
    <main className="crz-finance-manager">
      <div className="crz-container crz-finance-container">
        <PageHeader
          eyebrow="M30 • CRAZZY FINANCE"
          title="Dinheiro sem maquiagem"
          description="Receita, taxas, reembolsos, disputas, retenções e líquido com transparência sobre o que é real, estimado ou ainda desconhecido."
          actions={
            <div className="crz-finance-header-actions">
              <a
                className="crz-button crz-button--secondary crz-button--sm"
                href="/admin/pagamentos"
              >
                Pagamentos
              </a>
              <button
                className="crz-button crz-button--secondary crz-button--sm"
                type="button"
                onClick={() => void load(true)}
              >
                ↻ Atualizar
              </button>
            </div>
          }
        />

        <section className="crz-finance-toolbar">
          <div className="crz-finance-presets">
            {(["7d", "30d", "90d"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={preset === item ? "is-active" : ""}
                onClick={() => setPreset(item)}
              >
                {item.replace("d", " dias")}
              </button>
            ))}
            <button
              type="button"
              className={preset === "custom" ? "is-active" : ""}
              onClick={() => setPreset("custom")}
            >
              Personalizado
            </button>
          </div>

          {preset === "custom" && (
            <div className="crz-finance-custom-range">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          )}

          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="">Todos os métodos</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="crypto">Litecoin</option>
          </select>

          <button
            type="button"
            className="crz-button crz-button--primary crz-button--sm"
            onClick={() => void load()}
          >
            Aplicar
          </button>
        </section>

        {hasUnknown && (
          <section className="crz-finance-warning">
            <strong>⚠ RESULTADO LÍQUIDO AINDA NÃO É DEFINITIVO</strong>
            <span>
              {summary.unpriced_payments} pagamento(s) sem taxa conhecida
              {summary.chargebacks_unknown_count
                ? " e " +
                  summary.chargebacks_unknown_count +
                  " chargeback(s) sem valor"
                : ""}
              . Configure uma regra estimada ou informe o custo real da transação.
            </span>
          </section>
        )}

        {notice && <div className="crz-finance-notice">{notice}</div>}

        <section className="crz-finance-summary">
          <article>
            <small>RECEITA BRUTA</small>
            <strong>{money(summary.gross_cents)}</strong>
            <span>{summary.completed_payments} pagamento(s)</span>
          </article>
          <article>
            <small>TAXAS CONHECIDAS</small>
            <strong>{money(summary.known_gateway_fee_cents)}</strong>
            <span>{summary.unpriced_payments} sem preço</span>
          </article>
          <article>
            <small>REFUNDS CONCLUÍDOS</small>
            <strong>{money(summary.refunds_completed_cents)}</strong>
            <span>{money(summary.refunds_pending_cents)} pendente</span>
          </article>
          <article>
            <small>CHARGEBACKS PERDIDOS</small>
            <strong>{money(summary.chargebacks_lost_cents)}</strong>
            <span>{summary.chargebacks_unknown_count} sem valor</span>
          </article>
          <article className={hasUnknown ? "is-partial" : "is-net"}>
            <small>{hasUnknown ? "LÍQUIDO PARCIAL" : "LÍQUIDO ESTIMADO"}</small>
            <strong>
              {money(
                hasUnknown
                  ? summary.net_before_unknown_fees_cents
                  : summary.net_estimated_cents
              )}
            </strong>
            <span>
              {hasUnknown
                ? "faltam custos para fechar"
                : "com taxas conhecidas/estimadas"}
            </span>
          </article>
        </section>

        <section className="crz-finance-risk-strip">
          <div>
            <small>EXPOSIÇÃO DISPUTAS ABERTAS</small>
            <strong>{money(summary.open_dispute_exposure_cents)}</strong>
            <span>{summary.open_dispute_unknown_count} sem valor informado</span>
          </div>
          <div>
            <small>RETENÇÕES ABERTAS</small>
            <strong>{money(summary.manual_holds_open_cents)}</strong>
            <span>não descontadas do resultado realizado</span>
          </div>
          <button type="button" onClick={() => void createHold()}>
            + Registrar retenção
          </button>
        </section>

        <section className="crz-finance-methods-grid">
          {data.methods.map((row) => (
            <FeeRuleEditor
              key={row.method}
              row={row}
              busy={busy === "fee:" + row.method}
              onSave={saveFeeRule}
              onClear={clearFeeRule}
            />
          ))}
        </section>

        <section className="crz-finance-chart-card">
          <header>
            <div>
              <small>FLUXO DIÁRIO</small>
              <strong>Receita por dia</strong>
            </div>
            <span>
              {dateOnly(data.range.from)} → {dateOnly(data.range.to)}
            </span>
          </header>

          <div className="crz-finance-bars">
            {data.daily.map((row) => {
              const height = Math.max(
                row.gross_cents > 0 ? 4 : 1,
                Math.round((row.gross_cents / dailyMax) * 100)
              );
              return (
                <div className="crz-finance-bar-column" key={row.day}>
                  <div className="crz-finance-bar-value">
                    <span>{money(row.gross_cents)}</span>
                    <small>
                      {row.payments_count} venda(s)
                      {row.unpriced_count
                        ? " • " + row.unpriced_count + " sem taxa"
                        : ""}
                    </small>
                  </div>
                  <div className="crz-finance-bar-track">
                    <i style={{ height: height + "%" }} />
                  </div>
                  <b>{dateOnly(row.day)}</b>
                </div>
              );
            })}
          </div>
        </section>

        <div className="crz-finance-bottom-grid">
          <section className="crz-finance-payments">
            <header>
              <div>
                <small>TRANSAÇÕES</small>
                <strong>Custos por pagamento</strong>
              </div>
              <span>real &gt; estimado &gt; desconhecido</span>
            </header>

            <div className="crz-finance-payment-table">
              <div className="crz-finance-payment-head">
                <span>Pagamento</span>
                <span>Método</span>
                <span>Bruto</span>
                <span>Taxa</span>
                <span>Fonte</span>
                <span>Líquido</span>
                <span>Ação</span>
              </div>

              {data.recent_payments.map((payment) => (
                <article key={payment.payment_id}>
                  <span>
                    <strong>{payment.username}</strong>
                    <small>
                      {shortId(payment.payment_id)} • {dateTime(payment.paid_at)}
                    </small>
                  </span>
                  <span>
                    <Badge tone="blue">
                      {(payment.payment_method || "—").toUpperCase()}
                    </Badge>
                  </span>
                  <span>
                    <strong>{money(payment.gross_cents)}</strong>
                  </span>
                  <span>
                    <strong>{money(payment.fee_cents)}</strong>
                  </span>
                  <span>
                    <Badge tone={feeSourceTone(payment.fee_source)}>
                      {feeSourceLabel(payment.fee_source)}
                    </Badge>
                  </span>
                  <span>
                    <strong>{money(payment.net_after_fee_cents)}</strong>
                    {(payment.refunds_completed_cents > 0 ||
                      payment.open_hold_cents > 0) && (
                      <small>
                        {payment.refunds_completed_cents > 0
                          ? "refund " + money(payment.refunds_completed_cents)
                          : ""}
                        {payment.open_hold_cents > 0
                          ? " • hold " + money(payment.open_hold_cents)
                          : ""}
                      </small>
                    )}
                  </span>
                  <span>
                    <button
                      type="button"
                      disabled={busy === "cost:" + payment.payment_id}
                      onClick={() => void setExactPaymentCost(payment)}
                    >
                      Definir real
                    </button>
                  </span>
                </article>
              ))}

              {!data.recent_payments.length && (
                <div className="crz-finance-empty">
                  Nenhum pagamento concluído no período.
                </div>
              )}
            </div>
          </section>

          <section className="crz-finance-holds">
            <header>
              <div>
                <small>RETENÇÕES</small>
                <strong>Valores temporariamente presos</strong>
              </div>
            </header>

            <div className="crz-finance-hold-list">
              {data.holds.map((hold) => (
                <article key={hold.id}>
                  <div>
                    <strong>{money(hold.amount_cents)}</strong>
                    <small>{hold.reason || "Sem motivo informado"}</small>
                    <span>
                      {hold.payment_id ? shortId(hold.payment_id) : "sem payment"} •{" "}
                      {dateTime(hold.opened_at)}
                    </span>
                  </div>
                  <Badge
                    tone={
                      hold.status === "open"
                        ? "gold"
                        : hold.status === "released"
                          ? "green"
                          : "neutral"
                    }
                  >
                    {hold.status.toUpperCase()}
                  </Badge>
                  {hold.status === "open" && (
                    <div className="crz-finance-hold-actions">
                      <button
                        type="button"
                        disabled={busy === "hold:" + hold.id}
                        onClick={() => void updateHold(hold.id, "released")}
                      >
                        Liberar
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        disabled={busy === "hold:" + hold.id}
                        onClick={() => void updateHold(hold.id, "cancelled")}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </article>
              ))}

              {!data.holds.length && (
                <div className="crz-finance-empty">
                  Nenhuma retenção registrada.
                </div>
              )}
            </div>
          </section>
        </div>

        <p className="crz-finance-footnote">
          ℹ️ Regras percentuais/fixas são **estimativas configuradas**. Um custo real
          por transação substitui a estimativa. Retenções e disputas abertas são
          exposição, não despesa realizada, e por isso aparecem separadas do líquido.
        </p>
      </div>
    </main>
  );
}
