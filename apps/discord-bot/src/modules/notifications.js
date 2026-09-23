const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

function errorCode(error){
  return String(error?.code||error?.message||"DISCORD_DM_FAILED").slice(0,160);
}

async function finish(supabase,config,id,success,error=null){
  const {data,error}=await supabase.rpc("finish_discord_notification_job",{
    p_job_id:id,p_worker_id:config.workerId,p_success:success,p_error:error
  });
  if(error||data!==true)console.error("[notify] finish failed",id,error?.message||data);
}

export function startNotificationWorker(client,supabase,config){
  let running=false;
  const tick=async()=>{
    if(running||!client.isReady())return;
    running=true;
    try{
      for(let i=0;i<6;i+=1){
        const {data:job,error}=await supabase.rpc("claim_discord_notification_job",{p_worker_id:config.workerId});
        if(error)throw error;
        if(!job?.id)break;
        try{
          if(!job.discord_user_id)throw new Error("DISCORD_IDENTITY_REQUIRED");
          const user=await client.users.fetch(job.discord_user_id);
          const link=job.href?(job.href.startsWith("http")?job.href:(config.siteUrl?config.siteUrl.replace(/\/$/,"")+job.href:"")):"";
          const body=["**"+job.title+"**",job.body||"",link].filter(Boolean).join("\n\n");
          await user.send({content:body.slice(0,1900)});
          await finish(supabase,config,job.id,true);
        }catch(error){
          await finish(supabase,config,job.id,false,errorCode(error));
        }
        await sleep(config.dmDelayMs);
      }
    }catch(error){console.error("[notify] worker error",error)}
    finally{running=false}
  };
  const timer=setInterval(()=>void tick(),5000);
  void tick();
  return()=>clearInterval(timer);
}
