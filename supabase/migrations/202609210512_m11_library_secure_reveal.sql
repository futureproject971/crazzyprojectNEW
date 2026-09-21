-- M11 — CRAZZY LIBRARY
-- Secure delivery metadata, server-only payloads and reveal audit.

create table if not exists public.library_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_type text not null
    check (delivery_type in ('key','account','link','reward','manual')),
  product_id uuid references public.products(id) on delete set null,
  product_plan_id uuid references public.product_plans(id) on delete set null,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  source_order_ticket_id uuid references public.order_tickets(id) on delete set null,
  source_stock_item_id uuid references public.stock_items(id) on delete set null,
  source_reward_delivery_id uuid references public.reward_deliveries(id) on delete set null,
  source_trial_stock_item_id uuid references public.trial_stock_items(id) on delete set null,
  status text not null default 'available'
    check (status in ('available','expired','revoked','refunded','disputed')),
  delivered_at timestamptz not null default now(),
  expires_at timestamptz,
  reveal_count integer not null default 0 check (reveal_count >= 0),
  last_revealed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_order_ticket_id),
  unique (source_reward_delivery_id)
);

create index if not exists library_deliveries_user_status_idx
  on public.library_deliveries(user_id, status, delivered_at desc);

create index if not exists library_deliveries_entitlement_idx
  on public.library_deliveries(entitlement_id)
  where entitlement_id is not null;

alter table public.library_deliveries enable row level security;

revoke all on table public.library_deliveries from anon;
revoke all on table public.library_deliveries from authenticated;
grant select on table public.library_deliveries to authenticated;

drop policy if exists "Library deliveries visible to owner or admin" on public.library_deliveries;
create policy "Library deliveries visible to owner or admin"
on public.library_deliveries
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

