"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, ConfirmDialog, PageHeader } from "@/core/design-system";
import { DiscordEmbedPreview, type DiscordEmbedDraft } from "./DiscordEmbedPreview";
import type {
  DiscordCampaign,
  DiscordCampaignCenterPayload,
  DiscordCampaignTarget,
  DiscordCampaignTemplate,
  DiscordWorkerRole,
} from "./types";

const emptyDraft: DiscordEmbedDraft = {
  title: "",
  description: "",
  imageUrl: "",
  thumbnailUrl: "",
  linkUrl: "",
  buttonLabel: "🛒 Acessar Loja",
  footerText: "CRAZZY PROJECT",
  colorHex: "#1687FF",
};

function toHex(value: number) {
  return "#" + Math.max(0, Math.min(0xffffff, Number(value) || 0))
    .toString(16)
    .padStart(6, "0")
    .toUpperCase();
}

function statusTone(status: DiscordCampaign["status"]): "green" | "blue" | "pink" | "gold" | "neutral" {
  if (status === "completed") return "green";
  if (status === "running") return "blue";
  if (status === "failed") return "pink";
  if (status === "queued") return "gold";
  return "neutral";
}

function statusLabel(status: DiscordCampaign["status"]) {
  if (status === "queued") return "NA FILA";
  if (status === "running") return "ENVIANDO";
  if (status === "completed") return "CONCLUÍDO";
  if (status === "cancelled") return "CANCELADO";
  return "FALHOU";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function templateToDraft(template: DiscordCampaignTemplate): DiscordEmbedDraft {
  return {
    title: template.title || "",
    description: template.description || "",
    imageUrl: template.image_url || "",
    thumbnailUrl: template.thumbnail_url || "",
    linkUrl: template.link_url || "",
    buttonLabel: template.button_label || "🛒 Acessar Loja",
    footerText: template.footer_text || "",
    colorHex: toHex(template.color),
  };
}

export function DiscordCampaignCenterPage() {
  const [data, setData] = useState<DiscordCampaignCenterPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [draft, setDraft] = useState<DiscordEmbedDraft>(emptyDraft);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<Exclude<DiscordCampaignTarget, "single">>("all");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<{kind:"delete-template"|"queue"|"cancel";description:string;campaignId?:string}|null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    try {
      const response = await fetch("/api/admin/discord-campaigns", { cache: "no-store" });
      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("LOAD_FAILED");

      setData(payload as DiscordCampaignCenterPayload);
      setState("ready");
    } catch {
      if (!silent) setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const worker = data?.workers?.[0] || null;
  const roles = useMemo<DiscordWorkerRole[]>(
    () => [...(worker?.roles || [])].sort((a, b) => (b.position || 0) - (a.position || 0)),
    [worker]
  );
  const workerOnline = useMemo(() => {
    if (!worker?.connected) return false;
    const age = Date.now() - new Date(worker.last_seen_at).getTime();
    return Number.isFinite(age) && age < 45000;
  }, [worker]);

  const estimated = useMemo(() => {
    if (!worker) return null;
    if (targetMode === "all") return Math.max(0, worker.member_count - 1);
    if (targetMode === "online") return worker.online_count;
    const role = roles.find((item) => item.id === targetRoleId);
    return role?.member_count ?? null;
  }, [roles, targetMode, targetRoleId, worker]);

  const campaigns = data?.campaigns || [];
  const templates = data?.templates || [];

  const selectTemplate = (template: DiscordCampaignTemplate) => {
    setTemplateId(template.id);
    setTemplateName(template.name);
    setDraft(templateToDraft(template));
    setNotice("Template carregado no editor.");
  };

  const resetTemplate = () => {
    setTemplateId(null);
    setTemplateName("");
    setDraft(emptyDraft);
    setNotice("");
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || busy) return;
    setBusy("save-template");
    try {
      const response = await fetch("/api/admin/discord-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_template",
          id: templateId,
          name: templateName,
          title: draft.title,
          description: draft.description,
          imageUrl: draft.imageUrl,
          thumbnailUrl: draft.thumbnailUrl,
          linkUrl: draft.linkUrl,
          buttonLabel: draft.buttonLabel,
          footerText: draft.footerText,
          colorHex: draft.colorHex,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.template) throw new Error("SAVE_FAILED");
      setTemplateId(payload.template.id);
      setNotice("Template salvo.");
      await load(true);
    } catch {
      setNotice("Não foi possível salvar o template. Revise os campos.");
    } finally {
      setBusy(null);
    }
  };

  const deleteTemplate = async (confirmed = false) => {
    if (!templateId) return;
    if (!confirmed) {
      setConfirmAction({kind:"delete-template",description:"Excluir este template? O histórico antigo continuará salvo e nenhum disparo antigo será apagado."});
      return;
    }
    setBusy("delete-template");
    try {
      const response = await fetch(
        "/api/admin/discord-campaigns?templateId=" + encodeURIComponent(templateId),
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("DELETE_FAILED");
      resetTemplate();
      setNotice("Template excluído.");
      await load(true);
    } catch {
      setNotice("Não foi possível excluir o template.");
    } finally {
      setBusy(null);
    }
  };

  const queue = async (testMe = false, confirmed = false) => {
    if (busy) return;
    if (!draft.title.trim() && !draft.description.trim()) {
      setNotice("Preencha título ou descrição.");
      return;
    }
    if (!testMe && targetMode === "role" && !targetRoleId) {
      setNotice("Escolha um cargo.");
      return;
    }
    if (testMe && !data?.admin_discord_user_id) {
      setNotice("Sua conta do site precisa estar vinculada ao Discord para receber o teste.");
      return;
    }

    if (!testMe && !confirmed) {
      const targetText = estimated == null ? "o público selecionado" : "aprox. " + estimated + " membro(s)";
      setConfirmAction({kind:"queue",description:"Adicionar este disparo à fila para " + targetText + "? Você poderá acompanhar o progresso no histórico."});
      return;
    }

    setBusy(testMe ? "test" : "send");
    try {
      let schedule: string | null = null;
      if (!testMe && scheduleEnabled && scheduledFor) {
        schedule = new Date(scheduledFor).toISOString();
      }

      const response = await fetch("/api/admin/discord-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue_campaign",
          templateId,
          title: draft.title,
          description: draft.description,
          imageUrl: draft.imageUrl,
          thumbnailUrl: draft.thumbnailUrl,
          linkUrl: draft.linkUrl,
          buttonLabel: draft.buttonLabel,
          footerText: draft.footerText,
          colorHex: draft.colorHex,
          targetMode,
          targetRoleId: targetMode === "role" ? targetRoleId : null,
          testMe,
          guildId: worker?.guild_id || null,
          scheduledFor: schedule,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "QUEUE_FAILED");
      setNotice(testMe ? "Teste colocado na fila para sua DM." : "Campanha colocada na fila.");
      await load(true);
    } catch {
      setNotice("Não foi possível colocar o disparo na fila.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (campaignId: string, confirmed = false) => {
    if (!confirmed) {
      setConfirmAction({kind:"cancel",campaignId,description:"Cancelar este disparo? Mensagens já enviadas não podem ser recolhidas, mas novos envios serão interrompidos."});
      return;
    }
    setBusy(campaignId);
    try {
      const response = await fetch("/api/admin/discord-campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_campaign", id: campaignId }),
      });
      if (!response.ok) throw new Error("CANCEL_FAILED");
      setNotice("Cancelamento solicitado.");
      await load(true);
    } catch {
      setNotice("Não foi possível cancelar o disparo.");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading" && !data) {
    return <main className="crz-discord-campaign-state"><span className="crz-spinner" /><strong>Carregando campanhas...</strong></main>;
  }

  if (state === "auth") {
    return <main className="crz-discord-campaign-state"><strong>Entre para continuar.</strong><a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Fcampanhas">Entrar</a></main>;
  }

  if (state === "forbidden") {
    return <main className="crz-discord-campaign-state"><strong>Acesso de administrador necessário.</strong></main>;
  }

  if (state === "error" || !data) {
    return <main className="crz-discord-campaign-state"><strong>Campaign Center indisponível.</strong><button type="button" onClick={() => void load()}>Tentar novamente</button></main>;
  }

  return (
    <main className="crz-discord-campaigns">
      <div className="crz-container crz-discord-campaigns__container">
        <PageHeader
          eyebrow="DISCORD • CAMPAIGN CENTER"
          title="Edite, visualize e dispare pelo site"
          description="O site controla templates e fila; o bot único CRAZZY PROJECT executa na Discloud."
          actions={
            <div className="crz-discord-worker-pill">
              <span className={workerOnline ? "is-online" : "is-offline"} />
              <div>
                <strong>{workerOnline ? "BOT ONLINE" : "BOT OFFLINE"}</strong>
                <small>{worker?.guild_name || "Aguardando worker"}</small>
              </div>
            </div>
          }
        />

        {notice && <div className="crz-discord-campaign-notice">{notice}</div>}

        <section className="crz-discord-campaign-stats">
          <article><small>MEMBROS</small><strong>{worker?.member_count ?? "—"}</strong><span>servidor</span></article>
          <article><small>ONLINE</small><strong>{worker?.online_count ?? "—"}</strong><span>presença</span></article>
          <article><small>NA FILA</small><strong>{campaigns.filter((item) => item.status === "queued").length}</strong><span>aguardando</span></article>
          <article><small>ENVIANDO</small><strong>{campaigns.filter((item) => item.status === "running").length}</strong><span>agora</span></article>
        </section>

        <section className="crz-discord-campaign-workspace">
          <div className="crz-discord-campaign-editor">
            <header>
              <div><small>EDITOR</small><strong>Mensagem / Embed</strong></div>
              <button type="button" onClick={resetTemplate}>+ Novo</button>
            </header>

            <div className="crz-discord-template-row">
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value.slice(0, 80))}
                placeholder="Nome do template"
              />
              <button type="button" onClick={() => void saveTemplate()} disabled={busy === "save-template" || !templateName.trim()}>
                {busy === "save-template" ? "Salvando..." : "Salvar template"}
              </button>
              {templateId && <button type="button" className="is-danger" onClick={() => void deleteTemplate()}>Excluir</button>}
            </div>

            <label><span>Título</span><input value={draft.title} maxLength={256} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título da embed" /></label>
            <label><span>Descrição</span><textarea value={draft.description} maxLength={4096} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Mensagem da campanha..." /></label>

            <div className="crz-discord-editor-grid">
              <label><span>Imagem principal</span><input value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://..." /></label>
              <label><span>Thumbnail</span><input value={draft.thumbnailUrl} onChange={(e) => setDraft({ ...draft, thumbnailUrl: e.target.value })} placeholder="https://..." /></label>
              <label><span>Link do botão</span><input value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} placeholder="https://..." /></label>
              <label><span>Texto do botão</span><input value={draft.buttonLabel} maxLength={80} onChange={(e) => setDraft({ ...draft, buttonLabel: e.target.value })} /></label>
              <label><span>Footer</span><input value={draft.footerText} onChange={(e) => setDraft({ ...draft, footerText: e.target.value })} /></label>
              <label className="crz-discord-color-field"><span>Cor</span><div><input type="color" value={draft.colorHex} onChange={(e) => setDraft({ ...draft, colorHex: e.target.value.toUpperCase() })} /><input value={draft.colorHex} maxLength={7} onChange={(e) => setDraft({ ...draft, colorHex: e.target.value.toUpperCase() })} /></div></label>
            </div>

            <section className="crz-discord-target-box">
              <header><small>PÚBLICO</small><strong>Quem recebe?</strong></header>
              <div className="crz-discord-target-options">
                <button type="button" className={targetMode === "all" ? "is-active" : ""} onClick={() => setTargetMode("all")}>👥 Todos</button>
                <button type="button" className={targetMode === "online" ? "is-active" : ""} onClick={() => setTargetMode("online")}>🟢 Online</button>
                <button type="button" className={targetMode === "role" ? "is-active" : ""} onClick={() => setTargetMode("role")}>🏷 Cargo</button>
              </div>

              {targetMode === "role" && (
                <select value={targetRoleId} onChange={(e) => setTargetRoleId(e.target.value)}>
                  <option value="">Selecione um cargo</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}{typeof role.member_count === "number" ? " • " + role.member_count : ""}</option>)}
                </select>
              )}

              <div className="crz-discord-estimate">
                <span>Estimativa</span>
                <strong>{estimated == null ? "—" : estimated}</strong>
                <small>destinatários antes de exclusões/falhas de DM</small>
              </div>

              <button type="button" className={scheduleEnabled ? "crz-discord-schedule is-active" : "crz-discord-schedule"} onClick={() => setScheduleEnabled((value) => !value)}>
                🕒 {scheduleEnabled ? "Agendamento ligado" : "Enviar agora"}
              </button>

              {scheduleEnabled && <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />}

              <div className="crz-discord-send-actions">
                <button type="button" onClick={() => void queue(true)} disabled={busy === "test" || !data.admin_discord_user_id}>🧪 Testar na minha DM</button>
                <button type="button" className="is-primary" onClick={() => void queue(false)} disabled={busy === "send" || !workerOnline}>📤 {scheduleEnabled ? "Agendar campanha" : "Colocar na fila"}</button>
              </div>
            </section>
          </div>

          <DiscordEmbedPreview draft={draft} />

          <aside className="crz-discord-template-list">
            <header><small>TEMPLATES</small><strong>{templates.length}</strong></header>
            {templates.length === 0 ? <p>Nenhum template salvo.</p> : templates.map((template) => (
              <button type="button" key={template.id} className={template.id === templateId ? "is-active" : ""} onClick={() => selectTemplate(template)}>
                <span style={{ backgroundColor: toHex(template.color) }} />
                <div><strong>{template.name}</strong><small>{template.title || "Sem título"}</small></div>
              </button>
            ))}
          </aside>
        </section>

        <section className="crz-discord-campaign-history">
          <header>
            <div><small>FILA + HISTÓRICO</small><strong>Disparos recentes</strong></div>
            <button type="button" onClick={() => void load(true)}>↻ Atualizar</button>
          </header>

          <div className="crz-discord-campaign-table">
            <div className="crz-discord-campaign-table__head">
              <span>Status</span><span>Mensagem</span><span>Público</span><span>Progresso</span><span>Resultado</span><span>Quando</span><span>Ação</span>
            </div>
            {campaigns.map((campaign) => {
              const percent = campaign.total_recipients > 0
                ? Math.min(100, Math.round((campaign.processed_count / campaign.total_recipients) * 100))
                : 0;
              return (
                <article key={campaign.id}>
                  <span><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status)}</Badge></span>
                  <span><strong>{campaign.title || "Sem título"}</strong><small>{campaign.description.slice(0, 70) || "—"}</small></span>
                  <span><strong>{campaign.target_mode === "all" ? "Todos" : campaign.target_mode === "online" ? "Online" : campaign.target_mode === "single" ? "Teste" : "Cargo"}</strong></span>
                  <span className="crz-discord-progress"><div><i style={{ width: percent + "%" }} /></div><small>{campaign.processed_count}/{campaign.total_recipients || "?"} • {percent}%</small></span>
                  <span><strong className="is-success">{campaign.success_count} OK</strong><small>{campaign.failed_count} falhas • {campaign.skipped_count} pulados</small></span>
                  <span><strong>{formatDate(campaign.scheduled_for)}</strong><small>{campaign.worker_id || "worker pendente"}</small></span>
                  <span>{(campaign.status === "queued" || campaign.status === "running") ? <button type="button" className="is-danger" disabled={busy === campaign.id} onClick={() => void cancel(campaign.id)}>Cancelar</button> : "—"}</span>
                </article>
              );
            })}
            {campaigns.length === 0 && <div className="crz-discord-campaign-empty">Nenhum disparo ainda.</div>}
          </div>
        </section>
        <ConfirmDialog
          open={Boolean(confirmAction)}
          title={confirmAction?.kind==="delete-template"?"Excluir template":confirmAction?.kind==="cancel"?"Cancelar disparo":"Confirmar campanha"}
          description={confirmAction?.description||""}
          confirmLabel={confirmAction?.kind==="delete-template"?"Excluir":confirmAction?.kind==="cancel"?"Cancelar disparo":"Colocar na fila"}
          danger={confirmAction?.kind==="delete-template"||confirmAction?.kind==="cancel"}
          onClose={()=>setConfirmAction(null)}
          onConfirm={()=>{
            const action=confirmAction;
            if(!action)return;
            if(action.kind==="delete-template")void deleteTemplate(true);
            if(action.kind==="queue")void queue(false,true);
            if(action.kind==="cancel"&&action.campaignId)void cancel(action.campaignId,true);
          }}
        />
      </div>
    </main>
  );
}
