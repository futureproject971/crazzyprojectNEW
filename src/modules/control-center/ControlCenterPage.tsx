"use client";

import Link from "next/link";
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


const ADMIN_GROUPS = [
  {
    title: "Catálogo",
    description: "Organize o que o cliente vê e recebe.",
    tools: [
      { label: "Produtos", description: "Cadastre produtos, planos, preços e disponibilidade.", href: "/admin/produtos", icon: "/icons/package.svg" },
      { label: "Categorias", description: "Organize jogos e vitrines sem mexer no código.", href: "/admin/categorias", icon: "/icons/neon-v2/gamepad.svg" },
      { label: "Estoque", description: "Acompanhe keys e itens com alerta de estoque baixo.", href: "/admin/estoque", icon: "/icons/package.svg" },
      { label: "Tutoriais", description: "Crie e publique guias liberados por produto.", href: "/admin/academy", icon: "/icons/book.svg" },
    ],
  },
  {
    title: "Comercial",
    description: "Venda, receba e acompanhe o dinheiro com clareza.",
    tools: [
      { label: "Vendas", description: "Veja pedidos, status e histórico comercial.", href: "/admin/vendas", icon: "/icons/shopping-cart.svg" },
      { label: "Pagamentos", description: "Acompanhe PIX e demais cobranças confirmadas.", href: "/admin/pagamentos", icon: "/icons/credit-card.svg" },
      { label: "Financeiro", description: "Resumo de valores, divergências e operação financeira.", href: "/admin/finance", icon: "/icons/credit-card.svg" },
      { label: "Campanhas", description: "Monte mensagens do Discord com preview antes de enviar.", href: "/admin/campanhas", icon: "/icons/flame.svg" },
      { label: "Cupons", description: "Crie descontos e regras sem caixas externas do navegador.", href: "/admin/cupons", icon: "/icons/star.svg" },
    ],
  },
  {
    title: "Fidelização",
    description: "Controle bônus, recompensas e experiências do cliente.",
    tools: [
      { label: "CRAZZY BONUS", description: "Configure carteira promocional e regras de crédito.", href: "/admin/bonus", icon: "/icons/crown.svg" },
      { label: "CRAZZY ARCADE", description: "Gerencie roleta, raspadinha, pesos e prêmios.", href: "/admin/luck", icon: "/icons/bolt.svg" },
      { label: "Rewards", description: "Controle recompensas, elegibilidade e resgates.", href: "/admin/rewards", icon: "/icons/diamond.svg" },
      { label: "Club", description: "Gerencie benefícios e experiências do CRAZZY CLUB.", href: "/admin/club", icon: "/icons/crown.svg" },
    ],
  },
  {
    title: "Atendimento",
    description: "Tudo que envolve clientes, suporte e comunicação.",
    tools: [
      { label: "Tickets", description: "Atenda conversas, prioridades, status e histórico.", href: "/admin/suporte", icon: "/icons/headset.svg" },
      { label: "Clientes", description: "Visão 360° do usuário sem misturar dados de outros clientes.", href: "/admin/clientes", icon: "/icons/users.svg" },
      { label: "CRAZZY CALL", description: "Gerencie salas, participantes e atendimento por chamada.", href: "/admin/calls", icon: "/icons/headset.svg" },
      { label: "Comunidade", description: "Modere o chat e acompanhe ações da comunidade.", href: "/admin/comunidade", icon: "/icons/users.svg" },
    ],
  },
  {
    title: "Integrações",
    description: "Conecte serviços externos e veja o estado de cada integração.",
    tools: [
      { label: "Discord", description: "Bot, membros, cargos e sincronização da guild.", href: "/admin/discord", icon: "/icons/brand-discord.svg" },
      { label: "Discord Bridge", description: "Acompanhe grants, retries e sincronizações.", href: "/admin/discord-bridge", icon: "/icons/users.svg" },
      { label: "Integrações", description: "PIX, APIs e conexões com estado e explicação do erro.", href: "/admin/integracoes", icon: "/icons/bolt.svg" },
      { label: "Entregas", description: "Monitore fulfillment sem duplicar entrega.", href: "/admin/fulfillment", icon: "/icons/package.svg" },
    ],
  },
  {
    title: "Sistema",
    description: "Configurações avançadas e segurança ficam juntas, longe da navegação do cliente.",
    tools: [
      { label: "Marca & Aparência", description: "Logo, capas, wallpaper, cores, favicon e modo marca branca.", href: "/admin/aparencia", icon: "/icons/diamond.svg" },
      { label: "Segurança", description: "Veja incidentes, tentativas suspeitas e auditoria.", href: "/admin/security", icon: "/icons/shield-check.svg" },
      { label: "Notificações", description: "Configure avisos e mensagens operacionais.", href: "/admin/notificacoes", icon: "/icons/flame.svg" },
      { label: "Revendedores", description: "Gerencie acessos e regras da operação B2B.", href: "/admin/revendedores", icon: "/icons/users.svg" },
      { label: "Parceiros", description: "Cadastre e acompanhe parceiros da plataforma.", href: "/admin/parceiros", icon: "/icons/crown.svg" },
    ],
  },
] as const;

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
        <section className="crz-admin-hero" id="inicio">
          <div className="crz-admin-hero__copy">
            <span>CRAZZY CONTROL CENTER</span>
            <h1>Painel <strong>Admin</strong></h1>
            <p>Central exclusiva para administrar a CRAZZY PROJECT. Cada área explica o que faz antes de você alterar qualquer configuração.</p>
          </div>
          <div className="crz-admin-hero__badge">
            <span className="crz-admin-shield" aria-hidden="true" />
            <div><small>ADMINISTRADOR</small><strong>Acesso total ao sistema</strong></div>
          </div>
        </section>

        <section className="crz-admin-tools" aria-labelledby="admin-tools-title">
          <header>
            <div>
              <small>GERENCIAMENTO DO SISTEMA</small>
              <h2 id="admin-tools-title">Acesso rápido às ferramentas administrativas</h2>
              <p>Escolha uma área. As configurações ficam dentro do site, com explicação, estado atual e ações claras.</p>
            </div>
          </header>
          <div className="crz-admin-groups">
            {ADMIN_GROUPS.map(group => (
              <section className="crz-admin-group" key={group.title}>
                <div className="crz-admin-group__head">
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <div className="crz-admin-tool-grid">
                  {group.tools.map(tool => (
                    <Link className="crz-admin-tool" href={tool.href} key={tool.href}>
                      <span className="crz-admin-tool__icon" aria-hidden="true" style={{WebkitMaskImage:`url("${tool.icon}")`,maskImage:`url("${tool.icon}")`}} />
                      <span className="crz-admin-tool__copy"><strong>{tool.label}</strong><small>{tool.description}</small></span>
                      <span className="crz-admin-tool__arrow" aria-hidden="true">›</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <div className="crz-control-ops-head">
          <PageHeader
            eyebrow="MONITORAMENTO"
            title="Operação e alertas"
            description="Confira pagamentos, entregas, Discord, estoque, tutoriais e incidentes sem sair do painel."
            actions={<button className="crz-button crz-button--secondary crz-button--md" type="button" onClick={() => void load()}>↻ Atualizar</button>}
          />
        </div>

        <section className="crz-control-health">
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
