-- M28 CRAZZY SALES MANAGER
-- Admin-only commercial observability across payment, fulfillment, entitlement,
-- tutorial access, Discord role sync and delivery logs.
-- No delivered secrets/keys are returned by these RPCs.

create index if not exists payments_status_created_idx
  on public.payments(status,created_at desc);

create index if not exists payments_created_at_idx
  on public.payments(created_at desc);

create index if not exists entitlements_source_payment_idx
  on public.entitlements(source_payment_id)
  where source_payment_id is not null;

create index if not exists entitlements_source_order_ticket_idx
  on public.entitlements(source_order_ticket_id)
  where source_order_ticket_id is not null;

create index if not exists discord_role_grants_entitlement_idx
  on public.discord_role_grants(entitlement_id)
  where entitlement_id is not null;

create or replace function public.get_sales_manager(
  p_query text default null,
  p_status text default null,
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
  v_limit integer := greatest(1,least(coalesce(p_limit,100),200));
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_result jsonb;
begin
  if v_user is null or not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  with filtered as (
    select
      p.*,
      pr.username,
      pr.avatar_url
    from public.payments p
    left join public.profiles pr on pr.user_id=p.user_id
    where
      (v_status='' or upper(p.status)=v_status)
      and (
        v_query=''
        or lower(p.id::text) like '%'||v_query||'%'
        or lower(coalesce(p.charge_id,'')) like '%'||v_query||'%'
        or lower(coalesce(pr.username,'')) like '%'||v_query||'%'
        or lower(p.user_id::text) like '%'||v_query||'%'
        or lower(coalesce(p.payment_method,'')) like '%'||v_query||'%'
      )
  ),
  page as (
    select *
    from filtered
    order by created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'total_sales',(select count(*)::int from filtered),
      'completed',(select count(*)::int from filtered where status='COMPLETED'),
      'pending',(select count(*)::int from filtered where status in ('CREATING','ACTIVE','FULFILLING')),
      'failed',(select count(*)::int from filtered where status in ('FAILED','EXPIRED','CANCELLED')),
      'gross_completed_cents',coalesce((select sum(amount)::bigint from filtered where status='COMPLETED'),0),
      'needs_attention',coalesce((
        select count(*)::int
        from filtered fp
        where
          (fp.status='COMPLETED' and not exists(
            select 1 from public.order_tickets ot
            where ot.payment_id=fp.id
               or ot.metadata->>'payment_id'=fp.id::text
          ))
          or exists(
            select 1
            from public.order_tickets ot
            where (ot.payment_id=fp.id or ot.metadata->>'payment_id'=fp.id::text)
              and lower(ot.status) not in ('delivered','closed')
          )
          or exists(
            select 1
            from public.discord_role_grants drg
            where drg.status='failed'
              and drg.entitlement_id in (
                select e.id
                from public.entitlements e
                where e.source_payment_id=fp.id
                   or e.source_order_ticket_id in (
                     select ot.id
                     from public.order_tickets ot
                     where ot.payment_id=fp.id
                        or ot.metadata->>'payment_id'=fp.id::text
                   )
              )
          )
      ),0)
    ),
    'sales',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'payment_id',p.id,
          'user_id',p.user_id,
          'username',coalesce(p.username,'Cliente'),
          'avatar_url',p.avatar_url,
          'amount_cents',p.amount,
          'discount_amount',p.discount_amount,
          'payment_method',p.payment_method,
          'payment_status',p.status,
          'charge_reference',case
            when p.charge_id is null then null
            when char_length(p.charge_id)<=12 then p.charge_id
            else left(p.charge_id,8)||'…'||right(p.charge_id,4)
          end,
          'created_at',p.created_at,
          'paid_at',p.paid_at,
          'expires_at',p.expires_at,
          'updated_at',p.updated_at,
          'ticket_total',(
            select count(*)::int
            from public.order_tickets ot
            where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
          ),
          'ticket_delivered',(
            select count(*)::int
            from public.order_tickets ot
            where (ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text)
              and lower(ot.status)='delivered'
          ),
          'ticket_attention',(
            select count(*)::int
            from public.order_tickets ot
            where (ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text)
              and lower(ot.status) not in ('delivered','closed')
          ),
          'entitlement_total',(
            select count(*)::int
            from public.entitlements e
            where e.source_payment_id=p.id
               or e.source_order_ticket_id in (
                 select ot.id
                 from public.order_tickets ot
                 where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
               )
          ),
          'entitlement_active',(
            select count(*)::int
            from public.entitlements e
            where (
              e.source_payment_id=p.id
              or e.source_order_ticket_id in (
                select ot.id
                from public.order_tickets ot
                where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
              )
            )
            and e.status='active'
            and (e.expires_at is null or e.expires_at>now())
          ),
          'delivery_total',(
            select count(*)::int
            from public.library_deliveries ld
            where ld.entitlement_id in (
              select e.id
              from public.entitlements e
              where e.source_payment_id=p.id
                 or e.source_order_ticket_id in (
                   select ot.id
                   from public.order_tickets ot
                   where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
                 )
            )
            or ld.source_order_ticket_id in (
              select ot.id
              from public.order_tickets ot
              where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
            )
          ),
          'discord_status',coalesce((
            select case
              when count(*)=0 then 'none'
              when count(*) filter(where drg.status='failed')>0 then 'failed'
              when count(*) filter(where drg.status='pending')>0 then 'pending'
              when count(*) filter(where drg.status='granted')=count(*) then 'granted'
              when count(*) filter(where drg.status='revoked')=count(*) then 'revoked'
              else 'mixed'
            end
            from public.discord_role_grants drg
            where drg.entitlement_id in (
              select e.id
              from public.entitlements e
              where e.source_payment_id=p.id
                 or e.source_order_ticket_id in (
                   select ot.id
                   from public.order_tickets ot
                   where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
                 )
            )
          ),'none'),
          'tutorial_unlock_count',(
            select count(distinct links.tutorial_id)::int
            from (
              select atp.tutorial_id
              from public.entitlements e
              join public.academy_tutorial_products atp on atp.product_id=e.product_id
              where e.tutorial_access=true
                and e.status='active'
                and (e.expires_at is null or e.expires_at>now())
                and (
                  e.source_payment_id=p.id
                  or e.source_order_ticket_id in (
                    select ot.id
                    from public.order_tickets ot
                    where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
                  )
                )
              union
              select apl.tutorial_id
              from public.entitlements e
              join public.academy_tutorial_plans apl on apl.product_plan_id=e.product_plan_id
              where e.tutorial_access=true
                and e.status='active'
                and (e.expires_at is null or e.expires_at>now())
                and (
                  e.source_payment_id=p.id
                  or e.source_order_ticket_id in (
                    select ot.id
                    from public.order_tickets ot
                    where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
                  )
                )
            ) links
          ),
          'fulfillment_status',case
            when p.status<>'COMPLETED' then
              case when p.status='FULFILLING' then 'processing' else 'waiting_payment' end
            when not exists(
              select 1 from public.order_tickets ot
              where ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text
            ) then 'missing'
            when exists(
              select 1 from public.order_tickets ot
              where (ot.payment_id=p.id or ot.metadata->>'payment_id'=p.id::text)
                and lower(ot.status) not in ('delivered','closed')
            ) then 'attention'
            else 'delivered'
          end
        )
        order by p.created_at desc
      )
      from page p
    ),'[]'::jsonb),
    'limit',v_limit,
    'offset',v_offset
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_sales_manager_detail(
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

  select p.* into v_payment
  from public.payments p
  where p.id=p_payment_id;

  if v_payment.id is null then
    raise exception 'SALE_NOT_FOUND';
  end if;

  select pr.username,pr.avatar_url
  into v_username,v_avatar
  from public.profiles pr
  where pr.user_id=v_payment.user_id
  limit 1;

  select jsonb_build_object(
    'payment',jsonb_build_object(
      'id',v_payment.id,
      'user_id',v_payment.user_id,
      'username',coalesce(v_username,'Cliente'),
      'avatar_url',v_avatar,
      'amount_cents',v_payment.amount,
      'discount_amount',v_payment.discount_amount,
      'payment_method',v_payment.payment_method,
      'status',v_payment.status,
      'charge_reference',case
        when v_payment.charge_id is null then null
        when char_length(v_payment.charge_id)<=12 then v_payment.charge_id
        else left(v_payment.charge_id,8)||'…'||right(v_payment.charge_id,4)
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
        'product_image',item->>'productImage',
        'plan_id',item->>'planId',
        'plan_name',item->>'planName',
        'plan_code',item->>'planCode',
        'quantity',greatest(1,coalesce((item->>'quantity')::integer,1)),
        'unit_price',coalesce((item->>'price')::numeric,0),
        'type',coalesce(item->>'type','product')
      ))
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_payment.cart_snapshot)='array' then v_payment.cart_snapshot
          else '[]'::jsonb
        end
      ) item
    ),'[]'::jsonb),
    'tickets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ot.id,
        'product_id',ot.product_id,
        'product_name',p.name,
        'product_plan_id',ot.product_plan_id,
        'plan_name',pp.name,
        'delivery_mode',coalesce(ppo.delivery_mode,'manual'),
        'status',ot.status,
        'status_label',ot.status_label,
        'has_stock_item',ot.stock_item_id is not null,
        'created_at',ot.created_at,
        'updated_at',ot.updated_at,
        'closed_at',ot.closed_at
      ) order by ot.created_at)
      from public.order_tickets ot
      join public.products p on p.id=ot.product_id
      join public.product_plans pp on pp.id=ot.product_plan_id
      left join private.product_plan_operations ppo on ppo.product_plan_id=ot.product_plan_id
      where ot.payment_id=v_payment.id
         or ot.metadata->>'payment_id'=v_payment.id::text
    ),'[]'::jsonb),
    'entitlements',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'product_id',e.product_id,
        'product_name',p.name,
        'product_plan_id',e.product_plan_id,
        'plan_name',pp.name,
        'status',e.status,
        'starts_at',e.starts_at,
        'expires_at',e.expires_at,
        'tutorial_access',e.tutorial_access,
        'created_at',e.created_at
      ) order by e.created_at)
      from public.entitlements e
      join public.products p on p.id=e.product_id
      left join public.product_plans pp on pp.id=e.product_plan_id
      where e.source_payment_id=v_payment.id
         or e.source_order_ticket_id in (
           select ot.id
           from public.order_tickets ot
           where ot.payment_id=v_payment.id
              or ot.metadata->>'payment_id'=v_payment.id::text
         )
    ),'[]'::jsonb),
    'deliveries',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ld.id,
        'delivery_type',ld.delivery_type,
        'status',ld.status,
        'product_id',ld.product_id,
        'product_plan_id',ld.product_plan_id,
        'entitlement_id',ld.entitlement_id,
        'source_order_ticket_id',ld.source_order_ticket_id,
        'delivered_at',ld.delivered_at,
        'expires_at',ld.expires_at,
        'reveal_count',ld.reveal_count,
        'last_revealed_at',ld.last_revealed_at
      ) order by ld.delivered_at)
      from public.library_deliveries ld
      where ld.entitlement_id in (
        select e.id
        from public.entitlements e
        where e.source_payment_id=v_payment.id
           or e.source_order_ticket_id in (
             select ot.id
             from public.order_tickets ot
             where ot.payment_id=v_payment.id
                or ot.metadata->>'payment_id'=v_payment.id::text
           )
      )
      or ld.source_order_ticket_id in (
        select ot.id
        from public.order_tickets ot
        where ot.payment_id=v_payment.id
           or ot.metadata->>'payment_id'=v_payment.id::text
      )
    ),'[]'::jsonb),
    'discord_roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',drg.id,
        'entitlement_id',drg.entitlement_id,
        'role_name',drg.role_name,
        'status',drg.status,
        'granted_at',drg.granted_at,
        'revoked_at',drg.revoked_at,
        'last_error_code',drg.last_error_code,
        'updated_at',drg.updated_at
      ) order by drg.created_at)
      from public.discord_role_grants drg
      where drg.entitlement_id in (
        select e.id
        from public.entitlements e
        where e.source_payment_id=v_payment.id
           or e.source_order_ticket_id in (
             select ot.id
             from public.order_tickets ot
             where ot.payment_id=v_payment.id
                or ot.metadata->>'payment_id'=v_payment.id::text
           )
      )
    ),'[]'::jsonb),
    'tutorials',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,
        'title',t.title,
        'slug',t.slug,
        'active',t.active
      ) order by t.title)
      from public.academy_tutorials t
      where t.id in (
        select atp.tutorial_id
        from public.entitlements e
        join public.academy_tutorial_products atp on atp.product_id=e.product_id
        where e.tutorial_access=true
          and e.status='active'
          and (e.expires_at is null or e.expires_at>now())
          and (
            e.source_payment_id=v_payment.id
            or e.source_order_ticket_id in (
              select ot.id
              from public.order_tickets ot
              where ot.payment_id=v_payment.id
                 or ot.metadata->>'payment_id'=v_payment.id::text
            )
          )
        union
        select apl.tutorial_id
        from public.entitlements e
        join public.academy_tutorial_plans apl on apl.product_plan_id=e.product_plan_id
        where e.tutorial_access=true
          and e.status='active'
          and (e.expires_at is null or e.expires_at>now())
          and (
            e.source_payment_id=v_payment.id
            or e.source_order_ticket_id in (
              select ot.id
              from public.order_tickets ot
              where ot.payment_id=v_payment.id
                 or ot.metadata->>'payment_id'=v_payment.id::text
            )
          )
      )
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_sales_manager(text,text,integer,integer)
  from public,anon;
revoke execute on function public.get_sales_manager_detail(uuid)
  from public,anon;

grant execute on function public.get_sales_manager(text,text,integer,integer)
  to authenticated;
grant execute on function public.get_sales_manager_detail(uuid)
  to authenticated;
