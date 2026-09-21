-- M18 CRAZZY LUCK
-- Server-authoritative wheel / scratch / drop engine with auditable odds.

create table if not exists public.luck_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  mode text not null check (mode in ('wheel','scratch','drop')),
  title text not null,
  description text not null default '',
  active boolean not null default false,
  daily_group text not null default 'daily-luck',
  free_plays_per_day integer not null default 1 check (free_plays_per_day >= 0 and free_plays_per_day <= 100),
  play_price_cents integer not null default 0 check (play_price_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luck_prizes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.luck_campaigns(id) on delete cascade,
  label text not null,
  prize_type text not null check (prize_type in ('coupon','product','account','reward','none')),
  weight integer not null check (weight > 0 and weight <= 1000000),
  active boolean not null default true,
  sort_order integer not null default 0,
  stock_limit integer check (stock_limit is null or stock_limit >= 0),
  wins_count integer not null default 0 check (wins_count >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, sort_order)
);

create table if not exists public.luck_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.luck_campaigns(id) on delete cascade,
  prize_id uuid not null references public.luck_prizes(id),
  payment_id uuid references public.payments(id) on delete set null,
  idempotency_key text not null,
  status text not null default 'awarded' check (status in ('awarding','awarded','pending_delivery','failed')),
  random_roll bigint not null,
  total_weight integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, campaign_id, idempotency_key)
);

create unique index if not exists luck_plays_payment_unique_idx
  on public.luck_plays(payment_id)
  where payment_id is not null;

create index if not exists luck_plays_user_created_idx
  on public.luck_plays(user_id, created_at desc);

create table if not exists public.luck_awards (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null unique references public.luck_plays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prize_id uuid not null references public.luck_prizes(id),
  prize_type text not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed','revoked')),
  reference_id uuid,
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.luck_campaigns enable row level security;
alter table public.luck_prizes enable row level security;
alter table public.luck_plays enable row level security;
alter table public.luck_awards enable row level security;

revoke all on table public.luck_plays from anon;
revoke all on table public.luck_awards from anon;
revoke insert, update, delete on table public.luck_plays from authenticated;
revoke insert, update, delete on table public.luck_awards from authenticated;

drop policy if exists "Public active luck campaigns" on public.luck_campaigns;
create policy "Public active luck campaigns"
on public.luck_campaigns for select to anon, authenticated
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Public active luck prizes" on public.luck_prizes;
create policy "Public active luck prizes"
on public.luck_prizes for select to anon, authenticated
using (
  active = true
  and exists (
    select 1 from public.luck_campaigns c
    where c.id = luck_prizes.campaign_id
      and c.active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
  )
);

drop policy if exists "Luck plays visible to owner or admin" on public.luck_plays;
create policy "Luck plays visible to owner or admin"
on public.luck_plays for select to authenticated
using (
  auth.uid() = user_id
  or private.has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Luck awards visible to owner or admin" on public.luck_awards;
create policy "Luck awards visible to owner or admin"
on public.luck_awards for select to authenticated
using (
  auth.uid() = user_id
  or private.has_role(auth.uid(), 'admin'::app_role)
);

create or replace function public.get_luck_catalog()
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  with active_campaigns as (
    select c.*
    from public.luck_campaigns c
    where c.active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
  ),
  prize_totals as (
    select p.campaign_id, sum(p.weight)::numeric as total_weight
    from public.luck_prizes p
    join active_campaigns c on c.id = p.campaign_id
    where p.active = true
      and (p.stock_limit is null or p.wins_count < p.stock_limit)
    group by p.campaign_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'mode', c.mode,
      'title', c.title,
      'description', c.description,
      'free_plays_per_day', c.free_plays_per_day,
      'play_price_cents', c.play_price_cents,
      'daily_group', c.daily_group,
      'config', c.config,
      'sort_order', c.sort_order,
      'prizes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'label', p.label,
            'prize_type', p.prize_type,
            'sort_order', p.sort_order,
            'stock_remaining', case when p.stock_limit is null then null else greatest(0, p.stock_limit - p.wins_count) end,
            'chance_percent', round((p.weight::numeric * 100) / nullif(t.total_weight, 0), 2)
          )
          order by p.sort_order
        )
        from public.luck_prizes p
        join prize_totals t on t.campaign_id = p.campaign_id
        where p.campaign_id = c.id
          and p.active = true
          and (p.stock_limit is null or p.wins_count < p.stock_limit)
      ), '[]'::jsonb)
    )
    order by c.sort_order
  ), '[]'::jsonb)
  from active_campaigns c;
