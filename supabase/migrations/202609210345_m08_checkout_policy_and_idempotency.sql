alter table public.product_plans
  add column if not exists plan_code text,
  add column if not exists show_when_out_of_stock boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_plans_plan_code_check') then
    alter table public.product_plans
      add constraint product_plans_plan_code_check
      check (plan_code is null or plan_code in ('1d','3d','7d','15d','30d','90d','lifetime','single','custom'));
  end if;
end $$;

create unique index if not exists product_plans_product_plan_code_uidx
  on public.product_plans(product_id, plan_code)
  where plan_code is not null;

alter table public.payments
  add column if not exists idempotency_key text,
  add column if not exists payment_method text,
  add column if not exists expires_at timestamptz,
  add column if not exists checkout_payload jsonb;

create unique index if not exists payments_user_idempotency_uidx
  on public.payments(user_id, idempotency_key)
  where idempotency_key is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_payment_method_check') then
    alter table public.payments
      add constraint payments_payment_method_check
      check (payment_method is null or payment_method in ('pix','card','crypto'));
  end if;
end $$;
