
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info','warn','high','critical')),
  category text not null,
  source text not null default 'system',
  event_key text,
  dedup_key text,
  title text not null,
  message text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  occurrences integer not null default 1 check (occurrences >= 1),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  discord_notified_at timestamptz,
  discord_notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_events_status_severity_idx
on public.security_events(status,severity,last_seen_at desc);

create index if not exists security_events_category_seen_idx
on public.security_events(category,last_seen_at desc);

create index if not exists security_events_dedup_idx
on public.security_events(dedup_key,last_seen_at desc)
where dedup_key is not null;

alter table public.security_events enable row level security;
revoke all on table public.security_events from anon;
revoke all on table public.security_events from authenticated;
grant select on table public.security_events to authenticated;
grant all on table public.security_events to service_role;

drop policy if exists "Admins view security events" on public.security_events;
create policy "Admins view security events"
on public.security_events for select
to authenticated
using (private.has_role((select auth.uid()),'admin'::public.app_role));

insert into public.system_credentials(name,env_key,value,description,help_url)
values
  ('Discord Security Channel','DISCORD_SECURITY_CHANNEL_ID','','Canal privado #security-logs usado pelo Security Sentinel.',''),
  ('Discord Security Critical Role','DISCORD_SECURITY_ROLE_ID','','Cargo mencionado somente em eventos CRITICAL.','')
on conflict (env_key) do nothing;

