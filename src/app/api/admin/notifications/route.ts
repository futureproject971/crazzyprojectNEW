import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function ctx(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return{supabase,user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return{supabase,user,admin:!error&&data===true};
}

export async function GET(){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const [notifications,jobs]=await Promise.all([
    supabase.from("user_notifications").select("id,user_id,notification_type,title,body,href,read_at,created_at").order("created_at",{ascending:false}).limit(200),
    supabase.from("discord_notification_jobs").select("*").order("created_at",{ascending:false}).limit(200),
  ]);
  if(notifications.error||jobs.error)return NextResponse.json({error:"NOTIFY_MANAGER_UNAVAILABLE"},{status:500});
  return NextResponse.json({notifications:notifications.data||[],jobs:jobs.data||[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const body=await request.json().catch(()=>({}));
  const userId=String(body?.userId||"");
  if(!/^[0-9a-f-]{36}$/i.test(userId))return NextResponse.json({error:"INVALID_USER_ID"},{status:400});

  const {data,error}=await supabase.rpc("admin_create_user_notification",{
    p_user_id:userId,
    p_type:String(body?.type||"info").slice(0,40),
    p_title:String(body?.title||"").trim().slice(0,180),
    p_body:String(body?.body||"").trim().slice(0,2000),
    p_href:body?.href?String(body.href).slice(0,1000):null,
    p_discord:body?.discord===true,
  });
  if(error)return NextResponse.json({error:"NOTIFICATION_CREATE_FAILED"},{status:400});
  return NextResponse.json({id:data},{status:201});
}
