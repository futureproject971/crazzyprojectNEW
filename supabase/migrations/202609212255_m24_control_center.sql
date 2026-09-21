-- M24 CRAZZY CONTROL CENTER
-- Admin-only operational alerts and derived health checks.

create table if not exists public.control_center_alerts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'payment_divergence','fulfillment','discord_sync','low_stock',
      'missing_tutorial','payment_dispute','system'
    )
  ),
  severity text not null default 'warning'
    check (severity in ('info','warning','critical')),
  title text not null,
  message text not null default '',
  state text not null default 'open'
    check (state in ('open','acknowledged','resolved')),
  reference_type text,
  reference_id text,
  context jsonb not null default '{}'::jsonb,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists control_center_alerts_state_created_idx
  on public.control_center_alerts(state,created_at desc);

alter table public.control_center_alerts enable row level security;

drop policy if exists "Admins read control center alerts" on public.control_center_alerts;
create policy "Admins read control center alerts"
on public.control_center_alerts for select to authenticated
using (private.has_role(auth.uid(),'admin'::app_role));

drop policy if exists "Admins manage control center alerts" on public.control_center_alerts;
create policy "Admins manage control center alerts"
on public.control_center_alerts for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

create or replace function public.is_current_admin()
returns boolean
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  select coalesce(private.has_role(auth.uid(),'admin'::app_role),false);
$$;

create or replace function public.get_control_center()
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  with
  payment_divergence as (
    select
      p.id,
      p.charge_id,
      p.amount,
      p.payment_method,
      p.created_at,
      p.paid_at
    from public.payments p
    where p.status='COMPLETED'
      and coalesce(p.paid_at,p.updated_at,p.created_at) < now() - interval '5 minutes'
      and not exists (
        select 1 from public.entitlements e
        where e.source_payment_id=p.id
      )
      and not exists (
        select 1 from public.order_tickets ot
        where ot.payment_id=p.id
      )
    order by coalesce(p.paid_at,p.updated_at,p.created_at) asc
    limit 50
  ),
  fulfillment_failures as (
    select
      ot.id,
      ot.payment_id,
      ot.product_id,
      ot.product_plan_id,
      ot.status,
      ot.status_label,
      ot.created_at,
      ot.updated_at
    from public.order_tickets ot
    where (
      lower(ot.status) in ('failed','error')
      or coalesce(ot.metadata->>'error','') <> ''
      or coalesce(ot.metadata->>'last_error','') <> ''
    )
    order by ot.updated_at desc
    limit 50
  ),
  discord_failures as (
    select
      g.id,
      g.user_id,
      g.entitlement_id,
      g.role_name,
      g.status,
      g.last_error_code,
      g.updated_at
    from public.discord_role_grants g
    where
      lower(g.status) in ('failed','error')
      or (
        g.last_error_code is not null
        and lower(g.status) <> 'granted'
      )
    order by g.updated_at desc
    limit 50
  ),
  stock_rollup as (
    select
      pp.id as plan_id,
      pp.product_id,
      p.name as product_name,
      pp.name as plan_name,
      count(si.id)::int as known_stock,
      count(si.id) filter (where si.used=false)::int as available_stock
    from public.product_plans pp
    join public.products p on p.id=pp.product_id
    left join public.stock_items si on si.product_plan_id=pp.id
    where pp.active=true and p.active=true
    group by pp.id,pp.product_id,p.name,pp.name
  ),
  low_stock as (
    select *
    from stock_rollup
    where known_stock > 0 and available_stock <= 3
    order by available_stock asc,product_name,plan_name
    limit 50
  ),
  missing_tutorials as (
    select
      p.id as product_id,
      p.name as product_name
    from public.products p
    where p.active=true
      and exists (
        select 1 from public.product_plans pp
        where pp.product_id=p.id and pp.active=true
      )
      and coalesce(nullif(btrim(p.tutorial_text),''),nullif(btrim(p.tutorial_file_url),'')) is null
      and not exists (
        select 1 from public.academy_tutorial_products atp
        where atp.product_id=p.id
      )
    order by p.name
    limit 100
  ),
  active_incidents as (
    select id,title,state,impact,message,started_at
    from public.status_incidents
    where visible=true and resolved_at is null
    order by started_at desc
    limit 30
  ),
  manual_alerts as (
    select
      a.id,a.category,a.severity,a.title,a.message,a.state,
      a.reference_type,a.reference_id,a.context,
      a.acknowledged_at,a.resolved_at,a.created_at,a.updated_at
    from public.control_center_alerts a
    where a.state <> 'resolved'
    order by
      case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
      a.created_at desc
    limit 100
  ),
  stale_active_payments as (
    select count(*)::int as count
    from public.payments p
    where p.status='ACTIVE'
      and coalesce(p.expires_at,p.created_at + interval '30 minutes') < now()
  )
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'payment_divergence',(select count(*) from payment_divergence),
      'fulfillment_failures',(select count(*) from fulfillment_failures),
      'discord_failures',(select count(*) from discord_failures),
      'low_stock',(select count(*) from low_stock),
      'missing_tutorials',(select count(*) from missing_tutorials),
      'active_incidents',(select count(*) from active_incidents),
      'manual_open_alerts',(select count(*) from manual_alerts),
      'stale_active_payments',(select count from stale_active_payments)
    ),
    'payment_divergence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'charge_id',charge_id,
        'amount',amount,
        'payment_method',payment_method,
        'created_at',created_at,
        'paid_at',paid_at
      ) order by coalesce(paid_at,created_at))
      from payment_divergence
    ),'[]'::jsonb),
    'fulfillment_failures',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from fulfillment_failures x
    ),'[]'::jsonb),
    'discord_failures',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from discord_failures x
    ),'[]'::jsonb),
    'low_stock',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.available_stock,x.product_name,x.plan_name)
      from low_stock x
    ),'[]'::jsonb),
    'missing_tutorials',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.product_name)
      from missing_tutorials x
    ),'[]'::jsonb),
    'active_incidents',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.started_at desc)
      from active_incidents x
    ),'[]'::jsonb),
    'manual_alerts',coalesce((
      select jsonb_agg(to_jsonb(x))
      from manual_alerts x
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.set_control_center_alert_state(
  p_alert_id uuid,
  p_state text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.control_center_alerts;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_state not in ('open','acknowledged','resolved') then
    raise exception 'INVALID_STATE';
  end if;

  update public.control_center_alerts
  set
    state=p_state,
    acknowledged_by=case when p_state='acknowledged' then v_user else acknowledged_by end,
    acknowledged_at=case when p_state='acknowledged' then now() else acknowledged_at end,
    resolved_by=case when p_state='resolved' then v_user else resolved_by end,
    resolved_at=case when p_state='resolved' then now() when p_state='open' then null else resolved_at end,
    updated_at=now()
  where id=p_alert_id
  returning * into v_row;

  if v_row.id is null then raise exception 'ALERT_NOT_FOUND'; end if;

  return jsonb_build_object(
    'id',v_row.id,
    'state',v_row.state,
    'updated_at',v_row.updated_at
  );
end;
$$;

revoke all on function public.is_current_admin() from public;
revoke all on function public.get_control_center() from public;
revoke all on function public.set_control_center_alert_state(uuid,text) from public;

revoke execute on function public.is_current_admin() from anon;
revoke execute on function public.get_control_center() from anon;
revoke execute on function public.set_control_center_alert_state(uuid,text) from anon;

grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.get_control_center() to authenticated;
grant execute on function public.set_control_center_alert_state(uuid,text) to authenticated;
