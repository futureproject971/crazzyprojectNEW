"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type {
  PublicStatusSnapshot,
  ServiceState,
  StatusIncident,
} from "./types";

const stateMeta: Record<ServiceState, { label: string; color: string; tone: "green" | "gold" | "pink" | "blue" | "neutral" }> = {
  operational: { label: "Operacional", color: "#27D17F", tone: "green" },
  degraded: { label: "Instabilidade", color: "#FFB020", tone: "gold" },
  partial_outage: { label: "Interrupção parcial", color: "#FF8A3D", tone: "gold" },
  major_outage: { label: "Indisponível", color: "#FF416C", tone: "pink" },
  maintenance: { label: "Manutenção", color: "#5AAEFF", tone: "blue" },
};

const incidentStateLabel: Record<StatusIncident["state"], string> = {
  investigating: "Investigando",
  identified: "Identificado",
  monitoring: "Monitorando",
  resolved: "Resolvido",
};

const impactOrder: Record<ServiceState, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function overallState(snapshot: PublicStatusSnapshot): ServiceState {
  let current: ServiceState = "operational";
  for (const component of snapshot.components) {
    if (impactOrder[component.state] > impactOrder[current]) current = component.state;
  }
  return current;
}

export function StatusPage() {
  const [snapshot, setSnapshot] = useState<PublicStatusSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Não foi possível consultar o status.");
      }
      setSnapshot(payload as PublicStatusSnapshot);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar status.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overall = useMemo(
    () => snapshot ? overallState(snapshot) : "operational",
    [snapshot]
  );
  const meta = stateMeta[overall];
  const activeIncidents = snapshot?.incidents.filter((incident) => !incident.resolved_at) || [];
  const resolvedIncidents = snapshot?.incidents.filter((incident) => Boolean(incident.resolved_at)) || [];

  return (
    <main className="crz-status-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY STATUS"
          title="Status dos serviços"
          description="Acompanhe disponibilidade, manutenções e incidentes dos recursos da CRAZZY PROJECT."
          actions={
            <button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>
              ↻ Atualizar
            </button>
          }
        />

        {state === "loading" && !snapshot && (
          <section className="crz-status-state">
            <span className="crz-spinner" />
            <p>Consultando serviços...</p>
          </section>
        )}

        {state === "error" && !snapshot && (
          <section className="crz-status-state">
            <NeonIcon name="shield" size={42} />
            <strong>Status temporariamente indisponível</strong>
            <p>{error}</p>
            <button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>
              Tentar novamente
            </button>
          </section>
        )}

        {snapshot && (
          <>
            <section
              className="crz-status-overall"
              style={{ "--status-color": meta.color } as React.CSSProperties}
            >
              <div className="crz-status-overall__pulse"><i /></div>
              <div>
                <small>STATUS GERAL</small>
                <h2>
                  {overall === "operational"
                    ? "Todos os serviços estão operacionais"
                    : meta.label}
                </h2>
                <p>
                  {activeIncidents.length
                    ? activeIncidents.length + " incidente(s) ativo(s) no momento."
                    : "Nenhum incidente ativo registrado."}
                </p>
              </div>
              <Badge tone={meta.tone}>{meta.label.toUpperCase()}</Badge>
            </section>

            <section className="crz-status-components">
              <header>
                <div><small>SERVIÇOS</small><h2>Disponibilidade atual</h2></div>
                <span>Atualizado em {formatDate(snapshot.generated_at)}</span>
              </header>

              <div className="crz-status-components__list">
                {snapshot.components.map((component) => {
                  const componentMeta = stateMeta[component.state];
                  return (
                    <article
                      key={component.key}
                      style={{ "--component-color": componentMeta.color } as React.CSSProperties}
                    >
                      <i />
                      <div>
                        <strong>{component.label}</strong>
                        <span>{component.description}</span>
                        {component.message && <small>{component.message}</small>}
                      </div>
                      <Badge tone={componentMeta.tone}>{componentMeta.label.toUpperCase()}</Badge>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="crz-status-incidents">
              <header><small>INCIDENTES</small><h2>Atividade recente</h2></header>

              {activeIncidents.length === 0 && resolvedIncidents.length === 0 ? (
                <div className="crz-status-no-incidents">
                  <NeonIcon name="verified" size={34} />
                  <div>
                    <strong>Nenhum incidente recente</strong>
                    <span>Quando houver manutenção ou instabilidade, as atualizações aparecem aqui.</span>
                  </div>
                </div>
              ) : (
                <div className="crz-status-incident-list">
                  {[...activeIncidents, ...resolvedIncidents].map((incident) => (
                    <article key={incident.id} className={incident.resolved_at ? "is-resolved" : ""}>
                      <header>
                        <div>
                          <Badge tone={incident.resolved_at ? "green" : incident.impact === "critical" ? "pink" : "gold"}>
                            {incidentStateLabel[incident.state].toUpperCase()}
                          </Badge>
                          <strong>{incident.title}</strong>
                        </div>
                        <time>{formatDate(incident.started_at)}</time>
                      </header>

                      <p>{incident.message}</p>

                      {incident.components.length > 0 && (
                        <div className="crz-status-incident__components">
                          {incident.components.map((component) => (
                            <span key={component.key}>{component.label}</span>
                          ))}
                        </div>
                      )}

                      {incident.updates.length > 0 && (
                        <div className="crz-status-incident__timeline">
                          {incident.updates.map((update, index) => (
                            <div key={update.created_at + index}>
                              <i />
                              <span>
                                <strong>{incidentStateLabel[update.state]}</strong>
                                <p>{update.message}</p>
                                <time>{formatDate(update.created_at)}</time>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="crz-status-help">
              <NeonIcon name="ticket" size={28} />
              <div>
                <strong>Está com um problema que não aparece aqui?</strong>
                <span>Abra um ticket e descreva o que está acontecendo.</span>
              </div>
              <a className="crz-button crz-button--primary crz-button--sm" href="/tickets/novo">Abrir ticket</a>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