$$;

create or replace function public.get_my_luck_history(p_limit integer default 50)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select case
    when auth.uid() is null then '[]'::jsonb
    else coalesce(jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'campaign_slug', x.campaign_slug,
        'campaign_title', x.campaign_title,
        'mode', x.mode,
        'prize_label', x.prize_label,
        'prize_type', x.prize_type,
        'status', x.status,
        'result', x.result,
        'created_at', x.created_at
      )
      order by x.created_at desc
    ), '[]'::jsonb)
  end
  from (
    select
      lp.id,
      c.slug as campaign_slug,
      c.title as campaign_title,
      c.mode,
      p.label as prize_label,
      p.prize_type,
      lp.status,
      lp.result,
      lp.created_at
    from public.luck_plays lp
    join public.luck_campaigns c on c.id = lp.campaign_id
    join public.luck_prizes p on p.id = lp.prize_id
    where lp.user_id = auth.uid()
    order by lp.created_at desc
    limit greatest(1, least(coalesce(p_limit,50),100))
  ) x;
$$;

create or replace function public.play_luck(
  p_campaign_slug text,
  p_idempotency_key text,
  p_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.luck_campaigns;
  v_existing public.luck_plays;
  v_prize public.luck_prizes;
  v_play public.luck_plays;
  v_award public.luck_awards;
  v_coupon public.coupons;
  v_payment public.payments;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_used integer := 0;
  v_total integer := 0;
  v_roll bigint := 0;
  v_random bigint := 0;
  v_bytes bytea;
  v_attempt integer := 0;
  v_coupon_code text;
  v_product_id uuid;
  v_plan_id uuid;
  v_duration_minutes integer;
  v_expires timestamptz;
  v_result jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_campaign_slug is null or btrim(p_campaign_slug) = '' then raise exception 'INVALID_CAMPAIGN'; end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) < 8 or char_length(p_idempotency_key) > 120 then
    raise exception 'INVALID_IDEMPOTENCY';
  end if;

  select * into v_campaign
  from public.luck_campaigns
  where slug = p_campaign_slug
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());

  if not found then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;

  select * into v_existing
  from public.luck_plays
  where user_id = v_user
    and campaign_id = v_campaign.id
    and idempotency_key = p_idempotency_key;

  if found then return v_existing.result; end if;

  perform pg_advisory_xact_lock(hashtextextended('luck:' || v_user::text || ':' || v_campaign.daily_group, 818));

  select count(*)::int into v_used
  from public.luck_plays lp
  join public.luck_campaigns lc on lc.id = lp.campaign_id
  where lp.user_id = v_user
    and lc.daily_group = v_campaign.daily_group
    and (lp.created_at at time zone 'America/Sao_Paulo')::date = v_today
    and lp.status in ('awarded','pending_delivery');

  if v_used >= v_campaign.free_plays_per_day then
    if v_campaign.play_price_cents <= 0 then
      raise exception 'DAILY_LIMIT';
    end if;

    if p_payment_id is null then raise exception 'PAYMENT_REQUIRED'; end if;

    select * into v_payment
    from public.payments
    where id = p_payment_id
      and user_id = v_user
      and status = 'COMPLETED';

    if not found then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
    if v_payment.amount < v_campaign.play_price_cents then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
    if exists (select 1 from public.luck_plays where payment_id = p_payment_id) then raise exception 'PAYMENT_ALREADY_USED'; end if;
  else
    p_payment_id := null;
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 8 then raise exception 'PRIZE_UNAVAILABLE'; end if;

    select coalesce(sum(weight),0)::int into v_total
    from public.luck_prizes
    where campaign_id = v_campaign.id
      and active = true
      and (stock_limit is null or wins_count < stock_limit);

    if v_total <= 0 then raise exception 'PRIZE_UNAVAILABLE'; end if;

    v_bytes := extensions.gen_random_bytes(4);
    v_random :=
      get_byte(v_bytes,0)::bigint * 16777216 +
      get_byte(v_bytes,1)::bigint * 65536 +
      get_byte(v_bytes,2)::bigint * 256 +
      get_byte(v_bytes,3)::bigint;
    v_roll := (v_random % v_total) + 1;

    select p.* into v_prize
    from (
      select p.*, sum(p.weight) over (order by p.sort_order, p.id) as cumulative_weight
      from public.luck_prizes p
      where p.campaign_id = v_campaign.id
        and p.active = true
        and (p.stock_limit is null or p.wins_count < p.stock_limit)
    ) p
    where p.cumulative_weight >= v_roll
    order by p.cumulative_weight
    limit 1;

    if v_prize.id is null then continue; end if;

    update public.luck_prizes
    set wins_count = wins_count + 1,
        updated_at = now()
    where id = v_prize.id
      and (stock_limit is null or wins_count < stock_limit)
    returning * into v_prize;

    if found then exit; end if;
  end loop;

  insert into public.luck_plays (
    user_id,campaign_id,prize_id,payment_id,idempotency_key,status,random_roll,total_weight,result
  ) values (
    v_user,v_campaign.id,v_prize.id,p_payment_id,p_idempotency_key,'awarding',v_roll,v_total,
    jsonb_build_object(
      'play_id', null,
      'campaign_slug', v_campaign.slug,
      'mode', v_campaign.mode,
      'prize_id', v_prize.id,
      'prize_label', v_prize.label,
      'prize_type', v_prize.prize_type,
      'random_roll', v_roll,
      'total_weight', v_total,
      'chance_percent', round((v_prize.weight::numeric * 100) / v_total, 2)
    )
  )
  returning * into v_play;

  v_result := v_play.result || jsonb_build_object('play_id', v_play.id);

  if v_prize.prize_type = 'coupon' then
    v_coupon_code := 'CRZ' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,18));

    insert into public.coupons (
      code,discount_type,discount_value,max_uses,current_uses,min_order_value,active,expires_at
    ) values (
      v_coupon_code,
      coalesce(v_prize.config->>'discount_type','percentage'),
      coalesce((v_prize.config->>'discount_value')::numeric,5),
      1,0,
      coalesce((v_prize.config->>'min_order_value')::numeric,1),
      true,
      now() + make_interval(hours => coalesce((v_prize.config->>'expires_hours')::integer,72))
    )
    returning * into v_coupon;

    insert into public.coupon_users(coupon_id,user_id) values(v_coupon.id,v_user);

    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,reference_id,payload,delivered_at)
    values(
      v_play.id,v_user,v_prize.id,'coupon','delivered',v_coupon.id,
      jsonb_build_object('coupon_code',v_coupon.code,'expires_at',v_coupon.expires_at),
      now()
    )
    returning * into v_award;

    v_result := v_result || jsonb_build_object(
      'coupon_code', v_coupon.code,
      'coupon_id', v_coupon.id,
      'coupon_expires_at', v_coupon.expires_at
    );

    update public.luck_plays set status='awarded',result=v_result where id=v_play.id;
  elsif v_prize.prize_type = 'product' then
    v_product_id := nullif(v_prize.config->>'product_id','')::uuid;
    v_plan_id := nullif(v_prize.config->>'product_plan_id','')::uuid;
    v_duration_minutes := nullif(v_prize.config->>'duration_minutes','')::integer;
    if v_product_id is null then raise exception 'PRODUCT_PRIZE_INVALID'; end if;
    v_expires := case when v_duration_minutes is null then null else now() + make_interval(mins => v_duration_minutes) end;

    insert into public.entitlements(
      user_id,product_id,product_plan_id,fulfillment_key,status,starts_at,expires_at,tutorial_access,metadata
    ) values (
      v_user,v_product_id,v_plan_id,'luck:' || v_play.id::text,'active',now(),v_expires,true,
      jsonb_build_object('source','luck','play_id',v_play.id,'campaign',v_campaign.slug)
    );

    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,reference_id,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'product','delivered',v_product_id,'{}'::jsonb,now());

    update public.luck_plays set status='awarded',result=v_result where id=v_play.id;
  elsif v_prize.prize_type in ('account','reward') then
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,payload)
    values(v_play.id,v_user,v_prize.id,v_prize.prize_type,'pending',v_prize.config);

    v_result := v_result || jsonb_build_object('delivery_status','pending');
    update public.luck_plays set status='pending_delivery',result=v_result where id=v_play.id;
  else
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'none','delivered','{}'::jsonb,now());

    update public.luck_plays set status='awarded',result=v_result where id=v_play.id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_luck_catalog() from public;
