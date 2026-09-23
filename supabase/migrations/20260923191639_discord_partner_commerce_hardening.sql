-- CRAZZY PROJECT production hardening: public catalog, partner attribution/commission,
-- checkout reservation safety, reseller idempotency, Discord-only support and admin scaling.
-- Generated from the verified live definitions after advisor review.

create schema if not exists private;

-- Public product slugs.
CREATE OR REPLACE FUNCTION private.normalize_store_slug(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_value,'')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$function$
;

alter table public.products add column if not exists slug text;

with bases as (
  select p.id,
         case
           when private.normalize_store_slug(coalesce(p.slug,p.name))='' then 'produto'
           else private.normalize_store_slug(coalesce(p.slug,p.name))
         end as base,
         row_number() over (
           partition by case
             when private.normalize_store_slug(coalesce(p.slug,p.name))='' then 'produto'
             else private.normalize_store_slug(coalesce(p.slug,p.name))
           end
           order by p.created_at,p.id
         ) as rn
  from public.products p
  where p.slug is null or btrim(p.slug)=''
)
update public.products p
set slug=case when b.rn=1 then b.base else b.base||'-'||left(p.id::text,8) end
from bases b
where b.id=p.id;

alter table public.products alter column slug set not null;
create unique index if not exists products_slug_unique_idx on public.products(slug);
CREATE OR REPLACE FUNCTION private.ensure_product_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_base text;
  v_candidate text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    v_base := private.normalize_store_slug(new.name);
    if v_base = '' then v_base := 'produto'; end if;
    v_candidate := v_base;

    if exists (
      select 1 from public.products p
      where p.slug = v_candidate and p.id <> new.id
    ) then
      v_candidate := v_base || '-' || left(new.id::text, 8);
    end if;

    new.slug := v_candidate;
  else
    new.slug := private.normalize_store_slug(new.slug);
    if new.slug = '' then
      raise exception 'INVALID_PRODUCT_SLUG';
    end if;
  end if;
  return new;
end;
$function$
;

drop trigger if exists products_ensure_slug on public.products;
create trigger products_ensure_slug
before insert or update of name,slug on public.products
for each row execute function private.ensure_product_slug();

-- Restore explicit public Data API reads without making anon execute private.has_role().
grant select on public.games,public.products,public.product_plans,public.product_media,public.product_features
to anon,authenticated;

drop policy if exists "Public reads active games" on public.games;
drop policy if exists "Anon reads active games" on public.games;
drop policy if exists "Authenticated reads active games or admin" on public.games;
create policy "Anon reads active games" on public.games for select to anon using(active=true);
create policy "Authenticated reads active games or admin" on public.games for select to authenticated
using(active=true or private.has_role((select auth.uid()),'admin'::public.app_role));

drop policy if exists "Public reads active products" on public.products;
drop policy if exists "Anon reads active products" on public.products;
drop policy if exists "Authenticated reads active products or admin" on public.products;
create policy "Anon reads active products" on public.products for select to anon using(active=true);
create policy "Authenticated reads active products or admin" on public.products for select to authenticated
using(active=true or private.has_role((select auth.uid()),'admin'::public.app_role));

drop policy if exists "Public reads active plans" on public.product_plans;
drop policy if exists "Anon reads active plans" on public.product_plans;
drop policy if exists "Authenticated reads active plans or admin" on public.product_plans;
create policy "Anon reads active plans" on public.product_plans for select to anon
using(active=true and exists(
  select 1 from public.products p where p.id=product_plans.product_id and p.active=true
));
create policy "Authenticated reads active plans or admin" on public.product_plans for select to authenticated
using(
  (active=true and exists(
    select 1 from public.products p where p.id=product_plans.product_id and p.active=true
  ))
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

drop policy if exists "Public reads media of active products" on public.product_media;
drop policy if exists "Anon reads media of active products" on public.product_media;
drop policy if exists "Authenticated reads media of active products or admin" on public.product_media;
create policy "Anon reads media of active products" on public.product_media for select to anon
using(exists(select 1 from public.products p where p.id=product_media.product_id and p.active=true));
create policy "Authenticated reads media of active products or admin" on public.product_media for select to authenticated
using(
  exists(select 1 from public.products p where p.id=product_media.product_id and p.active=true)
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

drop policy if exists "Public reads features of active products" on public.product_features;
drop policy if exists "Anon reads features of active products" on public.product_features;
drop policy if exists "Authenticated reads features of active products or admin" on public.product_features;
create policy "Anon reads features of active products" on public.product_features for select to anon
using(exists(select 1 from public.products p where p.id=product_features.product_id and p.active=true));
create policy "Authenticated reads features of active products or admin" on public.product_features for select to authenticated
using(
  exists(select 1 from public.products p where p.id=product_features.product_id and p.active=true)
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

grant execute on function public.get_public_categories() to anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_public_store_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(item order by (item->>'sort_order')::int, item->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'name', p.name,
      'description', p.description,
      'features_text', p.features_text,
      'image_url', p.image_url,
      'is_new', p.is_new,
      'status', p.status,
      'status_label', p.status_label,
      'emoji', p.emoji,
      'accent_color', p.accent_color,
      'sort_order', p.sort_order,
      'created_at', p.created_at,
      'game', jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'slug', g.slug,
        'description', g.description,
        'image_url', g.image_url,
        'icon_url', g.icon_url,
        'emoji', g.emoji,
        'accent_color', g.accent_color
      ),
      'plans', coalesce(plans.items, '[]'::jsonb),
      'media', coalesce(media.items, '[]'::jsonb),
      'features', coalesce(features.items, '[]'::jsonb)
    ) as item
    from public.products p
    join public.games g on g.id=p.game_id and g.active=true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', z.id,
          'name', z.name,
          'price', z.price,
          'plan_code', z.plan_code,
          'sort_order', z.sort_order,
          'show_when_out_of_stock', z.show_when_out_of_stock,
          'emoji', z.emoji,
          'accent_color', z.accent_color,
          'stock_managed', z.stock_managed,
          'stock_count', z.stock_count
        )
        order by z.sort_order, z.name
      ) as items
      from (
        select
          pp.id,
          pp.name,
          pp.price,
          pp.plan_code,
          pp.sort_order,
          pp.show_when_out_of_stock,
          pp.emoji,
          pp.accent_color,
          coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' as stock_managed,
          case
            when coalesce(ppo.delivery_mode,'internal_stock')='internal_stock' then (
              select count(*)::int
              from public.stock_items si
              where si.product_plan_id=pp.id
                and si.used=false
                and si.disabled=false
                and not exists (
                  select 1
                  from public.stock_reservations sr
                  where sr.stock_item_id=si.id
                    and sr.status='reserved'
                    and sr.expires_at>now()
                )
            )
            else null
          end as stock_count
        from public.product_plans pp
        left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
        where pp.product_id=p.id and pp.active=true
      ) z
      where z.stock_managed=false
         or coalesce(z.stock_count,0)>0
         or z.show_when_out_of_stock=true
    ) plans on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'media_type', pm.media_type,
          'url', pm.url,
          'sort_order', pm.sort_order
        )
        order by pm.sort_order,pm.created_at
      ) as items
      from public.product_media pm
      where pm.product_id=p.id
    ) media on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', pf.id,
          'label', pf.label,
          'value', pf.value,
          'sort_order', pf.sort_order
        )
        order by pf.sort_order,pf.created_at
      ) as items
      from public.product_features pf
      where pf.product_id=p.id
    ) features on true
    where p.active=true
  ) q;
