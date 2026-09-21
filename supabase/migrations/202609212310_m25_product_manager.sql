-- M25 CRAZZY PRODUCT MANAGER
-- Adds editable product/plan automation metadata without exposing secrets.

alter table public.products
  add column if not exists emoji text,
  add column if not exists accent_color text,
  add column if not exists automation_flags jsonb not null default '{}'::jsonb;

alter table public.product_plans
  add column if not exists emoji text,
  add column if not exists accent_color text,
  add column if not exists delivery_mode text not null default 'manual',
  add column if not exists discord_role_id text,
  add column if not exists discord_role_name text,
  add column if not exists discord_role_color text,
  add column if not exists discord_role_position integer,
  add column if not exists entitlement_duration_minutes integer,
  add column if not exists supplier_provider text,
  add column if not exists supplier_product_id text,
  add column if not exists supplier_variation_id text,
  add column if not exists automation_flags jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='products_accent_color_check'
  ) then
    alter table public.products
      add constraint products_accent_color_check
      check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname='product_plans_accent_color_check'
  ) then
    alter table public.product_plans
      add constraint product_plans_accent_color_check
      check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname='product_plans_discord_role_color_check'
  ) then
    alter table public.product_plans
      add constraint product_plans_discord_role_color_check
      check (discord_role_color is null or discord_role_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname='product_plans_delivery_mode_check'
  ) then
    alter table public.product_plans
      add constraint product_plans_delivery_mode_check
      check (delivery_mode in ('internal_stock','purincash_supplier','lzt_account','manual','service'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname='product_plans_entitlement_duration_check'
  ) then
    alter table public.product_plans
      add constraint product_plans_entitlement_duration_check
      check (entitlement_duration_minutes is null or entitlement_duration_minutes > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname='product_plans_discord_role_position_check'
  ) then
    alter table public.product_plans
      add constraint product_plans_discord_role_position_check
      check (discord_role_position is null or discord_role_position >= 0);
  end if;
end $$;

create table if not exists public.academy_tutorial_plans (
  tutorial_id uuid not null references public.academy_tutorials(id) on delete cascade,
  product_plan_id uuid not null references public.product_plans(id) on delete cascade,
  primary key (tutorial_id,product_plan_id)
);

alter table public.academy_tutorial_plans enable row level security;

drop policy if exists "Admins manage academy plan links" on public.academy_tutorial_plans;
create policy "Admins manage academy plan links"
on public.academy_tutorial_plans for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

create or replace function public.academy_has_access(p_tutorial uuid,p_user uuid)
returns boolean
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  select exists (
    select 1
    from public.academy_tutorials t
    where t.id=p_tutorial
      and t.active=true
      and (
        t.access_type='public'
        or (
          t.access_type='product'
          and p_user is not null
          and (
            exists (
              select 1
              from public.academy_tutorial_products tp
              join public.entitlements e
                on e.product_id=tp.product_id
               and e.user_id=p_user
               and e.status='active'
               and (e.expires_at is null or e.expires_at > now())
              where tp.tutorial_id=t.id
            )
            or exists (
              select 1
              from public.academy_tutorial_plans tpl
              join public.entitlements e
                on e.product_plan_id=tpl.product_plan_id
               and e.user_id=p_user
               and e.status='active'
               and (e.expires_at is null or e.expires_at > now())
              where tpl.tutorial_id=t.id
            )
          )
        )
      )
  );
$$;

create or replace function public.get_product_manager_catalog()
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
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
        'automation_flags',p.automation_flags,
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
            'delivery_mode',pp.delivery_mode,
            'discord_role_id',pp.discord_role_id,
            'discord_role_name',pp.discord_role_name,
            'discord_role_color',pp.discord_role_color,
            'discord_role_position',pp.discord_role_position,
            'entitlement_duration_minutes',pp.entitlement_duration_minutes,
            'supplier_provider',pp.supplier_provider,
            'supplier_product_id',pp.supplier_product_id,
            'supplier_variation_id',pp.supplier_variation_id,
            'automation_flags',pp.automation_flags,
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
          where pp.product_id=p.id
        ),'[]'::jsonb)
      ) order by p.sort_order,p.name)
      from public.products p
      join public.games g on g.id=p.game_id
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

create or replace function public.save_product_manager_product(
  p_product_id uuid,
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
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.products;
  v_tutorial uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.products
  set
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
    accent_color=nullif(btrim(coalesce(p_accent_color,'')),''),
    automation_flags=coalesce(p_automation_flags,'{}'::jsonb),
    updated_at=now()
  where id=p_product_id
  returning * into v_row;

  if v_row.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;

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
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.product_plans;
  v_tutorial uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.product_plans
  set
    name=btrim(p_name),
    price=greatest(0,coalesce(p_price,0)),
    active=coalesce(p_active,true),
    sort_order=coalesce(p_sort_order,0),
    plan_code=nullif(btrim(coalesce(p_plan_code,'')),''),
    show_when_out_of_stock=coalesce(p_show_when_out_of_stock,false),
    emoji=nullif(btrim(coalesce(p_emoji,'')),''),
    accent_color=nullif(btrim(coalesce(p_accent_color,'')),''),
    delivery_mode=coalesce(nullif(btrim(p_delivery_mode),''),'manual'),
    discord_role_id=nullif(btrim(coalesce(p_discord_role_id,'')),''),
    discord_role_name=nullif(btrim(coalesce(p_discord_role_name,'')),''),
    discord_role_color=nullif(btrim(coalesce(p_discord_role_color,'')),''),
    discord_role_position=p_discord_role_position,
    entitlement_duration_minutes=p_entitlement_duration_minutes,
    supplier_provider=nullif(btrim(coalesce(p_supplier_provider,'')),''),
    supplier_product_id=nullif(btrim(coalesce(p_supplier_product_id,'')),''),
    supplier_variation_id=nullif(btrim(coalesce(p_supplier_variation_id,'')),''),
    automation_flags=coalesce(p_automation_flags,'{}'::jsonb)
  where id=p_plan_id
  returning * into v_row;

  if v_row.id is null then raise exception 'PLAN_NOT_FOUND'; end if;

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

revoke all on function public.get_product_manager_catalog() from public;
revoke all on function public.save_product_manager_product(uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]) from public;
revoke all on function public.save_product_manager_plan(uuid,text,numeric,boolean,integer,text,boolean,text,text,text,text,text,text,integer,integer,text,text,text,jsonb,uuid[]) from public;

revoke execute on function public.get_product_manager_catalog() from anon;
revoke execute on function public.save_product_manager_product(uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]) from anon;
revoke execute on function public.save_product_manager_plan(uuid,text,numeric,boolean,integer,text,boolean,text,text,text,text,text,text,integer,integer,text,text,text,jsonb,uuid[]) from anon;

grant execute on function public.get_product_manager_catalog() to authenticated;
grant execute on function public.save_product_manager_product(uuid,text,text,text,text,boolean,boolean,integer,text,text,text,text,jsonb,uuid[]) to authenticated;
grant execute on function public.save_product_manager_plan(uuid,text,numeric,boolean,integer,text,boolean,text,text,text,text,text,text,integer,integer,text,text,text,jsonb,uuid[]) to authenticated;
