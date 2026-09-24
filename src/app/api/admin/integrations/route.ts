import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMtSoundsRuntimeConfig, probeMtSounds } from "@/lib/mtsounds/config";
import { checkoutEdgeUrl } from "@/app/api/checkout/_shared";

function bool(value: string | undefined) {
  return Boolean(value && value.trim());
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const mtSounds = getMtSoundsRuntimeConfig();

  const [payments, credentials, workers, mtSoundsHealth, checkoutHealth] = await Promise.all([
    supabase.from("payment_settings").select("method,label,enabled,updated_at").order("method"),
    supabase.from("system_credentials").select("env_key,value").in("env_key", ["DISCORD_GUILD_ID","DISCORD_INVITE_URL","LZT_MARKET_TOKEN"]),
    supabase.from("discord_campaign_worker_status").select("worker_id,connected,last_seen_at,guild_id,guild_name,bot_tag,version,last_error").order("last_seen_at",{ascending:false}).limit(1).maybeSingle(),
    probeMtSounds(mtSounds.url),
    fetch(checkoutEdgeUrl("config"), { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async response => response.ok ? await response.json() : null)
      .catch(() => null),
  ]);

  // Configurações opcionais nunca derrubam a tela inteira.
  // Cada integração reporta o próprio estado mesmo se uma tabela/serviço estiver indisponível.
  const paymentSettingsReadable = !payments.error;
  const credentialsReadable = !credentials.error;
  const workerStatusReadable = !workers.error;

  const configured = new Map(
    (credentials.data || []).map(item => [item.env_key, Boolean(String(item.value || "").trim())])
  );
  const worker = workerStatusReadable ? (workers.data || null) : null;
  const workerAge = worker?.last_seen_at ? Date.now() - new Date(worker.last_seen_at).getTime() : Infinity;
  const workerOnline = Boolean(worker?.connected && Number.isFinite(workerAge) && workerAge < 45_000);
  const paymentMap = new Map((payments.data || []).map(item => [item.method, item]));
  const purinCashReady = checkoutHealth?.ready === true;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    integrations: [
      {
        id: "supabase",
        name: "Supabase",
        state: "ready",
        detail: "Projeto conectado e sessão administrativa validada.",
      },
      {
        id: "discord-guild",
        name: "Discord • Guild oficial",
        state: !credentialsReadable ? "offline" : configured.get("DISCORD_GUILD_ID") ? "ready" : "missing",
        detail: !credentialsReadable
          ? "O painel não conseguiu ler o cofre de configurações agora. As demais integrações continuam disponíveis."
          : configured.get("DISCORD_GUILD_ID")
            ? "Servidor oficial configurado para Auth, Bot Core e Bridge."
            : "DISCORD_GUILD_ID ainda não está configurado.",
      },
      {
        id: "discord-invite",
        name: "Discord • Convite oficial",
        state: !credentialsReadable ? "offline" : configured.get("DISCORD_INVITE_URL") ? "ready" : "missing",
        detail: !credentialsReadable
          ? "O convite não pôde ser verificado porque o cofre de configurações está temporariamente indisponível."
          : configured.get("DISCORD_INVITE_URL")
            ? "Convite oficial configurado para o gate de entrada no servidor."
            : "Configure um convite discord.gg ou discord.com/invite para concluir o gate.",
      },
      {
        id: "discord-oauth",
        name: "Discord • OAuth",
        state: process.env.NEXT_PUBLIC_ENABLE_DISCORD_AUTH === "true" ? "partial" : "missing",
        detail:
          process.env.NEXT_PUBLIC_ENABLE_DISCORD_AUTH === "true"
            ? "Frontend habilitado. Client ID/Secret e callbacks do provedor precisam estar configurados no Supabase/Discord."
            : "NEXT_PUBLIC_ENABLE_DISCORD_AUTH não está ativo neste ambiente.",
      },
      {
        id: "livekit",
        name: "LiveKit • CRAZZY CALL",
        state:
          bool(process.env.NEXT_PUBLIC_LIVEKIT_URL) &&
          bool(process.env.LIVEKIT_API_KEY) &&
          bool(process.env.LIVEKIT_API_SECRET)
            ? "ready"
            : bool(process.env.NEXT_PUBLIC_LIVEKIT_URL)
              ? "partial"
              : "missing",
        detail: "URL pública + API key + secret são necessários para voz, vídeo e compartilhamento.",
      },
      {
        id: "discord-worker",
        name: "Discord Bot Core",
        state: !workerStatusReadable ? "offline" : workerOnline ? "ready" : worker ? "offline" : "missing",
        detail: !workerStatusReadable
          ? "Não foi possível consultar o heartbeat do Bot Core agora."
          : workerOnline && worker
            ? (worker.bot_tag || "Bot") + " online em " + (worker.guild_name || "guild oficial") + "."
            : worker
              ? "Worker conhecido, mas heartbeat está offline ou antigo."
              : "Nenhum heartbeat do worker foi recebido ainda.",
        meta: worker ? { version: worker.version, lastSeenAt: worker.last_seen_at, lastError: worker.last_error } : null,
      },
      {
        id: "mtsounds",
        name: "MTSOUNDS • Partner",
        state: mtSoundsHealth.reachable ? "ready" : "offline",
        detail: mtSoundsHealth.reachable
          ? "Parceiro respondeu em " + mtSoundsHealth.latencyMs + "ms • modo " + mtSounds.mode + "."
          : "Parceiro não respondeu ao health check. A rota CRAZZY mantém fallback para abertura externa.",
        meta: {
          mode: mtSounds.mode,
          source: mtSounds.source,
          httpStatus: mtSoundsHealth.status,
          latencyMs: mtSoundsHealth.latencyMs,
        },
      },
      {
        id: "lzt",
        name: "LZT Market",
        state: !credentialsReadable ? "offline" : configured.get("LZT_MARKET_TOKEN") ? "ready" : "missing",
        detail: !credentialsReadable
          ? "O estado da credencial não pôde ser consultado agora."
          : configured.get("LZT_MARKET_TOKEN")
            ? "Credential cadastrada no cofre da aplicação."
            : "Token do fornecedor ainda não configurado.",
      },
      {
        id: "purincash-core",
        name: "PurinCash • Backend",
        state: purinCashReady ? "ready" : "missing",
        detail: purinCashReady
          ? "API key, assinatura de checkout e webhook estão configurados no backend."
          : "Backend PurinCash ainda não confirmou API key + signing secret + webhook secret.",
        meta: checkoutHealth ? { cardGate: checkoutHealth.cardGate === true } : null,
      },
      {
        id: "pix",
        name: "PurinCash • PIX",
        state: !paymentSettingsReadable ? "offline" : paymentMap.get("pix")?.enabled ? (purinCashReady ? "enabled" : "partial") : "disabled",
        detail: !paymentSettingsReadable
          ? "Não foi possível consultar a configuração do PIX agora."
          : paymentMap.get("pix")?.enabled
            ? (purinCashReady ? "Método liberado para checkout." : "Método marcado como ativo, mas backend PurinCash ainda não está pronto.")
            : "Método desligado no fail-safe.",
      },
      {
        id: "card",
        name: "PurinCash • Cartão",
        state: paymentMap.get("card")?.enabled ? (purinCashReady && checkoutHealth?.cardGate === true ? "enabled" : "partial") : "disabled",
        detail: paymentMap.get("card")?.enabled
          ? (purinCashReady && checkoutHealth?.cardGate === true ? "Método liberado para checkout." : "Cartão requer backend pronto e card gate habilitado.")
          : "Método desligado no fail-safe.",
      },
      {
        id: "crypto",
        name: "PurinCash • Litecoin",
        state: paymentMap.get("crypto")?.enabled ? (purinCashReady ? "enabled" : "partial") : "disabled",
        detail: paymentMap.get("crypto")?.enabled
          ? (purinCashReady ? "Método liberado para checkout." : "Método marcado como ativo, mas backend PurinCash ainda não está pronto.")
          : "Método desligado no fail-safe.",
      },
    ],
  }, { headers: { "Cache-Control": "private, no-store" } });
}


export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "set_discord_invite") {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }

  const inviteUrl = String(body?.inviteUrl || "").trim();
  const { data, error } = await supabase.rpc("admin_set_discord_invite_url", {
    p_invite_url: inviteUrl,
  });
  if (error) {
    return NextResponse.json(
      { error: "INVALID_DISCORD_INVITE", detail: String(error.message || "").slice(0, 160) },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: data === true });
}
