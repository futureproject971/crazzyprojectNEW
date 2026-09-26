import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,user:null,admin:false};
  const {data}=await supabase.rpc("is_current_admin");
  return {supabase,user,admin:data===true};
}
const clean=(v:unknown,max=500)=>String(v??"").trim().slice(0,max);
const uuid=(v:unknown)=>{const s=clean(v,36);return /^[0-9a-f-]{36}$/i.test(s)?s:null};
const slug=(v:unknown)=>clean(v,80).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

export async function GET(){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const [campaigns,prizes,plays,awards,products,plans]=await Promise.all([
    supabase.from("luck_campaigns").select("*").order("sort_order").order("created_at"),
    supabase.from("luck_prizes").select("*").order("campaign_id").order("sort_order"),
    supabase.from("luck_plays").select("id,user_id,campaign_id,prize_id,status,result,created_at").order("created_at",{ascending:false}).limit(200),
    supabase.from("luck_awards").select("*").order("created_at",{ascending:false}).limit(200),
    supabase.from("products").select("id,name,active").eq("active",true).order("name"),
    supabase.from("product_plans").select("id,product_id,name,active").eq("active",true).order("sort_order"),
  ]);
  if([campaigns,prizes,plays,awards,products,plans].some(x=>x.error))return NextResponse.json({error:"LUCK_MANAGER_UNAVAILABLE"},{status:500});
  const planRows=plans.data||[];
  const productRows=(products.data||[]).map(product=>({...product,plans:planRows.filter(plan=>plan.product_id===product.id)}));
  return NextResponse.json({campaigns:campaigns.data||[],prizes:prizes.data||[],plays:plays.data||[],awards:awards.data||[],products:productRows},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  const action=clean(body?.action,40);
  if(action==="save_campaign"){
    const id=uuid(body?.id), mode=clean(body?.mode,20), title=clean(body?.title,120), campaignSlug=slug(body?.slug||title);
    const cost=Math.trunc(Number(body?.bonusCostCents)||0), sort=Math.trunc(Number(body?.sortOrder)||0);
    if(!["wheel","scratch","drop"].includes(mode)||!title||!campaignSlug||cost<0)return NextResponse.json({error:"INVALID_LUCK_CAMPAIGN"},{status:400});
    const payload={slug:campaignSlug,mode,title,description:clean(body?.description,1000),active:body?.active!==false,daily_group:"bonus-arcade",free_plays_per_day:0,play_price_cents:0,bonus_cost_cents:cost,sort_order:sort,updated_at:new Date().toISOString()};
    const q=id?supabase.from("luck_campaigns").update(payload).eq("id",id).select().single():supabase.from("luck_campaigns").insert(payload).select().single();
    const {data,error}=await q;if(error||!data)return NextResponse.json({error:"LUCK_CAMPAIGN_SAVE_FAILED"},{status:400});
    return NextResponse.json({campaign:data},{status:id?200:201});
  }
  if(action==="save_prize"){
    const id=uuid(body?.id),campaignId=uuid(body?.campaignId),label=clean(body?.label,120),prizeType=clean(body?.prizeType,30);
    const weight=Math.trunc(Number(body?.weight)),sort=Math.trunc(Number(body?.sortOrder)||0);
    const stockRaw=body?.stockLimit,stockLimit=stockRaw===null||stockRaw===""||stockRaw===undefined?null:Math.trunc(Number(stockRaw));
    if(!campaignId||!label||!["coupon","bonus","product","reward","none"].includes(prizeType)||!Number.isFinite(weight)||weight<1||(stockLimit!==null&&stockLimit<1))return NextResponse.json({error:"INVALID_LUCK_PRIZE"},{status:400});
    let config:Record<string,unknown>={};
    if(prizeType==="coupon"){
      const discountType=clean(body?.discountType,20),discountValue=Number(body?.discountValue),minOrder=Number(body?.minOrderValue||0),expiresHours=Math.trunc(Number(body?.expiresHours||72));
      if(!["percentage","fixed"].includes(discountType)||discountValue<=0||minOrder<0||expiresHours<1)return NextResponse.json({error:"INVALID_LUCK_PRIZE"},{status:400});
      config={discount_type:discountType,discount_value:discountValue,min_order_value:minOrder,expires_hours:expiresHours};
    }else if(prizeType==="bonus"){
      const bonusCents=Math.trunc(Number(body?.bonusCents)||0);if(bonusCents<=0)return NextResponse.json({error:"INVALID_LUCK_PRIZE"},{status:400});config={bonus_cents:bonusCents};
    }else if(prizeType==="product"){
      const productId=uuid(body?.productId),planId=body?.productPlanId?uuid(body.productPlanId):null,duration=Math.trunc(Number(body?.durationMinutes)||0);
      if(!productId)return NextResponse.json({error:"INVALID_LUCK_PRIZE"},{status:400});
      config={product_id:productId,product_plan_id:planId,duration_minutes:duration>0?duration:null};
    }else if(prizeType==="reward"){
      config={note:clean(body?.note,500)};
    }
    const payload={campaign_id:campaignId,label,prize_type:prizeType,weight,active:body?.active!==false,sort_order:sort,stock_limit:stockLimit,config,updated_at:new Date().toISOString()};
    const q=id?supabase.from("luck_prizes").update(payload).eq("id",id).select().single():supabase.from("luck_prizes").insert(payload).select().single();
    const {data,error}=await q;if(error||!data)return NextResponse.json({error:"LUCK_PRIZE_SAVE_FAILED"},{status:400});
    return NextResponse.json({prize:data},{status:id?200:201});
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}