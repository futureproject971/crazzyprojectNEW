"use client";
import { VoiceSettings } from "./VoiceSettings";
import { adminConfirm, adminPrompt } from "@/core/ui/adminDialog";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";
import type {
  DiscordBotCorePayload,
  DiscordBuilderCategory,
  DiscordBuilderTemplate,
  DiscordBuilderTheme,
} from "./types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusTone(status: string): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (status === "completed") return "green";
  if (status === "running") return "blue";
  if (status === "failed") return "pink";
  if (status === "queued") return "gold";
  return "neutral";
}

export function DiscordBotCorePage() {
  const [data, setData] = useState<DiscordBotCorePayload | null>(null);
  const [template, setTemplate] = useState<DiscordBuilderTemplate>({ categories: [] });
  const [theme, setTheme] = useState<DiscordBuilderTheme>({
    primary: "#0000FF",
    secondary: "#1687FF",
    accent: "#00B7FF",
    footer: "CRAZZY PROJECT • DISCORD BOT CORE",
  });
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    try {
      const response = await fetch("/api/admin/discord-bot", { cache: "no-store" });
      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.builder) throw new Error("LOAD_FAILED");

      const next = payload as DiscordBotCorePayload;
      setData(next);
      setTemplate(next.builder.template || { categories: [] });
      setTheme(next.builder.theme || {});
      setState("ready");
    } catch {
      if (!silent) setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 7000);
    return () => window.clearInterval(timer);
  }, [load]);

  const worker = data?.worker || null;
  const workerOnline = useMemo(() => {
    if (!worker?.connected) return false;
    const age = Date.now() - new Date(worker.last_seen_at).getTime();
    return Number.isFinite(age) && age < 45000;
  }, [worker]);

  const diff = useMemo(() => {
    const channels = worker?.channels || [];
    const categoryByName = new Map(
      channels
        .filter((item) => item.type === "category")
        .map((item) => [normalize(item.name), item])
    );

    const missing: Array<{ type: "category" | "channel"; name: string; category?: string }> = [];

    for (const category of template.categories || []) {
      const currentCategory = categoryByName.get(normalize(category.name));
      if (!currentCategory) {
        missing.push({ type: "category", name: category.name });
        for (const channel of category.channels || []) {
          missing.push({ type: "channel", name: channel.name, category: category.name });
        }
        continue;
      }

      const childNames = new Set(
        channels
          .filter((item) => item.parent_id === currentCategory.id && item.type === "text")
          .map((item) => normalize(item.name))
      );

      for (const channel of category.channels || []) {
        if (!childNames.has(normalize(channel.name))) {
          missing.push({
            type: "channel",
            name: channel.name,
            category: category.name,
          });
        }
      }
    }

    return missing;
  }, [template.categories, worker?.channels]);

  const setCategory = (index: number, patch: Partial<DiscordBuilderCategory>) => {
    setTemplate((current) => ({
      ...current,
      categories: current.categories.map((category, itemIndex) =>
        itemIndex === index ? { ...category, ...patch } : category
      ),
    }));
  };

  const addCategory = () => {
    setTemplate((current) => ({
      ...current,
      categories: [
        ...current.categories,
        { name: "├── 🔵 NOVA CATEGORIA", channels: [] },
      ],
    }));
  };

  const removeCategory = async (index: number) => {
    if (!await adminConfirm("Confirmar ação", "Remover esta categoria do TEMPLATE? Isso não apaga nada do Discord.")) return;
    setTemplate((current) => ({
      ...current,
      categories: current.categories.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addChannel = (categoryIndex: number) => {
    setTemplate((current) => ({
      ...current,
      categories: current.categories.map((category, index) =>
        index === categoryIndex
          ? {
              ...category,
              channels: [
                ...category.channels,
                { name: "🔵・novo-canal", type: "text", readOnly: false },
              ],
            }
          : category
      ),
    }));
  };

  const updateChannel = (
    categoryIndex: number,
    channelIndex: number,
    patch: Partial<DiscordBuilderCategory["channels"][number]>
  ) => {
    setTemplate((current) => ({
      ...current,
      categories: current.categories.map((category, index) =>
        index === categoryIndex
          ? {
              ...category,
              channels: category.channels.map((channel, itemIndex) =>
                itemIndex === channelIndex ? { ...channel, ...patch } : channel
              ),
            }
          : category
      ),
    }));
  };

  const removeChannel = (categoryIndex: number, channelIndex: number) => {
    setTemplate((current) => ({
      ...current,
      categories: current.categories.map((category, index) =>
        index === categoryIndex
          ? {
              ...category,
              channels: category.channels.filter((_, itemIndex) => itemIndex !== channelIndex),
            }
          : category
      ),
    }));
  };

  const saveBuilder = async () => {
    if (busy) return;
    setBusy("save");
    setNotice("");
    try {
      const response = await fetch("/api/admin/discord-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_builder",
          template,
          theme,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.builder) throw new Error(payload.error || "SAVE_FAILED");

      setNotice("Template do Server Builder salvo. O Bot Core já usa essa mesma configuração.");
      await load(true);
    } catch {
      setNotice("Não foi possível salvar o template. Revise nomes e limites.");
    } finally {
      setBusy(null);
    }
  };

  const queueBuilder = async () => {
    if (busy) return;
    if (!workerOnline) {
      setNotice("O Bot Core está offline. Ligue o worker da Discloud antes de executar.");
      return;
    }

    const text = diff.length
      ? "Executar SAFE MODE e criar " + diff.length + " item(ns) que estão faltando?"
      : "O template já parece completo. Executar uma verificação SAFE MODE mesmo assim?";
    if (!await adminConfirm("Confirmar ação", text)) return;

    setBusy("queue");
    setNotice("");
    try {
      const response = await fetch("/api/admin/discord-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue_builder",
          guildId: worker?.guild_id || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.job) {
        if (payload.error === "BUILDER_JOB_ALREADY_ACTIVE") {
          setNotice("Já existe um Server Builder em fila ou execução.");
          return;
        }
        throw new Error("QUEUE_FAILED");
      }

      setNotice("Server Builder colocado na fila do Bot Core.");
      await load(true);
    } catch {
      setNotice("Não foi possível colocar o Server Builder na fila.");
    } finally {
      setBusy(null);
    }
  };

  const cancelJob = async (id: string) => {
    if (!await adminConfirm("Confirmar ação", "Cancelar este job do Server Builder?")) return;
    setBusy(id);
    try {
      const response = await fetch("/api/admin/discord-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_builder", id }),
      });
      if (!response.ok) throw new Error("CANCEL_FAILED");
      setNotice("Cancelamento solicitado.");
      await load(true);
    } catch {
      setNotice("Não foi possível cancelar o job.");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading" && !data) {
    return (
      <main className="crz-discord-core-state">
        <span className="crz-spinner" />
        <strong>Carregando Bot Core...</strong>
      </main>
    );
  }

  if (state === "auth") {
    return (
      <main className="crz-discord-core-state">
        <strong>Entre para continuar.</strong>
        <a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Fdiscord">
          Entrar
        </a>
      </main>
    );
  }

  if (state === "forbidden") {
    return <main className="crz-discord-core-state"><strong>Acesso de administrador necessário.</strong></main>;
  }

  if (state === "error" || !data) {
    return (
      <main className="crz-discord-core-state">
        <strong>Bot Core indisponível.</strong>
        <button type="button" onClick={() => void load()}>Tentar novamente</button>
      </main>
    );
  }

  const activeBuilderJob = data.jobs.find((job) => ["queued", "running"].includes(job.status));

  return (
    <main className="crz-discord-core">
      <div className="crz-container crz-discord-core__container">
        <PageHeader
          eyebrow="DISCORD • BOT CORE"
          title="1 bot. 1 token. Todo o ecossistema."
          description="Campanhas, Server Builder, cargos, notificações, suporte e segurança compartilham o mesmo worker Discloud e a mesma identidade Discord."
          actions={
            <div className="crz-discord-core-status">
              <i className={workerOnline ? "is-online" : "is-offline"} />
              <div>
                <strong>{workerOnline ? "BOT CORE ONLINE" : "BOT CORE OFFLINE"}</strong>
                <small>{worker?.bot_tag || "Aguardando worker"}</small>
              </div>
            </div>
          }
        />

        {notice && <div className="crz-discord-core-notice">{notice}</div>}

        <section className="crz-discord-core-stats">
          <article><small>WORKER</small><strong>{worker?.version || "—"}</strong><span>{worker?.worker_id || "—"}</span></article>
          <article><small>SERVIDOR</small><strong>{worker?.guild_name || "—"}</strong><span>{worker?.guild_id || "sem guild"}</span></article>
          <article><small>MEMBROS</small><strong>{worker?.member_count ?? "—"}</strong><span>{worker?.online_count ?? "—"} online</span></article>
          <article><small>CAMPANHAS</small><strong>{data.campaign_summary.running}</strong><span>{data.campaign_summary.queued} na fila</span></article>
        </section>

        <section className="crz-discord-core-modules">
          <a href="/admin/campanhas">
            <b>📨</b>
            <div><small>MÓDULO ATIVO</small><strong>Campaign Center</strong><span>DM, templates, preview, fila e histórico.</span></div>
            <em>ABRIR ›</em>
          </a>
          <article className="is-active">
            <b>🏗️</b>
            <div><small>MÓDULO ATIVO</small><strong>Server Builder</strong><span>SAFE MODE append-only controlado pelo site.</span></div>
            <em>AQUI</em>
          </article>
          <article>
            <b>🎭</b>
            <div><small>M44</small><strong>Discord Bridge</strong><span>Roles, grant/revoke, reconcile e retry.</span></div>
            <em>PRÓXIMO</em>
          </article>
          <article>
            <b>🔔</b>
            <div><small>M41</small><strong>Notify</strong><span>Compra, entrega, tutorial e alertas.</span></div>
            <em>PLANEJADO</em>
          </article>
        </section>

        <div className="crz-discord-builder-layout">
          <section className="crz-discord-builder-editor">
            <header>
              <div><small>SERVER BUILDER</small><strong>Editor de estrutura</strong></div>
              <Badge tone="green">SAFE MODE</Badge>
            </header>

            <div className="crz-discord-builder-theme">
              <label><span>Azul principal</span><input type="color" value={theme.primary || "#0000FF"} onChange={(event) => setTheme({ ...theme, primary: event.target.value.toUpperCase() })} /></label>
              <label><span>Azul secundário</span><input type="color" value={theme.secondary || "#1687FF"} onChange={(event) => setTheme({ ...theme, secondary: event.target.value.toUpperCase() })} /></label>
              <label><span>Accent</span><input type="color" value={theme.accent || "#00B7FF"} onChange={(event) => setTheme({ ...theme, accent: event.target.value.toUpperCase() })} /></label>
              <label className="is-wide"><span>Footer</span><input value={theme.footer || ""} onChange={(event) => setTheme({ ...theme, footer: event.target.value.slice(0, 120) })} /></label>
            </div>

            <div className="crz-discord-builder-categories">
              {template.categories.map((category, categoryIndex) => (
                <article key={categoryIndex}>
                  <header>
                    <input
                      value={category.name}
                      onChange={(event) => setCategory(categoryIndex, { name: event.target.value.slice(0, 100) })}
                    />
                    <button type="button" onClick={() => addChannel(categoryIndex)}>+ Canal</button>
                    <button type="button" className="is-danger" onClick={() => removeCategory(categoryIndex)}>×</button>
                  </header>

                  <div>
                    {category.channels.map((channel, channelIndex) => (
                      <div className="crz-discord-builder-channel" key={channelIndex}>
                        <span>#</span>
                        <input
                          value={channel.name}
                          onChange={(event) => updateChannel(categoryIndex, channelIndex, { name: event.target.value.slice(0, 100) })}
                        />
                        <button
                          type="button"
                          className={channel.readOnly ? "is-on" : ""}
                          onClick={() => updateChannel(categoryIndex, channelIndex, { readOnly: !channel.readOnly })}
                        >
                          {channel.readOnly ? "🔒 Somente leitura" : "💬 Normal"}
                        </button>
                        <button type="button" className="is-danger" onClick={() => removeChannel(categoryIndex, channelIndex)}>×</button>
                      </div>
                    ))}
                    {!category.channels.length && <p>Nenhum canal neste grupo.</p>}
                  </div>
                </article>
              ))}
            </div>

            <div className="crz-discord-builder-editor-actions">
              <button type="button" onClick={addCategory}>+ Categoria</button>
              <button type="button" onClick={() => void saveBuilder()} disabled={busy === "save"}>
                {busy === "save" ? "Salvando..." : "Salvar template"}
              </button>
            </div>
          </section>

          <aside className="crz-discord-builder-preview">
            <header>
              <div><small>PREVIEW / DIFF</small><strong>O que o Bot Core enxerga</strong></div>
              <Badge tone={diff.length ? "gold" : "green"}>
                {diff.length ? diff.length + " faltando" : "completo"}
              </Badge>
            </header>

            <div className="crz-discord-builder-tree">
              {template.categories.map((category, categoryIndex) => {
                const categoryMissing = diff.some((item) => item.type === "category" && item.name === category.name);
                return (
                  <section key={categoryIndex} className={categoryMissing ? "is-missing" : ""}>
                    <strong>{categoryMissing ? "＋" : "✓"} {category.name}</strong>
                    {category.channels.map((channel, channelIndex) => {
                      const channelMissing = diff.some(
                        (item) =>
                          item.type === "channel" &&
                          item.name === channel.name &&
                          item.category === category.name
                      );
                      return (
                        <span key={channelIndex} className={channelMissing ? "is-missing" : ""}>
                          {channelMissing ? "＋" : "✓"} {channel.name}
                          {channel.readOnly ? " 🔒" : ""}
                        </span>
                      );
                    })}
                  </section>
                );
              })}
            </div>

            <div className="crz-discord-builder-safety">
              <strong>🔒 SAFE MODE ABSOLUTO</strong>
              <span>Não apaga, renomeia, move ou altera permissões de recurso existente.</span>
              <span>O worker cria somente o que está faltando.</span>
            </div>

            <button
              type="button"
              className="crz-button crz-button--primary crz-button--md"
              disabled={busy === "queue" || !workerOnline || Boolean(activeBuilderJob)}
              onClick={() => void queueBuilder()}
            >
              {activeBuilderJob
                ? activeBuilderJob.status === "running"
                  ? "SERVER BUILDER EXECUTANDO..."
                  : "SERVER BUILDER NA FILA..."
                : "EXECUTAR SAFE MODE"}
            </button>
          </aside>
        </div>

        <section className="crz-discord-builder-history">
          <header>
            <div><small>HISTÓRICO</small><strong>Execuções do Server Builder</strong></div>
            <button type="button" onClick={() => void load(true)}>↻ Atualizar</button>
          </header>

          <div className="crz-discord-builder-history__table">
            <div className="crz-discord-builder-history__head">
              <span>Status</span><span>Job</span><span>Criados</span><span>Preservados</span><span>Início</span><span>Fim</span><span>Ação</span>
            </div>
            {data.jobs.map((job) => (
              <article key={job.id}>
                <span><Badge tone={statusTone(job.status)}>{job.status.toUpperCase()}</Badge></span>
                <span><strong>{job.id.slice(0, 8)}…</strong><small>{job.worker_id || "worker pendente"}</small></span>
                <span><strong>{job.created_count}</strong></span>
                <span><strong>{job.preserved_count}</strong></span>
                <span><strong>{formatDate(job.started_at || job.queued_at)}</strong></span>
                <span><strong>{formatDate(job.finished_at)}</strong></span>
                <span>
                  {["queued", "running"].includes(job.status) ? (
                    <button type="button" className="is-danger" disabled={busy === job.id} onClick={() => void cancelJob(job.id)}>
                      Cancelar
                    </button>
                  ) : job.last_error ? <small title={job.last_error}>Ver erro</small> : "—"}
                </span>
              </article>
            ))}
            {!data.jobs.length && <div className="crz-discord-builder-empty">Nenhuma execução ainda.</div>}
          </div>
        </section>
      </div>
    <VoiceSettings/></main>
  );
}
