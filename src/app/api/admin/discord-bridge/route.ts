import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return{supabase,user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return{supabase,user,admin:!error&&data===true};
}

export async function GET(){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const [grants,worker,pending,processing,failed,granted,revoke]=await Promise.all([
    supabase.from("discord_role_grants").select("*").order("updated_at",{ascending:false}).limit(300),
    supabase.from("discord_campaign_worker_status").select("*").order("last_seen_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("discord_role_grants").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("discord_role_grants").select("id",{count:"exact",head:true}).eq("status","processing"),
    supabase.from("discord_role_grants").select("id",{count:"exact",head:true}).eq("status","failed"),
    supabase.from("discord_role_grants").select("id",{count:"exact",head:true}).eq("status","granted"),
    supabase.from("discord_role_grants").select("id",{count:"exact",head:true}).eq("desired_state","revoked").neq("status","revoked"),
  ]);
  if([grants,pending,processing,failed,granted,revoke].some(x=>x.error)){
    return NextResponse.json({error:"DISCORD_BRIDGE_UNAVAILABLE"},{status:500});
  }

  const userIds=[...new Set((grants.data||[]).map(x=>x.user_id))];
  const profiles=userIds.length?await supabase.from("profiles").select("user_id,username").in("user_id",userIds):{data:[] as any[],error:null};
  const pmap=new Map((profiles.data||[]).map(x=>[x.user_id,x]));

  return NextResponse.json({
    grants:(grants.data||[]).map(x=>({...x,customer:pmap.get(x.user_id)||null})),
    worker:worker.data||null,
    stats:{
      pending:(pending.count||0)+(processing.count||0),
      failed:failed.count||0,
      granted:granted.count||0,
      revoke:revoke.count||0,
    }
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  if(body?.action!=="requeue"||!/^[0-9a-f-]{36}$/i.test(String(body?.id||""))){
    return NextResponse.json({error:"INVALID_ACTION"},{status:400});
  }
  const {data,error}=await supabase.rpc("requeue_discord_role_grant",{p_grant_id:String(body.id)});
  if(error||data!==true)return NextResponse.json({error:"REQUEUE_FAILED"},{status:409});
  return NextResponse.json({ok:true});
}
