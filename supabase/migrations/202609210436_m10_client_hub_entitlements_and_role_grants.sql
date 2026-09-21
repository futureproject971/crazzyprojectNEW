create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_plan_id uuid references public.product_plans(id) on delete set null,
  source_payment_id uuid references public.payments(id) on delete set null,
  source_order_ticket_id uuid references public.order_tickets(id) on delete set null,
  fulfillment_key text unique,
  status text not null default 'active'
    check (status in ('active','expired','revoked','refunded','disputed')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  tutorial_access boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_user_status_idx
  on public.entitlements(user_id, status, expires_at);

create index if not exists entitlements_product_idx
  on public.entitlements(product_id, product_plan_id);

alter table public.entitlements enable row level security;

revoke all on table public.entitlements from anon;
revoke all on table public.entitlements from authenticated;
grant select on table public.entitlements to authenticated;

drop policy if exists "Entitlements visible to owner or admin" on public.entitlements;
create policy "Entitlements visible to owner or admin"
on public.entitlements
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);

create table if not exists public.discord_role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  discord_user_id text,
  guild_id text,
  role_id text not null,
  role_name text,
  status text not null default 'pending'
    check (status in ('pending','granted','failed','revoked')),
  granted_at timestamptz,
  revoked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_role_grants_user_status_idx
  on public.discord_role_grants(user_id, status);

alter table public.discord_role_grants enable row level security;

revoke all on table public.discord_role_grants from anon;
revoke all on table public.discord_role_grants from authenticated;
grant select on table public.discord_role_grants to authenticated;

drop policy if exists "Discord grants visible to owner or admin" on public.discord_role_grants;
create policy "Discord grants visible to owner or admin"
on public.discord_role_grants
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
);
