import {NextResponse} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
async function run(convert:boolean){const db=await createServerSupabaseClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Entre com Discord.'},{status:401});const {data,error}=await db.rpc('my_activity_xp',{p_convert:convert});return NextResponse.json(error?{error:convert?'Conversão indisponível ou XP insuficiente.':'Não foi possível carregar seu XP.'}:data,{status:error?400:200,headers:{'Cache-Control':'private, no-store'}});}
export async function GET(){return run(false)}
export async function POST(){return run(true)}
