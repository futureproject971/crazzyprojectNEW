
create or replace function public.set_security_discord_config(
  p_channel_id text,
  p_role_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_channel text := btrim(coalesce(p_channel_id,''));
  v_role text := btrim(coalesce(p_role_id,''));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if v_channel<>'' and v_channel !~ '^[0-9]{10,30}$' then raise exception 'INVALID_CHANNEL_ID'; end if;
  if v_role<>'' and v_role !~ '^[0-9]{10,30}$' then raise exception 'INVALID_ROLE_ID'; end if;

  update public.system_credentials set value=v_channel where env_key='DISCORD_SECURITY_CHANNEL_ID';
  update public.system_credentials set value=v_role where env_key='DISCORD_SECURITY_ROLE_ID';

  return jsonb_build_object(
    'channel_configured',v_channel<>'',
    'critical_role_configured',v_role<>''
  );
end;
$$;

revoke all on function public.set_security_discord_config(text,text) from public,anon;
grant execute on function public.set_security_discord_config(text,text) to authenticated;
