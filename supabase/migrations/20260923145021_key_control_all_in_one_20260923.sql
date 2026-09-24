-- =========================================================
-- KEY CONTROL - SQL ALL IN ONE
-- Snapshot consolidado para instalacao / conferencia.
-- Os blocos usam IF NOT EXISTS / ON CONFLICT quando aplicavel.
-- =========================================================

-- =========================
-- BLOCO 1: SETUP PRINCIPAL
-- =========================

-- =========================================================
-- KEY CONTROL - BANCO COMPLETO
-- Projeto independente para estoque e geração de keys
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.kp_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
  password_hash text not null,
  role text not null default 'user' check (role in ('admin','user')),
  status text not null default 'pending' check (status in ('pending','approved','blocked','rejected')),
  limit_per_plan integer null check (limit_per_plan is null or limit_per_plan > 0),
  window_minutes integer null check (window_minutes is null or window_minutes > 0),
  approved_at timestamptz null,
  approved_by uuid null references public.kp_users(id) on delete set null,
  last_login timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kp_settings (
  id integer primary key check (id = 1),
  default_limit_per_plan integer not null default 10 check (default_limit_per_plan > 0),
  window_minutes integer not null default 60 check (window_minutes > 0),
  default_grant_amount integer not null default 10 check (default_grant_amount > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.kp_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.kp_keys (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.kp_plans(id) on delete restrict,
  key_value text not null unique,
  status text not null default 'available' check (status in ('available','used','disabled')),
  created_by uuid null references public.kp_users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid null references public.kp_users(id) on delete set null,
  used_at timestamptz null
);

create table if not exists public.kp_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.kp_users(id) on delete restrict,
  plan_id uuid not null references public.kp_plans(id) on delete restrict,
  key_id uuid not null unique references public.kp_keys(id) on delete restrict,
  key_value text not null,
  generated_at timestamptz not null default now()
);

create table if not exists public.kp_quota_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.kp_users(id) on delete cascade,
  plan_id uuid not null references public.kp_plans(id) on delete cascade,
  amount integer not null check (amount > 0),
  granted_by uuid null references public.kp_users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.kp_users(id) on delete set null,
  action text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kp_keys_available_idx on public.kp_keys(plan_id, status, created_at);
create index if not exists kp_generations_rate_idx on public.kp_generations(user_id, plan_id, generated_at desc);
create index if not exists kp_generations_backup_user_idx on public.kp_generations(user_id, generated_at desc);
create index if not exists kp_generations_backup_all_idx on public.kp_generations(generated_at desc);
create index if not exists kp_grants_active_idx on public.kp_quota_grants(user_id, plan_id, expires_at);
create index if not exists kp_logs_created_idx on public.kp_logs(created_at desc);

insert into public.kp_settings (id, default_limit_per_plan, window_minutes, default_grant_amount)
values (1, 10, 60, 10)
on conflict (id) do nothing;

insert into public.kp_plans (name, slug, sort_order) values
  ('3 DIAS', '3d', 10),
  ('7 DIAS', '7d', 20),
  ('30 DIAS', '30d', 30),
  ('90 DIAS', '90d', 40),
  ('PERMA', 'perma', 50)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, active = true;

alter table public.kp_users enable row level security;
alter table public.kp_settings enable row level security;
alter table public.kp_plans enable row level security;
alter table public.kp_keys enable row level security;
alter table public.kp_generations enable row level security;
alter table public.kp_quota_grants enable row level security;
alter table public.kp_logs enable row level security;

revoke all on public.kp_users from anon, authenticated;
revoke all on public.kp_settings from anon, authenticated;
revoke all on public.kp_plans from anon, authenticated;
revoke all on public.kp_keys from anon, authenticated;
revoke all on public.kp_generations from anon, authenticated;
revoke all on public.kp_quota_grants from anon, authenticated;
revoke all on public.kp_logs from anon, authenticated;

create or replace function public.kp_generate_key(p_user_id uuid, p_plan_id uuid)
returns table (
  key_value text,
  generation_id uuid,
  used_in_window integer,
  limit_total integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.kp_users%rowtype;
  v_settings public.kp_settings%rowtype;
  v_key public.kp_keys%rowtype;
  v_plan_name text;
  v_window integer;
  v_base_limit integer;
  v_extra integer := 0;
  v_used integer := 0;
  v_generation uuid;
  v_first timestamptz;
begin
  select * into v_user from public.kp_users where id = p_user_id for update;
  if not found or v_user.status <> 'approved' then
    raise exception 'USER_BLOCKED';
  end if;

  select * into v_settings from public.kp_settings where id = 1;
  v_window := coalesce(v_user.window_minutes, v_settings.window_minutes, 60);
  v_base_limit := coalesce(v_user.limit_per_plan, v_settings.default_limit_per_plan, 10);

  select name into v_plan_name from public.kp_plans where id = p_plan_id and active = true;
  if not found then raise exception 'INVALID_PLAN'; end if;

  select count(*)::integer, min(generated_at)
    into v_used, v_first
  from public.kp_generations
  where user_id = p_user_id
    and plan_id = p_plan_id
    and generated_at >= now() - make_interval(mins => v_window);

  select coalesce(sum(amount), 0)::integer
    into v_extra
  from public.kp_quota_grants
  where user_id = p_user_id
    and plan_id = p_plan_id
    and expires_at > now();

  if v_used >= (v_base_limit + v_extra) then
    raise exception 'RATE_LIMIT';
  end if;

  select * into v_key
  from public.kp_keys
  where plan_id = p_plan_id and status = 'available'
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then raise exception 'OUT_OF_STOCK'; end if;

  update public.kp_keys
  set status = 'used', used_by = p_user_id, used_at = now()
  where id = v_key.id;

  insert into public.kp_generations (user_id, plan_id, key_id, key_value)
  values (p_user_id, p_plan_id, v_key.id, v_key.key_value)
  returning id into v_generation;

  insert into public.kp_logs (user_id, action, description, metadata)
  values (
    p_user_id,
    'KEY_GENERATED',
    v_user.username || ' gerou 1 key de ' || v_plan_name || '.',
    jsonb_build_object('plan_id', p_plan_id, 'key_id', v_key.id)
  );

  return query select
    v_key.key_value,
    v_generation,
    v_used + 1,
    v_base_limit + v_extra,
    case when v_first is null then now() + make_interval(mins => v_window)
         else v_first + make_interval(mins => v_window) end;
end;
$$;

revoke all on function public.kp_generate_key(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kp_generate_key(uuid, uuid) to service_role;

select
  (select count(*) from public.kp_plans where active = true) as planos_ativos,
  (select count(*) from public.kp_users where role = 'admin') as admins_criados,
  (select default_limit_per_plan from public.kp_settings where id = 1) as limite_por_plano,
  (select window_minutes from public.kp_settings where id = 1) as janela_minutos;


-- =========================
-- BLOCO 2: UPGRADE SEGURO
-- =========================

-- KEY CONTROL - UPGRADE SEGURO 2026-09-21
-- Não apaga dados. Apenas melhora as consultas do histórico/backup de 10 dias.

create index if not exists kp_generations_backup_user_idx
  on public.kp_generations(user_id, generated_at desc);

create index if not exists kp_generations_backup_all_idx
  on public.kp_generations(generated_at desc);

-- Conferência rápida
select
  (select count(*) from public.kp_keys where status = 'available') as keys_disponiveis,
  (select count(*) from public.kp_generations where generated_at >= now() - interval '10 days') as keys_backup_10d,
  (select count(*) from public.kp_logs where created_at >= now() - interval '10 days') as logs_10d;


-- ==================================
-- BLOCO 3: VERIFICACAO / RECUPERACAO
-- ==================================

-- =========================================================
-- KEY CONTROL - VERIFICACAO E RECUPERACAO
-- Consultas seguras. Este arquivo NAO apaga nem altera dados.
-- =========================================================

-- 1) Resumo geral
select
  (select count(*) from public.kp_users) as usuarios,
  (select count(*) from public.kp_users where status = 'pending') as pendentes,
  (select count(*) from public.kp_users where role = 'admin' and status = 'approved') as admins_ativos,
  (select count(*) from public.kp_keys where status = 'available') as keys_disponiveis,
  (select count(*) from public.kp_keys where status = 'used') as keys_usadas,
  (select count(*) from public.kp_generations where generated_at >= now() - interval '10 days') as geracoes_10d,
  (select count(*) from public.kp_logs where created_at >= now() - interval '10 days') as logs_10d;

-- 2) Estoque por plano
select
  p.name as plano,
  count(k.id) filter (where k.status = 'available') as disponiveis,
  count(k.id) filter (where k.status = 'used') as usadas,
  count(k.id) filter (where k.status = 'disabled') as desativadas
from public.kp_plans p
left join public.kp_keys k on k.plan_id = p.id
group by p.id, p.name, p.sort_order
order by p.sort_order;

-- 3) Geracoes recuperaveis nos ultimos 10 dias
select
  g.generated_at,
  u.username,
  p.name as plano,
  g.key_value
from public.kp_generations g
join public.kp_users u on u.id = g.user_id
join public.kp_plans p on p.id = g.plan_id
where g.generated_at >= now() - interval '10 days'
order by g.generated_at desc;

-- 4) Auditoria recente
select
  l.created_at,
  coalesce(u.username, 'sistema') as usuario,
  l.action,
  l.description,
  l.metadata
from public.kp_logs l
left join public.kp_users u on u.id = l.user_id
where l.created_at >= now() - interval '10 days'
order by l.created_at desc;

-- 5) Checagem de consistencia: deve retornar zero linhas.
-- Procura geracao cuja key nao esteja marcada como usada.
select g.id, g.key_value, k.status
from public.kp_generations g
join public.kp_keys k on k.id = g.key_id
where k.status <> 'used';

-- 6) Checagem de consistencia: deve retornar zero linhas.
-- A constraint UNIQUE ja impede duplicidade, esta consulta serve apenas para auditoria.
select key_value, count(*)
from public.kp_keys
group by key_value
having count(*) > 1;

;
