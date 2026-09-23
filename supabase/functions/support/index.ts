import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const BUCKET = "support-attachments";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SIGNED_DOWNLOAD_SECONDS = 300;

const ALLOWED_CATEGORIES = new Set([
  "product",
  "payment",
  "delivery",
  "technical",
  "account",
  "other",
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
  "application/pdf",
  "text/plain",
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
  const raw = cleanText(value, 180) || "arquivo";
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "arquivo";
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

  return (data || []).map((item: any) => String(item.role || ""));
}

function isStaff(roles: string[]) {
  return roles.includes("admin") || roles.includes("moderator");
}

async function getAccessibleTicket(
  admin: any,
  ticketId: string,
  userId: string,
  staff: boolean
) {
  let query = admin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId);

  if (!staff) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

async function resolveContext(admin: any, userId: string, body: any) {
  let productId = isUuid(body?.product_id) ? body.product_id : null;
  let productPlanId = isUuid(body?.product_plan_id) ? body.product_plan_id : null;
  let entitlementId = isUuid(body?.entitlement_id) ? body.entitlement_id : null;
  let orderTicketId = isUuid(body?.order_ticket_id) ? body.order_ticket_id : null;
  let libraryDeliveryId = isUuid(body?.library_delivery_id) ? body.library_delivery_id : null;

  if (body?.entitlement_id && !entitlementId) return { error: "INVALID_CONTEXT" };
  if (body?.order_ticket_id && !orderTicketId) return { error: "INVALID_CONTEXT" };
  if (body?.library_delivery_id && !libraryDeliveryId) return { error: "INVALID_CONTEXT" };
  if (body?.product_id && !productId) return { error: "INVALID_CONTEXT" };
  if (body?.product_plan_id && !productPlanId) return { error: "INVALID_CONTEXT" };

  if (libraryDeliveryId) {
    const { data } = await admin
      .from("library_deliveries")
      .select("id,user_id,product_id,product_plan_id,entitlement_id")
      .eq("id", libraryDeliveryId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { error: "INVALID_CONTEXT" };
    productId = data.product_id || productId;
    productPlanId = data.product_plan_id || productPlanId;
    entitlementId = data.entitlement_id || entitlementId;
  }

  if (entitlementId) {
    const { data } = await admin
      .from("entitlements")
      .select("id,user_id,product_id,product_plan_id")
      .eq("id", entitlementId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { error: "INVALID_CONTEXT" };
    productId = data.product_id || productId;
    productPlanId = data.product_plan_id || productPlanId;
  }

  if (orderTicketId) {
    const { data } = await admin
      .from("order_tickets")
      .select("id,user_id,product_id,product_plan_id")
      .eq("id", orderTicketId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { error: "INVALID_CONTEXT" };
    productId = data.product_id || productId;
    productPlanId = data.product_plan_id || productPlanId;
  }

  if (productPlanId) {
    const { data } = await admin
      .from("product_plans")
      .select("id,product_id")
      .eq("id", productPlanId)
      .maybeSingle();

    if (!data) return { error: "INVALID_CONTEXT" };
    productId = data.product_id;
  }

  if (productId) {
    const { data } = await admin
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (!data) return { error: "INVALID_CONTEXT" };
  }

  return {
    productId,
    productPlanId,
    entitlementId,
    orderTicketId,
    libraryDeliveryId,
  };
}

async function mapTicketContext(admin: any, ticket: any) {
  const [productResult, planResult, entitlementResult, orderResult, libraryResult] =
    await Promise.all([
      ticket.product_id
        ? admin.from("products")
            .select("id,name,image_url,status,status_label,tutorial_text,tutorial_file_url")
            .eq("id", ticket.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.product_plan_id
        ? admin.from("product_plans")
            .select("id,name,plan_code")
            .eq("id", ticket.product_plan_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.entitlement_id
        ? admin.from("entitlements")
            .select("id,status,starts_at,expires_at,tutorial_access")
            .eq("id", ticket.entitlement_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.order_ticket_id
        ? admin.from("order_tickets")
            .select("id,status,status_label,created_at,updated_at")
            .eq("id", ticket.order_ticket_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.library_delivery_id
        ? admin.from("library_deliveries")
            .select("id,delivery_type,status,delivered_at,expires_at")
            .eq("id", ticket.library_delivery_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const product = productResult.data;
  const entitlement = entitlementResult.data;

  return {
    product: product
      ? {
          id: product.id,
          name: product.name,
          imageUrl: product.image_url || null,
          status: product.status,
          statusLabel: product.status_label,
        }
      : null,
    plan: planResult.data
      ? {
          id: planResult.data.id,
          name: planResult.data.name,
          code: planResult.data.plan_code || null,
        }
      : null,
    entitlement: entitlement
      ? {
          id: entitlement.id,
          status: entitlement.status,
          startsAt: entitlement.starts_at,
          expiresAt: entitlement.expires_at,
        }
      : null,
    order: orderResult.data
      ? {
          id: orderResult.data.id,
          status: orderResult.data.status,
          statusLabel: orderResult.data.status_label,
          createdAt: orderResult.data.created_at,
          updatedAt: orderResult.data.updated_at,
        }
      : null,
    library: libraryResult.data
      ? {
          id: libraryResult.data.id,
          deliveryType: libraryResult.data.delivery_type,
          status: libraryResult.data.status,
          deliveredAt: libraryResult.data.delivered_at,
          expiresAt: libraryResult.data.expires_at,
        }
      : null,
    tutorialAvailable: Boolean(
      product
      && entitlement?.tutorial_access
      && (product.tutorial_text || product.tutorial_file_url)
    ),
  };
}

async function signedAttachment(admin: any, attachment: any) {
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_DOWNLOAD_SECONDS);

  return {
    id: attachment.id,
    messageId: attachment.message_id,
    filename: attachment.filename,
    mimeType: attachment.mime_type,
    sizeBytes: Number(attachment.size_bytes || 0),
    createdAt: attachment.created_at,
    url: data?.signedUrl || null,
    expiresIn: data?.signedUrl ? SIGNED_DOWNLOAD_SECONDS : 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = secretKey();
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPPORT_BACKEND_NOT_CONFIGURED" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "UNAUTHORIZED" }, 401);

  const [{ data: profile }, roles] = await Promise.all([
    admin.from("profiles").select("banned").eq("user_id", caller.id).maybeSingle(),
    getRoles(admin, caller.id),
  ]);

  if (profile?.banned) return json({ error: "ACCOUNT_BANNED" }, 403);

  const staff = isStaff(roles);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "snapshot";

  if (action === "snapshot" && req.method === "GET") {
    const { data: tickets, error } = await admin
      .from("support_tickets")
      .select("id,category,subject,status,priority,product_id,product_plan_id,entitlement_id,order_ticket_id,library_delivery_id,last_message_at,closed_at,created_at,updated_at")
      .eq("user_id", caller.id)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) return json({ error: "SUPPORT_SNAPSHOT_FAILED" }, 500);

    const rows = tickets || [];
    const ticketIds = rows.map((item: any) => item.id);

    const [{ data: messages }, { data: attachments }] = await Promise.all([
      ticketIds.length
        ? admin.from("support_messages")
            .select("ticket_id,message,created_at")
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      ticketIds.length
        ? admin.from("support_attachments")
            .select("ticket_id,id")
            .in("ticket_id", ticketIds)
            .eq("status", "ready")
        : Promise.resolve({ data: [] }),
    ]);

    const latestMessage = new Map<string, any>();
    for (const message of messages || []) {
      if (!latestMessage.has(message.ticket_id)) {
        latestMessage.set(message.ticket_id, message);
      }
    }

    const attachmentCount = new Map<string, number>();
    for (const attachment of attachments || []) {
      attachmentCount.set(
        attachment.ticket_id,
        (attachmentCount.get(attachment.ticket_id) || 0) + 1
      );
    }

    const safeTickets = [];
    for (const ticket of rows) {
      const context = await mapTicketContext(admin, ticket);
      const last = latestMessage.get(ticket.id);

      safeTickets.push({
        id: ticket.id,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        lastMessageAt: ticket.last_message_at,
        closedAt: ticket.closed_at,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        lastMessagePreview: last?.message
          ? String(last.message).slice(0, 160)
          : null,
        attachmentCount: attachmentCount.get(ticket.id) || 0,
        context,
      });
    }

    return json({
      tickets: safeTickets,
      stats: {
        total: safeTickets.length,
        open: safeTickets.filter((item: any) =>
          ["open","waiting_staff","waiting_user"].includes(item.status)
        ).length,
        waitingStaff: safeTickets.filter((item: any) => item.status === "waiting_staff").length,
        waitingUser: safeTickets.filter((item: any) => item.status === "waiting_user").length,
        closed: safeTickets.filter((item: any) =>
          ["resolved","closed"].includes(item.status)
        ).length,
      },
    });
  }

  if (action === "staff-snapshot" && req.method === "GET") {
    if (!staff) return json({ error: "STAFF_REQUIRED" }, 403);

    const statusFilter = cleanText(url.searchParams.get("status"), 30);
    const priorityFilter = cleanText(url.searchParams.get("priority"), 30);
    const queryText = cleanText(url.searchParams.get("q"), 120);

    let ticketQuery = admin
      .from("support_tickets")
      .select("id,user_id,category,subject,status,priority,product_id,product_plan_id,entitlement_id,order_ticket_id,library_delivery_id,assigned_to,last_message_at,closed_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (statusFilter) ticketQuery = ticketQuery.eq("status", statusFilter);
    if (priorityFilter) ticketQuery = ticketQuery.eq("priority", priorityFilter);
    if (queryText) ticketQuery = ticketQuery.ilike("subject", "%" + queryText.replace(/[%_]/g, "") + "%");

    const { data: tickets, error } = await ticketQuery;
    if (error) return json({ error: "SUPPORT_STAFF_SNAPSHOT_FAILED" }, 500);

    const rows = tickets || [];
    const ticketIds = rows.map((item: any) => item.id);
    const userIds = [...new Set(rows.map((item: any) => item.user_id).filter(Boolean))];

    const [{ data: profiles }, { data: identities }, { data: messages }, { data: attachments }] =
      await Promise.all([
        userIds.length
          ? admin.from("profiles").select("user_id,username,avatar_url,banned").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? admin.from("discord_identities").select("user_id,discord_user_id,username,global_name,avatar_url,guild_member").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        ticketIds.length
          ? admin.from("support_messages")
              .select("ticket_id,message,sender_role,created_at")
              .in("ticket_id", ticketIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        ticketIds.length
          ? admin.from("support_attachments")
              .select("ticket_id,id")
              .in("ticket_id", ticketIds)
              .eq("status", "ready")
          : Promise.resolve({ data: [] }),
      ]);

    const profileMap = new Map((profiles || []).map((item: any) => [item.user_id, item]));
    const identityMap = new Map((identities || []).map((item: any) => [item.user_id, item]));
    const latestMessage = new Map<string, any>();
    for (const message of messages || []) {
      if (!latestMessage.has(message.ticket_id)) latestMessage.set(message.ticket_id, message);
    }
    const attachmentCount = new Map<string, number>();
    for (const attachment of attachments || []) {
      attachmentCount.set(attachment.ticket_id, (attachmentCount.get(attachment.ticket_id) || 0) + 1);
    }

    const safeTickets = rows.map((ticket: any) => {
      const profile = profileMap.get(ticket.user_id);
      const identity = identityMap.get(ticket.user_id);
      const last = latestMessage.get(ticket.id);
      return {
        id: ticket.id,
        userId: ticket.user_id,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        assignedTo: ticket.assigned_to,
        lastMessageAt: ticket.last_message_at,
        closedAt: ticket.closed_at,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        lastMessagePreview: last?.message ? String(last.message).slice(0, 180) : null,
        lastSenderRole: last?.sender_role || null,
        attachmentCount: attachmentCount.get(ticket.id) || 0,
        customer: {
          username: profile?.username || null,
          avatarUrl: profile?.avatar_url || identity?.avatar_url || null,
          banned: Boolean(profile?.banned),
          discordUserId: identity?.discord_user_id || null,
          discordUsername: identity?.global_name || identity?.username || null,
          guildMember: Boolean(identity?.guild_member),
        },
      };
    });

    return json({
      tickets: safeTickets,
      stats: {
        total: safeTickets.length,
        waitingStaff: safeTickets.filter((item: any) => item.status === "waiting_staff").length,
        waitingUser: safeTickets.filter((item: any) => item.status === "waiting_user").length,
        urgent: safeTickets.filter((item: any) => item.priority === "urgent").length,
        unassigned: safeTickets.filter((item: any) => !item.assignedTo && !["resolved","closed"].includes(item.status)).length,
      },
      staffUserId: caller.id,
    });
  }

  if (action === "staff-update" && req.method === "POST") {
    if (!staff) return json({ error: "STAFF_REQUIRED" }, 403);

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticket_id || "");
    if (!isUuid(ticketId)) return json({ error: "INVALID_TICKET" }, 400);

    const ticket = await getAccessibleTicket(admin, ticketId, caller.id, true);
    if (!ticket) return json({ error: "TICKET_NOT_FOUND" }, 404);

    const allowedStatuses = new Set(["open","waiting_staff","waiting_user","resolved","closed"]);
    const allowedPriorities = new Set(["low","normal","high","urgent"]);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const changed: Record<string, unknown> = {};

    if (body?.status !== undefined) {
      const nextStatus = cleanText(body.status, 30);
      if (!allowedStatuses.has(nextStatus)) return json({ error: "INVALID_STATUS" }, 400);
      patch.status = nextStatus;
      changed.status = nextStatus;
      patch.closed_at = ["resolved","closed"].includes(nextStatus) ? new Date().toISOString() : null;
    }

    if (body?.priority !== undefined) {
      const nextPriority = cleanText(body.priority, 30);
      if (!allowedPriorities.has(nextPriority)) return json({ error: "INVALID_PRIORITY" }, 400);
      patch.priority = nextPriority;
      changed.priority = nextPriority;
    }

    if (body?.assignee !== undefined) {
      const rawAssignee = body.assignee;
      let assignee: string | null = null;

      if (rawAssignee === "me") {
        assignee = caller.id;
      } else if (rawAssignee === null || rawAssignee === "") {
        assignee = null;
      } else if (isUuid(rawAssignee)) {
        const { data: targetRoles } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", rawAssignee);
        const target = (targetRoles || []).map((item: any) => String(item.role || ""));
        if (!isStaff(target)) return json({ error: "ASSIGNEE_NOT_STAFF" }, 400);
        assignee = rawAssignee;
      } else {
        return json({ error: "INVALID_ASSIGNEE" }, 400);
      }

      patch.assigned_to = assignee;
      changed.assigned_to = assignee;
    }

    if (Object.keys(changed).length === 0) {
      return json({ success: true, ticket });
    }

    const { data: updated, error: updateError } = await admin
      .from("support_tickets")
      .update(patch)
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (updateError || !updated) return json({ error: "TICKET_UPDATE_FAILED" }, 500);

    await admin.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: caller.id,
      event_type: "staff_update",
      from_status: ticket.status,
      to_status: updated.status,
      metadata: changed,
    });

    return json({ success: true, ticket: updated });
  }

  if (action === "create" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const category = cleanText(body?.category, 30);
    const subject = cleanText(body?.subject, 120);
    const message = cleanText(body?.message, 4000);

    if (!ALLOWED_CATEGORIES.has(category)) {
      return json({ error: "INVALID_CATEGORY" }, 400);
    }
    if (subject.length < 4) return json({ error: "INVALID_SUBJECT" }, 400);
    if (!message) return json({ error: "MESSAGE_REQUIRED" }, 400);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.id)
      .gte("created_at", since);

    if ((count || 0) >= 10) return json({ error: "TICKET_RATE_LIMIT" }, 429);

    const context = await resolveContext(admin, caller.id, body?.context || {});
    if ((context as any).error) return json({ error: "INVALID_CONTEXT" }, 400);

    const now = new Date().toISOString();
    const { data: ticket, error: ticketError } = await admin
      .from("support_tickets")
      .insert({
        user_id: caller.id,
        category,
        subject,
        status: "waiting_staff",
        priority: "normal",
        product_id: (context as any).productId,
        product_plan_id: (context as any).productPlanId,
        entitlement_id: (context as any).entitlementId,
        order_ticket_id: (context as any).orderTicketId,
        library_delivery_id: (context as any).libraryDeliveryId,
        last_message_at: now,
        updated_at: now,
      })
      .select("id,status,created_at")
      .single();

    if (ticketError || !ticket) return json({ error: "TICKET_CREATE_FAILED" }, 500);

    const { data: firstMessage, error: messageError } = await admin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: caller.id,
        sender_role: "user",
        message,
      })
      .select("id,created_at")
      .single();

    if (messageError || !firstMessage) {
      await admin.from("support_tickets").delete().eq("id", ticket.id);
      return json({ error: "TICKET_CREATE_FAILED" }, 500);
    }

    await admin.from("support_ticket_events").insert([
      {
        ticket_id: ticket.id,
        actor_user_id: caller.id,
        event_type: "created",
        to_status: "waiting_staff",
        metadata: { category },
      },
      {
        ticket_id: ticket.id,
        actor_user_id: caller.id,
        event_type: "message",
        metadata: { sender_role: "user" },
      },
    ]);

    return json({
      success: true,
      ticketId: ticket.id,
      messageId: firstMessage.id,
      status: ticket.status,
    }, 201);
  }

  if (action === "thread" && req.method === "GET") {
    const ticketId = url.searchParams.get("ticket_id") || "";
    if (!isUuid(ticketId)) return json({ error: "INVALID_TICKET" }, 400);

    const ticket = await getAccessibleTicket(admin, ticketId, caller.id, staff);
    if (!ticket) return json({ error: "TICKET_NOT_FOUND" }, 404);

    const [{ data: messages }, { data: attachments }, { data: events }, context] =
      await Promise.all([
        admin.from("support_messages")
          .select("id,sender_id,sender_role,message,edited_at,created_at")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: true })
          .limit(500),
        admin.from("support_attachments")
          .select("id,ticket_id,message_id,owner_user_id,storage_path,filename,mime_type,size_bytes,status,created_at")
          .eq("ticket_id", ticket.id)
          .eq("status", "ready")
          .order("created_at", { ascending: true }),
        admin.from("support_ticket_events")
          .select("id,event_type,from_status,to_status,created_at")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: true })
          .limit(500),
        mapTicketContext(admin, ticket),
      ]);

    const senderIds = [...new Set((messages || [])
      .map((item: any) => item.sender_id)
      .filter(Boolean))];

    const [{ data: profiles }, { data: preferences }] = await Promise.all([
      senderIds.length
        ? admin.from("profiles")
            .select("user_id,username,avatar_url")
            .in("user_id", senderIds)
        : Promise.resolve({ data: [] }),
      senderIds.length
        ? admin.from("profile_preferences")
            .select("user_id,display_name")
            .in("user_id", senderIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles || []).map((item: any) => [item.user_id, item]));
    const preferenceMap = new Map((preferences || []).map((item: any) => [item.user_id, item]));

    const signedAttachments = [];
    for (const attachment of attachments || []) {
      signedAttachments.push(await signedAttachment(admin, attachment));
    }

    return json({
      ticket: {
        id: ticket.id,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        closedAt: ticket.closed_at,
        context,
      },
      messages: (messages || []).map((item: any) => {
        const profile = item.sender_id ? profileMap.get(item.sender_id) : null;
        const preference = item.sender_id ? preferenceMap.get(item.sender_id) : null;
        return {
          id: item.id,
          senderRole: item.sender_role,
          message: item.message,
          editedAt: item.edited_at,
          createdAt: item.created_at,
          sender: {
            id: item.sender_id,
            name: preference?.display_name || profile?.username || (item.sender_role === "staff" ? "CRAZZY Support" : "Usuário"),
            avatarUrl: profile?.avatar_url || null,
          },
        };
      }),
      attachments: signedAttachments,
      events: events || [],
      canReply: ticket.status !== "closed",
      canReopen: ticket.status === "closed" || ticket.status === "resolved",
    });
  }

  if (action === "message" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticket_id || "");
    const message = cleanText(body?.message, 4000);

    if (!isUuid(ticketId)) return json({ error: "INVALID_TICKET" }, 400);
    if (!message) return json({ error: "MESSAGE_REQUIRED" }, 400);

    const ticket = await getAccessibleTicket(admin, ticketId, caller.id, staff);
    if (!ticket) return json({ error: "TICKET_NOT_FOUND" }, 404);
    if (ticket.status === "closed") return json({ error: "TICKET_CLOSED" }, 409);

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", caller.id)
      .gte("created_at", since);

    if ((count || 0) >= 30) return json({ error: "MESSAGE_RATE_LIMIT" }, 429);

    const senderRole = staff ? "staff" : "user";
    const nextStatus = staff ? "waiting_user" : "waiting_staff";
    const now = new Date().toISOString();

    const { data: inserted, error } = await admin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: caller.id,
        sender_role: senderRole,
        message,
      })
      .select("id,created_at")
      .single();

    if (error || !inserted) return json({ error: "MESSAGE_SEND_FAILED" }, 500);

    await admin
      .from("support_tickets")
      .update({
        status: nextStatus,
        last_message_at: now,
        updated_at: now,
        closed_at: null,
      })
      .eq("id", ticket.id);

    await admin.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: caller.id,
      event_type: ticket.status === "resolved" ? "reopened" : "message",
      from_status: ticket.status,
      to_status: nextStatus,
      metadata: { sender_role: senderRole },
    });

    return json({
      success: true,
      messageId: inserted.id,
      status: nextStatus,
    });
  }

  if ((action === "close" || action === "reopen") && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticket_id || "");
    if (!isUuid(ticketId)) return json({ error: "INVALID_TICKET" }, 400);

    const ticket = await getAccessibleTicket(admin, ticketId, caller.id, staff);
    if (!ticket) return json({ error: "TICKET_NOT_FOUND" }, 404);

    const now = new Date().toISOString();

    if (action === "close") {
      if (ticket.status === "closed") {
        return json({ success: true, status: "closed" });
      }

      await admin.from("support_tickets").update({
        status: "closed",
        closed_at: now,
        updated_at: now,
      }).eq("id", ticket.id);

      await admin.from("support_ticket_events").insert({
        ticket_id: ticket.id,
        actor_user_id: caller.id,
        event_type: "closed",
        from_status: ticket.status,
        to_status: "closed",
      });

      return json({ success: true, status: "closed" });
    }

    if (!["closed","resolved"].includes(ticket.status)) {
      return json({ success: true, status: ticket.status });
    }

    const nextStatus = staff ? "waiting_user" : "waiting_staff";

    await admin.from("support_tickets").update({
      status: nextStatus,
      closed_at: null,
      updated_at: now,
      last_message_at: now,
    }).eq("id", ticket.id);

    await admin.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: caller.id,
      event_type: "reopened",
      from_status: ticket.status,
      to_status: nextStatus,
    });

    return json({ success: true, status: nextStatus });
  }

  if (action === "upload-url" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticket_id || "");
    const messageId = body?.message_id ? String(body.message_id) : null;
    const filename = safeFilename(body?.filename);
    const mimeType = cleanText(body?.mime_type, 100).toLowerCase();
    const sizeBytes = Number(body?.size_bytes || 0);

    if (!isUuid(ticketId)) return json({ error: "INVALID_TICKET" }, 400);
    if (messageId && !isUuid(messageId)) return json({ error: "INVALID_MESSAGE" }, 400);
    if (!ALLOWED_MIME.has(mimeType)) return json({ error: "FILE_TYPE_NOT_ALLOWED" }, 400);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
      return json({ error: "FILE_SIZE_NOT_ALLOWED" }, 400);
    }

    const ticket = await getAccessibleTicket(admin, ticketId, caller.id, staff);
    if (!ticket) return json({ error: "TICKET_NOT_FOUND" }, 404);
    if (ticket.status === "closed") return json({ error: "TICKET_CLOSED" }, 409);

    if (messageId) {
      const { data: messageRow } = await admin
        .from("support_messages")
        .select("id")
        .eq("id", messageId)
        .eq("ticket_id", ticket.id)
        .maybeSingle();

      if (!messageRow) return json({ error: "INVALID_MESSAGE" }, 400);
    }

    const { count } = await admin
      .from("support_attachments")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id);

    if ((count || 0) >= 20) return json({ error: "ATTACHMENT_LIMIT" }, 429);

    const attachmentId = crypto.randomUUID();
    const storagePath = `${ticket.user_id}/${ticket.id}/${attachmentId}-${filename}`;

    const { error: metaError } = await admin
      .from("support_attachments")
      .insert({
        id: attachmentId,
        ticket_id: ticket.id,
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
      await admin.from("support_attachments").delete().eq("id", attachmentId);
      return json({ error: "UPLOAD_URL_FAILED" }, 500);
    }

    return json({
      attachmentId,
      path: storagePath,
      token: signed.token,
      bucket: BUCKET,
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
      .from("support_attachments")
      .select("*")
      .eq("id", attachmentId)
      .maybeSingle();

    if (!attachment) return json({ error: "ATTACHMENT_NOT_FOUND" }, 404);

    const ticket = await getAccessibleTicket(
      admin,
      attachment.ticket_id,
      caller.id,
      staff
    );
    if (!ticket) return json({ error: "ATTACHMENT_NOT_FOUND" }, 404);

    if (!staff && attachment.owner_user_id !== caller.id) {
      return json({ error: "ATTACHMENT_NOT_FOUND" }, 404);
    }

    const pathParts = String(attachment.storage_path).split("/");
    const fileName = pathParts.pop() || "";
    const folder = pathParts.join("/");

    const { data: objects, error: listError } = await admin.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 20 });

    const exists = !listError && (objects || []).some((item: any) => item.name === fileName);
    if (!exists) return json({ error: "UPLOAD_NOT_FOUND" }, 409);

    await admin
      .from("support_attachments")
      .update({ status: "ready" })
      .eq("id", attachment.id);

    await admin.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      actor_user_id: caller.id,
      event_type: "attachment",
      metadata: {
        attachment_id: attachment.id,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
      },
    });

    return json({ success: true, attachmentId: attachment.id });
  }

  return json({ error: "NOT_FOUND" }, 404);
});
