import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CODE_RE=/^[a-z0-9][a-z0-9_-]{1,63}$/;

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const code=String(body?.code||"").trim().toLowerCase();
  const source=String(body?.source||"link").trim().slice(0,80)||"link";
  if(!CODE_RE.test(code))return NextResponse.json({captured:false,error:"INVALID_CODE"},{status:400});

  const supabase=await createServerSupabaseClient();
  const {data:partner,error}=await supabase.rpc("resolve_partner_referral",{p_code:code});
  const row=Array.isArray(partner)?partner[0]:partner;
  if(error||!row?.code)return NextResponse.json({captured:false,error:"PARTNER_NOT_FOUND"},{status:404});

  const {data:{user}}=await supabase.auth.getUser();
  if(user){
    await supabase.rpc("capture_my_partner_attribution",{p_code:code,p_source:source});
  }

  const response=NextResponse.json({
    captured:true,
    code:row.code,
    displayName:row.display_name,
    attributionDays:Number(row.attribution_days||30),
  });
  response.cookies.set("crz_partner_ref",row.code,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",
    path:"/",
    maxAge:Math.max(1,Math.min(90,Number(row.attribution_days||30)))*86400,
  });
  return response;
}
