import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function clean(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeTemplate(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const categoriesInput = Array.isArray(input.categories) ? input.categories : [];
  if (categoriesInput.length > 50) throw new Error("TOO_MANY_CATEGORIES");

  let totalChannels = 0;
  const categories = categoriesInput.map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const name = clean(item.name, 100);
    if (!name) throw new Error("INVALID_CATEGORY");

    const channelInput = Array.isArray(item.channels) ? item.channels : [];
    if (channelInput.length > 100) throw new Error("TOO_MANY_CHANNELS");
    totalChannels += channelInput.length;
    if (totalChannels > 500) throw new Error("TOO_MANY_CHANNELS");

    const channels = channelInput.map((rawChannel) => {
      const channel = rawChannel && typeof rawChannel === "object"
        ? rawChannel as Record<string, unknown>
        : {};
      const channelName = clean(channel.name, 100);
      if (!channelName) throw new Error("INVALID_CHANNEL");
      return {
        name: channelName,
        type: "text" as const,
        readOnly: channel.readOnly === true,
      };
    });

    return { name, channels };
  });

  return {
    brand: "CRAZZY PROJECT",
    theme: "CRAZZY_BLUE",
    categories,
  };
}

function normalizeTheme(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const color = (key: string, fallback: string) => {
    const next = clean(input[key], 7);
    return HEX_RE.test(next) ? next.toUpperCase() : fallback;
  };

  return {
    brand: "CRAZZY PROJECT",
    primary: color("primary", "#0000FF"),
    secondary: color("secondary", "#1687FF"),
    accent: color("accent", "#00B7FF"),
    success: color("success", "#22C55E"),
    danger: color("danger", "#EF4444"),
    dark: color("dark", "#050914"),
    footer: clean(input.footer || "CRAZZY PROJECT • DISCORD BOT CORE", 120),
  };
}

async function context() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, isAdmin: !error && isAdmin === true };
}

function denied(user: unknown, isAdmin: boolean) {
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

export async function GET() {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const [workerResult, builderResult, jobsResult, campaignsResult] = await Promise.all([
    supabase
      .from("discord_campaign_worker_status")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("discord_builder_configs")
      .select("*")
      .eq("id", "default")
      .single(),
    supabase
      .from("discord_builder_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("discord_campaigns")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (builderResult.error || jobsResult.error || campaignsResult.error) {
    return NextResponse.json({ error: "DISCORD_BOT_CORE_UNAVAILABLE" }, { status: 500 });
  }

  const campaignStatuses = campaignsResult.data || [];
  const summary = {
    queued: campaignStatuses.filter((item) => item.status === "queued").length,
    running: campaignStatuses.filter((item) => item.status === "running").length,
    completed: campaignStatuses.filter((item) => item.status === "completed").length,
    failed: campaignStatuses.filter((item) => item.status === "failed").length,
  };

  return NextResponse.json(
    {
      worker: workerResult.data || null,
      builder: builderResult.data,
      jobs: jobsResult.data || [],
      campaign_summary: summary,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const action = clean(body?.action, 40);

  if (action === "save_builder") {
    try {
      const template = normalizeTemplate(body?.template);
      const theme = normalizeTheme(body?.theme);

      const { data, error } = await supabase
        .from("discord_builder_configs")
        .update({
          template,
          theme,
          safe_mode: true,
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "default")
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "BUILDER_SAVE_FAILED" }, { status: 400 });
      }

      return NextResponse.json({ builder: data });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_BUILDER_CONFIG";
      return NextResponse.json({ error: code }, { status: 400 });
    }
  }

  if (action === "queue_builder") {
    const guildId = clean(body?.guildId, 64) || null;
    const { data, error } = await supabase.rpc("queue_discord_builder_job", {
      p_guild_id: guildId,
    });

    if (error || !data) {
      const message = String(error?.message || "");
      return NextResponse.json(
        { error: message.includes("BUILDER_JOB_ALREADY_ACTIVE") ? "BUILDER_JOB_ALREADY_ACTIVE" : "BUILDER_QUEUE_FAILED" },
        { status: message.includes("BUILDER_JOB_ALREADY_ACTIVE") ? 409 : 400 }
      );
    }

    return NextResponse.json({ job: data }, { status: 201 });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  if (clean(body?.action, 40) !== "cancel_builder") {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }

  const id = clean(body?.id, 36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "INVALID_JOB" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cancel_discord_builder_job", {
    p_job_id: id,
  });

  if (error || data !== true) {
    return NextResponse.json({ error: "BUILDER_CANCEL_FAILED" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
