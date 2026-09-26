-- Per-plan archive and atomic ordering; sales history is never deleted.
alter table public.product_plans add column if not exists archived_at timestamptz;
create or replace function public.admin_reorder_product_plans(p_product_id uuid,p_plan_ids uuid[]) returns void
language plpgsql set search_path=public,private,pg_temp as $$
declare actual uuid[];
begin
 if not public.is_current_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 perform 1 from public.products where id=p_product_id for update;
 select array_agg(id order by id) into actual from public.product_plans where product_id=p_product_id and archived_at is null;
 if actual is distinct from (select array_agg(id order by id) from unnest(p_plan_ids) id) then raise exception 'PLAN_SET_CHANGED'; end if;
 update public.product_plans p set sort_order=q.ordinality-1 from unnest(p_plan_ids) with ordinality q(id,ordinality) where p.id=q.id and p.product_id=p_product_id;
end $$;
create or replace function public.admin_archive_product_plan(p_product_id uuid,p_plan_id uuid) returns void
language plpgsql set search_path=public,private,pg_temp as $$
begin
 if not public.is_current_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 perform 1 from public.products where id=p_product_id for update;
 update public.product_plans set active=false,archived_at=coalesce(archived_at,now()) where id=p_plan_id and product_id=p_product_id;
 if not found then raise exception 'PLAN_NOT_FOUND'; end if;
end $$;
revoke all on function public.admin_reorder_product_plans(uuid,uuid[]), public.admin_archive_product_plan(uuid,uuid) from public,anon;
grant execute on function public.admin_reorder_product_plans(uuid,uuid[]), public.admin_archive_product_plan(uuid,uuid) to authenticated;
-- Archived plans cannot be accidentally reactivated by an older editor.
alter table public.product_plans add constraint archived_plan_inactive check(archived_at is null or active=false);

CREATE OR REPLACE FUNCTION public.get_public_store_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(item order by (item->>'sort_order')::int, item->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'name', p.name,
      'description', p.description,
      'features_text', p.features_text,
      'image_url', p.image_url,
      'is_new', p.is_new,
      'status', p.status,
      'status_label', p.status_label,
      'emoji', p.emoji,
      'accent_color', p.accent_color,
      'sort_order', p.sort_order,
      'created_at', p.created_at,
      'game', jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'slug', g.slug,
        'description', g.description,
        'image_url', g.image_url,
        'icon_url', g.icon_url,
        'emoji', g.emoji,
        'accent_color', g.accent_color
      ),
      'plans', coalesce(plans.items, '[]'::jsonb),
      'media', coalesce(media.items, '[]'::jsonb),
      'features', coalesce(features.items, '[]'::jsonb)
    ) as item
    from public.products p
    join public.games g on g.id=p.game_id and g.active=true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', z.id,
          'name', z.name,
          'price', z.price,
          'plan_code', z.plan_code,
          'sort_order', z.sort_order,
          'show_when_out_of_stock', z.show_when_out_of_stock,
          'emoji', z.emoji,
          'accent_color', z.accent_color,
          'delivery_mode', z.delivery_mode,
          'stock_managed', z.stock_managed,
          'stock_count', z.stock_count
        )
        order by z.sort_order, z.name
      ) as items
      from (
        select
          pp.id,
          pp.name,
          pp.price,
          pp.plan_code,
          pp.sort_order,
          pp.show_when_out_of_stock,
          pp.emoji,
          pp.accent_color,
          coalesce(ppo.delivery_mode,'internal_stock') as delivery_mode,
          coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' as stock_managed,
          case
            when coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' then (
              select count(*)::int
              from public.stock_items si
              where si.product_plan_id=pp.id
                and si.used=false
                and si.disabled=false
                and not exists (
                  select 1
                  from public.stock_reservations sr
                  where sr.stock_item_id=si.id
                    and sr.status='reserved'
                    and sr.expires_at>now()
                )
            )
            else null
          end as stock_count
        from public.product_plans pp
        left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
        where pp.product_id=p.id and pp.active=true and pp.price>0 and pp.archived_at is null
      ) z
      where z.stock_managed=false
         or coalesce(z.stock_count,0)>0
         or z.show_when_out_of_stock=true
    ) plans on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'media_type', pm.media_type,
          'url', pm.url,
          'sort_order', pm.sort_order
        )
        order by pm.sort_order,pm.created_at
      ) as items
      from public.product_media pm
      where pm.product_id=p.id
    ) media on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', pf.id,
          'label', pf.label,
          'value', pf.value,
          'sort_order', pf.sort_order
        )
        order by pf.sort_order,pf.created_at
      ) as items
      from public.product_features pf
      where pf.product_id=p.id
    ) features on true
    where p.active=true
  ) q;
