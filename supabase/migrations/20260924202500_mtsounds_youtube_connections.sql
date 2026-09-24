-- MTSOUNDS • YouTube account linking
-- OAuth tokens are server-only. Browser roles receive no direct table privileges.

create table if not exists public.youtube_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_sub text,
  email text,
  display_name text,
  channel_id text,
  channel_title text,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_connections enable row level security;
revoke all on table public.youtube_connections from anon;
revoke all on table public.youtube_connections from authenticated;

comment on table public.youtube_connections is
  'Server-only YouTube OAuth linkage for MT Sounds. Accessed only with the Supabase service role.';
comment on column public.youtube_connections.refresh_token is
  'Sensitive Google OAuth refresh token. Never expose through browser APIs.';
