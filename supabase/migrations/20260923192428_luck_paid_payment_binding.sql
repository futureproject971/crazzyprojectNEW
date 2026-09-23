-- Bind paid CRAZZY LUCK attempts to a dedicated, server-priced checkout purpose.
CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(p_payment_id uuid, p_cart_snapshot jsonb, p_ttl_minutes integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_item jsonb;
  v_plan_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_item_index integer := -1;
  v_unit_index integer;
  v_delivery_mode text;
  v_key text;
  v_reserved jsonb := '[]'::jsonb;
  v_reservation jsonb;
begin
  if p_payment_id is null then
    raise exception 'PAYMENT_ID_REQUIRED';
  end if;
  if p_cart_snapshot is null
     or jsonb_typeof(p_cart_snapshot) <> 'array'
     or jsonb_array_length(p_cart_snapshot) = 0
     or jsonb_array_length(p_cart_snapshot) > 50 then
    raise exception 'INVALID_CART_SNAPSHOT';
  end if;

  for v_item in select value from jsonb_array_elements(p_cart_snapshot)
  loop
    v_item_index := v_item_index + 1;

    if coalesce(v_item->>'type','') in ('lzt-account','luck-play')
       or coalesce(v_item->>'planId','') = 'lzt-account' then
      continue;
    end if;

    begin
      v_plan_id := (v_item->>'planId')::uuid;
      v_product_id := (v_item->>'productId')::uuid;
    exception when others then
      raise exception 'INVALID_CART_PRODUCT_REFERENCE';
    end;

    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'INVALID_CART_QUANTITY';
    end if;

    if not exists (
      select 1
      from public.product_plans pp
      join public.products p on p.id=pp.product_id
      where pp.id=v_plan_id
        and pp.product_id=v_product_id
        and pp.active=true
        and p.active=true
    ) then
      raise exception 'PLAN_NOT_AVAILABLE';
    end if;

    select coalesce(ppo.delivery_mode,'internal_stock')
      into v_delivery_mode
    from public.product_plans pp
    left join private.product_plan_operations ppo
      on ppo.product_plan_id=pp.id
    where pp.id=v_plan_id;

    if coalesce(v_delivery_mode,'internal_stock') <> 'internal_stock' then
      continue;
    end if;

    for v_unit_index in 0..(v_quantity-1)
    loop
      v_key := 'payment:' || p_payment_id::text || ':' || v_item_index::text || ':' || v_unit_index::text;

      v_reservation := public.reserve_stock_for_fulfillment(
        v_plan_id,
        v_key,
        greatest(5,least(coalesce(p_ttl_minutes,60),1440))
      );

      v_reserved := v_reserved || jsonb_build_array(
        jsonb_build_object(
          'item_index',v_item_index,
          'unit_index',v_unit_index,
          'product_id',v_product_id,
          'product_plan_id',v_plan_id,
          'reservation_id',v_reservation->>'reservation_id',
          'expires_at',v_reservation->>'expires_at'
        )
      );
    end loop;
  end loop;

  return jsonb_build_object(
    'payment_id',p_payment_id,
    'reservations',v_reserved,
    'count',jsonb_array_length(v_reserved)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.play_luck(p_campaign_slug text, p_idempotency_key text, p_payment_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
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

    if v_payment.amount <> v_campaign.play_price_cents then
      raise exception 'PAYMENT_AMOUNT_INVALID';
    end if;

    if v_payment.coupon_id is not null
       or coalesce(round(v_payment.discount_amount * 100),0) <> 0
       or jsonb_typeof(v_payment.cart_snapshot) <> 'array'
       or jsonb_array_length(v_payment.cart_snapshot) <> 1
       or coalesce(v_payment.cart_snapshot->0->>'type','') <> 'luck-play'
       or coalesce(v_payment.cart_snapshot->0->>'campaignSlug','') <> v_campaign.slug
       or coalesce((v_payment.cart_snapshot->0->>'quantity')::integer,0) <> 1
       or round(coalesce((v_payment.cart_snapshot->0->>'price')::numeric,0) * 100)::integer <> v_campaign.play_price_cents
    then
      raise exception 'PAYMENT_PURPOSE_INVALID';
    end if;

    if exists (select 1 from public.luck_plays where payment_id = p_payment_id) then
      raise exception 'PAYMENT_ALREADY_USED';
    end if;
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
$function$
;

revoke all on function public.reserve_checkout_stock(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.reserve_checkout_stock(uuid,jsonb,integer) to service_role;

revoke all on function public.play_luck(text,text,uuid) from public,anon;
grant execute on function public.play_luck(text,text,uuid) to authenticated,service_role;
