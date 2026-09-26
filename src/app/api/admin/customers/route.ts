import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, isAdmin: !error && isAdmin === true };
}

export async function GET(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const userId = String(request.nextUrl.searchParams.get("userId") || "").trim();

  if (userId) {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400 });
    const { data, error } = await supabase.rpc("admin_customer_snapshot", { p_user_id: userId });
    if (error || !data) {
      const notFound = String(error?.message || "").includes("CUSTOMER_NOT_FOUND");
      return NextResponse.json({ error: notFound ? "CUSTOMER_NOT_FOUND" : "CUSTOMER_DETAIL_UNAVAILABLE" }, { status: notFound ? 404 : 500 });
    }
    const [wallet,rewards,luck,coupons] = await Promise.all([
      supabase.from("bonus_wallets").select("balance_cents,updated_at").eq("user_id",userId).maybeSingle(),
      supabase.from("reward_sessions").select("id,status,created_at,products(name)",{count:"exact"}).eq("user_id",userId).order("created_at",{ascending:false}).limit(20),
      supabase.from("luck_plays").select("id,status,result,created_at",{count:"exact"}).eq("user_id",userId).order("created_at",{ascending:false}).limit(20),
      supabase.from("coupon_users").select("coupon_id,coupons(code,active,expires_at)",{count:"exact"}).eq("user_id",userId).limit(20),
    ]);
    if([wallet,rewards,luck,coupons].some(item=>item.error)) return NextResponse.json({error:"CUSTOMER_CLUB_UNAVAILABLE"},{status:500});
    const customer = {
      ...data,
      club: {
        bonus_balance_cents: Number(wallet.data?.balance_cents || 0),
        reward_sessions: rewards.count || 0,
        luck_plays: luck.count || 0,
        coupons: coupons.count || 0,
        recent_rewards: rewards.data || [],
        recent_luck: luck.data || [],
        recent_coupons: coupons.data || [],
      },
    };
    return NextResponse.json({ customer }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const q = String(request.nextUrl.searchParams.get("q") || "").trim().slice(0, 160);
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 50;

  const { data, error } = await supabase.rpc("admin_customer_search", { p_query: q || null, p_limit: limit });
  if (error) return NextResponse.json({ error: "CUSTOMER_SEARCH_UNAVAILABLE" }, { status: 500 });

  return NextResponse.json({ customers: Array.isArray(data) ? data : [] }, { headers: { "Cache-Control": "private, no-store" } });
}
