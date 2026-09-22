-- M25 CRAZZY PRODUCT MANAGER - FINALIZE
-- Moves operational/supplier configuration out of public commerce tables,
-- adds create flows, and makes manager RPCs SECURITY INVOKER + admin/RLS guarded.

create schema if not exists private;

create table if not exists private.product_operations (
  product_id uuid primary key references public.products(id) on delete cascade,
  automation_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists private.product_plan_operations (
  product_plan_id uuid primary key references public.product_plans(id) on delete cascade,
  delivery_mode text not null default 'manual'
    check (delivery_mode in ('internal_stock','purincash_supplier','lzt_account','manual','service')),
  discord_role_id text,
  discord_role_name text,
  discord_role_color text
    check (discord_role_color is null or discord_role_color ~ '^#[0-9A-Fa-f]{6}$'),
  discord_role_position integer
    check (discord_role_position is null or discord_role_position >= 0),
  entitlement_duration_minutes integer
    check (entitlement_duration_minutes is null or entitlement_duration_minutes > 0),
  supplier_provider text,
  supplier_product_id text,
  supplier_variation_id text,
  automation_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table private.product_operations enable row level security;
alter table private.product_plan_operations enable row level security;

revoke all on private.product_operations from public, anon, authenticated;
revoke all on private.product_plan_operations from public, anon, authenticated;

grant usage on schema private to authenticated;
grant select,insert,update,delete on private.product_operations to authenticated;
grant select,insert,update,delete on private.product_plan_operations to authenticated;

drop policy if exists "Admins manage product operations" on private.product_operations;
create policy "Admins manage product operations"
on private.product_operations
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage product plan operations" on private.product_plan_operations;
create policy "Admins manage product plan operations"
on private.product_plan_operations
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

-- Migrate any M25 draft data that was temporarily stored on public tables.
insert into private.product_operations(product_id,automation_flags,updated_at)
select id,coalesce(automation_flags,'{}'::jsonb),now()
from public.products
on conflict(product_id) do update
set automation_flags=excluded.automation_flags,
    updated_at=now();

insert into private.product_plan_operations(
  product_plan_id,
  delivery_mode,
  discord_role_id,
  discord_role_name,
  discord_role_color,
  discord_role_position,
  entitlement_duration_minutes,
  supplier_provider,
  supplier_product_id,
  supplier_variation_id,
  automation_flags,
  updated_at
)
select
  id,
  coalesce(delivery_mode,'manual'),
  discord_role_id,
  discord_role_name,
  discord_role_color,
  discord_role_position,
  entitlement_duration_minutes,
  supplier_provider,
  supplier_product_id,
  supplier_variation_id,
  coalesce(automation_flags,'{}'::jsonb),
  now()
from public.product_plans
on conflict(product_plan_id) do update
set delivery_mode=excluded.delivery_mode,
    discord_role_id=excluded.discord_role_id,
    discord_role_name=excluded.discord_role_name,
    discord_role_color=excluded.discord_role_color,
    discord_role_position=excluded.discord_role_position,
    entitlement_duration_minutes=excluded.entitlement_duration_minutes,
    supplier_provider=excluded.supplier_provider,
    supplier_product_id=excluded.supplier_product_id,
    supplier_variation_id=excluded.supplier_variation_id,
    automation_flags=excluded.automation_flags,
    updated_at=now();

-- Operational mappings are intentionally removed from public REST-readable tables.
alter table public.products
  drop column if exists automation_flags;

alter table public.product_plans
  drop column if exists delivery_mode,
  drop column if exists discord_role_id,
  drop column if exists discord_role_name,
  drop column if exists discord_role_color,
  drop column if exists discord_role_position,
  drop column if exists entitlement_duration_minutes,
  drop column if exists supplier_provider,
  drop column if exists supplier_product_id,
  drop column if exists supplier_variation_id,
  drop column if exists automation_flags;

drop function if exists public.save_product_manager_product(
  uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]
);

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

create or replace function public.create_product_manager_product(
  p_game_id uuid,
  p_name text,
  p_emoji text default null,
  p_accent_color text default null,
  p_create_default_plans boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products;
  v_plan_id uuid;
  v_plan record;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 120 then
    raise exception 'INVALID_PRODUCT_NAME';
  end if;

  if not exists(select 1 from public.games g where g.id=p_game_id) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  insert into public.products(
    game_id,name,description,features_text,image_url,is_new,active,sort_order,
    status,status_label,emoji,accent_color
  )
  values(
    p_game_id,btrim(p_name),null,null,null,true,false,
    coalesce((select max(sort_order)+1 from public.products),0),
    'undetected','Indetectável',
    nullif(btrim(coalesce(p_emoji,'')),''),
    upper(nullif(btrim(coalesce(p_accent_color,'')),''))
  )
  returning * into v_product;

  insert into private.product_operations(product_id,automation_flags)
  values(v_product.id,'{}'::jsonb)
  on conflict(product_id) do nothing;

  if coalesce(p_create_default_plans,true) then
    for v_plan in
      select *
      from (values
        ('1d','1 Dia',1440,10),
        ('3d','3 Dias',4320,20),
        ('7d','7 Dias',10080,30),
        ('15d','15 Dias',21600,40),
        ('30d','30 Dias',43200,50),
        ('90d','90 Dias',129600,60),
        ('lifetime','Lifetime',null::integer,70)
      ) as defaults(plan_code,plan_name,duration_minutes,sort_order)
    loop
      insert into public.product_plans(
        product_id,name,price,active,sort_order,plan_code,show_when_out_of_stock,
        emoji,accent_color
      )
      values(
        v_product.id,v_plan.plan_name,0,false,v_plan.sort_order,v_plan.plan_code,false,
        nullif(btrim(coalesce(p_emoji,'')),''),
        upper(nullif(btrim(coalesce(p_accent_color,'')),''))
      )
      returning id into v_plan_id;

      insert into private.product_plan_operations(
        product_plan_id,delivery_mode,entitlement_duration_minutes,automation_flags
      )
      values(
        v_plan_id,'manual',v_plan.duration_minutes,
        jsonb_build_object(
          'auto_delivery',false,
          'auto_discord_role',false,
          'auto_tutorial_unlock',false,
          'auto_expire',v_plan.duration_minutes is not null
        )
      );
    end loop;
  end if;

  return jsonb_build_object(
    'id',v_product.id,
    'name',v_product.name,
    'active',v_product.active
  );
end;
$$;

create or replace function public.create_product_manager_plan(
  p_product_id uuid,
  p_name text,
  p_plan_code text,
  p_price numeric default 0
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
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

  if p_plan_code not in ('1d','3d','7d','15d','30d','90d','lifetime','single','custom') then
    raise exception 'INVALID_PLAN_CODE';
  end if;

  if p_price is null or p_price < 0 or p_price > 1000000 then
    raise exception 'INVALID_PRICE';
  end if;

  v_duration := case p_plan_code
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
$$;

create or replace function public.save_product_manager_product(
  p_product_id uuid,
  p_game_id uuid,
  p_name text,
  p_description text,
  p_features_text text,
  p_image_url text,
  p_is_new boolean,
  p_active boolean,
  p_sort_order integer,
  p_status text,
  p_status_label text,
  p_emoji text,
  p_accent_color text,
  p_automation_flags jsonb,
  p_tutorial_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.products;
  v_tutorial uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 120 then
    raise exception 'INVALID_PRODUCT_NAME';
  end if;

  if not exists(select 1 from public.games g where g.id=p_game_id) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  update public.products
  set
    game_id=p_game_id,
    name=btrim(p_name),
    description=nullif(btrim(coalesce(p_description,'')),''),
    features_text=nullif(btrim(coalesce(p_features_text,'')),''),
    image_url=nullif(btrim(coalesce(p_image_url,'')),''),
    is_new=coalesce(p_is_new,false),
    active=coalesce(p_active,true),
    sort_order=coalesce(p_sort_order,0),
    status=coalesce(nullif(btrim(p_status),''),'undetected'),
    status_label=coalesce(nullif(btrim(p_status_label),''),'Indetectável'),
    emoji=nullif(btrim(coalesce(p_emoji,'')),''),
    accent_color=upper(nullif(btrim(coalesce(p_accent_color,'')),'')),
    updated_at=now()
  where id=p_product_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into private.product_operations(product_id,automation_flags,updated_at)
  values(p_product_id,coalesce(p_automation_flags,'{}'::jsonb),now())
  on conflict(product_id) do update
  set automation_flags=excluded.automation_flags,
      updated_at=now();

  delete from public.academy_tutorial_products
  where product_id=p_product_id;

  foreach v_tutorial in array coalesce(p_tutorial_ids,'{}'::uuid[]) loop
    insert into public.academy_tutorial_products(tutorial_id,product_id)
    values(v_tutorial,p_product_id)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id',v_row.id,'updated_at',v_row.updated_at);
end;
$$;

create or replace function public.save_product_manager_plan(
  p_plan_id uuid,
  p_name text,
  p_price numeric,
  p_active boolean,
  p_sort_order integer,
  p_plan_code text,
  p_show_when_out_of_stock boolean,
  p_emoji text,
  p_accent_color text,
  p_delivery_mode text,
  p_discord_role_id text,
  p_discord_role_name text,
  p_discord_role_color text,
  p_discord_role_position integer,
  p_entitlement_duration_minutes integer,
  p_supplier_provider text,
  p_supplier_product_id text,
  p_supplier_variation_id text,
  p_automation_flags jsonb,
  p_tutorial_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.product_plans;
  v_tutorial uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 80 then
    raise exception 'INVALID_PLAN_NAME';
  end if;

  if p_price is null or p_price < 0 or p_price > 1000000 then
    raise exception 'INVALID_PRICE';
  end if;

  if p_delivery_mode not in ('internal_stock','purincash_supplier','lzt_account','manual','service') then
    raise exception 'INVALID_DELIVERY_MODE';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  if p_discord_role_color is not null and p_discord_role_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_DISCORD_ROLE_COLOR';
  end if;

  update public.product_plans
  set
    name=btrim(p_name),
    price=p_price,
    active=coalesce(p_active,true),
    sort_order=coalesce(p_sort_order,0),
    plan_code=nullif(btrim(coalesce(p_plan_code,'')),''),
    show_when_out_of_stock=coalesce(p_show_when_out_of_stock,false),
    emoji=nullif(btrim(coalesce(p_emoji,'')),''),
    accent_color=upper(nullif(btrim(coalesce(p_accent_color,'')),''))
  where id=p_plan_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  insert into private.product_plan_operations(
    product_plan_id,
    delivery_mode,
    discord_role_id,
    discord_role_name,
    discord_role_color,
    discord_role_position,
    entitlement_duration_minutes,
    supplier_provider,
    supplier_product_id,
    supplier_variation_id,
    automation_flags,
    updated_at
  )
  values(
    p_plan_id,
    p_delivery_mode,
    nullif(btrim(coalesce(p_discord_role_id,'')),''),
    nullif(btrim(coalesce(p_discord_role_name,'')),''),
    upper(nullif(btrim(coalesce(p_discord_role_color,'')),''),
    p_discord_role_position,
    p_entitlement_duration_minutes,
    nullif(btrim(coalesce(p_supplier_provider,'')),''),
    nullif(btrim(coalesce(p_supplier_product_id,'')),''),
    nullif(btrim(coalesce(p_supplier_variation_id,'')),''),
    coalesce(p_automation_flags,'{}'::jsonb),
    now()
  )
  on conflict(product_plan_id) do update
  set delivery_mode=excluded.delivery_mode,
      discord_role_id=excluded.discord_role_id,
      discord_role_name=excluded.discord_role_name,
      discord_role_color=excluded.discord_role_color,
      discord_role_position=excluded.discord_role_position,
      entitlement_duration_minutes=excluded.entitlement_duration_minutes,
      supplier_provider=excluded.supplier_provider,
      supplier_product_id=excluded.supplier_product_id,
      supplier_variation_id=excluded.supplier_variation_id,
      automation_flags=excluded.automation_flags,
      updated_at=now();

  delete from public.academy_tutorial_plans
  where product_plan_id=p_plan_id;

  foreach v_tutorial in array coalesce(p_tutorial_ids,'{}'::uuid[]) loop
    insert into public.academy_tutorial_plans(tutorial_id,product_plan_id)
    values(v_tutorial,p_plan_id)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id',v_row.id);
end;
$$;

revoke execute on function public.get_product_manager_catalog() from public,anon;
revoke execute on function public.create_product_manager_product(uuid,text,text,text,boolean) from public,anon;
revoke execute on function public.create_product_manager_plan(uuid,text,text,numeric) from public,anon;
revoke execute on function public.save_product_manager_product(uuid,uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]) from public,anon;
revoke execute on function public.save_product_manager_plan(uuid,text,numeric,boolean,integer,text,boolean,text,text,text,text,text,text,integer,integer,text,text,text,jsonb,uuid[]) from public,anon;

grant execute on function public.get_product_manager_catalog() to authenticated;
grant execute on function public.create_product_manager_product(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.create_product_manager_plan(uuid,text,text,numeric) to authenticated;
grant execute on function public.save_product_manager_product(uuid,uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]) to authenticated;
grant execute on function public.save_product_manager_plan(uuid,text,numeric,boolean,integer,text,boolean,text,text,text,text,text,text,integer,integer,text,text,text,jsonb,uuid[]) to authenticated;
