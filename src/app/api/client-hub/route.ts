import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ClientHubSnapshot } from "@/modules/client-hub/types";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [
    profileResult,
    rolesResult,
    discordResult,
    paymentsResult,
    ordersResult,
    entitlementsResult,
    roleGrantsResult,
    rewardDeliveriesResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,avatar_url,banned")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("discord_identities")
      .select("username,global_name,avatar_url,guild_id,guild_member,last_checked_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id,amount,status,payment_method,paid_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("order_tickets")
      .select("id,status,status_label,created_at,updated_at,payment_id,products(name),product_plans(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("entitlements")
      .select("id,status,starts_at,expires_at,tutorial_access,products(name,image_url,status,status_label,tutorial_text,tutorial_file_url),product_plans(name,plan_code)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("discord_role_grants")
      .select("id,role_name,status,granted_at,revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("reward_deliveries")
      .select("id,delivery_mode,delivered_at,expires_at")
      .eq("user_id", user.id)
      .order("delivered_at", { ascending: false })
      .limit(20),
  ]);

  if (profileResult.data?.banned) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });
  }

  const roles = (rolesResult.data || []).map((item) => text(item.role)).filter(Boolean);
  if (!roles.includes("user")) roles.push("user");
  const role = roles.includes("admin")
    ? "admin"
    : roles.includes("moderator")
      ? "moderator"
      : "user";

  const entitlements = (entitlementsResult.data || []).map((row: any) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const plan = Array.isArray(row.product_plans) ? row.product_plans[0] : row.product_plans;
    const expiredByDate = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    const effectiveStatus =
      row.status === "active" && expiredByDate ? "expired" : row.status;

    return {
      id: row.id,
      status: effectiveStatus,
      productName: text(product?.name) || "Produto CRAZZY",
      productImage: nullableText(product?.image_url),
      productStatus: text(product?.status) || "unknown",
      productStatusLabel: text(product?.status_label) || "Status indisponível",
      planName: nullableText(plan?.name),
      planCode: nullableText(plan?.plan_code),
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      tutorialAccess: Boolean(row.tutorial_access),
      hasTutorial: Boolean(product?.tutorial_text || product?.tutorial_file_url),
      _tutorialText: nullableText(product?.tutorial_text),
      _tutorialFileUrl: nullableText(product?.tutorial_file_url),
    };
  });

  const tutorials = entitlements
    .filter((item: any) => item.tutorialAccess && item.hasTutorial)
    .map((item: any) => ({
      entitlementId: item.id,
      productName: item.productName,
      productImage: item.productImage,
      tutorialText: item._tutorialText,
      tutorialFileUrl: item._tutorialFileUrl,
      entitlementStatus: item.status,
      expiresAt: item.expiresAt,
    }));

  const safeEntitlements = entitlements.map(({ _tutorialText, _tutorialFileUrl, ...item }: any) => item);

  const snapshot: ClientHubSnapshot = {
    profile: {
      username:
        profileResult.data?.username ||
        String(user.user_metadata?.preferred_username || user.user_metadata?.name || "Cliente CRAZZY"),
      avatarUrl: profileResult.data?.avatar_url || null,
      role,
      roles,
    },
    discord: {
      connected: Boolean(discordResult.data),
      username:
        discordResult.data?.global_name ||
        discordResult.data?.username ||
        null,
      avatarUrl: discordResult.data?.avatar_url || null,
      guildConfigured: Boolean(discordResult.data?.guild_id),
      guildMember: Boolean(discordResult.data?.guild_member),
      lastCheckedAt: discordResult.data?.last_checked_at || null,
    },
    stats: {
      payments: paymentsResult.data?.length || 0,
      completedPayments:
        paymentsResult.data?.filter((item) => item.status === "COMPLETED").length || 0,
      orders: ordersResult.data?.length || 0,
      activeProducts:
        safeEntitlements.filter((item: any) => item.status === "active").length,
      tutorials: tutorials.length,
      roleGrants:
        roleGrantsResult.data?.filter((item) => item.status === "granted").length || 0,
    },
    payments: (paymentsResult.data || []).map((row) => ({
      id: row.id,
      amountCents: Number(row.amount || 0),
      status: row.status,
      method: row.payment_method,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })),
    orders: (ordersResult.data || []).map((row: any) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const plan = Array.isArray(row.product_plans) ? row.product_plans[0] : row.product_plans;
      return {
        id: row.id,
        status: row.status,
        statusLabel: row.status_label,
        productName: text(product?.name) || "Produto CRAZZY",
        planName: text(plan?.name) || "Plano",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        paymentId: row.payment_id,
      };
    }),
    entitlements: safeEntitlements,
    tutorials,
    roleGrants: (roleGrantsResult.data || []).map((row) => ({
      id: row.id,
      roleName: row.role_name || "Cargo Discord",
      status: row.status,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    })),
    rewardDeliveries: (rewardDeliveriesResult.data || []).map((row) => ({
      id: row.id,
      mode: row.delivery_mode,
      deliveredAt: row.delivered_at,
      expiresAt: row.expires_at,
    })),
  };

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
