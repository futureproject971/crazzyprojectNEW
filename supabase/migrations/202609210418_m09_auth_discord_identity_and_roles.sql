create table if not exists public.discord_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  username text,
  global_name text,
  avatar_url text,
  guild_id text,
  guild_member boolean not null default false,
  guild_verified_at timestamptz,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discord_identities enable row level security;

revoke all on table public.discord_identities from anon;
revoke all on table public.discord_identities from authenticated;
grant select on table public.discord_identities to authenticated;

drop policy if exists "Discord identity visible to owner or admin" on public.discord_identities;
create policy "Discord identity visible to owner or admin"
on public.discord_identities
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

drop policy if exists "Users can view all profiles" on public.profiles;
drop policy if exists "Profile visible to owner or admin" on public.profiles;
create policy "Profile visible to owner or admin"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

revoke all on table public.profiles from anon;
grant select, update on table public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (user_id, username, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'usuario'
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (user_id) do update
  set username = coalesce(public.profiles.username, excluded.username),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.system_credentials (name, env_key, value, description, help_url)
select
  'Discord — Guild ID',
  'DISCORD_GUILD_ID',
  '',
  'ID do servidor oficial CRAZZY PROJECT para sincronizar guild status no login.',
  'https://discord.com/developers/applications'
where not exists (
  select 1 from public.system_credentials where env_key='DISCORD_GUILD_ID'
);
