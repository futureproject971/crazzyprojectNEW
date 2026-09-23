import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return {supabase,user,admin:!error&&data===true};
}

export async function GET(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const paymentId=String(request.nextUrl.searchParams.get("paymentId")||"").trim();
  const status=String(request.nextUrl.searchParams.get("status")||"").trim();

  let runsQuery=supabase.from("fulfillment_runs").select("*").order("updated_at",{ascending:false}).limit(200);
  if(status)runsQuery=runsQuery.eq("status",status);
  if(paymentId)runsQuery=runsQuery.eq("payment_id",paymentId);

  const {data:runs,error}=await runsQuery;
  if(error)return NextResponse.json({error:"FULFILLMENT_UNAVAILABLE"},{status:500});

  const paymentIds=(runs||[]).map(item=>item.payment_id);
  const [payments,tickets,events]=await Promise.all([
    paymentIds.length?supabase.from("payments").select("id,user_id,amount,status,payment_method,paid_at,created_at").in("id",paymentIds):Promise.resolve({data:[],error:null}),
    paymentIds.length?supabase.from("order_tickets").select("id,payment_id,user_id,product_id,product_plan_id,stock_item_id,status,status_label,created_at,updated_at").in("payment_id",paymentIds):Promise.resolve({data:[],error:null}),
    paymentIds.length?supabase.from("fulfillment_events").select("*").in("payment_id",paymentIds).order("created_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  ]);

  const userIds=[...new Set((payments.data||[]).map(item=>item.user_id))];
  const profiles=userIds.length?await supabase.from("profiles").select("user_id,username,avatar_url").in("user_id",userIds):{data:[] as any[],error:null};
  const profileMap=new Map((profiles.data||[]).map(x=>[x.user_id,x]));
  const paymentMap=new Map((payments.data||[]).map(x=>[x.id,{...x,customer:profileMap.get(x.user_id)||null}]));

  return NextResponse.json({
    runs:(runs||[]).map(run=>({
      ...run,
      payment:paymentMap.get(run.payment_id)||null,
      tickets:(tickets.data||[]).filter(item=>item.payment_id===run.payment_id),
      events:(events.data||[]).filter(item=>item.payment_id===run.payment_id),
    })),
  },{headers:{"Cache-Control":"private, no-store"}});
}
