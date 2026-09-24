create schema if not exists private;

create table if not exists public.bonus_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  lifetime_earned_cents bigint not null default 0 check (lifetime_earned_cents >= 0),
  lifetime_spent_cents bigint not null default 0 check (lifetime_spent_cents >= 0),
  lifetime_expired_cents bigint not null default 0 check (lifetime_expired_cents >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.bonus_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_cents bigint not null check (original_cents > 0),
  remaining_cents bigint not null check (remaining_cents >= 0),
  source_type text not null,
  source_ref text,
  description text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists bonus_lots_source_unique
  on public.bonus_lots(user_id, source_type, source_ref)
  where source_ref is not null;

create table if not exists public.bonus_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('credit','debit')),
  amount_cents bigint not null check (amount_cents > 0),
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  source_type text not null,
  source_ref text,
  description text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists bonus_transactions_source_unique
  on public.bonus_transactions(user_id, direction, source_type, source_ref)
  where source_ref is not null;

create table if not exists public.bonus_plan_rules (
  plan_id uuid primary key references public.product_plans(id) on delete cascade,
  grant_bonus_cents integer not null default 0 check (grant_bonus_cents >= 0),
  expires_days integer check (expires_days is null or (expires_days >= 1 and expires_days <= 3650)),
  accepts_bonus boolean not null default false,
  max_bonus_percent numeric not null default 30 check (max_bonus_percent >= 0 and max_bonus_percent <= 90),
  max_bonus_cents integer not null default 0 check (max_bonus_cents >= 0),
  monthly_limit_cents integer not null default 0 check (monthly_limit_cents >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.bonus_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.product_plans(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);

alter table public.luck_campaigns
  add column if not exists bonus_cost_cents integer not null default 0 check (bonus_cost_cents >= 0);

alter table public.luck_plays
  add column if not exists bonus_transaction_id uuid references public.bonus_transactions(id) on delete set null;

update public.luck_campaigns
set free_plays_per_day=0,
    play_price_cents=0
where free_plays_per_day<>0 or play_price_cents<>0;

alter table public.bonus_wallets enable row level security;
alter table public.bonus_lots enable row level security;
alter table public.bonus_transactions enable row level security;
alter table public.bonus_plan_rules enable row level security;
alter table public.bonus_redemptions enable row level security;

drop policy if exists bonus_wallet_owner_select on public.bonus_wallets;
create policy bonus_wallet_owner_select on public.bonus_wallets for select to authenticated
using (user_id=auth.uid() or public.is_current_admin());

drop policy if exists bonus_lots_owner_select on public.bonus_lots;
create policy bonus_lots_owner_select on public.bonus_lots for select to authenticated
using (user_id=auth.uid() or public.is_current_admin());

drop policy if exists bonus_transactions_owner_select on public.bonus_transactions;
create policy bonus_transactions_owner_select on public.bonus_transactions for select to authenticated
using (user_id=auth.uid() or public.is_current_admin());

drop policy if exists bonus_plan_rules_read on public.bonus_plan_rules;
create policy bonus_plan_rules_read on public.bonus_plan_rules for select to authenticated using (true);
drop policy if exists bonus_plan_rules_admin_insert on public.bonus_plan_rules;
create policy bonus_plan_rules_admin_insert on public.bonus_plan_rules for insert to authenticated with check (public.is_current_admin());
drop policy if exists bonus_plan_rules_admin_update on public.bonus_plan_rules;
create policy bonus_plan_rules_admin_update on public.bonus_plan_rules for update to authenticated
using (public.is_current_admin()) with check (public.is_current_admin());

drop policy if exists bonus_redemptions_owner_select on public.bonus_redemptions;
create policy bonus_redemptions_owner_select on public.bonus_redemptions for select to authenticated
using (user_id=auth.uid() or public.is_current_admin());

create or replace function private.bonus_expire(p_user uuid)
returns bigint
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_expired bigint:=0;
  v_balance bigint:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('bonus:'||p_user::text,919));
  insert into public.bonus_wallets(user_id) values(p_user) on conflict(user_id) do nothing;

  select coalesce(sum(remaining_cents),0) into v_expired
  from public.bonus_lots
  where user_id=p_user and remaining_cents>0 and expires_at is not null and expires_at<=now();

  if v_expired>0 then
    update public.bonus_lots
    set remaining_cents=0
    where user_id=p_user and remaining_cents>0 and expires_at is not null and expires_at<=now();

    update public.bonus_wallets
    set balance_cents=greatest(0,balance_cents-v_expired),
        lifetime_expired_cents=lifetime_expired_cents+v_expired,
        updated_at=now()
    where user_id=p_user
    returning balance_cents into v_balance;

    insert into public.bonus_transactions(user_id,direction,amount_cents,balance_after_cents,source_type,description)
    values(p_user,'debit',v_expired,v_balance,'expire','CRAZZY BONUS expirado');
  end if;
  return v_expired;
end
$$;

create or replace function private.bonus_credit(
  p_user uuid,
  p_amount_cents bigint,
  p_source_type text,
  p_source_ref text,
  p_description text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_balance bigint;
  v_tx uuid;
begin
  if p_amount_cents<=0 then raise exception 'BONUS_AMOUNT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bonus:'||p_user::text,919));
  perform private.bonus_expire(p_user);

  if p_source_ref is not null then
    select id into v_tx from public.bonus_transactions
    where user_id=p_user and direction='credit' and source_type=p_source_type and source_ref=p_source_ref;
    if found then return v_tx; end if;
  end if;

  insert into public.bonus_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  update public.bonus_wallets
  set balance_cents=balance_cents+p_amount_cents,
      lifetime_earned_cents=lifetime_earned_cents+p_amount_cents,
      updated_at=now()
  where user_id=p_user
  returning balance_cents into v_balance;

  insert into public.bonus_lots(user_id,original_cents,remaining_cents,source_type,source_ref,description,expires_at)
  values(p_user,p_amount_cents,p_amount_cents,p_source_type,p_source_ref,coalesce(p_description,''),p_expires_at);

  insert into public.bonus_transactions(user_id,direction,amount_cents,balance_after_cents,source_type,source_ref,description)
  values(p_user,'credit',p_amount_cents,v_balance,p_source_type,p_source_ref,coalesce(p_description,''))
  returning id into v_tx;
  return v_tx;
