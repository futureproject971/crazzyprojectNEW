import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function mapError(message:string){
  if(message.includes("BONUS_BALANCE_LOW")) return {status:409,error:"Saldo CRAZZY BONUS insuficiente."};
  if(message.includes("BONUS_PLAN_NOT_ELIGIBLE")) return {status:409,error:"Este plano não aceita CRAZZY BONUS."};
  if(message.includes("BONUS_REDEEM_LIMIT")) return {status:409,error:"O valor excede o limite de bônus deste plano."};
  if(message.includes("BONUS_MONTHLY_LIMIT")) return {status:409,error:"Você atingiu o limite mensal de bônus deste plano."};
  if(message.includes("AUTH_REQUIRED")) return {status:401,error:"Entre com Discord para acessar sua carteira."};
  return {status:400,error:"Não foi possível concluir esta operação de CRAZZY BONUS."};
}

export async function GET(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const [wallet,catalog]=await Promise.all([
    supabase.rpc("get_my_bonus_wallet"),
    supabase.rpc("get_bonus_catalog"),
  ]);
  if(wallet.error||catalog.error)return NextResponse.json({error:"BONUS_UNAVAILABLE"},{status:500});
  return NextResponse.json({wallet:wallet.data,plans:Array.isArray(catalog.data)?catalog.data:[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>({}));
  if(body?.action!=="redeem")return NextResponse.json({error:"INVALID_ACTION"},{status:400});
  const {data,error}=await supabase.rpc("redeem_bonus",{
    p_plan_id:String(body?.planId||""),
    p_amount_cents:Math.trunc(Number(body?.amountCents)||0),
    p_idempotency_key:String(body?.idempotencyKey||""),
  });
  if(error){const mapped=mapError(error.message);return NextResponse.json({error:mapped.error},{status:mapped.status})}
  return NextResponse.json(data);
}