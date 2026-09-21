-- M15 CRAZZY REVIEWS
-- Real reviews only. Verification is derived from real order/entitlement data.

alter table public.product_reviews
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists product_reviews_user_product_unique
  on public.product_reviews (user_id, product_id);

create index if not exists product_reviews_product_created_idx
  on public.product_reviews (product_id, created_at desc);

create index if not exists product_reviews_user_created_idx
  on public.product_reviews (user_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_reviews_comment_length_check'
      and conrelid = 'public.product_reviews'::regclass
  ) then
    alter table public.product_reviews
      add constraint product_reviews_comment_length_check
      check (comment is null or char_length(btrim(comment)) between 3 and 800);
  end if;
end
$$;

comment on table public.product_reviews is
  'CRAZZY PROJECT real customer reviews. Purchase verification is computed from entitlements/orders and is never client supplied.';
