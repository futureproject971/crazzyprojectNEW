-- CRAZZY PROJECT — Discord Campaign Center
-- The site is the control plane. The Discord Gateway worker stays on Discloud.
-- Bot token and Supabase service-role key never enter the browser.

create table if not exists public.discord_campaign_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (char_length(btrim(name)) between 1 and 80),
  title text,
  description text not null default '',
  image_url text,
  thumbnail_url text,
  link_url text,
  button_label text not null default '🛒 Acessar Loja'
    check (char_length(button_label) between 1 and 80),
  footer_text text,
  color integer not null default 255
    check (color between 0 and 16777215),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.discord_campaign_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  guild_id text,
  title text,
  description text not null default '',
  image_url text,
  thumbnail_url text,
  link_url text,
  button_label text not null default '🛒 Acessar Loja',
  footer_text text,
  color integer not null default 255
    check (color between 0 and 16777215),
  target_mode text not null default 'all'
    check (target_mode in ('all','online','role','single')),
  target_role_id text,
  target_user_id text,
  status text not null default 'queued'
    check (status in ('queued','running','completed','cancelled','failed')),
  cancel_requested boolean not null default false,
  scheduled_for timestamptz not null default now(),
  total_recipients integer not null default 0 check (total_recipients >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  worker_id text,
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.discord_campaigns(id) on delete cascade,
  discord_user_id text not null,
  status text not null
    check (status in ('success','failed','skipped')),
  error_code text,
  attempted_at timestamptz not null default now(),
  unique(campaign_id,discord_user_id)
);

