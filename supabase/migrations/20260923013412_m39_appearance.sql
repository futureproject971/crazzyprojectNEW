
create table if not exists public.site_appearance (
  id text primary key default 'default' check (id = 'default'),
  default_theme text not null default 'dark' check (default_theme in ('dark','light')),
  allow_user_theme boolean not null default true,
  accent_hex text not null default '#0000FF' check (accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
  motion_enabled boolean not null default true,
  ambient_effects boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_appearance enable row level security;

revoke all on table public.site_appearance from anon, authenticated;
grant select on table public.site_appearance to anon, authenticated;
grant update on table public.site_appearance to authenticated;
grant all on table public.site_appearance to service_role;

drop policy if exists "Public can read site appearance" on public.site_appearance;
create policy "Public can read site appearance"
on public.site_appearance
for select
to anon, authenticated
using (id = 'default');

drop policy if exists "Admins can update site appearance" on public.site_appearance;
create policy "Admins can update site appearance"
on public.site_appearance
for update
to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (
  id = 'default'
  and private.has_role((select auth.uid()), 'admin'::public.app_role)
);

insert into public.site_appearance(id)
values('default')
on conflict (id) do nothing;
