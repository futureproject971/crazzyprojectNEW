import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function context(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,user:null,admin:false};
  const {data,error}=await supabase.rpc("is_current_admin");
  return {supabase,user,admin:!error&&data===true};
}
function clean(v:unknown,max=500){return String(v??"").trim().slice(0,max)}
function uuid(v:unknown){const s=clean(v,36);return /^[0-9a-f-]{36}$/i.test(s)?s:null}

export async function GET(){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const [coupons,products,games,links,users,usage]=await Promise.all([
    supabase.from("coupons").select("*").order("created_at",{ascending:false}).limit(500),
    supabase.from("products").select("id,name,slug,active,image_url,game_id").eq("active",true).order("name"),
    supabase.from("games").select("id,name,slug,active").eq("active",true).order("name"),
    supabase.from("coupon_products").select("coupon_id,product_id"),
    supabase.from("coupon_users").select("coupon_id,user_id"),
    supabase.rpc("admin_coupon_usage_counts"),
  ]);
  if([coupons,products,games,links,users,usage].some(x=>x.error))return NextResponse.json({error:"COUPON_MANAGER_UNAVAILABLE"},{status:500});

  const userIds=[...new Set((users.data||[]).map(x=>x.user_id))];
  const profiles=userIds.length
    ? await supabase.from("profiles").select("user_id,username,avatar_url").in("user_id",userIds)
    : {data:[] as any[],error:null};
  const profileMap=new Map((profiles.data||[]).map(x=>[x.user_id,x]));

  const productMap=new Map<string,string[]>();
  for(const item of links.data||[]){const list=productMap.get(item.coupon_id)||[];list.push(item.product_id);productMap.set(item.coupon_id,list)}
  const userMap=new Map<string,any[]>();
  for(const item of users.data||[]){const list=userMap.get(item.coupon_id)||[];list.push({...item,profile:profileMap.get(item.user_id)||null});userMap.set(item.coupon_id,list)}
  const usageMap=new Map<string,number>();
  for(const item of usage.data||[])usageMap.set(item.coupon_id,Number(item.uses||0));

  return NextResponse.json({
    coupons:(coupons.data||[]).map(item=>({...item,product_ids:productMap.get(item.id)||[],users:userMap.get(item.id)||[],real_uses:usageMap.get(item.id)||0})),
    products:products.data||[],
    categories:games.data||[]
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await context();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body=await request.json().catch(()=>({}));
  if(clean(body?.action,40)!=="save_coupon")return NextResponse.json({error:"INVALID_ACTION"},{status:400});

  const id=body?.id?uuid(body.id):null;
  const requestedProductIds=Array.isArray(body?.productIds)?[...new Set(body.productIds.map(uuid).filter(Boolean))]:[];
  const categoryIds=Array.isArray(body?.categoryIds)?[...new Set(body.categoryIds.map(uuid).filter(Boolean))]:[];
  const scopeMode=["all","selected","categories","exclude"].includes(clean(body?.scopeMode,20))?clean(body?.scopeMode,20):"all";
  if(scopeMode==="selected"&&!requestedProductIds.length)return NextResponse.json({error:"Selecione pelo menos um produto."},{status:400});
  if(scopeMode==="categories"&&!categoryIds.length)return NextResponse.json({error:"Selecione pelo menos uma categoria."},{status:400});
  const userIds=Array.isArray(body?.userIds)?[...new Set(body.userIds.map(uuid).filter(Boolean))]:[];
  let expiresAt:string|null=null;
  if(body?.expiresAt){const d=new Date(String(body.expiresAt));if(Number.isNaN(d.getTime()))return NextResponse.json({error:"INVALID_EXPIRY"},{status:400});expiresAt=d.toISOString()}

  const {data,error}=await supabase.rpc("admin_save_scoped_coupon",{
    p_id:id,
    p_code:clean(body?.code,40),
    p_discount_type:clean(body?.discountType,20),
    p_discount_value:Number(body?.discountValue),
    p_max_uses:body?.maxUses===null||body?.maxUses===""||body?.maxUses===undefined?null:Math.trunc(Number(body.maxUses)),
    p_min_order_value:Number(body?.minOrderValue||0),
    p_active:body?.active!==false,
    p_expires_at:expiresAt,
    p_origin:clean(body?.origin,30)||"admin",
    p_product_ids:requestedProductIds,
    p_scope_mode:scopeMode,
    p_category_ids:categoryIds,
    p_user_ids:userIds,
  });
  if(error||!data){
    const msg=String(error?.message||"");
    const code=msg.includes("duplicate key")?"COUPON_CODE_EXISTS":msg.includes("INVALID_")?msg.match(/INVALID_[A-Z_]+/)?.[0]||"INVALID_COUPON":"COUPON_SAVE_FAILED";
    return NextResponse.json({error:code},{status:400});
  }
  return NextResponse.json(data,{status:id?200:201});
}