$function$
;

revoke all on function public.get_public_store_catalog() from public;
grant execute on function public.get_public_store_catalog() to anon,authenticated,service_role;

-- Product plan operations: ghost_stock is an explicit non-key, support-ticket delivery mode.
CREATE OR REPLACE FUNCTION public.save_product_manager_plan(p_plan_id uuid, p_name text, p_price numeric, p_active boolean, p_sort_order integer, p_plan_code text, p_show_when_out_of_stock boolean, p_emoji text, p_accent_color text, p_delivery_mode text, p_discord_role_id text, p_discord_role_name text, p_discord_role_color text, p_discord_role_position integer, p_entitlement_duration_minutes integer, p_supplier_provider text, p_supplier_product_id text, p_supplier_variation_id text, p_automation_flags jsonb, p_tutorial_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_row public.product_plans;
  v_tutorial uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 80 then
    raise exception 'INVALID_PLAN_NAME';
  end if;

  if p_price is null or p_price < 0 or p_price > 1000000 then
    raise exception 'INVALID_PRICE';
  end if;

  if p_delivery_mode not in ('internal_stock','ghost_stock','purincash_supplier','lzt_account','manual','service') then
    raise exception 'INVALID_DELIVERY_MODE';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ACCENT_COLOR';
  end if;

  if p_discord_role_color is not null and p_discord_role_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_DISCORD_ROLE_COLOR';
  end if;

  update public.product_plans
  set
    name=btrim(p_name),
    price=p_price,
    active=coalesce(p_active,true),
    sort_order=coalesce(p_sort_order,0),
    plan_code=nullif(btrim(coalesce(p_plan_code,'')),''),
    show_when_out_of_stock=coalesce(p_show_when_out_of_stock,false),
    emoji=nullif(btrim(coalesce(p_emoji,'')),''),
    accent_color=upper(nullif(btrim(coalesce(p_accent_color,'')),''))
  where id=p_plan_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  insert into private.product_plan_operations(
    product_plan_id,
    delivery_mode,
    discord_role_id,
    discord_role_name,
    discord_role_color,
    discord_role_position,
    entitlement_duration_minutes,
    supplier_provider,
    supplier_product_id,
    supplier_variation_id,
    automation_flags,
    updated_at
  )
  values(
    p_plan_id,
    p_delivery_mode,
    nullif(btrim(coalesce(p_discord_role_id,'')),''),
    nullif(btrim(coalesce(p_discord_role_name,'')),''),
    upper(nullif(btrim(coalesce(p_discord_role_color,'')),'')),
    p_discord_role_position,
    p_entitlement_duration_minutes,
    nullif(btrim(coalesce(p_supplier_provider,'')),''),
    nullif(btrim(coalesce(p_supplier_product_id,'')),''),
    nullif(btrim(coalesce(p_supplier_variation_id,'')),''),
    coalesce(p_automation_flags,'{}'::jsonb),
    now()
  )
  on conflict(product_plan_id) do update
  set delivery_mode=excluded.delivery_mode,
      discord_role_id=excluded.discord_role_id,
      discord_role_name=excluded.discord_role_name,
      discord_role_color=excluded.discord_role_color,
      discord_role_position=excluded.discord_role_position,
      entitlement_duration_minutes=excluded.entitlement_duration_minutes,
      supplier_provider=excluded.supplier_provider,
      supplier_product_id=excluded.supplier_product_id,
      supplier_variation_id=excluded.supplier_variation_id,
      automation_flags=excluded.automation_flags,
      updated_at=now();

  delete from public.academy_tutorial_plans
  where product_plan_id=p_plan_id;

  foreach v_tutorial in array coalesce(p_tutorial_ids,'{}'::uuid[]) loop
    insert into public.academy_tutorial_plans(tutorial_id,product_plan_id)
    values(v_tutorial,p_plan_id)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id',v_row.id);
end;
$function$
;


-- Reseller ledger is idempotent per paid cart unit.
alter table public.reseller_purchases add column if not exists payment_id uuid references public.payments(id) on delete set null;
alter table public.reseller_purchases add column if not exists payment_item_index integer;
alter table public.reseller_purchases add column if not exists payment_unit_index integer;
create unique index if not exists reseller_purchases_payment_unit_unique
on public.reseller_purchases(payment_id,payment_item_index,payment_unit_index)
where payment_id is not null and payment_item_index is not null and payment_unit_index is not null;

-- Partner/referral model.
create table if not exists public.partners(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique check(code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  display_name text not null,
  commission_percent numeric not null default 15 check(commission_percent>=0 and commission_percent<=50),
  attribution_days integer not null default 30 check(attribution_days between 1 and 90),
  commission_hold_days integer not null default 7 check(commission_hold_days between 0 and 90),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_plan_rules(
  partner_id uuid not null references public.partners(id) on delete cascade,
  product_plan_id uuid not null references public.product_plans(id) on delete cascade,
  enabled boolean not null default true,
  commission_percent numeric check(commission_percent is null or (commission_percent>=0 and commission_percent<=50)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(partner_id,product_plan_id)
);

create table if not exists public.partner_payouts(
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount_cents integer not null check(amount_cents>=0),
  status text not null default 'pending' check(status in ('pending','paid','cancelled')),
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.partner_commissions(
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  payment_item_index integer not null check(payment_item_index>=0),
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  product_plan_id uuid not null references public.product_plans(id),
  quantity integer not null default 1 check(quantity>0),
  eligible_amount_cents integer not null check(eligible_amount_cents>=0),
  commission_percent numeric not null check(commission_percent>=0 and commission_percent<=50),
  commission_amount_cents integer not null check(commission_amount_cents>=0),
  status text not null default 'pending' check(status in ('pending','available','paid','reversed')),
  available_at timestamptz,
  payout_id uuid references public.partner_payouts(id) on delete set null,
  reversed_at timestamptz,
  reverse_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id,payment_item_index,partner_id)
);
create index if not exists partner_commissions_partner_status_idx
on public.partner_commissions(partner_id,status,created_at desc);

create table if not exists public.partner_attributions(
  user_id uuid primary key references auth.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  source text not null default 'link',
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists partner_attributions_partner_expiry_idx
on public.partner_attributions(partner_id,expires_at desc);

alter table public.payments add column if not exists referral_partner_id uuid;
alter table public.payments add column if not exists referral_code text;
alter table public.payments add column if not exists referral_captured_at timestamptz;
do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.payments'::regclass
      and conname='payments_referral_partner_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_referral_partner_id_fkey
      foreign key(referral_partner_id) references public.partners(id) on delete set null;
  end if;
end $$;
create index if not exists payments_referral_partner_idx
on public.payments(referral_partner_id,created_at desc);

alter table public.partners enable row level security;
alter table public.partner_plan_rules enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_attributions enable row level security;

revoke all on public.partners,public.partner_plan_rules,public.partner_commissions,public.partner_payouts,public.partner_attributions
from anon,authenticated;
grant select on public.partners,public.partner_plan_rules,public.partner_commissions,public.partner_payouts,public.partner_attributions
to authenticated;
grant all on public.partners,public.partner_plan_rules,public.partner_commissions,public.partner_payouts,public.partner_attributions
to service_role;

drop policy if exists "Admins manage partners" on public.partners;
drop policy if exists "Partners read own account or admin" on public.partners;
create policy "Partners read own account or admin" on public.partners for select to authenticated
using(user_id=(select auth.uid()) or private.has_role((select auth.uid()),'admin'::public.app_role));

drop policy if exists "Admins manage partner plan rules" on public.partner_plan_rules;
drop policy if exists "Partners read own plan rules or admin" on public.partner_plan_rules;
create policy "Partners read own plan rules or admin" on public.partner_plan_rules for select to authenticated
using(
  exists(select 1 from public.partners p where p.id=partner_plan_rules.partner_id and p.user_id=(select auth.uid()))
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

drop policy if exists "Admins manage partner commissions" on public.partner_commissions;
drop policy if exists "Partners read own commissions or admin" on public.partner_commissions;
create policy "Partners read own commissions or admin" on public.partner_commissions for select to authenticated
using(
  exists(select 1 from public.partners p where p.id=partner_commissions.partner_id and p.user_id=(select auth.uid()))
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

drop policy if exists "Admins manage partner payouts" on public.partner_payouts;
drop policy if exists "Partners read own payouts or admin" on public.partner_payouts;
create policy "Partners read own payouts or admin" on public.partner_payouts for select to authenticated
using(
  exists(select 1 from public.partners p where p.id=partner_payouts.partner_id and p.user_id=(select auth.uid()))
  or private.has_role((select auth.uid()),'admin'::public.app_role)
);

drop policy if exists "Users read own partner attribution" on public.partner_attributions;
create policy "Users read own partner attribution" on public.partner_attributions for select to authenticated
using(user_id=(select auth.uid()) or private.has_role((select auth.uid()),'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.resolve_partner_referral(p_code text)
 RETURNS TABLE(partner_id uuid, code text, display_name text, attribution_days integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select p.id,p.code,p.display_name,p.attribution_days
  from public.partners p
  where p.active=true
    and p.code=lower(trim(coalesce(p_code,'')))
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.capture_my_partner_attribution(p_code text, p_source text DEFAULT 'link'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_partner public.partners;
  v_expires timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select *
    into v_partner
  from public.partners p
  where p.active=true
    and p.code=lower(trim(coalesce(p_code,'')))
  limit 1;

  if v_partner.id is null then
    raise exception 'PARTNER_NOT_FOUND';
  end if;

  if v_partner.user_id=v_user_id then
    raise exception 'SELF_REFERRAL_NOT_ALLOWED';
  end if;

  v_expires := now() + make_interval(days=>v_partner.attribution_days);

  insert into public.partner_attributions(
    user_id,partner_id,source,captured_at,expires_at,updated_at
  )
  values(
    v_user_id,v_partner.id,left(coalesce(nullif(trim(p_source),''),'link'),80),
    now(),v_expires,now()
  )
  on conflict(user_id) do update
  set partner_id=excluded.partner_id,
      source=excluded.source,
      captured_at=excluded.captured_at,
      expires_at=excluded.expires_at,
      updated_at=excluded.updated_at;

  return jsonb_build_object(
    'partner_id',v_partner.id,
    'code',v_partner.code,
    'display_name',v_partner.display_name,
    'expires_at',v_expires
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.capture_payment_partner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_attr public.partner_attributions;
  v_partner public.partners;
begin
  if new.referral_partner_id is not null then
    return new;
  end if;

  select *
    into v_attr
  from public.partner_attributions pa
  where pa.user_id=new.user_id
    and pa.expires_at>now()
  limit 1;

  if v_attr.partner_id is null then
    return new;
  end if;

  select *
    into v_partner
  from public.partners p
  where p.id=v_attr.partner_id
    and p.active=true
  limit 1;

  if v_partner.id is null or v_partner.user_id=new.user_id then
    return new;
  end if;

  new.referral_partner_id:=v_partner.id;
  new.referral_code:=v_partner.code;
  new.referral_captured_at:=v_attr.captured_at;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.refresh_partner_commissions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_count integer;
begin
  update public.partner_commissions
  set status='available',updated_at=now()
  where status='pending'
    and available_at is not null
    and available_at<=now();
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.reverse_partner_commissions(p_payment_id uuid, p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_count integer;
begin
  update public.partner_commissions
  set status='reversed',
      reversed_at=now(),
      reverse_reason=left(coalesce(p_reason,'reversed'),200),
      updated_at=now()
  where payment_id=p_payment_id
    and status in ('pending','available','paid');

  get diagnostics v_count=row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.record_partner_commissions(p_payment_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_payment public.payments;
  v_partner public.partners;
  v_item jsonb;
  v_index integer := -1;
  v_plan_id uuid;
  v_quantity integer;
  v_line_cents bigint;
  v_snapshot_cents bigint := 0;
  v_eligible_cents integer;
  v_percent numeric(5,2);
  v_delivery_mode text;
  v_inserted integer := 0;
  v_is_reseller boolean := false;
begin
  select * into v_payment
  from public.payments p
  where p.id=p_payment_id
  for update;

  if v_payment.id is null
     or upper(coalesce(v_payment.status,''))<>'COMPLETED'
     or v_payment.referral_partner_id is null
     or v_payment.amount<=0
     or jsonb_typeof(v_payment.cart_snapshot)<>'array' then
    return 0;
  end if;

  select * into v_partner
  from public.partners p
  where p.id=v_payment.referral_partner_id
    and p.active=true;

  if v_partner.id is null or v_partner.user_id=v_payment.user_id then
    return 0;
  end if;

  select exists(
    select 1
    from public.resellers r
    where r.user_id=v_payment.user_id
      and r.active=true
      and (r.expires_at is null or r.expires_at>coalesce(v_payment.paid_at,now()))
  ) into v_is_reseller;

  if v_is_reseller then
    return 0;
  end if;

  select coalesce(sum(
    greatest(0,round(coalesce((e.value->>'price')::numeric,0)*100)::bigint)
    * greatest(1,coalesce((e.value->>'quantity')::integer,1))
  ),0)
  into v_snapshot_cents
  from jsonb_array_elements(v_payment.cart_snapshot) e(value)
  where coalesce(e.value->>'type','')<>'lzt-account';

  if v_snapshot_cents<=0 then
    return 0;
  end if;

  for v_item in select value from jsonb_array_elements(v_payment.cart_snapshot)
  loop
    v_index:=v_index+1;

    if coalesce(v_item->>'type','')='lzt-account'
       or coalesce(v_item->>'planId','')='lzt-account' then
      continue;
    end if;

    begin
      v_plan_id:=(v_item->>'planId')::uuid;
    exception when others then
      continue;
    end;

    select
      coalesce(ppr.commission_percent,v_partner.commission_percent),
      coalesce(ppo.delivery_mode,'internal_stock')
    into v_percent,v_delivery_mode
    from public.partner_plan_rules ppr
    left join private.product_plan_operations ppo
      on ppo.product_plan_id=ppr.product_plan_id
    where ppr.partner_id=v_partner.id
      and ppr.product_plan_id=v_plan_id
      and ppr.enabled=true
    limit 1;

    if not found then
      continue;
    end if;

    -- Commission is only for plans explicitly enabled AND automatically delivered.
    if v_delivery_mode not in ('internal_stock','purincash_supplier') then
      continue;
    end if;

    v_quantity:=greatest(1,coalesce((v_item->>'quantity')::integer,1));
    v_line_cents:=greatest(0,round(coalesce((v_item->>'price')::numeric,0)*100)::bigint)*v_quantity;

    if v_line_cents<=0 or v_percent<=0 then
      continue;
    end if;

    -- Allocate final paid amount proportionally, so coupons/combo discounts reduce commission base.
    v_eligible_cents:=greatest(
      0,
      round(v_payment.amount::numeric * v_line_cents::numeric / v_snapshot_cents::numeric)::integer
    );

    insert into public.partner_commissions(
      partner_id,payment_id,payment_item_index,buyer_user_id,
      product_plan_id,quantity,eligible_amount_cents,
      commission_percent,commission_amount_cents,status,available_at,
      created_at,updated_at
    )
    values(
      v_partner.id,v_payment.id,v_index,v_payment.user_id,
      v_plan_id,v_quantity,v_eligible_cents,
      v_percent,round(v_eligible_cents*v_percent/100.0)::integer,
      case
        when coalesce(v_payment.paid_at,now()) + make_interval(days=>v_partner.commission_hold_days) <= now()
          then 'available'
        else 'pending'
      end,
      coalesce(v_payment.paid_at,now()) + make_interval(days=>v_partner.commission_hold_days),
      now(),now()
    )
    on conflict(payment_id,payment_item_index,partner_id) do nothing;

    if found then
      v_inserted:=v_inserted+1;
    end if;
  end loop;

  return v_inserted;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.on_payment_partner_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if upper(coalesce(new.status,''))='COMPLETED'
     and (tg_op='INSERT' or upper(coalesce(old.status,''))<>'COMPLETED') then
    perform private.record_partner_commissions(new.id);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.on_partner_refund_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin
  if new.status='completed'
     and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform private.reverse_partner_commissions(new.payment_id,'refund:'||new.id::text);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.on_partner_dispute_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin
  if new.status in ('open','under_review','lost') then
    perform private.reverse_partner_commissions(new.payment_id,'dispute:'||new.id::text||':'||new.status);
  elsif new.status in ('won','closed') and (tg_op='UPDATE' and old.status is distinct from new.status) then
    update public.partner_commissions pc
    set status=case when pc.available_at<=now() then 'available' else 'pending' end,
        reversed_at=null,
        reverse_reason=null,
        updated_at=now()
    where pc.payment_id=new.payment_id
      and pc.status='reversed'
      and pc.payout_id is null
      and pc.reverse_reason like 'dispute:'||new.id::text||':%';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_partner_search_users(p_query text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_q text:=lower(trim(coalesce(p_query,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,20),50));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if char_length(v_q)<2 then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',x.user_id,
      'username',x.profile_username,
      'avatar_url',x.profile_avatar,
      'discord_user_id',x.discord_user_id,
      'discord_username',x.discord_username,
      'discord_global_name',x.discord_global_name,
      'discord_avatar_url',x.discord_avatar,
      'guild_member',x.guild_member
    ) order by x.rank_key,x.profile_username nulls last)
    from (
      select
        coalesce(p.user_id,d.user_id) user_id,
        p.username profile_username,
        p.avatar_url profile_avatar,
        d.discord_user_id,
        d.username discord_username,
        d.global_name discord_global_name,
        d.avatar_url discord_avatar,
        d.guild_member,
        case
          when d.discord_user_id=v_q then 0
          when lower(coalesce(d.global_name,''))=v_q then 1
          when lower(coalesce(d.username,''))=v_q then 2
          when lower(coalesce(p.username,''))=v_q then 3
          else 4
        end rank_key
      from public.profiles p
      full join public.discord_identities d on d.user_id=p.user_id
      where lower(coalesce(p.username,'')) like v_q||'%'
         or lower(coalesce(d.username,'')) like v_q||'%'
         or lower(coalesce(d.global_name,'')) like v_q||'%'
         or coalesce(d.discord_user_id,'')=v_q
      limit v_limit
    ) x
  ),'[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_partner_manager_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  perform private.refresh_partner_commissions();

  return jsonb_build_object(
    'partners',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'user_id',p.user_id,
        'code',p.code,
        'display_name',p.display_name,
        'commission_percent',p.commission_percent,
        'attribution_days',p.attribution_days,
        'commission_hold_days',p.commission_hold_days,
        'active',p.active,
        'notes',p.notes,
        'created_at',p.created_at,
        'profile',jsonb_build_object(
          'username',pr.username,
          'avatar_url',pr.avatar_url,
          'discord_user_id',di.discord_user_id,
          'discord_username',di.username,
          'discord_global_name',di.global_name,
          'discord_avatar_url',di.avatar_url,
          'guild_member',di.guild_member
        ),
        'totals',jsonb_build_object(
          'pending_cents',coalesce(c.pending_cents,0),
          'available_cents',coalesce(c.available_cents,0),
          'paid_cents',coalesce(c.paid_cents,0),
          'reversed_cents',coalesce(c.reversed_cents,0),
          'sales',coalesce(c.sales,0)
        )
      ) order by p.created_at desc)
      from public.partners p
      left join public.profiles pr on pr.user_id=p.user_id
      left join public.discord_identities di on di.user_id=p.user_id
      left join lateral (
        select
          sum(pc.commission_amount_cents) filter(where pc.status='pending') pending_cents,
          sum(pc.commission_amount_cents) filter(where pc.status='available') available_cents,
          sum(pc.commission_amount_cents) filter(where pc.status='paid') paid_cents,
          sum(pc.commission_amount_cents) filter(where pc.status='reversed') reversed_cents,
          count(*) filter(where pc.status<>'reversed') sales
        from public.partner_commissions pc
        where pc.partner_id=p.id
      ) c on true
      limit 500
    ),'[]'::jsonb),
    'rules',coalesce((
      select jsonb_agg(jsonb_build_object(
        'partner_id',r.partner_id,
        'product_plan_id',r.product_plan_id,
        'enabled',r.enabled,
        'commission_percent',r.commission_percent
      ) order by r.partner_id)
      from public.partner_plan_rules r
    ),'[]'::jsonb),
    'plans',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pp.id,
        'product_id',pp.product_id,
        'product_name',p.name,
        'name',pp.name,
        'price',pp.price,
        'active',pp.active,
        'delivery_mode',coalesce(ppo.delivery_mode,'manual'),
        'commission_eligible',coalesce(ppo.delivery_mode,'manual') in ('internal_stock','purincash_supplier')
      ) order by p.name,pp.sort_order,pp.name)
      from public.product_plans pp
      join public.products p on p.id=pp.product_id
      left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
      where pp.active=true and p.active=true
    ),'[]'::jsonb),
    'totals',(
      select jsonb_build_object(
        'partners',count(*),
        'active_partners',count(*) filter(where active=true),
        'pending_cents',coalesce((select sum(commission_amount_cents) from public.partner_commissions where status='pending'),0),
        'available_cents',coalesce((select sum(commission_amount_cents) from public.partner_commissions where status='available'),0),
        'paid_cents',coalesce((select sum(commission_amount_cents) from public.partner_commissions where status='paid'),0)
      )
      from public.partners
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_partner(p_id uuid, p_user_id uuid, p_code text, p_display_name text, p_commission_percent numeric, p_attribution_days integer, p_commission_hold_days integer, p_active boolean, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_id uuid;
  v_code text:=lower(trim(coalesce(p_code,'')));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_user_id is null or not exists(select 1 from public.profiles where user_id=p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_code !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'INVALID_PARTNER_CODE'; end if;
  if trim(coalesce(p_display_name,''))='' then raise exception 'DISPLAY_NAME_REQUIRED'; end if;
  if p_commission_percent<0 or p_commission_percent>50 then raise exception 'INVALID_COMMISSION'; end if;
  if p_attribution_days<1 or p_attribution_days>90 then raise exception 'INVALID_ATTRIBUTION_DAYS'; end if;
  if p_commission_hold_days<0 or p_commission_hold_days>90 then raise exception 'INVALID_HOLD_DAYS'; end if;

  if p_id is null then
    insert into public.partners(
      user_id,code,display_name,commission_percent,attribution_days,
      commission_hold_days,active,notes,updated_at
    ) values(
      p_user_id,v_code,left(trim(p_display_name),120),p_commission_percent,p_attribution_days,
      p_commission_hold_days,coalesce(p_active,true),nullif(left(trim(coalesce(p_notes,'')),2000),''),now()
    )
    on conflict(user_id) do update
    set code=excluded.code,
        display_name=excluded.display_name,
        commission_percent=excluded.commission_percent,
        attribution_days=excluded.attribution_days,
        commission_hold_days=excluded.commission_hold_days,
        active=excluded.active,
        notes=excluded.notes,
        updated_at=now()
    returning id into v_id;
  else
    update public.partners
    set user_id=p_user_id,
        code=v_code,
        display_name=left(trim(p_display_name),120),
        commission_percent=p_commission_percent,
        attribution_days=p_attribution_days,
        commission_hold_days=p_commission_hold_days,
        active=coalesce(p_active,true),
        notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),
        updated_at=now()
    where id=p_id
    returning id into v_id;
  end if;

  if v_id is null then raise exception 'PARTNER_NOT_FOUND'; end if;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_partner_plan_rule(p_partner_id uuid, p_product_plan_id uuid, p_enabled boolean, p_commission_percent numeric DEFAULT NULL::numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare v_mode text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.partners where id=p_partner_id) then raise exception 'PARTNER_NOT_FOUND'; end if;
  if not exists(select 1 from public.product_plans where id=p_product_plan_id) then raise exception 'PLAN_NOT_FOUND'; end if;
  if p_commission_percent is not null and (p_commission_percent<0 or p_commission_percent>50) then raise exception 'INVALID_COMMISSION'; end if;

  select coalesce(ppo.delivery_mode,'manual') into v_mode
  from public.product_plans pp
  left join private.product_plan_operations ppo on ppo.product_plan_id=pp.id
  where pp.id=p_product_plan_id;

  if coalesce(p_enabled,false)=true and v_mode not in ('internal_stock','purincash_supplier') then
    raise exception 'PLAN_NOT_AUTOMATIC';
  end if;

  insert into public.partner_plan_rules(partner_id,product_plan_id,enabled,commission_percent,updated_at)
  values(p_partner_id,p_product_plan_id,coalesce(p_enabled,false),p_commission_percent,now())
  on conflict(partner_id,product_plan_id) do update
  set enabled=excluded.enabled,commission_percent=excluded.commission_percent,updated_at=now();

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_pay_partner_available(p_partner_id uuid, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_admin uuid:=auth.uid();
  v_ids uuid[];
  v_amount integer;
  v_payout public.partner_payouts;
begin
  if v_admin is null or not private.has_role(v_admin,'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  if not exists(select 1 from public.partners where id=p_partner_id) then
    raise exception 'PARTNER_NOT_FOUND';
  end if;

  perform private.refresh_partner_commissions();

  select array_agg(id order by created_at),coalesce(sum(commission_amount_cents),0)::integer
  into v_ids,v_amount
  from public.partner_commissions
  where partner_id=p_partner_id
    and status='available'
    and payout_id is null
  for update;

  if v_amount<=0 or v_ids is null then
    raise exception 'NO_AVAILABLE_BALANCE';
  end if;

  insert into public.partner_payouts(
    partner_id,amount_cents,status,reference,notes,created_by,created_at,paid_at
  ) values(
    p_partner_id,v_amount,'paid',
    nullif(left(trim(coalesce(p_reference,'')),200),''),
    nullif(left(trim(coalesce(p_notes,'')),1000),''),
    v_admin,now(),now()
  )
  returning * into v_payout;

  update public.partner_commissions
  set status='paid',
      payout_id=v_payout.id,
      updated_at=now()
  where id=any(v_ids)
    and status='available'
    and payout_id is null;

  return jsonb_build_object(
    'payout_id',v_payout.id,
    'amount_cents',v_payout.amount_cents,
    'commission_count',cardinality(v_ids),
    'paid_at',v_payout.paid_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_partner_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_partner public.partners;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  perform private.refresh_partner_commissions();

  select * into v_partner
  from public.partners p
  where p.user_id=v_user_id
  limit 1;

  if v_partner.id is null then
    return jsonb_build_object('partner',null,'commissions','[]'::jsonb,'totals',jsonb_build_object());
  end if;

  return jsonb_build_object(
    'partner',jsonb_build_object(
      'id',v_partner.id,
      'code',v_partner.code,
      'display_name',v_partner.display_name,
      'commission_percent',v_partner.commission_percent,
      'attribution_days',v_partner.attribution_days,
      'commission_hold_days',v_partner.commission_hold_days,
      'active',v_partner.active
    ),
    'totals',(
      select jsonb_build_object(
        'pending_cents',coalesce(sum(pc.commission_amount_cents) filter(where pc.status='pending'),0),
        'available_cents',coalesce(sum(pc.commission_amount_cents) filter(where pc.status='available'),0),
        'paid_cents',coalesce(sum(pc.commission_amount_cents) filter(where pc.status='paid'),0),
        'reversed_cents',coalesce(sum(pc.commission_amount_cents) filter(where pc.status='reversed'),0),
        'sales',count(*) filter(where pc.status<>'reversed')
      )
      from public.partner_commissions pc
      where pc.partner_id=v_partner.id
    ),
    'commissions',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',x.id,
        'payment_id',x.payment_id,
        'product_plan_id',x.product_plan_id,
        'eligible_amount_cents',x.eligible_amount_cents,
        'commission_percent',x.commission_percent,
        'commission_amount_cents',x.commission_amount_cents,
        'status',x.status,
        'available_at',x.available_at,
        'created_at',x.created_at
      ) order by x.created_at desc),'[]'::jsonb)
      from (
        select *
        from public.partner_commissions pc
        where pc.partner_id=v_partner.id
        order by pc.created_at desc
        limit 100
      ) x
    )
  );
end;
$function$
;


revoke all on function public.resolve_partner_referral(text) from public;
grant execute on function public.resolve_partner_referral(text) to anon,authenticated,service_role;
revoke all on function public.capture_my_partner_attribution(text,text) from public,anon;
grant execute on function public.capture_my_partner_attribution(text,text) to authenticated,service_role;
revoke all on function public.admin_partner_search_users(text,integer) from public,anon;
grant execute on function public.admin_partner_search_users(text,integer) to authenticated,service_role;
revoke all on function public.admin_partner_manager_snapshot() from public,anon;
grant execute on function public.admin_partner_manager_snapshot() to authenticated,service_role;
revoke all on function public.admin_upsert_partner(uuid,uuid,text,text,numeric,integer,integer,boolean,text) from public,anon;
grant execute on function public.admin_upsert_partner(uuid,uuid,text,text,numeric,integer,integer,boolean,text) to authenticated,service_role;
revoke all on function public.admin_set_partner_plan_rule(uuid,uuid,boolean,numeric) from public,anon;
grant execute on function public.admin_set_partner_plan_rule(uuid,uuid,boolean,numeric) to authenticated,service_role;
revoke all on function public.admin_pay_partner_available(uuid,text,text) from public,anon;
grant execute on function public.admin_pay_partner_available(uuid,text,text) to authenticated,service_role;
revoke all on function public.get_my_partner_snapshot() from public,anon;
grant execute on function public.get_my_partner_snapshot() to authenticated,service_role;

drop trigger if exists payments_capture_partner on public.payments;
create trigger payments_capture_partner before insert on public.payments
for each row execute function private.capture_payment_partner();
drop trigger if exists payments_partner_commission on public.payments;
create trigger payments_partner_commission after insert or update of status on public.payments
for each row execute function private.on_payment_partner_commission();
drop trigger if exists partner_commission_refund_reverse on public.payment_refunds;
create trigger partner_commission_refund_reverse after insert or update of status on public.payment_refunds
for each row execute function private.on_partner_refund_change();
drop trigger if exists partner_commission_dispute_reverse on public.payment_disputes;
create trigger partner_commission_dispute_reverse after insert or update of status on public.payment_disputes
for each row execute function private.on_partner_dispute_change();

-- Discord invite is intentionally configuration-only; no invite value is hardcoded here.
CREATE OR REPLACE FUNCTION public.get_public_discord_invite()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select case
    when value ~ '^https://(discord\.gg|discord\.com/invite)/[A-Za-z0-9_-]+/?$'
      then value
    else null
  end
  from public.system_credentials
  where env_key='DISCORD_INVITE_URL'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_discord_invite_url(p_invite_url text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_url text:=trim(coalesce(p_invite_url,''));
begin
  if not private.has_role((select auth.uid()),'admin'::public.app_role) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if v_url<>'' and v_url !~ '^https://(discord\.gg|discord\.com/invite)/[A-Za-z0-9_-]+/?$' then
    raise exception 'INVALID_DISCORD_INVITE';
  end if;

  insert into public.system_credentials(name,env_key,value,description,help_url)
  values(
    'Discord Invite URL',
    'DISCORD_INVITE_URL',
    v_url,
    'Convite público usado pelo gate de acesso da CRAZZY PROJECT.',
    ''
  )
  on conflict (env_key) do update
  set value=excluded.value,
      name=excluded.name,
      description=excluded.description;

  return nullif(v_url,'');
end;
$function$
;

revoke all on function public.get_public_discord_invite() from public;
grant execute on function public.get_public_discord_invite() to anon,authenticated,service_role;
revoke all on function public.admin_set_discord_invite_url(text) from public,anon;
grant execute on function public.admin_set_discord_invite_url(text) to authenticated,service_role;

-- Server-side inventory reservation + exact paid delivery.
CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(p_payment_id uuid, p_cart_snapshot jsonb, p_ttl_minutes integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_item jsonb;
  v_plan_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_item_index integer := -1;
  v_unit_index integer;
  v_delivery_mode text;
  v_key text;
  v_reserved jsonb := '[]'::jsonb;
  v_reservation jsonb;
begin
  if p_payment_id is null then
    raise exception 'PAYMENT_ID_REQUIRED';
  end if;
  if p_cart_snapshot is null
     or jsonb_typeof(p_cart_snapshot) <> 'array'
     or jsonb_array_length(p_cart_snapshot) = 0
     or jsonb_array_length(p_cart_snapshot) > 50 then
    raise exception 'INVALID_CART_SNAPSHOT';
  end if;

  for v_item in select value from jsonb_array_elements(p_cart_snapshot)
  loop
    v_item_index := v_item_index + 1;

    if coalesce(v_item->>'type','') = 'lzt-account'
       or coalesce(v_item->>'planId','') = 'lzt-account' then
      continue;
    end if;

    begin
      v_plan_id := (v_item->>'planId')::uuid;
      v_product_id := (v_item->>'productId')::uuid;
    exception when others then
      raise exception 'INVALID_CART_PRODUCT_REFERENCE';
    end;

    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'INVALID_CART_QUANTITY';
    end if;

    if not exists (
      select 1
      from public.product_plans pp
      join public.products p on p.id=pp.product_id
      where pp.id=v_plan_id
        and pp.product_id=v_product_id
        and pp.active=true
        and p.active=true
    ) then
      raise exception 'PLAN_NOT_AVAILABLE';
    end if;

    select coalesce(ppo.delivery_mode,'internal_stock')
      into v_delivery_mode
    from public.product_plans pp
    left join private.product_plan_operations ppo
      on ppo.product_plan_id=pp.id
    where pp.id=v_plan_id;

    if coalesce(v_delivery_mode,'internal_stock') <> 'internal_stock' then
      continue;
    end if;

    for v_unit_index in 0..(v_quantity-1)
    loop
      v_key := 'payment:' || p_payment_id::text || ':' || v_item_index::text || ':' || v_unit_index::text;

      v_reservation := public.reserve_stock_for_fulfillment(
        v_plan_id,
        v_key,
        greatest(5,least(coalesce(p_ttl_minutes,60),1440))
      );

      v_reserved := v_reserved || jsonb_build_array(
        jsonb_build_object(
          'item_index',v_item_index,
          'unit_index',v_unit_index,
          'product_id',v_product_id,
          'product_plan_id',v_plan_id,
          'reservation_id',v_reservation->>'reservation_id',
          'expires_at',v_reservation->>'expires_at'
        )
      );
    end loop;
  end loop;

  return jsonb_build_object(
    'payment_id',p_payment_id,
    'reservations',v_reserved,
    'count',jsonb_array_length(v_reserved)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_checkout_stock(p_payment_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer := 0;
begin
  if p_payment_id is null then return 0; end if;

  with released as (
    update public.stock_reservations sr
    set status='released',
        released_at=now(),
        updated_at=now()
    where sr.status='reserved'
      and sr.reservation_key like ('payment:' || p_payment_id::text || ':%')
    returning sr.id,sr.stock_item_id,sr.product_plan_id
  ),
  events as (
    insert into public.stock_events(
      reservation_id,stock_item_id,product_plan_id,event_type,metadata
    )
    select
      r.id,r.stock_item_id,r.product_plan_id,'reservation_released',
      jsonb_build_object('source','checkout','payment_id',p_payment_id)
    from released r
    returning 1
  )
  select count(*)::int into v_count from events;

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.extend_checkout_stock(p_payment_id uuid, p_expires_at timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target timestamptz;
  v_count integer := 0;
begin
  if p_payment_id is null or p_expires_at is null then return 0; end if;

  v_target := least(
    greatest(p_expires_at + interval '2 minutes', now() + interval '5 minutes'),
    now() + interval '24 hours'
  );

  update public.stock_reservations
  set expires_at=v_target,
      updated_at=now()
  where status='reserved'
    and reservation_key like ('payment:' || p_payment_id::text || ':%');

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_paid_delivery(p_payment_id uuid, p_user_id uuid, p_product_id uuid, p_product_plan_id uuid, p_item_index integer, p_unit_index integer)
 RETURNS TABLE(ticket_id uuid, stock_item_id uuid, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_ticket_id uuid;
  v_stock_id uuid;
  v_created boolean := false;
  v_delivery_mode text := 'internal_stock';
  v_reservation public.stock_reservations;
  v_reservation_key text;
begin
  if p_payment_id is null or p_user_id is null or p_product_id is null or p_product_plan_id is null then
    raise exception 'paid delivery requires payment, user, product and plan ids';
  end if;
  if p_item_index < 0 or p_unit_index < 0 then
    raise exception 'invalid paid delivery coordinates';
  end if;

  select ot.id,ot.stock_item_id
    into v_ticket_id,v_stock_id
  from public.order_tickets ot
  where ot.payment_id=p_payment_id
    and ot.payment_item_index=p_item_index
    and ot.payment_unit_index=p_unit_index
  limit 1;

  if v_ticket_id is not null then
    return query select v_ticket_id,v_stock_id,false;
    return;
  end if;

  select coalesce(ppo.delivery_mode,'internal_stock')
    into v_delivery_mode
  from public.product_plans pp
  left join private.product_plan_operations ppo
    on ppo.product_plan_id=pp.id
  where pp.id=p_product_plan_id
    and pp.product_id=p_product_id;

  if not found then
    raise exception 'PRODUCT_PLAN_NOT_FOUND';
  end if;

  begin
    if v_delivery_mode='internal_stock' then
      v_reservation_key :=
        'payment:' || p_payment_id::text || ':' || p_item_index::text || ':' || p_unit_index::text;

      select *
        into v_reservation
      from public.stock_reservations sr
      where sr.reservation_key=v_reservation_key
        and sr.product_plan_id=p_product_plan_id
      for update;

      if v_reservation.id is null then
        raise exception 'STOCK_RESERVATION_REQUIRED';
      end if;

      if v_reservation.status='reserved' and v_reservation.expires_at<=now() then
        update public.stock_reservations
        set status='expired',updated_at=now()
        where id=v_reservation.id;
        raise exception 'STOCK_RESERVATION_EXPIRED';
      end if;

      if v_reservation.status not in ('reserved','consumed') then
        raise exception 'STOCK_RESERVATION_NOT_ACTIVE';
      end if;

      v_stock_id := v_reservation.stock_item_id;

      if v_reservation.status='reserved' then
        perform 1
        from public.stock_items si
        where si.id=v_stock_id
          and si.product_plan_id=p_product_plan_id
          and si.used=false
          and si.disabled=false
        for update;

        if not found then
          raise exception 'STOCK_ITEM_NOT_AVAILABLE';
        end if;

        update public.stock_items
        set used=true,used_at=now()
        where id=v_stock_id;

        update public.stock_reservations
        set status='consumed',consumed_at=now(),updated_at=now()
        where id=v_reservation.id;

        insert into public.stock_events(
          stock_item_id,reservation_id,product_plan_id,event_type,metadata
        )
        values(
          v_stock_id,v_reservation.id,p_product_plan_id,'consumed',
          jsonb_build_object(
            'source','claim_paid_delivery',
            'payment_id',p_payment_id,
            'item_index',p_item_index,
            'unit_index',p_unit_index
          )
        );
      end if;
    else
      v_stock_id := null;
    end if;

    insert into public.order_tickets(
      user_id,product_id,product_plan_id,stock_item_id,status,status_label,
      metadata,payment_id,payment_item_index,payment_unit_index
    )
    values(
      p_user_id,p_product_id,p_product_plan_id,v_stock_id,
      case when v_stock_id is null then 'open'::public.ticket_status else 'delivered'::public.ticket_status end,
      case when v_stock_id is null then 'Aberto' else 'Entregue' end,
      jsonb_build_object(
        'payment_id',p_payment_id,
        'delivery_mode',v_delivery_mode
      ),
      p_payment_id,p_item_index,p_unit_index
    )
    returning id into v_ticket_id;

    v_created := true;
  exception when unique_violation then
    v_ticket_id := null;
    v_stock_id := null;

    select ot.id,ot.stock_item_id
      into v_ticket_id,v_stock_id
    from public.order_tickets ot
    where ot.payment_id=p_payment_id
      and ot.payment_item_index=p_item_index
      and ot.payment_unit_index=p_unit_index
    limit 1;

    if v_ticket_id is null then
      raise;
    end if;
  end;

  return query select v_ticket_id,v_stock_id,v_created;
end;
$function$
;

revoke all on function public.reserve_checkout_stock(uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.release_checkout_stock(uuid) from public,anon,authenticated;
revoke all on function public.extend_checkout_stock(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.claim_paid_delivery(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_checkout_stock(uuid,jsonb,integer) to service_role;
grant execute on function public.release_checkout_stock(uuid) to service_role;
grant execute on function public.extend_checkout_stock(uuid,timestamptz) to service_role;
grant execute on function public.claim_paid_delivery(uuid,uuid,uuid,uuid,integer,integer) to service_role;

-- Fulfillment must preserve refund/dispute/revoke state when a ticket is re-synced.
CREATE OR REPLACE FUNCTION private.sync_paid_order_fulfillment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_entitlement public.entitlements;
  v_fulfillment_key text;
  v_duration integer;
  v_role_id text;
  v_role_name text;
  v_discord_user_id text;
  v_guild_id text;
  v_run_id uuid;
  v_desired_role_state text;
begin
  if new.payment_id is null then return new; end if;
  if new.payment_item_index is null or new.payment_unit_index is null then return new; end if;

  v_fulfillment_key :=
    'payment:' || new.payment_id::text || ':' ||
    new.payment_item_index::text || ':' || new.payment_unit_index::text;

  select
    ppo.entitlement_duration_minutes,
    nullif(btrim(ppo.discord_role_id),''),
    nullif(btrim(ppo.discord_role_name),'')
  into v_duration,v_role_id,v_role_name
  from private.product_plan_operations ppo
  where ppo.product_plan_id=new.product_plan_id;

  insert into public.entitlements(
    user_id,product_id,product_plan_id,source_payment_id,source_order_ticket_id,
    fulfillment_key,status,starts_at,expires_at,tutorial_access,metadata,updated_at
  )
  values(
    new.user_id,new.product_id,new.product_plan_id,new.payment_id,new.id,
    v_fulfillment_key,'active',now(),
    case when v_duration is null then null else now()+make_interval(mins=>v_duration) end,
    true,
    jsonb_build_object(
      'payment_item_index',new.payment_item_index,
      'payment_unit_index',new.payment_unit_index,
      'delivery_mode',coalesce(new.metadata->>'delivery_mode','unknown')
    ),
    now()
  )
  on conflict (fulfillment_key)
  do update set
    source_order_ticket_id=excluded.source_order_ticket_id,
    status=case
      when public.entitlements.status in ('refunded','disputed','revoked')
        then public.entitlements.status
      else 'active'
    end,
    tutorial_access=case
      when public.entitlements.status in ('refunded','disputed','revoked') then false
      else true
    end,
    updated_at=now()
  returning * into v_entitlement;

  update public.library_deliveries
  set entitlement_id=v_entitlement.id,
      status=case
        when v_entitlement.status in ('refunded','disputed','revoked') then v_entitlement.status
        else status
      end,
      updated_at=now()
  where source_order_ticket_id=new.id
    and (
      entitlement_id is distinct from v_entitlement.id
      or v_entitlement.status in ('refunded','disputed','revoked')
    );

  if v_role_id is not null then
    select di.discord_user_id into v_discord_user_id
    from public.discord_identities di
    where di.user_id=new.user_id;

    select sc.value into v_guild_id
    from public.system_credentials sc
    where sc.env_key='DISCORD_GUILD_ID';

    v_desired_role_state := case
      when v_entitlement.status='active'
       and (v_entitlement.expires_at is null or v_entitlement.expires_at>now())
        then 'granted'
      else 'revoked'
    end;

    insert into public.discord_role_grants(
      user_id,entitlement_id,discord_user_id,guild_id,role_id,role_name,
      desired_state,status,updated_at
    )
    values(
      new.user_id,v_entitlement.id,v_discord_user_id,nullif(btrim(v_guild_id),''),
      v_role_id,v_role_name,v_desired_role_state,'pending',now()
    )
    on conflict (entitlement_id,role_id)
    do update set
      discord_user_id=excluded.discord_user_id,
      guild_id=excluded.guild_id,
      role_name=excluded.role_name,
      desired_state=v_desired_role_state,
      status=case
        when v_desired_role_state='granted' and public.discord_role_grants.status='granted'
          then 'granted'
        when v_desired_role_state='revoked' and public.discord_role_grants.status='revoked'
          then 'revoked'
        else 'pending'
      end,
      revoked_at=case
        when v_desired_role_state='granted' then null
        else public.discord_role_grants.revoked_at
      end,
      last_error_code=null,
      next_attempt_at=now(),
      locked_until=null,
      worker_id=null,
      updated_at=now();
  end if;

  perform private.refresh_fulfillment_run(new.payment_id);

  select fr.id into v_run_id
  from public.fulfillment_runs fr
  where fr.payment_id=new.payment_id;

  insert into public.fulfillment_events(
    run_id,payment_id,order_ticket_id,entitlement_id,event_type,level,message,metadata
  )
  values(
    v_run_id,new.payment_id,new.id,v_entitlement.id,
    'entitlement_synced','info','Entitlement sincronizado a partir do pedido pago.',
    jsonb_build_object(
      'fulfillment_key',v_fulfillment_key,
      'stock_item_id',new.stock_item_id,
      'role_requested',v_role_id is not null,
      'role_desired_state',v_desired_role_state
    )
  )
  on conflict (order_ticket_id,event_type)
  where order_ticket_id is not null
  do nothing;

  return new;
end;
$function$
;


-- Dashboard counts are aggregated server-side instead of sampling rows in the browser.
CREATE OR REPLACE FUNCTION public.admin_reward_stock_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_plan_id',x.product_plan_id,
      'total',x.total,
      'available',x.available
    ) order by x.product_plan_id)
    from (
      select
        product_plan_id,
        count(*)::int total,
        count(*) filter(where used=false)::int available
      from public.trial_stock_items
      group by product_plan_id
    ) x
  ),'[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_reseller_purchase_totals(p_reseller_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reseller_id',x.reseller_id,
      'count',x.purchase_count,
      'total',x.purchase_total
    ) order by x.reseller_id)
    from (
      select
        rp.reseller_id,
        count(*)::bigint purchase_count,
        coalesce(sum(rp.paid_price),0)::numeric purchase_total
      from public.reseller_purchases rp
      where rp.reseller_id=any(coalesce(p_reseller_ids,array[]::uuid[]))
      group by rp.reseller_id
    ) x
  ),'[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_coupon_usage_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('coupon_id',x.coupon_id,'uses',x.uses) order by x.coupon_id)
    from (
      select coupon_id,count(*)::bigint uses
      from public.coupon_usage
      group by coupon_id
    ) x
  ),'[]'::jsonb);
end;
$function$
;

revoke all on function public.admin_reward_stock_counts() from public,anon;
grant execute on function public.admin_reward_stock_counts() to authenticated,service_role;
revoke all on function public.admin_reseller_purchase_totals(uuid[]) from public,anon;
grant execute on function public.admin_reseller_purchase_totals(uuid[]) to authenticated,service_role;
revoke all on function public.admin_coupon_usage_counts() from public,anon;
grant execute on function public.admin_coupon_usage_counts() to authenticated,service_role;

-- Keep user-facing authenticated RPCs authenticated and trigger-only helpers private.
revoke execute on function public.get_my_luck_history(integer) from anon;
revoke execute on function public.get_reviewable_products() from anon;
revoke execute on function public.play_luck(text,text,uuid) from anon;
revoke execute on function public.submit_product_review(uuid,integer,text) from anon;
revoke execute on function public.mark_luck_coupon_origin() from public,anon,authenticated;

-- Remove duplicate Academy plan-management policy; writes stay admin-only.
drop policy if exists "Admins manage academy plan links" on public.academy_tutorial_plans;
