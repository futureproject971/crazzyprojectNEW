function safe(value,max=900){
  return String(value??"").replace(/<@&\\d+>/g,"[role]").slice(0,max);
}

async function finish(supabase,id,success,error=null){
  const result=await supabase.rpc("finish_security_alert",{p_event_id:id,p_success:success,p_error:error});
  if(result.error||result.data!==true)console.error("[security] finish failed",id,result.error?.message||result.data);
}

export function startSecuritySentinel(client,supabase,config){
  let running=false;
  const tick=async()=>{
    if(running||!client.isReady())return;
    running=true;
    try{
      const claimed=await supabase.rpc("claim_security_alert",{p_worker_id:config.workerId});
      if(claimed.error)throw claimed.error;
      const event=claimed.data;
      if(!event?.id)return;
      try{
        const creds=await supabase.from("system_credentials").select("env_key,value").in("env_key",["DISCORD_SECURITY_CHANNEL_ID","DISCORD_SECURITY_ROLE_ID"]);
        if(creds.error)throw creds.error;
        const map=new Map((creds.data||[]).map((x)=>[x.env_key,String(x.value||"").trim()]));
        const channelId=map.get("DISCORD_SECURITY_CHANNEL_ID");
        const roleId=map.get("DISCORD_SECURITY_ROLE_ID");
        if(!channelId)throw new Error("SECURITY_CHANNEL_NOT_CONFIGURED");
        const guild=await client.guilds.fetch(config.guildId);
        const channel=await guild.channels.fetch(channelId);
        if(!channel?.isTextBased?.())throw new Error("SECURITY_CHANNEL_INVALID");
        const mention=event.severity==="critical"&&roleId?"<@&"+roleId+">\\n":"";
        const content=[
          mention+"**["+String(event.severity).toUpperCase()+"] "+safe(event.title,180)+"**",
          safe(event.message,1200),
          "Categoria: "+safe(event.category,80)+" • Fonte: "+safe(event.source,80)+" • Ocorrências: "+Number(event.occurrences||1),
          "Event ID: "+event.id
        ].join("\\n");
        await channel.send({content:content.slice(0,1900),allowedMentions:{roles:event.severity==="critical"&&roleId?[roleId]:[],users:[],repliedUser:false}});
        await finish(supabase,event.id,true);
      }catch(error){
        await finish(supabase,event.id,false,String(error?.code||error?.message||"SECURITY_ALERT_FAILED").slice(0,180));
      }
    }catch(error){
      console.error("[security] worker error",error);
    }finally{running=false;}
  };
  const timer=setInterval(()=>void tick(),8000);
  void tick();
  return()=>clearInterval(timer);
}