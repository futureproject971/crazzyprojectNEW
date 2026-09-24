-- WORLD GAMES / KEY CONTROL
-- Upgrade seguro: perfil de preço BRL/EUR + VGC Emulator 2 + geração paga
-- Não apaga usuários, keys, gerações ou planos existentes.

alter table public.kp_users
  add column if not exists pricing_profile text not null default 'BRL';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kp_users_pricing_profile_check'
      and conrelid = 'public.kp_users'::regclass
  ) then
    alter table public.kp_users
      add constraint kp_users_pricing_profile_check
      check (pricing_profile in ('BRL','EUR'));
  end if;
end $$;

alter table public.kp_plans
  add column if not exists product_id text,
  add column if not exists duration_days integer,
  add column if not exists price_brl_cents integer,
  add column if not exists price_eur_cents integer,
  add column if not exists requires_payment boolean not null default false;

update public.kp_plans
set product_id = 'vgc-emulator'
where product_id is null or btrim(product_id) = '';

alter table public.kp_plans
  alter column product_id set default 'vgc-emulator',
  alter column product_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kp_plans_price_brl_check'
      and conrelid = 'public.kp_plans'::regclass
  ) then
    alter table public.kp_plans
      add constraint kp_plans_price_brl_check
      check (price_brl_cents is null or price_brl_cents > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'kp_plans_price_eur_check'
      and conrelid = 'public.kp_plans'::regclass
  ) then
    alter table public.kp_plans
      add constraint kp_plans_price_eur_check
      check (price_eur_cents is null or price_eur_cents > 0);
  end if;
end $$;

alter table public.kp_keys
  drop constraint if exists kp_keys_status_check;

alter table public.kp_keys
  add constraint kp_keys_status_check
  check (status in ('available','reserved','used','disabled'));

