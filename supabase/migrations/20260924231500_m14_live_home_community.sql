-- M14 — live homepage community preview + Realtime
-- The homepage preview reads the same general chat while keeping writes authenticated.

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages'
    ) then
      alter publication supabase_realtime add table public.community_messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='community_reactions'
    ) then
      alter publication supabase_realtime add table public.community_reactions;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='community_attachments'
    ) then
      alter publication supabase_realtime add table public.community_attachments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='community_channels'
    ) then
      alter publication supabase_realtime add table public.community_channels;
    end if;
  end if;
end $$;

create or replace function public.get_public_community_preview(
  p_channel text default 'geral',
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
stable
as $$
declare
  v_channel public.community_channels;
  v_limit integer := greatest(1, least(coalesce(p_limit,8), 20));
  v_messages jsonb;
  v_recent integer;
begin
  select *
  into v_channel
  from public.community_channels
  where slug = lower(btrim(coalesce(p_channel,'geral')))
    and active = true
  limit 1;

  if v_channel.id is null then
    return jsonb_build_object(
      'channel', jsonb_build_object('slug','geral','name','Chat Geral','description','Converse com a comunidade CRAZZY PROJECT.'),
      'messages', '[]'::jsonb,
      'activity', jsonb_build_object('recentUsers',0)
    );
  end if;

  select coalesce(jsonb_agg(item order by created_at asc),'[]'::jsonb)
  into v_messages
  from (
    select
      cm.created_at,
      jsonb_build_object(
        'id', cm.id,
        'body', cm.body,
        'createdAt', cm.created_at,
        'author', jsonb_build_object(
          'name', coalesce(
            nullif(btrim(pp.display_name),''),
            nullif(btrim(p.username),''),
            nullif(btrim(di.global_name),''),
            nullif(btrim(di.username),''),
            'CRAZZY Member'
          ),
          'avatarUrl', coalesce(
            case
              when pp.avatar_source='discord' then di.avatar_url
              when pp.avatar_source='crazzy' then p.avatar_url
              else coalesce(p.avatar_url,di.avatar_url)
            end,
            di.avatar_url,
            p.avatar_url
          )
        )
      ) as item
    from public.community_messages cm
    left join public.profiles p on p.user_id=cm.user_id
    left join public.profile_preferences pp on pp.user_id=cm.user_id
    left join public.discord_identities di on di.user_id=cm.user_id
    where cm.channel_id=v_channel.id
      and cm.deleted_at is null
    order by cm.created_at desc
    limit v_limit
  ) rows_for_preview;

  select count(distinct cm.user_id)::int
  into v_recent
  from public.community_messages cm
  join public.community_channels cc on cc.id=cm.channel_id
  where cc.active=true
    and cm.deleted_at is null
    and cm.created_at >= now() - interval '15 minutes';

  return jsonb_build_object(
    'channel', jsonb_build_object(
      'slug',v_channel.slug,
      'name',v_channel.name,
      'description',v_channel.description
    ),
    'messages',coalesce(v_messages,'[]'::jsonb),
    'activity',jsonb_build_object('recentUsers',coalesce(v_recent,0))
  );
end;
$$;

revoke execute on function public.get_public_community_preview(text,integer) from public;
grant execute on function public.get_public_community_preview(text,integer) to anon, authenticated;
