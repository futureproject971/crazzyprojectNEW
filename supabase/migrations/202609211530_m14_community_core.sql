-- M14 — CRAZZY COMMUNITY
-- Private authenticated community chat with replies, reactions and private media.

create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
  name text not null
    check (char_length(btrim(name)) between 2 and 40),
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_channels enable row level security;
revoke all on table public.community_channels from anon;
revoke all on table public.community_channels from authenticated;
grant select on table public.community_channels to authenticated;

drop policy if exists "Community channels visible to authenticated" on public.community_channels;
create policy "Community channels visible to authenticated"
on public.community_channels
for select
to authenticated
using (
  active = true
  or private.has_role((select auth.uid()), 'admin'::app_role)
  or private.has_role((select auth.uid()), 'moderator'::app_role)
);

insert into public.community_channels (slug, name, description, active, sort_order)
values (
  'geral',
  'Chat Geral',
  'Converse com a comunidade CRAZZY PROJECT.',
  true,
  0
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    updated_at = now();

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reply_to_message_id uuid references public.community_messages(id) on delete set null,
  body text not null
    check (char_length(btrim(body)) between 1 and 2000),
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_messages_channel_created_idx
  on public.community_messages(channel_id, created_at desc);

create index if not exists community_messages_user_created_idx
  on public.community_messages(user_id, created_at desc);

create index if not exists community_messages_reply_idx
  on public.community_messages(reply_to_message_id)
  where reply_to_message_id is not null;

alter table public.community_messages enable row level security;
revoke all on table public.community_messages from anon;
revoke all on table public.community_messages from authenticated;
grant select on table public.community_messages to authenticated;

drop policy if exists "Community messages visible to authenticated" on public.community_messages;
create policy "Community messages visible to authenticated"
on public.community_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.community_channels cc
    where cc.id = community_messages.channel_id
      and (
        cc.active = true
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null
    check (emoji in ('🔥','💎','💙','❤️','👍','😂','🎮','👀','💯','🚀')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists community_reactions_message_idx
  on public.community_reactions(message_id);

create index if not exists community_reactions_user_idx
  on public.community_reactions(user_id);

alter table public.community_reactions enable row level security;
revoke all on table public.community_reactions from anon;
revoke all on table public.community_reactions from authenticated;
grant select on table public.community_reactions to authenticated;

drop policy if exists "Community reactions visible to authenticated" on public.community_reactions;
create policy "Community reactions visible to authenticated"
on public.community_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.community_messages cm
    join public.community_channels cc on cc.id = cm.channel_id
    where cm.id = community_reactions.message_id
      and (
        cc.active = true
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

create table if not exists public.community_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_messages(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  filename text not null
    check (char_length(filename) between 1 and 160),
  mime_type text not null,
  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 20971520),
  status text not null default 'pending'
    check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now()
);

create index if not exists community_attachments_message_idx
  on public.community_attachments(message_id, created_at asc);

create index if not exists community_attachments_owner_idx
  on public.community_attachments(owner_user_id);

alter table public.community_attachments enable row level security;
revoke all on table public.community_attachments from anon;
revoke all on table public.community_attachments from authenticated;
grant select on table public.community_attachments to authenticated;

drop policy if exists "Community attachments visible to authenticated" on public.community_attachments;
create policy "Community attachments visible to authenticated"
on public.community_attachments
for select
to authenticated
using (
  status = 'ready'
  and exists (
    select 1
    from public.community_messages cm
    join public.community_channels cc on cc.id = cm.channel_id
    where cm.id = community_attachments.message_id
      and cm.deleted_at is null
      and (
        cc.active = true
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

-- Browser reads safe chat rows through RLS, but every mutation goes through the backend.
-- This prevents sender_id/role/reaction ownership spoofing.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'community-media',
  'community-media',
  false,
  20971520,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/ogg',
    'audio/webm'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No direct browser Storage policies. Upload/download authorization is server-side.
drop policy if exists "Community media direct select" on storage.objects;
drop policy if exists "Community media direct insert" on storage.objects;
drop policy if exists "Community media direct update" on storage.objects;
drop policy if exists "Community media direct delete" on storage.objects;
