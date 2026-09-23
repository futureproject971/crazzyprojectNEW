
-- M31-M38 admin operations batch: Customer 360, Community Mod, Resellers, Luck admin, Coupons.

create or replace function public.admin_customer_search(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_limit integer := greatest(1, least(coalesce(p_limit,50),100));
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select
        p.user_id,
        p.username,
        p.avatar_url,
        p.banned,
        p.banned_at,
        p.created_at,
        u.email,
        u.last_sign_in_at,
        di.discord_user_id,
        di.username as discord_username,
        di.global_name as discord_global_name,
        di.avatar_url as discord_avatar_url,
        coalesce(di.guild_member,false) as guild_member,
        coalesce((
          select array_agg(ur.role::text order by ur.role::text)
          from public.user_roles ur
          where ur.user_id=p.user_id
        ), array[]::text[]) as roles,
        (select count(*)::int from public.payments pay where pay.user_id=p.user_id) as payment_count,
        (select count(*)::int from public.payments pay where pay.user_id=p.user_id and pay.status='COMPLETED') as completed_payment_count,
        coalesce((select sum(pay.amount)::bigint from public.payments pay where pay.user_id=p.user_id and pay.status='COMPLETED'),0) as paid_total_cents,
        (select count(*)::int from public.entitlements e where e.user_id=p.user_id and e.status='active' and (e.expires_at is null or e.expires_at>now())) as active_entitlements,
        (select count(*)::int from public.support_tickets st where st.user_id=p.user_id and st.status not in ('resolved','closed')) as open_tickets
      from public.profiles p
      left join auth.users u on u.id=p.user_id
      left join public.discord_identities di on di.user_id=p.user_id
      where v_query=''
         or lower(coalesce(p.username,'')) like '%'||v_query||'%'
         or lower(coalesce(u.email,'')) like '%'||v_query||'%'
         or lower(coalesce(di.username,'')) like '%'||v_query||'%'
         or lower(coalesce(di.global_name,'')) like '%'||v_query||'%'
         or coalesce(di.discord_user_id,'') like '%'||v_query||'%'
         or p.user_id::text like '%'||v_query||'%'
      order by p.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_customer_search(text,integer) from public, anon;
grant execute on function public.admin_customer_search(text,integer) to authenticated;

create or replace function public.admin_customer_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', p.user_id,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'banned', p.banned,
      'banned_at', p.banned_at,
      'banned_reason', p.banned_reason,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'email', u.email,
      'last_sign_in_at', u.last_sign_in_at
    ),
    'discord', case when di.user_id is null then null else jsonb_build_object(
      'discord_user_id', di.discord_user_id,
      'username', di.username,
      'global_name', di.global_name,
      'avatar_url', di.avatar_url,
      'guild_id', di.guild_id,
      'guild_member', di.guild_member,
      'guild_verified_at', di.guild_verified_at,
      'last_checked_at', di.last_checked_at
    ) end,
    'roles', coalesce((
      select jsonb_agg(ur.role::text order by ur.role::text)
      from public.user_roles ur where ur.user_id=p_user_id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'payment_count', (select count(*)::int from public.payments pay where pay.user_id=p_user_id),
      'completed_payment_count', (select count(*)::int from public.payments pay where pay.user_id=p_user_id and pay.status='COMPLETED'),
      'paid_total_cents', coalesce((select sum(pay.amount)::bigint from public.payments pay where pay.user_id=p_user_id and pay.status='COMPLETED'),0),
      'active_entitlements', (select count(*)::int from public.entitlements e where e.user_id=p_user_id and e.status='active' and (e.expires_at is null or e.expires_at>now())),
      'deliveries', (select count(*)::int from public.library_deliveries ld where ld.user_id=p_user_id),
      'open_tickets', (select count(*)::int from public.support_tickets st where st.user_id=p_user_id and st.status not in ('resolved','closed')),
      'discord_roles', (select count(*)::int from public.discord_role_grants drg where drg.user_id=p_user_id and drg.status='granted')
    ),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, charge_id, amount, status, payment_method, paid_at, created_at, updated_at
        from public.payments
        where user_id=p_user_id
        order by created_at desc
        limit 30
      ) x
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          ot.id, ot.status, ot.status_label, ot.payment_id, ot.created_at, ot.updated_at,
          pr.name as product_name, pp.name as plan_name
        from public.order_tickets ot
        join public.products pr on pr.id=ot.product_id
        join public.product_plans pp on pp.id=ot.product_plan_id
        where ot.user_id=p_user_id
        order by ot.created_at desc
        limit 30
      ) x
    ), '[]'::jsonb),
    'entitlements', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          e.id, e.status, e.starts_at, e.expires_at, e.tutorial_access, e.created_at,
          pr.name as product_name, pp.name as plan_name, pp.plan_code
        from public.entitlements e
        join public.products pr on pr.id=e.product_id
        left join public.product_plans pp on pp.id=e.product_plan_id
        where e.user_id=p_user_id
        order by e.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.delivered_at desc)
      from (
        select
          ld.id, ld.delivery_type, ld.status, ld.delivered_at, ld.expires_at,
          ld.reveal_count, ld.last_revealed_at,
          pr.name as product_name, pp.name as plan_name
        from public.library_deliveries ld
        left join public.products pr on pr.id=ld.product_id
        left join public.product_plans pp on pp.id=ld.product_plan_id
        where ld.user_id=p_user_id
        order by ld.delivered_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from (
        select id, subject, category, status, priority, assigned_to, last_message_at, created_at, updated_at
        from public.support_tickets
        where user_id=p_user_id
        order by updated_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'discord_role_grants', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, role_id, role_name, status, granted_at, revoked_at, last_error_code, created_at, updated_at
        from public.discord_role_grants
        where user_id=p_user_id
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb)
  )
  into v_result
  from public.profiles p
  left join auth.users u on u.id=p.user_id
  left join public.discord_identities di on di.user_id=p.user_id
  where p.user_id=p_user_id;

  if v_result is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_customer_snapshot(uuid) from public, anon;
