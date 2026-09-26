import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,ModalBuilder,TextInputBuilder,TextInputStyle,UserSelectMenuBuilder,PermissionFlagsBits} from 'discord.js';
import {randomBytes,createHash} from 'node:crypto';
import {RoomServiceClient} from 'livekit-server-sdk';
const row=(...components)=>new ActionRowBuilder().addComponents(components);
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('voice:'+id).setLabel(label).setStyle(style);
const input=(id,label,value='')=>row(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setValue(value).setRequired(true));
const checked=async promise=>{const r=await promise;if(r.error)throw new Error(r.error.message);return r.data;};
const publicPanel=()=>({content:'🎧 **CRAZZY VOICE**\nCrie uma call temporária. Voz no Discord; tela e webcam na CRAZZY CALL.',components:[row(button('create','Criar call',ButtonStyle.Primary),button('mine','Minha call'),button('invites','Meus convites'),button('screen','Abrir CRAZZY CALL'))]});
export function startVoiceRooms(client,db,config){
 let cfg=null,stopped=false,running=false,firstTick=true;
 const pending=new Map();
 const livekit=config.livekitUrl&&config.livekitKey&&config.livekitSecret?new RoomServiceClient(config.livekitUrl,config.livekitKey,config.livekitSecret):null;
 const audit=(room,user,event)=>checked(db.from('voice_audit').insert({room_id:room,discord_user_id:user,event}));
 const serial=(id,work)=>{const prior=pending.get(id)||Promise.resolve();const task=prior.catch(()=>{}).then(work);pending.set(id,task);void task.finally(()=>{if(pending.get(id)===task)pending.delete(id)}).catch(()=>{});return task;};
 const rooms=()=>checked(db.from('voice_rooms').select('*').eq('guild_id',config.guildId).neq('status','closed'));
 const findOwner=async user=>(await checked(db.from('voice_rooms').select('*').eq('guild_id',config.guildId).eq('owner_discord_id',user).neq('status','closed').maybeSingle()));
 const requireOwner=async(user,id)=>{const r=await findOwner(user);if(!r||r.id!==id||r.status!=='active')throw new Error('Você não é o dono de uma call ativa.');return r;};
 const channelFor=async(guild,r)=>{const channel=await guild.channels.fetch(r.channel_id);if(!channel||channel.type!==ChannelType.GuildVoice)throw new Error('A call não está disponível.');return channel;};
 const screenName=id=>'crz_'+id;
 const revokeMedia=async(r,discordId)=>{
  const identity=await checked(db.from('discord_identities').select('user_id').eq('discord_user_id',discordId).maybeSingle());
  await checked(db.from('voice_handoffs').update({revoked_at:new Date().toISOString()}).eq('room_id',r.id).eq('discord_user_id',discordId));
  if(identity){await checked(db.from('call_participants').update({kicked_at:new Date().toISOString(),left_at:new Date().toISOString()}).eq('room_id',r.call_room_id).eq('user_id',identity.user_id));if(livekit)await livekit.removeParticipant(screenName(r.call_room_id),identity.user_id).catch(error=>{if(!String(error.message).includes('not found'))throw error;});}
 };
 const closeRoom=async(guild,r)=>{
  await checked(db.from('voice_rooms').update({status:'closing'}).eq('id',r.id));
  await checked(db.from('call_rooms').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',r.call_room_id));
  await checked(db.from('voice_handoffs').update({revoked_at:new Date().toISOString()}).eq('room_id',r.id));
  if(livekit)await livekit.deleteRoom(screenName(r.call_room_id)).catch(error=>{if(!String(error.message).includes('not found'))throw error;});
  const channel=r.channel_id?await guild.channels.fetch(r.channel_id).catch(e=>{if(e.code===10003)return null;throw e;}):null;
  if(channel)await channel.delete('CRAZZY: sala temporária encerrada');
  await checked(db.from('voice_members').update({status:'removed',presence_at:null}).eq('room_id',r.id));
  await checked(db.from('voice_rooms').update({status:'closed',closed_at:new Date().toISOString()}).eq('id',r.id));
  await audit(r.id,r.owner_discord_id,'ROOM_CLOSED');
 };
 const setAccess=async(channel,r)=>{
  const members=await checked(db.from('voice_members').select('*').eq('room_id',r.id));
  const overrides=[{id:channel.guild.id,allow:r.privacy==='public'?[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]:[],deny:r.privacy==='public'?[]:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]},
   {id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.MoveMembers]}];
  for(const m of members){if(m.status==='accepted')overrides.push({id:m.discord_user_id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]});else if(m.status==='removed')overrides.push({id:m.discord_user_id,deny:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]});}
  await channel.permissionOverwrites.set(overrides);
 };
 const management=r=>({content:`🎧 **Call ${String(r.room_number).padStart(3,'0')}**\n${r.privacy==='public'?'🔓 Pública':r.privacy==='locked'?'🔒 Trancada':'🔒 Privada'} · ${r.user_limit||'Sem'} limite`,components:[row(button('privacy:'+r.id,'Mudar privacidade'),button('limit:'+r.id,'Alterar limite'),button('invite:'+r.id,'Convidar'),button('remove:'+r.id,'Remover')),
 row(button('transfer:'+r.id,'Transferir dono'),button('mute:'+r.id,'Mutar'),button('unmute:'+r.id,'Desmutar'),button('screen','Tela / webcam'),button('close:'+r.id,'Encerrar',ButtonStyle.Danger))]});
 const handoff=async(interaction)=>{
  const member=await interaction.guild.members.fetch(interaction.user.id);
  const r=await checked(db.from('voice_rooms').select('*').eq('channel_id',member.voice.channelId||'none').eq('status','active').maybeSingle());
  if(!r)throw new Error('Entre em uma CRAZZY Call temporária para abrir o compartilhamento.');
  const m=await checked(db.from('voice_members').select('status').eq('room_id',r.id).eq('discord_user_id',member.id).maybeSingle());
  if(m?.status!=='accepted')throw new Error('Seu acesso ainda não está autorizado.');
  const token=randomBytes(32).toString('hex');
  await checked(db.from('voice_handoffs').insert({room_id:r.id,discord_user_id:member.id,token_hash:createHash('sha256').update(token).digest('hex')}));
  const link=new URL('/call/handoff',config.siteUrl);link.hash=token;
  await interaction.editReply({content:'🖥️ Acesso pessoal, válido por 2 minutos. Entre com a mesma conta Discord.',components:[row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Abrir tela e webcam').setURL(link.href))]});
 };
 const handler=async interaction=>{
  if(!interaction.customId?.startsWith('voice:')||interaction.guildId!==config.guildId)return;
  const [,action,id]=interaction.customId.split(':');
  try{
   cfg=await checked(db.from('voice_settings').select('*').eq('id',true).single());
   if(!cfg.enabled)throw new Error('As calls temporárias estão desativadas.');
   if(action==='create'){await interaction.showModal(new ModalBuilder().setCustomId('voice:create-submit').setTitle('Criar CRAZZY Call').addComponents(input('privacy','Pública ou privada?','publica'),input('limit','Limite 0–99 (0 = sem limite)','4')));return;}
   if(action==='limit'){await requireOwner(interaction.user.id,id);await interaction.showModal(new ModalBuilder().setCustomId('voice:limit-submit:'+id).setTitle('Limite da call').addComponents(input('limit','Limite 0–99 (0 = sem limite)','4')));return;}
   await interaction.deferReply({ephemeral:true});
   await serial(interaction.user.id,async()=>{
    const guild=interaction.guild;
    if(action==='screen'){await handoff(interaction);return;}
    if(action==='create-submit'){
     if(!livekit||!config.siteUrl)throw new Error('O compartilhamento ainda precisa ser conectado pela equipe.');
     const value=interaction.fields.getTextInputValue('privacy').trim().toLowerCase(),limit=Number(interaction.fields.getTextInputValue('limit'));
     if(!['publica','pública','privada'].includes(value)||!Number.isInteger(limit)||limit<0||limit>99)throw new Error('Use pública ou privada e um limite inteiro entre 0 e 99.');
     const existing=await findOwner(interaction.user.id);if(existing){await interaction.editReply(management(existing));return;}
     const r=await checked(db.rpc('reserve_voice_room',{p_guild:guild.id,p_owner:interaction.user.id,p_privacy:value==='privada'?'private':'public',p_limit:limit}));
     let channel;
     try{
      channel=await guild.channels.create({name:'Call '+String(r.room_number).padStart(3,'0'),type:ChannelType.GuildVoice,parent:cfg.category_id,userLimit:limit,permissionOverwrites:[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.ManageChannels]},{id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]}]});
      r.channel_id=channel.id;await checked(db.from('voice_rooms').update({channel_id:channel.id}).eq('id',r.id));
      await livekit.createRoom({name:screenName(r.call_room_id),maxParticipants:limit||100,emptyTimeout:600});
      await setAccess(channel,r);await checked(db.from('voice_rooms').update({status:'active',empty_since:new Date().toISOString()}).eq('id',r.id));
      const member=await guild.members.fetch(interaction.user.id);if(member.voice.channelId)await member.voice.setChannel(channel).catch(()=>{});
      await audit(r.id,member.id,'ROOM_CREATED');
      await interaction.editReply({...management({...r,status:'active'}),content:`✅ <#${channel.id}> criada.\nVoz no Discord · tela na CRAZZY CALL.`});
     }catch(error){await closeRoom(guild,r).catch(()=>{});throw error;}
     return;
    }
    if(action==='mine'){const r=await findOwner(interaction.user.id);if(!r)throw new Error('Você ainda não possui uma call.');await interaction.editReply(management(r));return;}
    if(action==='invites'){
     const invites=await checked(db.from('voice_members').select('room_id').eq('discord_user_id',interaction.user.id).eq('status','pending'));
     const active=(await rooms()).filter(r=>invites.some(m=>m.room_id===r.id)&&r.status==='active').slice(0,5);
     await interaction.editReply({content:active.length?'📩 Seus convites':'Você não tem convites pendentes.',components:active.map(r=>row(button('accept:'+r.id,'Aceitar Call '+r.room_number,ButtonStyle.Success),button('reject:'+r.id,'Recusar '+r.room_number)))});return;
    }
    if(action==='accept'||action==='reject'){
     const r=await checked(db.from('voice_rooms').select('*').eq('id',id).eq('guild_id',guild.id).eq('status','active').single());
     const invitation=await checked(db.from('voice_members').select('*').eq('room_id',id).eq('discord_user_id',interaction.user.id).eq('status','pending').maybeSingle());
     if(!invitation)throw new Error('Este convite não está mais disponível.');
     await checked(db.from('voice_members').update({status:action==='accept'?'accepted':'rejected'}).eq('room_id',id).eq('discord_user_id',interaction.user.id));
     if(action==='accept')await setAccess(await channelFor(guild,r),r);
     await audit(id,interaction.user.id,'INVITE_'+action.toUpperCase());await interaction.editReply({content:action==='accept'?`Convite aceito. Entre em <#${r.channel_id}>.`:'Convite recusado.'});return;
    }
    const r=await requireOwner(interaction.user.id,id),channel=await channelFor(guild,r);
    if(['invite','remove','transfer','mute','unmute'].includes(action)){
     await interaction.editReply({content:'Selecione um membro do servidor.',components:[row(new UserSelectMenuBuilder().setCustomId('voice:'+action+'-user:'+id).setMinValues(1).setMaxValues(1))]});return;
    }
    if(action.endsWith('-user')){
     const targetId=interaction.values[0],target=await guild.members.fetch(targetId);
     if(target.user.bot||targetId===interaction.user.id)throw new Error('Selecione outro participante.');
     if(action==='invite-user'){
      const existing=await checked(db.from('voice_members').select('status').eq('room_id',id).eq('discord_user_id',targetId).maybeSingle());
      if(existing?.status==='accepted')throw new Error('Esta pessoa já está autorizada nesta call.');
      if(r.privacy==='locked')throw new Error('Destranque a sala antes de convidar.');
      await checked(db.from('voice_members').upsert({room_id:id,discord_user_id:targetId,status:'pending'},{onConflict:'room_id,discord_user_id'}));
     }else if(action==='remove-user'){
      await checked(db.from('voice_members').upsert({room_id:id,discord_user_id:targetId,status:'removed',presence_at:null},{onConflict:'room_id,discord_user_id'}));
      await channel.permissionOverwrites.edit(targetId,{ViewChannel:false,Connect:false});
      if(target.voice.channelId===channel.id)await target.voice.disconnect('Removido pelo dono da call');
      await revokeMedia(r,targetId);
     }else{
      if(target.voice.channelId!==channel.id)throw new Error('A pessoa precisa estar nesta call.');
      if(action==='transfer-user'){
       if(await findOwner(targetId))throw new Error('Esta pessoa já possui uma call.');
       const identity=await checked(db.from('discord_identities').select('user_id').eq('discord_user_id',targetId).maybeSingle());if(!identity)throw new Error('A pessoa precisa vincular o Discord no site.');
       await checked(db.from('voice_rooms').update({owner_discord_id:targetId,owner_left_since:null}).eq('id',id));
       await checked(db.from('call_rooms').update({owner_id:identity.user_id}).eq('id',r.call_room_id));
       await checked(db.from('call_participants').update({role:'participant'}).eq('room_id',r.call_room_id));
       await checked(db.from('call_participants').update({role:'host'}).eq('room_id',r.call_room_id).eq('user_id',identity.user_id));
      }else {
       const membership=await checked(db.from('voice_members').select('muted_by_owner').eq('room_id',id).eq('discord_user_id',targetId).maybeSingle());
       if(action==='unmute-user'&&!membership?.muted_by_owner)throw new Error('Somente silenciamentos feitos pelo dono desta call podem ser removidos.');
       if(action==='mute-user'&&target.voice.serverMute)throw new Error('Esta pessoa já está silenciada.');
       await checked(db.from('voice_members').update({muted_by_owner:action==='mute-user'}).eq('room_id',id).eq('discord_user_id',targetId));
       await target.voice.setMute(action==='mute-user','Dono da CRAZZY Call');
      }
     }
     await audit(id,interaction.user.id,action.toUpperCase());await interaction.editReply({content:'Configuração atualizada.'});return;
    }
    if(action==='privacy'){await interaction.editReply({content:'Escolha a privacidade. Trancada mantém somente membros já autorizados.',components:[row(button('public:'+id,'Pública'),button('private:'+id,'Privada'),button('locked:'+id,'Trancada'))]});return;}
    if(['public','private','locked'].includes(action)){await checked(db.from('voice_rooms').update({privacy:action}).eq('id',id));r.privacy=action;await setAccess(channel,r);}
    else if(action==='limit-submit'){
     const limit=Number(interaction.fields.getTextInputValue('limit'));if(!Number.isInteger(limit)||limit<0||limit>99||(limit>0&&limit<channel.members.size))throw new Error('Limite deve ser 0–99 e não pode ser menor que a ocupação atual.');
     await channel.setUserLimit(limit);await checked(db.from('voice_rooms').update({user_limit:limit}).eq('id',id));await checked(db.from('call_rooms').update({max_participants:limit?Math.max(2,limit):100}).eq('id',r.call_room_id));
    }else if(action==='close'){await interaction.editReply({content:'Encerrar sua call e o compartilhamento?',components:[row(button('confirm-close:'+id,'Encerrar',ButtonStyle.Danger))]});return;}
    else if(action==='confirm-close')await closeRoom(guild,r);
    await audit(id,interaction.user.id,action.toUpperCase());await interaction.editReply({content:'Call atualizada.'});
   });
  }catch(error){const text=String(error.message);const friendly=text.includes('LOGIN_REQUIRED')?'Entre no site com seu Discord antes de criar a call.':text.includes('RATE_LIMIT')?'Aguarde um minuto antes de criar outra call.':text.includes('ROOM_LIMIT')?'Todas as salas temporárias estão ocupadas.':/^[A-Z_]+$/.test(text)?'Não foi possível concluir agora. A equipe pode verificar a configuração.':(/^[A-Z]/.test(text)&&text.includes(' ')?text:'Não foi possível concluir agora. Tente novamente em instantes.');
   console.error('[voice]',action,error.code||error.name);const payload={content:friendly.slice(0,350),components:[]};if(interaction.deferred||interaction.replied)await interaction.editReply(payload).catch(()=>{});else await interaction.reply({...payload,ephemeral:true}).catch(()=>{});
  }
 };
 client.on('interactionCreate',handler);
 const tick=async()=>{
  if(stopped||running)return;running=true;
  try{
   cfg=await checked(db.from('voice_settings').select('*').eq('id',true).single());
   await checked(db.from('voice_settings').update({worker_seen_at:new Date().toISOString(),media_ready:Boolean(livekit&&config.siteUrl),last_error:null}).eq('id',true));
   if(firstTick||!cfg.enabled){await checked(db.from('activity_xp_sessions').delete().in('source',['voice','screen']));firstTick=false;}
   if(!cfg.enabled)return;
   const guild=await client.guilds.fetch(config.guildId);await guild.channels.fetch();
   if(cfg.panel_channel_id){const panel=await guild.channels.fetch(cfg.panel_channel_id);if(panel?.isTextBased()){
    const existing=cfg.panel_message_id?await panel.messages.fetch(cfg.panel_message_id).catch(e=>{if(e.code===10008)return null;throw e;}):null;
    if(!existing){const message=await panel.send(publicPanel());await checked(db.from('voice_settings').update({panel_message_id:message.id}).eq('id',true));}
   }}
   for(const r of await rooms())await serial(r.owner_discord_id,async()=>{
    if(r.status==='closing'){await closeRoom(guild,r);return;}
    if(r.status==='provisioning'){if(Date.now()-Date.parse(r.created_at)>120000)await closeRoom(guild,r);return;}
    const channel=await guild.channels.fetch(r.channel_id).catch(e=>{if(e.code===10003)return null;throw e;});
    const site=await checked(db.from('call_rooms').select('status').eq('id',r.call_room_id).single());
    if(!channel||['ended','disabled'].includes(site.status)){await closeRoom(guild,r);return;}
    const occupants=[...channel.members.values()].filter(m=>!m.user.bot),now=new Date().toISOString();
    const known=await checked(db.from('voice_members').select('*').eq('room_id',r.id));
    for(const m of occupants){const saved=known.find(x=>x.discord_user_id===m.id);if(saved?.status==='removed'||(r.privacy!=='public'&&saved?.status!=='accepted')){await m.voice.disconnect('Call privada');continue;}await checked(db.from('voice_members').upsert({room_id:r.id,discord_user_id:m.id,status:'accepted',presence_at:now},{onConflict:'room_id,discord_user_id'}));}
    for(const saved of known.filter(m=>m.presence_at&&!occupants.some(p=>p.id===m.discord_user_id)))await checked(db.from('voice_members').update({presence_at:null}).eq('room_id',r.id).eq('discord_user_id',saved.discord_user_id));
    if(!occupants.length){if(r.empty_since&&Date.now()-Date.parse(r.empty_since)>cfg.grace_seconds*1000){await closeRoom(guild,r);return;}if(!r.empty_since)await checked(db.from('voice_rooms').update({empty_since:now}).eq('id',r.id));}
    else{await checked(db.from('voice_rooms').update({empty_since:null,owner_left_since:occupants.some(m=>m.id===r.owner_discord_id)?null:r.owner_left_since||now}).eq('id',r.id));
     if(r.owner_left_since&&Date.now()-Date.parse(r.owner_left_since)>cfg.grace_seconds*1000&&!occupants.some(m=>m.id===r.owner_discord_id)){
      const eligible=known.filter(m=>m.status==='accepted'&&occupants.some(p=>p.id===m.discord_user_id)).sort((a,b)=>a.joined_at.localeCompare(b.joined_at));
      for(const m of eligible){if(await findOwner(m.discord_user_id))continue;const di=await checked(db.from('discord_identities').select('user_id').eq('discord_user_id',m.discord_user_id).maybeSingle());if(!di)continue;await checked(db.from('voice_rooms').update({owner_discord_id:m.discord_user_id,owner_left_since:null}).eq('id',r.id));await checked(db.from('call_rooms').update({owner_id:di.user_id}).eq('id',r.call_room_id));await checked(db.from('call_participants').update({role:'participant'}).eq('room_id',r.call_room_id));await checked(db.from('call_participants').update({role:'host'}).eq('room_id',r.call_room_id).eq('user_id',di.user_id));await audit(r.id,m.discord_user_id,'OWNER_TRANSFERRED');break;}
     }
    }
   });
   if(livekit){
    const sharing=new Set();
    for(const room of await rooms())if(room.status==='active'){
     const participants=await livekit.listParticipants(screenName(room.call_room_id));
     for(const participant of participants){
      const identity=await checked(db.from('discord_identities').select('discord_user_id,guild_member,guild_id').eq('user_id',participant.identity).maybeSingle());
      const membership=identity?await checked(db.from('voice_members').select('status').eq('room_id',room.id).eq('discord_user_id',identity.discord_user_id).maybeSingle()):null;
      const cp=await checked(db.from('call_participants').select('kicked_at').eq('room_id',room.call_room_id).eq('user_id',participant.identity).maybeSingle());
      if(!identity?.guild_member||identity.guild_id!==config.guildId||membership?.status!=='accepted'||cp?.kicked_at){
       if(identity&&cp?.kicked_at)await checked(db.from('voice_members').update({status:'removed'}).eq('room_id',room.id).eq('discord_user_id',identity.discord_user_id));
       await livekit.removeParticipant(screenName(room.call_room_id),participant.identity);continue;
      }
      if(participant.tracks?.some(t=>t.source===3&&!t.muted))sharing.add(identity.discord_user_id);
     }
    }
    const sessions=await checked(db.from('activity_xp_sessions').select('discord_user_id').eq('source','screen'));
    for(const id of new Set([...sharing,...sessions.map(s=>s.discord_user_id)]))await checked(db.rpc('record_activity_xp',{p_discord_id:id,p_source:'screen',p_active:sharing.has(id)}));
   }
   const active=new Set();for(const state of guild.voiceStates.cache.values()){
    if(state.member?.user.bot)continue;active.add(state.id);
    const allowed=Boolean(state.channelId&&state.channelId!==cfg.afk_channel_id&&state.channelId!==guild.afkChannelId&&!state.selfMute&&!state.serverMute&&!state.selfDeaf&&!state.serverDeaf&&!state.suppress);
    await checked(db.rpc('record_activity_xp',{p_discord_id:state.id,p_source:'voice',p_active:allowed,p_farm:state.channelId===cfg.farm_channel_id}));
   }
   const sessions=await checked(db.from('activity_xp_sessions').select('discord_user_id').eq('source','voice'));
   for(const s of sessions)if(!active.has(s.discord_user_id))await checked(db.rpc('record_activity_xp',{p_discord_id:s.discord_user_id,p_source:'voice',p_active:false}));
  }catch(error){console.error('[voice-reconcile]',error.code||error.name);await db.from('voice_settings').update({last_error:'O bot não conseguiu aplicar a configuração. Confira canais, permissões do bot e conexão do compartilhamento.'}).eq('id',true);}finally{running=false;}
 };
 const onVoice=(before,after)=>{if(after.guild.id!==config.guildId)return;
  if(before.channelId&&before.channelId!==after.channelId)void(async()=>{const r=await checked(db.from('voice_rooms').select('id').eq('channel_id',before.channelId).maybeSingle());if(!r)return;const m=await checked(db.from('voice_members').select('muted_by_owner').eq('room_id',r.id).eq('discord_user_id',after.id).maybeSingle());if(m?.muted_by_owner){await after.member.voice.setMute(false,'Fim do silenciamento da call temporária');await checked(db.from('voice_members').update({muted_by_owner:false}).eq('room_id',r.id).eq('discord_user_id',after.id));}})().catch(error=>console.error('[voice-unmute]',error.code||error.name));if(before.channelId!==after.channelId||before.mute!==after.mute||before.deaf!==after.deaf||before.suppress!==after.suppress)void checked(db.rpc('record_activity_xp',{p_discord_id:after.id,p_source:'voice',p_active:false})).catch(()=>{});void tick();};
 client.on('voiceStateUpdate',onVoice);void tick();const timer=setInterval(()=>void tick(),30000);
 return()=>{stopped=true;clearInterval(timer);client.off('interactionCreate',handler);client.off('voiceStateUpdate',onVoice)};
}
