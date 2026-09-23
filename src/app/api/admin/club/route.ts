import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [
    rewardCampaigns,
    rewardSessions,
    rewardDeliveries,
    luckCampaigns,
    luckPlays,
    luckAwards,
    coupons,
    couponUsage,
    rankTiers,
  ] = await Promise.all([
    supabase.from("reward_campaigns").select("id,active", { count: "exact" }),
    supabase.from("reward_sessions").select("id,status", { count: "exact" }).limit(1000),
    supabase.from("reward_deliveries").select("id", { count: "exact", head: true }),
    supabase.from("luck_campaigns").select("id,active", { count: "exact" }),
    supabase.from("luck_plays").select("id", { count: "exact", head: true }),
    supabase.from("luck_awards").select("id,status", { count: "exact" }).limit(1000),
    supabase.from("coupons").select("id,active,current_uses,max_uses", { count: "exact" }),
    supabase.from("coupon_usage").select("id", { count: "exact", head: true }),
    supabase.from("rank_tiers").select("id", { count: "exact", head: true }),
  ]);

  const resultSets = [rewardCampaigns,rewardSessions,rewardDeliveries,luckCampaigns,luckPlays,luckAwards,coupons,couponUsage,rankTiers];
  if (resultSets.some(item => item.error)) {
    return NextResponse.json({ error: "CLUB_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  const rewardRows = rewardSessions.data || [];
  const awardRows = luckAwards.data || [];
  const couponRows = coupons.data || [];

  return NextResponse.json({
    rewards: {
      campaigns: rewardCampaigns.count || 0,
      activeCampaigns: (rewardCampaigns.data || []).filter(item => item.active).length,
      sessions: rewardSessions.count || rewardRows.length,
      pending: rewardRows.filter(item => ["completed","requested","delivering"].includes(item.status)).length,
      deliveries: rewardDeliveries.count || 0,
    },
    luck: {
      campaigns: luckCampaigns.count || 0,
      activeCampaigns: (luckCampaigns.data || []).filter(item => item.active).length,
      plays: luckPlays.count || 0,
      awards: luckAwards.count || awardRows.length,
      pendingAwards: awardRows.filter(item => item.status === "pending").length,
    },
    coupons: {
      total: coupons.count || couponRows.length,
      active: couponRows.filter(item => item.active).length,
      uses: couponUsage.count || 0,
    },
    rank: {
      tiers: rankTiers.count || 0,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