create or replace function public.log_security_event(
  p_severity text,
  p_category text,
  p_source text,
  p_event_key text,
  p_dedup_key text,
  p_title text,
  p_message text,
  p_actor_user_id uuid default null,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_cooldown_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_existing public.security_events;
  v_id uuid;
  v_severity text := lower(btrim(coalesce(p_severity,'')));
  v_category text := left(btrim(coalesce(p_category,'general')),80);
  v_source text := left(btrim(coalesce(p_source,'system')),80);
  v_dedup text := nullif(left(btrim(coalesce(p_dedup_key,'')),240),'');
  v_cooldown integer := greatest(0,least(coalesce(p_cooldown_seconds,300),86400));
begin
  if current_user not in ('service_role','postgres','supabase_admin')
     and not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'SECURITY_EVENT_WRITE_FORBIDDEN';
  end if;

  if v_severity not in ('info','warn','high','critical') then
    raise exception 'INVALID_SECURITY_SEVERITY';
  end if;
  if btrim(coalesce(p_title,''))='' then
    raise exception 'SECURITY_TITLE_REQUIRED';
  end if;

  if v_dedup is not null then
    select *
    into v_existing
    from public.security_events se
    where se.dedup_key=v_dedup
      and se.status='open'
      and se.last_seen_at >= now() - (v_cooldown||' seconds')::interval
    order by se.last_seen_at desc
    for update
    limit 1;
  end if;

  if v_existing.id is not null then
    update public.security_events
    set occurrences=occurrences+1,
        severity=case
          when severity='critical' or v_severity='critical' then 'critical'
          when severity='high' or v_severity='high' then 'high'
          when severity='warn' or v_severity='warn' then 'warn'
          else 'info'
        end,
        message=left(coalesce(p_message,''),2000),
        metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),
        last_seen_at=now(),
        updated_at=now()
    where id=v_existing.id
    returning id into v_id;
    return v_id;
  end if;

  insert into public.security_events(
    severity,category,source,event_key,dedup_key,title,message,
    actor_user_id,target_user_id,metadata
  )
  values(
    v_severity,v_category,v_source,nullif(left(btrim(coalesce(p_event_key,'')),160),''),
    v_dedup,left(btrim(p_title),180),left(coalesce(p_message,''),2000),
    p_actor_user_id,p_target_user_id,coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_security_event(text,text,text,text,text,text,text,uuid,uuid,jsonb,integer)
from public,anon,authenticated;
grant execute on function public.log_security_event(text,text,text,text,text,text,text,uuid,uuid,jsonb,integer)
to service_role;

create or replace function public.set_security_event_status(
  p_event_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if v_status not in ('open','acknowledged','resolved') then
    raise exception 'INVALID_SECURITY_STATUS';
  end if;

  update public.security_events
  set status=v_status,
      acknowledged_at=case when v_status='acknowledged' then coalesce(acknowledged_at,now()) else acknowledged_at end,
      acknowledged_by=case when v_status='acknowledged' then auth.uid() else acknowledged_by end,
      resolved_at=case when v_status='resolved' then coalesce(resolved_at,now()) when v_status='open' then null else resolved_at end,
      resolved_by=case when v_status='resolved' then auth.uid() when v_status='open' then null else resolved_by end,
      updated_at=now()
  where id=p_event_id;

  return found;
end;
$$;

revoke all on function public.set_security_event_status(uuid,text) from public,anon;
grant execute on function public.set_security_event_status(uuid,text) to authenticated;

create or replace function public.claim_security_alert(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_event public.security_events;
begin
  select *
  into v_event
  from public.security_events
  where status='open'
    and severity in ('high','critical')
    and discord_notified_at is null
    and (discord_notification_error is null or updated_at <= now()-interval '2 minutes')
  order by
    case severity when 'critical' then 0 else 1 end,
    last_seen_at asc
  for update skip locked
  limit 1;

  if v_event.id is null then return null; end if;

  update public.security_events
  set discord_notification_error='PROCESSING:'||left(coalesce(nullif(btrim(p_worker_id),''),'main'),80),
      updated_at=now()
  where id=v_event.id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

revoke all on function public.claim_security_alert(text) from public,anon,authenticated;
grant execute on function public.claim_security_alert(text) to service_role;

create or replace function public.finish_security_alert(
  p_event_id uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  update public.security_events
  set discord_notified_at=case when p_success then now() else discord_notified_at end,
      discord_notification_error=case when p_success then null else left(coalesce(p_error,'DISCORD_ALERT_FAILED'),200) end,
      updated_at=now()
  where id=p_event_id;

  return found;
end;
$$;

revoke all on function public.finish_security_alert(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_security_alert(uuid,boolean,text) to service_role;

create or replace function private.security_watch_dispute()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='INSERT' or old.status is distinct from new.status then
    if new.status in ('open','under_review','lost') then
      perform public.log_security_event(
        case when new.status='lost' then 'critical' else 'high' end,
        'payments','database',
        'payment_dispute',
        'payment_dispute:'||new.payment_id::text,
        'Disputa de pagamento',
        'Uma disputa exige revisão do pagamento e do acesso associado.',
        null,null,
        jsonb_build_object('payment_id',new.payment_id,'dispute_id',new.id,'status',new.status),
        300
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.security_watch_dispute() from public;

drop trigger if exists trg_security_watch_dispute on public.payment_disputes;
create trigger trg_security_watch_dispute
after insert or update of status on public.payment_disputes
for each row execute function private.security_watch_dispute();

create or replace function private.security_watch_role_failure()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status='failed'
     and new.attempt_count>=3
     and (tg_op='INSERT' or old.status is distinct from new.status or old.attempt_count is distinct from new.attempt_count) then
    perform public.log_security_event(
      case when new.attempt_count>=6 then 'high' else 'warn' end,
      'discord','discord-bridge',
      'role_sync_failed',
      'role_sync:'||new.id::text,
      'Falha repetida no Discord Bridge',
      'Um grant de role falhou repetidamente e precisa de inspeção.',
      null,new.user_id,
      jsonb_build_object(
        'grant_id',new.id,'role_id',new.role_id,
        'desired_state',new.desired_state,'attempt_count',new.attempt_count,
        'error_code',new.last_error_code
      ),
      600
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.security_watch_role_failure() from public;

drop trigger if exists trg_security_watch_role_failure on public.discord_role_grants;
create trigger trg_security_watch_role_failure
after insert or update of status,attempt_count,last_error_code
on public.discord_role_grants
for each row execute function private.security_watch_role_failure();

create or replace function private.security_watch_privilege_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_role text;
  v_target uuid;
begin
  v_role := coalesce(new.role::text,old.role::text);
  v_target := coalesce(new.user_id,old.user_id);

  if v_role in ('admin','moderator') then
    perform public.log_security_event(
      'high','authorization','database',
      'privilege_change',
      'privilege:'||v_target::text||':'||v_role,
      'Alteração de privilégio',
      case when tg_op='DELETE' then 'Um privilégio sensível foi removido.' else 'Um privilégio sensível foi concedido ou alterado.' end,
      auth.uid(),v_target,
      jsonb_build_object('operation',tg_op,'role',v_role),
      60
    );
  end if;
  return coalesce(new,old);
end;
$$;

revoke execute on function private.security_watch_privilege_change() from public;

drop trigger if exists trg_security_watch_privilege_change on public.user_roles;
create trigger trg_security_watch_privilege_change
after insert or update or delete on public.user_roles
for each row execute function private.security_watch_privilege_change();