revoke all on function public.get_my_luck_history(integer) from public;
revoke all on function public.play_luck(text,text,uuid) from public;

grant execute on function public.get_luck_catalog() to anon, authenticated;
grant execute on function public.get_my_luck_history(integer) to authenticated;
grant execute on function public.play_luck(text,text,uuid) to authenticated;

-- Default CRAZZY LUCK campaigns. One free play is shared across the daily-luck group.
insert into public.luck_campaigns(slug,mode,title,description,active,daily_group,free_plays_per_day,play_price_cents,config,sort_order)
values
  ('daily-wheel','wheel','Roleta CRAZZY','Gire a roleta e receba um cupom CRAZZY.','true','daily-luck',1,0,'{"accent":"blue"}'::jsonb,0),
  ('daily-scratch','scratch','Raspadinha CRAZZY','Raspe a carta e revele seu cupom.','true','daily-luck',1,0,'{"accent":"pink"}'::jsonb,1),
  ('daily-drop','drop','CRAZZY DROP','Abra o drop diário e revele sua recompensa.','true','daily-luck',1,0,'{"accent":"violet"}'::jsonb,2)
on conflict (slug) do update set
  title=excluded.title,
  description=excluded.description,
  mode=excluded.mode,
  daily_group=excluded.daily_group,
  free_plays_per_day=excluded.free_plays_per_day,
  play_price_cents=excluded.play_price_cents,
  config=excluded.config,
  sort_order=excluded.sort_order,
  active=excluded.active,
  updated_at=now();