end
$$;

create or replace function private.bonus_debit(
  p_user uuid,
  p_amount_cents bigint,
  p_source_type text,
  p_source_ref text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_balance bigint;
  v_left bigint:=p_amount_cents;
  v_take bigint;
  v_lot record;
  v_tx uuid;
begin
  if p_amount_cents<=0 then raise exception 'BONUS_AMOUNT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bonus:'||p_user::text,919));
  perform private.bonus_expire(p_user);

  if p_source_ref is not null then
    select id into v_tx from public.bonus_transactions
    where user_id=p_user and direction='debit' and source_type=p_source_type and source_ref=p_source_ref;
    if found then return v_tx; end if;
  end if;

  insert into public.bonus_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  select balance_cents into v_balance from public.bonus_wallets where user_id=p_user for update;
  if coalesce(v_balance,0)<p_amount_cents then raise exception 'BONUS_BALANCE_LOW'; end if;

  for v_lot in
    select id,remaining_cents from public.bonus_lots
    where user_id=p_user and remaining_cents>0 and (expires_at is null or expires_at>now())
    order by expires_at nulls last,created_at,id
    for update
  loop
    exit when v_left<=0;
    v_take:=least(v_left,v_lot.remaining_cents);
    update public.bonus_lots set remaining_cents=remaining_cents-v_take where id=v_lot.id;
    v_left:=v_left-v_take;
  end loop;
  if v_left<>0 then raise exception 'BONUS_LEDGER_MISMATCH'; end if;

  update public.bonus_wallets
  set balance_cents=balance_cents-p_amount_cents,
      lifetime_spent_cents=lifetime_spent_cents+p_amount_cents,
      updated_at=now()
  where user_id=p_user
  returning balance_cents into v_balance;

  insert into public.bonus_transactions(user_id,direction,amount_cents,balance_after_cents,source_type,source_ref,description)
  values(p_user,'debit',p_amount_cents,v_balance,p_source_type,p_source_ref,coalesce(p_description,''))
  returning id into v_tx;
  return v_tx;
end
$$;

