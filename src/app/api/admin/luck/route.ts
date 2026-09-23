import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const { data, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, admin: !error && data === true };
}
function clean(value: unknown, max=500) { return String(value ?? "").trim().slice(0,max); }
function asUuid(value: unknown) {
  const text=clean(value,36);
  return /^[0-9a-f-]{36}$/i.test(text)?text:null;
}
function slug(value: unknown) {
  return clean(value,80).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

export async function GET() {
  const { supabase,user,admin }=await context();
  if(!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin) return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const [campaigns,prizes,plays,awards]=await Promise.all([
    supabase.from("luck_campaigns").select("*").order("sort_order").order("created_at"),
    supabase.from("luck_prizes").select("*").order("campaign_id").order("sort_order"),
    supabase.from("luck_plays").select("id,user_id,campaign_id,prize_id,status,created_at").order("created_at",{ascending:false}).limit(200),
    supabase.from("luck_awards").select("id,user_id,play_id,prize_id,prize_type,status,delivered_at,created_at,updated_at").order("created_at",{ascending:false}).limit(200),
  ]);
  if([campaigns,prizes,plays,awards].some(x=>x.error)) return NextResponse.json({error:"LUCK_MANAGER_UNAVAILABLE"},{status:500});
  return NextResponse.json({
    campaigns:campaigns.data||[],prizes:prizes.data||[],plays:plays.data||[],awards:awards.data||[]
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const { supabase,user,admin }=await context();
  if(!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin) return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  const action=clean(body?.action,40);

  if(action==="save_campaign"){
    const id=asUuid(body?.id);
    const mode=clean(body?.mode,20);
    const title=clean(body?.title,120);
    const campaignSlug=slug(body?.slug||title);
    const free=Math.trunc(Number(body?.freePlaysPerDay));
    const price=Math.trunc(Number(body?.playPriceCents)||0);
    const sort=Math.trunc(Number(body?.sortOrder)||0);
    if(!["wheel","scratch","drop"].includes(mode)||!title||!campaignSlug||!Number.isFinite(free)||free<0||free>20||price<0){
      return NextResponse.json({error:"INVALID_LUCK_CAMPAIGN"},{status:400});
    }
    const payload={
      slug:campaignSlug,mode,title,description:clean(body?.description,1000),
      active:body?.active!==false,daily_group:clean(body?.dailyGroup,80)||"daily-luck",
      free_plays_per_day:free,play_price_cents:price,sort_order:sort,updated_at:new Date().toISOString()
    };
    const query=id
      ? supabase.from("luck_campaigns").update(payload).eq("id",id).select().single()
      : supabase.from("luck_campaigns").insert(payload).select().single();
    const {data,error}=await query;
    if(error||!data)return NextResponse.json({error:"LUCK_CAMPAIGN_SAVE_FAILED"},{status:400});
    return NextResponse.json({campaign:data},{status:id?200:201});
  }

  if(action==="save_prize"){
    const id=asUuid(body?.id);
    const campaignId=asUuid(body?.campaignId);
    const label=clean(body?.label,120);
    const prizeType=clean(body?.prizeType,30);
    const weight=Math.trunc(Number(body?.weight));
    const stockRaw=body?.stockLimit;
    const stockLimit=stockRaw===null||stockRaw===""||stockRaw===undefined?null:Math.trunc(Number(stockRaw));
    const sort=Math.trunc(Number(body?.sortOrder)||0);
    const discountType=clean(body?.discountType,20);
    const discountValue=Number(body?.discountValue);
    const minOrder=Number(body?.minOrderValue||0);
    const expiresHours=Math.trunc(Number(body?.expiresHours||72));
    if(!campaignId||!label||prizeType!=="coupon"||!Number.isFinite(weight)||weight<1||weight>100000||
       (stockLimit!==null&&(!Number.isFinite(stockLimit)||stockLimit<1))||
       !["percentage","fixed"].includes(discountType)||!Number.isFinite(discountValue)||discountValue<=0||
       minOrder<0||expiresHours<1||expiresHours>8760){
      return NextResponse.json({error:"INVALID_LUCK_PRIZE"},{status:400});
    }
    const config={discount_type:discountType,discount_value:discountValue,min_order_value:minOrder,expires_hours:expiresHours};
    const payload={campaign_id:campaignId,label,prize_type:"coupon",weight,active:body?.active!==false,sort_order:sort,stock_limit:stockLimit,config,updated_at:new Date().toISOString()};
    const query=id
      ? supabase.from("luck_prizes").update(payload).eq("id",id).select().single()
      : supabase.from("luck_prizes").insert(payload).select().single();
    const {data,error}=await query;
    if(error||!data)return NextResponse.json({error:"LUCK_PRIZE_SAVE_FAILED"},{status:400});
    return NextResponse.json({prize:data},{status:id?200:201});
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
