-- M11 follow-up: current LZT stock payload is textual, not JSON.

create or replace function private.sync_order_ticket_library_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload text;
  v_delivery_id uuid;
  v_delivery_type text;
  v_safe_metadata jsonb;
begin
  if new.stock_item_id is null
     or new.status::text not in ('delivered','resolved','closed','finished','archived') then
    return new;
  end if;

  select si.content
    into v_payload
  from public.stock_items si
  where si.id = new.stock_item_id;

  if v_payload is null or btrim(v_payload) = '' then
    return new;
  end if;

  v_delivery_type := case
    when coalesce(new.metadata ->> 'type', '') = 'lzt-account' then 'account'
    else 'key'
  end;

  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'account_name', nullif(new.metadata ->> 'account_name', ''),
    'account_image', nullif(new.metadata ->> 'account_image', ''),
    'skins_count', nullif(new.metadata ->> 'skins_count', ''),
    'lzt_item_id', nullif(new.metadata ->> 'lzt_item_id', '')
  ));

  insert into public.library_deliveries (
    user_id, delivery_type, product_id, product_plan_id,
    source_order_ticket_id, source_stock_item_id,
    status, delivered_at, metadata, updated_at
  ) values (
    new.user_id, v_delivery_type, new.product_id, new.product_plan_id,
    new.id, new.stock_item_id,
    'available', coalesce(new.updated_at, now()), v_safe_metadata, now()
  )
  on conflict (source_order_ticket_id)
  do update set
    source_stock_item_id = excluded.source_stock_item_id,
    product_id = excluded.product_id,
    product_plan_id = excluded.product_plan_id,
    status = case
      when public.library_deliveries.status in ('revoked','refunded','disputed')
        then public.library_deliveries.status
      else 'available'
    end,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_delivery_id;

  insert into private.library_delivery_secrets (
    delivery_id, payload, payload_format, updated_at
  ) values (
    v_delivery_id, v_payload, 'text', now()
  )
  on conflict (delivery_id)
  do update set
    payload = excluded.payload,
    payload_format = excluded.payload_format,
    updated_at = now();

  return new;
end;
$function$;

update private.library_delivery_secrets s
set payload_format = 'text',
    updated_at = now()
from public.library_deliveries d
where d.id = s.delivery_id
  and d.delivery_type = 'account'
  and s.payload_format = 'json';