revoke all on function private.bonus_expire(uuid) from public,anon,authenticated;
revoke all on function private.bonus_credit(uuid,bigint,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function private.bonus_debit(uuid,bigint,text,text,text) from public,anon,authenticated;

create or replace function public.get_my_bonus_wallet()
returns jsonb
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_wallet public.bonus_wallets;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  perform private.bonus_expire(v_user);
  insert into public.bonus_wallets(user_id) values(v_user) on conflict(user_id) do nothing;
  select * into v_wallet from public.bonus_wallets where user_id=v_user;
  return jsonb_build_object(
    'balance_cents',v_wallet.balance_cents,
    'lifetime_earned_cents',v_wallet.lifetime_earned_cents,
    'lifetime_spent_cents',v_wallet.lifetime_spent_cents,
    'lifetime_expired_cents',v_wallet.lifetime_expired_cents,
    'transactions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'direction',x.direction,'amount_cents',x.amount_cents,
        'balance_after_cents',x.balance_after_cents,'source_type',x.source_type,
        'description',x.description,'created_at',x.created_at
      ) order by x.created_at desc)
      from (select * from public.bonus_transactions where user_id=v_user order by created_at desc limit 60) x
    ),'[]'::jsonb)
  );
end
$$;

create or replace function public.get_bonus_catalog()
returns jsonb
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_month_start timestamptz:=date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  perform private.bonus_expire(v_user);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'plan_id',pp.id,'plan_name',pp.name,'plan_code',pp.plan_code,
      'product_id',p.id,'product_name',p.name,'product_slug',p.slug,
      'price_cents',round(pp.price*100),
      'grant_bonus_cents',r.grant_bonus_cents,'expires_days',r.expires_days,
      'accepts_bonus',r.accepts_bonus,'max_bonus_percent',r.max_bonus_percent,
      'max_bonus_cents',r.max_bonus_cents,'monthly_limit_cents',r.monthly_limit_cents,
      'monthly_used_cents',coalesce((select sum(br.amount_cents) from public.bonus_redemptions br where br.user_id=v_user and br.plan_id=pp.id and br.created_at>=v_month_start),0)
    ) order by p.name,pp.sort_order,pp.name)
    from public.bonus_plan_rules r
    join public.product_plans pp on pp.id=r.plan_id and pp.active=true
    join public.products p on p.id=pp.product_id and p.active=true
    where r.active=true and (r.accepts_bonus=true or r.grant_bonus_cents>0)
  ),'[]'::jsonb);
end
$$;

create or replace function public.redeem_bonus(
  p_plan_id uuid,
  p_amount_cents integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_rule public.bonus_plan_rules;
  v_plan public.product_plans;
  v_product public.products;
  v_existing record;
  v_plan_cents integer;
  v_cap integer;
  v_month_used integer;
  v_redemption_id uuid:=gen_random_uuid();
  v_coupon_id uuid:=gen_random_uuid();
  v_coupon_code text;
  v_tx uuid;
  v_balance bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount_cents is null or p_amount_cents<=0 then raise exception 'BONUS_AMOUNT_INVALID'; end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key))<8 or char_length(p_idempotency_key)>120 then raise exception 'INVALID_IDEMPOTENCY'; end if;

  select br.id,br.amount_cents,br.coupon_id,c.code into v_existing
  from public.bonus_redemptions br join public.coupons c on c.id=br.coupon_id
  where br.user_id=v_user and br.idempotency_key=p_idempotency_key;
  if found then
    select balance_cents into v_balance from public.bonus_wallets where user_id=v_user;
    return jsonb_build_object('redemption_id',v_existing.id,'amount_cents',v_existing.amount_cents,'coupon_id',v_existing.coupon_id,'coupon_code',v_existing.code,'balance_cents',coalesce(v_balance,0),'replayed',true);
  end if;

  select * into v_rule from public.bonus_plan_rules where plan_id=p_plan_id and active=true and accepts_bonus=true;
  if not found then raise exception 'BONUS_PLAN_NOT_ELIGIBLE'; end if;
  select * into v_plan from public.product_plans where id=p_plan_id and active=true;
  if not found then raise exception 'BONUS_PLAN_NOT_ELIGIBLE'; end if;
  select * into v_product from public.products where id=v_plan.product_id and active=true;
  if not found then raise exception 'BONUS_PLAN_NOT_ELIGIBLE'; end if;

  v_plan_cents:=round(v_plan.price*100);
  v_cap:=floor(v_plan_cents*(v_rule.max_bonus_percent/100.0));
  if v_rule.max_bonus_cents>0 then v_cap:=least(v_cap,v_rule.max_bonus_cents); end if;
  v_cap:=least(v_cap,greatest(0,v_plan_cents-80));
  if p_amount_cents>v_cap then raise exception 'BONUS_REDEEM_LIMIT'; end if;

  select coalesce(sum(amount_cents),0)::integer into v_month_used
  from public.bonus_redemptions
  where user_id=v_user and plan_id=p_plan_id
    and created_at>=date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if v_rule.monthly_limit_cents>0 and v_month_used+p_amount_cents>v_rule.monthly_limit_cents then
    raise exception 'BONUS_MONTHLY_LIMIT';
  end if;

  v_tx:=private.bonus_debit(v_user,p_amount_cents,'redeem','redeem:'||v_redemption_id::text,'Resgate CRAZZY BONUS para '||v_product.name||' / '||v_plan.name);
  v_coupon_code:='BONUS'||upper(substr(replace(v_coupon_id::text,'-',''),1,18));

  insert into public.coupons(id,code,discount_type,discount_value,max_uses,current_uses,min_order_value,active,expires_at,origin,source_reference,metadata)
  values(v_coupon_id,v_coupon_code,'fixed',p_amount_cents/100.0,1,0,0.01,true,now()+interval '24 hours','bonus',v_redemption_id::text,
    jsonb_build_object('allowed_plan_id',p_plan_id,'bonus_transaction_id',v_tx,'non_cash',true));

  insert into public.coupon_users(coupon_id,user_id) values(v_coupon_id,v_user);
  insert into public.coupon_products(coupon_id,product_id) values(v_coupon_id,v_product.id);

  insert into public.bonus_redemptions(id,user_id,plan_id,amount_cents,coupon_id,idempotency_key)
  values(v_redemption_id,v_user,p_plan_id,p_amount_cents,v_coupon_id,p_idempotency_key);

  select balance_cents into v_balance from public.bonus_wallets where user_id=v_user;
  return jsonb_build_object('redemption_id',v_redemption_id,'amount_cents',p_amount_cents,'coupon_id',v_coupon_id,'coupon_code',v_coupon_code,'expires_at',now()+interval '24 hours','balance_cents',v_balance,'product_slug',v_product.slug);
