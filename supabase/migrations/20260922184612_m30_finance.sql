-- M30 CRAZZY FINANCE
-- Transparent finance layer: never invent gateway fees.
-- Uses actual per-payment costs when known, configured fee rules as estimates,
-- and reports unpriced transactions explicitly.

create table if not exists public.finance_fee_rules (
  id uuid primary key default gen_random_uuid(),
  method text not null
    check (method in ('pix','card','crypto')),
  percent_bps integer not null default 0
    check (percent_bps between 0 and 10000),
  fixed_cents integer not null default 0
    check (fixed_cents >= 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  source_label text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create unique index if not exists finance_fee_rules_one_active_method_uidx
  on public.finance_fee_rules(method)
  where active=true;

create index if not exists finance_fee_rules_history_idx
  on public.finance_fee_rules(method,effective_from desc);

create table if not exists public.finance_payment_costs (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  gateway_fee_cents integer
    check (gateway_fee_cents is null or gateway_fee_cents >= 0),
  provider_net_cents integer
    check (provider_net_cents is null or provider_net_cents >= 0),
  source text not null default 'manual'
    check (source in ('manual','provider')),
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_holds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  amount_cents integer not null
    check (amount_cents > 0),
  reason text,
  provider_ref text,
  status text not null default 'open'
    check (status in ('open','released','cancelled')),
  opened_at timestamptz not null default now(),
  released_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_holds_status_opened_idx
  on public.finance_holds(status,opened_at desc);

create index if not exists finance_holds_payment_idx
  on public.finance_holds(payment_id,opened_at desc)
  where payment_id is not null;

alter table public.finance_fee_rules enable row level security;
alter table public.finance_payment_costs enable row level security;
alter table public.finance_holds enable row level security;

drop policy if exists "Admins manage finance fee rules" on public.finance_fee_rules;
create policy "Admins manage finance fee rules"
on public.finance_fee_rules
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage finance payment costs" on public.finance_payment_costs;
create policy "Admins manage finance payment costs"
on public.finance_payment_costs
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage finance holds" on public.finance_holds;
create policy "Admins manage finance holds"
on public.finance_holds
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.finance_fee_rules from anon;
revoke all on public.finance_payment_costs from anon;
revoke all on public.finance_holds from anon;

grant select,insert,update on public.finance_fee_rules to authenticated;
grant select,insert,update on public.finance_payment_costs to authenticated;
grant select,insert,update on public.finance_holds to authenticated;

create or replace function public.set_finance_fee_rule(
  p_method text,
  p_percent_bps integer,
  p_fixed_cents integer,
  p_source_label text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_method text := lower(btrim(coalesce(p_method,'')));
  v_now timestamptz := now();
  v_row public.finance_fee_rules;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if v_method not in ('pix','card','crypto') then
    raise exception 'INVALID_METHOD';
  end if;

  if p_percent_bps is null or p_percent_bps < 0 or p_percent_bps > 10000 then
    raise exception 'INVALID_PERCENT_BPS';
  end if;

  if p_fixed_cents is null or p_fixed_cents < 0 then
    raise exception 'INVALID_FIXED_CENTS';
  end if;

  update public.finance_fee_rules
  set
    active=false,
    effective_to=case when effective_from < v_now then v_now else effective_from + interval '1 microsecond' end,
    updated_at=v_now
  where method=v_method
    and active=true;

  insert into public.finance_fee_rules(
    method,percent_bps,fixed_cents,active,effective_from,
    source_label,notes,created_by
  )
  values(
    v_method,p_percent_bps,p_fixed_cents,true,v_now,
    nullif(left(btrim(coalesce(p_source_label,'')),120),''),
    nullif(left(btrim(coalesce(p_notes,'')),1000),''),
    v_user
  )
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'method',v_row.method,
    'percent_bps',v_row.percent_bps,
    'fixed_cents',v_row.fixed_cents,
    'effective_from',v_row.effective_from
  );
end;
$$;

create or replace function public.clear_finance_fee_rule(
  p_method text
)
returns boolean
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_method text := lower(btrim(coalesce(p_method,'')));
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if v_method not in ('pix','card','crypto') then
    raise exception 'INVALID_METHOD';
  end if;

  update public.finance_fee_rules
  set
    active=false,
    effective_to=case when effective_from < now() then now() else effective_from + interval '1 microsecond' end,
    updated_at=now()
  where method=v_method and active=true;

  return true;
end;
$$;

create or replace function public.set_payment_finance_cost(
  p_payment_id uuid,
  p_gateway_fee_cents integer,
  p_provider_net_cents integer default null,
  p_source text default 'manual',
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_source text := lower(btrim(coalesce(p_source,'manual')));
  v_amount integer;
  v_row public.finance_payment_costs;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select amount into v_amount from public.payments where id=p_payment_id;
  if v_amount is null then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if p_gateway_fee_cents is null or p_gateway_fee_cents < 0 then
    raise exception 'INVALID_GATEWAY_FEE';
  end if;

  if p_provider_net_cents is not null and p_provider_net_cents < 0 then
    raise exception 'INVALID_PROVIDER_NET';
  end if;

  if v_source not in ('manual','provider') then
    raise exception 'INVALID_SOURCE';
  end if;

  insert into public.finance_payment_costs(
    payment_id,gateway_fee_cents,provider_net_cents,source,note,updated_by
  )
  values(
    p_payment_id,p_gateway_fee_cents,p_provider_net_cents,v_source,
    nullif(left(btrim(coalesce(p_note,'')),1000),''),
    v_user
  )
  on conflict(payment_id) do update
  set
    gateway_fee_cents=excluded.gateway_fee_cents,
    provider_net_cents=excluded.provider_net_cents,
    source=excluded.source,
    note=excluded.note,
    updated_by=excluded.updated_by,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'payment_id',v_row.payment_id,
    'gateway_fee_cents',v_row.gateway_fee_cents,
    'provider_net_cents',v_row.provider_net_cents,
    'source',v_row.source
  );
end;
$$;

create or replace function public.create_finance_hold(
  p_amount_cents integer,
  p_reason text default null,
  p_payment_id uuid default null,
  p_provider_ref text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.finance_holds;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'INVALID_HOLD_AMOUNT';
  end if;

  if p_payment_id is not null and not exists(
    select 1 from public.payments where id=p_payment_id
  ) then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  insert into public.finance_holds(
    payment_id,amount_cents,reason,provider_ref,status,created_by
  )
  values(
    p_payment_id,p_amount_cents,
    nullif(left(btrim(coalesce(p_reason,'')),1000),''),
    nullif(left(btrim(coalesce(p_provider_ref,'')),200),''),
    'open',v_user
  )
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'status',v_row.status,
    'amount_cents',v_row.amount_cents
  );
end;
$$;

create or replace function public.set_finance_hold_status(
  p_hold_id uuid,
  p_status text
)
returns boolean
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if v_status not in ('released','cancelled') then
    raise exception 'INVALID_HOLD_STATUS';
  end if;

  update public.finance_holds
  set
    status=v_status,
    released_at=case when v_status='released' then now() else released_at end,
    updated_by=v_user,
    updated_at=now()
  where id=p_hold_id and status='open';

  return found;
end;
$$;

create or replace function public.get_finance_manager(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_method text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_from timestamptz := coalesce(p_from,now()-interval '30 days');
  v_to timestamptz := coalesce(p_to,now());
  v_method text := lower(btrim(coalesce(p_method,'')));
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if v_to <= v_from then raise exception 'INVALID_RANGE'; end if;
  if v_to-v_from > interval '370 days' then raise exception 'RANGE_TOO_LARGE'; end if;
  if v_method<>'' and v_method not in ('pix','card','crypto') then
    raise exception 'INVALID_METHOD';
  end if;

  with paid as (
    select p.*
    from public.payments p
    where p.status='COMPLETED'
      and p.paid_at is not null
      and p.paid_at>=v_from
      and p.paid_at<v_to
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
  ),
  fee_resolved as (
    select
      p.id,
      p.user_id,
      p.amount,
      p.payment_method,
      p.paid_at,
      p.charge_id,
      pc.gateway_fee_cents as actual_fee_cents,
      pc.provider_net_cents,
      pc.source as actual_fee_source,
      fr.id as fee_rule_id,
      fr.percent_bps,
      fr.fixed_cents,
      case
        when pc.gateway_fee_cents is not null then pc.gateway_fee_cents
        when fr.id is not null then
          round((p.amount::numeric * fr.percent_bps::numeric)/10000.0)::integer + fr.fixed_cents
        else null
      end as resolved_fee_cents,
      case
        when pc.gateway_fee_cents is not null then pc.source
        when fr.id is not null then 'estimated'
        else 'unconfigured'
      end as fee_source
    from paid p
    left join public.finance_payment_costs pc on pc.payment_id=p.id
    left join lateral (
      select r.*
      from public.finance_fee_rules r
      where r.method=lower(coalesce(p.payment_method,''))
        and r.effective_from<=p.paid_at
        and (r.effective_to is null or r.effective_to>p.paid_at)
      order by r.effective_from desc
      limit 1
    ) fr on true
  ),
  refunds_period as (
    select
      r.amount_cents,
      lower(coalesce(p.payment_method,'')) as method
    from public.payment_refunds r
    join public.payments p on p.id=r.payment_id
    where r.status='completed'
      and r.completed_at is not null
      and r.completed_at>=v_from
      and r.completed_at<v_to
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
  ),
  refund_pending as (
    select
      r.amount_cents,
      lower(coalesce(p.payment_method,'')) as method
    from public.payment_refunds r
    join public.payments p on p.id=r.payment_id
    where r.status in ('requested','pending_provider')
      and r.requested_at>=v_from
      and r.requested_at<v_to
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
  ),
  chargebacks_period as (
    select
      d.amount_cents,
      lower(coalesce(p.payment_method,'')) as method
    from public.payment_disputes d
    join public.payments p on p.id=d.payment_id
    where d.status='lost'
      and d.resolved_at is not null
      and d.resolved_at>=v_from
      and d.resolved_at<v_to
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
  ),
  open_disputes as (
    select
      d.amount_cents,
      lower(coalesce(p.payment_method,'')) as method
    from public.payment_disputes d
    join public.payments p on p.id=d.payment_id
    where d.status in ('open','under_review')
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
  ),
  open_holds as (
    select h.amount_cents
    from public.finance_holds h
    left join public.payments p on p.id=h.payment_id
    where h.status='open'
      and (
        v_method=''
        or (h.payment_id is not null and lower(coalesce(p.payment_method,''))=v_method)
      )
  ),
  methods as (
    select method,label from public.payment_settings
    where method in ('pix','card','crypto')
      and (v_method='' or method=v_method)
  ),
  method_stats as (
    select
      m.method,
      m.label,
      coalesce((select count(*)::int from fee_resolved f where lower(coalesce(f.payment_method,''))=m.method),0) as payments_count,
      coalesce((select sum(f.amount)::bigint from fee_resolved f where lower(coalesce(f.payment_method,''))=m.method),0) as gross_cents,
      coalesce((select sum(f.resolved_fee_cents)::bigint from fee_resolved f where lower(coalesce(f.payment_method,''))=m.method and f.resolved_fee_cents is not null),0) as known_fee_cents,
      coalesce((select count(*)::int from fee_resolved f where lower(coalesce(f.payment_method,''))=m.method and f.resolved_fee_cents is null),0) as unpriced_count,
      coalesce((select sum(r.amount_cents)::bigint from refunds_period r where r.method=m.method),0) as refunds_cents,
      coalesce((select sum(c.amount_cents)::bigint from chargebacks_period c where c.method=m.method and c.amount_cents is not null),0) as chargebacks_cents
    from methods m
  )
  select jsonb_build_object(
    'range',jsonb_build_object(
      'from',v_from,
      'to',v_to,
      'method',nullif(v_method,'')
    ),
    'summary',jsonb_build_object(
      'completed_payments',(select count(*)::int from fee_resolved),
      'gross_cents',coalesce((select sum(amount)::bigint from fee_resolved),0),
      'known_gateway_fee_cents',coalesce((select sum(resolved_fee_cents)::bigint from fee_resolved where resolved_fee_cents is not null),0),
      'unpriced_payments',(select count(*)::int from fee_resolved where resolved_fee_cents is null),
      'refunds_completed_cents',coalesce((select sum(amount_cents)::bigint from refunds_period),0),
      'refunds_pending_cents',coalesce((select sum(amount_cents)::bigint from refund_pending),0),
      'chargebacks_lost_cents',coalesce((select sum(amount_cents)::bigint from chargebacks_period where amount_cents is not null),0),
      'chargebacks_unknown_count',(select count(*)::int from chargebacks_period where amount_cents is null),
      'open_dispute_exposure_cents',coalesce((select sum(amount_cents)::bigint from open_disputes where amount_cents is not null),0),
      'open_dispute_unknown_count',(select count(*)::int from open_disputes where amount_cents is null),
      'manual_holds_open_cents',coalesce((select sum(amount_cents)::bigint from open_holds),0),
      'net_before_unknown_fees_cents',
        coalesce((select sum(amount)::bigint from fee_resolved),0)
        - coalesce((select sum(resolved_fee_cents)::bigint from fee_resolved where resolved_fee_cents is not null),0)
        - coalesce((select sum(amount_cents)::bigint from refunds_period),0)
        - coalesce((select sum(amount_cents)::bigint from chargebacks_period where amount_cents is not null),0),
      'net_estimated_cents',case
        when (select count(*) from fee_resolved where resolved_fee_cents is null)=0
         and (select count(*) from chargebacks_period where amount_cents is null)=0
        then
          coalesce((select sum(amount)::bigint from fee_resolved),0)
          - coalesce((select sum(resolved_fee_cents)::bigint from fee_resolved),0)
          - coalesce((select sum(amount_cents)::bigint from refunds_period),0)
          - coalesce((select sum(amount_cents)::bigint from chargebacks_period where amount_cents is not null),0)
        else null
      end
    ),
    'methods',coalesce((
      select jsonb_agg(jsonb_build_object(
        'method',s.method,
        'label',s.label,
        'payments_count',s.payments_count,
        'gross_cents',s.gross_cents,
        'known_fee_cents',s.known_fee_cents,
        'unpriced_count',s.unpriced_count,
        'refunds_cents',s.refunds_cents,
        'chargebacks_cents',s.chargebacks_cents,
        'net_estimated_cents',case
          when s.unpriced_count=0
          then s.gross_cents-s.known_fee_cents-s.refunds_cents-s.chargebacks_cents
          else null
        end,
        'fee_rule',(
          select jsonb_build_object(
            'id',r.id,
            'percent_bps',r.percent_bps,
            'fixed_cents',r.fixed_cents,
            'source_label',r.source_label,
            'notes',r.notes,
            'effective_from',r.effective_from
          )
          from public.finance_fee_rules r
          where r.method=s.method and r.active=true
          order by r.effective_from desc
          limit 1
        )
      ) order by s.method)
      from method_stats s
    ),'[]'::jsonb),
    'daily',coalesce((
      select jsonb_agg(row_data order by day)
      from (
        select
          d.day,
          jsonb_build_object(
            'day',d.day,
            'gross_cents',coalesce(p.gross_cents,0),
            'payments_count',coalesce(p.payments_count,0),
            'known_fee_cents',coalesce(p.known_fee_cents,0),
            'unpriced_count',coalesce(p.unpriced_count,0),
            'refunds_cents',coalesce(r.refunds_cents,0)
          ) as row_data
        from (
          select generate_series(
            date_trunc('day',v_from),
            date_trunc('day',v_to-interval '1 second'),
            interval '1 day'
          )::date as day
        ) d
        left join (
          select
            date(paid_at) as day,
            sum(amount)::bigint as gross_cents,
            count(*)::int as payments_count,
            sum(coalesce(resolved_fee_cents,0))::bigint as known_fee_cents,
            count(*) filter(where resolved_fee_cents is null)::int as unpriced_count
          from fee_resolved
          group by date(paid_at)
        ) p on p.day=d.day
        left join (
          select
            date(r.completed_at) as day,
            sum(r.amount_cents)::bigint as refunds_cents
          from public.payment_refunds r
          join public.payments p2 on p2.id=r.payment_id
          where r.status='completed'
            and r.completed_at>=v_from and r.completed_at<v_to
            and (v_method='' or lower(coalesce(p2.payment_method,''))=v_method)
          group by date(r.completed_at)
        ) r on r.day=d.day
      ) q
    ),'[]'::jsonb),
    'recent_payments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'payment_id',f.id,
        'username',coalesce(pr.username,'Cliente'),
        'payment_method',f.payment_method,
        'paid_at',f.paid_at,
        'gross_cents',f.amount,
        'fee_cents',f.resolved_fee_cents,
        'fee_source',f.fee_source,
        'provider_net_cents',f.provider_net_cents,
        'net_after_fee_cents',case
          when f.provider_net_cents is not null then f.provider_net_cents
          when f.resolved_fee_cents is not null then f.amount-f.resolved_fee_cents
          else null
        end,
        'refunds_completed_cents',coalesce((
          select sum(r.amount_cents)::bigint
          from public.payment_refunds r
          where r.payment_id=f.id and r.status='completed'
        ),0),
        'dispute_status',(
          select d.status
          from public.payment_disputes d
          where d.payment_id=f.id
          order by d.opened_at desc
          limit 1
        ),
        'open_hold_cents',coalesce((
          select sum(h.amount_cents)::bigint
          from public.finance_holds h
          where h.payment_id=f.id and h.status='open'
        ),0)
      ) order by f.paid_at desc)
      from (
        select * from fee_resolved order by paid_at desc limit 60
      ) f
      left join public.profiles pr on pr.user_id=f.user_id
    ),'[]'::jsonb),
    'holds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',h.id,
        'payment_id',h.payment_id,
        'amount_cents',h.amount_cents,
        'reason',h.reason,
        'provider_ref',case
          when h.provider_ref is null then null
          when char_length(h.provider_ref)<=14 then h.provider_ref
          else left(h.provider_ref,8)||'…'||right(h.provider_ref,4)
        end,
        'status',h.status,
        'opened_at',h.opened_at,
        'released_at',h.released_at
      ) order by h.opened_at desc)
      from (
        select h.*
        from public.finance_holds h
        left join public.payments p on p.id=h.payment_id
        where
          v_method=''
          or (h.payment_id is not null and lower(coalesce(p.payment_method,''))=v_method)
        order by h.opened_at desc
        limit 60
      ) h
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_finance_manager(timestamptz,timestamptz,text)
  from public,anon;
revoke execute on function public.set_finance_fee_rule(text,integer,integer,text,text)
  from public,anon;
revoke execute on function public.clear_finance_fee_rule(text)
  from public,anon;
revoke execute on function public.set_payment_finance_cost(uuid,integer,integer,text,text)
  from public,anon;
revoke execute on function public.create_finance_hold(integer,text,uuid,text)
  from public,anon;
revoke execute on function public.set_finance_hold_status(uuid,text)
  from public,anon;

grant execute on function public.get_finance_manager(timestamptz,timestamptz,text)
  to authenticated;
grant execute on function public.set_finance_fee_rule(text,integer,integer,text,text)
  to authenticated;
grant execute on function public.clear_finance_fee_rule(text)
  to authenticated;
grant execute on function public.set_payment_finance_cost(uuid,integer,integer,text,text)
  to authenticated;
grant execute on function public.create_finance_hold(integer,text,uuid,text)
  to authenticated;
grant execute on function public.set_finance_hold_status(uuid,text)
  to authenticated;
