import {NextRequest,NextResponse} from "next/server";
import {createServerSupabaseClient} from "@/lib/supabase/server";

async function ctx(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return{supabase,user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return{supabase,user,admin:!error&&data===true};
}

export async function GET(request:NextRequest){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const q=String(request.nextUrl.searchParams.get("q")||"").trim();
  const [snapshot,candidates]=await Promise.all([
    supabase.rpc("admin_partner_manager_snapshot"),
    q.length>=2?supabase.rpc("admin_partner_search_users",{p_query:q,p_limit:20}):Promise.resolve({data:[],error:null} as any),
  ]);
  if(snapshot.error||candidates.error)return NextResponse.json({error:"PARTNER_MANAGER_UNAVAILABLE"},{status:500});
  return NextResponse.json({...snapshot.data,candidates:candidates.data||[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  const action=String(body?.action||"");

  if(action==="save_partner"){
    const {data,error}=await supabase.rpc("admin_upsert_partner",{
      p_id:body?.id||null,
      p_user_id:String(body?.userId||""),
      p_code:String(body?.code||""),
      p_display_name:String(body?.displayName||""),
      p_commission_percent:Number(body?.commissionPercent??15),
      p_attribution_days:Number(body?.attributionDays??30),
      p_commission_hold_days:Number(body?.holdDays??7),
      p_active:body?.active!==false,
      p_notes:String(body?.notes||"")||null,
    });
    if(error)return NextResponse.json({error:"PARTNER_SAVE_FAILED",detail:String(error.message||"").slice(0,180)},{status:400});
    return NextResponse.json({id:data});
  }

  if(action==="payout_available"){
    const partnerId=String(body?.partnerId||"");
    if(!/^[0-9a-f-]{36}$/i.test(partnerId))return NextResponse.json({error:"INVALID_PARTNER_ID"},{status:400});
    const {data,error}=await supabase.rpc("admin_pay_partner_available",{
      p_partner_id:partnerId,
      p_reference:String(body?.reference||"")||null,
      p_notes:String(body?.notes||"")||null,
    });
    if(error)return NextResponse.json({error:"PARTNER_PAYOUT_FAILED",detail:String(error.message||"").slice(0,180)},{status:400});
    return NextResponse.json(data);
  }

  if(action==="set_rule"){
    const {data,error}=await supabase.rpc("admin_set_partner_plan_rule",{
      p_partner_id:String(body?.partnerId||""),
      p_product_plan_id:String(body?.planId||""),
      p_enabled:body?.enabled===true,
      p_commission_percent:body?.commissionPercent===null||body?.commissionPercent===""?null:Number(body?.commissionPercent),
    });
    if(error)return NextResponse.json({error:"PARTNER_RULE_FAILED",detail:String(error.message||"").slice(0,180)},{status:400});
    return NextResponse.json({ok:data===true});
  }

  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