end
$$;

create or replace function public.grant_purchase_bonus(
  p_user_id uuid,
  p_plan_id uuid,
  p_payment_id uuid,
  p_item_index integer,
  p_unit_index integer
)
returns integer
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_rule public.bonus_plan_rules;
  v_ref text;
  v_expiry timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
  select * into v_rule from public.bonus_plan_rules where plan_id=p_plan_id and active=true;
  if not found or v_rule.grant_bonus_cents<=0 then return 0; end if;
  v_ref:='payment:'||p_payment_id::text||':'||coalesce(p_item_index,0)::text||':'||coalesce(p_unit_index,0)::text;
  if exists(select 1 from public.bonus_transactions where user_id=p_user_id and direction='credit' and source_type='purchase' and source_ref=v_ref) then return 0; end if;
  v_expiry:=case when v_rule.expires_days is null then null else now()+make_interval(days=>v_rule.expires_days) end;
  perform private.bonus_credit(p_user_id,v_rule.grant_bonus_cents,'purchase',v_ref,'Bônus promocional de compra',v_expiry);
  return v_rule.grant_bonus_cents;
end
$$;

create or replace function public.admin_adjust_bonus(
  p_user_id uuid,
  p_amount_cents integer,
  p_description text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_tx uuid;
  v_balance bigint;
begin
  if not public.is_current_admin() then raise exception 'FORBIDDEN'; end if;
  if p_amount_cents=0 then raise exception 'BONUS_AMOUNT_INVALID'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key)<8 then raise exception 'INVALID_IDEMPOTENCY'; end if;
  if p_amount_cents>0 then
    v_tx:=private.bonus_credit(p_user_id,p_amount_cents,'admin',p_idempotency_key,coalesce(p_description,'Ajuste administrativo'),null);
  else
    v_tx:=private.bonus_debit(p_user_id,abs(p_amount_cents),'admin',p_idempotency_key,coalesce(p_description,'Ajuste administrativo'));
  end if;
  select balance_cents into v_balance from public.bonus_wallets where user_id=p_user_id;
  return jsonb_build_object('transaction_id',v_tx,'balance_cents',coalesce(v_balance,0));
end
$$;

