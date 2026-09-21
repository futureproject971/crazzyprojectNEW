-- M22 CRAZZY ACADEMY
-- Public tutorials + entitlement-protected product tutorials + ordered block renderer.

create table if not exists public.academy_tutorials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  summary text not null default '',
  category text not null default 'Geral',
  access_type text not null default 'public'
    check (access_type in ('public','product')),
  cover_url text,
  estimated_minutes integer not null default 5 check (estimated_minutes >= 1 and estimated_minutes <= 600),
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_tutorial_products (
  tutorial_id uuid not null references public.academy_tutorials(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (tutorial_id,product_id)
);

create table if not exists public.academy_tutorial_blocks (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.academy_tutorials(id) on delete cascade,
  block_type text not null check (
    block_type in (
      'title','subtitle','text','image','video','gallery','checklist',
      'shortcut','code','file','button','info','attention','important',
      'success','separator','step'
    )
  ),
  position integer not null check (position >= 0),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutorial_id,position)
);

create table if not exists public.academy_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  tutorial_id uuid not null references public.academy_tutorials(id) on delete cascade,
  last_position integer not null default 0 check (last_position >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id,tutorial_id)
);

create index if not exists academy_tutorials_active_sort_idx
  on public.academy_tutorials(active,sort_order);

create index if not exists academy_blocks_tutorial_position_idx
  on public.academy_tutorial_blocks(tutorial_id,position);

create index if not exists academy_progress_user_idx
  on public.academy_progress(user_id,updated_at desc);

alter table public.academy_tutorials enable row level security;
alter table public.academy_tutorial_products enable row level security;
alter table public.academy_tutorial_blocks enable row level security;
alter table public.academy_progress enable row level security;

-- Direct table reads stay admin-only. Customer access goes through safe RPCs.
drop policy if exists "Admins manage academy tutorials" on public.academy_tutorials;
create policy "Admins manage academy tutorials"
on public.academy_tutorials for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage academy products" on public.academy_tutorial_products;
create policy "Admins manage academy products"
on public.academy_tutorial_products for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage academy blocks" on public.academy_tutorial_blocks;
create policy "Admins manage academy blocks"
on public.academy_tutorial_blocks for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Progress visible to owner or admin" on public.academy_progress;
create policy "Progress visible to owner or admin"
on public.academy_progress for select to authenticated
using (
  auth.uid()=user_id
  or private.has_role(auth.uid(),'admin'::app_role)
);

drop policy if exists "Progress insert owner" on public.academy_progress;
create policy "Progress insert owner"
on public.academy_progress for insert to authenticated
with check (auth.uid()=user_id);

drop policy if exists "Progress update owner" on public.academy_progress;
create policy "Progress update owner"
on public.academy_progress for update to authenticated
using (auth.uid()=user_id)
with check (auth.uid()=user_id);

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
          and exists (
            select 1
            from public.academy_tutorial_products tp
            join public.entitlements e
              on e.product_id=tp.product_id
             and e.user_id=p_user
             and e.status='active'
             and (e.expires_at is null or e.expires_at > now())
            where tp.tutorial_id=t.id
          )
        )
      )
  );
$$;

create or replace function public.get_academy_catalog()
returns jsonb
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  with source as (
    select
      t.*,
      public.academy_has_access(t.id,auth.uid()) as unlocked,
      (
        select ap.last_position
        from public.academy_progress ap
        where ap.user_id=auth.uid() and ap.tutorial_id=t.id
      ) as last_position,
      coalesce((
        select ap.completed
        from public.academy_progress ap
        where ap.user_id=auth.uid() and ap.tutorial_id=t.id
      ),false) as completed,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,
          'name',p.name,
          'image_url',p.image_url
        ) order by p.name)
        from public.academy_tutorial_products tp
        join public.products p on p.id=tp.product_id
        where tp.tutorial_id=t.id
      ),'[]'::jsonb) as products
    from public.academy_tutorials t
    where t.active=true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'slug',slug,
    'title',title,
    'subtitle',subtitle,
    'summary',summary,
    'category',category,
    'access_type',access_type,
    'cover_url',cover_url,
    'estimated_minutes',estimated_minutes,
    'featured',featured,
    'sort_order',sort_order,
    'unlocked',unlocked,
    'locked',not unlocked,
    'products',products,
    'progress',jsonb_build_object(
      'last_position',coalesce(last_position,0),
      'completed',completed
    )
  ) order by featured desc,sort_order,title),'[]'::jsonb)
  from source;
