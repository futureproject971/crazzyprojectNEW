import {NextRequest,NextResponse} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
async function context(){const db=await createServerSupabaseClient();const {data:{user}}=await db.auth.getUser();const {data:admin}=user?await db.rpc('is_current_admin'):{data:false};return {db,allowed:!!user&&admin===true};}
export async function GET(){
 const {db,allowed}=await context();if(!allowed)return NextResponse.json({error:'FORBIDDEN'},{status:403});
 const [settings,worker]=await Promise.all([db.from('voice_settings').select('*').single(),db.from('discord_campaign_worker_status').select('channels,last_seen_at,connected,guild_name').order('last_seen_at',{ascending:false}).limit(1).maybeSingle()]);
 return NextResponse.json(settings.error?{error:'Configuração indisponível.'}:{settings:settings.data,worker:worker.data},{status:settings.error?500:200,headers:{'Cache-Control':'private, no-store'}});
}
export async function PUT(request:NextRequest){
 const {db,allowed}=await context();if(!allowed)return NextResponse.json({error:'FORBIDDEN'},{status:403});
 const body=await request.json().catch(()=>({}));const values:Record<string,unknown>={enabled:body.enabled===true,updated_at:new Date().toISOString()};
 for(const key of ['category_id','panel_channel_id','farm_channel_id','afk_channel_id']){const id=String(body[key]||'').trim();if(id&&!/^\d{17,20}$/.test(id))return NextResponse.json({error:'Selecione um canal ou informe um ID Discord válido.'},{status:400});values[key]=id||null;}
 const ranges:Record<string,[number,number]>={grace_seconds:[30,600],max_rooms:[1,50],farm_xp_per_minute:[0,1000],social_xp_per_minute:[0,1000],screen_xp_per_minute:[0,1000],daily_xp_cap:[0,100000],session_xp_cap:[0,100000],xp_per_bonus_cent:[0,1000000]};
 for(const [key,[min,max]] of Object.entries(ranges)){const n=Number(body[key]);if(!Number.isInteger(n)||n<min||n>max)return NextResponse.json({error:`Valor inválido: permitido de ${min} a ${max}.`},{status:400});values[key]=n;}
 if(values.enabled&&(!values.category_id||!values.panel_channel_id))return NextResponse.json({error:'Defina categoria e canal do painel antes de ativar.'},{status:400});
 if(values.farm_channel_id&&values.farm_channel_id===values.afk_channel_id)return NextResponse.json({error:'Farm XP e AFK precisam ser canais diferentes.'},{status:400});
 const {data:current}=await db.from('voice_settings').select('panel_channel_id').single();
 if(current?.panel_channel_id!==values.panel_channel_id)values.panel_message_id=null;
 const {error}=await db.from('voice_settings').update(values).eq('id',true);
 return NextResponse.json(error?{error:'Não foi possível salvar. Confira os valores e tente novamente.'}:{saved:true},{status:error?400:200});
}