create table if not exists public.kp_paid_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.kp_users(id) on delete restrict,
  plan_id uuid not null references public.kp_plans(id) on delete restrict,
  product_id text not null,
  currency text not null check (currency in ('BRL','EUR')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending','paid','fulfilled','expired','failed','cancelled')),
  provider text null,
  provider_payment_id text null,
  checkout_url text null,
  idempotency_key text not null,
  reserved_key_id uuid null references public.kp_keys(id) on delete restrict,
  generation_id uuid null unique references public.kp_generations(id) on delete restrict,
  paid_at timestamptz null,
  fulfilled_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kp_paid_orders_user_idempotency_unique
  on public.kp_paid_orders(user_id, idempotency_key);

create unique index if not exists kp_paid_orders_provider_payment_unique
  on public.kp_paid_orders(provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists kp_paid_orders_reserved_key_unique
  on public.kp_paid_orders(reserved_key_id)
  where reserved_key_id is not null and status in ('pending','paid','fulfilled');

create index if not exists kp_paid_orders_user_created_idx
  on public.kp_paid_orders(user_id, created_at desc);

create index if not exists kp_paid_orders_status_expiry_idx
  on public.kp_paid_orders(status, expires_at);

alter table public.kp_paid_orders enable row level security;
revoke all on public.kp_paid_orders from anon, authenticated;

insert into public.kp_plans
  (name, slug, active, sort_order, product_id, duration_days, price_eur_cents, requires_payment)
values
  ('TRIAL',       'vgc2-trial',  true, 310, 'vgc-emulator-2',  3,  799, true),
  ('SEMANAL',     'vgc2-7d',     true, 320, 'vgc-emulator-2',  7, 1399, true),
  ('15 DIAS',     'vgc2-15d',    true, 330, 'vgc-emulator-2', 15, 1999, true),
  ('MENSAL',      'vgc2-30d',    true, 340, 'vgc-emulator-2', 30, 3199, true),
  ('TRIMESTRAL',  'vgc2-90d',    true, 350, 'vgc-emulator-2', 90, 5499, true)
on conflict (slug) do update set
  name = excluded.name,
  active = true,
  sort_order = excluded.sort_order,
  product_id = excluded.product_id,
  duration_days = excluded.duration_days,
  price_eur_cents = excluded.price_eur_cents,
  requires_payment = true;

create or replace function public.kp_expire_paid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.kp_paid_orders
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and expires_at <= now()
    returning reserved_key_id
  ),
  released as (
    update public.kp_keys k
    set status = 'available'
    from expired e
    where k.id = e.reserved_key_id
      and k.status = 'reserved'
    returning k.id
  )
  select count(*)::integer into v_count from expired;

  return v_count;
end;
$$;

create or replace function public.kp_create_paid_order(
  p_user_id uuid,
  p_plan_id uuid,
  p_idempotency_key text
)
returns table (
  order_id uuid,
  amount_cents integer,
  currency text,
  product_id text,
  plan_name text,
  expires_at timestamptz,
  provider_payment_id text,
  checkout_url text,
  order_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.kp_users%rowtype;
  v_plan public.kp_plans%rowtype;
  v_key public.kp_keys%rowtype;
  v_order public.kp_paid_orders%rowtype;
  v_amount integer;
  v_currency text;
begin
  if p_idempotency_key is null
    or length(p_idempotency_key) < 12
    or length(p_idempotency_key) > 120 then
    raise exception 'INVALID_IDEMPOTENCY';
  end if;

  perform public.kp_expire_paid_orders();

  select * into v_user
  from public.kp_users
  where id = p_user_id
  for update;

  if not found or v_user.status <> 'approved' then
    raise exception 'USER_BLOCKED';
  end if;

  select * into v_plan
  from public.kp_plans
  where id = p_plan_id
    and active = true
  for share;

  if not found then
    raise exception 'INVALID_PLAN';
  end if;

  if v_plan.requires_payment is not true then
    raise exception 'PLAN_IS_NOT_PAID';
  end if;

  if v_plan.product_id = 'vgc-emulator-2' and v_user.pricing_profile <> 'EUR' then
    raise exception 'PRICE_PROFILE_MISMATCH';
  end if;

  v_currency := case when v_user.pricing_profile = 'EUR' then 'EUR' else 'BRL' end;
  v_amount := case
    when v_currency = 'EUR' then v_plan.price_eur_cents
    else v_plan.price_brl_cents
  end;

  if v_amount is null or v_amount <= 0 then
    raise exception 'PRICE_NOT_CONFIGURED';
  end if;

  select * into v_order
  from public.kp_paid_orders
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return query select
      v_order.id,
      v_order.amount_cents,
      v_order.currency,
      v_order.product_id,
      v_plan.name,
      v_order.expires_at,
      v_order.provider_payment_id,
      v_order.checkout_url,
      v_order.status;
    return;
  end if;

  select * into v_key
  from public.kp_keys
  where plan_id = p_plan_id
    and status = 'available'
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then
    raise exception 'OUT_OF_STOCK';
  end if;

  insert into public.kp_paid_orders (
    user_id,
    plan_id,
    product_id,
    currency,
    amount_cents,
    idempotency_key,
    reserved_key_id,
    expires_at
  )
  values (
    p_user_id,
    p_plan_id,
    v_plan.product_id,
    v_currency,
    v_amount,
    p_idempotency_key,
    v_key.id,
    now() + interval '45 minutes'
  )
  returning * into v_order;

  update public.kp_keys
  set status = 'reserved'
  where id = v_key.id
    and status = 'available';

  if not found then
    raise exception 'OUT_OF_STOCK';
  end if;

  insert into public.kp_logs (user_id, action, description, metadata)
  values (
    p_user_id,
    'PAID_ORDER_CREATED',
    v_user.username || ' iniciou compra de ' || v_plan.name || ' (' || v_currency || ').',
    jsonb_build_object(
      'order_id', v_order.id,
      'plan_id', p_plan_id,
      'product_id', v_plan.product_id,
      'currency', v_currency,
      'amount_cents', v_amount
    )
  );

  return query select
    v_order.id,
    v_order.amount_cents,
    v_order.currency,
    v_order.product_id,
    v_plan.name,
    v_order.expires_at,
    v_order.provider_payment_id,
    v_order.checkout_url,
    v_order.status;
end;
$$;

create or replace function public.kp_release_paid_order(
  p_order_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.kp_paid_orders%rowtype;
begin
  select * into v_order
  from public.kp_paid_orders
  where id = p_order_id
    and user_id = p_user_id
  for update;

  if not found then return false; end if;
  if v_order.status not in ('pending','failed','cancelled','expired') then return false; end if;

  update public.kp_keys
  set status = 'available'
  where id = v_order.reserved_key_id
    and status = 'reserved';

  update public.kp_paid_orders
  set status = case when status = 'pending' then 'cancelled' else status end,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

create or replace function public.kp_fulfill_paid_order(
  p_order_id uuid,
  p_provider_payment_id text
)
returns table (
  key_value text,
  generation_id uuid,
  order_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.kp_paid_orders%rowtype;
  v_key public.kp_keys%rowtype;
  v_generation uuid;
  v_username text;
  v_plan_name text;
begin
  select * into v_order
  from public.kp_paid_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'fulfilled' then
    select g.key_value, g.id
      into v_key.key_value, v_generation
    from public.kp_generations g
    where g.id = v_order.generation_id;

    return query select v_key.key_value, v_generation, 'fulfilled'::text;
    return;
  end if;

  if v_order.status not in ('pending','paid') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  if v_order.expires_at <= now() and v_order.status = 'pending' then
    raise exception 'ORDER_EXPIRED';
  end if;

  select * into v_key
  from public.kp_keys
  where id = v_order.reserved_key_id
  for update;

  if not found or v_key.status <> 'reserved' then
    raise exception 'RESERVED_KEY_MISSING';
  end if;

  update public.kp_paid_orders
  set status = 'paid',
      provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = p_order_id;

  update public.kp_keys
  set status = 'used',
      used_by = v_order.user_id,
      used_at = now()
  where id = v_key.id
    and status = 'reserved';

  if not found then
    raise exception 'RESERVED_KEY_MISSING';
  end if;

  insert into public.kp_generations (user_id, plan_id, key_id, key_value)
  values (v_order.user_id, v_order.plan_id, v_key.id, v_key.key_value)
  returning id into v_generation;

  update public.kp_paid_orders
  set status = 'fulfilled',
      generation_id = v_generation,
      fulfilled_at = now(),
      updated_at = now()
  where id = p_order_id;

  select username into v_username from public.kp_users where id = v_order.user_id;
  select name into v_plan_name from public.kp_plans where id = v_order.plan_id;

  insert into public.kp_logs (user_id, action, description, metadata)
  values (
    v_order.user_id,
    'PAID_KEY_FULFILLED',
    coalesce(v_username, 'user') || ' recebeu 1 key paga de ' || coalesce(v_plan_name, 'plano') || '.',
    jsonb_build_object(
      'order_id', v_order.id,
      'plan_id', v_order.plan_id,
      'product_id', v_order.product_id,
      'key_id', v_key.id,
      'generation_id', v_generation,
      'currency', v_order.currency,
      'amount_cents', v_order.amount_cents,
      'provider_payment_id', p_provider_payment_id
    )
  );

  return query select v_key.key_value, v_generation, 'fulfilled'::text;
end;
$$;

revoke all on function public.kp_expire_paid_orders() from public, anon, authenticated;
revoke all on function public.kp_create_paid_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.kp_release_paid_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.kp_fulfill_paid_order(uuid, text) from public, anon, authenticated;

grant execute on function public.kp_expire_paid_orders() to service_role;
grant execute on function public.kp_create_paid_order(uuid, uuid, text) to service_role;
grant execute on function public.kp_release_paid_order(uuid, uuid) to service_role;
grant execute on function public.kp_fulfill_paid_order(uuid, text) to service_role;