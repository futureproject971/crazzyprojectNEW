import { NextRequest, NextResponse } from "next/server";
import { communityAuthHeader, communityEdgeUrl, proxyCommunityJson } from "@/app/api/community/_shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function isAdmin(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return{user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return{user,admin:!error&&data===true};
}

export async function GET(){
  const context=await isAdmin();
  if(!context.user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!context.admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const authorization=await communityAuthHeader();
  if(!authorization)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});

  const response=await fetch(communityEdgeUrl("mod-snapshot"),{cache:"no-store",headers:{Accept:"application/json",Authorization:authorization}});
  const proxied=await proxyCommunityJson(response);
  return NextResponse.json(proxied.body,{status:proxied.status,headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const context=await isAdmin();
  if(!context.user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!context.admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const authorization=await communityAuthHeader();
  if(!authorization)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});

  const body=await request.json().catch(()=>({}));
  const response=await fetch(communityEdgeUrl("mod-action"),{
    method:"POST",
    cache:"no-store",
    headers:{Accept:"application/json","Content-Type":"application/json",Authorization:authorization},
    body:JSON.stringify({
      moderation_action:body?.action,
      message_id:body?.messageId,
      target_user_id:body?.targetUserId,
      reason:body?.reason,
    }),
  });
  const proxied=await proxyCommunityJson(response);
  return NextResponse.json(proxied.body,{status:proxied.status,headers:{"Cache-Control":"private, no-store"}});
}