$function$;

-- Repair the reported ready plan only; incomplete plans stay drafts.
update public.product_plans pp set active=true where pp.price>0 and pp.archived_at is null
and exists(select 1 from public.stock_items si where si.product_plan_id=pp.id and not si.used and not si.disabled)
and exists(select 1 from public.products p where p.id=pp.product_id and p.active);

-- Eligibility shared by catalog and draw: never advertise an undeliverable product prize.
create or replace function private.luck_prize_ready(p public.luck_prizes) returns boolean
language sql stable security definer set search_path=public,private,pg_temp as $$
select p.active and (p.stock_limit is null or p.wins_count<p.stock_limit) and
(case when p.prize_type='product' then exists(
 select 1 from public.product_plans pp join public.products prod on prod.id=pp.product_id
 join private.product_plan_operations op on op.product_plan_id=pp.id
 where pp.id::text=p.config->>'product_plan_id' and prod.id::text=p.config->>'product_id'
 and pp.archived_at is null and prod.active and op.delivery_mode='internal_stock'
 and exists(select 1 from public.stock_items si where si.product_plan_id=pp.id and not si.used and not si.disabled
 and not exists(select 1 from public.stock_reservations sr where sr.stock_item_id=si.id and sr.status='reserved' and sr.expires_at>now()))
) else true end);
$$;
revoke all on function private.luck_prize_ready(public.luck_prizes) from public,anon,authenticated;

