-- M29 CRAZZY PAYMENTS MANAGER
-- Safe payment observability, reconciliation requests and case tracking.
-- Never store raw checkout proofs, provider secrets, QR payloads or delivered credentials here.

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  provider_ref text,
  external_event_id text,
  source text not null
    check (source in ('checkout','webhook','reconcile','provider','admin','system')),
  event_type text not null
    check (char_length(event_type) between 1 and 80),
  severity text not null default 'info'
    check (severity in ('info','warn','error','critical')),
  status_before text,
  status_after text,
  provider_status text,
  amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  http_status integer
    check (http_status is null or http_status between 100 and 599),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_events_external_event_uidx
  on public.payment_events(external_event_id)
  where external_event_id is not null;

create index if not exists payment_events_payment_created_idx
  on public.payment_events(payment_id,created_at desc)
  where payment_id is not null;

create index if not exists payment_events_type_created_idx
  on public.payment_events(event_type,created_at desc);

create table if not exists public.payment_reconcile_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  provider_status text,
  status_before text,
  status_after text,
  last_error_code text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_reconcile_active_uidx
  on public.payment_reconcile_requests(payment_id)
  where status in ('queued','running');

create index if not exists payment_reconcile_recent_idx
  on public.payment_reconcile_requests(requested_at desc);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  reason text,
  status text not null default 'requested'
    check (status in ('requested','pending_provider','completed','failed','cancelled')),
  provider_ref text,
  provider_status text,
  last_error_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists payment_refunds_payment_idx
  on public.payment_refunds(payment_id,requested_at desc);

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider_ref text,
  status text not null default 'open'
    check (status in ('open','under_review','won','lost','closed')),
  reason text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_disputes_payment_idx
  on public.payment_disputes(payment_id,opened_at desc);

create table if not exists public.payment_dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.payment_disputes(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  evidence_type text not null default 'note'
    check (evidence_type in ('note','file','delivery','conversation','other')),
  note text,
  file_url text,
  created_at timestamptz not null default now()
);

create index if not exists payment_dispute_evidence_dispute_idx
  on public.payment_dispute_evidence(dispute_id,created_at desc);

alter table public.payment_events enable row level security;
alter table public.payment_reconcile_requests enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.payment_dispute_evidence enable row level security;

drop policy if exists "Admins read payment events" on public.payment_events;
create policy "Admins read payment events"
on public.payment_events
for select
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage payment reconcile requests" on public.payment_reconcile_requests;
create policy "Admins manage payment reconcile requests"
on public.payment_reconcile_requests
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage payment refunds" on public.payment_refunds;
create policy "Admins manage payment refunds"
on public.payment_refunds
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage payment disputes" on public.payment_disputes;
create policy "Admins manage payment disputes"
on public.payment_disputes
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

drop policy if exists "Admins manage payment dispute evidence" on public.payment_dispute_evidence;
create policy "Admins manage payment dispute evidence"
on public.payment_dispute_evidence
for all
to authenticated
using (private.has_role((select auth.uid()),'admin'::app_role))
with check (private.has_role((select auth.uid()),'admin'::app_role));

revoke all on public.payment_events from anon,authenticated;
revoke all on public.payment_reconcile_requests from anon;
revoke all on public.payment_refunds from anon;
revoke all on public.payment_disputes from anon;
revoke all on public.payment_dispute_evidence from anon;

grant select on public.payment_events to authenticated;
grant select,insert,update on public.payment_reconcile_requests to authenticated;
grant select,insert,update on public.payment_refunds to authenticated;
grant select,insert,update on public.payment_disputes to authenticated;
grant select,insert,update,delete on public.payment_dispute_evidence to authenticated;