create table if not exists public.discord_campaign_worker_status (
  worker_id text primary key,
  guild_id text,
  guild_name text,
  bot_user_id text,
  bot_tag text,
  connected boolean not null default false,
  member_count integer not null default 0,
  online_count integer not null default 0,
  roles jsonb not null default '[]'::jsonb,
  version text,
  last_error text,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_campaigns_status_schedule_idx
  on public.discord_campaigns(status,scheduled_for,queued_at)
  where status='queued';

create index if not exists discord_campaigns_created_idx
  on public.discord_campaigns(created_at desc);

create index if not exists discord_campaign_deliveries_campaign_idx
  on public.discord_campaign_deliveries(campaign_id,status);

alter table public.discord_campaign_templates enable row level security;
alter table public.discord_campaigns enable row level security;
alter table public.discord_campaign_deliveries enable row level security;
alter table public.discord_campaign_worker_status enable row level security;

drop policy if exists "Admins manage discord campaign templates" on public.discord_campaign_templates;
create policy "Admins manage discord campaign templates"
on public.discord_campaign_templates
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage discord campaigns" on public.discord_campaigns;
create policy "Admins manage discord campaigns"
on public.discord_campaigns
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins read discord campaign deliveries" on public.discord_campaign_deliveries;
create policy "Admins read discord campaign deliveries"
on public.discord_campaign_deliveries
for select
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins read discord campaign worker" on public.discord_campaign_worker_status;
create policy "Admins read discord campaign worker"
on public.discord_campaign_worker_status
for select
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.discord_campaign_templates from anon;
revoke all on public.discord_campaigns from anon;
revoke all on public.discord_campaign_deliveries from anon,authenticated;
revoke all on public.discord_campaign_worker_status from anon,authenticated;

grant select,insert,update,delete on public.discord_campaign_templates to authenticated;
grant select,insert,update on public.discord_campaigns to authenticated;
grant select on public.discord_campaign_deliveries to authenticated;
grant select on public.discord_campaign_worker_status to authenticated;

create or replace function public.queue_discord_campaign(
  p_template_id uuid default null,
  p_title text default null,
  p_description text default '',
  p_image_url text default null,
  p_thumbnail_url text default null,
  p_link_url text default null,
  p_button_label text default '🛒 Acessar Loja',
  p_footer_text text default null,
  p_color integer default 255,
  p_target_mode text default 'all',
  p_target_role_id text default null,
  p_target_user_id text default null,
  p_guild_id text default null,
  p_scheduled_for timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.discord_campaigns;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if char_length(coalesce(p_description,'')) > 4096 then
    raise exception 'DESCRIPTION_TOO_LONG';
  end if;

  if p_title is not null and char_length(p_title) > 256 then
    raise exception 'TITLE_TOO_LONG';
  end if;

  if p_button_label is null or char_length(btrim(p_button_label)) not between 1 and 80 then
    raise exception 'INVALID_BUTTON_LABEL';
  end if;

  if p_color < 0 or p_color > 16777215 then
    raise exception 'INVALID_COLOR';
  end if;

  if p_target_mode not in ('all','online','role','single') then
    raise exception 'INVALID_TARGET';
  end if;

  if p_target_mode='role' and nullif(btrim(coalesce(p_target_role_id,'')),'') is null then
    raise exception 'ROLE_REQUIRED';
  end if;

  if p_target_mode='single' and nullif(btrim(coalesce(p_target_user_id,'')),'') is null then
    raise exception 'USER_REQUIRED';
  end if;

  insert into public.discord_campaigns(
    template_id,created_by,guild_id,title,description,image_url,thumbnail_url,
    link_url,button_label,footer_text,color,target_mode,target_role_id,target_user_id,
    scheduled_for,status,queued_at
  )
  values(
    p_template_id,v_user,nullif(btrim(coalesce(p_guild_id,'')),''),
    nullif(btrim(coalesce(p_title,'')),''),
    coalesce(p_description,''),
    nullif(btrim(coalesce(p_image_url,'')),''),
    nullif(btrim(coalesce(p_thumbnail_url,'')),''),
    nullif(btrim(coalesce(p_link_url,'')),''),
    btrim(p_button_label),
    nullif(btrim(coalesce(p_footer_text,'')),''),
    p_color,p_target_mode,
    nullif(btrim(coalesce(p_target_role_id,'')),''),
    nullif(btrim(coalesce(p_target_user_id,'')),''),
    greatest(coalesce(p_scheduled_for,now()),now()),
    'queued',now()
  )
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'status',v_row.status,
    'scheduled_for',v_row.scheduled_for
  );
end;
$$;

create or replace function public.cancel_discord_campaign(
  p_campaign_id uuid
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

  update public.discord_campaigns
  set
    cancel_requested=true,
    status=case when status='queued' then 'cancelled' else status end,
    finished_at=case when status='queued' then now() else finished_at end,
    updated_at=now()
  where id=p_campaign_id
    and status in ('queued','running');

  return found;
end;
$$;

create or replace function public.claim_discord_campaign(
  p_worker_id text
)
returns jsonb
language plpgsql
security invoker
set search_path=public,auth,pg_temp
as $$
declare
  v_row public.discord_campaigns;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if nullif(btrim(coalesce(p_worker_id,'')),'') is null then
    raise exception 'WORKER_ID_REQUIRED';
  end if;

  select *
  into v_row
  from public.discord_campaigns
  where status='queued'
    and cancel_requested=false
    and scheduled_for<=now()
  order by scheduled_for,queued_at
  for update skip locked
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  update public.discord_campaigns
  set
    status='running',
    worker_id=btrim(p_worker_id),
    started_at=coalesce(started_at,now()),
    heartbeat_at=now(),
    updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.update_discord_campaign_progress(
  p_campaign_id uuid,
  p_worker_id text,
  p_total integer,
  p_processed integer,
  p_success integer,
  p_failed integer,
  p_skipped integer
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

  update public.discord_campaigns
  set
    total_recipients=greatest(0,p_total),
    processed_count=greatest(0,p_processed),
    success_count=greatest(0,p_success),
    failed_count=greatest(0,p_failed),
    skipped_count=greatest(0,p_skipped),
    heartbeat_at=now(),
    updated_at=now()
  where id=p_campaign_id
    and status='running'
    and worker_id=p_worker_id;

  return found;
end;
$$;

create or replace function public.finish_discord_campaign(
  p_campaign_id uuid,
  p_worker_id text,
  p_status text,
  p_total integer,
  p_processed integer,
  p_success integer,
  p_failed integer,
  p_skipped integer,
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

  update public.discord_campaigns
  set
    status=p_status,
    total_recipients=greatest(0,p_total),
    processed_count=greatest(0,p_processed),
    success_count=greatest(0,p_success),
    failed_count=greatest(0,p_failed),
    skipped_count=greatest(0,p_skipped),
    last_error=nullif(left(coalesce(p_last_error,''),1000),''),
    heartbeat_at=now(),
    finished_at=now(),
    updated_at=now()
  where id=p_campaign_id
    and worker_id=p_worker_id
    and status='running';

  return found;
end;
$$;

create or replace function public.heartbeat_discord_campaign_worker(
  p_worker_id text,
  p_guild_id text,
  p_guild_name text,
  p_bot_user_id text,
  p_bot_tag text,
  p_connected boolean,
  p_member_count integer,
  p_online_count integer,
  p_roles jsonb,
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
    member_count,online_count,roles,version,last_error,last_seen_at,updated_at
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
      version=excluded.version,
      last_error=excluded.last_error,
      last_seen_at=now(),
      updated_at=now();

  return true;
end;
$$;

revoke execute on function public.queue_discord_campaign(uuid,text,text,text,text,text,text,text,integer,text,text,text,text,timestamptz)
  from public,anon;
revoke execute on function public.cancel_discord_campaign(uuid)
  from public,anon;
revoke execute on function public.claim_discord_campaign(text)
  from public,anon,authenticated;
revoke execute on function public.update_discord_campaign_progress(uuid,text,integer,integer,integer,integer,integer)
  from public,anon,authenticated;
revoke execute on function public.finish_discord_campaign(uuid,text,text,integer,integer,integer,integer,integer,text)
  from public,anon,authenticated;
revoke execute on function public.heartbeat_discord_campaign_worker(text,text,text,text,text,boolean,integer,integer,jsonb,text,text)
  from public,anon,authenticated;

grant execute on function public.queue_discord_campaign(uuid,text,text,text,text,text,text,text,integer,text,text,text,text,timestamptz)
  to authenticated;
grant execute on function public.cancel_discord_campaign(uuid)
  to authenticated;
grant execute on function public.claim_discord_campaign(text)
  to service_role;
grant execute on function public.update_discord_campaign_progress(uuid,text,integer,integer,integer,integer,integer)
  to service_role;
grant execute on function public.finish_discord_campaign(uuid,text,text,integer,integer,integer,integer,integer,text)
  to service_role;
grant execute on function public.heartbeat_discord_campaign_worker(text,text,text,text,text,boolean,integer,integer,jsonb,text,text)
  to service_role;
