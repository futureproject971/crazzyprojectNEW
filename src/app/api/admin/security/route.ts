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

  const [events,alerts,credentials,critical,high,open,resolved]=await Promise.all([
    supabase.from("security_events").select("*").order("last_seen_at",{ascending:false}).limit(300),
    supabase.from("control_center_alerts").select("*").order("created_at",{ascending:false}).limit(200),
    supabase.from("system_credentials").select("env_key,value").in("env_key",["DISCORD_SECURITY_CHANNEL_ID","DISCORD_SECURITY_ROLE_ID"]),
    supabase.from("security_events").select("id",{count:"exact",head:true}).eq("severity","critical").neq("status","resolved"),
    supabase.from("security_events").select("id",{count:"exact",head:true}).eq("severity","high").neq("status","resolved"),
    supabase.from("security_events").select("id",{count:"exact",head:true}).eq("status","open"),
    supabase.from("security_events").select("id",{count:"exact",head:true}).eq("status","resolved"),
  ]);
  if([events,alerts,credentials,critical,high,open,resolved].some(x=>x.error)){
    return NextResponse.json({error:"SECURITY_MANAGER_UNAVAILABLE"},{status:500});
  }

  const config=new Map((credentials.data||[]).map(x=>[x.env_key,Boolean(String(x.value||"").trim())]));
  return NextResponse.json({
    events:events.data||[],
    alerts:alerts.data||[],
    stats:{
      critical:critical.count||0,
      high:high.count||0,
      open:open.count||0,
      resolved:resolved.count||0,
    },
    config:{
      channelConfigured:config.get("DISCORD_SECURITY_CHANNEL_ID")===true,
      criticalRoleConfigured:config.get("DISCORD_SECURITY_ROLE_ID")===true,
    }
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  const action=String(body?.action||"");
  if(action==="set_status"){
    const eventId=String(body?.eventId||"");
    const status=String(body?.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(eventId)||!["open","acknowledged","resolved"].includes(status))return NextResponse.json({error:"INVALID_STATUS"},{status:400});
    const {data,error}=await supabase.rpc("set_security_event_status",{p_event_id:eventId,p_status:status});
    if(error||data!==true)return NextResponse.json({error:"SECURITY_STATUS_FAILED"},{status:409});
    return NextResponse.json({ok:true});
  }
  if(action==="set_discord"){
    const channelId=String(body?.channelId||"").trim();
    const roleId=String(body?.roleId||"").trim();
    const {data,error}=await supabase.rpc("set_security_discord_config",{p_channel_id:channelId,p_role_id:roleId||null});
    if(error)return NextResponse.json({error:"SECURITY_CONFIG_FAILED"},{status:400});
    return NextResponse.json(data);
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
