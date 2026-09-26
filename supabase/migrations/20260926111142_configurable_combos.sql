-- Discount rules visible to customers, editable only by administrators.
create table public.commerce_combo_settings (
 id boolean primary key default true check (id),
 discounts integer[] not null default array[10,15,20,25,30,35],
 updated_at timestamptz not null default now(),
 constraint valid_combo_discounts check (
   array_ndims(discounts)=1 and array_lower(discounts,1)=1 and cardinality(discounts)=6
   and array_position(discounts,null) is null and discounts[1]>=0 and discounts[6]<=99
   and discounts[1]<=discounts[2] and discounts[2]<=discounts[3]
   and discounts[3]<=discounts[4] and discounts[4]<=discounts[5] and discounts[5]<=discounts[6]
 )
);
insert into public.commerce_combo_settings(id) values(true);
alter table public.commerce_combo_settings enable row level security;
revoke all on public.commerce_combo_settings from anon, authenticated;
grant select on public.commerce_combo_settings to anon, authenticated;
grant update(discounts,updated_at) on public.commerce_combo_settings to authenticated;
grant all on public.commerce_combo_settings to service_role;
create policy combo_rules_read on public.commerce_combo_settings for select to anon, authenticated using(true);
create policy combo_rules_admin on public.commerce_combo_settings for update to authenticated
 using ((select public.is_current_admin())) with check ((select public.is_current_admin()));

-- New plans deliver from real stock and start paused.
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
    p_product_id,btrim(p_name),p_price,true,
    coalesce((select max(pp.sort_order)+1 from public.product_plans pp where pp.product_id=p_product_id),0),
    p_plan_code,false
  )
  returning * into v_plan;

  insert into private.product_plan_operations(
    product_plan_id,delivery_mode,entitlement_duration_minutes,automation_flags
  )
  values(
    v_plan.id,'internal_stock',v_duration,
    jsonb_build_object(
      'auto_delivery',true,
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
