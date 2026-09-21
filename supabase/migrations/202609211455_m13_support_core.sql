-- M13 — CRAZZY SUPPORT
-- Separate support domain from order/fulfillment tickets.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null
    check (category in ('product','payment','delivery','technical','account','other')),
  subject text not null
    check (char_length(btrim(subject)) between 4 and 120),
  status text not null default 'open'
    check (status in ('open','waiting_staff','waiting_user','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  product_id uuid references public.products(id) on delete set null,
  product_plan_id uuid references public.product_plans(id) on delete set null,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  order_ticket_id uuid references public.order_tickets(id) on delete set null,
  library_delivery_id uuid references public.library_deliveries(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null
    check (sender_role in ('user','staff','system')),
  message text not null
    check (char_length(btrim(message)) between 1 and 4000),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_created_idx
  on public.support_messages(ticket_id, created_at asc);

alter table public.support_messages enable row level security;

revoke all on table public.support_messages from anon;
revoke all on table public.support_messages from authenticated;
grant select on table public.support_messages to authenticated;

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

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
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

-- Private Support bucket. 25 MB/file and safe MIME allowlist.
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
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Browser never needs direct object access.
-- Uploads use short-lived signed upload URLs generated by the server.
-- Downloads use short-lived signed download URLs after ticket authorization.
drop policy if exists "Support attachment direct select" on storage.objects;
drop policy if exists "Support attachment direct insert" on storage.objects;
drop policy if exists "Support attachment direct update" on storage.objects;
drop policy if exists "Support attachment direct delete" on storage.objects;
