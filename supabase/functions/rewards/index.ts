import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function supabaseSecret() {
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function getCaller(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(authHeader.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

async function isAdmin(admin: any, userId: string) {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function randomToken(bytes = 18) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, "0")).join("");
}

function campaignWatchConfig(campaign: any) {
  const requirements = campaign?.requirements && typeof campaign.requirements === "object"
    ? campaign.requirements
    : {};
  return {
    attentionCheckpoint: requirements.attention_checkpoint !== false,
    checkpointMinPercent: clampNumber(requirements.checkpoint_min_percent, 45, 20, 80),
    checkpointMaxPercent: clampNumber(requirements.checkpoint_max_percent, 65, 25, 90),
    maxPlaybackRate: clampNumber(requirements.max_playback_rate, 1.25, 1, 2),
    heartbeatNonce: requirements.heartbeat_nonce !== false,
  };
}

function buildWatchGuard(campaign: any) {
  const required = Math.max(1, Number(campaign?.required_watch_seconds || 1));
  const config = campaignWatchConfig(campaign);
  const minPercent = Math.min(config.checkpointMinPercent, config.checkpointMaxPercent);
  const maxPercent = Math.max(config.checkpointMinPercent, config.checkpointMaxPercent);
  const chosenPercent = minPercent + Math.random() * Math.max(0, maxPercent - minPercent);
  const checkpointEnabled = config.attentionCheckpoint && required >= 5;
  const checkpointAt = checkpointEnabled
    ? Math.min(Math.max(2, required * (chosenPercent / 100)), required - 1)
    : null;

  return {
    version: 1,
    checkpoint_enabled: checkpointEnabled,
    checkpoint_at_seconds: checkpointAt,
    checkpoint_active: false,
    checkpoint_passed: !checkpointEnabled,
    checkpoint_nonce: null,
    checkpoint_passed_at: null,
    next_heartbeat_nonce: randomToken(),
    seek_violations: 0,
    playback_violations: 0,
    replay_violations: 0,
  };
}

async function ensureWatchGuard(admin: any, session: any, campaign: any) {
  const completed = session?.requirements_completed && typeof session.requirements_completed === "object"
    ? { ...session.requirements_completed }
    : {};
  const existing = completed.watch_guard;
  if (existing?.version === 1 && existing?.next_heartbeat_nonce) {
    return { session, requirements: completed, guard: { ...existing } };
  }

  const guard = buildWatchGuard(campaign);
  if (session?.status && session.status !== "watching") {
    guard.checkpoint_active = false;
    guard.checkpoint_passed = true;
    guard.checkpoint_nonce = null;
  }
  const requirements = { ...completed, watch_guard: guard };
  const { data: updated, error } = await admin
    .from("reward_sessions")
    .update({ requirements_completed: requirements, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { session: { ...session, requirements_completed: requirements }, requirements, guard };
  }
  return { session: updated, requirements, guard };
}

async function getCampaignProduct(admin: any, id: string) {
  const { data: cp, error } = await admin
    .from("reward_campaign_products")
    .select("id,campaign_id,product_id,product_plan_id,trial_duration_minutes,delivery_mode,auto_delay_seconds,active")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error || !cp) return null;

  const [{ data: campaign }, { data: product }, { data: plan }] = await Promise.all([
    admin.from("reward_campaigns").select("id,title,description,video_url,video_provider,required_watch_seconds,cooldown_hours,requirements,active").eq("id", cp.campaign_id).eq("active", true).maybeSingle(),
    admin.from("products").select("id,name,image_url,active").eq("id", cp.product_id).eq("active", true).maybeSingle(),
    cp.product_plan_id
      ? admin.from("product_plans").select("id,name,active").eq("id", cp.product_plan_id).eq("active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!campaign || !product) return null;
  if (cp.product_plan_id && !plan) return null;
  return { ...cp, campaign, product, plan };
}

async function claimTrialStock(admin: any, planId: string, userId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: candidates, error } = await admin
      .from("trial_stock_items")
      .select("id,content,duration_minutes")
      .eq("product_plan_id", planId)
      .eq("used", false)
      .order("created_at", { ascending: true })
      .limit(5);
    if (error || !candidates?.length) return null;

    for (const candidate of candidates) {
      const { data: claimed } = await admin
        .from("trial_stock_items")
        .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
        .eq("id", candidate.id)
        .eq("used", false)
        .select("id,content,duration_minutes")
        .maybeSingle();
      if (claimed) return claimed;
    }
  }
  return null;
}

async function maybeAutoDeliver(admin: any, session: any) {
  if (!session || session.status !== "requested") return session;
  const cp = await getCampaignProduct(admin, session.campaign_product_id);
  if (!cp || cp.delivery_mode !== "automatic") return session;
  const eligibleAt = session.eligible_delivery_at ? new Date(session.eligible_delivery_at).getTime() : 0;
  if (eligibleAt > Date.now() || !session.product_plan_id) return session;

  const { data: locked } = await admin
    .from("reward_sessions")
    .update({ status: "delivering", updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "requested")
    .select("*")
    .maybeSingle();
  if (!locked) return session;

  // A prior process may have written the delivery and crashed before flipping the session
  // to delivered. Reconcile that state before consuming another trial key.
  const { data: existingDelivery } = await admin
    .from("reward_deliveries")
    .select("id,delivered_at,expires_at")
    .eq("session_id", session.id)
    .maybeSingle();
  if (existingDelivery) {
    await admin.from("reward_sessions").update({
      status: "delivered",
      delivered_at: existingDelivery.delivered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", session.id).eq("status", "delivering");
    return { ...locked, status: "delivered", delivered_at: existingDelivery.delivered_at };
  }

  const stock = await claimTrialStock(admin, session.product_plan_id, session.user_id);
  if (!stock) {
    await admin.from("reward_sessions").update({ status: "requested", updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "delivering");
    return { ...session, delivery_pending_stock: true };
  }

  const duration = Number(cp.trial_duration_minutes || stock.duration_minutes || 60);
  const deliveredAt = new Date();
  const expiresAt = new Date(deliveredAt.getTime() + duration * 60_000);

  const { error: deliveryError } = await admin.from("reward_deliveries").insert({
    session_id: session.id,
    user_id: session.user_id,
    trial_stock_item_id: stock.id,
    content: stock.content,
    delivery_mode: "automatic",
    delivered_at: deliveredAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (deliveryError) {
    // Never burn an inventory item when the delivery row was not created. A duplicate
    // means another process won the race, while any other error should be retried later.
    await admin.from("trial_stock_items").update({
      used: false, used_by: null, used_at: null,
    }).eq("id", stock.id).eq("used_by", session.user_id);

    if (deliveryError.code === "23505") {
      const { data: duplicateDelivery } = await admin
        .from("reward_deliveries")
        .select("delivered_at")
        .eq("session_id", session.id)
        .maybeSingle();
      await admin.from("reward_sessions").update({
        status: "delivered",
        delivered_at: duplicateDelivery?.delivered_at || deliveredAt.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", session.id).eq("status", "delivering");
      return { ...locked, status: "delivered", delivered_at: duplicateDelivery?.delivered_at || deliveredAt.toISOString() };
    }

    await admin.from("reward_sessions").update({ status: "requested", updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "delivering");
    return session;
  }

  await admin.from("reward_sessions").update({
    status: "delivered",
    delivered_at: deliveredAt.toISOString(),
    cooldown_until: new Date(deliveredAt.getTime() + Number(cp.campaign.cooldown_hours || 0) * 3_600_000).toISOString(),
    updated_at: deliveredAt.toISOString(),
  }).eq("id", session.id);
  return { ...locked, status: "delivered", delivered_at: deliveredAt.toISOString() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "catalog";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secret = supabaseSecret();
  if (!supabaseUrl || !secret) return json({ error: "Supabase backend secrets not configured" }, 500);
  const admin = createClient(supabaseUrl, secret);

  if (action === "catalog" && req.method === "GET") {
    const { data: campaigns, error } = await admin
      .from("reward_campaigns")
      .select("id,title,description,video_url,video_provider,required_watch_seconds,cooldown_hours,requirements,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return json({ error: error.message }, 500);

    const campaignIds = (campaigns || []).map((x: any) => x.id);
    const { data: cps } = campaignIds.length
      ? await admin.from("reward_campaign_products").select("id,campaign_id,product_id,product_plan_id,trial_duration_minutes,delivery_mode,auto_delay_seconds,sort_order").in("campaign_id", campaignIds).eq("active", true).order("sort_order", { ascending: true })
      : { data: [] };
    const productIds = [...new Set((cps || []).map((x: any) => x.product_id))];
    const planIds = [...new Set((cps || []).map((x: any) => x.product_plan_id).filter(Boolean))];
    const [{ data: products }, { data: plans }] = await Promise.all([
      productIds.length ? admin.from("products").select("id,name,image_url").in("id", productIds) : Promise.resolve({ data: [] }),
      planIds.length ? admin.from("product_plans").select("id,name").in("id", planIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap = new Map((products || []).map((x: any) => [x.id, x]));
    const planMap = new Map((plans || []).map((x: any) => [x.id, x]));
    return json({ campaigns: (campaigns || []).map((campaign: any) => ({
      ...campaign,
      products: (cps || []).filter((cp: any) => cp.campaign_id === campaign.id).map((cp: any) => ({
        ...cp,
        product: pMap.get(cp.product_id) || null,
        plan: cp.product_plan_id ? planMap.get(cp.product_plan_id) || null : null,
      })).filter((cp: any) => cp.product),
    })) });
  }

  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  if (action === "start" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const cp = await getCampaignProduct(admin, String(body?.campaign_product_id || ""));
    if (!cp) return json({ error: "Recompensa indisponível" }, 404);

    const { data: active } = await admin.from("reward_sessions").select("*").eq("user_id", caller.id).eq("campaign_id", cp.campaign_id).in("status", ["watching", "completed", "requested", "delivering"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (active) {
      const guarded = await ensureWatchGuard(admin, active, cp.campaign);
      return json({ session: guarded.session, resumed: true });
    }

    const { data: recent } = await admin.from("reward_sessions").select("cooldown_until").eq("user_id", caller.id).eq("campaign_id", cp.campaign_id).not("cooldown_until", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent?.cooldown_until && new Date(recent.cooldown_until).getTime() > Date.now()) return json({ error: "Você já usou esta recompensa recentemente", cooldown_until: recent.cooldown_until }, 429);

    const requirements_completed = {
      watch_guard: buildWatchGuard(cp.campaign),
    };
    const { data: session, error } = await admin.from("reward_sessions").insert({
      user_id: caller.id,
      campaign_id: cp.campaign_id,
      campaign_product_id: cp.id,
      product_id: cp.product_id,
      product_plan_id: cp.product_plan_id,
      status: "watching",
      requirements_completed,
    }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    return json({ session }, 201);
  }

  if (action === "heartbeat" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const visible = body?.visible === true;
    const playing = body?.playing === true;
    const position = Number(body?.position);
    const playbackRate = clampNumber(body?.playback_rate, 1, 0.25, 4);
    const heartbeatNonce = String(body?.heartbeat_nonce || "");
    if (!sessionId || !Number.isFinite(position) || position < 0) return json({ error: "Heartbeat inválido" }, 400);

    const { data: rawSession } = await admin.from("reward_sessions").select("*").eq("id", sessionId).eq("user_id", caller.id).maybeSingle();
    if (!rawSession) return json({ error: "Sessão não encontrada" }, 404);
    if (rawSession.status !== "watching") return json({ session: rawSession });

    const cp = await getCampaignProduct(admin, rawSession.campaign_product_id);
    if (!cp) return json({ error: "Campanha indisponível" }, 409);

    const guarded = await ensureWatchGuard(admin, rawSession, cp.campaign);
    const session = guarded.session;
    const requirements = { ...guarded.requirements };
    const guard = { ...guarded.guard };
    const config = campaignWatchConfig(cp.campaign);
    const now = new Date();
    const requiredSeconds = Math.max(1, Number(cp.campaign.required_watch_seconds || 1));
    const lastHeartbeatMs = session.last_heartbeat_at ? new Date(session.last_heartbeat_at).getTime() : 0;
    const elapsed = lastHeartbeatMs ? Math.max(0, (now.getTime() - lastHeartbeatMs) / 1000) : 0;
    const startedAtMs = session.started_at ? new Date(session.started_at).getTime() : new Date(session.created_at).getTime();
    const wallElapsed = Math.max(0, (now.getTime() - startedAtMs) / 1000);
    const previousPosition = Number(session.last_video_position ?? position);
    const forward = Math.max(0, position - previousPosition);

    if (config.heartbeatNonce && guard.next_heartbeat_nonce && heartbeatNonce !== guard.next_heartbeat_nonce) {
      guard.replay_violations = Number(guard.replay_violations || 0) + 1;
      guard.next_heartbeat_nonce = randomToken();
      requirements.watch_guard = guard;
      const { data: resynced } = await admin.from("reward_sessions").update({
        requirements_completed: requirements,
        last_heartbeat_at: now.toISOString(),
        heartbeat_count: Number(session.heartbeat_count || 0) + 1,
        updated_at: now.toISOString(),
      }).eq("id", session.id).eq("user_id", caller.id).select("*").single();
      return json({
        session: resynced || { ...session, requirements_completed: requirements },
        accepted: false,
        reason: "heartbeat_resync",
        required_watch_seconds: requiredSeconds,
      });
    }

    const heartbeatWindowValid = elapsed > 0 && elapsed <= 20;
    const playbackViolation = playing && playbackRate > config.maxPlaybackRate + 0.01;
    const maxExpectedForward = elapsed > 0
      ? Math.max(8, elapsed * (config.maxPlaybackRate + 0.35) + 2)
      : 8;
    const seekViolation = session.last_video_position !== null
      && session.last_video_position !== undefined
      && forward > maxExpectedForward;

    if (playbackViolation) guard.playback_violations = Number(guard.playback_violations || 0) + 1;
    if (seekViolation) guard.seek_violations = Number(guard.seek_violations || 0) + 1;

    let checkpointActive = guard.checkpoint_enabled === true
      && guard.checkpoint_passed !== true
      && guard.checkpoint_active === true;

    let increment = visible
      && playing
      && heartbeatWindowValid
      && !playbackViolation
      && !seekViolation
      && !checkpointActive
        ? Math.max(0, Math.min(elapsed, 12, forward + 1.25))
        : 0;

    let watched = Math.min(requiredSeconds, Number(session.watched_seconds || 0) + increment);
    const checkpointAt = Number(guard.checkpoint_at_seconds || 0);

    if (
      guard.checkpoint_enabled === true
      && guard.checkpoint_passed !== true
      && !checkpointActive
      && checkpointAt > 0
      && watched >= checkpointAt
    ) {
      checkpointActive = true;
      guard.checkpoint_active = true;
      guard.checkpoint_nonce = randomToken(16);
      watched = Math.min(watched, checkpointAt);
      increment = 0;
    }

    guard.next_heartbeat_nonce = randomToken();
    requirements.watch_guard = guard;

    const checkpointPassed = guard.checkpoint_enabled !== true || guard.checkpoint_passed === true;
    const completed = watched >= requiredSeconds
      && wallElapsed >= requiredSeconds
      && checkpointPassed;

    const { data: updated, error } = await admin.from("reward_sessions").update({
      watched_seconds: watched,
      last_video_position: position,
      last_heartbeat_at: now.toISOString(),
      heartbeat_count: Number(session.heartbeat_count || 0) + 1,
      visibility_failures: Number(session.visibility_failures || 0) + ((!visible || !playing) ? 1 : 0),
      requirements_completed: requirements,
      status: completed ? "completed" : "watching",
      completed_at: completed ? (session.completed_at || now.toISOString()) : null,
      updated_at: now.toISOString(),
    }).eq("id", session.id).eq("user_id", caller.id).select("*").single();

    if (error) return json({ error: error.message }, 500);
    return json({
      session: updated,
      required_watch_seconds: requiredSeconds,
      accepted: increment > 0,
      watch_state: {
        visible,
        playing,
        playback_rate: playbackRate,
        max_playback_rate: config.maxPlaybackRate,
        seek_violation: seekViolation,
        playback_violation: playbackViolation,
        wall_elapsed_seconds: wallElapsed,
      },
      challenge: guard.checkpoint_active && guard.checkpoint_passed !== true
        ? {
            nonce: guard.checkpoint_nonce,
            checkpoint_at_seconds: guard.checkpoint_at_seconds,
          }
        : null,
    });
  }

  if (action === "attention" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const nonce = String(body?.challenge_nonce || "");
    if (!sessionId || !nonce) return json({ error: "Checkpoint inválido" }, 400);

    const { data: rawSession } = await admin.from("reward_sessions").select("*").eq("id", sessionId).eq("user_id", caller.id).maybeSingle();
    if (!rawSession) return json({ error: "Sessão não encontrada" }, 404);
    if (rawSession.status !== "watching") return json({ session: rawSession });

    const cp = await getCampaignProduct(admin, rawSession.campaign_product_id);
    if (!cp) return json({ error: "Campanha indisponível" }, 409);

    const guarded = await ensureWatchGuard(admin, rawSession, cp.campaign);
    const requirements = { ...guarded.requirements };
    const guard = { ...guarded.guard };

    if (guard.checkpoint_enabled !== true || guard.checkpoint_passed === true) {
      return json({ session: guarded.session, challenge: null });
    }
    if (guard.checkpoint_active !== true || !guard.checkpoint_nonce || nonce !== guard.checkpoint_nonce) {
      return json({ error: "Checkpoint expirado ou inválido" }, 409);
    }

    guard.checkpoint_active = false;
    guard.checkpoint_passed = true;
    guard.checkpoint_passed_at = new Date().toISOString();
    guard.checkpoint_nonce = null;
    guard.next_heartbeat_nonce = randomToken();
    requirements.watch_guard = guard;
    requirements.attention_checkpoint = true;

    const { data: updated, error } = await admin.from("reward_sessions").update({
      requirements_completed: requirements,
      updated_at: new Date().toISOString(),
    }).eq("id", rawSession.id).eq("user_id", caller.id).select("*").single();

    if (error) return json({ error: error.message }, 500);
    return json({ session: updated, challenge: null, ok: true });
  }

  if (action === "request" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const { data: session } = await admin.from("reward_sessions").select("*").eq("id", sessionId).eq("user_id", caller.id).maybeSingle();
    if (!session) return json({ error: "Sessão não encontrada" }, 404);
    if (!["completed", "requested", "delivering", "delivered"].includes(session.status)) return json({ error: "Missão ainda não concluída" }, 409);
    if (session.status === "delivered") return json({ session });

    const cp = await getCampaignProduct(admin, session.campaign_product_id);
    if (!cp) return json({ error: "Recompensa indisponível" }, 409);

    const guarded = await ensureWatchGuard(admin, session, cp.campaign);
    const guard = guarded.guard;
    const requiredSeconds = Math.max(1, Number(cp.campaign.required_watch_seconds || 1));
    const startedAtMs = guarded.session.started_at
      ? new Date(guarded.session.started_at).getTime()
      : new Date(guarded.session.created_at).getTime();
    const wallElapsed = Math.max(0, (Date.now() - startedAtMs) / 1000);
    if (Number(guarded.session.watched_seconds || 0) < requiredSeconds) {
      return json({ error: "Tempo de vídeo ainda não concluído" }, 409);
    }
    if (wallElapsed < requiredSeconds) {
      return json({ error: "Tempo real mínimo da missão ainda não concluído" }, 409);
    }
    if (guard.checkpoint_enabled === true && guard.checkpoint_passed !== true) {
      return json({ error: "Confirme o checkpoint de atenção antes de solicitar o teste" }, 409);
    }

    const now = new Date();
    const eligible = new Date(now.getTime() + Number(cp.auto_delay_seconds || 0) * 1000);
    const { data: updated, error } = await admin.from("reward_sessions").update({
      status: "requested",
      requested_at: session.requested_at || now.toISOString(),
      eligible_delivery_at: session.eligible_delivery_at || eligible.toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", session.id).eq("user_id", caller.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    return json({ session: await maybeAutoDeliver(admin, updated), delivery_mode: cp.delivery_mode });
  }

  if (action === "status" && req.method === "GET") {
    const sessionId = String(url.searchParams.get("session_id") || "");
    const { data: session } = await admin.from("reward_sessions").select("*").eq("id", sessionId).eq("user_id", caller.id).maybeSingle();
    if (!session) return json({ error: "Sessão não encontrada" }, 404);
    const current = await maybeAutoDeliver(admin, session);
    const { data: delivery } = await admin.from("reward_deliveries").select("id,delivery_mode,delivered_at,expires_at").eq("session_id", session.id).eq("user_id", caller.id).maybeSingle();
    return json({ session: current, delivery: delivery || null });
  }

  if (action.startsWith("admin-") && !(await isAdmin(admin, caller.id))) return json({ error: "Forbidden" }, 403);

  if (action === "admin-queue" && req.method === "GET") {
    const { data, error } = await admin.from("reward_sessions").select("*").in("status", ["completed", "requested", "delivering"]).order("created_at", { ascending: true }).limit(200);
    if (error) return json({ error: error.message }, 500);
    return json({ sessions: data || [] });
  }

  if (action === "admin-reject" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const reason = String(body?.reason || "").trim().slice(0, 500);
    if (!sessionId) return json({ error: "Sessão inválida" }, 400);

    const { data: rejected, error } = await admin
      .from("reward_sessions")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .in("status", ["completed", "requested"])
      .select("id,status,user_id")
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!rejected) return json({ error: "Sessão não está disponível para recusa" }, 409);
    return json({ ok: true, session: rejected, reason: reason || null });
  }

  if (action === "admin-deliver" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const manualContent = typeof body?.content === "string" ? body.content.trim() : "";
    const { data: session } = await admin.from("reward_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return json({ error: "Sessão não encontrada" }, 404);

    const { data: existingDelivery } = await admin
      .from("reward_deliveries")
      .select("id,delivered_at,expires_at")
      .eq("session_id", session.id)
      .maybeSingle();
    if (existingDelivery || session.status === "delivered") {
      return json({ ok: true, duplicate: true, delivery: existingDelivery || null });
    }
    if (!["completed", "requested"].includes(session.status)) {
      return json({ error: "Sessão não está pronta para entrega" }, 409);
    }

    // Lock the session so two staff members cannot consume two trial keys at once.
    const { data: locked } = await admin.from("reward_sessions").update({
      status: "delivering", updated_at: new Date().toISOString(),
    }).eq("id", session.id).in("status", ["completed", "requested"]).select("*").maybeSingle();
    if (!locked) return json({ error: "Entrega já está sendo processada" }, 409);

    const cp = await getCampaignProduct(admin, session.campaign_product_id);
    if (!cp) {
      await admin.from("reward_sessions").update({ status: session.status, updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "delivering");
      return json({ error: "Recompensa indisponível" }, 409);
    }

    let content = manualContent;
    let stockId: string | null = null;
    if (!content && session.product_plan_id) {
      const stock = await claimTrialStock(admin, session.product_plan_id, session.user_id);
      if (stock) { content = stock.content; stockId = stock.id; }
    }
    if (!content) {
      await admin.from("reward_sessions").update({ status: session.status, updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "delivering");
      return json({ error: "Sem conteúdo/estoque para entregar" }, 409);
    }

    const now = new Date();
    const duration = Number(cp.trial_duration_minutes || 60);
    const expires = new Date(now.getTime() + duration * 60_000);
    const { error } = await admin.from("reward_deliveries").insert({
      session_id: session.id,
      user_id: session.user_id,
      trial_stock_item_id: stockId,
      content,
      delivery_mode: "manual",
      delivered_by: caller.id,
      delivered_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });
    if (error) {
      if (stockId) {
        await admin.from("trial_stock_items").update({ used: false, used_by: null, used_at: null }).eq("id", stockId).eq("used_by", session.user_id);
      }
      await admin.from("reward_sessions").update({ status: session.status, updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "delivering");
      if (error.code === "23505") return json({ ok: true, duplicate: true });
      return json({ error: error.message }, 500);
    }
    await admin.from("reward_sessions").update({
      status: "delivered",
      delivered_at: now.toISOString(),
      cooldown_until: new Date(now.getTime() + Number(cp.campaign.cooldown_hours || 0) * 3_600_000).toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", session.id).eq("status", "delivering");
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 404);
});
