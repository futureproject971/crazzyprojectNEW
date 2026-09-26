-- CRAZZY PROJECT NEW • PurinCash Supplier Engine
-- Supplier bindings remain private; provider delivery content is stored only in the existing private library vault.

create or replace function public.resolve_checkout_plan_operation(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_row private.product_plan_operations%rowtype;
  v_index integer;
  v_stock integer;
  v_unlimited boolean := false;
begin
  select * into v_row from private.product_plan_operations where product_plan_id=p_plan_id;
  if not found then return jsonb_build_object('delivery_mode','internal_stock'); end if;

  if coalesce(v_row.automation_flags->>'supplier_variation_index','') ~ '^[0-9]+$' then
    v_index := (v_row.automation_flags->>'supplier_variation_index')::integer;
  end if;
  if coalesce(v_row.automation_flags->>'supplier_stock','') ~ '^[0-9]+$' then
    v_stock := (v_row.automation_flags->>'supplier_stock')::integer;
  end if;
  v_unlimited := lower(coalesce(v_row.automation_flags->>'supplier_unlimited','false'))='true';

  return jsonb_build_object(
    'delivery_mode',coalesce(v_row.delivery_mode,'internal_stock'),
    'supplier_provider',v_row.supplier_provider,
    'supplier_product_id',v_row.supplier_product_id,
    'supplier_variation_id',v_row.supplier_variation_id,
    'supplier_variation_index',v_index,
    'supplier_store_product_id',nullif(v_row.automation_flags->>'supplier_store_product_id',''),
    'supplier_sync_status',coalesce(v_row.automation_flags->>'supplier_sync_status',''),
    'supplier_unlimited',v_unlimited,
    'supplier_stock',v_stock
  );
end;
$$;

revoke all on function public.resolve_checkout_plan_operation(uuid) from public,anon,authenticated;
grant execute on function public.resolve_checkout_plan_operation(uuid) to service_role;

create or replace function public.mark_purincash_supplier_binding_status(p_plan_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if p_status not in ('synced','stale','needs_review','unavailable') then
    raise exception 'INVALID_SUPPLIER_SYNC_STATUS';
  end if;

  update private.product_plan_operations
  set automation_flags=coalesce(automation_flags,'{}'::jsonb)
      || jsonb_build_object('supplier_sync_status',p_status,'supplier_last_synced_at',now()),
      updated_at=now()
  where product_plan_id=p_plan_id
    and delivery_mode='purincash_supplier'
    and supplier_provider='purincash';

  return found;
end;
$$;

revoke all on function public.mark_purincash_supplier_binding_status(uuid,text) from public,anon,authenticated;
grant execute on function public.mark_purincash_supplier_binding_status(uuid,text) to service_role;

create or replace function public.admin_import_purincash_supplier_plans(p_product_id uuid,p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb; v_plan_id uuid; v_name text; v_code text; v_price_cents integer;
  v_sort integer; v_duration integer; v_supplier_product_id text;
  v_supplier_variation_id text; v_variation_index integer; v_store_product_id text;
  v_stock integer; v_unlimited boolean; v_active boolean;
  v_created jsonb := '[]'::jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then
    raise exception 'INVALID_SUPPLIER_ITEMS';
  end if;

  select coalesce(max(sort_order)+1,0) into v_sort from public.product_plans where product_id=p_product_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_name := left(btrim(coalesce(v_item->>'name','')),80);
    if v_name='' then raise exception 'INVALID_SUPPLIER_PLAN_NAME'; end if;
    v_code := lower(btrim(coalesce(v_item->>'plan_code','custom')));
    if v_code not in ('trial','1d','3d','7d','15d','30d','90d','lifetime','single','custom') then v_code := 'custom'; end if;
    if coalesce(v_item->>'price_cents','') !~ '^[0-9]+$' then raise exception 'INVALID_SUPPLIER_PRICE'; end if;
    v_price_cents := (v_item->>'price_cents')::integer;
    v_supplier_product_id := btrim(coalesce(v_item->>'supplier_product_id',''));
    if v_supplier_product_id !~ '^prod_[A-Za-z0-9_-]+$' then raise exception 'INVALID_SUPPLIER_PRODUCT_ID'; end if;
    v_supplier_variation_id := nullif(left(btrim(coalesce(v_item->>'supplier_variation_id','')),200),'');
    v_store_product_id := nullif(left(btrim(coalesce(v_item->>'supplier_store_product_id','')),200),'');
    if coalesce(v_item->>'supplier_variation_index','') !~ '^[0-9]+$' then raise exception 'INVALID_SUPPLIER_VARIATION_INDEX'; end if;
    v_variation_index := (v_item->>'supplier_variation_index')::integer;
    v_stock := case when coalesce(v_item->>'supplier_stock','') ~ '^[0-9]+$' then (v_item->>'supplier_stock')::integer else null end;
    v_unlimited := lower(coalesce(v_item->>'supplier_unlimited','false'))='true';
    v_active := lower(coalesce(v_item->>'active','true'))<>'false';

    if exists(
      select 1
      from public.product_plans pp
      join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
      where pp.product_id=p_product_id and ppo.delivery_mode='purincash_supplier'
        and ppo.supplier_product_id=v_supplier_product_id
        and (
          (v_supplier_variation_id is not null and ppo.supplier_variation_id=v_supplier_variation_id)
          or (v_supplier_variation_id is null and coalesce(ppo.automation_flags->>'supplier_variation_index','')=v_variation_index::text)
        )
        and pp.archived_at is null
    ) then continue; end if;

    v_duration := case v_code
      when 'trial' then 60 when '1d' then 1440 when '3d' then 4320 when '7d' then 10080
      when '15d' then 21600 when '30d' then 43200 when '90d' then 129600 else null end;

    insert into public.product_plans(product_id,name,price,active,sort_order,plan_code,show_when_out_of_stock)
    values(p_product_id,v_name,v_price_cents::numeric/100,v_active,v_sort,v_code,false)
    returning id into v_plan_id;

    insert into private.product_plan_operations(
      product_plan_id,delivery_mode,entitlement_duration_minutes,supplier_provider,
      supplier_product_id,supplier_variation_id,automation_flags,updated_at
    ) values(
      v_plan_id,'purincash_supplier',v_duration,'purincash',v_supplier_product_id,v_supplier_variation_id,
      jsonb_strip_nulls(jsonb_build_object(
        'auto_delivery',true,'auto_discord_role',false,'auto_tutorial_unlock',false,'auto_expire',v_duration is not null,
        'supplier_variation_index',v_variation_index,'supplier_store_product_id',v_store_product_id,
        'supplier_display_name',nullif(left(btrim(coalesce(v_item->>'supplier_display_name','')),160),''),
        'supplier_variation_name',nullif(left(btrim(coalesce(v_item->>'supplier_variation_name','')),160),''),
        'supplier_catalog_price_cents',v_price_cents,'supplier_stock',v_stock,
        'supplier_unlimited',v_unlimited,'supplier_sync_status','synced','supplier_last_synced_at',now()
      )),now()
    );

    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'id',v_plan_id,'name',v_name,'plan_code',v_code,'supplier_product_id',v_supplier_product_id,
      'supplier_variation_id',v_supplier_variation_id,'supplier_variation_index',v_variation_index
    ));
    v_sort := v_sort+1;
  end loop;

  return jsonb_build_object('created',v_created,'count',jsonb_array_length(v_created));
end;
$$;

revoke all on function public.admin_import_purincash_supplier_plans(uuid,jsonb) from public,anon;
grant execute on function public.admin_import_purincash_supplier_plans(uuid,jsonb) to authenticated;

create or replace function public.admin_bind_purincash_supplier_plan(p_plan_id uuid,p_item jsonb)
returns boolean
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_supplier_product_id text;
  v_supplier_variation_id text;
  v_variation_index integer;
  v_stock integer;
  v_unlimited boolean;
  v_catalog_price_cents integer;
begin
  if v_user is null or not private.has_role(v_user,'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.product_plans where id=p_plan_id and archived_at is null) then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  v_supplier_product_id:=btrim(coalesce(p_item->>'supplier_product_id',''));
  if v_supplier_product_id !~ '^prod_[A-Za-z0-9_-]+$' then raise exception 'INVALID_SUPPLIER_PRODUCT_ID'; end if;
  if coalesce(p_item->>'supplier_variation_index','') !~ '^[0-9]+$' then raise exception 'INVALID_SUPPLIER_VARIATION_INDEX'; end if;
  if coalesce(p_item->>'price_cents','') !~ '^[0-9]+$' then raise exception 'INVALID_SUPPLIER_PRICE'; end if;
  v_supplier_variation_id:=nullif(left(btrim(coalesce(p_item->>'supplier_variation_id','')),200),'');
  v_variation_index:=(p_item->>'supplier_variation_index')::integer;
  v_catalog_price_cents:=(p_item->>'price_cents')::integer;
  v_stock:=case when coalesce(p_item->>'supplier_stock','') ~ '^[0-9]+$' then (p_item->>'supplier_stock')::integer else null end;
  v_unlimited:=lower(coalesce(p_item->>'supplier_unlimited','false'))='true';

  insert into private.product_plan_operations(
    product_plan_id,delivery_mode,supplier_provider,supplier_product_id,supplier_variation_id,
    automation_flags,updated_at
  ) values(
    p_plan_id,'purincash_supplier','purincash',v_supplier_product_id,v_supplier_variation_id,
    jsonb_strip_nulls(jsonb_build_object(
      'auto_delivery',true,'auto_discord_role',false,'auto_tutorial_unlock',false,
      'supplier_variation_index',v_variation_index,
      'supplier_store_product_id',nullif(left(btrim(coalesce(p_item->>'supplier_store_product_id','')),200),''),
      'supplier_display_name',nullif(left(btrim(coalesce(p_item->>'supplier_display_name','')),160),''),
      'supplier_variation_name',nullif(left(btrim(coalesce(p_item->>'supplier_variation_name','')),160),''),
      'supplier_catalog_price_cents',v_catalog_price_cents,'supplier_stock',v_stock,
      'supplier_unlimited',v_unlimited,'supplier_sync_status','synced','supplier_last_synced_at',now()
    )),now()
  )
  on conflict(product_plan_id) do update
  set delivery_mode='purincash_supplier',
      supplier_provider='purincash',
      supplier_product_id=excluded.supplier_product_id,
      supplier_variation_id=excluded.supplier_variation_id,
      automation_flags=(
        coalesce(private.product_plan_operations.automation_flags,'{}'::jsonb)
        - 'supplier_variation_index' - 'supplier_store_product_id' - 'supplier_display_name'
        - 'supplier_variation_name' - 'supplier_catalog_price_cents' - 'supplier_stock'
        - 'supplier_unlimited' - 'supplier_sync_status' - 'supplier_last_synced_at'
      ) || excluded.automation_flags,
      updated_at=now();

  return true;
end;
$$;

revoke all on function public.admin_bind_purincash_supplier_plan(uuid,jsonb) from public,anon;
grant execute on function public.admin_bind_purincash_supplier_plan(uuid,jsonb) to authenticated;

create or replace function public.admin_get_purincash_supplier_binding(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare v_user uuid:=auth.uid(); v_row private.product_plan_operations%rowtype;
begin
  if v_user is null or not private.has_role(v_user,'admin'::public.app_role) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_row from private.product_plan_operations where product_plan_id=p_plan_id and delivery_mode='purincash_supplier';
  if not found then raise exception 'SUPPLIER_BINDING_NOT_FOUND'; end if;
  return jsonb_build_object(
    'plan_id',v_row.product_plan_id,'supplier_provider',v_row.supplier_provider,
    'supplier_product_id',v_row.supplier_product_id,'supplier_variation_id',v_row.supplier_variation_id,
    'supplier_variation_index',v_row.automation_flags->>'supplier_variation_index',
    'supplier_store_product_id',v_row.automation_flags->>'supplier_store_product_id'
  );
end;
$$;

revoke all on function public.admin_get_purincash_supplier_binding(uuid) from public,anon;
grant execute on function public.admin_get_purincash_supplier_binding(uuid) to authenticated;

create or replace function public.admin_sync_purincash_supplier_binding(
  p_plan_id uuid,p_supplier_product_id text,p_supplier_variation_id text,p_supplier_variation_index integer,
  p_supplier_store_product_id text,p_supplier_display_name text,p_supplier_variation_name text,
  p_catalog_price_cents integer,p_stock integer,p_unlimited boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin'::public.app_role) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_supplier_product_id !~ '^prod_[A-Za-z0-9_-]+$'
     or p_supplier_variation_index is null or p_supplier_variation_index<0
     or p_catalog_price_cents is null or p_catalog_price_cents<0
     or (p_stock is not null and p_stock<0) then raise exception 'INVALID_SUPPLIER_BINDING'; end if;

  update private.product_plan_operations
  set supplier_provider='purincash',supplier_product_id=p_supplier_product_id,
      supplier_variation_id=nullif(left(btrim(coalesce(p_supplier_variation_id,'')),200),''),
      automation_flags=coalesce(automation_flags,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'auto_delivery',true,'supplier_variation_index',p_supplier_variation_index,
        'supplier_store_product_id',nullif(left(btrim(coalesce(p_supplier_store_product_id,'')),200),''),
        'supplier_display_name',nullif(left(btrim(coalesce(p_supplier_display_name,'')),160),''),
        'supplier_variation_name',nullif(left(btrim(coalesce(p_supplier_variation_name,'')),160),''),
        'supplier_catalog_price_cents',p_catalog_price_cents,'supplier_stock',p_stock,
        'supplier_unlimited',coalesce(p_unlimited,false),'supplier_sync_status','synced','supplier_last_synced_at',now()
      )),updated_at=now()
  where product_plan_id=p_plan_id and delivery_mode='purincash_supplier';
  if not found then raise exception 'SUPPLIER_BINDING_NOT_FOUND'; end if;
  return true;
end;
$$;

revoke all on function public.admin_sync_purincash_supplier_binding(uuid,text,text,integer,text,text,text,integer,integer,boolean) from public,anon;
grant execute on function public.admin_sync_purincash_supplier_binding(uuid,text,text,integer,text,text,text,integer,integer,boolean) to authenticated;

create or replace function public.claim_external_paid_delivery(
  p_payment_id uuid,p_user_id uuid,p_product_id uuid,p_product_plan_id uuid,
  p_item_index integer,p_unit_index integer,p_provider_payment_id text,p_payload text
)
returns table(ticket_id uuid,library_delivery_id uuid,created boolean)
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_ticket_id uuid; v_library_id uuid; v_entitlement_id uuid;
  v_created boolean:=false; v_payload text:=btrim(coalesce(p_payload,''));
begin
  if p_payment_id is null or p_user_id is null or p_product_id is null or p_product_plan_id is null then raise exception 'EXTERNAL_DELIVERY_IDS_REQUIRED'; end if;
  if p_item_index<0 or p_unit_index<0 then raise exception 'INVALID_DELIVERY_COORDINATES'; end if;
  if v_payload='' or char_length(v_payload)>200000 then raise exception 'INVALID_EXTERNAL_DELIVERY_PAYLOAD'; end if;
  if not exists(select 1 from public.payments where id=p_payment_id and user_id=p_user_id and status in ('FULFILLING','COMPLETED')) then
    raise exception 'PAYMENT_NOT_READY_FOR_EXTERNAL_DELIVERY';
  end if;
  if not exists(
    select 1 from public.product_plans pp
    join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
    where pp.id=p_product_plan_id and pp.product_id=p_product_id
      and ppo.delivery_mode='purincash_supplier' and ppo.supplier_provider='purincash'
  ) then raise exception 'SUPPLIER_PLAN_NOT_FOUND'; end if;

  select id into v_ticket_id from public.order_tickets
  where payment_id=p_payment_id and payment_item_index=p_item_index and payment_unit_index=p_unit_index
  limit 1 for update;

  if v_ticket_id is null then
    insert into public.order_tickets(
      user_id,product_id,product_plan_id,stock_item_id,status,status_label,metadata,
      payment_id,payment_item_index,payment_unit_index
    ) values(
      p_user_id,p_product_id,p_product_plan_id,null,'delivered','Entregue',
      jsonb_build_object('payment_id',p_payment_id,'delivery_mode','purincash_supplier'),
      p_payment_id,p_item_index,p_unit_index
    ) returning id into v_ticket_id;
    v_created:=true;
  else
    update public.order_tickets
    set status='delivered',status_label='Entregue',
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'delivery_mode','purincash_supplier'
        ),updated_at=now()
    where id=v_ticket_id;
  end if;

  select id into v_entitlement_id from public.entitlements where source_order_ticket_id=v_ticket_id limit 1;

  insert into public.library_deliveries(
    user_id,delivery_type,product_id,product_plan_id,entitlement_id,
    source_order_ticket_id,status,delivered_at,metadata,updated_at
  ) values(
    p_user_id,'key',p_product_id,p_product_plan_id,v_entitlement_id,
    v_ticket_id,'available',now(),jsonb_build_object('delivery_mode','automatic'),now()
  )
  on conflict(source_order_ticket_id)
  do update set
    entitlement_id=coalesce(public.library_deliveries.entitlement_id,excluded.entitlement_id),
    product_id=excluded.product_id,product_plan_id=excluded.product_plan_id,
    status=case when public.library_deliveries.status in ('revoked','refunded','disputed')
      then public.library_deliveries.status else 'available' end,
    updated_at=now()
  returning id into v_library_id;

  insert into private.library_delivery_secrets(delivery_id,payload,payload_format,updated_at)
  values(v_library_id,v_payload,'text',now())
  on conflict(delivery_id) do nothing;

  return query select v_ticket_id,v_library_id,v_created;
end;
$$;

revoke all on function public.claim_external_paid_delivery(uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.claim_external_paid_delivery(uuid,uuid,uuid,uuid,integer,integer,text,text) to service_role;

create or replace function private.refresh_fulfillment_run(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_payment public.payments; v_run public.fulfillment_runs; v_tickets integer;
  v_delivered integer; v_manual integer; v_status text;
begin
  select * into v_payment from public.payments where id=p_payment_id;
  if v_payment.id is null then return; end if;
  insert into public.fulfillment_runs(payment_id,user_id,status,planned_units,updated_at)
  values(
    v_payment.id,v_payment.user_id,
    case when v_payment.status='COMPLETED' then 'completed' when v_payment.status='FULFILLING' then 'running' else 'queued' end,
    private.payment_planned_units(v_payment.id),now()
  )
  on conflict(payment_id) do update set planned_units=excluded.planned_units,updated_at=now()
  returning * into v_run;

  select count(*)::integer,
    count(*) filter(where ot.status::text in ('delivered','resolved','closed','finished','archived'))::integer,
    count(*) filter(where ot.status::text not in ('delivered','resolved','closed','finished','archived'))::integer
  into v_tickets,v_delivered,v_manual
  from public.order_tickets ot where ot.payment_id=p_payment_id;

  v_status:=case
    when v_payment.status='COMPLETED' and v_manual>0 then 'manual_review'
    when v_payment.status='COMPLETED' then 'completed'
    when v_payment.status='FULFILLING' then 'running'
    else v_run.status end;

  update public.fulfillment_runs
  set ticket_count=v_tickets,delivered_count=v_delivered,manual_count=v_manual,status=v_status,
      finished_at=case when v_status in ('completed','manual_review','refunded','disputed') then coalesce(finished_at,now()) else null end,
      updated_at=now()
  where payment_id=p_payment_id;
end;
$$;

revoke execute on function private.refresh_fulfillment_run(uuid) from public;

create or replace function public.get_public_store_catalog()
returns jsonb
language sql
stable security definer
set search_path=public,private,auth,pg_temp
as $$
  select coalesce(jsonb_agg(item order by (item->>'sort_order')::int,item->>'name'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',p.id,'slug',p.slug,'name',p.name,'description',p.description,'features_text',p.features_text,
      'image_url',p.image_url,'is_new',p.is_new,'status',p.status,'status_label',p.status_label,
      'emoji',p.emoji,'accent_color',p.accent_color,'sort_order',p.sort_order,'created_at',p.created_at,
      'game',jsonb_build_object(
        'id',g.id,'name',g.name,'slug',g.slug,'description',g.description,'image_url',g.image_url,
        'icon_url',g.icon_url,'emoji',g.emoji,'accent_color',g.accent_color
      ),
      'plans',coalesce(plans.items,'[]'::jsonb),
      'media',coalesce(media.items,'[]'::jsonb),
      'features',coalesce(features.items,'[]'::jsonb)
    ) as item
    from public.products p
    join public.games g on g.id=p.game_id and g.active=true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id',z.id,'name',z.name,'price',z.price,'plan_code',z.plan_code,'sort_order',z.sort_order,
          'show_when_out_of_stock',z.show_when_out_of_stock,'emoji',z.emoji,'accent_color',z.accent_color,
          'delivery_mode',z.delivery_mode,'stock_managed',z.stock_managed,'stock_count',z.stock_count
        ) order by z.sort_order,z.name
      ) as items
      from (
        select
          pp.id,pp.name,pp.price,pp.plan_code,pp.sort_order,pp.show_when_out_of_stock,pp.emoji,pp.accent_color,
          coalesce(ppo.delivery_mode,'internal_stock') as delivery_mode,
          coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' as stock_managed,
          case when coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' then (
            select count(*)::int from public.stock_items si
            where si.product_plan_id=pp.id and si.used=false and si.disabled=false
              and not exists(
                select 1 from public.stock_reservations sr
                where sr.stock_item_id=si.id and sr.status='reserved' and sr.expires_at>now()
              )
          ) else null end as stock_count,
          case
            when coalesce(ppo.delivery_mode,'internal_stock')<>'purincash_supplier' then true
            when coalesce(ppo.automation_flags->>'supplier_sync_status','')<>'synced' then false
            when lower(coalesce(ppo.automation_flags->>'supplier_unlimited','false'))='true' then true
            when coalesce(ppo.automation_flags->>'supplier_stock','') ~ '^[0-9]+$'
              then (ppo.automation_flags->>'supplier_stock')::integer>0
            else false
          end as external_available
        from public.product_plans pp
        left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
        where pp.product_id=p.id and pp.active=true and pp.price>0 and pp.archived_at is null
      ) z
      where
        (z.delivery_mode='internal_stock' and (coalesce(z.stock_count,0)>0 or z.show_when_out_of_stock=true))
        or (z.delivery_mode='purincash_supplier' and z.external_available=true)
        or (z.delivery_mode not in ('internal_stock','purincash_supplier'))
    ) plans on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('id',pm.id,'media_type',pm.media_type,'url',pm.url,'sort_order',pm.sort_order)
        order by pm.sort_order,pm.created_at) as items
      from public.product_media pm where pm.product_id=p.id
    ) media on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('id',pf.id,'label',pf.label,'value',pf.value,'sort_order',pf.sort_order)
        order by pf.sort_order,pf.created_at) as items
      from public.product_features pf where pf.product_id=p.id
    ) features on true
    where p.active=true
  ) q;
$$;
