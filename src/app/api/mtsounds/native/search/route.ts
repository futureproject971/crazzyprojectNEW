import { NextRequest, NextResponse } from "next/server";
export async function GET(req:NextRequest){const q=req.nextUrl.searchParams.get("q")?.trim();if(!q)return NextResponse.json({error:"Informe ?q="},{status:400});return NextResponse.json({query:q,results:[],message:"Catálogo será conectado ao Supabase/backend."});}
