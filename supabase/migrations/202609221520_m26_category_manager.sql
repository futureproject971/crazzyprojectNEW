-- M26 CRAZZY CATEGORY MANAGER
-- Makes games/categories editable and exposes a sanitized public category directory.

alter table public.games
  add column if not exists description text,
  add column if not exists icon_url text,
  add column if not exists emoji text,
  add column if not exists accent_color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='games_accent_color_check'
  ) then
    alter table public.games
      add constraint games_accent_color_check
      check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname='games_slug_format_check'
  ) then
    alter table public.games
      add constraint games_slug_format_check
      check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
end $$;

create or replace function public.get_public_categories()
returns jsonb
language sql
security invoker
set search_path=public,pg_temp
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',g.id,
      'name',g.name,
      'slug',g.slug,
      'description',g.description,
      'image_url',g.image_url,
      'icon_url',g.icon_url,
      'emoji',g.emoji,
      'accent_color',g.accent_color,
      'sort_order',g.sort_order,
      'product_count',(
        select count(*)::int
        from public.products p
        where p.game_id=g.id
          and p.active=true
      )
    )
    order by g.sort_order,g.name
  ),'[]'::jsonb)
  from public.games g
  where g.active=true;
$$;

create or replace function public.get_category_manager_catalog()
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return (
    select jsonb_build_object(
      'categories',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id',g.id,
          'name',g.name,
          'slug',g.slug,
          'description',g.description,
          'image_url',g.image_url,
          'icon_url',g.icon_url,
          'emoji',g.emoji,
          'accent_color',g.accent_color,
          'active',g.active,
          'sort_order',g.sort_order,
          'product_count',(
            select count(*)::int from public.products p where p.game_id=g.id
          ),
          'active_product_count',(
            select count(*)::int from public.products p where p.game_id=g.id and p.active=true
          )
        )
        order by g.sort_order,g.name
      ),'[]'::jsonb)
    )
    from public.games g
  );
end;
$$;

create or replace function public.create_category_manager_category(
  p_name text,
  p_slug text,
  p_description text default null,
  p_image_url text default null,
  p_icon_url text default null,
  p_emoji text default null,
  p_accent_color text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.games;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 100 then
    raise exception 'INVALID_CATEGORY_NAME';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 100 then
    raise exception 'INVALID_CATEGORY_SLUG';
  end if;

  if exists(select 1 from public.games where slug=p_slug) then
    raise exception 'CATEGORY_SLUG_EXISTS';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  insert into public.games(
    name,slug,description,image_url,icon_url,emoji,accent_color,active,sort_order
  )
  values(
    btrim(p_name),
    p_slug,
    nullif(btrim(coalesce(p_description,'')),''),
    nullif(btrim(coalesce(p_image_url,'')),''),
    nullif(btrim(coalesce(p_icon_url,'')),''),
    nullif(btrim(coalesce(p_emoji,'')),''),
    upper(nullif(btrim(coalesce(p_accent_color,'')),'')),
    false,
    coalesce((select max(sort_order)+1 from public.games),0)
  )
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'name',v_row.name,
    'slug',v_row.slug,
    'active',v_row.active
  );
end;
$$;

create or replace function public.save_category_manager_category(
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_image_url text,
  p_icon_url text,
  p_emoji text,
  p_accent_color text,
  p_active boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.games;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 100 then
    raise exception 'INVALID_CATEGORY_NAME';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 100 then
    raise exception 'INVALID_CATEGORY_SLUG';
  end if;

  if exists(
    select 1 from public.games
    where slug=p_slug and id<>p_category_id
  ) then
    raise exception 'CATEGORY_SLUG_EXISTS';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  update public.games
  set
    name=btrim(p_name),
    slug=p_slug,
    description=nullif(btrim(coalesce(p_description,'')),''),
    image_url=nullif(btrim(coalesce(p_image_url,'')),''),
    icon_url=nullif(btrim(coalesce(p_icon_url,'')),''),
    emoji=nullif(btrim(coalesce(p_emoji,'')),''),
    accent_color=upper(nullif(btrim(coalesce(p_accent_color,'')),'')),
    active=coalesce(p_active,false),
    sort_order=greatest(-100000,least(100000,coalesce(p_sort_order,0)))
  where id=p_category_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'name',v_row.name,
    'slug',v_row.slug,
    'active',v_row.active
  );
end;
$$;

revoke execute on function public.get_public_categories() from public;
revoke execute on function public.get_category_manager_catalog() from public,anon;
revoke execute on function public.create_category_manager_category(text,text,text,text,text,text,text) from public,anon;
revoke execute on function public.save_category_manager_category(uuid,text,text,text,text,text,text,text,boolean,integer) from public,anon;

grant execute on function public.get_public_categories() to anon,authenticated;
grant execute on function public.get_category_manager_catalog() to authenticated;
grant execute on function public.create_category_manager_category(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.save_category_manager_category(uuid,text,text,text,text,text,text,text,boolean,integer) to authenticated;