with prize_seed(label, discount_type, discount_value, weight, sort_order, min_order) as (
  values
    ('5% OFF','percentage',5::numeric,30,0,1::numeric),
    ('10% OFF','percentage',10::numeric,25,1,1::numeric),
    ('R$ 5 OFF','fixed',5::numeric,20,2,20::numeric),
    ('15% OFF','percentage',15::numeric,12,3,1::numeric),
    ('20% OFF','percentage',20::numeric,5,4,1::numeric),
    ('R$ 10 OFF','fixed',10::numeric,6,5,35::numeric),
    ('R$ 20 OFF','fixed',20::numeric,2,6,60::numeric)
),
campaigns as (
  select id from public.luck_campaigns where slug in ('daily-wheel','daily-scratch','daily-drop')
)
insert into public.luck_prizes(campaign_id,label,prize_type,weight,active,sort_order,config)
select
  c.id,
  p.label,
  'coupon',
  p.weight,
  true,
  p.sort_order,
  jsonb_build_object(
    'discount_type',p.discount_type,
    'discount_value',p.discount_value,
    'min_order_value',p.min_order,
    'expires_hours',72
  )
from campaigns c
cross join prize_seed p
on conflict (campaign_id,sort_order) do update set
  label=excluded.label,
  prize_type=excluded.prize_type,
  weight=excluded.weight,
  active=excluded.active,
  config=excluded.config,
  updated_at=now();
