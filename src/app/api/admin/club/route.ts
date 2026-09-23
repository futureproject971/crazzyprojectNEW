import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [
    rewardCampaigns,
    activeRewardCampaigns,
    rewardSessions,
    pendingRewardSessions,
    rewardDeliveries,
    luckCampaigns,
    activeLuckCampaigns,
    luckPlays,
    luckAwards,
    pendingLuckAwards,
    coupons,
    activeCoupons,
    couponUsage,
    rankTiers,
  ] = await Promise.all([
    supabase.from("reward_campaigns").select("id", { count: "exact", head: true }),
    supabase.from("reward_campaigns").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("reward_sessions").select("id", { count: "exact", head: true }),
    supabase.from("reward_sessions").select("id", { count: "exact", head: true }).in("status", ["completed","requested","delivering"]),
    supabase.from("reward_deliveries").select("id", { count: "exact", head: true }),
    supabase.from("luck_campaigns").select("id", { count: "exact", head: true }),
    supabase.from("luck_campaigns").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("luck_plays").select("id", { count: "exact", head: true }),
    supabase.from("luck_awards").select("id", { count: "exact", head: true }),
    supabase.from("luck_awards").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("coupons").select("id", { count: "exact", head: true }),
    supabase.from("coupons").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("coupon_usage").select("id", { count: "exact", head: true }),
    supabase.from("rank_tiers").select("id", { count: "exact", head: true }),
  ]);

  const all = [
    rewardCampaigns,activeRewardCampaigns,rewardSessions,pendingRewardSessions,rewardDeliveries,
    luckCampaigns,activeLuckCampaigns,luckPlays,luckAwards,pendingLuckAwards,
    coupons,activeCoupons,couponUsage,rankTiers
  ];
  if (all.some(item => item.error)) {
    return NextResponse.json({ error: "CLUB_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json({
    rewards: {
      campaigns: rewardCampaigns.count || 0,
      activeCampaigns: activeRewardCampaigns.count || 0,
      sessions: rewardSessions.count || 0,
      pending: pendingRewardSessions.count || 0,
      deliveries: rewardDeliveries.count || 0,
    },
    luck: {
      campaigns: luckCampaigns.count || 0,
      activeCampaigns: activeLuckCampaigns.count || 0,
      plays: luckPlays.count || 0,
      awards: luckAwards.count || 0,
      pendingAwards: pendingLuckAwards.count || 0,
    },
    coupons: {
      total: coupons.count || 0,
      active: activeCoupons.count || 0,
      uses: couponUsage.count || 0,
    },
    rank: { tiers: rankTiers.count || 0 },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
