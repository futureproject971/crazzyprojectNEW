
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null default 'info',
  title text not null,
  body text not null default '',
  href text,
  dedup_key text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
on public.user_notifications(user_id,created_at desc);

create unique index if not exists user_notifications_user_dedup_unique_idx
on public.user_notifications(user_id,dedup_key)
where dedup_key is not null;

alter table public.user_notifications enable row level security;
revoke all on table public.user_notifications from anon;
revoke all on table public.user_notifications from authenticated;
grant select on table public.user_notifications to authenticated;
grant all on table public.user_notifications to service_role;

drop policy if exists "Notifications visible to owner or admin" on public.user_notifications;
create policy "Notifications visible to owner or admin"
on public.user_notifications for select
to authenticated
using (
  (select auth.uid())=user_id
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

create table if not exists public.discord_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.user_notifications(id) on delete set null,
  discord_user_id text,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','cancelled')),
  title text not null,
  body text not null default '',
  href text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  worker_id text,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_notification_jobs_queue_idx
on public.discord_notification_jobs(status,next_attempt_at,created_at)
where status in ('queued','processing','failed');

alter table public.discord_notification_jobs enable row level security;
revoke all on table public.discord_notification_jobs from anon;
revoke all on table public.discord_notification_jobs from authenticated;
grant select on table public.discord_notification_jobs to authenticated;
grant all on table public.discord_notification_jobs to service_role;

drop policy if exists "Admins view Discord notification jobs" on public.discord_notification_jobs;
create policy "Admins view Discord notification jobs"
on public.discord_notification_jobs for select
to authenticated
using (private.has_role((select auth.uid()),'admin'::public.app_role));

create or replace function public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text default null,
  p_dedup_key text default null,
  p_discord boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_notification public.user_notifications;
  v_discord_user_id text;
begin
  if current_user not in ('service_role','postgres','supabase_admin')
     and not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'NOTIFICATION_WRITE_FORBIDDEN';
  end if;
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'TITLE_REQUIRED'; end if;

  insert into public.user_notifications(
    user_id,notification_type,title,body,href,dedup_key,metadata
  )
  values(
    p_user_id,left(btrim(coalesce(p_type,'info')),50),left(btrim(p_title),180),
    left(coalesce(p_body,''),2000),nullif(left(btrim(coalesce(p_href,'')),500),''),
    nullif(left(btrim(coalesce(p_dedup_key,'')),240),''),
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (user_id,dedup_key)
  where dedup_key is not null
  do update set
    title=excluded.title,
    body=excluded.body,
    href=excluded.href,
    metadata=coalesce(public.user_notifications.metadata,'{}'::jsonb)||excluded.metadata,
    created_at=now(),
    read_at=null
  returning * into v_notification;

  if coalesce(p_discord,false) then
    select di.discord_user_id into v_discord_user_id
    from public.discord_identities di
    where di.user_id=p_user_id;

    insert into public.discord_notification_jobs(
      user_id,notification_id,discord_user_id,title,body,href,status,next_attempt_at
    )
    values(
      p_user_id,v_notification.id,v_discord_user_id,
      v_notification.title,v_notification.body,v_notification.href,
      'queued',now()
    );
  end if;

  return v_notification.id;
end;
$$;

revoke all on function public.create_user_notification(uuid,text,text,text,text,text,boolean,jsonb)
from public,anon,authenticated;
grant execute on function public.create_user_notification(uuid,text,text,text,text,text,boolean,jsonb)
to service_role;

create or replace function public.get_my_notifications(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  from (
    select id,notification_type,title,body,href,read_at,metadata,created_at
    from public.user_notifications
    where user_id=auth.uid()
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) x;
$$;

revoke all on function public.get_my_notifications(integer) from public,anon;
grant execute on function public.get_my_notifications(integer) to authenticated;

create or replace function public.mark_my_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where user_id=auth.uid()
    and (p_ids is null or id=any(p_ids));
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_my_notifications_read(uuid[]) from public,anon;
grant execute on function public.mark_my_notifications_read(uuid[]) to authenticated;

create or replace function public.claim_discord_notification_job(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job public.discord_notification_jobs;
begin
  update public.discord_notification_jobs
  set status='failed',last_error_code='WORKER_LEASE_EXPIRED',
      worker_id=null,locked_until=null,next_attempt_at=now(),updated_at=now()
  where status='processing' and locked_until is not null and locked_until<=now();

  select *
  into v_job
  from public.discord_notification_jobs
  where status in ('queued','failed')
    and (next_attempt_at is null or next_attempt_at<=now())
    and attempt_count<8
  order by created_at asc
  for update skip locked
  limit 1;

  if v_job.id is null then return null; end if;

  if v_job.discord_user_id is null then
    select di.discord_user_id into v_job.discord_user_id
    from public.discord_identities di
    where di.user_id=v_job.user_id;
  end if;

  update public.discord_notification_jobs
  set discord_user_id=v_job.discord_user_id,
      status='processing',
      attempt_count=attempt_count+1,
      last_attempt_at=now(),
      worker_id=left(coalesce(nullif(btrim(p_worker_id),''),'main'),120),
      locked_until=now()+interval '90 seconds',
      updated_at=now()
  where id=v_job.id
  returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

revoke all on function public.claim_discord_notification_job(text) from public,anon,authenticated;
grant execute on function public.claim_discord_notification_job(text) to service_role;

create or replace function public.finish_discord_notification_job(
  p_job_id uuid,
  p_worker_id text,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job public.discord_notification_jobs;
  v_delay integer;
begin
  select * into v_job from public.discord_notification_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.status<>'processing' then return false; end if;
  if v_job.worker_id is distinct from left(coalesce(nullif(btrim(p_worker_id),''),'main'),120) then return false; end if;

  if p_success then
    update public.discord_notification_jobs
    set status='sent',sent_at=now(),last_error_code=null,next_attempt_at=null,
        worker_id=null,locked_until=null,updated_at=now()
    where id=p_job_id;
  else
    v_delay:=least(60,greatest(1,power(2,least(v_job.attempt_count,6)-1)::integer));
    update public.discord_notification_jobs
    set status='failed',last_error_code=left(coalesce(p_error,'DISCORD_DM_FAILED'),160),
        next_attempt_at=now()+(v_delay||' minutes')::interval,
        worker_id=null,locked_until=null,updated_at=now()
    where id=p_job_id;
  end if;
  return true;
end;
$$;

revoke all on function public.finish_discord_notification_job(uuid,text,boolean,text)
from public,anon,authenticated;
grant execute on function public.finish_discord_notification_job(uuid,text,boolean,text)
to service_role;

create or replace function private.notify_library_delivery()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status='available' then
    perform public.create_user_notification(
      new.user_id,'delivery','Sua entrega está disponível',
      'Abra a Biblioteca CRAZZY para acessar sua entrega com segurança.',
      '/biblioteca','library:'||new.id::text,false,
      jsonb_build_object('delivery_id',new.id,'product_id',new.product_id)
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_library_delivery() from public;
drop trigger if exists trg_notify_library_delivery on public.library_deliveries;
create trigger trg_notify_library_delivery
after insert on public.library_deliveries
for each row execute function private.notify_library_delivery();

create or replace function private.notify_support_staff_reply()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid;
begin
  if new.sender_role='staff' then
    select st.user_id into v_user from public.support_tickets st where st.id=new.ticket_id;
    if v_user is not null and new.sender_user_id is distinct from v_user then
      perform public.create_user_notification(
        v_user,'support','Nova resposta no suporte',
        left(coalesce(new.message,'Você recebeu uma nova resposta.'),240),
        '/tickets/'||new.ticket_id::text,'support:'||new.id::text,false,
        jsonb_build_object('ticket_id',new.ticket_id)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_support_staff_reply() from public;
drop trigger if exists trg_notify_support_staff_reply on public.support_messages;
create trigger trg_notify_support_staff_reply
after insert on public.support_messages
for each row execute function private.notify_support_staff_reply();
