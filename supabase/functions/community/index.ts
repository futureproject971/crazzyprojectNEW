import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const BUCKET = "community-media";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SIGNED_MEDIA_SECONDS = 600;

const ALLOWED_EMOJI = new Set([
  "🔥", "💎", "💙", "❤️", "👍", "😂", "🎮", "👀", "💯", "🚀",
]);

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }

  return Deno.env.get("SUPABASE_SECRET_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function safeFilename(value: unknown) {
  const raw = cleanText(value, 160) || "midia";
  const normalized = raw
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized.slice(0, 120) || "midia";
}

function chooseAvatar(
  source: string,
  profileAvatar: string | null,
  discordAvatar: string | null
) {
  if (source === "discord") return discordAvatar || profileAvatar;
  if (source === "crazzy") return profileAvatar || discordAvatar;
  return profileAvatar || discordAvatar;
}

function rolePresentation(appRoles: string[], discordRoles: string[]) {
  if (appRoles.includes("admin")) {
    return { label: "ADMIN", color: "#FF3B81", kind: "admin" };
  }

  if (appRoles.includes("moderator")) {
    return { label: "MOD", color: "#FFB020", kind: "moderator" };
  }

  if (discordRoles.length > 0) {
    return { label: discordRoles[0], color: "#0000FF", kind: "discord" };
  }

  return { label: "MEMBER", color: "#2AA8FF", kind: "member" };
}

