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

  const [tutorials,blocks,links,products]=await Promise.all([
    supabase.from("academy_tutorials").select("*").order("sort_order").order("created_at"),
    supabase.from("academy_tutorial_blocks").select("*").order("tutorial_id").order("position"),
    supabase.from("academy_tutorial_products").select("tutorial_id,product_id"),
    supabase.from("products").select("id,name,slug,active,image_url").order("name"),
  ]);
  if([tutorials,blocks,links,products].some(x=>x.error))return NextResponse.json({error:"ACADEMY_MANAGER_UNAVAILABLE"},{status:500});

  const blockMap=new Map<string,any[]>();
  for(const block of blocks.data||[]){const list=blockMap.get(block.tutorial_id)||[];list.push(block);blockMap.set(block.tutorial_id,list)}
  const productMap=new Map<string,string[]>();
  for(const link of links.data||[]){const list=productMap.get(link.tutorial_id)||[];list.push(link.product_id);productMap.set(link.tutorial_id,list)}

  return NextResponse.json({
    tutorials:(tutorials.data||[]).map(t=>({...t,blocks:blockMap.get(t.id)||[],product_ids:productMap.get(t.id)||[]})),
    products:(products.data||[]).filter(p=>p.active),
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
  const {supabase,user,admin}=await ctx();
  if(!user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  if(!admin)return NextResponse.json({error:"FORBIDDEN"},{status:403});

  const body=await request.json().catch(()=>({}));
  const id=body?.id?String(body.id):null;
  if(id&&!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"INVALID_ID"},{status:400});

  const productIds=Array.isArray(body?.productIds)
    ? [...new Set(body.productIds.map((x:unknown)=>String(x)).filter((x:string)=>/^[0-9a-f-]{36}$/i.test(x)))]
    : [];

  const blocks=Array.isArray(body?.blocks)?body.blocks:[];
  if(blocks.length>200)return NextResponse.json({error:"TOO_MANY_BLOCKS"},{status:400});

  const {data,error}=await supabase.rpc("admin_upsert_academy_tutorial",{
    p_id:id,
    p_slug:String(body?.slug||"").slice(0,100),
    p_title:String(body?.title||"").slice(0,180),
    p_subtitle:String(body?.subtitle||"").slice(0,300)||null,
    p_summary:String(body?.summary||"").slice(0,2000),
    p_category:String(body?.category||"Geral").slice(0,100),
    p_access_type:body?.accessType==="product"?"product":"public",
    p_cover_url:String(body?.coverUrl||"").slice(0,1200)||null,
    p_estimated_minutes:Math.max(1,Math.min(600,Math.trunc(Number(body?.estimatedMinutes)||5))),
    p_featured:body?.featured===true,
    p_active:body?.active!==false,
    p_sort_order:Math.trunc(Number(body?.sortOrder)||0),
    p_product_ids:productIds,
    p_blocks:blocks.map((block:any)=>({type:String(block?.type||"text"),content:block?.content&&typeof block.content==="object"?block.content:{text:String(block?.content||"")}})),
  });

  if(error)return NextResponse.json({error:"TUTORIAL_SAVE_FAILED",detail:String(error.message||"").slice(0,180)},{status:400});
  return NextResponse.json(data,{status:id?200:201});
}