grant execute on function public.get_my_bonus_wallet() to authenticated;
grant execute on function public.get_bonus_catalog() to authenticated;
grant execute on function public.redeem_bonus(uuid,integer,text) to authenticated;
grant execute on function public.admin_adjust_bonus(uuid,integer,text,text) to authenticated;
revoke execute on function public.grant_purchase_bonus(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.grant_purchase_bonus(uuid,uuid,uuid,integer,integer) to service_role;

drop function if exists public.play_luck(text,text,uuid);

create or replace function public.get_luck_catalog()
returns jsonb
language sql
security definer
set search_path='public','auth','extensions','pg_temp'
as $$
  with active_campaigns as (
    select c.*
    from public.luck_campaigns c
    where c.active=true and c.bonus_cost_cents>0
      and (c.starts_at is null or c.starts_at<=now())
      and (c.ends_at is null or c.ends_at>now())
  ),
  prize_totals as (
    select p.campaign_id,sum(p.weight)::numeric total_weight
    from public.luck_prizes p join active_campaigns c on c.id=p.campaign_id
    where p.active=true and (p.stock_limit is null or p.wins_count<p.stock_limit)
    group by p.campaign_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'slug',c.slug,'mode',c.mode,'title',c.title,'description',c.description,
    'bonus_cost_cents',c.bonus_cost_cents,'config',c.config,'sort_order',c.sort_order,
    'prizes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'label',p.label,'prize_type',p.prize_type,'sort_order',p.sort_order,
        'stock_remaining',case when p.stock_limit is null then null else greatest(0,p.stock_limit-p.wins_count) end,
        'chance_percent',round((p.weight::numeric*100)/nullif(t.total_weight,0),2)
      ) order by p.sort_order)
      from public.luck_prizes p join prize_totals t on t.campaign_id=p.campaign_id
      where p.campaign_id=c.id and p.active=true and (p.stock_limit is null or p.wins_count<p.stock_limit)
    ),'[]'::jsonb)
  ) order by c.sort_order),'[]'::jsonb)
  from active_campaigns c;
$$;

