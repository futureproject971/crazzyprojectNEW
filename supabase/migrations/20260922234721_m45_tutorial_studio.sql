
create or replace function public.admin_upsert_academy_tutorial(
  p_id uuid,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_summary text,
  p_category text,
  p_access_type text,
  p_cover_url text,
  p_estimated_minutes integer,
  p_featured boolean,
  p_active boolean,
  p_sort_order integer,
  p_product_ids uuid[] default array[]::uuid[],
  p_blocks jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_tutorial public.academy_tutorials;
  v_slug text := lower(btrim(coalesce(p_slug,'')));
  v_product uuid;
  v_block jsonb;
  v_position integer := 0;
  v_type text;
  v_content jsonb;
  v_allowed text[] := array[
    'title','subtitle','text','image','video','gallery','checklist',
    'shortcut','code','file','button','info','attention','important',
    'success','separator','step'
  ];
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_slug := regexp_replace(v_slug,'[^a-z0-9]+','-','g');
  v_slug := trim(both '-' from v_slug);

  if v_slug='' or char_length(v_slug)>100 then raise exception 'INVALID_TUTORIAL_SLUG'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'TITLE_REQUIRED'; end if;
  if p_access_type not in ('public','product') then raise exception 'INVALID_ACCESS_TYPE'; end if;
  if coalesce(p_estimated_minutes,0)<1 or p_estimated_minutes>600 then raise exception 'INVALID_ESTIMATED_MINUTES'; end if;
  if jsonb_typeof(coalesce(p_blocks,'[]'::jsonb))<>'array' then raise exception 'INVALID_BLOCKS'; end if;
  if jsonb_array_length(coalesce(p_blocks,'[]'::jsonb))>200 then raise exception 'TOO_MANY_BLOCKS'; end if;

  if p_id is null then
    insert into public.academy_tutorials(
      slug,title,subtitle,summary,category,access_type,cover_url,
      estimated_minutes,featured,active,sort_order,updated_at
    ) values(
      v_slug,left(btrim(p_title),180),nullif(left(btrim(coalesce(p_subtitle,'')),300),''),
      left(coalesce(p_summary,''),2000),left(coalesce(nullif(btrim(p_category),''),'Geral'),100),
      p_access_type,nullif(left(btrim(coalesce(p_cover_url,'')),1200),''),
      p_estimated_minutes,coalesce(p_featured,false),coalesce(p_active,true),coalesce(p_sort_order,0),now()
    )
    returning * into v_tutorial;
  else
    update public.academy_tutorials
    set slug=v_slug,
        title=left(btrim(p_title),180),
        subtitle=nullif(left(btrim(coalesce(p_subtitle,'')),300),''),
        summary=left(coalesce(p_summary,''),2000),
        category=left(coalesce(nullif(btrim(p_category),''),'Geral'),100),
        access_type=p_access_type,
        cover_url=nullif(left(btrim(coalesce(p_cover_url,'')),1200),''),
        estimated_minutes=p_estimated_minutes,
        featured=coalesce(p_featured,false),
        active=coalesce(p_active,true),
        sort_order=coalesce(p_sort_order,0),
        updated_at=now()
    where id=p_id
    returning * into v_tutorial;
    if v_tutorial.id is null then raise exception 'TUTORIAL_NOT_FOUND'; end if;
  end if;

  delete from public.academy_tutorial_products
  where tutorial_id=v_tutorial.id
    and not (product_id=any(coalesce(p_product_ids,array[]::uuid[])));

  if p_access_type='product' then
    foreach v_product in array coalesce(p_product_ids,array[]::uuid[])
    loop
      if not exists(select 1 from public.products p where p.id=v_product) then
        raise exception 'PRODUCT_NOT_FOUND';
      end if;
      insert into public.academy_tutorial_products(tutorial_id,product_id)
      values(v_tutorial.id,v_product)
      on conflict do nothing;
    end loop;
  else
    delete from public.academy_tutorial_products where tutorial_id=v_tutorial.id;
  end if;

  delete from public.academy_tutorial_blocks where tutorial_id=v_tutorial.id;

  v_position := 0;
  for v_block in select value from jsonb_array_elements(coalesce(p_blocks,'[]'::jsonb))
  loop
    v_type := lower(btrim(coalesce(v_block->>'type','')));
    if not (v_type=any(v_allowed)) then raise exception 'INVALID_BLOCK_TYPE'; end if;
    v_content := coalesce(v_block->'content','{}'::jsonb);
    if jsonb_typeof(v_content)<>'object' then raise exception 'INVALID_BLOCK_CONTENT'; end if;

    insert into public.academy_tutorial_blocks(tutorial_id,block_type,position,content)
    values(v_tutorial.id,v_type,v_position,v_content);
    v_position := v_position+1;
  end loop;

  return jsonb_build_object(
    'tutorial',to_jsonb(v_tutorial),
    'product_ids',to_jsonb(case when p_access_type='product' then coalesce(p_product_ids,array[]::uuid[]) else array[]::uuid[] end),
    'block_count',v_position
  );
end;
$$;

revoke all on function public.admin_upsert_academy_tutorial(uuid,text,text,text,text,text,text,text,integer,boolean,boolean,integer,uuid[],jsonb)
from public,anon;
grant execute on function public.admin_upsert_academy_tutorial(uuid,text,text,text,text,text,text,text,integer,boolean,boolean,integer,uuid[],jsonb)
to authenticated;
