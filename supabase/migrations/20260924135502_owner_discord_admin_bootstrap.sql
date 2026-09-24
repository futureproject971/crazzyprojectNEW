-- CRAZZY PROJECT owner bootstrap
-- Keeps first-user behavior safe: only the explicitly configured Discord ID becomes admin.

insert into public.system_credentials(name,env_key,value,description,help_url)
values(
  'CRAZZY Owner Discord ID',
  'CRAZZY_OWNER_DISCORD_ID',
  '',
  'Discord user ID do dono autorizado a receber role admin durante o sync OAuth.',
  ''
)
on conflict (env_key) do nothing;