grant execute on function public.admin_customer_snapshot(uuid) to authenticated;

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  message_id uuid references public.community_messages(id) on delete set null,
  action text not null check (action in ('delete_message','ban_user','unban_user')),
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.community_moderation_actions enable row level security;
drop policy if exists "Community moderation visible to staff" on public.community_moderation_actions;
create policy "Community moderation visible to staff"
on public.community_moderation_actions
for select
to authenticated
using (
  private.has_role((select auth.uid()), 'admin'::public.app_role)
  or private.has_role((select auth.uid()), 'moderator'::public.app_role)
);
revoke all on table public.community_moderation_actions from anon;
grant select on table public.community_moderation_actions to authenticated;
grant all on table public.community_moderation_actions to service_role;
create index if not exists community_moderation_actions_created_idx
on public.community_moderation_actions(created_at desc);
create index if not exists community_moderation_actions_target_idx
on public.community_moderation_actions(target_user_id, created_at desc);
create index if not exists community_moderation_actions_message_idx
on public.community_moderation_actions(message_id, created_at desc);

alter table public.resellers add column if not exists notes text;
alter table public.resellers add column if not exists updated_at timestamptz not null default now();
create unique index if not exists reseller_products_reseller_product_unique
on public.reseller_products(reseller_id, product_id);

