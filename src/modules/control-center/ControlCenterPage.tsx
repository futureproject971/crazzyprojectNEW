"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { ControlCenterSnapshot, ManualControlAlert } from "./types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents || 0) / 100);
}

function tone(severity: ManualControlAlert["severity"]) {
  if (severity === "critical") return "pink" as const;
  if (severity === "warning") return "gold" as const;
  return "blue" as const;
}

function EmptyCheck({ text }: { text: string }) {
  return (
    <div className="crz-control-empty">
      <NeonIcon name="verified" size={24} />
      <span>{text}</span>
    </div>
  );
}

export function ControlCenterPage() {
  const [snapshot, setSnapshot] = useState<ControlCenterSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    setError("");

    try {
      const response = await fetch("/api/admin/control-center", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setState("auth");
        return;
      }
      if (response.status === 403) {
        setState("forbidden");
        return;
      }

      const payload = await response.json();
      if (!response.ok) throw new Error("Não foi possível carregar o Control Center.");

      setSnapshot(payload.snapshot as ControlCenterSnapshot);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o Control Center.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalWarnings = useMemo(() => {
    if (!snapshot) return 0;
    const s = snapshot.summary;
    return (
      s.payment_divergence +
      s.fulfillment_failures +
      s.discord_failures +
      s.low_stock +
      s.missing_tutorials +
      s.active_incidents +
      s.manual_open_alerts
    );
  }, [snapshot]);

  const setAlertState = async (
    alert: ManualControlAlert,
    nextState: "open" | "acknowledged" | "resolved"
  ) => {
    setBusyId(alert.id);
    try {
      const response = await fetch("/api/admin/control-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_alert_state",
          alertId: alert.id,
          state: nextState,
        }),
      });

      if (response.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  if (state === "loading" && !snapshot) {
    return <main className="crz-control-page crz-control-state"><span className="crz-spinner" /><p>Carregando Control Center...</p></main>;
  }

  if (state === "auth") {
    return <main className="crz-control-page crz-control-state"><NeonIcon name="shield" size={44} /><strong>Entre para continuar</strong><a className="crz-button crz-button--primary crz-button--sm" href="/login">Entrar</a></main>;
  }

  if (state === "forbidden") {
    return <main className="crz-control-page crz-control-state"><NeonIcon name="shield" size={44} /><strong>Acesso restrito ao administrador</strong><p>Esta área não faz parte da experiência do cliente.</p><a className="crz-button crz-button--secondary crz-button--sm" href="/">Voltar</a></main>;
  }

  if (state === "error" || !snapshot) {
    return <main className="crz-control-page crz-control-state"><NeonIcon name="shield" size={44} /><strong>Control Center indisponível</strong><p>{error}</p><button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>Tentar novamente</button></main>;
  }

  const s = snapshot.summary;

  return (
    <main className="crz-control-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY CONTROL CENTER"
          title="Operação e alertas"
          description="Visão administrativa de pagamentos, entregas, Discord, estoque, tutoriais e incidentes."
          actions={<button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>↻ Atualizar</button>}
        />

        <section className="crz-control-health" id="inicio">
          <div className={totalWarnings ? "has-alerts" : "is-clean"}>
            <NeonIcon name={totalWarnings ? "lightning" : "verified"} size={34} />
            <span><small>ALERTAS ATIVOS</small><strong>{totalWarnings}</strong><em>{totalWarnings ? "itens pedindo atenção" : "operação limpa"}</em></span>
          </div>
          <div><small>PAGAMENTOS</small><strong>{s.payment_divergence}</strong><span>divergências</span></div>
          <div><small>FULFILLMENT</small><strong>{s.fulfillment_failures}</strong><span>falhas</span></div>
          <div><small>DISCORD</small><strong>{s.discord_failures}</strong><span>sync com falha</span></div>
          <div><small>ESTOQUE</small><strong>{s.low_stock}</strong><span>planos em baixa</span></div>
          <div><small>TUTORIAIS</small><strong>{s.missing_tutorials}</strong><span>produtos sem guia</span></div>
        </section>

        <section className="crz-control-grid">
          <article className="crz-control-panel" id="pagamentos">
            <header><div><small>PAGAMENTOS</small><h2>Pagos sem entrega detectada</h2></div><Badge tone={s.payment_divergence ? "pink" : "green"}>{s.payment_divergence ? "ATENÇÃO" : "OK"}</Badge></header>
            {!snapshot.payment_divergence.length ? <EmptyCheck text="Nenhuma divergência detectada." /> : (
              <div className="crz-control-list">
                {snapshot.payment_divergence.map(item => (
                  <div key={item.id}>
                    <span><strong>{item.charge_id || item.id.slice(0,8)}</strong><small>{item.payment_method || "método não informado"} • {formatDate(item.paid_at || item.created_at)}</small></span>
                    <b>{money(item.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="crz-control-panel" id="fulfillment">
            <header><div><small>FULFILLMENT</small><h2>Entregas com erro</h2></div><Badge tone={s.fulfillment_failures ? "pink" : "green"}>{s.fulfillment_failures ? "ATENÇÃO" : "OK"}</Badge></header>
            {!snapshot.fulfillment_failures.length ? <EmptyCheck text="Nenhuma falha de entrega registrada." /> : (
              <div className="crz-control-list">
                {snapshot.fulfillment_failures.map(item => (
                  <div key={item.id}>
                    <span><strong>{item.status_label || item.status}</strong><small>{item.id.slice(0,8)} • {formatDate(item.updated_at)}</small></span>
                    <Badge tone="pink">{item.status.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="crz-control-panel" id="discord">
            <header><div><small>DISCORD</small><h2>Sincronização de cargos</h2></div><Badge tone={s.discord_failures ? "gold" : "green"}>{s.discord_failures ? "VERIFICAR" : "OK"}</Badge></header>
            {!snapshot.discord_failures.length ? <EmptyCheck text="Nenhum erro de sincronização." /> : (
              <div className="crz-control-list">
                {snapshot.discord_failures.map(item => (
                  <div key={item.id}>
                    <span><strong>{item.role_name || "Cargo Discord"}</strong><small>{item.last_error_code || item.status} • {formatDate(item.updated_at)}</small></span>
                    <Badge tone="gold">{item.status.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="crz-control-panel" id="estoque">
            <header><div><small>ESTOQUE</small><h2>Planos em baixa</h2></div><Badge tone={s.low_stock ? "gold" : "green"}>{s.low_stock ? "BAIXO" : "OK"}</Badge></header>
            {!snapshot.low_stock.length ? <EmptyCheck text="Nenhum plano de estoque conhecido está abaixo do limite." /> : (
              <div className="crz-control-list">
                {snapshot.low_stock.map(item => (
                  <div key={item.plan_id}>
                    <span><strong>{item.product_name}</strong><small>{item.plan_name}</small></span>
                    <b>{item.available_stock} restante(s)</b>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="crz-control-panel" id="tutorial">
            <header><div><small>ACADEMY</small><h2>Produtos sem tutorial</h2></div><Badge tone={s.missing_tutorials ? "gold" : "green"}>{s.missing_tutorials ? "PENDENTE" : "OK"}</Badge></header>
            {!snapshot.missing_tutorials.length ? <EmptyCheck text="Todos os produtos ativos têm tutorial ou conteúdo legado." /> : (
              <div className="crz-control-list">
                {snapshot.missing_tutorials.map(item => (
                  <div key={item.product_id}>
                    <span><strong>{item.product_name}</strong><small>Sem tutorial associado</small></span>
                    <a href="/academy">Academy →</a>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="crz-control-panel" id="status">
            <header><div><small>STATUS</small><h2>Incidentes públicos ativos</h2></div><Badge tone={s.active_incidents ? "pink" : "green"}>{s.active_incidents ? "ATIVO" : "OK"}</Badge></header>
            {!snapshot.active_incidents.length ? <EmptyCheck text="Nenhum incidente público ativo." /> : (
              <div className="crz-control-list">
                {snapshot.active_incidents.map(item => (
                  <div key={item.id}>
                    <span><strong>{item.title}</strong><small>{item.state} • {formatDate(item.started_at)}</small></span>
                    <Badge tone={item.impact === "critical" ? "pink" : "gold"}>{item.impact.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="crz-control-manual" id="alertas">
          <header>
            <div><small>ALERTAS MANUAIS / INTEGRAÇÕES</small><h2>Fila operacional</h2></div>
            <span>Inclui disputas e eventos externos registrados pelo sistema.</span>
          </header>

          {!snapshot.manual_alerts.length ? <EmptyCheck text="Nenhum alerta manual aberto." /> : (
            <div className="crz-control-manual__list">
              {snapshot.manual_alerts.map(alert => (
                <article key={alert.id}>
                  <div className="crz-control-manual__icon"><NeonIcon name="lightning" size={23} /></div>
                  <div>
                    <span><Badge tone={tone(alert.severity)}>{alert.severity.toUpperCase()}</Badge><small>{alert.category}</small></span>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                    <em>{formatDate(alert.created_at)}</em>
                  </div>
                  <div className="crz-control-manual__actions">
                    {alert.state !== "acknowledged" && (
                      <button type="button" disabled={busyId === alert.id} onClick={() => void setAlertState(alert,"acknowledged")}>Reconhecer</button>
                    )}
                    <button type="button" disabled={busyId === alert.id} onClick={() => void setAlertState(alert,"resolved")}>Resolver</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="crz-control-generated">Atualizado em {formatDate(snapshot.generated_at)} • pagamentos ACTIVE expirados: {s.stale_active_payments}</p>
      </div>
    </main>
  );
}