$$;

create or replace function public.get_academy_tutorial(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
stable
as $$
declare
  v_tutorial public.academy_tutorials;
  v_unlocked boolean := false;
  v_products jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_progress jsonb := jsonb_build_object('last_position',0,'completed',false);
begin
  select * into v_tutorial
  from public.academy_tutorials
  where slug=p_slug and active=true
  limit 1;

  if v_tutorial.id is null then return null; end if;

  v_unlocked := public.academy_has_access(v_tutorial.id,auth.uid());

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'name',p.name,
    'image_url',p.image_url
  ) order by p.name),'[]'::jsonb)
  into v_products
  from public.academy_tutorial_products tp
  join public.products p on p.id=tp.product_id
  where tp.tutorial_id=v_tutorial.id;

  if v_unlocked then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',b.id,
      'type',b.block_type,
      'position',b.position,
      'content',b.content
    ) order by b.position),'[]'::jsonb)
    into v_blocks
    from public.academy_tutorial_blocks b
    where b.tutorial_id=v_tutorial.id;
  end if;

  if auth.uid() is not null then
    select jsonb_build_object(
      'last_position',coalesce(ap.last_position,0),
      'completed',coalesce(ap.completed,false)
    )
    into v_progress
    from public.academy_progress ap
    where ap.user_id=auth.uid()
      and ap.tutorial_id=v_tutorial.id;

    if v_progress is null then
      v_progress := jsonb_build_object('last_position',0,'completed',false);
    end if;
  end if;

  return jsonb_build_object(
    'id',v_tutorial.id,
    'slug',v_tutorial.slug,
    'title',v_tutorial.title,
    'subtitle',v_tutorial.subtitle,
    'summary',v_tutorial.summary,
    'category',v_tutorial.category,
    'access_type',v_tutorial.access_type,
    'cover_url',v_tutorial.cover_url,
    'estimated_minutes',v_tutorial.estimated_minutes,
    'featured',v_tutorial.featured,
    'unlocked',v_unlocked,
    'locked',not v_unlocked,
    'products',v_products,
    'blocks',v_blocks,
    'progress',v_progress
  );
end;
$$;

create or replace function public.save_academy_progress(
  p_slug text,
  p_last_position integer,
  p_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tutorial uuid;
  v_max_position integer := 0;
  v_position integer := greatest(0,coalesce(p_last_position,0));
  v_completed boolean := coalesce(p_completed,false);
  v_row public.academy_progress;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select id into v_tutorial
  from public.academy_tutorials
  where slug=p_slug and active=true
  limit 1;

  if v_tutorial is null then raise exception 'TUTORIAL_NOT_FOUND'; end if;
  if not public.academy_has_access(v_tutorial,v_user) then raise exception 'ACCESS_DENIED'; end if;

  select coalesce(max(position),0) into v_max_position
  from public.academy_tutorial_blocks
  where tutorial_id=v_tutorial;

  v_position := least(v_position,v_max_position);

  insert into public.academy_progress(
    user_id,tutorial_id,last_position,completed,completed_at,updated_at
  )
  values(
    v_user,
    v_tutorial,
    v_position,
    v_completed,
    case when v_completed then now() else null end,
    now()
  )
  on conflict (user_id,tutorial_id) do update set
    last_position=greatest(public.academy_progress.last_position,excluded.last_position),
    completed=public.academy_progress.completed or excluded.completed,
    completed_at=case
      when public.academy_progress.completed_at is not null then public.academy_progress.completed_at
      when excluded.completed then now()
      else null
    end,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'last_position',v_row.last_position,
    'completed',v_row.completed,
    'completed_at',v_row.completed_at,
    'updated_at',v_row.updated_at
  );
