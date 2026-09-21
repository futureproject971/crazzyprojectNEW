-- M13 — CRAZZY SUPPORT
-- Evolve the pre-existing empty Support skeleton without reusing order_tickets.

-- =========================================================
-- SUPPORT TICKETS
-- =========================================================

alter table public.support_tickets
  add column if not exists priority text not null default 'normal',
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists product_plan_id uuid references public.product_plans(id) on delete set null,
  add column if not exists entitlement_id uuid references public.entitlements(id) on delete set null,
  add column if not exists order_ticket_id uuid references public.order_tickets(id) on delete set null,
  add column if not exists library_delivery_id uuid references public.library_deliveries(id) on delete set null,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists last_message_at timestamptz not null default now();

alter table public.support_tickets
  alter column category set default 'other';

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check,
  drop constraint if exists support_tickets_subject_check,
  drop constraint if exists support_tickets_priority_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
    check (category in ('product','payment','delivery','technical','account','other')),
  add constraint support_tickets_subject_check
    check (char_length(btrim(subject)) between 4 and 120),
  add constraint support_tickets_priority_check
    check (priority in ('low','normal','high','urgent'));

create index if not exists support_tickets_user_updated_idx
  on public.support_tickets(user_id, updated_at desc);

create index if not exists support_tickets_status_priority_idx
  on public.support_tickets(status, priority, updated_at desc);

create index if not exists support_tickets_assigned_idx
  on public.support_tickets(assigned_to, status, updated_at desc)
  where assigned_to is not null;

alter table public.support_tickets enable row level security;

revoke all on table public.support_tickets from anon;
revoke all on table public.support_tickets from authenticated;
grant select on table public.support_tickets to authenticated;

drop policy if exists "Users create own support tickets" on public.support_tickets;
drop policy if exists "Admins update support tickets" on public.support_tickets;
drop policy if exists "Admins delete support tickets" on public.support_tickets;
drop policy if exists "Support tickets visible to owner or admin" on public.support_tickets;
drop policy if exists "Support tickets visible to owner or staff" on public.support_tickets;

create policy "Support tickets visible to owner or staff"
on public.support_tickets
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
  or private.has_role((select auth.uid()), 'moderator'::app_role)
);

-- =========================================================
-- SUPPORT MESSAGES
-- =========================================================

alter table public.support_messages
  add column if not exists edited_at timestamptz;

alter table public.support_messages
  alter column sender_id drop not null;

alter table public.support_messages
  drop constraint if exists support_messages_sender_id_fkey,
  drop constraint if exists support_messages_sender_role_check,
  drop constraint if exists support_messages_message_check;

alter table public.support_messages
  add constraint support_messages_sender_id_fkey
    foreign key (sender_id) references auth.users(id) on delete set null,
  add constraint support_messages_sender_role_check
    check (sender_role in ('user','staff','system')),
  add constraint support_messages_message_check
    check (char_length(btrim(message)) between 1 and 4000);

create index if not exists support_messages_ticket_created_idx
  on public.support_messages(ticket_id, created_at asc);

alter table public.support_messages enable row level security;

revoke all on table public.support_messages from anon;
revoke all on table public.support_messages from authenticated;
grant select on table public.support_messages to authenticated;

drop policy if exists "Support message insert user or admin" on public.support_messages;
drop policy if exists "Admins update support messages" on public.support_messages;
drop policy if exists "Admins delete support messages" on public.support_messages;
drop policy if exists "Support messages visible to owner or admin" on public.support_messages;
drop policy if exists "Support messages visible through ticket" on public.support_messages;

create policy "Support messages visible through ticket"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets st
    where st.id = support_messages.ticket_id
      and (
        st.user_id = (select auth.uid())
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

-- =========================================================
-- SUPPORT ATTACHMENTS
-- =========================================================

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  filename text not null
    check (char_length(filename) between 1 and 180),
  mime_type text not null,
  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 26214400),
  status text not null default 'pending'
    check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now()
);

create index if not exists support_attachments_ticket_idx
  on public.support_attachments(ticket_id, created_at asc);

alter table public.support_attachments enable row level security;

revoke all on table public.support_attachments from anon;
revoke all on table public.support_attachments from authenticated;
grant select on table public.support_attachments to authenticated;

drop policy if exists "Support attachments visible through ticket" on public.support_attachments;
create policy "Support attachments visible through ticket"
on public.support_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets st
    where st.id = support_attachments.ticket_id
      and (
        st.user_id = (select auth.uid())
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

-- =========================================================
-- SUPPORT EVENTS / AUDIT
-- =========================================================

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('created','message','attachment','status_changed','closed','reopened','assigned')),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events(ticket_id, created_at asc);

alter table public.support_ticket_events enable row level security;

revoke all on table public.support_ticket_events from anon;
revoke all on table public.support_ticket_events from authenticated;
grant select on table public.support_ticket_events to authenticated;

drop policy if exists "Support events visible through ticket" on public.support_ticket_events;
create policy "Support events visible through ticket"
on public.support_ticket_events
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets st
    where st.id = support_ticket_events.ticket_id
      and (
        st.user_id = (select auth.uid())
        or private.has_role((select auth.uid()), 'admin'::app_role)
        or private.has_role((select auth.uid()), 'moderator'::app_role)
      )
  )
);

-- =========================================================
-- PRIVATE SUPPORT STORAGE
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'support-attachments',
  'support-attachments',
  false,
  26214400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/ogg',
    'audio/webm',
    'application/pdf',
    'text/plain'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No direct authenticated policies are granted on storage.objects.
-- Uploads use server-authorized signed upload URLs.
-- Downloads use short-lived signed URLs after Support authorization.
drop policy if exists "Support attachment direct select" on storage.objects;
drop policy if exists "Support attachment direct insert" on storage.objects;
drop policy if exists "Support attachment direct update" on storage.objects;
drop policy if exists "Support attachment direct delete" on storage.objects;
