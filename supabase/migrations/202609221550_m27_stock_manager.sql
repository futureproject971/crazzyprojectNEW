-- M27 CRAZZY STOCK MANAGER
-- Local key inventory, duplicate prevention, batches, audit trail and atomic reservations.

create extension if not exists pgcrypto;

create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_plan_id uuid not null references public.product_plans(id) on delete restrict,
  imported_by uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  note text,
  submitted_count integer not null default 0 check (submitted_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.stock_batches enable row level security;

drop policy if exists "Admins read stock batches" on public.stock_batches;
create policy "Admins read stock batches"
on public.stock_batches for select to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.stock_batches from anon, authenticated;
grant select on public.stock_batches to authenticated;

alter table public.stock_items
  add column if not exists content_hash text,
  add column if not exists batch_id uuid references public.stock_batches(id) on delete set null,
  add column if not exists source text not null default 'legacy',
  add column if not exists disabled boolean not null default false,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

update public.stock_items
set content_hash=encode(digest(btrim(content),'sha256'),'hex')
where content_hash is null;

create unique index if not exists stock_items_content_hash_unique
  on public.stock_items(content_hash)
  where content_hash is not null;

create index if not exists stock_items_plan_available_idx
  on public.stock_items(product_plan_id,created_at)
  where used=false and disabled=false;

create index if not exists stock_items_batch_idx
  on public.stock_items(batch_id)
  where batch_id is not null;

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  product_plan_id uuid not null references public.product_plans(id) on delete restrict,
  reservation_key text not null unique,
  status text not null default 'reserved'
    check (status in ('reserved','consumed','released','expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stock_reservations enable row level security;

drop policy if exists "Admins read stock reservations" on public.stock_reservations;
create policy "Admins read stock reservations"
on public.stock_reservations for select to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.stock_reservations from anon, authenticated;
grant select on public.stock_reservations to authenticated;

create unique index if not exists stock_reservations_active_item_unique
  on public.stock_reservations(stock_item_id)
  where status='reserved';

create index if not exists stock_reservations_plan_status_idx
  on public.stock_reservations(product_plan_id,status,expires_at);

create table if not exists public.stock_events (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid references public.stock_items(id) on delete set null,
  batch_id uuid references public.stock_batches(id) on delete set null,
  reservation_id uuid references public.stock_reservations(id) on delete set null,
  product_plan_id uuid references public.product_plans(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in (
      'batch_imported',
      'item_disabled',
      'item_enabled',
      'reserved',
      'reservation_released',
      'reservation_expired',
      'consumed'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.stock_events enable row level security;

drop policy if exists "Admins read stock events" on public.stock_events;
create policy "Admins read stock events"
on public.stock_events for select to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.stock_events from anon, authenticated;
grant select on public.stock_events to authenticated;

create index if not exists stock_events_plan_created_idx
  on public.stock_events(product_plan_id,created_at desc);
create index if not exists stock_events_stock_created_idx
  on public.stock_events(stock_item_id,created_at desc)
  where stock_item_id is not null;

create or replace function public.get_stock_manager_catalog()
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return jsonb_build_object(
    'plans',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id',p.id,
        'product_name',p.name,
        'product_active',p.active,
        'game_name',g.name,
        'plan_id',pp.id,
        'plan_name',pp.name,
        'plan_code',pp.plan_code,
        'plan_active',pp.active,
        'price',pp.price,
        'show_when_out_of_stock',pp.show_when_out_of_stock,
        'delivery_mode',coalesce(ppo.delivery_mode,'manual'),
        'supplier_provider',ppo.supplier_provider,
        'local_stock',(
          select count(*)::int
          from public.stock_items si
          where si.product_plan_id=pp.id
        ),
        'available_stock',(
          select count(*)::int
          from public.stock_items si
          where si.product_plan_id=pp.id
            and si.used=false
            and si.disabled=false
            and not exists(
              select 1
              from public.stock_reservations sr
              where sr.stock_item_id=si.id
                and sr.status='reserved'
                and sr.expires_at>now()
            )
        ),
        'reserved_stock',(
          select count(*)::int
          from public.stock_reservations sr
          where sr.product_plan_id=pp.id
            and sr.status='reserved'
            and sr.expires_at>now()
        ),
        'used_stock',(
          select count(*)::int
          from public.stock_items si
          where si.product_plan_id=pp.id and si.used=true
        ),
        'disabled_stock',(
          select count(*)::int
          from public.stock_items si
          where si.product_plan_id=pp.id and si.disabled=true and si.used=false
        )
      ) order by g.sort_order,p.sort_order,p.name,pp.sort_order,pp.name)
      from public.product_plans pp
      join public.products p on p.id=pp.product_id
      join public.games g on g.id=p.game_id
      left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
    ),'[]'::jsonb),
    'recent_batches',coalesce((
      select jsonb_agg(x.payload order by x.created_at desc)
      from (
        select
          sb.created_at,
          jsonb_build_object(
            'id',sb.id,
            'product_plan_id',sb.product_plan_id,
            'source',sb.source,
            'note',sb.note,
            'submitted_count',sb.submitted_count,
            'accepted_count',sb.accepted_count,
            'duplicate_count',sb.duplicate_count,
            'created_at',sb.created_at
          ) as payload
        from public.stock_batches sb
        order by sb.created_at desc
        limit 30
      ) x
    ),'[]'::jsonb),
    'recent_events',coalesce((
      select jsonb_agg(x.payload order by x.created_at desc)
      from (
        select
          se.created_at,
          jsonb_build_object(
            'id',se.id,
            'stock_item_id',se.stock_item_id,
            'batch_id',se.batch_id,
            'reservation_id',se.reservation_id,
            'product_plan_id',se.product_plan_id,
            'event_type',se.event_type,
            'metadata',se.metadata,
            'created_at',se.created_at
          ) as payload
        from public.stock_events se
        order by se.created_at desc
        limit 50
      ) x
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_stock_manager_items(
  p_product_plan_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := greatest(1,least(coalesce(p_limit,100),250));
  v_offset integer := greatest(0,coalesce(p_offset,0));
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return jsonb_build_object(
    'total',(
      select count(*)::int
      from public.stock_items si
      where si.product_plan_id=p_product_plan_id
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',si.id,
        'masked_content',case
          when char_length(si.content)<=8 then repeat('•',greatest(4,char_length(si.content)))
          else left(si.content,4)||repeat('•',least(24,greatest(4,char_length(si.content)-8)))||right(si.content,4)
        end,
        'used',si.used,
        'used_at',si.used_at,
        'disabled',si.disabled,
        'disabled_at',si.disabled_at,
        'disabled_reason',si.disabled_reason,
        'source',si.source,
        'batch_id',si.batch_id,
        'created_at',si.created_at,
        'reservation',(
          select jsonb_build_object(
            'id',sr.id,
            'status',sr.status,
            'expires_at',sr.expires_at,
            'created_at',sr.created_at
          )
          from public.stock_reservations sr
          where sr.stock_item_id=si.id
          order by sr.created_at desc
          limit 1
        )
      ) order by si.created_at desc)
      from (
        select *
        from public.stock_items si2
        where si2.product_plan_id=p_product_plan_id
        order by si2.created_at desc
        limit v_limit offset v_offset
      ) si
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.import_stock_batch(
  p_product_plan_id uuid,
  p_items text[],
  p_source text default 'manual',
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,extensions,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid;
  v_item text;
  v_normalized text;
  v_hash text;
  v_submitted integer := 0;
  v_accepted integer := 0;
  v_duplicates integer := 0;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if not exists(select 1 from public.product_plans pp where pp.id=p_product_plan_id) then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  if p_items is null or cardinality(p_items)=0 or cardinality(p_items)>5000 then
    raise exception 'INVALID_BATCH_SIZE';
  end if;

  insert into public.stock_batches(
    product_plan_id,imported_by,source,note
  )
  values(
    p_product_plan_id,
    v_user,
    coalesce(nullif(btrim(p_source),''),'manual'),
    nullif(btrim(coalesce(p_note,'')),'')
  )
  returning id into v_batch;

  foreach v_item in array p_items loop
    v_normalized := btrim(coalesce(v_item,''));
    if v_normalized='' then
      continue;
    end if;

    if char_length(v_normalized)>4000 then
      raise exception 'STOCK_ITEM_TOO_LONG';
    end if;

    v_submitted := v_submitted + 1;
    v_hash := encode(digest(v_normalized,'sha256'),'hex');

    insert into public.stock_items(
      product_plan_id,content,content_hash,batch_id,source,used,disabled
    )
    values(
      p_product_plan_id,v_normalized,v_hash,v_batch,
      coalesce(nullif(btrim(p_source),''),'manual'),false,false
    )
    on conflict do nothing;

    if found then
      v_accepted := v_accepted + 1;
    else
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  update public.stock_batches
  set submitted_count=v_submitted,
      accepted_count=v_accepted,
      duplicate_count=v_duplicates
  where id=v_batch;

  insert into public.stock_events(
    batch_id,product_plan_id,actor_user_id,event_type,metadata
  )
  values(
    v_batch,p_product_plan_id,v_user,'batch_imported',
    jsonb_build_object(
      'submitted_count',v_submitted,
      'accepted_count',v_accepted,
      'duplicate_count',v_duplicates,
      'source',coalesce(nullif(btrim(p_source),''),'manual')
    )
  );

  return jsonb_build_object(
    'batch_id',v_batch,
    'submitted_count',v_submitted,
    'accepted_count',v_accepted,
    'duplicate_count',v_duplicates
  );
end;
$$;

create or replace function public.set_stock_item_disabled(
  p_stock_item_id uuid,
  p_disabled boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_plan uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select si.product_plan_id into v_plan
  from public.stock_items si
  where si.id=p_stock_item_id and si.used=false
  for update;

  if v_plan is null then
    raise exception 'STOCK_ITEM_NOT_AVAILABLE';
  end if;

  if exists(
    select 1
    from public.stock_reservations sr
    where sr.stock_item_id=p_stock_item_id
      and sr.status='reserved'
      and sr.expires_at>now()
  ) then
    raise exception 'STOCK_ITEM_RESERVED';
  end if;

  update public.stock_items
  set disabled=coalesce(p_disabled,false),
      disabled_at=case when coalesce(p_disabled,false) then now() else null end,
      disabled_reason=case
        when coalesce(p_disabled,false) then nullif(btrim(coalesce(p_reason,'')),'')
        else null
      end
  where id=p_stock_item_id;

  insert into public.stock_events(
    stock_item_id,product_plan_id,actor_user_id,event_type,metadata
  )
  values(
    p_stock_item_id,v_plan,v_user,
    case when coalesce(p_disabled,false) then 'item_disabled' else 'item_enabled' end,
    jsonb_build_object(
      'reason',case
        when coalesce(p_disabled,false) then nullif(btrim(coalesce(p_reason,'')),'')
        else null
      end
    )
  );

  return true;
end;
$$;

create or replace function public.reserve_stock_for_fulfillment(
  p_product_plan_id uuid,
  p_reservation_key text,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_existing public.stock_reservations;
  v_stock uuid;
  v_reservation public.stock_reservations;
  v_ttl integer := greatest(1,least(coalesce(p_ttl_minutes,15),1440));
begin
  if p_reservation_key is null
     or char_length(btrim(p_reservation_key))<8
     or char_length(btrim(p_reservation_key))>200 then
    raise exception 'INVALID_RESERVATION_KEY';
  end if;

  select *
  into v_existing
  from public.stock_reservations
  where reservation_key=btrim(p_reservation_key)
  for update;

  if v_existing.id is not null then
    if v_existing.product_plan_id<>p_product_plan_id then
      raise exception 'RESERVATION_KEY_CONFLICT';
    end if;

    if v_existing.status in ('reserved','consumed') then
      return jsonb_build_object(
        'reservation_id',v_existing.id,
        'stock_item_id',v_existing.stock_item_id,
        'status',v_existing.status,
        'expires_at',v_existing.expires_at,
        'created',false
      );
    end if;

    raise exception 'RESERVATION_NOT_REUSABLE';
  end if;

  update public.stock_reservations
  set status='expired',updated_at=now()
  where product_plan_id=p_product_plan_id
    and status='reserved'
    and expires_at<=now();

  insert into public.stock_events(
    reservation_id,stock_item_id,product_plan_id,event_type,metadata
  )
  select
    sr.id,sr.stock_item_id,sr.product_plan_id,'reservation_expired',
    jsonb_build_object('expires_at',sr.expires_at)
  from public.stock_reservations sr
  where sr.product_plan_id=p_product_plan_id
    and sr.status='expired'
    and sr.updated_at >= now() - interval '2 seconds'
    and not exists(
      select 1 from public.stock_events se
      where se.reservation_id=sr.id and se.event_type='reservation_expired'
    );

  select si.id
  into v_stock
  from public.stock_items si
  where si.product_plan_id=p_product_plan_id
    and si.used=false
    and si.disabled=false
    and not exists(
      select 1
      from public.stock_reservations sr
      where sr.stock_item_id=si.id
        and sr.status='reserved'
        and sr.expires_at>now()
    )
  order by si.created_at asc
  for update skip locked
  limit 1;

  if v_stock is null then
    raise exception 'OUT_OF_STOCK';
  end if;

  insert into public.stock_reservations(
    stock_item_id,product_plan_id,reservation_key,status,expires_at
  )
  values(
    v_stock,p_product_plan_id,btrim(p_reservation_key),'reserved',
    now()+(v_ttl||' minutes')::interval
  )
  returning * into v_reservation;

  insert into public.stock_events(
    stock_item_id,reservation_id,product_plan_id,event_type,metadata
  )
  values(
    v_stock,v_reservation.id,p_product_plan_id,'reserved',
    jsonb_build_object('expires_at',v_reservation.expires_at)
  );

  return jsonb_build_object(
    'reservation_id',v_reservation.id,
    'stock_item_id',v_stock,
    'status','reserved',
    'expires_at',v_reservation.expires_at,
    'created',true
  );
end;
$$;

create or replace function public.consume_stock_reservation(
  p_reservation_id uuid,
  p_reservation_key text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reservation public.stock_reservations;
  v_item public.stock_items;
begin
  select *
  into v_reservation
  from public.stock_reservations
  where id=p_reservation_id
    and reservation_key=btrim(coalesce(p_reservation_key,''))
  for update;

  if v_reservation.id is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  select *
  into v_item
  from public.stock_items
  where id=v_reservation.stock_item_id
  for update;

  if v_reservation.status='consumed' then
    return jsonb_build_object(
      'reservation_id',v_reservation.id,
      'stock_item_id',v_item.id,
      'content',v_item.content,
      'consumed',false
    );
  end if;

  if v_reservation.status<>'reserved' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;

  if v_reservation.expires_at<=now() then
    update public.stock_reservations
    set status='expired',updated_at=now()
    where id=v_reservation.id;
    raise exception 'RESERVATION_EXPIRED';
  end if;

  if v_item.id is null or v_item.used or v_item.disabled then
    raise exception 'STOCK_ITEM_NOT_AVAILABLE';
  end if;

  update public.stock_items
  set used=true,used_at=now()
  where id=v_item.id;

  update public.stock_reservations
  set status='consumed',consumed_at=now(),updated_at=now()
  where id=v_reservation.id;

  insert into public.stock_events(
    stock_item_id,reservation_id,product_plan_id,event_type,metadata
  )
  values(
    v_item.id,v_reservation.id,v_reservation.product_plan_id,'consumed','{}'::jsonb
  );

  return jsonb_build_object(
    'reservation_id',v_reservation.id,
    'stock_item_id',v_item.id,
    'content',v_item.content,
    'consumed',true
  );
end;
$$;

create or replace function public.release_stock_reservation(
  p_reservation_id uuid,
  p_reservation_key text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reservation public.stock_reservations;
begin
  select *
  into v_reservation
  from public.stock_reservations
  where id=p_reservation_id
    and reservation_key=btrim(coalesce(p_reservation_key,''))
  for update;

  if v_reservation.id is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status='released' then
    return true;
  end if;

  if v_reservation.status<>'reserved' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;

  update public.stock_reservations
  set status='released',released_at=now(),updated_at=now()
  where id=v_reservation.id;

  insert into public.stock_events(
    stock_item_id,reservation_id,product_plan_id,event_type,metadata
  )
  values(
    v_reservation.stock_item_id,v_reservation.id,v_reservation.product_plan_id,
    'reservation_released','{}'::jsonb
  );

  return true;
end;
$$;

-- Existing paid-delivery path stays idempotent, but now respects disabled/reserved stock.
create or replace function public.claim_paid_delivery(
  p_payment_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_product_plan_id uuid,
  p_item_index integer,
  p_unit_index integer
)
returns table(ticket_id uuid,stock_item_id uuid,created boolean)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_ticket_id uuid;
  v_stock_id uuid;
  v_created boolean := false;
begin
  if p_payment_id is null or p_user_id is null or p_product_id is null or p_product_plan_id is null then
    raise exception 'paid delivery requires payment, user, product and plan ids';
  end if;
  if p_item_index < 0 or p_unit_index < 0 then
    raise exception 'invalid paid delivery coordinates';
  end if;

  select ot.id,ot.stock_item_id
    into v_ticket_id,v_stock_id
  from public.order_tickets ot
  where ot.payment_id=p_payment_id
    and ot.payment_item_index=p_item_index
    and ot.payment_unit_index=p_unit_index
  limit 1;

  if v_ticket_id is not null then
    return query select v_ticket_id,v_stock_id,false;
    return;
  end if;

  begin
    select si.id
      into v_stock_id
    from public.stock_items si
    where si.product_plan_id=p_product_plan_id
      and si.used=false
      and si.disabled=false
      and not exists(
        select 1
        from public.stock_reservations sr
        where sr.stock_item_id=si.id
          and sr.status='reserved'
          and sr.expires_at>now()
      )
    order by si.created_at asc
    for update skip locked
    limit 1;

    if v_stock_id is not null then
      update public.stock_items
      set used=true,used_at=now()
      where id=v_stock_id;

      insert into public.stock_events(
        stock_item_id,product_plan_id,event_type,metadata
      )
      values(
        v_stock_id,p_product_plan_id,'consumed',
        jsonb_build_object(
          'source','claim_paid_delivery',
          'payment_id',p_payment_id,
          'item_index',p_item_index,
          'unit_index',p_unit_index
        )
      );
    end if;

    insert into public.order_tickets(
      user_id,product_id,product_plan_id,stock_item_id,status,status_label,
      metadata,payment_id,payment_item_index,payment_unit_index
    )
    values(
      p_user_id,p_product_id,p_product_plan_id,v_stock_id,
      case when v_stock_id is null then 'open'::public.ticket_status else 'delivered'::public.ticket_status end,
      case when v_stock_id is null then 'Aberto' else 'Entregue' end,
      jsonb_build_object('payment_id',p_payment_id),
      p_payment_id,p_item_index,p_unit_index
    )
    returning id into v_ticket_id;

    v_created := true;
  exception when unique_violation then
    v_ticket_id := null;
    v_stock_id := null;

    select ot.id,ot.stock_item_id
      into v_ticket_id,v_stock_id
    from public.order_tickets ot
    where ot.payment_id=p_payment_id
      and ot.payment_item_index=p_item_index
      and ot.payment_unit_index=p_unit_index
    limit 1;

    if v_ticket_id is null then
      raise;
    end if;
  end;

  return query select v_ticket_id,v_stock_id,v_created;
end;
$$;

revoke execute on function public.get_stock_manager_catalog() from public,anon;
revoke execute on function public.get_stock_manager_items(uuid,integer,integer) from public,anon;
revoke execute on function public.import_stock_batch(uuid,text[],text,text) from public,anon;
revoke execute on function public.set_stock_item_disabled(uuid,boolean,text) from public,anon;

grant execute on function public.get_stock_manager_catalog() to authenticated;
grant execute on function public.get_stock_manager_items(uuid,integer,integer) to authenticated;
grant execute on function public.import_stock_batch(uuid,text[],text,text) to authenticated;
grant execute on function public.set_stock_item_disabled(uuid,boolean,text) to authenticated;

revoke execute on function public.reserve_stock_for_fulfillment(uuid,text,integer) from public,anon,authenticated;
revoke execute on function public.consume_stock_reservation(uuid,text) from public,anon,authenticated;
revoke execute on function public.release_stock_reservation(uuid,text) from public,anon,authenticated;

grant execute on function public.reserve_stock_for_fulfillment(uuid,text,integer) to service_role;
grant execute on function public.consume_stock_reservation(uuid,text) to service_role;
grant execute on function public.release_stock_reservation(uuid,text) to service_role;
