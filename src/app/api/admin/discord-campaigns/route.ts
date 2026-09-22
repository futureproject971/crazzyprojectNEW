import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function clean(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function nullable(value: unknown, max = 1000) {
  const next = clean(value, max);
  return next || null;
}

function validUrl(value: unknown) {
  const next = nullable(value, 1200);
  if (!next) return null;
  try {
    const parsed = new URL(next);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseColor(value: unknown) {
  const hex = clean(value, 7);
  if (!HEX_RE.test(hex)) return 0x1687ff;
  return Number.parseInt(hex.slice(1), 16);
}

function colorHex(value: number) {
  return "#" + Math.max(0, Math.min(0xffffff, value || 0)).toString(16).padStart(6, "0").toUpperCase();
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

  const [templatesResult, campaignsResult, workersResult, identityResult] = await Promise.all([
    supabase.from("discord_campaign_templates").select("*").order("updated_at", { ascending: false }),
    supabase.from("discord_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("discord_campaign_worker_status").select("*").order("last_seen_at", { ascending: false }),
    supabase.from("discord_identities").select("discord_user_id").eq("user_id", user!.id).maybeSingle(),
  ]);

  if (templatesResult.error || campaignsResult.error || workersResult.error) {
    return NextResponse.json({ error: "CAMPAIGN_CENTER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    {
      templates: (templatesResult.data || []).map((item) => ({
        ...item,
        color_hex: colorHex(Number(item.color)),
      })),
      campaigns: campaignsResult.data || [],
      workers: workersResult.data || [],
      admin_discord_user_id: identityResult.data?.discord_user_id || null,
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

  if (action === "save_template") {
    const id = clean(body?.id, 36);
    const name = clean(body?.name, 80);
    const title = nullable(body?.title, 256);
    const description = clean(body?.description, 4096);
    const imageUrl = validUrl(body?.imageUrl);
    const thumbnailUrl = validUrl(body?.thumbnailUrl);
    const linkUrl = validUrl(body?.linkUrl);
    const footerText = nullable(body?.footerText, 2048);
    const buttonLabel = clean(body?.buttonLabel || "🛒 Acessar Loja", 80);
    const color = parseColor(body?.colorHex);

    if (!name || !buttonLabel) {
      return NextResponse.json({ error: "INVALID_TEMPLATE" }, { status: 400 });
    }
    if (body?.imageUrl && !imageUrl) {
      return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
    }
    if (body?.thumbnailUrl && !thumbnailUrl) {
      return NextResponse.json({ error: "INVALID_THUMBNAIL_URL" }, { status: 400 });
    }
    if (body?.linkUrl && !linkUrl) {
      return NextResponse.json({ error: "INVALID_LINK_URL" }, { status: 400 });
    }

    const payload = {
      name,
      title,
      description,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      link_url: linkUrl,
      button_label: buttonLabel,
      footer_text: footerText,
      color,
      active: body?.active !== false,
      created_by: user!.id,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: "INVALID_TEMPLATE_ID" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("discord_campaign_templates")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "TEMPLATE_SAVE_FAILED" }, { status: 400 });
      }
      return NextResponse.json({ template: data });
    }

    const { data, error } = await supabase
      .from("discord_campaign_templates")
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "TEMPLATE_SAVE_FAILED" }, { status: 400 });
    }
    return NextResponse.json({ template: data }, { status: 201 });
  }

  if (action === "queue_campaign") {
    const targetMode = clean(body?.targetMode, 20);
    if (!["all","online","role","single"].includes(targetMode)) {
      return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
    }

    let targetUserId = nullable(body?.targetUserId, 64);
    if (body?.testMe === true) {
      const { data: identity } = await supabase
        .from("discord_identities")
        .select("discord_user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      targetUserId = identity?.discord_user_id || null;
      if (!targetUserId) {
        return NextResponse.json({ error: "DISCORD_IDENTITY_REQUIRED" }, { status: 409 });
      }
    }

    const imageUrl = validUrl(body?.imageUrl);
    const thumbnailUrl = validUrl(body?.thumbnailUrl);
    const linkUrl = validUrl(body?.linkUrl);

    if (body?.imageUrl && !imageUrl) {
      return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
    }
    if (body?.thumbnailUrl && !thumbnailUrl) {
      return NextResponse.json({ error: "INVALID_THUMBNAIL_URL" }, { status: 400 });
    }
    if (body?.linkUrl && !linkUrl) {
      return NextResponse.json({ error: "INVALID_LINK_URL" }, { status: 400 });
    }

    let scheduledFor: string | null = null;
    if (body?.scheduledFor) {
      const date = new Date(String(body.scheduledFor));
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "INVALID_SCHEDULE" }, { status: 400 });
      }
      const max = Date.now() + 90 * 24 * 60 * 60 * 1000;
      if (date.getTime() > max) {
        return NextResponse.json({ error: "SCHEDULE_TOO_FAR" }, { status: 400 });
      }
      scheduledFor = date.toISOString();
    }

    const { data, error } = await supabase.rpc("queue_discord_campaign", {
      p_template_id: UUID_RE.test(clean(body?.templateId, 36)) ? clean(body?.templateId, 36) : null,
      p_title: nullable(body?.title, 256),
      p_description: clean(body?.description, 4096),
      p_image_url: imageUrl,
      p_thumbnail_url: thumbnailUrl,
      p_link_url: linkUrl,
      p_button_label: clean(body?.buttonLabel || "🛒 Acessar Loja", 80),
      p_footer_text: nullable(body?.footerText, 2048),
      p_color: parseColor(body?.colorHex),
      p_target_mode: body?.testMe === true ? "single" : targetMode,
      p_target_role_id: nullable(body?.targetRoleId, 64),
      p_target_user_id: targetUserId,
      p_guild_id: nullable(body?.guildId, 64),
      p_scheduled_for: scheduledFor,
    });

    if (error || !data) {
      return NextResponse.json({ error: "CAMPAIGN_QUEUE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ campaign: data }, { status: 201 });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const action = clean(body?.action, 40);

  if (action === "cancel_campaign") {
    const id = clean(body?.id, 36);
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "INVALID_CAMPAIGN_ID" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("cancel_discord_campaign", {
      p_campaign_id: id,
    });

    if (error || data !== true) {
      return NextResponse.json({ error: "CAMPAIGN_CANCEL_FAILED" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_template") {
    const id = clean(body?.id, 36);
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "INVALID_TEMPLATE_ID" }, { status: 400 });
    }

    const { error } = await supabase
      .from("discord_campaign_templates")
      .update({ active: body?.active === true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: "TEMPLATE_UPDATE_FAILED" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const id = clean(request.nextUrl.searchParams.get("templateId"), 36);
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "INVALID_TEMPLATE_ID" }, { status: 400 });
  }

  const { error } = await supabase.from("discord_campaign_templates").delete().eq("id", id);

  if (error) return NextResponse.json({ error: "TEMPLATE_DELETE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
