const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function codeFromError(error) {
  const code = error?.code || error?.rawError?.code || error?.message || "DISCORD_ROLE_SYNC_FAILED";
  return String(code).slice(0, 160);
}

async function finish(supabase, config, grantId, success, errorCode = null) {
  const { data, error } = await supabase.rpc("finish_discord_role_grant", {
    p_grant_id: grantId,
    p_worker_id: config.workerId,
    p_success: success,
    p_error_code: errorCode,
  });
  if (error || data !== true) {
    console.error("[role-bridge] finish failed", grantId, error?.message || data);
  }
}

async function processGrant(client, supabase, config, grant) {
  if (!grant?.id) return;
  if (!grant.guild_id || grant.guild_id !== config.guildId) {
    await finish(supabase, config, grant.id, false, "GUILD_SCOPE_MISMATCH");
    return;
  }
  if (!grant.discord_user_id) {
    await finish(supabase, config, grant.id, false, "DISCORD_IDENTITY_REQUIRED");
    return;
  }
  if (!grant.role_id) {
    await finish(supabase, config, grant.id, false, "ROLE_ID_REQUIRED");
    return;
  }

  try {
    const guild = await client.guilds.fetch(config.guildId);
    const [member, role] = await Promise.all([
      guild.members.fetch(grant.discord_user_id),
      guild.roles.fetch(grant.role_id),
    ]);

    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (!role) throw new Error("ROLE_NOT_FOUND");
    if (!role.editable) throw new Error("ROLE_NOT_EDITABLE");

    if (grant.desired_state === "revoked") {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "CRAZZY PROJECT • entitlement encerrado");
      }
    } else {
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, "CRAZZY PROJECT • entitlement ativo");
      }
    }

    await finish(supabase, config, grant.id, true);
  } catch (error) {
    console.error("[role-bridge] sync failed", grant.id, error);
    await finish(supabase, config, grant.id, false, codeFromError(error));
  }
}

export function startDiscordRoleBridge(client, supabase, config) {
  let processing = false;

  const tick = async () => {
    if (processing || !client.isReady()) return;
    processing = true;

    try {
      const { error: prepareError } = await supabase.rpc("prepare_discord_role_queue");
      if (prepareError) throw prepareError;

      for (let i = 0; i < 8; i += 1) {
        const { data: grant, error } = await supabase.rpc("claim_discord_role_grant", {
          p_worker_id: config.workerId,
        });
        if (error) throw error;
        if (!grant?.id) break;

        await processGrant(client, supabase, config, grant);
        await sleep(250);
      }
    } catch (error) {
      console.error("[role-bridge] queue error:", error);
    } finally {
      processing = false;
    }
  };

  const timer = setInterval(() => void tick(), 5000);
  void tick();
  return () => clearInterval(timer);
}
