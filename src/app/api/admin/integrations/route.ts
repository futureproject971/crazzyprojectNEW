import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMtSoundsRuntimeConfig, probeMtSounds } from "@/lib/mtsounds/config";

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

  const [payments, credentials, workers, mtSoundsHealth] = await Promise.all([
    supabase.from("payment_settings").select("method,label,enabled,updated_at").order("method"),
    supabase.from("system_credentials").select("env_key,value").in("env_key", ["DISCORD_GUILD_ID","LZT_MARKET_TOKEN"]),
    supabase.from("discord_campaign_worker_status").select("worker_id,connected,last_seen_at,guild_id,guild_name,bot_tag,version,last_error").order("last_seen_at",{ascending:false}).limit(1).maybeSingle(),
    probeMtSounds(mtSounds.url),
  ]);

  if (payments.error || credentials.error) {
    return NextResponse.json({ error: "INTEGRATION_STATUS_UNAVAILABLE" }, { status: 500 });
  }

  const configured = new Map(
    (credentials.data || []).map(item => [item.env_key, Boolean(String(item.value || "").trim())])
  );
  const worker = workers.data || null;
  const workerAge = worker?.last_seen_at ? Date.now() - new Date(worker.last_seen_at).getTime() : Infinity;
  const workerOnline = Boolean(worker?.connected && Number.isFinite(workerAge) && workerAge < 45_000);
  const paymentMap = new Map((payments.data || []).map(item => [item.method, item]));

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
        state: configured.get("DISCORD_GUILD_ID") ? "ready" : "missing",
        detail: configured.get("DISCORD_GUILD_ID")
          ? "Servidor oficial configurado para Auth, Bot Core e Bridge."
          : "DISCORD_GUILD_ID ainda não está configurado.",
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
        state: workerOnline ? "ready" : worker ? "offline" : "missing",
        detail: workerOnline && worker
          ? (worker.bot_tag || "Bot") + " online em " + (worker.guild_name || "guild oficial") + "."
          : worker
            ? "Worker conhecido, mas heartbeat está offline ou antigo."
            : "Nenhum heartbeat do worker foi recebido ainda.",
        meta: worker ? { version: worker.version, lastSeenAt: worker.last_seen_at, lastError: worker.last_error } : null,
      },
      {
        id: "mtsounds",
        name: "MT Sounds • Partner",
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
        state: configured.get("LZT_MARKET_TOKEN") ? "ready" : "missing",
        detail: configured.get("LZT_MARKET_TOKEN")
          ? "Credential cadastrada no cofre da aplicação."
          : "Token do fornecedor ainda não configurado.",
      },
      {
        id: "pix",
        name: "PurinCash • PIX",
        state: paymentMap.get("pix")?.enabled ? "enabled" : "disabled",
        detail: paymentMap.get("pix")?.enabled ? "Método liberado para checkout." : "Método desligado no fail-safe.",
      },
      {
        id: "card",
        name: "PurinCash • Cartão",
        state: paymentMap.get("card")?.enabled ? "enabled" : "disabled",
        detail: paymentMap.get("card")?.enabled ? "Método liberado para checkout." : "Método desligado no fail-safe.",
      },
      {
        id: "crypto",
        name: "PurinCash • Litecoin",
        state: paymentMap.get("crypto")?.enabled ? "enabled" : "disabled",
        detail: paymentMap.get("crypto")?.enabled ? "Método liberado para checkout." : "Método desligado no fail-safe.",
      },
    ],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