create or replace function public.admin_upsert_reseller(
  p_user_id uuid,
  p_discount_percent numeric,
  p_active boolean,
  p_expires_at timestamptz default null,
  p_notes text default null,
  p_product_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_reseller public.resellers;
  v_discount numeric := round(coalesce(p_discount_percent,0),2);
  v_product uuid;
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_user_id is null or not exists(select 1 from public.profiles p where p.user_id=p_user_id) then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;
  if v_discount < 0 or v_discount > 80 then raise exception 'INVALID_DISCOUNT'; end if;

  insert into public.resellers(user_id,discount_percent,active,expires_at,notes,updated_at)
  values(p_user_id,v_discount,coalesce(p_active,true),p_expires_at,nullif(btrim(coalesce(p_notes,'')),''),now())
  on conflict (user_id)
  do update set discount_percent=excluded.discount_percent,active=excluded.active,expires_at=excluded.expires_at,notes=excluded.notes,updated_at=now()
  returning * into v_reseller;

  delete from public.reseller_products
  where reseller_id=v_reseller.id
    and not (product_id = any(coalesce(p_product_ids,array[]::uuid[])));

  foreach v_product in array coalesce(p_product_ids,array[]::uuid[])
  loop
    if not exists(select 1 from public.products p where p.id=v_product) then raise exception 'PRODUCT_NOT_FOUND'; end if;
    insert into public.reseller_products(reseller_id,product_id)
    values(v_reseller.id,v_product)
    on conflict (reseller_id,product_id) do nothing;
  end loop;

  return to_jsonb(v_reseller);
end;
$$;
revoke all on function public.admin_upsert_reseller(uuid,numeric,boolean,timestamptz,text,uuid[]) from public, anon;
grant execute on function public.admin_upsert_reseller(uuid,numeric,boolean,timestamptz,text,uuid[]) to authenticated;

create or replace function public.get_my_reseller_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_reseller public.resellers;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_reseller from public.resellers r where r.user_id=v_user;
  if v_reseller.id is null then
    return jsonb_build_object('reseller',null,'products','[]'::jsonb,'purchases','[]'::jsonb);
  end if;

  return jsonb_build_object(
    'reseller', jsonb_build_object(
      'id',v_reseller.id,'discount_percent',v_reseller.discount_percent,'active',v_reseller.active,
      'expires_at',v_reseller.expires_at,'total_purchases',v_reseller.total_purchases,
      'created_at',v_reseller.created_at,'updated_at',v_reseller.updated_at,
      'eligible',v_reseller.active and (v_reseller.expires_at is null or v_reseller.expires_at>now())
    ),
    'products', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.product_name,x.plan_sort,x.plan_name)
      from (
        select p.id as product_id,p.slug,p.name as product_name,p.image_url,p.status,p.status_label,
               pp.id as plan_id,pp.name as plan_name,pp.plan_code,pp.price as public_price,
               round(pp.price * (1 - v_reseller.discount_percent / 100),2) as reseller_price,
               pp.sort_order as plan_sort
        from public.reseller_products rp
        join public.products p on p.id=rp.product_id and p.active=true
        join public.product_plans pp on pp.product_id=p.id and pp.active=true
        where rp.reseller_id=v_reseller.id
      ) x
    ),'[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select rp.id,rp.original_price,rp.paid_price,rp.created_at,p.name as product_name,pp.name as plan_name,pp.plan_code
        from public.reseller_purchases rp
        join public.product_plans pp on pp.id=rp.product_plan_id
        join public.products p on p.id=pp.product_id
        where rp.reseller_id=v_reseller.id
        order by rp.created_at desc
        limit 100
      ) x
    ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_my_reseller_snapshot() from public, anon;
grant execute on function public.get_my_reseller_snapshot() to authenticated;

drop policy if exists "Admins can view all luck campaigns" on public.luck_campaigns;
create policy "Admins can view all luck campaigns" on public.luck_campaigns for select to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins insert luck campaigns" on public.luck_campaigns;
create policy "Admins insert luck campaigns" on public.luck_campaigns for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins update luck campaigns" on public.luck_campaigns;
create policy "Admins update luck campaigns" on public.luck_campaigns for update to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins delete luck campaigns" on public.luck_campaigns;
create policy "Admins delete luck campaigns" on public.luck_campaigns for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins can view all luck prizes" on public.luck_prizes;
create policy "Admins can view all luck prizes" on public.luck_prizes for select to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins insert luck prizes" on public.luck_prizes;
create policy "Admins insert luck prizes" on public.luck_prizes for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins update luck prizes" on public.luck_prizes;
create policy "Admins update luck prizes" on public.luck_prizes for update to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));
drop policy if exists "Admins delete luck prizes" on public.luck_prizes;
create policy "Admins delete luck prizes" on public.luck_prizes for delete to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role));
grant select,insert,update,delete on public.luck_campaigns to authenticated;
grant select,insert,update,delete on public.luck_prizes to authenticated;

