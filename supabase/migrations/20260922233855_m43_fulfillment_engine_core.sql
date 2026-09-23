
create table if not exists public.fulfillment_runs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running'
    check (status in ('queued','running','completed','manual_review','failed','refunded','disputed')),
  planned_units integer not null default 0 check (planned_units >= 0),
  ticket_count integer not null default 0 check (ticket_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  manual_count integer not null default 0 check (manual_count >= 0),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fulfillment_runs_status_updated_idx
on public.fulfillment_runs(status, updated_at desc);

create index if not exists fulfillment_runs_user_created_idx
on public.fulfillment_runs(user_id, created_at desc);

alter table public.fulfillment_runs enable row level security;
revoke all on table public.fulfillment_runs from anon;
revoke all on table public.fulfillment_runs from authenticated;
grant select on table public.fulfillment_runs to authenticated;
grant all on table public.fulfillment_runs to service_role;

drop policy if exists "Admins view fulfillment runs" on public.fulfillment_runs;
create policy "Admins view fulfillment runs"
on public.fulfillment_runs for select
to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));

create table if not exists public.fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.fulfillment_runs(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  order_ticket_id uuid references public.order_tickets(id) on delete set null,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  event_type text not null,
  level text not null default 'info'
    check (level in ('info','warn','error')),
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fulfillment_events_payment_created_idx
on public.fulfillment_events(payment_id, created_at desc);

create index if not exists fulfillment_events_run_created_idx
on public.fulfillment_events(run_id, created_at desc);

create unique index if not exists fulfillment_events_ticket_type_unique_idx
on public.fulfillment_events(order_ticket_id,event_type)
where order_ticket_id is not null;

alter table public.fulfillment_events enable row level security;
revoke all on table public.fulfillment_events from anon;
revoke all on table public.fulfillment_events from authenticated;
grant select on table public.fulfillment_events to authenticated;
grant all on table public.fulfillment_events to service_role;

drop policy if exists "Admins view fulfillment events" on public.fulfillment_events;
create policy "Admins view fulfillment events"
on public.fulfillment_events for select
to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));

alter table public.discord_role_grants
  add column if not exists desired_state text not null default 'granted'
  check (desired_state in ('granted','revoked'));

create unique index if not exists discord_role_grants_entitlement_role_unique_idx
on public.discord_role_grants(entitlement_id,role_id);

create or replace function private.payment_planned_units(p_payment_id uuid)
returns integer
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select sum(
      greatest(
        1,
        least(
          20,
          case
            when (item->>'quantity') ~ '^[0-9]+$' then (item->>'quantity')::integer
            else 1
          end
        )
      )
    )::integer
    from public.payments p,
         lateral jsonb_array_elements(coalesce(p.cart_snapshot,'[]'::jsonb)) item
    where p.id=p_payment_id
  ),0);
$$;

revoke execute on function private.payment_planned_units(uuid) from public;

