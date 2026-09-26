-- M48 UX consolidation: support a first-class 1-hour Trial preset in Product Manager.

alter table public.product_plans
  drop constraint if exists product_plans_plan_code_check;

alter table public.product_plans
  add constraint product_plans_plan_code_check
  check (
    plan_code is null
    or plan_code in ('trial','1d','3d','7d','15d','30d','90d','lifetime','single','custom')
  );

create or replace function public.create_product_manager_plan(
  p_product_id uuid,
  p_name text,
  p_plan_code text,
  p_price numeric default 0
)
returns jsonb
language plpgsql
set search_path to 'public','private','auth','pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_plan public.product_plans;
  v_duration integer;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if not exists(select 1 from public.products p where p.id=p_product_id) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 80 then
    raise exception 'INVALID_PLAN_NAME';
  end if;

  if p_plan_code not in ('trial','1d','3d','7d','15d','30d','90d','lifetime','single','custom') then
    raise exception 'INVALID_PLAN_CODE';
  end if;

  if p_price is null or p_price < 0 or p_price > 1000000 then
    raise exception 'INVALID_PRICE';
  end if;

  v_duration := case p_plan_code
    when 'trial' then 60
    when '1d' then 1440
    when '3d' then 4320
    when '7d' then 10080
    when '15d' then 21600
    when '30d' then 43200
    when '90d' then 129600
    else null
  end;

  insert into public.product_plans(
    product_id,name,price,active,sort_order,plan_code,show_when_out_of_stock
  )
  values(
    p_product_id,btrim(p_name),p_price,false,
    coalesce((select max(pp.sort_order)+1 from public.product_plans pp where pp.product_id=p_product_id),0),
    p_plan_code,false
  )
  returning * into v_plan;

  insert into private.product_plan_operations(
    product_plan_id,delivery_mode,entitlement_duration_minutes,automation_flags
  )
  values(
    v_plan.id,'manual',v_duration,
    jsonb_build_object(
      'auto_delivery',false,
      'auto_discord_role',false,
      'auto_tutorial_unlock',false,
      'auto_expire',v_duration is not null
    )
  );

  return jsonb_build_object(
    'id',v_plan.id,
    'product_id',v_plan.product_id,
    'active',v_plan.active
  );
end;
$function$;

revoke all on function public.create_product_manager_plan(uuid,text,text,numeric) from public,anon;
grant execute on function public.create_product_manager_plan(uuid,text,text,numeric) to authenticated;


-- Keep media replacement atomic: an insert failure rolls the deletion back.
create or replace function public.admin_sync_product_extras(p_product_id uuid, p_media jsonb default null, p_features jsonb default null)
returns void language plpgsql security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.products where id=p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p_media is not null then
    if jsonb_typeof(p_media)<>'array' or jsonb_array_length(p_media)>24 then raise exception 'INVALID_MEDIA'; end if;
    delete from public.product_media where product_id=p_product_id;
    insert into public.product_media(product_id,media_type,url,sort_order)
    select p_product_id,x.media_type,x.url,x.sort_order from jsonb_to_recordset(p_media) as x(media_type text,url text,sort_order integer);
  end if;
  if p_features is not null then
    if jsonb_typeof(p_features)<>'array' or jsonb_array_length(p_features)>40 then raise exception 'INVALID_FEATURES'; end if;
    delete from public.product_features where product_id=p_product_id;
    insert into public.product_features(product_id,label,value,sort_order)
    select p_product_id,x.label,x.value,x.sort_order from jsonb_to_recordset(p_features) as x(label text,value text,sort_order integer);
  end if;
end;
$$;
revoke all on function public.admin_sync_product_extras(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.admin_sync_product_extras(uuid,jsonb,jsonb) to authenticated;

-- Scope and links must change in the same transaction, never briefly becoming public.
create or replace function public.admin_save_scoped_coupon(
 p_id uuid,p_code text,p_discount_type text,p_discount_value numeric,p_max_uses integer,
 p_min_order_value numeric,p_active boolean,p_expires_at timestamptz,p_origin text,
 p_product_ids uuid[],p_user_ids uuid[],p_scope_mode text,p_category_ids uuid[]
) returns jsonb language plpgsql security invoker
set search_path = public, private, auth, pg_temp
as $$
declare v_result jsonb; v_id uuid; v_metadata jsonb;
begin
 if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_scope_mode is null or p_scope_mode not in ('all','selected','categories','exclude') then raise exception 'INVALID_SCOPE'; end if;
 if p_scope_mode='selected' and coalesce(cardinality(p_product_ids),0)=0 then raise exception 'INVALID_EMPTY_PRODUCTS'; end if;
 if p_scope_mode='categories' and coalesce(cardinality(p_category_ids),0)=0 then raise exception 'INVALID_EMPTY_CATEGORIES'; end if;
 if exists(select 1 from unnest(p_category_ids) id where not exists(select 1 from public.games g where g.id=id)) then raise exception 'INVALID_CATEGORY'; end if;
 if exists(select 1 from unnest(p_product_ids) id where not exists(select 1 from public.products p where p.id=id)) then raise exception 'INVALID_PRODUCT'; end if;
 v_result:=public.admin_upsert_coupon(p_id,p_code,p_discount_type,p_discount_value,p_max_uses,p_min_order_value,p_active,p_expires_at,p_origin,
  case when p_scope_mode='selected' then p_product_ids else array[]::uuid[] end,p_user_ids);
 v_id:=(v_result->'coupon'->>'id')::uuid;
 v_metadata:=jsonb_build_object('scope_mode',p_scope_mode,'category_ids',case when p_scope_mode='categories' then to_jsonb(p_category_ids) else '[]'::jsonb end,
 'excluded_product_ids',case when p_scope_mode='exclude' then to_jsonb(p_product_ids) else '[]'::jsonb end);
 update public.coupons set metadata=coalesce(metadata,'{}'::jsonb)||v_metadata where id=v_id;
 return jsonb_set(v_result,'{coupon,metadata}',coalesce(v_result->'coupon'->'metadata','{}'::jsonb)||v_metadata);
end;
$$;
revoke all on function public.admin_save_scoped_coupon(uuid,text,text,numeric,integer,numeric,boolean,timestamptz,text,uuid[],uuid[],text,uuid[]) from public,anon;
grant execute on function public.admin_save_scoped_coupon(uuid,text,text,numeric,integer,numeric,boolean,timestamptz,text,uuid[],uuid[],text,uuid[]) to authenticated;

-- Signed media uploads stay admin-only under existing storage policies.
update storage.buckets set file_size_limit=50331648,
 allowed_mime_types=array(select distinct unnest(coalesce(allowed_mime_types,array[]::text[])||array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']))
where id='site-branding';
