-- M12 — CRAZZY PROFILE
-- Safe user-editable preferences separated from security-sensitive profile fields.

create table if not exists public.profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  primary_color text not null default '#0000FF',
  avatar_source text not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_preferences_display_name_check
    check (
      display_name is null
      or char_length(btrim(display_name)) between 2 and 32
    ),
  constraint profile_preferences_bio_check
    check (bio is null or char_length(bio) <= 280),
  constraint profile_preferences_primary_color_check
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint profile_preferences_avatar_source_check
    check (avatar_source in ('auto','crazzy','discord'))
);

alter table public.profile_preferences enable row level security;

revoke all on table public.profile_preferences from anon;
revoke all on table public.profile_preferences from authenticated;
grant select, insert, update on table public.profile_preferences to authenticated;

drop policy if exists "Profile preferences visible to owner or admin" on public.profile_preferences;
create policy "Profile preferences visible to owner or admin"
on public.profile_preferences
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

drop policy if exists "Profile preferences insert owner or admin" on public.profile_preferences;
create policy "Profile preferences insert owner or admin"
on public.profile_preferences
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

drop policy if exists "Profile preferences update owner or admin" on public.profile_preferences;
create policy "Profile preferences update owner or admin"
on public.profile_preferences
for update
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
)
with check (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

-- Security-sensitive profile fields (banned, ban reason, auth-synced identity)
-- must not be writable directly by a normal authenticated browser.
drop policy if exists "Profile update owner or admin" on public.profiles;
revoke update, insert, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

-- Backfill preferences for existing users.
insert into public.profile_preferences (user_id, display_name)
select p.user_id, nullif(btrim(p.username), '')
from public.profiles p
on conflict (user_id) do nothing;

-- New auth users receive both their protected profile and editable preferences.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_avatar text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'usuario'
  );

  v_avatar := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  insert into public.profiles (user_id, username, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (user_id) do update
  set username = coalesce(public.profiles.username, excluded.username),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.profile_preferences (user_id, display_name)
  values (new.id, nullif(btrim(v_name), ''))
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
