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

  const [resellersResult,productsResult]=await Promise.all([
    supabase.from("resellers").select("*",{count:"exact"}).order("created_at",{ascending:false}).limit(500),
    supabase.from("products").select("id,name,slug,active,image_url").order("name"),
  ]);
  if(resellersResult.error||productsResult.error)return NextResponse.json({error:"RESELLERS_UNAVAILABLE"},{status:500});

  const resellers=resellersResult.data||[];
  const resellerIds=resellers.map(item=>item.id);
  const userIds=resellers.map(item=>item.user_id);

  const [profilesResult,discordResult,allowedResult,purchasesResult]=await Promise.all([
    userIds.length?supabase.from("profiles").select("user_id,username,avatar_url,banned").in("user_id",userIds):Promise.resolve({data:[],error:null}),
    userIds.length?supabase.from("discord_identities").select("user_id,discord_user_id,username,global_name,avatar_url,guild_member").in("user_id",userIds):Promise.resolve({data:[],error:null}),
    resellerIds.length?supabase.from("reseller_products").select("reseller_id,product_id").in("reseller_id",resellerIds):Promise.resolve({data:[],error:null}),
    resellerIds.length?supabase.rpc("admin_reseller_purchase_totals",{p_reseller_ids:resellerIds}):Promise.resolve({data:[],error:null}),
  ]);

  const profileMap=new Map((profilesResult.data||[]).map(item=>[item.user_id,item]));
  const discordMap=new Map((discordResult.data||[]).map(item=>[item.user_id,item]));
  const allowedMap=new Map<string,string[]>();
  for(const item of allowedResult.data||[]){const list=allowedMap.get(item.reseller_id)||[];list.push(item.product_id);allowedMap.set(item.reseller_id,list)}
  const purchaseMap=new Map<string,{count:number;total:number}>();
  for(const item of purchasesResult.data||[]){purchaseMap.set(item.reseller_id,{count:Number(item.count||0),total:Number(item.total||0)})}

  return NextResponse.json({
    resellers:resellers.map(item=>{
      const profile=profileMap.get(item.user_id);
      const discord=discordMap.get(item.user_id);
      const purchases=purchaseMap.get(item.id)||{count:0,total:0};
      return{
        ...item,
        customer:{
          username:profile?.username||null,
          avatar_url:profile?.avatar_url||discord?.avatar_url||null,
          banned:Boolean(profile?.banned),
          discord_user_id:discord?.discord_user_id||null,
          discord_username:discord?.global_name||discord?.username||null,
          guild_member:Boolean(discord?.guild_member),
        },
        product_ids:allowedMap.get(item.id)||[],
        purchase_count:purchases.count,
        purchase_total:purchases.total,
      };
    }),
    products:(productsResult.data||[]).filter(item=>item.active),
    totalResellers:resellersResult.count||resellers.length,
    truncated:(resellersResult.count||0)>resellers.length,
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const body=await request.json().catch(()=>({}));
  const userId=String(body?.userId||"");
  if(!/^[0-9a-f-]{36}$/i.test(userId))return NextResponse.json({error:"INVALID_USER_ID"},{status:400});

  const productIds=Array.isArray(body?.productIds)
    ? [...new Set(body.productIds.map((item:unknown)=>String(item)).filter((item:string)=>/^[0-9a-f-]{36}$/i.test(item)))]
    : [];

  const discount=Number(body?.discountPercent);
  if(!Number.isFinite(discount)||discount<0||discount>80)return NextResponse.json({error:"INVALID_DISCOUNT"},{status:400});

  let expiresAt:string|null=null;
  if(body?.expiresAt){
    const date=new Date(String(body.expiresAt));
    if(Number.isNaN(date.getTime()))return NextResponse.json({error:"INVALID_EXPIRY"},{status:400});
    expiresAt=date.toISOString();
  }

  const {data,error}=await supabase.rpc("admin_upsert_reseller",{
    p_user_id:userId,
    p_discount_percent:discount,
    p_active:body?.active!==false,
    p_expires_at:expiresAt,
    p_notes:String(body?.notes||"").slice(0,1000)||null,
    p_product_ids:productIds,
  });

  if(error||!data){
    const message=String(error?.message||"");
    const code=message.includes("CUSTOMER_NOT_FOUND")?"CUSTOMER_NOT_FOUND":message.includes("INVALID_DISCOUNT")?"INVALID_DISCOUNT":"RESELLER_SAVE_FAILED";
    return NextResponse.json({error:code},{status:400});
  }

  return NextResponse.json({reseller:data});
}
