-- M20 CRAZZY RANK
-- Server-derived customer rank. No client-side XP writes.

create table if not exists public.rank_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  min_points integer not null unique check (min_points >= 0),
  color text not null default '#2AA8FF',
  tone text not null default 'blue' check (tone in ('blue','green','gold','pink','neutral')),
  icon text not null default 'crown',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rank_tiers enable row level security;

drop policy if exists "Rank tiers are readable" on public.rank_tiers;
create policy "Rank tiers are readable"
on public.rank_tiers for select to anon, authenticated
using (active = true);

drop policy if exists "Admins manage rank tiers" on public.rank_tiers;
create policy "Admins manage rank tiers"
on public.rank_tiers for all to authenticated
using (private.has_role(auth.uid(), 'admin'::app_role))
with check (private.has_role(auth.uid(), 'admin'::app_role));

insert into public.rank_tiers(code,label,min_points,color,tone,icon,sort_order,active)
values
  ('member','Member',0,'#2AA8FF','blue','verified',0,true),
  ('bronze','Bronze',250,'#B87333','gold','crown',1,true),
  ('silver','Silver',600,'#B9C6D3','neutral','crown',2,true),
  ('gold','Gold',1200,'#FFD34D','gold','crown',3,true),
  ('platinum','Platinum',2000,'#57E5D5','green','crown',4,true),
  ('diamond','Diamond',3000,'#57A7FF','blue','crown',5,true),
  ('elite','Elite',4500,'#C46BFF','pink','crown',6,true),
  ('legend','Legend',7000,'#FF4D98','pink','crown',7,true)
on conflict (code) do update set
  label=excluded.label,
  min_points=excluded.min_points,
  color=excluded.color,
  tone=excluded.tone,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=excluded.active,
  updated_at=now();

create index if not exists payments_user_completed_rank_idx
  on public.payments(user_id)
  where status='COMPLETED';

create index if not exists entitlements_user_active_rank_idx
  on public.entitlements(user_id)
  where status='active';

create index if not exists product_reviews_user_rank_idx
  on public.product_reviews(user_id);

create index if not exists reward_sessions_user_delivered_rank_idx
  on public.reward_sessions(user_id)
  where delivered_at is not null;

create index if not exists luck_plays_user_rank_idx
  on public.luck_plays(user_id);

create index if not exists community_messages_user_rank_idx
  on public.community_messages(user_id)
  where deleted_at is null;

create or replace function public.rank_breakdown_for_user(p_user uuid)
returns jsonb
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  with counts as (
    select
      coalesce((select count(*) from public.payments p where p.user_id=p_user and p.status='COMPLETED'),0)::int as purchases,
      coalesce((select count(*) from public.entitlements e where e.user_id=p_user and e.status='active'),0)::int as active_entitlements,
      coalesce((select count(*) from public.product_reviews r where r.user_id=p_user),0)::int as reviews,
      coalesce((select count(*) from public.reward_sessions rs where rs.user_id=p_user and rs.delivered_at is not null),0)::int as rewards,
      coalesce((select count(*) from public.luck_plays lp where lp.user_id=p_user and lp.status in ('awarded','pending_delivery')),0)::int as luck_plays,
      coalesce((select count(*) from public.community_messages cm where cm.user_id=p_user and cm.deleted_at is null),0)::int as messages
  ),
  scored as (
    select
      purchases,
      active_entitlements,
      reviews,
      rewards,
      luck_plays,
      messages,
      purchases * 250 as purchase_points,
      least(active_entitlements,20) * 50 as entitlement_points,
      least(reviews,10) * 75 as review_points,
      least(rewards,20) * 40 as reward_points,
      least(luck_plays,50) * 10 as luck_points,
      least(messages,100) * 2 as community_points
    from counts
  )
  select jsonb_build_object(
    'purchases',purchases,
    'active_entitlements',active_entitlements,
    'reviews',reviews,
    'rewards',rewards,
    'luck_plays',luck_plays,
    'community_messages',messages,
    'purchase_points',purchase_points,
    'entitlement_points',entitlement_points,
    'review_points',review_points,
    'reward_points',reward_points,
    'luck_points',luck_points,
    'community_points',community_points,
    'total_points',
      purchase_points + entitlement_points + review_points + reward_points + luck_points + community_points
  )
  from scored;
$$;

