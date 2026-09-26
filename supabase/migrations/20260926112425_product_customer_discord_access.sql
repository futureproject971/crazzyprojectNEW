-- Product-level Discord access, independent of plan duration.
alter table public.products add column discord_role_id text, add column discord_role_name text;
alter table public.products add constraint product_discord_role_format check (discord_role_id is null or discord_role_id ~ '^[0-9]{17,20}$');
-- Preserve an unambiguous existing role when all variations used the same role.
update public.products p set discord_role_id=r.role_id, discord_role_name=r.role_name
from (
 select pp.product_id,min(ops.discord_role_id) as role_id,min(ops.discord_role_name) as role_name
 from public.product_plans pp join private.product_plan_operations ops on ops.product_plan_id=pp.id
 where ops.discord_role_id ~ '^[0-9]{17,20}$' group by pp.product_id having count(distinct ops.discord_role_id)=1
) r where p.id=r.product_id;

create table public.discord_customer_settings (
 id boolean primary key default true check(id),
 role_id text check(role_id is null or role_id ~ '^[0-9]{17,20}$'),
 role_name text not null default 'Cliente',
 updated_at timestamptz not null default now()
);
insert into public.discord_customer_settings(id) values(true);
alter table public.discord_customer_settings enable row level security;
revoke all on public.discord_customer_settings from anon,authenticated;
grant select,update on public.discord_customer_settings to authenticated;
grant all on public.discord_customer_settings to service_role;
create policy customer_role_admin_read on public.discord_customer_settings for select to authenticated using((select public.is_current_admin()));
create policy customer_role_admin_update on public.discord_customer_settings for update to authenticated using((select public.is_current_admin())) with check((select public.is_current_admin()));

-- A role remains granted while ANY qualifying entitlement still requires it.
-- The global customer badge survives normal expiration; refunds/revocations do not qualify.
create or replace function private.customer_needs_discord_role(p_user_id uuid,p_role_id text)
returns boolean language sql stable security definer set search_path=public,private,pg_temp as $$
 select exists (
  select 1 from public.entitlements e join public.products p on p.id=e.product_id
  left join private.product_plan_operations ops on ops.product_plan_id=e.product_plan_id
  where e.user_id=p_user_id and e.status='active' and (e.expires_at is null or e.expires_at>now())
   and coalesce(p.discord_role_id,nullif(ops.discord_role_id,''))=p_role_id
 ) or exists (
  select 1 from public.discord_customer_settings cfg join public.entitlements e on e.user_id=p_user_id
  where cfg.id and cfg.role_id=p_role_id and e.source_payment_id is not null
   and e.status not in ('revoked','refunded','disputed')
 );
$$;
revoke all on function private.customer_needs_discord_role(uuid,text) from public,anon,authenticated;

create or replace function public.prepare_discord_role_queue()
returns jsonb language plpgsql security definer set search_path=public,private,auth,pg_temp as $$
declare v_expired integer:=0; v_queued integer:=0; v_changed integer:=0;
begin
 update public.entitlements set status='expired',updated_at=now()
 where status='active' and expires_at is not null and expires_at<=now();
 get diagnostics v_expired=row_count;

 -- Existing worker already claims and completes these rows. No client-side role grants.
 insert into public.discord_role_grants(user_id,entitlement_id,discord_user_id,guild_id,role_id,role_name,desired_state,status,updated_at)
 select e.user_id,e.id,di.discord_user_id,
  (select nullif(btrim(value),'') from public.system_credentials where env_key='DISCORD_GUILD_ID'),
  r.role_id,r.role_name,'granted','pending',now()
 from public.entitlements e
 join public.products p on p.id=e.product_id
 left join private.product_plan_operations ops on ops.product_plan_id=e.product_plan_id
 left join public.discord_identities di on di.user_id=e.user_id
 cross join lateral (
  select coalesce(p.discord_role_id,nullif(ops.discord_role_id,'')) as role_id,
   coalesce(p.discord_role_name,ops.discord_role_name,'Cliente '||p.name) as role_name
  where e.status='active' and (e.expires_at is null or e.expires_at>now())
  union
  select cfg.role_id,cfg.role_name from public.discord_customer_settings cfg
  where cfg.id and e.source_payment_id is not null and e.status not in ('revoked','refunded','disputed')
 ) r
 where r.role_id is not null
 on conflict(entitlement_id,role_id) do nothing;
 get diagnostics v_queued=row_count;

 update public.discord_role_grants g set discord_user_id=di.discord_user_id,
  guild_id=coalesce(nullif(btrim(g.guild_id),''),(select nullif(btrim(value),'') from public.system_credentials where env_key='DISCORD_GUILD_ID')),
  next_attempt_at=now(),updated_at=now()
 from public.discord_identities di where di.user_id=g.user_id and di.discord_user_id is not null
  and (g.discord_user_id is distinct from di.discord_user_id or g.guild_id is null);

 with desired as (
  select g.id,case when private.customer_needs_discord_role(g.user_id,g.role_id) then 'granted' else 'revoked' end as state
  from public.discord_role_grants g where g.entitlement_id is not null
 )
 update public.discord_role_grants g set desired_state=d.state,status='pending',next_attempt_at=now(),
  locked_until=null,worker_id=null,last_error_code=null,updated_at=now()
 from desired d where g.id=d.id and g.desired_state is distinct from d.state;
 get diagnostics v_changed=row_count;
 return jsonb_build_object('expired_entitlements',v_expired,'roles_queued',v_queued,'roles_updated',v_changed);
end;
$$;
revoke all on function public.prepare_discord_role_queue() from public,anon,authenticated;
grant execute on function public.prepare_discord_role_queue() to service_role;