create or replace function private.refresh_fulfillment_run(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_payment public.payments;
  v_run public.fulfillment_runs;
  v_tickets integer;
  v_delivered integer;
  v_manual integer;
  v_status text;
begin
  select * into v_payment from public.payments where id=p_payment_id;
  if v_payment.id is null then return; end if;

  insert into public.fulfillment_runs(payment_id,user_id,status,planned_units,updated_at)
  values(
    v_payment.id,
    v_payment.user_id,
    case
      when v_payment.status='COMPLETED' then 'completed'
      when v_payment.status='FULFILLING' then 'running'
      else 'queued'
    end,
    private.payment_planned_units(v_payment.id),
    now()
  )
  on conflict (payment_id)
  do update set
    planned_units=excluded.planned_units,
    updated_at=now()
  returning * into v_run;

  select
    count(*)::integer,
    count(*) filter (where ot.stock_item_id is not null and ot.status::text in ('delivered','resolved','closed','finished','archived'))::integer,
    count(*) filter (where ot.stock_item_id is null and ot.status::text not in ('resolved','closed','finished','archived'))::integer
  into v_tickets,v_delivered,v_manual
  from public.order_tickets ot
  where ot.payment_id=p_payment_id;

  v_status := case
    when v_payment.status='COMPLETED' and v_manual>0 then 'manual_review'
    when v_payment.status='COMPLETED' then 'completed'
    when v_payment.status='FULFILLING' then 'running'
    else v_run.status
  end;

  update public.fulfillment_runs
  set ticket_count=v_tickets,
      delivered_count=v_delivered,
      manual_count=v_manual,
      status=v_status,
      finished_at=case when v_status in ('completed','manual_review','refunded','disputed') then coalesce(finished_at,now()) else null end,
      updated_at=now()
  where payment_id=p_payment_id;
end;
$$;

revoke execute on function private.refresh_fulfillment_run(uuid) from public;

create or replace function private.sync_paid_order_fulfillment()
returns trigger
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_entitlement public.entitlements;
  v_fulfillment_key text;
  v_duration integer;
  v_role_id text;
  v_role_name text;
  v_discord_user_id text;
  v_guild_id text;
  v_run_id uuid;
begin
  if new.payment_id is null then
    return new;
  end if;

  if new.payment_item_index is null or new.payment_unit_index is null then
    return new;
  end if;

  v_fulfillment_key :=
    'payment:' || new.payment_id::text || ':' ||
    new.payment_item_index::text || ':' || new.payment_unit_index::text;

  select
    ppo.entitlement_duration_minutes,
    nullif(btrim(ppo.discord_role_id),''),
    nullif(btrim(ppo.discord_role_name),'')
  into v_duration,v_role_id,v_role_name
  from private.product_plan_operations ppo
  where ppo.product_plan_id=new.product_plan_id;

  insert into public.entitlements(
    user_id,product_id,product_plan_id,source_payment_id,source_order_ticket_id,
    fulfillment_key,status,starts_at,expires_at,tutorial_access,metadata,updated_at
  )
  values(
    new.user_id,new.product_id,new.product_plan_id,new.payment_id,new.id,
    v_fulfillment_key,'active',now(),
    case when v_duration is null then null else now() + make_interval(mins => v_duration) end,
    true,
    jsonb_build_object(
      'payment_item_index',new.payment_item_index,
      'payment_unit_index',new.payment_unit_index,
      'delivery_mode',coalesce(new.metadata->>'delivery_mode','unknown')
    ),
    now()
  )
  on conflict (fulfillment_key)
  do update set
    source_order_ticket_id=excluded.source_order_ticket_id,
    status=case
      when public.entitlements.status in ('refunded','disputed','revoked')
        then public.entitlements.status
      else 'active'
    end,
    updated_at=now()
  returning * into v_entitlement;

  update public.library_deliveries
  set entitlement_id=v_entitlement.id,
      updated_at=now()
  where source_order_ticket_id=new.id
    and entitlement_id is distinct from v_entitlement.id;

  if v_role_id is not null then
    select di.discord_user_id
      into v_discord_user_id
    from public.discord_identities di
    where di.user_id=new.user_id;

    select sc.value
      into v_guild_id
    from public.system_credentials sc
    where sc.env_key='DISCORD_GUILD_ID';

    insert into public.discord_role_grants(
      user_id,entitlement_id,discord_user_id,guild_id,role_id,role_name,
      desired_state,status,updated_at
    )
    values(
      new.user_id,v_entitlement.id,v_discord_user_id,nullif(btrim(v_guild_id),''),
      v_role_id,v_role_name,'granted','pending',now()
    )
    on conflict (entitlement_id,role_id)
    do update set
      discord_user_id=excluded.discord_user_id,
      guild_id=excluded.guild_id,
      role_name=excluded.role_name,
      desired_state='granted',
      status=case when public.discord_role_grants.status='granted' then 'granted' else 'pending' end,
      revoked_at=null,
      last_error_code=null,
      updated_at=now();
  end if;

  perform private.refresh_fulfillment_run(new.payment_id);

  select fr.id into v_run_id
  from public.fulfillment_runs fr
  where fr.payment_id=new.payment_id;

  insert into public.fulfillment_events(
    run_id,payment_id,order_ticket_id,entitlement_id,event_type,level,message,metadata
  )
  values(
    v_run_id,new.payment_id,new.id,v_entitlement.id,
    'entitlement_synced','info','Entitlement sincronizado a partir do pedido pago.',
    jsonb_build_object(
      'fulfillment_key',v_fulfillment_key,
      'stock_item_id',new.stock_item_id,
      'role_requested',v_role_id is not null
    )
  )
  on conflict (order_ticket_id,event_type)
  where order_ticket_id is not null
  do nothing;

  return new;
end;
$$;

revoke execute on function private.sync_paid_order_fulfillment() from public;

drop trigger if exists trg_sync_paid_order_fulfillment on public.order_tickets;
create trigger trg_sync_paid_order_fulfillment
after insert or update of payment_id,payment_item_index,payment_unit_index,stock_item_id,status
on public.order_tickets
for each row
execute function private.sync_paid_order_fulfillment();

create or replace function private.sync_payment_fulfillment_run()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('FULFILLING','COMPLETED') then
    perform private.refresh_fulfillment_run(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_payment_fulfillment_run() from public;

drop trigger if exists trg_sync_payment_fulfillment_run on public.payments;
create trigger trg_sync_payment_fulfillment_run
after update of status on public.payments
for each row
execute function private.sync_payment_fulfillment_run();

create or replace function private.revoke_payment_access(
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_status text := case when p_reason='refund' then 'refunded' else 'disputed' end;
begin
  update public.entitlements
  set status=v_status,
      tutorial_access=false,
      updated_at=now()
  where source_payment_id=p_payment_id
    and status not in ('refunded','disputed');

  update public.library_deliveries ld
  set status=v_status,
      updated_at=now()
  where ld.entitlement_id in (
    select e.id from public.entitlements e where e.source_payment_id=p_payment_id
  );

  update public.discord_role_grants drg
  set desired_state='revoked',
      status=case when drg.status='revoked' then 'revoked' else 'pending' end,
      updated_at=now()
  where drg.entitlement_id in (
    select e.id from public.entitlements e where e.source_payment_id=p_payment_id
  );

  update public.fulfillment_runs
  set status=v_status,
      finished_at=coalesce(finished_at,now()),
      updated_at=now()
  where payment_id=p_payment_id;

  insert into public.fulfillment_events(payment_id,run_id,event_type,level,message,metadata)
  select
    p_payment_id,fr.id,'access_revoked','warn',
    case when p_reason='refund' then 'Acesso revogado por reembolso concluído.' else 'Acesso revogado por disputa.' end,
    jsonb_build_object('reason',p_reason)
  from public.fulfillment_runs fr
  where fr.payment_id=p_payment_id;
end;
$$;

revoke execute on function private.revoke_payment_access(uuid,text) from public;

create or replace function private.sync_refund_access()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform private.revoke_payment_access(new.payment_id,'refund');
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_refund_access() from public;

drop trigger if exists trg_sync_refund_access on public.payment_refunds;
create trigger trg_sync_refund_access
after insert or update of status on public.payment_refunds
for each row execute function private.sync_refund_access();

create or replace function private.sync_dispute_access()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.status in ('open','under_review','lost')
     and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform private.revoke_payment_access(new.payment_id,'dispute');
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_dispute_access() from public;

drop trigger if exists trg_sync_dispute_access on public.payment_disputes;
create trigger trg_sync_dispute_access
after insert or update of status on public.payment_disputes
for each row execute function private.sync_dispute_access();

-- Backfill any already-paid ticket if this arrives after M08/M10/M11.
update public.order_tickets
set updated_at=updated_at
where payment_id is not null
  and payment_item_index is not null
  and payment_unit_index is not null;