create or replace function public.get_my_rank()
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_breakdown jsonb;
  v_points integer := 0;
  v_current public.rank_tiers;
  v_next public.rank_tiers;
  v_progress numeric := 100;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  v_breakdown := public.rank_breakdown_for_user(v_user);
  v_points := coalesce((v_breakdown->>'total_points')::integer,0);

  select * into v_current
  from public.rank_tiers
  where active=true and min_points <= v_points
  order by min_points desc
  limit 1;

  select * into v_next
  from public.rank_tiers
  where active=true and min_points > v_points
  order by min_points asc
  limit 1;

  if v_next.id is not null and v_next.min_points > v_current.min_points then
    v_progress := round(
      ((v_points - v_current.min_points)::numeric * 100)
      / (v_next.min_points - v_current.min_points),
      2
    );
  end if;

  return jsonb_build_object(
    'points',v_points,
    'current',jsonb_build_object(
      'code',v_current.code,
      'label',v_current.label,
      'min_points',v_current.min_points,
      'color',v_current.color,
      'tone',v_current.tone,
      'icon',v_current.icon
    ),
    'next',case when v_next.id is null then null else jsonb_build_object(
      'code',v_next.code,
      'label',v_next.label,
      'min_points',v_next.min_points,
      'color',v_next.color,
      'tone',v_next.tone,
      'icon',v_next.icon,
      'points_needed',greatest(0,v_next.min_points-v_points)
    ) end,
    'progress_percent',least(100,greatest(0,v_progress)),
    'breakdown',v_breakdown
  );
end;
$$;

create or replace function public.get_rank_summaries(p_user_ids uuid[])
returns jsonb
language sql
security definer
set search_path=public,auth,pg_temp
stable
as $$
  with wanted as (
    select distinct unnest(coalesce(p_user_ids,'{}'::uuid[])) as user_id
  ),
  scores as (
    select
      w.user_id,
      public.rank_breakdown_for_user(w.user_id) as breakdown
    from wanted w
  ),
  expanded as (
    select
      s.user_id,
      coalesce((s.breakdown->>'total_points')::integer,0) as points
    from scores s
  ),
  ranked as (
    select
      e.user_id,
      e.points,
      rt.code,
      rt.label,
      rt.color,
      rt.tone,
      rt.icon
    from expanded e
    left join lateral (
      select *
      from public.rank_tiers t
      where t.active=true and t.min_points <= e.points
      order by t.min_points desc
      limit 1
    ) rt on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',user_id,
    'points',points,
    'code',code,
    'label',label,
    'color',color,
    'tone',tone,
    'icon',icon
  )),'[]'::jsonb)
  from ranked;
$$;

create or replace function public.get_rank_leaderboard(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := greatest(1,least(coalesce(p_limit,25),50));
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  with users as (
    select distinct p.user_id
    from public.profiles p
    where p.banned is not true
  ),
  scores as (
    select
      u.user_id,
      public.rank_breakdown_for_user(u.user_id) as breakdown
    from users u
  ),
  enriched as (
    select
      s.user_id,
      coalesce((s.breakdown->>'total_points')::integer,0) as points,
      coalesce(nullif(pp.display_name,''),nullif(p.username,''),'CRAZZY Member') as name,
      p.avatar_url,
      coalesce(pp.primary_color,'#0000FF') as primary_color
    from scores s
    join public.profiles p on p.user_id=s.user_id
    left join public.profile_preferences pp on pp.user_id=s.user_id
  ),
  top_users as (
    select *
    from enriched
    order by points desc,user_id
    limit v_limit
  ),
  ranked as (
    select
      row_number() over(order by tu.points desc,tu.user_id)::int as position,
      tu.*,
      rt.code as rank_code,
      rt.label as rank_label,
      rt.color as rank_color,
      rt.tone as rank_tone
    from top_users tu
    left join lateral (
      select *
      from public.rank_tiers t
      where t.active=true and t.min_points <= tu.points
      order by t.min_points desc
      limit 1
    ) rt on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'position',position,
    'user_id',user_id,
    'name',name,
    'avatar_url',avatar_url,
    'primary_color',primary_color,
    'points',points,
    'rank_code',rank_code,
    'rank_label',rank_label,
    'rank_color',rank_color,
    'rank_tone',rank_tone
  ) order by position),'[]'::jsonb)
  into v_result
  from ranked;

  return v_result;
end;
$$;

revoke all on function public.rank_breakdown_for_user(uuid) from public;
revoke all on function public.get_my_rank() from public;
revoke all on function public.get_rank_summaries(uuid[]) from public;
revoke all on function public.get_rank_leaderboard(integer) from public;

revoke execute on function public.rank_breakdown_for_user(uuid) from anon,authenticated;
revoke execute on function public.get_my_rank() from anon;
revoke execute on function public.get_rank_summaries(uuid[]) from anon,authenticated;
revoke execute on function public.get_rank_leaderboard(integer) from anon;

grant execute on function public.get_my_rank() to authenticated;
grant execute on function public.get_rank_leaderboard(integer) to authenticated;
grant execute on function public.rank_breakdown_for_user(uuid) to service_role;
grant execute on function public.get_rank_summaries(uuid[]) to service_role;
