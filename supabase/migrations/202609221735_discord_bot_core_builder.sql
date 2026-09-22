-- CRAZZY PROJECT — Discord Bot Core / Server Builder control plane
-- The site queues safe append-only jobs. The single Discloud worker executes them.

alter table public.discord_campaign_worker_status
  add column if not exists channels jsonb not null default '[]'::jsonb;

create table if not exists public.discord_builder_configs (
  id text primary key default 'default',
  template jsonb not null default '{"categories":[]}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  safe_mode boolean not null default true check (safe_mode = true),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_builder_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  guild_id text,
  status text not null default 'queued'
    check (status in ('queued','running','completed','cancelled','failed')),
  safe_mode boolean not null default true check (safe_mode = true),
  cancel_requested boolean not null default false,
  worker_id text,
  planned_items jsonb not null default '[]'::jsonb,
  report jsonb not null default '[]'::jsonb,
  created_count integer not null default 0 check (created_count >= 0),
  preserved_count integer not null default 0 check (preserved_count >= 0),
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_builder_jobs_queue_idx
  on public.discord_builder_jobs(status,queued_at)
  where status='queued';

alter table public.discord_builder_configs enable row level security;
alter table public.discord_builder_jobs enable row level security;

drop policy if exists "Admins manage discord builder config" on public.discord_builder_configs;
create policy "Admins manage discord builder config"
on public.discord_builder_configs
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage discord builder jobs" on public.discord_builder_jobs;
create policy "Admins manage discord builder jobs"
on public.discord_builder_jobs
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.discord_builder_configs from anon;
revoke all on public.discord_builder_jobs from anon;

grant select,insert,update on public.discord_builder_configs to authenticated;
grant select,insert,update on public.discord_builder_jobs to authenticated;

insert into public.discord_builder_configs(id,template,theme,safe_mode)
values(
  'default',
  '{"brand":"CRAZZY PROJECT","theme":"CRAZZY_BLUE","categories":[]}'::jsonb,
  '{"brand":"CRAZZY PROJECT","primary":"#0000FF","secondary":"#1687FF","accent":"#00B7FF","footer":"CRAZZY PROJECT • DISCORD BOT CORE"}'::jsonb,
  true
)
on conflict(id) do nothing;

create or replace function public.queue_discord_builder_job(
  p_guild_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.discord_builder_jobs;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if exists(select 1 from public.discord_builder_jobs where status in ('queued','running')) then
    raise exception 'BUILDER_JOB_ALREADY_ACTIVE';
  end if;

  insert into public.discord_builder_jobs(created_by,guild_id,status,safe_mode)
  values(v_user,nullif(btrim(coalesce(p_guild_id,'')),''),'queued',true)
  returning * into v_row;

  return jsonb_build_object('id',v_row.id,'status',v_row.status);
end;
$$;

create or replace function public.cancel_discord_builder_job(
  p_job_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.discord_builder_jobs
  set
    cancel_requested=true,
    status=case when status='queued' then 'cancelled' else status end,
    finished_at=case when status='queued' then now() else finished_at end,
    updated_at=now()
  where id=p_job_id and status in ('queued','running');

  return found;
end;
$$;

create or replace function public.claim_discord_builder_job(
  p_worker_id text
)
returns jsonb
language plpgsql
security invoker
set search_path=public,auth,pg_temp
as $$
declare
  v_row public.discord_builder_jobs;
  v_config jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select *
  into v_row
  from public.discord_builder_jobs
  where status='queued'
    and cancel_requested=false
  order by queued_at
  for update skip locked
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  select jsonb_build_object(
    'template',template,
    'theme',theme,
    'safe_mode',safe_mode
  )
  into v_config
  from public.discord_builder_configs
  where id='default';

  update public.discord_builder_jobs
  set status='running',
      worker_id=btrim(p_worker_id),
      started_at=coalesce(started_at,now()),
      heartbeat_at=now(),
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'job',to_jsonb(v_row),
    'config',coalesce(v_config,'{}'::jsonb)
  );
end;
$$;

create or replace function public.finish_discord_builder_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_planned_items jsonb,
  p_report jsonb,
  p_created_count integer,
  p_preserved_count integer,
  p_last_error text default null
)
returns boolean
language plpgsql
security invoker
set search_path=public,auth,pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_status not in ('completed','cancelled','failed') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.discord_builder_jobs
  set status=p_status,
      planned_items=coalesce(p_planned_items,'[]'::jsonb),
      report=coalesce(p_report,'[]'::jsonb),
      created_count=greatest(0,p_created_count),
      preserved_count=greatest(0,p_preserved_count),
      last_error=nullif(left(coalesce(p_last_error,''),1000),''),
      heartbeat_at=now(),
      finished_at=now(),
      updated_at=now()
  where id=p_job_id
    and worker_id=p_worker_id
    and status='running';

  return found;
end;
$$;

create or replace function public.heartbeat_discord_bot_worker(
  p_worker_id text,
  p_guild_id text,
  p_guild_name text,
  p_bot_user_id text,
  p_bot_tag text,
  p_connected boolean,
  p_member_count integer,
  p_online_count integer,
  p_roles jsonb,
  p_channels jsonb,
  p_version text,
  p_last_error text default null
)
returns boolean
language plpgsql
security invoker
set search_path=public,auth,pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.discord_campaign_worker_status(
    worker_id,guild_id,guild_name,bot_user_id,bot_tag,connected,
    member_count,online_count,roles,channels,version,last_error,last_seen_at,updated_at
  )
  values(
    btrim(p_worker_id),
    nullif(btrim(coalesce(p_guild_id,'')),''),
    nullif(btrim(coalesce(p_guild_name,'')),''),
    nullif(btrim(coalesce(p_bot_user_id,'')),''),
    nullif(btrim(coalesce(p_bot_tag,'')),''),
    p_connected,
    greatest(0,p_member_count),
    greatest(0,p_online_count),
    coalesce(p_roles,'[]'::jsonb),
    coalesce(p_channels,'[]'::jsonb),
    nullif(btrim(coalesce(p_version,'')),''),
    nullif(left(coalesce(p_last_error,''),1000),''),
    now(),now()
  )
  on conflict(worker_id) do update
  set guild_id=excluded.guild_id,
      guild_name=excluded.guild_name,
      bot_user_id=excluded.bot_user_id,
      bot_tag=excluded.bot_tag,
      connected=excluded.connected,
      member_count=excluded.member_count,
      online_count=excluded.online_count,
      roles=excluded.roles,
      channels=excluded.channels,
      version=excluded.version,
      last_error=excluded.last_error,
      last_seen_at=now(),
      updated_at=now();

  return true;
end;
$$;

revoke execute on function public.queue_discord_builder_job(text) from public,anon;
revoke execute on function public.cancel_discord_builder_job(uuid) from public,anon;
revoke execute on function public.claim_discord_builder_job(text) from public,anon,authenticated;
revoke execute on function public.finish_discord_builder_job(uuid,text,text,jsonb,jsonb,integer,integer,text) from public,anon,authenticated;
revoke execute on function public.heartbeat_discord_bot_worker(text,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,text) from public,anon,authenticated;

grant execute on function public.queue_discord_builder_job(text) to authenticated;
grant execute on function public.cancel_discord_builder_job(uuid) to authenticated;
grant execute on function public.claim_discord_builder_job(text) to service_role;
grant execute on function public.finish_discord_builder_job(uuid,text,text,jsonb,jsonb,integer,integer,text) to service_role;
grant execute on function public.heartbeat_discord_bot_worker(text,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,text) to service_role;