create or replace function public.get_payments_manager(
  p_query text default null,
  p_status text default null,
  p_method text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_status text := upper(btrim(coalesce(p_status,'')));
  v_method text := lower(btrim(coalesce(p_method,'')));
  v_limit integer := greatest(1,least(coalesce(p_limit,100),200));
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  with filtered as (
    select p.*,pr.username,pr.avatar_url
    from public.payments p
    left join public.profiles pr on pr.user_id=p.user_id
    where
      (v_status='' or upper(p.status)=v_status)
      and (v_method='' or lower(coalesce(p.payment_method,''))=v_method)
      and (
        v_query=''
        or lower(p.id::text) like '%'||v_query||'%'
        or lower(coalesce(p.charge_id,'')) like '%'||v_query||'%'
        or lower(p.user_id::text) like '%'||v_query||'%'
        or lower(coalesce(pr.username,'')) like '%'||v_query||'%'
        or lower(coalesce(p.idempotency_key,'')) like '%'||v_query||'%'
      )
  ),
  page as (
    select * from filtered
    order by created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'total',(select count(*)::int from filtered),
      'completed',(select count(*)::int from filtered where status='COMPLETED'),
      'active',(select count(*)::int from filtered where status in ('CREATING','ACTIVE','FULFILLING')),
      'failed',(select count(*)::int from filtered where status in ('FAILED','EXPIRED','CANCELLED')),
      'gross_completed_cents',coalesce((select sum(amount)::bigint from filtered where status='COMPLETED'),0),
      'needs_reconcile',coalesce((
        select count(*)::int
        from filtered f
        where
          (f.status='FULFILLING' and f.updated_at < now()-interval '5 minutes')
          or (f.status='ACTIVE' and f.expires_at is not null and f.expires_at < now())
          or exists(
            select 1 from public.payment_reconcile_requests rr
            where rr.payment_id=f.id and rr.status in ('queued','running','failed')
          )
      ),0),
      'open_disputes',coalesce((
        select count(*)::int
        from public.payment_disputes d
        where d.status in ('open','under_review')
          and d.payment_id in (select id from filtered)
      ),0),
      'refund_cases',coalesce((
        select count(*)::int
        from public.payment_refunds r
        where r.payment_id in (select id from filtered)
          and r.status not in ('cancelled')
      ),0)
    ),
    'methods',coalesce((
      select jsonb_agg(jsonb_build_object(
        'method',s.method,
        'label',s.label,
        'enabled',s.enabled,
        'updated_at',s.updated_at
      ) order by s.method)
      from public.payment_settings s
    ),'[]'::jsonb),
    'payments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'user_id',p.user_id,
        'username',coalesce(p.username,'Cliente'),
        'avatar_url',p.avatar_url,
        'amount_cents',p.amount,
        'discount_amount',p.discount_amount,
        'status',p.status,
        'payment_method',p.payment_method,
        'charge_reference',case
          when p.charge_id is null then null
          when char_length(p.charge_id)<=14 then p.charge_id
          else left(p.charge_id,8)||'…'||right(p.charge_id,4)
        end,
        'idempotency_reference',case
          when p.idempotency_key is null then null
          when char_length(p.idempotency_key)<=18 then p.idempotency_key
          else left(p.idempotency_key,12)||'…'
        end,
        'created_at',p.created_at,
        'paid_at',p.paid_at,
        'expires_at',p.expires_at,
        'updated_at',p.updated_at,
        'event_count',(select count(*)::int from public.payment_events e where e.payment_id=p.id),
        'last_event',(
          select jsonb_build_object(
            'event_type',e.event_type,
            'severity',e.severity,
            'created_at',e.created_at
          )
          from public.payment_events e
          where e.payment_id=p.id
          order by e.created_at desc
          limit 1
        ),
        'reconcile_status',(
          select rr.status
          from public.payment_reconcile_requests rr
          where rr.payment_id=p.id
          order by rr.requested_at desc
          limit 1
        ),
        'refund_count',(select count(*)::int from public.payment_refunds r where r.payment_id=p.id),
        'dispute_count',(select count(*)::int from public.payment_disputes d where d.payment_id=p.id),
        'attention',(
          (p.status='FULFILLING' and p.updated_at < now()-interval '5 minutes')
          or (p.status='ACTIVE' and p.expires_at is not null and p.expires_at < now())
          or exists(
            select 1 from public.payment_reconcile_requests rr
            where rr.payment_id=p.id and rr.status='failed'
          )
        )
      ) order by p.created_at desc)
      from page p
    ),'[]'::jsonb),
    'limit',v_limit,
    'offset',v_offset
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_payment_manager_detail(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_payment public.payments;
  v_username text;
  v_avatar text;
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_payment from public.payments where id=p_payment_id;
  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  select username,avatar_url into v_username,v_avatar
  from public.profiles
  where user_id=v_payment.user_id
  limit 1;

  select jsonb_build_object(
    'payment',jsonb_build_object(
      'id',v_payment.id,
      'user_id',v_payment.user_id,
      'username',coalesce(v_username,'Cliente'),
      'avatar_url',v_avatar,
      'amount_cents',v_payment.amount,
      'discount_amount',v_payment.discount_amount,
      'status',v_payment.status,
      'payment_method',v_payment.payment_method,
      'charge_reference',case
        when v_payment.charge_id is null then null
        when char_length(v_payment.charge_id)<=14 then v_payment.charge_id
        else left(v_payment.charge_id,8)||'…'||right(v_payment.charge_id,4)
      end,
      'idempotency_reference',case
        when v_payment.idempotency_key is null then null
        when char_length(v_payment.idempotency_key)<=18 then v_payment.idempotency_key
        else left(v_payment.idempotency_key,12)||'…'
      end,
      'created_at',v_payment.created_at,
      'paid_at',v_payment.paid_at,
      'expires_at',v_payment.expires_at,
      'updated_at',v_payment.updated_at
    ),
    'cart',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id',item->>'productId',
        'product_name',item->>'productName',
        'plan_id',item->>'planId',
        'plan_name',item->>'planName',
        'plan_code',item->>'planCode',
        'quantity',greatest(1,coalesce(nullif(item->>'quantity','')::integer,1)),
        'price',coalesce(nullif(item->>'price','')::numeric,0),
        'type',coalesce(item->>'type','product')
      ))
      from jsonb_array_elements(
        case when jsonb_typeof(v_payment.cart_snapshot)='array'
          then v_payment.cart_snapshot else '[]'::jsonb end
      ) item
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'source',e.source,
        'event_type',e.event_type,
        'severity',e.severity,
        'status_before',e.status_before,
        'status_after',e.status_after,
        'provider_status',e.provider_status,
        'amount_cents',e.amount_cents,
        'http_status',e.http_status,
        'detail',e.detail,
        'created_at',e.created_at
      ) order by e.created_at desc)
      from public.payment_events e
      where e.payment_id=v_payment.id
    ),'[]'::jsonb),
    'reconciliations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'reason',r.reason,
        'status',r.status,
        'provider_status',r.provider_status,
        'status_before',r.status_before,
        'status_after',r.status_after,
        'last_error_code',r.last_error_code,
        'requested_at',r.requested_at,
        'started_at',r.started_at,
        'finished_at',r.finished_at
      ) order by r.requested_at desc)
      from public.payment_reconcile_requests r
      where r.payment_id=v_payment.id
    ),'[]'::jsonb),
    'refunds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'amount_cents',r.amount_cents,
        'reason',r.reason,
        'status',r.status,
        'provider_ref',case
          when r.provider_ref is null then null
          when char_length(r.provider_ref)<=14 then r.provider_ref
          else left(r.provider_ref,8)||'…'||right(r.provider_ref,4)
        end,
        'provider_status',r.provider_status,
        'last_error_code',r.last_error_code,
        'requested_at',r.requested_at,
        'completed_at',r.completed_at
      ) order by r.requested_at desc)
      from public.payment_refunds r
      where r.payment_id=v_payment.id
    ),'[]'::jsonb),
    'disputes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,
        'provider_ref',case
          when d.provider_ref is null then null
          when char_length(d.provider_ref)<=14 then d.provider_ref
          else left(d.provider_ref,8)||'…'||right(d.provider_ref,4)
        end,
        'status',d.status,
        'reason',d.reason,
        'amount_cents',d.amount_cents,
        'opened_at',d.opened_at,
        'due_at',d.due_at,
        'resolved_at',d.resolved_at,
        'evidence_count',(select count(*)::int from public.payment_dispute_evidence de where de.dispute_id=d.id)
      ) order by d.opened_at desc)
      from public.payment_disputes d
      where d.payment_id=v_payment.id
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.request_payment_reconciliation(
  p_payment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.payment_reconcile_requests;
  v_row public.payment_reconcile_requests;
  v_status text;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select status into v_status from public.payments where id=p_payment_id;
  if v_status is null then raise exception 'PAYMENT_NOT_FOUND'; end if;

  select * into v_existing
  from public.payment_reconcile_requests
  where payment_id=p_payment_id and status in ('queued','running')
  order by requested_at desc
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'existing',true);
  end if;

  insert into public.payment_reconcile_requests(
    payment_id,requested_by,reason,status,status_before
  )
  values(
    p_payment_id,v_user,nullif(left(btrim(coalesce(p_reason,'')),500),''),'queued',v_status
  )
  returning * into v_row;

  insert into public.payment_events(
    payment_id,source,event_type,severity,status_before,detail
  )
  values(
    p_payment_id,'admin','reconcile.requested','info',v_status,
    jsonb_build_object('request_id',v_row.id)
  );

  return jsonb_build_object('id',v_row.id,'status',v_row.status,'existing',false);
end;
$$;

create or replace function public.set_payment_method_enabled(
  p_method text,
  p_enabled boolean
)
returns boolean
language plpgsql
security invoker
set search_path=public,private,auth,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(btrim(p_method)) not in ('pix','card','crypto') then
    raise exception 'INVALID_METHOD';
  end if;

  update public.payment_settings
  set enabled=p_enabled,updated_at=now()
  where method=lower(btrim(p_method));

  if not found then
    raise exception 'METHOD_NOT_FOUND';
  end if;

  return true;
end;
$$;

revoke execute on function public.get_payments_manager(text,text,text,integer,integer)
  from public,anon;
revoke execute on function public.get_payment_manager_detail(uuid)
  from public,anon;
revoke execute on function public.request_payment_reconciliation(uuid,text)
  from public,anon;
revoke execute on function public.set_payment_method_enabled(text,boolean)
  from public,anon;

grant execute on function public.get_payments_manager(text,text,text,integer,integer)
  to authenticated;
grant execute on function public.get_payment_manager_detail(uuid)
  to authenticated;
grant execute on function public.request_payment_reconciliation(uuid,text)
  to authenticated;
grant execute on function public.set_payment_method_enabled(text,boolean)
  to authenticated;