create or replace function public.play_luck(p_campaign_slug text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_campaign public.luck_campaigns;
  v_existing public.luck_plays;
  v_prize public.luck_prizes;
  v_play public.luck_plays;
  v_coupon public.coupons;
  v_total integer:=0;
  v_roll bigint:=0;
  v_random bigint:=0;
  v_bytes bytea;
  v_attempt integer:=0;
  v_coupon_code text;
  v_product_id uuid;
  v_plan_id uuid;
  v_duration_minutes integer;
  v_expires timestamptz;
  v_result jsonb:='{}'::jsonb;
  v_debit_tx uuid;
  v_credit_tx uuid;
  v_bonus_award integer;
  v_balance bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_campaign_slug is null or btrim(p_campaign_slug)='' then raise exception 'INVALID_CAMPAIGN'; end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key))<8 or char_length(p_idempotency_key)>120 then raise exception 'INVALID_IDEMPOTENCY'; end if;

  select * into v_campaign from public.luck_campaigns
  where slug=p_campaign_slug and active=true and bonus_cost_cents>0
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;

  select * into v_existing from public.luck_plays
  where user_id=v_user and campaign_id=v_campaign.id and idempotency_key=p_idempotency_key;
  if found then return v_existing.result; end if;

  perform pg_advisory_xact_lock(hashtextextended('luck:'||v_user::text||':'||v_campaign.id::text,818));
  v_debit_tx:=private.bonus_debit(v_user,v_campaign.bonus_cost_cents,'arcade','luck:'||v_campaign.id::text||':'||p_idempotency_key,'Jogada '||v_campaign.title);

  loop
    v_attempt:=v_attempt+1;
    if v_attempt>8 then raise exception 'PRIZE_UNAVAILABLE'; end if;
    select coalesce(sum(weight),0)::int into v_total from public.luck_prizes
    where campaign_id=v_campaign.id and active=true and (stock_limit is null or wins_count<stock_limit);
    if v_total<=0 then raise exception 'PRIZE_UNAVAILABLE'; end if;

    v_bytes:=extensions.gen_random_bytes(4);
    v_random:=get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)::bigint*65536+get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint;
    v_roll:=(v_random%v_total)+1;

    select p.* into v_prize from (
      select p.*,sum(p.weight) over(order by p.sort_order,p.id) cumulative_weight
      from public.luck_prizes p where p.campaign_id=v_campaign.id and p.active=true and (p.stock_limit is null or p.wins_count<p.stock_limit)
    ) p where p.cumulative_weight>=v_roll order by p.cumulative_weight limit 1;

    update public.luck_prizes set wins_count=wins_count+1,updated_at=now()
    where id=v_prize.id and (stock_limit is null or wins_count<stock_limit)
    returning * into v_prize;
    if found then exit; end if;
  end loop;

  insert into public.luck_plays(user_id,campaign_id,prize_id,idempotency_key,status,random_roll,total_weight,result,bonus_transaction_id)
  values(v_user,v_campaign.id,v_prize.id,p_idempotency_key,'awarding',v_roll,v_total,
    jsonb_build_object('play_id',null,'campaign_slug',v_campaign.slug,'mode',v_campaign.mode,'prize_id',v_prize.id,
      'prize_label',v_prize.label,'prize_type',v_prize.prize_type,'random_roll',v_roll,'total_weight',v_total,
      'chance_percent',round((v_prize.weight::numeric*100)/v_total,2),'bonus_cost_cents',v_campaign.bonus_cost_cents),v_debit_tx)
  returning * into v_play;

  v_result:=v_play.result||jsonb_build_object('play_id',v_play.id);

  if v_prize.prize_type='coupon' then
    v_coupon_code:='CRZ'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,18));
    insert into public.coupons(code,discount_type,discount_value,max_uses,current_uses,min_order_value,active,expires_at,origin,source_reference)
    values(v_coupon_code,coalesce(v_prize.config->>'discount_type','percentage'),coalesce((v_prize.config->>'discount_value')::numeric,5),1,0,
      coalesce((v_prize.config->>'min_order_value')::numeric,1),true,now()+make_interval(hours=>coalesce((v_prize.config->>'expires_hours')::integer,72)),'luck',v_play.id::text)
    returning * into v_coupon;
    insert into public.coupon_users(coupon_id,user_id) values(v_coupon.id,v_user);
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,reference_id,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'coupon','delivered',v_coupon.id,jsonb_build_object('coupon_code',v_coupon.code,'expires_at',v_coupon.expires_at),now());
    v_result:=v_result||jsonb_build_object('coupon_code',v_coupon.code,'coupon_id',v_coupon.id,'coupon_expires_at',v_coupon.expires_at);
  elsif v_prize.prize_type='bonus' then
    v_bonus_award:=coalesce((v_prize.config->>'bonus_cents')::integer,0);
    if v_bonus_award<=0 then raise exception 'BONUS_PRIZE_INVALID'; end if;
    v_credit_tx:=private.bonus_credit(v_user,v_bonus_award,'arcade-prize','luck-prize:'||v_play.id::text,v_prize.label,null);
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'bonus','delivered',jsonb_build_object('bonus_cents',v_bonus_award,'transaction_id',v_credit_tx),now());
    v_result:=v_result||jsonb_build_object('bonus_awarded_cents',v_bonus_award);
  elsif v_prize.prize_type='product' then
    v_product_id:=nullif(v_prize.config->>'product_id','')::uuid;
    v_plan_id:=nullif(v_prize.config->>'product_plan_id','')::uuid;
    v_duration_minutes:=nullif(v_prize.config->>'duration_minutes','')::integer;
    if v_product_id is null then raise exception 'PRODUCT_PRIZE_INVALID'; end if;
    v_expires:=case when v_duration_minutes is null then null else now()+make_interval(mins=>v_duration_minutes) end;
    insert into public.entitlements(user_id,product_id,product_plan_id,fulfillment_key,status,starts_at,expires_at,tutorial_access,metadata)
    values(v_user,v_product_id,v_plan_id,'luck:'||v_play.id::text,'active',now(),v_expires,true,jsonb_build_object('source','luck','play_id',v_play.id,'campaign',v_campaign.slug));
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,reference_id,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'product','delivered',v_product_id,'{}'::jsonb,now());
  elsif v_prize.prize_type='reward' then
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,payload)
    values(v_play.id,v_user,v_prize.id,'reward','pending',v_prize.config);
    v_result:=v_result||jsonb_build_object('delivery_status','pending');
  else
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'none','delivered','{}'::jsonb,now());
  end if;

  select balance_cents into v_balance from public.bonus_wallets where user_id=v_user;
  v_result:=v_result||jsonb_build_object('bonus_balance_cents',coalesce(v_balance,0));
  update public.luck_plays set status=case when v_prize.prize_type='reward' then 'pending_delivery' else 'awarded' end,result=v_result where id=v_play.id;
  return v_result;
end
$$;

grant execute on function public.get_luck_catalog() to anon,authenticated;
grant execute on function public.play_luck(text,text) to authenticated;