end;
$$;

revoke all on function public.academy_has_access(uuid,uuid) from public;
revoke all on function public.get_academy_catalog() from public;
revoke all on function public.get_academy_tutorial(text) from public;
revoke all on function public.save_academy_progress(text,integer,boolean) from public;

revoke execute on function public.academy_has_access(uuid,uuid) from anon,authenticated;
grant execute on function public.academy_has_access(uuid,uuid) to service_role;

grant execute on function public.get_academy_catalog() to anon,authenticated;
grant execute on function public.get_academy_tutorial(text) to anon,authenticated;
grant execute on function public.save_academy_progress(text,integer,boolean) to authenticated;

-- Useful public tutorial seeded as real content.
insert into public.academy_tutorials(
  slug,title,subtitle,summary,category,access_type,estimated_minutes,featured,active,sort_order
)
values(
  'primeiros-passos',
  'Primeiros passos na CRAZZY PROJECT',
  'Compra, biblioteca, suporte e benefícios em um fluxo simples.',
  'Entenda onde encontrar produtos, acompanhar suas compras, acessar conteúdos liberados e pedir ajuda.',
  'Comece aqui',
  'public',
  4,
  true,
  true,
  0
)
on conflict (slug) do update set
  title=excluded.title,
  subtitle=excluded.subtitle,
  summary=excluded.summary,
  category=excluded.category,
  access_type=excluded.access_type,
  estimated_minutes=excluded.estimated_minutes,
  featured=excluded.featured,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

with tutorial as (
  select id from public.academy_tutorials where slug='primeiros-passos'
),
blocks(position,block_type,content) as (
  values
    (0,'title','{"text":"Bem-vindo à CRAZZY PROJECT"}'::jsonb),
    (1,'text','{"text":"A área pública mostra produtos, contas, comunidade e recursos do CLUB. Quando você entra na sua conta, o site libera as áreas vinculadas ao seu perfil e às suas compras."}'::jsonb),
    (2,'step','{"number":1,"title":"Escolha o que deseja","text":"Abra Produtos, Combo ou Contas, confira os detalhes e adicione ao carrinho."}'::jsonb),
    (3,'step','{"number":2,"title":"Finalize pelo checkout","text":"No checkout você revisa o pedido, cupom e forma de pagamento antes de confirmar."}'::jsonb),
    (4,'step','{"number":3,"title":"Acompanhe no painel","text":"Depois da confirmação, use sua área de cliente para acompanhar produtos, entregas, biblioteca e tutoriais liberados."}'::jsonb),
    (5,'info','{"title":"Dica","text":"Cupons ganhos no CRAZZY LUCK aparecem em Meus Cupons e podem ser aplicados direto no carrinho."}'::jsonb),
    (6,'checklist','{"items":[{"text":"Conta criada e login funcionando"},{"text":"Pedido revisado antes do pagamento"},{"text":"Painel e biblioteca conferidos após a compra"},{"text":"Ticket aberto caso precise de ajuda"}]}'::jsonb),
    (7,'separator','{}'::jsonb),
    (8,'button','{"label":"Ver produtos","url":"/produtos","variant":"primary"}'::jsonb),
    (9,'button','{"label":"Abrir CRAZZY CLUB","url":"/club","variant":"secondary"}'::jsonb)
)
insert into public.academy_tutorial_blocks(tutorial_id,position,block_type,content)
select t.id,b.position,b.block_type,b.content
from tutorial t
cross join blocks b
on conflict (tutorial_id,position) do update set
  block_type=excluded.block_type,
  content=excluded.content,
  updated_at=now();
