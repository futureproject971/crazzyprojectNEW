
alter table public.discord_role_grants
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists worker_id text,
  add column if not exists locked_until timestamptz;

alter table public.discord_role_grants
  drop constraint if exists discord_role_grants_status_check;

alter table public.discord_role_grants
  add constraint discord_role_grants_status_check
  check (status in ('pending','processing','granted','failed','revoked'));

create index if not exists discord_role_grants_queue_idx
on public.discord_role_grants(status,next_attempt_at,locked_until,updated_at)
where status in ('pending','failed','processing');

create or replace function public.prepare_discord_role_queue()
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_expired integer := 0;
  v_synced integer := 0;
  v_revoke integer := 0;
begin
  update public.entitlements
  set status='expired',updated_at=now()
  where status='active'
    and expires_at is not null
    and expires_at<=now();
  get diagnostics v_expired = row_count;

  update public.discord_role_grants drg
  set discord_user_id=di.discord_user_id,
      guild_id=coalesce(
        nullif(btrim(drg.guild_id),''),
        (select nullif(btrim(sc.value),'') from public.system_credentials sc where sc.env_key='DISCORD_GUILD_ID')
      ),
      status=case when drg.status='failed' and drg.desired_state='granted' then 'pending' else drg.status end,
      next_attempt_at=case when drg.status='failed' and drg.desired_state='granted' then now() else drg.next_attempt_at end,
      updated_at=now()
  from public.discord_identities di
  where di.user_id=drg.user_id
    and di.discord_user_id is not null
    and (
      drg.discord_user_id is distinct from di.discord_user_id
      or drg.guild_id is null
    );
  get diagnostics v_synced = row_count;

  update public.discord_role_grants drg
  set desired_state='revoked',
      status=case when drg.status='revoked' then 'revoked' else 'pending' end,
      next_attempt_at=now(),
      locked_until=null,
      worker_id=null,
      updated_at=now()
  where drg.entitlement_id in (
    select e.id
    from public.entitlements e
    where e.status in ('expired','revoked','refunded','disputed')
  )
    and drg.desired_state is distinct from 'revoked';
  get diagnostics v_revoke = row_count;

  return jsonb_build_object(
    'expired_entitlements',v_expired,
    'identity_syncs',v_synced,
    'revoke_queued',v_revoke
  );
end;
$$;

revoke all on function public.prepare_discord_role_queue() from public,anon,authenticated;
grant execute on function public.prepare_discord_role_queue() to service_role;

create or replace function public.claim_discord_role_grant(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_grant public.discord_role_grants;
begin
  update public.discord_role_grants
  set status='failed',
      last_error_code='WORKER_LEASE_EXPIRED',
      worker_id=null,
      locked_until=null,
      next_attempt_at=now(),
      updated_at=now()
  where status='processing'
    and locked_until is not null
    and locked_until<=now();

  select *
  into v_grant
  from public.discord_role_grants
  where status in ('pending','failed')
    and (next_attempt_at is null or next_attempt_at<=now())
    and (locked_until is null or locked_until<=now())
  order by
    case when desired_state='revoked' then 0 else 1 end,
    updated_at asc
  for update skip locked
  limit 1;

  if v_grant.id is null then
    return null;
  end if;

  update public.discord_role_grants
  set status='processing',
      attempt_count=attempt_count+1,
      last_attempt_at=now(),
      worker_id=left(coalesce(nullif(btrim(p_worker_id),''),'main'),120),
      locked_until=now()+interval '90 seconds',
      updated_at=now()
  where id=v_grant.id
  returning * into v_grant;

  return to_jsonb(v_grant);
end;
$$;

revoke all on function public.claim_discord_role_grant(text) from public,anon,authenticated;
grant execute on function public.claim_discord_role_grant(text) to service_role;

create or replace function public.finish_discord_role_grant(
  p_grant_id uuid,
  p_worker_id text,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_grant public.discord_role_grants;
  v_delay_minutes integer;
begin
  select *
  into v_grant
  from public.discord_role_grants
  where id=p_grant_id
  for update;

  if v_grant.id is null then return false; end if;
  if v_grant.status<>'processing' then return false; end if;
  if v_grant.worker_id is distinct from left(coalesce(nullif(btrim(p_worker_id),''),'main'),120) then
    return false;
  end if;

  if p_success then
    update public.discord_role_grants
    set status=case when desired_state='revoked' then 'revoked' else 'granted' end,
        granted_at=case when desired_state='granted' then coalesce(granted_at,now()) else granted_at end,
        revoked_at=case when desired_state='revoked' then now() else null end,
        last_error_code=null,
        next_attempt_at=null,
        locked_until=null,
        worker_id=null,
        updated_at=now()
    where id=p_grant_id;
  else
    v_delay_minutes := least(60, greatest(1, power(2,least(v_grant.attempt_count,6)-1)::integer));
    update public.discord_role_grants
    set status='failed',
        last_error_code=left(coalesce(nullif(btrim(p_error_code),''),'DISCORD_ROLE_SYNC_FAILED'),160),
        next_attempt_at=now()+(v_delay_minutes||' minutes')::interval,
        locked_until=null,
        worker_id=null,
        updated_at=now()
    where id=p_grant_id;
  end if;

  return true;
end;
$$;

revoke all on function public.finish_discord_role_grant(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_discord_role_grant(uuid,text,boolean,text) to service_role;

create or replace function public.requeue_discord_role_grant(p_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.discord_role_grants
  set status='pending',
      next_attempt_at=now(),
      locked_until=null,
      worker_id=null,
      last_error_code=null,
      updated_at=now()
  where id=p_grant_id
    and status in ('failed','pending');

  return found;
end;
$$;

revoke all on function public.requeue_discord_role_grant(uuid) from public,anon;
grant execute on function public.requeue_discord_role_grant(uuid) to authenticated;
