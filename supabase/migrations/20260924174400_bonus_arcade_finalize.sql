-- Finalize CRAZZY BONUS / CRAZZY ARCADE after the first production migration.
-- No retroactive credits are created here.

alter table public.luck_prizes
  drop constraint if exists luck_prizes_prize_type_check;

alter table public.luck_prizes
  add constraint luck_prizes_prize_type_check
  check (prize_type = any (array[
    'coupon'::text,
    'bonus'::text,
    'product'::text,
    'account'::text,
    'reward'::text,
    'none'::text
  ]));

create or replace function private.on_order_ticket_purchase_bonus()
returns trigger
language plpgsql
security definer
set search_path='public','private','auth','extensions','pg_temp'
as $$
declare
  v_rule public.bonus_plan_rules;
  v_payment public.payments;
  v_ref text;
  v_expiry timestamptz;
begin
  if new.payment_id is null or new.product_plan_id is null or new.user_id is null then
    return new;
  end if;

  select * into v_payment
  from public.payments
  where id=new.payment_id
    and user_id=new.user_id
    and status in ('FULFILLING','COMPLETED');

  if not found then
    return new;
  end if;

  select * into v_rule
  from public.bonus_plan_rules
  where plan_id=new.product_plan_id
    and active=true
    and grant_bonus_cents>0;

  if not found then
    return new;
  end if;

  v_ref:='payment:'||new.payment_id::text||':'||
    coalesce(new.payment_item_index,0)::text||':'||
    coalesce(new.payment_unit_index,0)::text;

  v_expiry:=case
    when v_rule.expires_days is null then null
    else now()+make_interval(days=>v_rule.expires_days)
  end;

  perform private.bonus_credit(
    new.user_id,
    v_rule.grant_bonus_cents,
    'purchase',
    v_ref,
    'Bônus promocional de compra',
    v_expiry
  );

  return new;
end
$$;

drop trigger if exists trg_order_ticket_purchase_bonus on public.order_tickets;
create trigger trg_order_ticket_purchase_bonus
after insert on public.order_tickets
for each row
when (new.payment_id is not null and new.product_plan_id is not null)
execute function private.on_order_ticket_purchase_bonus();

revoke all on function private.on_order_ticket_purchase_bonus() from public,anon,authenticated;