create or replace function public.get_luck_catalog()
returns jsonb
language sql
security definer
set search_path='public','auth','extensions','pg_temp'
as $$
  with active_campaigns as (
    select c.*
    from public.luck_campaigns c
    where c.active=true and (c.bonus_cost_cents>0 or c.mode='drop')
      and (c.starts_at is null or c.starts_at<=now())
      and (c.ends_at is null or c.ends_at>now())
  ),
  prize_totals as (
    select p.campaign_id,sum(p.weight)::numeric total_weight
    from public.luck_prizes p join active_campaigns c on c.id=p.campaign_id
    where private.luck_prize_ready(p)
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
      where p.campaign_id=c.id and private.luck_prize_ready(p)
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
  v_stock public.stock_items;
  v_entitlement uuid;
  v_delivery uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_campaign_slug is null or btrim(p_campaign_slug)='' then raise exception 'INVALID_CAMPAIGN'; end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key))<8 or char_length(p_idempotency_key)>120 then raise exception 'INVALID_IDEMPOTENCY'; end if;

  select * into v_campaign from public.luck_campaigns
  where slug=p_campaign_slug and active=true and (bonus_cost_cents>0 or mode='drop')
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;

  select * into v_existing from public.luck_plays
  where user_id=v_user and campaign_id=v_campaign.id and idempotency_key=p_idempotency_key;
  if found then return v_existing.result; end if;

  perform pg_advisory_xact_lock(hashtextextended('luck:'||v_user::text||':'||v_campaign.id::text,818));
  -- Recheck idempotency after serialization, including concurrent retries.
  select * into v_existing from public.luck_plays where user_id=v_user and campaign_id=v_campaign.id and idempotency_key=p_idempotency_key;
  if found then return v_existing.result; end if;
  if v_campaign.mode='drop' then
    perform pg_advisory_xact_lock(hashtextextended('daily-drop:'||v_user::text,819));
    if exists(select 1 from public.luck_plays lp join public.luck_campaigns lc on lc.id=lp.campaign_id
      where lp.user_id=v_user and lc.mode='drop' and (lp.created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date)
      then raise exception 'DAILY_DROP_USED'; end if;
  else
  v_debit_tx:=private.bonus_debit(v_user,v_campaign.bonus_cost_cents,'arcade','luck:'||v_campaign.id::text||':'||p_idempotency_key,'Jogada '||v_campaign.title);
  end if;

  loop
    v_attempt:=v_attempt+1;
    if v_attempt>8 then raise exception 'PRIZE_UNAVAILABLE'; end if;
    select coalesce(sum(weight),0)::int into v_total from public.luck_prizes p
    where campaign_id=v_campaign.id and private.luck_prize_ready(p);
    if v_total<=0 then raise exception 'PRIZE_UNAVAILABLE'; end if;

    v_bytes:=extensions.gen_random_bytes(4);
    v_random:=get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)::bigint*65536+get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint;
    v_roll:=(v_random%v_total)+1;

    select p.* into v_prize from (
      select p.*,sum(p.weight) over(order by p.sort_order,p.id) cumulative_weight
      from public.luck_prizes p where p.campaign_id=v_campaign.id and private.luck_prize_ready(p)
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
      'chance_percent',round((v_prize.weight::numeric*100)/v_total,2),'bonus_cost_cents',case when v_campaign.mode='drop' then 0 else v_campaign.bonus_cost_cents end),v_debit_tx)
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
    select op.entitlement_duration_minutes into v_duration_minutes from private.product_plan_operations op
      join public.product_plans pp on pp.id=op.product_plan_id where pp.id=v_plan_id and pp.product_id=v_product_id and pp.archived_at is null;
    if not found then raise exception 'PRODUCT_PRIZE_INVALID'; end if;
    select si.* into v_stock from public.stock_items si where si.product_plan_id=v_plan_id and not si.used and not si.disabled
      and not exists(select 1 from public.stock_reservations sr where sr.stock_item_id=si.id and sr.status='reserved' and sr.expires_at>now())
      order by si.created_at,si.id for update of si skip locked limit 1;
    if not found then raise exception 'PRIZE_UNAVAILABLE'; end if;
    update public.stock_items set used=true,used_at=now() where id=v_stock.id;
    v_expires:=case when v_duration_minutes is null then null else now()+make_interval(mins=>v_duration_minutes) end;
    insert into public.entitlements(user_id,product_id,product_plan_id,fulfillment_key,status,starts_at,expires_at,tutorial_access,metadata)
    values(v_user,v_product_id,v_plan_id,'luck:'||v_play.id::text,'active',now(),v_expires,true,jsonb_build_object('source','luck','play_id',v_play.id,'campaign',v_campaign.slug)) returning id into v_entitlement;
    insert into public.library_deliveries(user_id,delivery_type,product_id,product_plan_id,entitlement_id,source_stock_item_id,expires_at,metadata)
    values(v_user,'key',v_product_id,v_plan_id,v_entitlement,v_stock.id,v_expires,jsonb_build_object('source','luck','play_id',v_play.id)) returning id into v_delivery;
    insert into private.library_delivery_secrets(delivery_id,payload) values(v_delivery,v_stock.content);
    insert into public.luck_awards(play_id,user_id,prize_id,prize_type,status,reference_id,payload,delivered_at)
    values(v_play.id,v_user,v_prize.id,'product','delivered',v_delivery,jsonb_build_object('product_id',v_product_id,'product_plan_id',v_plan_id,'entitlement_id',v_entitlement),now());
    v_result:=v_result||jsonb_build_object('delivery_status','delivered','library_delivery_id',v_delivery,'product_id',v_product_id,'product_plan_id',v_plan_id);
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


revoke all on function public.play_luck(text,text) from public,anon;
grant execute on function public.play_luck(text,text) to authenticated;
grant execute on function public.get_luck_catalog() to anon,authenticated;
-- Existing drop becomes a daily free percentage wheel. Keep old awards/history.
update public.luck_campaigns set bonus_cost_cents=0,free_plays_per_day=1,play_price_cents=0,title='Drop diário grátis',description='Uma chance grátis por dia: cupom de 5% a 50%.',daily_group='daily-free-drop' where mode='drop';
insert into public.luck_campaigns(slug,mode,title,description,active,bonus_cost_cents,free_plays_per_day,play_price_cents,daily_group,sort_order)
select 'daily-free-drop','drop','Drop diário grátis','Uma chance grátis por dia: cupom de 5% a 50%.',true,0,1,0,'daily-free-drop',30 where not exists(select 1 from public.luck_campaigns where mode='drop');
update public.luck_prizes set active=false where campaign_id in(select id from public.luck_campaigns where mode='drop');
insert into public.luck_prizes(campaign_id,label,prize_type,weight,sort_order,active,config)
select c.id,d.discount::text||'% OFF','coupon',d.weight,100+d.discount,true,
jsonb_build_object('discount_type','percentage','discount_value',d.discount,'min_order_value',0,'expires_hours',24)
from public.luck_campaigns c cross join(values(5,6000),(10,2500),(15,1000),(20,350),(25,100),(30,30),(40,19),(50,1)) d(discount,weight) where c.mode='drop';