create table if not exists private.library_delivery_secrets (
  delivery_id uuid primary key references public.library_deliveries(id) on delete cascade,
  payload text not null,
  payload_format text not null default 'text'
    check (payload_format in ('text','json','url')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.library_delivery_secrets from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.library_delivery_secrets to service_role;

create table if not exists public.library_reveal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.library_deliveries(id) on delete cascade,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  action text not null check (action in ('reveal','copy')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists library_reveal_events_user_created_idx
  on public.library_reveal_events(user_id, created_at desc);

alter table public.library_reveal_events enable row level security;

revoke all on table public.library_reveal_events from anon;
revoke all on table public.library_reveal_events from authenticated;
grant select on table public.library_reveal_events to authenticated;

drop policy if exists "Library reveal events visible to owner or admin" on public.library_reveal_events;
create policy "Library reveal events visible to owner or admin"
on public.library_reveal_events
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

-- Paid stock and reward payloads remain backend/admin data only.
drop policy if exists "Stock visible after delivery or to admin" on public.stock_items;
drop policy if exists "Admins can view stock" on public.stock_items;
create policy "Admins can view stock"
on public.stock_items
for select
to authenticated
using (private.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists "Reward deliveries visible to owner or admin" on public.reward_deliveries;
drop policy if exists "Admins view reward deliveries" on public.reward_deliveries;
create policy "Admins view reward deliveries"
on public.reward_deliveries
for select
to authenticated
using (private.has_role((select auth.uid()), 'admin'::app_role));

-- Synchronize any delivered order ticket into Library metadata + private secret.
create or replace function private.sync_order_ticket_library_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload text;
  v_delivery_id uuid;
  v_delivery_type text;
  v_safe_metadata jsonb;
begin
  if new.stock_item_id is null
     or new.status::text not in ('delivered','resolved','closed','finished','archived') then
    return new;
  end if;

  select si.content
    into v_payload
  from public.stock_items si
  where si.id = new.stock_item_id;

  if v_payload is null or btrim(v_payload) = '' then
    return new;
  end if;

  v_delivery_type := case
    when coalesce(new.metadata ->> 'type', '') = 'lzt-account' then 'account'
    else 'key'
  end;

  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'account_name', nullif(new.metadata ->> 'account_name', ''),
    'account_image', nullif(new.metadata ->> 'account_image', ''),
    'skins_count', nullif(new.metadata ->> 'skins_count', ''),
    'lzt_item_id', nullif(new.metadata ->> 'lzt_item_id', '')
  ));

  insert into public.library_deliveries (
    user_id,
    delivery_type,
    product_id,
    product_plan_id,
    source_order_ticket_id,
    source_stock_item_id,
    status,
    delivered_at,
    metadata,
    updated_at
  ) values (
    new.user_id,
    v_delivery_type,
    new.product_id,
    new.product_plan_id,
    new.id,
    new.stock_item_id,
    'available',
    coalesce(new.updated_at, now()),
    v_safe_metadata,
    now()
  )
  on conflict (source_order_ticket_id)
  do update set
    source_stock_item_id = excluded.source_stock_item_id,
    product_id = excluded.product_id,
    product_plan_id = excluded.product_plan_id,
    status = case
      when public.library_deliveries.status in ('revoked','refunded','disputed')
        then public.library_deliveries.status
      else 'available'
    end,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_delivery_id;

  insert into private.library_delivery_secrets (
    delivery_id,
    payload,
    payload_format,
    updated_at
  ) values (
    v_delivery_id,
    v_payload,
    case when v_delivery_type = 'account' then 'json' else 'text' end,
    now()
  )
  on conflict (delivery_id)
  do update set
    payload = excluded.payload,
    payload_format = excluded.payload_format,
    updated_at = now();

  return new;
end;
$function$;

revoke execute on function private.sync_order_ticket_library_delivery() from public;

drop trigger if exists trg_sync_order_ticket_library_delivery on public.order_tickets;
create trigger trg_sync_order_ticket_library_delivery
after insert or update of stock_item_id, status
on public.order_tickets
for each row
execute function private.sync_order_ticket_library_delivery();

-- Synchronize rewards into the same Library model.
create or replace function private.sync_reward_library_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product_id uuid;
  v_product_plan_id uuid;
  v_delivery_id uuid;
begin
  select rs.product_id, rs.product_plan_id
    into v_product_id, v_product_plan_id
  from public.reward_sessions rs
  where rs.id = new.session_id;

  insert into public.library_deliveries (
    user_id,
    delivery_type,
    product_id,
    product_plan_id,
    source_reward_delivery_id,
    source_trial_stock_item_id,
    status,
    delivered_at,
    expires_at,
    metadata,
    updated_at
  ) values (
    new.user_id,
    'reward',
    v_product_id,
    v_product_plan_id,
    new.id,
    new.trial_stock_item_id,
    case when new.expires_at is not null and new.expires_at <= now()
      then 'expired'
      else 'available'
    end,
    new.delivered_at,
    new.expires_at,
    jsonb_build_object('delivery_mode', new.delivery_mode),
    now()
  )
  on conflict (source_reward_delivery_id)
  do update set
    product_id = excluded.product_id,
    product_plan_id = excluded.product_plan_id,
    source_trial_stock_item_id = excluded.source_trial_stock_item_id,
    expires_at = excluded.expires_at,
    metadata = excluded.metadata,
    status = case
      when public.library_deliveries.status in ('revoked','refunded','disputed')
        then public.library_deliveries.status
      when excluded.expires_at is not null and excluded.expires_at <= now()
        then 'expired'
      else 'available'
    end,
    updated_at = now()
  returning id into v_delivery_id;

  if new.content is not null and btrim(new.content) <> '' then
    insert into private.library_delivery_secrets (
      delivery_id,
      payload,
      payload_format,
      updated_at
    ) values (
      v_delivery_id,
      new.content,
      'text',
      now()
    )
    on conflict (delivery_id)
    do update set
      payload = excluded.payload,
      payload_format = excluded.payload_format,
      updated_at = now();
  end if;

  return new;
end;
$function$;

revoke execute on function private.sync_reward_library_delivery() from public;

drop trigger if exists trg_sync_reward_library_delivery on public.reward_deliveries;
create trigger trg_sync_reward_library_delivery
after insert or update of content, expires_at
on public.reward_deliveries
for each row
execute function private.sync_reward_library_delivery();

-- Backfill if this migration is ever applied to an environment with existing rows.
insert into public.library_deliveries (
  user_id, delivery_type, product_id, product_plan_id,
  source_order_ticket_id, source_stock_item_id, status, delivered_at, metadata
)
select
  ot.user_id,
  case when coalesce(ot.metadata ->> 'type','') = 'lzt-account' then 'account' else 'key' end,
  ot.product_id,
  ot.product_plan_id,
  ot.id,
  ot.stock_item_id,
  'available',
  coalesce(ot.updated_at, ot.created_at),
  jsonb_strip_nulls(jsonb_build_object(
    'account_name', nullif(ot.metadata ->> 'account_name',''),
    'account_image', nullif(ot.metadata ->> 'account_image',''),
    'skins_count', nullif(ot.metadata ->> 'skins_count',''),
    'lzt_item_id', nullif(ot.metadata ->> 'lzt_item_id','')
  ))
from public.order_tickets ot
join public.stock_items si on si.id = ot.stock_item_id
where ot.stock_item_id is not null
  and ot.status::text in ('delivered','resolved','closed','finished','archived')
on conflict (source_order_ticket_id) do nothing;

insert into private.library_delivery_secrets (delivery_id, payload, payload_format)
select
  d.id,
  si.content,
  case when d.delivery_type = 'account' then 'json' else 'text' end
from public.library_deliveries d
join public.stock_items si on si.id = d.source_stock_item_id
where d.source_stock_item_id is not null
  and si.content is not null
  and btrim(si.content) <> ''
on conflict (delivery_id) do nothing;

insert into public.library_deliveries (
  user_id, delivery_type, product_id, product_plan_id,
  source_reward_delivery_id, source_trial_stock_item_id,
  status, delivered_at, expires_at, metadata
)
select
  rd.user_id,
  'reward',
  rs.product_id,
  rs.product_plan_id,
  rd.id,
  rd.trial_stock_item_id,
  case when rd.expires_at is not null and rd.expires_at <= now() then 'expired' else 'available' end,
  rd.delivered_at,
  rd.expires_at,
  jsonb_build_object('delivery_mode', rd.delivery_mode)
from public.reward_deliveries rd
left join public.reward_sessions rs on rs.id = rd.session_id
on conflict (source_reward_delivery_id) do nothing;

insert into private.library_delivery_secrets (delivery_id, payload, payload_format)
select d.id, rd.content, 'text'
from public.library_deliveries d
join public.reward_deliveries rd on rd.id = d.source_reward_delivery_id
where d.source_reward_delivery_id is not null
  and rd.content is not null
  and btrim(rd.content) <> ''
on conflict (delivery_id) do nothing;

-- Service-only reveal RPC. It validates ownership/status and records the event atomically.
create or replace function public.library_reveal_owned_delivery(
  p_delivery_id uuid,
  p_user_id uuid
)
returns table (
  payload text,
  payload_format text,
  delivery_type text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_delivery public.library_deliveries%rowtype;
  v_payload text;
  v_payload_format text;
begin
  select d.*
    into v_delivery
  from public.library_deliveries d
  where d.id = p_delivery_id
    and d.user_id = p_user_id
  limit 1;

  if v_delivery.id is null then
    return;
  end if;

  if v_delivery.status in ('revoked','refunded','disputed') then
    return;
  end if;

  if v_delivery.expires_at is not null and v_delivery.expires_at <= now() then
    update public.library_deliveries
      set status = 'expired', updated_at = now()
    where id = v_delivery.id
      and status = 'available';
    return;
  end if;

  if v_delivery.entitlement_id is not null and exists (
    select 1
    from public.entitlements e
    where e.id = v_delivery.entitlement_id
      and e.user_id = p_user_id
      and e.status in ('revoked','refunded','disputed')
  ) then
    return;
  end if;

  select s.payload, s.payload_format
    into v_payload, v_payload_format
  from private.library_delivery_secrets s
  where s.delivery_id = v_delivery.id;

  if v_payload is null then
    return;
  end if;

  update public.library_deliveries
  set reveal_count = reveal_count + 1,
      last_revealed_at = now(),
      updated_at = now()
  where id = v_delivery.id;

  insert into public.library_reveal_events (
    user_id,
    delivery_id,
    entitlement_id,
    action,
    metadata
  ) values (
    p_user_id,
    v_delivery.id,
    v_delivery.entitlement_id,
    'reveal',
    '{}'::jsonb
  );

  return query
  select v_payload, v_payload_format, v_delivery.delivery_type;
end;
$function$;

revoke execute on function public.library_reveal_owned_delivery(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.library_reveal_owned_delivery(uuid, uuid)
to service_role;

create or replace function public.library_record_copy_event(
  p_delivery_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_entitlement_id uuid;
begin
  select d.entitlement_id
    into v_entitlement_id
  from public.library_deliveries d
  where d.id = p_delivery_id
    and d.user_id = p_user_id
    and d.status not in ('revoked','refunded','disputed')
    and (d.expires_at is null or d.expires_at > now())
  limit 1;

  if not found then
    return false;
  end if;

  insert into public.library_reveal_events (
    user_id,
    delivery_id,
    entitlement_id,
    action,
    metadata
  ) values (
    p_user_id,
    p_delivery_id,
    v_entitlement_id,
    'copy',
    '{}'::jsonb
  );

  return true;
end;
$function$;

revoke execute on function public.library_record_copy_event(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.library_record_copy_event(uuid, uuid)
to service_role;
