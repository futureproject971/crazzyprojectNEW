-- CRAZZY PROJECT NEW • PurinCash hardening + Discord-presence gate for CRAZZY SCREEN ENGINE

alter table public.voice_settings
  add column if not exists media_grace_seconds integer not null default 20;

alter table public.voice_members
  add column if not exists media_left_at timestamptz;

alter table public.voice_settings
  drop constraint if exists voice_settings_media_grace_seconds_check;

alter table public.voice_settings
  add constraint voice_settings_media_grace_seconds_check
  check (media_grace_seconds between 5 and 60);

update public.voice_settings
set media_grace_seconds = greatest(5, least(60, coalesce(media_grace_seconds, 20)))
where id = true;

create or replace function public.check_call_voice_presence(p_call_room_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_voice_room public.voice_rooms%rowtype;
  v_discord_user_id text;
  v_status text;
  v_presence_at timestamptz;
  v_media_left_at timestamptz;
  v_grace integer := 20;
begin
  if v_user is null then
    return false;
  end if;

  select *
  into v_voice_room
  from public.voice_rooms
  where call_room_id = p_call_room_id
    and status <> 'closed'
  order by created_at desc
  limit 1;

  if not found then
    -- Legacy/site-only CRAZZY CALL rooms are not coupled to a Discord voice room.
    return true;
  end if;

  select discord_user_id
  into v_discord_user_id
  from public.discord_identities
  where user_id = v_user
    and guild_member = true
    and guild_id = v_voice_room.guild_id
  limit 1;

  if v_discord_user_id is null then
    return false;
  end if;

  select coalesce(media_grace_seconds, 20)
  into v_grace
  from public.voice_settings
  where id = true;

  v_grace := greatest(5, least(60, coalesce(v_grace, 20)));

  select status,presence_at,media_left_at
  into v_status,v_presence_at,v_media_left_at
  from public.voice_members
  where room_id = v_voice_room.id
    and discord_user_id = v_discord_user_id
  limit 1;

  if v_status is distinct from 'accepted' then
    return false;
  end if;

  if v_presence_at is not null then
    return true;
  end if;

  return v_media_left_at is not null
    and v_media_left_at >= now() - make_interval(secs => v_grace);
end;
$$;

revoke all on function public.check_call_voice_presence(uuid) from public,anon;
grant execute on function public.check_call_voice_presence(uuid) to authenticated;

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
  if auth.role() <> 'service_role' then
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

revoke all on function public.admin_import_purincash_supplier_plans(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_import_purincash_supplier_plans(uuid,jsonb) to service_role;

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
  if auth.role() <> 'service_role' then
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

revoke all on function public.admin_bind_purincash_supplier_plan(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_bind_purincash_supplier_plan(uuid,jsonb) to service_role;

create or replace function public.admin_get_purincash_supplier_binding(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare v_user uuid:=auth.uid(); v_row private.product_plan_operations%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
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

revoke all on function public.admin_get_purincash_supplier_binding(uuid) from public,anon,authenticated;
grant execute on function public.admin_get_purincash_supplier_binding(uuid) to service_role;

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
  if auth.role() <> 'service_role' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
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

revoke all on function public.admin_sync_purincash_supplier_binding(uuid,text,text,integer,text,text,text,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.admin_sync_purincash_supplier_binding(uuid,text,text,integer,text,text,text,integer,integer,boolean) to service_role;

-- The Edge Function proves the browser user is admin, then invokes these mutations
-- with service_role. Browser sessions cannot execute the SECURITY DEFINER supplier mutators.