async function getCaller(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const { data, error } = await admin.auth.getUser(authHeader.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

async function getRoles(admin: any, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (data || [])
    .map((item: any) => String(item.role || ""))
    .filter(Boolean);

  if (!roles.includes("user")) roles.push("user");
  return roles;
}

function isStaff(roles: string[]) {
  return roles.includes("admin") || roles.includes("moderator");
}

async function getChannel(admin: any, slug: string) {
  const { data } = await admin
    .from("community_channels")
    .select("id,slug,name,description,active,sort_order")
    .eq("slug", slug)
    .maybeSingle();

  return data || null;
}

async function buildIdentityMap(admin: any, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const identities = new Map<string, any>();
  if (!uniqueIds.length) return identities;

  const [
    { data: profiles },
    { data: preferences },
    { data: discord },
    { data: roles },
    { data: grants },
    { data: entitlements },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id,username,avatar_url")
      .in("user_id", uniqueIds),
    admin
      .from("profile_preferences")
      .select("user_id,display_name,bio,primary_color,avatar_source")
      .in("user_id", uniqueIds),
    admin
      .from("discord_identities")
      .select("user_id,username,global_name,avatar_url,guild_member")
      .in("user_id", uniqueIds),
    admin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", uniqueIds),
    admin
      .from("discord_role_grants")
      .select("user_id,role_name,status,granted_at,created_at")
      .in("user_id", uniqueIds)
      .eq("status", "granted")
      .order("granted_at", { ascending: false, nullsFirst: false }),
    admin
      .from("entitlements")
      .select("user_id,status,product_plans(plan_code)")
      .in("user_id", uniqueIds)
      .limit(1000),
  ]);

  const profileMap = new Map((profiles || []).map((item: any) => [item.user_id, item]));
  const preferenceMap = new Map((preferences || []).map((item: any) => [item.user_id, item]));
  const discordMap = new Map((discord || []).map((item: any) => [item.user_id, item]));

  const roleMap = new Map<string, string[]>();
  for (const item of roles || []) {
    const list = roleMap.get(item.user_id) || [];
    list.push(String(item.role));
    roleMap.set(item.user_id, list);
  }

  const grantMap = new Map<string, string[]>();
  for (const item of grants || []) {
    if (!item.role_name) continue;
    const list = grantMap.get(item.user_id) || [];
    if (!list.includes(item.role_name)) list.push(item.role_name);
    grantMap.set(item.user_id, list.slice(0, 12));
  }

  const entitlementMap = new Map<string, any[]>();
  for (const item of entitlements || []) {
    const list = entitlementMap.get(item.user_id) || [];
    list.push(item);
    entitlementMap.set(item.user_id, list);
  }

  for (const userId of uniqueIds) {
    const profile = profileMap.get(userId);
    const preference = preferenceMap.get(userId);
    const discordIdentity = discordMap.get(userId);
    const appRoles = roleMap.get(userId) || ["user"];
    if (!appRoles.includes("user")) appRoles.push("user");

    const discordRoles = grantMap.get(userId) || [];
    const userEntitlements = entitlementMap.get(userId) || [];
    const activeEntitlements = userEntitlements.filter((item: any) => item.status === "active");

    const lifetime = activeEntitlements.some((item: any) => {
      const plan = Array.isArray(item.product_plans)
        ? item.product_plans[0]
        : item.product_plans;
      return String(plan?.plan_code || "").toLowerCase() === "lifetime";
    });

    const username =
      cleanText(preference?.display_name, 32)
      || cleanText(profile?.username, 64)
      || cleanText(discordIdentity?.global_name, 64)
      || cleanText(discordIdentity?.username, 64)
      || "CRAZZY Member";

    const avatarUrl = chooseAvatar(
      String(preference?.avatar_source || "auto"),
      profile?.avatar_url || null,
      discordIdentity?.avatar_url || null
    );

    const badges = [
      { id: "member", label: "CRAZZY MEMBER", tone: "blue" },
    ];

    if (userEntitlements.length > 0) {
      badges.push({ id: "customer", label: "CLIENTE", tone: "green" });
    }

    if (discordIdentity?.guild_member) {
      badges.push({ id: "discord_verified", label: "DISCORD VERIFICADO", tone: "blue" });
    }

    if (appRoles.includes("admin")) {
      badges.push({ id: "admin", label: "ADMIN", tone: "pink" });
    } else if (appRoles.includes("moderator")) {
      badges.push({ id: "moderator", label: "MOD", tone: "gold" });
    }

    if (lifetime) {
      badges.push({ id: "lifetime", label: "LIFETIME", tone: "gold" });
    }

    identities.set(userId, {
      key: userId,
      name: username,
      avatarUrl,
      bio: cleanText(preference?.bio, 280) || null,
      primaryRole: rolePresentation(appRoles, discordRoles),
      appRoles,
      discordRoles,
      badges,
      discord: {
        connected: Boolean(discordIdentity),
        guildMember: Boolean(discordIdentity?.guild_member),
      },
      stats: {
        entitlements: userEntitlements.length,
        activeEntitlements: activeEntitlements.length,
      },
    });
  }

  return identities;
}

async function signedMedia(admin: any, attachment: any) {
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_MEDIA_SECONDS);

  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mime_type,
    sizeBytes: Number(attachment.size_bytes || 0),
    createdAt: attachment.created_at,
    url: data?.signedUrl || null,
    expiresIn: data?.signedUrl ? SIGNED_MEDIA_SECONDS : 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = secretKey();

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "COMMUNITY_BACKEND_NOT_CONFIGURED" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "UNAUTHORIZED" }, 401);

  const [{ data: profile }, callerRoles] = await Promise.all([
    admin.from("profiles").select("banned").eq("user_id", caller.id).maybeSingle(),
    getRoles(admin, caller.id),
  ]);

  if (profile?.banned) return json({ error: "ACCOUNT_BANNED" }, 403);

  const staff = isStaff(callerRoles);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "snapshot";

  if (action === "snapshot" && req.method === "GET") {
    const slug = cleanText(url.searchParams.get("channel") || "geral", 32);
    const channel = await getChannel(admin, slug);

    if (!channel || (!channel.active && !staff)) {
      return json({ error: "CHANNEL_NOT_FOUND" }, 404);
    }

    const { data: rows, error } = await admin
      .from("community_messages")
      .select("id,channel_id,user_id,reply_to_message_id,body,deleted_at,edited_at,created_at,updated_at")
      .eq("channel_id", channel.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return json({ error: "COMMUNITY_SNAPSHOT_FAILED" }, 500);

    const messages = (rows || []).reverse();
    const ids = messages.map((item: any) => item.id);
    const userIds = messages.map((item: any) => item.user_id);

    const [
      identityMap,
      { data: reactions },
      { data: attachments },
    ] = await Promise.all([
      buildIdentityMap(admin, userIds),
      ids.length
        ? admin
            .from("community_reactions")
            .select("id,message_id,user_id,emoji,created_at")
            .in("message_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? admin
            .from("community_attachments")
            .select("id,message_id,storage_path,filename,mime_type,size_bytes,created_at")
            .in("message_id", ids)
            .eq("status", "ready")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const reactionMap = new Map<string, Map<string, { count: number; reacted: boolean }>>();
    for (const item of reactions || []) {
      let perMessage = reactionMap.get(item.message_id);
      if (!perMessage) {
        perMessage = new Map();
        reactionMap.set(item.message_id, perMessage);
      }

      const current = perMessage.get(item.emoji) || { count: 0, reacted: false };
      current.count += 1;
      if (item.user_id === caller.id) current.reacted = true;
      perMessage.set(item.emoji, current);
    }

    const attachmentMap = new Map<string, any[]>();
    for (const item of attachments || []) {
      const list = attachmentMap.get(item.message_id) || [];
      list.push(await signedMedia(admin, item));
      attachmentMap.set(item.message_id, list);
    }

    const messageMap = new Map(messages.map((item: any) => [item.id, item]));
    const output = messages.map((item: any) => {
      const deleted = Boolean(item.deleted_at);
      const identity = identityMap.get(item.user_id) || {
        key: item.user_id,
        name: "CRAZZY Member",
        avatarUrl: null,
        primaryRole: { label: "MEMBER", color: "#2AA8FF", kind: "member" },
        badges: [],
        discordRoles: [],
      };

      const original = item.reply_to_message_id
        ? messageMap.get(item.reply_to_message_id)
        : null;

      const originalIdentity = original
        ? identityMap.get(original.user_id)
        : null;

      const reactionsForMessage = reactionMap.get(item.id);
      const reactionList = reactionsForMessage
        ? [...reactionsForMessage.entries()].map(([emoji, value]) => ({
            emoji,
            count: value.count,
            reacted: value.reacted,
          }))
        : [];

      return {
        id: item.id,
        body: deleted ? null : item.body,
        deleted,
        editedAt: item.edited_at,
        createdAt: item.created_at,
        author: {
          key: identity.key,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          primaryRole: identity.primaryRole,
          badges: identity.badges,
          discordRoles: identity.discordRoles,
        },
        reply: original
          ? {
              id: original.id,
              deleted: Boolean(original.deleted_at),
              body: original.deleted_at ? null : String(original.body || "").slice(0, 180),
              authorName: originalIdentity?.name || "CRAZZY Member",
            }
          : null,
        reactions: reactionList,
        attachments: deleted ? [] : (attachmentMap.get(item.id) || []),
        mine: item.user_id === caller.id,
        canDelete: !deleted && (item.user_id === caller.id || staff),
      };
    });

    const [{ data: channels }, onlineUsersResult] = await Promise.all([
      admin
        .from("community_channels")
        .select("slug,name,description,active,sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      admin
        .from("community_messages")
        .select("user_id,created_at")
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .limit(500),
    ]);

    const activeUsers = new Set((onlineUsersResult.data || []).map((item: any) => item.user_id));

    return json({
      channel: {
        slug: channel.slug,
        name: channel.name,
        description: channel.description,
      },
      channels: channels || [],
      messages: output,
      viewer: {
        key: caller.id,
        staff,
      },
      activity: {
        recentUsers: activeUsers.size,
      },
      emoji: [...ALLOWED_EMOJI],
    });
  }

  if (action === "profile" && req.method === "GET") {
    const targetId = url.searchParams.get("user_id") || "";
    if (!isUuid(targetId)) return json({ error: "INVALID_PROFILE" }, 400);

    if (targetId !== caller.id) {
      const { data: posted } = await admin
        .from("community_messages")
        .select("id")
        .eq("user_id", targetId)
        .limit(1)
        .maybeSingle();

      if (!posted) return json({ error: "PROFILE_NOT_FOUND" }, 404);
    }

    const identityMap = await buildIdentityMap(admin, [targetId]);
    const identity = identityMap.get(targetId);
    if (!identity) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    return json({
      profile: {
        key: identity.key,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        bio: identity.bio,
        primaryRole: identity.primaryRole,
        appRoles: identity.appRoles,
        discordRoles: identity.discordRoles,
        badges: identity.badges,
        discord: identity.discord,
        stats: identity.stats,
      },
    });
  }

  if (action === "message" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const slug = cleanText(body?.channel || "geral", 32);
    const text = cleanText(body?.message, 2000);
    const replyTo = body?.reply_to_message_id
      ? String(body.reply_to_message_id)
      : null;

    if (!text) return json({ error: "MESSAGE_REQUIRED" }, 400);
    if (replyTo && !isUuid(replyTo)) return json({ error: "INVALID_REPLY" }, 400);

    const channel = await getChannel(admin, slug);
    if (!channel || (!channel.active && !staff)) {
      return json({ error: "CHANNEL_NOT_FOUND" }, 404);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("community_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.id)
      .gte("created_at", since);

    if ((count || 0) >= 20) {
      return json({ error: "MESSAGE_RATE_LIMIT" }, 429);
    }

    if (replyTo) {
      const { data: original } = await admin
        .from("community_messages")
        .select("id,channel_id")
        .eq("id", replyTo)
        .eq("channel_id", channel.id)
        .maybeSingle();

      if (!original) return json({ error: "INVALID_REPLY" }, 400);
    }

    const { data: inserted, error } = await admin
      .from("community_messages")
      .insert({
        channel_id: channel.id,
        user_id: caller.id,
        reply_to_message_id: replyTo,
        body: text,
      })
      .select("id,created_at")
      .single();

    if (error || !inserted) return json({ error: "MESSAGE_SEND_FAILED" }, 500);

    return json({
      success: true,
      messageId: inserted.id,
      createdAt: inserted.created_at,
    }, 201);
  }

  if (action === "reaction" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const messageId = String(body?.message_id || "");
    const emoji = String(body?.emoji || "");

    if (!isUuid(messageId)) return json({ error: "INVALID_MESSAGE" }, 400);
    if (!ALLOWED_EMOJI.has(emoji)) return json({ error: "INVALID_EMOJI" }, 400);

    const { data: message } = await admin
      .from("community_messages")
      .select("id,deleted_at,channel_id")
      .eq("id", messageId)
      .maybeSingle();

    if (!message || message.deleted_at) {
      return json({ error: "MESSAGE_NOT_FOUND" }, 404);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("community_reactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.id)
      .gte("created_at", since);

    if ((count || 0) >= 60) return json({ error: "REACTION_RATE_LIMIT" }, 429);

    const { data: existing } = await admin
      .from("community_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", caller.id)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing) {
      await admin.from("community_reactions").delete().eq("id", existing.id);
      return json({ success: true, reacted: false });
    }

    const { error } = await admin
      .from("community_reactions")
      .insert({
        message_id: messageId,
        user_id: caller.id,
        emoji,
      });

    if (error) return json({ error: "REACTION_FAILED" }, 500);
    return json({ success: true, reacted: true });
  }

  if (action === "delete-message" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const messageId = String(body?.message_id || "");
    if (!isUuid(messageId)) return json({ error: "INVALID_MESSAGE" }, 400);

    let query = admin
      .from("community_messages")
      .select("id,user_id,deleted_at")
      .eq("id", messageId);

    if (!staff) query = query.eq("user_id", caller.id);

    const { data: message } = await query.maybeSingle();
    if (!message) return json({ error: "MESSAGE_NOT_FOUND" }, 404);

    if (message.deleted_at) return json({ success: true });

    const now = new Date().toISOString();
    await admin
      .from("community_messages")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", message.id);

    return json({ success: true });
  }

  if (action === "upload-url" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const messageId = String(body?.message_id || "");
    const filename = safeFilename(body?.filename);
    const mimeType = cleanText(body?.mime_type, 100).toLowerCase();
    const sizeBytes = Number(body?.size_bytes || 0);

    if (!isUuid(messageId)) return json({ error: "INVALID_MESSAGE" }, 400);
    if (!ALLOWED_MIME.has(mimeType)) return json({ error: "FILE_TYPE_NOT_ALLOWED" }, 400);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
      return json({ error: "FILE_SIZE_NOT_ALLOWED" }, 400);
    }

    const { data: message } = await admin
      .from("community_messages")
      .select("id,user_id,deleted_at")
      .eq("id", messageId)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!message || message.deleted_at) {
      return json({ error: "MESSAGE_NOT_FOUND" }, 404);
    }

    const { count } = await admin
      .from("community_attachments")
      .select("id", { count: "exact", head: true })
      .eq("message_id", messageId);

    if ((count || 0) >= 6) return json({ error: "ATTACHMENT_LIMIT" }, 429);

    const attachmentId = crypto.randomUUID();
    const storagePath = `${caller.id}/${messageId}/${attachmentId}-${filename}`;

    const { error: metaError } = await admin
      .from("community_attachments")
      .insert({
        id: attachmentId,
        message_id: messageId,
        owner_user_id: caller.id,
        storage_path: storagePath,
        filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        status: "pending",
      });

    if (metaError) return json({ error: "ATTACHMENT_CREATE_FAILED" }, 500);

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed?.token) {
      await admin.from("community_attachments").delete().eq("id", attachmentId);
      return json({ error: "UPLOAD_URL_FAILED" }, 500);
    }

    return json({
      attachmentId,
      bucket: BUCKET,
      path: storagePath,
      token: signed.token,
      filename,
      mimeType,
      sizeBytes,
    }, 201);
  }

  if (action === "finalize-attachment" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const attachmentId = String(body?.attachment_id || "");
    if (!isUuid(attachmentId)) return json({ error: "INVALID_ATTACHMENT" }, 400);

    const { data: attachment } = await admin
      .from("community_attachments")
      .select("*")
      .eq("id", attachmentId)
      .eq("owner_user_id", caller.id)
      .maybeSingle();

    if (!attachment) return json({ error: "ATTACHMENT_NOT_FOUND" }, 404);

    const pathParts = String(attachment.storage_path).split("/");
    const fileName = pathParts.pop() || "";
    const folder = pathParts.join("/");

    const { data: objects, error: listError } = await admin.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 20 });

    const exists = !listError
      && (objects || []).some((item: any) => item.name === fileName);

    if (!exists) return json({ error: "UPLOAD_NOT_FOUND" }, 409);

    await admin
      .from("community_attachments")
      .update({ status: "ready" })
      .eq("id", attachment.id);

    return json({ success: true, attachmentId: attachment.id });
  }

  return json({ error: "NOT_FOUND" }, 404);
});
