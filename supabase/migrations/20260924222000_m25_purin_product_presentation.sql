-- M25 CRAZZY PRODUCT MANAGER - Purin-style presentation fields
-- Adds separate icon/banner media and a product-level delivery badge visibility flag
-- while keeping image_url as the storefront-compatible banner fallback.

alter table public.products
  add column if not exists icon_url text,
  add column if not exists banner_url text,
  add column if not exists hide_delivery_badge boolean not null default false;

update public.products
set banner_url = image_url
where banner_url is null
  and image_url is not null;

create or replace function public.get_product_manager_catalog()
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select jsonb_build_object(
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'name',p.name,
        'game_id',p.game_id,
        'game_name',g.name,
        'description',p.description,
        'features_text',p.features_text,
        'image_url',p.image_url,
        'icon_url',p.icon_url,
        'banner_url',p.banner_url,
        'hide_delivery_badge',p.hide_delivery_badge,
        'is_new',p.is_new,
        'active',p.active,
        'sort_order',p.sort_order,
        'status',p.status,
        'status_label',p.status_label,
        'emoji',p.emoji,
        'accent_color',p.accent_color,
        'automation_flags',coalesce(po.automation_flags,'{}'::jsonb),
        'tutorials',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',t.id,'title',t.title,'slug',t.slug
          ) order by t.title)
          from public.academy_tutorial_products atp
          join public.academy_tutorials t on t.id=atp.tutorial_id
          where atp.product_id=p.id
        ),'[]'::jsonb),
        'plans',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',pp.id,
            'name',pp.name,
            'price',pp.price,
            'active',pp.active,
            'sort_order',pp.sort_order,
            'plan_code',pp.plan_code,
            'show_when_out_of_stock',pp.show_when_out_of_stock,
            'emoji',pp.emoji,
            'accent_color',pp.accent_color,
            'delivery_mode',coalesce(ppo.delivery_mode,'manual'),
            'discord_role_id',ppo.discord_role_id,
            'discord_role_name',ppo.discord_role_name,
            'discord_role_color',ppo.discord_role_color,
            'discord_role_position',ppo.discord_role_position,
            'entitlement_duration_minutes',ppo.entitlement_duration_minutes,
            'supplier_provider',ppo.supplier_provider,
            'supplier_product_id',ppo.supplier_product_id,
            'supplier_variation_id',ppo.supplier_variation_id,
            'automation_flags',coalesce(ppo.automation_flags,'{}'::jsonb),
            'available_stock',(
              select count(*)::int
              from public.stock_items si
              where si.product_plan_id=pp.id and si.used=false
            ),
            'tutorials',coalesce((
              select jsonb_agg(jsonb_build_object(
                'id',t.id,'title',t.title,'slug',t.slug
              ) order by t.title)
              from public.academy_tutorial_plans apl
              join public.academy_tutorials t on t.id=apl.tutorial_id
              where apl.product_plan_id=pp.id
            ),'[]'::jsonb)
          ) order by pp.sort_order,pp.name)
          from public.product_plans pp
          left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
          where pp.product_id=p.id
        ),'[]'::jsonb)
      ) order by p.sort_order,p.name)
      from public.products p
      join public.games g on g.id=p.game_id
      left join private.product_operations po on po.product_id=p.id
    ),'[]'::jsonb),
    'games',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'name',g.name,'slug',g.slug,'active',g.active
      ) order by g.sort_order,g.name)
      from public.games g
    ),'[]'::jsonb),
    'tutorials',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'title',t.title,'slug',t.slug,'active',t.active,'access_type',t.access_type
      ) order by t.title)
      from public.academy_tutorials t
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.save_product_manager_presentation(
  p_product_id uuid,
  p_description text,
  p_icon_url text,
  p_banner_url text,
  p_hide_delivery_badge boolean,
  p_auto_delivery boolean
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.products;
  v_flags jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.products
  set
    description=nullif(btrim(coalesce(p_description,'')),''),
    icon_url=nullif(btrim(coalesce(p_icon_url,'')),''),
    banner_url=nullif(btrim(coalesce(p_banner_url,'')),''),
    image_url=coalesce(
      nullif(btrim(coalesce(p_banner_url,'')),''),
      nullif(btrim(coalesce(p_icon_url,'')),''),
      image_url
    ),
    hide_delivery_badge=coalesce(p_hide_delivery_badge,false),
    updated_at=now()
  where id=p_product_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select coalesce(po.automation_flags,'{}'::jsonb)
  into v_flags
  from private.product_operations po
  where po.product_id=p_product_id;

  v_flags := coalesce(v_flags,'{}'::jsonb)
    || jsonb_build_object('auto_delivery',coalesce(p_auto_delivery,false));

  insert into private.product_operations(product_id,automation_flags,updated_at)
  values(p_product_id,v_flags,now())
  on conflict(product_id) do update
  set automation_flags=excluded.automation_flags,
      updated_at=now();

  return jsonb_build_object(
    'id',v_row.id,
    'icon_url',v_row.icon_url,
    'banner_url',v_row.banner_url,
    'hide_delivery_badge',v_row.hide_delivery_badge,
    'updated_at',v_row.updated_at
  );
end;
$$;

revoke execute on function public.save_product_manager_presentation(uuid,text,text,text,boolean,boolean)
  from public,anon;
grant execute on function public.save_product_manager_presentation(uuid,text,text,text,boolean,boolean)
  to authenticated;
