-- M15 CRAZZY REVIEWS
-- Reviews are publicly readable, but "verified purchase" is derived only from a real entitlement.

create index if not exists product_reviews_created_at_idx
  on public.product_reviews (created_at desc);

create index if not exists product_reviews_product_id_created_at_idx
  on public.product_reviews (product_id, created_at desc);

drop policy if exists "Purchased review insert or admin" on public.product_reviews;
drop policy if exists "Purchased review update or admin" on public.product_reviews;

create policy "Entitled review insert or admin"
on public.product_reviews
for insert
to authenticated
with check (
  private.has_role((select auth.uid()), 'admin'::app_role)
  or (
    (select auth.uid()) = user_id
    and rating between 1 and 5
    and exists (
      select 1
      from public.entitlements e
      where e.user_id = (select auth.uid())
        and e.product_id = product_reviews.product_id
        and coalesce(e.status, 'active') not in ('revoked','refunded','cancelled','canceled')
    )
  )
);

create policy "Entitled review update or admin"
on public.product_reviews
for update
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_role((select auth.uid()), 'admin'::app_role)
)
with check (
  private.has_role((select auth.uid()), 'admin'::app_role)
  or (
    (select auth.uid()) = user_id
    and rating between 1 and 5
    and exists (
      select 1
      from public.entitlements e
      where e.user_id = (select auth.uid())
        and e.product_id = product_reviews.product_id
        and coalesce(e.status, 'active') not in ('revoked','refunded','cancelled','canceled')
    )
  )
);

create or replace function public.get_public_reviews(
  p_product_id uuid default null,
  p_limit integer default 40
)
returns table (
  id uuid,
  user_id uuid,
  product_id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  username text,
  avatar_url text,
  product_name text,
  product_image text,
  verified boolean
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select
    r.id,
    r.user_id,
    r.product_id,
    r.rating,
    r.comment,
    r.created_at,
    coalesce(nullif(trim(p.username), ''), 'Cliente CRAZZY') as username,
    p.avatar_url,
    pr.name as product_name,
    pr.image_url as product_image,
    exists (
      select 1
      from public.entitlements e
      where e.user_id = r.user_id
        and e.product_id = r.product_id
        and coalesce(e.status, 'active') not in ('revoked','refunded','cancelled','canceled')
    ) as verified
  from public.product_reviews r
  left join public.profiles p on p.user_id = r.user_id
  join public.products pr on pr.id = r.product_id
  where p_product_id is null or r.product_id = p_product_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

create or replace function public.get_reviewable_products()
returns table (
  product_id uuid,
  product_name text,
  product_image text,
  current_rating integer,
  current_comment text,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select distinct on (p.id)
    p.id,
    p.name,
    p.image_url,
    r.rating,
    r.comment,
    r.updated_at
  from public.entitlements e
  join public.products p on p.id = e.product_id
  left join public.product_reviews r
    on r.user_id = auth.uid()
   and r.product_id = p.id
  where e.user_id = auth.uid()
    and coalesce(e.status, 'active') not in ('revoked','refunded','cancelled','canceled')
  order by p.id, e.created_at desc;
$$;

create or replace function public.submit_product_review(
  p_product_id uuid,
  p_rating integer,
  p_comment text
)
returns public.product_reviews
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_review public.product_reviews;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;

  if v_comment is not null and (char_length(v_comment) < 3 or char_length(v_comment) > 800) then
    raise exception 'INVALID_COMMENT';
  end if;

  if not exists (
    select 1
    from public.entitlements e
    where e.user_id = v_user
      and e.product_id = p_product_id
      and coalesce(e.status, 'active') not in ('revoked','refunded','cancelled','canceled')
  ) then
    raise exception 'PURCHASE_REQUIRED';
  end if;

  insert into public.product_reviews (user_id, product_id, rating, comment)
  values (v_user, p_product_id, p_rating, v_comment)
  on conflict (user_id, product_id)
  do update set
    rating = excluded.rating,
    comment = excluded.comment,
    updated_at = now()
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.get_public_reviews(uuid, integer) from public;
revoke all on function public.get_reviewable_products() from public;
revoke all on function public.submit_product_review(uuid, integer, text) from public;

grant execute on function public.get_public_reviews(uuid, integer) to anon, authenticated;
grant execute on function public.get_reviewable_products() to authenticated;
grant execute on function public.submit_product_review(uuid, integer, text) to authenticated;
