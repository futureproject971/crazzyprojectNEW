import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function ctx() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const { data, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, admin: !error && data === true };
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function uuid(value: unknown) {
  const text = clean(value, 36);
  return /^[0-9a-f-]{36}$/i.test(text) ? text : null;
}

export async function GET() {
  const { supabase, user, admin } = await ctx();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [campaigns, links, sessions, deliveries, products, plans, trialStock] = await Promise.all([
    supabase.from("reward_campaigns").select("*").order("sort_order").order("created_at"),
    supabase.from("reward_campaign_products").select("*").order("sort_order").order("created_at"),
    supabase.from("reward_sessions").select("id,user_id,campaign_id,campaign_product_id,status,watched_seconds,started_at,completed_at,requested_at,eligible_delivery_at,delivered_at,cooldown_until,created_at,updated_at").order("created_at",{ascending:false}).limit(200),
    supabase.from("reward_deliveries").select("id,session_id,user_id,delivery_mode,delivered_at,expires_at").order("delivered_at",{ascending:false}).limit(200),
    supabase.from("products").select("id,name,slug,active,image_url").eq("active",true).order("name"),
    supabase.from("product_plans").select("id,product_id,name,plan_code,active").eq("active",true).order("sort_order"),
    supabase.rpc("admin_reward_stock_counts"),
  ]);

  const all=[campaigns,links,sessions,deliveries,products,plans,trialStock];
  if(all.some(x=>x.error)) return NextResponse.json({error:"REWARD_MANAGER_UNAVAILABLE"},{status:500});

  const userIds=[...new Set((sessions.data||[]).map(x=>x.user_id).filter(Boolean))];
  const profiles=userIds.length
    ? await supabase.from("profiles").select("user_id,username,avatar_url").in("user_id",userIds)
    : {data:[] as any[],error:null};
  const profileMap=new Map((profiles.data||[]).map(x=>[x.user_id,x]));

  const stockMap=new Map<string,{total:number;available:number}>();
  for(const item of (trialStock.data||[]) as Array<{product_plan_id:string;total:number;available:number}>){
    stockMap.set(item.product_plan_id,{total:Number(item.total||0),available:Number(item.available||0)});
  }

  return NextResponse.json({
    campaigns: campaigns.data || [],
    campaignProducts: links.data || [],
    sessions: (sessions.data||[]).map(item=>({...item,customer:profileMap.get(item.user_id)||null})),
    deliveries: deliveries.data || [],
    products: products.data || [],
    plans: (plans.data||[]).map(item=>({...item,trial_stock:stockMap.get(item.id)||{total:0,available:0}})),
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request: NextRequest) {
  const { supabase, user, admin } = await ctx();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body=await request.json().catch(()=>({}));
  const action=clean(body?.action,40);

  if(action==="save_campaign"){
    const id=uuid(body?.id);
    const title=clean(body?.title,120);
    const description=clean(body?.description,1000);
    const videoUrl=clean(body?.videoUrl,1200);
    const watch=Math.trunc(Number(body?.requiredWatchSeconds));
    const cooldown=Math.trunc(Number(body?.cooldownHours));
    const sort=Math.trunc(Number(body?.sortOrder)||0);
    if(!title||!videoUrl||!Number.isFinite(watch)||watch<10||watch>7200||!Number.isFinite(cooldown)||cooldown<0||cooldown>8760){
      return NextResponse.json({error:"INVALID_CAMPAIGN"},{status:400});
    }
    const payload={
      title,description,video_url:videoUrl,
      video_provider:videoUrl.includes("youtu")?"youtube":"video",
      required_watch_seconds:watch,cooldown_hours:cooldown,
      active:body?.active!==false,sort_order:sort,updated_at:new Date().toISOString(),
    };
    const query=id
      ? supabase.from("reward_campaigns").update(payload).eq("id",id).select().single()
      : supabase.from("reward_campaigns").insert(payload).select().single();
    const {data,error}=await query;
    if(error||!data)return NextResponse.json({error:"CAMPAIGN_SAVE_FAILED"},{status:400});
    return NextResponse.json({campaign:data},{status:id?200:201});
  }

  if(action==="save_product"){
    const id=uuid(body?.id);
    const campaignId=uuid(body?.campaignId);
    const productId=uuid(body?.productId);
    const planId=body?.planId?uuid(body.planId):null;
    const duration=Math.trunc(Number(body?.trialDurationMinutes));
    const delay=Math.trunc(Number(body?.autoDelaySeconds)||0);
    const sort=Math.trunc(Number(body?.sortOrder)||0);
    const mode=clean(body?.deliveryMode,20);
    if(!campaignId||!productId||!Number.isFinite(duration)||duration<1||duration>10080||!["manual","automatic"].includes(mode)||delay<0||delay>86400){
      return NextResponse.json({error:"INVALID_REWARD_PRODUCT"},{status:400});
    }
    const payload={
      campaign_id:campaignId,product_id:productId,product_plan_id:planId,
      trial_duration_minutes:duration,delivery_mode:mode,auto_delay_seconds:delay,
      active:body?.active!==false,sort_order:sort,
    };
    const query=id
      ? supabase.from("reward_campaign_products").update(payload).eq("id",id).select().single()
      : supabase.from("reward_campaign_products").insert(payload).select().single();
    const {data,error}=await query;
    if(error||!data)return NextResponse.json({error:"REWARD_PRODUCT_SAVE_FAILED"},{status:400});
    return NextResponse.json({campaignProduct:data},{status:id?200:201});
  }

  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
