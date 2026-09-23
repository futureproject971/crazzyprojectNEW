import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});

  const {data,error}=await supabase.rpc("get_my_reseller_snapshot");
  if(error)return NextResponse.json({error:"RESELLER_UNAVAILABLE"},{status:500});
  return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
}