create unique index if not exists coupon_products_coupon_product_unique_idx
on public.coupon_products(coupon_id,product_id);

create or replace function public.admin_upsert_coupon(
  p_id uuid,
  p_code text,
  p_discount_type text,
  p_discount_value numeric,
  p_max_uses integer,
  p_min_order_value numeric,
  p_active boolean,
  p_expires_at timestamptz,
  p_origin text,
  p_product_ids uuid[] default array[]::uuid[],
  p_user_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
declare
  v_coupon public.coupons;
  v_product uuid;
  v_user uuid;
  v_code text := upper(btrim(coalesce(p_code,'')));
  v_type text := lower(btrim(coalesce(p_discount_type,'')));
  v_origin text := lower(btrim(coalesce(p_origin,'admin')));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'ADMIN_REQUIRED'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'INVALID_COUPON_CODE'; end if;
  if v_type not in ('percentage','fixed') then raise exception 'INVALID_DISCOUNT_TYPE'; end if;
  if p_discount_value is null or p_discount_value <= 0 then raise exception 'INVALID_DISCOUNT_VALUE'; end if;
  if v_type='percentage' and p_discount_value > 100 then raise exception 'INVALID_DISCOUNT_VALUE'; end if;
  if p_max_uses is not null and p_max_uses < 1 then raise exception 'INVALID_MAX_USES'; end if;
  if coalesce(p_min_order_value,0) < 0 then raise exception 'INVALID_MIN_ORDER'; end if;
  if v_origin not in ('promotion','reward','wheel','scratch','drop','admin','manual','other') then raise exception 'INVALID_COUPON_ORIGIN'; end if;

  if p_id is null then
    insert into public.coupons(code,discount_type,discount_value,max_uses,min_order_value,active,expires_at,origin,metadata)
    values(v_code,v_type,p_discount_value,p_max_uses,coalesce(p_min_order_value,0),coalesce(p_active,true),p_expires_at,v_origin,jsonb_build_object('managed_by','coupon_manager'))
    returning * into v_coupon;
  else
    update public.coupons
    set code=v_code,discount_type=v_type,discount_value=p_discount_value,max_uses=p_max_uses,min_order_value=coalesce(p_min_order_value,0),
        active=coalesce(p_active,true),expires_at=p_expires_at,origin=v_origin,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('managed_by','coupon_manager')
    where id=p_id
    returning * into v_coupon;
    if v_coupon.id is null then raise exception 'COUPON_NOT_FOUND'; end if;
  end if;

  delete from public.coupon_products
  where coupon_id=v_coupon.id
    and not (product_id = any(coalesce(p_product_ids,array[]::uuid[])));

  foreach v_product in array coalesce(p_product_ids,array[]::uuid[])
  loop
    if not exists(select 1 from public.products p where p.id=v_product) then raise exception 'PRODUCT_NOT_FOUND'; end if;
    insert into public.coupon_products(coupon_id,product_id)
    values(v_coupon.id,v_product)
    on conflict (coupon_id,product_id) do nothing;
  end loop;

  delete from public.coupon_users
  where coupon_id=v_coupon.id
    and not (user_id = any(coalesce(p_user_ids,array[]::uuid[])));

  foreach v_user in array coalesce(p_user_ids,array[]::uuid[])
  loop
    if not exists(select 1 from public.profiles p where p.user_id=v_user) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
    insert into public.coupon_users(coupon_id,user_id)
    values(v_coupon.id,v_user)
    on conflict (coupon_id,user_id) do nothing;
  end loop;

  return jsonb_build_object(
    'coupon',to_jsonb(v_coupon),
    'product_ids',to_jsonb(coalesce(p_product_ids,array[]::uuid[])),
    'user_ids',to_jsonb(coalesce(p_user_ids,array[]::uuid[]))
  );
end;
$$;

revoke all on function public.admin_upsert_coupon(uuid,text,text,numeric,integer,numeric,boolean,timestamptz,text,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_upsert_coupon(uuid,text,text,numeric,integer,numeric,boolean,timestamptz,text,uuid[],uuid[]) to authenticated;
