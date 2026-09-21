-- M19 CRAZZY COUPONS
-- Customer coupon wallet with origin, status, validity and safe server-side reads.

alter table public.coupons
  add column if not exists origin text not null default 'promotion',
  add column if not exists source_reference text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.coupons'::regclass
      and conname='coupons_origin_check'
  ) then
    alter table public.coupons
      add constraint coupons_origin_check
      check (origin in ('promotion','reward','wheel','scratch','drop','admin','manual','other'));
  end if;
end $$;

create unique index if not exists coupon_users_coupon_user_unique_idx
  on public.coupon_users(coupon_id,user_id);

create index if not exists coupons_expires_at_idx
  on public.coupons(expires_at)
  where expires_at is not null;

create index if not exists coupon_usage_user_coupon_idx
  on public.coupon_usage(user_id,coupon_id);

create or replace function public.mark_luck_coupon_origin()
returns trigger
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_mode text;
  v_play uuid;
begin
  if new.prize_type <> 'coupon' or new.reference_id is null then
    return new;
  end if;

  select lp.id, lc.mode
  into v_play, v_mode
  from public.luck_plays lp
  join public.luck_campaigns lc on lc.id=lp.campaign_id
  where lp.id=new.play_id;

  update public.coupons
  set origin=case
      when v_mode='wheel' then 'wheel'
      when v_mode='scratch' then 'scratch'
      when v_mode='drop' then 'drop'
      else 'other'
    end,
    source_reference='luck:' || coalesce(v_play,new.play_id)::text,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('luck_play_id',new.play_id,'luck_mode',v_mode)
  where id=new.reference_id;

  return new;
end;
$$;

drop trigger if exists luck_coupon_origin_trigger on public.luck_awards;
create trigger luck_coupon_origin_trigger
after insert or update of reference_id,status on public.luck_awards
for each row
when (new.prize_type='coupon' and new.reference_id is not null)
execute function public.mark_luck_coupon_origin();

-- Backfill coupons already awarded by M18 before this migration.
update public.coupons c
set origin=case
      when lc.mode='wheel' then 'wheel'
      when lc.mode='scratch' then 'scratch'
      when lc.mode='drop' then 'drop'
      else 'other'
    end,
    source_reference='luck:' || lp.id::text,
    metadata=coalesce(c.metadata,'{}'::jsonb) || jsonb_build_object('luck_play_id',lp.id,'luck_mode',lc.mode)
from public.luck_awards la
join public.luck_plays lp on lp.id=la.play_id
join public.luck_campaigns lc on lc.id=lp.campaign_id
where la.prize_type='coupon'
  and la.reference_id=c.id;

create or replace function public.get_my_coupons()
returns jsonb
language sql
security definer
set search_path=public,auth,pg_temp
as $$
  with mine as (
    select
      c.id,
      c.code,
      c.discount_type,
      c.discount_value,
      c.max_uses,
      c.current_uses,
      c.min_order_value,
      c.active,
      c.expires_at,
      c.origin,
      c.created_at,
      exists (
        select 1
        from public.coupon_usage cu
        where cu.coupon_id=c.id
          and cu.user_id=auth.uid()
      ) as used_by_me,
      coalesce((
        select count(*)::int
        from public.coupon_usage cu2
        where cu2.coupon_id=c.id
      ),0) as real_uses,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id',p.id,'name',p.name,'image_url',p.image_url)
          order by p.name
        )
        from public.coupon_products cp
        join public.products p on p.id=cp.product_id
        where cp.coupon_id=c.id
      ),'[]'::jsonb) as products
    from public.coupon_users cu
    join public.coupons c on c.id=cu.coupon_id
    where cu.user_id=auth.uid()
  )
  select case
    when auth.uid() is null then '[]'::jsonb
    else coalesce(jsonb_agg(
      jsonb_build_object(
        'id',m.id,
        'code',m.code,
        'discount_type',m.discount_type,
        'discount_value',m.discount_value,
        'max_uses',m.max_uses,
        'current_uses',m.real_uses,
        'min_order_value',m.min_order_value,
        'active',m.active,
        'expires_at',m.expires_at,
        'origin',m.origin,
        'created_at',m.created_at,
        'products',m.products,
        'status',case
          when m.used_by_me then 'used'
          when m.active is not true then 'inactive'
          when m.expires_at is not null and m.expires_at <= now() then 'expired'
          when m.max_uses is not null and m.real_uses >= m.max_uses then 'used'
          else 'available'
        end
      )
      order by
        case
          when m.used_by_me then 2
          when m.active is not true then 3
          when m.expires_at is not null and m.expires_at <= now() then 3
          when m.max_uses is not null and m.real_uses >= m.max_uses then 2
          else 1
        end,
        m.created_at desc
    ),'[]'::jsonb)
  end
  from mine m;
$$;

revoke all on function public.get_my_coupons() from public;
revoke execute on function public.get_my_coupons() from anon;
grant execute on function public.get_my_coupons() to authenticated;
