import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,user:null,admin:false};
  const {data}=await supabase.rpc("is_current_admin");
  return {supabase,user,admin:data===true};
}
const n=(v:unknown)=>Math.max(0,Math.trunc(Number(v)||0));

export async function GET(){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const [plans,rules,wallets,transactions,redemptions]=await Promise.all([
    supabase.from("product_plans").select("id,product_id,name,price,active,plan_code,products!inner(id,name,slug,active)").order("created_at"),
    supabase.from("bonus_plan_rules").select("*"),
    supabase.from("bonus_wallets").select("*").order("updated_at",{ascending:false}).limit(100),
    supabase.from("bonus_transactions").select("*").order("created_at",{ascending:false}).limit(200),
    supabase.from("bonus_redemptions").select("*").order("created_at",{ascending:false}).limit(200),
  ]);
  if([plans,rules,wallets,transactions,redemptions].some(x=>x.error))return NextResponse.json({error:"BONUS_MANAGER_UNAVAILABLE"},{status:500});
  return NextResponse.json({plans:plans.data||[],rules:rules.data||[],wallets:wallets.data||[],transactions:transactions.data||[],redemptions:redemptions.data||[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  if(body?.action==="save_rule"){
    const payload={
      plan_id:String(body.planId||""),
      grant_bonus_cents:n(body.grantBonusCents),
      expires_days:body.expiresDays?Math.max(1,Math.min(3650,n(body.expiresDays))):null,
      accepts_bonus:body.acceptsBonus===true,
      max_bonus_percent:Math.max(0,Math.min(90,Number(body.maxBonusPercent)||0)),
      max_bonus_cents:n(body.maxBonusCents),
      monthly_limit_cents:n(body.monthlyLimitCents),
      active:body.active!==false,
      updated_at:new Date().toISOString(),
    };
    const {data,error}=await supabase.from("bonus_plan_rules").upsert(payload,{onConflict:"plan_id"}).select().single();
    if(error)return NextResponse.json({error:"BONUS_RULE_SAVE_FAILED"},{status:400});
    return NextResponse.json({rule:data});
  }
  if(body?.action==="adjust"){
    const amount=Math.trunc(Number(body.amountCents)||0);
    const {data,error}=await supabase.rpc("admin_adjust_bonus",{
      p_user_id:String(body.userId||""),
      p_amount_cents:amount,
      p_description:String(body.description||"Ajuste administrativo").slice(0,240),
      p_idempotency_key:String(body.idempotencyKey||""),
    });
    if(error)return NextResponse.json({error:"BONUS_ADJUST_FAILED"},{status:400});
    return NextResponse.json(data);
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}