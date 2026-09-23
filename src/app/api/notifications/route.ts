import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({authenticated:false,notifications:[]});
  const {data,error}=await supabase.rpc("get_my_notifications",{p_limit:100});
  if(error)return NextResponse.json({error:"NOTIFICATIONS_UNAVAILABLE"},{status:500});
  return NextResponse.json({authenticated:true,notifications:Array.isArray(data)?data:[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const body=await request.json().catch(()=>({}));
  const ids=Array.isArray(body?.ids)?body.ids.map((x:unknown)=>String(x)).filter((x:string)=>/^[0-9a-f-]{36}$/i.test(x)):null;
  const {data,error}=await supabase.rpc("mark_my_notifications_read",{p_ids:ids?.length?ids:null});
  if(error)return NextResponse.json({error:"NOTIFICATION_UPDATE_FAILED"},{status:500});
  return NextResponse.json({updated:Number(data||0)});
}
