-- M21 CRAZZY STATUS
-- Public-safe operational status and incident timeline.

create table if not exists public.status_components (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text not null default '',
  state text not null default 'operational'
    check (state in ('operational','degraded','partial_outage','major_outage','maintenance')),
  message text,
  visible boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  state text not null default 'investigating'
    check (state in ('investigating','identified','monitoring','resolved')),
  impact text not null default 'minor'
    check (impact in ('none','minor','major','critical')),
  message text not null default '',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.status_incident_components (
  incident_id uuid not null references public.status_incidents(id) on delete cascade,
  component_id uuid not null references public.status_components(id) on delete cascade,
  primary key (incident_id,component_id)
);

create table if not exists public.status_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.status_incidents(id) on delete cascade,
  state text not null check (state in ('investigating','identified','monitoring','resolved')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.status_components enable row level security;
alter table public.status_incidents enable row level security;
alter table public.status_incident_components enable row level security;
alter table public.status_incident_updates enable row level security;

drop policy if exists "Public status components" on public.status_components;
create policy "Public status components"
on public.status_components for select to anon,authenticated
using (visible=true);

drop policy if exists "Public visible incidents" on public.status_incidents;
create policy "Public visible incidents"
on public.status_incidents for select to anon,authenticated
using (visible=true);

drop policy if exists "Public incident components" on public.status_incident_components;
create policy "Public incident components"
on public.status_incident_components for select to anon,authenticated
using (
  exists (
    select 1 from public.status_incidents i
    where i.id=incident_id and i.visible=true
  )
);

drop policy if exists "Public incident updates" on public.status_incident_updates;
create policy "Public incident updates"
on public.status_incident_updates for select to anon,authenticated
using (
  exists (
    select 1 from public.status_incidents i
    where i.id=incident_id and i.visible=true
  )
);

drop policy if exists "Admins manage status components" on public.status_components;
create policy "Admins manage status components"
on public.status_components for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage status incidents" on public.status_incidents;
create policy "Admins manage status incidents"
on public.status_incidents for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage status incident components" on public.status_incident_components;
create policy "Admins manage status incident components"
on public.status_incident_components for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage status incident updates" on public.status_incident_updates;
create policy "Admins manage status incident updates"
on public.status_incident_updates for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

insert into public.status_components(key,label,description,state,visible,sort_order)
values
  ('store','Loja e catálogo','Navegação, produtos, páginas e carrinho.','operational',true,0),
  ('account','Conta e login','Acesso à conta, perfil e sessão.','operational',true,1),
  ('payments','Pagamentos','Criação e confirmação de pagamentos.','operational',true,2),
  ('accounts','Marketplace de contas','Catálogo e visualização de contas.','operational',true,3),
  ('community','Comunidade','Chat, mídia, perfis e reações.','operational',true,4),
  ('support','Tickets e suporte','Abertura e acompanhamento de tickets.','operational',true,5),
  ('club','CRAZZY CLUB','Rewards, Luck, cupons e rank.','operational',true,6)
on conflict (key) do update set
  label=excluded.label,
  description=excluded.description,
  visible=excluded.visible,
  sort_order=excluded.sort_order,
  updated_at=now();

create or replace function public.get_public_status()
returns jsonb
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  with components as (
    select
      c.id,c.key,c.label,c.description,c.state,c.message,c.sort_order,c.updated_at
    from public.status_components c
    where c.visible=true
    order by c.sort_order,c.label
  ),
  incidents as (
    select
      i.id,i.title,i.state,i.impact,i.message,i.started_at,i.resolved_at,i.updated_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'key',c.key,
          'label',c.label
        ) order by c.sort_order)
        from public.status_incident_components ic
        join public.status_components c on c.id=ic.component_id
        where ic.incident_id=i.id and c.visible=true
      ),'[]'::jsonb) as components,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'state',u.state,
          'message',u.message,
          'created_at',u.created_at
        ) order by u.created_at desc)
        from public.status_incident_updates u
        where u.incident_id=i.id
      ),'[]'::jsonb) as updates
    from public.status_incidents i
    where i.visible=true
      and (
        i.resolved_at is null
        or i.resolved_at >= now() - interval '30 days'
      )
    order by
      case when i.resolved_at is null then 0 else 1 end,
      i.started_at desc
    limit 30
  )
  select jsonb_build_object(
    'components',coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',c.key,
        'label',c.label,
        'description',c.description,
        'state',c.state,
        'message',c.message,
        'updated_at',c.updated_at
      ) order by c.sort_order)
      from components c
    ),'[]'::jsonb),
    'incidents',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'title',i.title,
        'state',i.state,
        'impact',i.impact,
        'message',i.message,
        'started_at',i.started_at,
        'resolved_at',i.resolved_at,
        'updated_at',i.updated_at,
        'components',i.components,
        'updates',i.updates
      ) order by
        case when i.resolved_at is null then 0 else 1 end,
        i.started_at desc
      )
      from incidents i
    ),'[]'::jsonb),
    'generated_at',now()
  );
$$;

revoke all on function public.get_public_status() from public;
grant execute on function public.get_public_status() to anon,authenticated;
