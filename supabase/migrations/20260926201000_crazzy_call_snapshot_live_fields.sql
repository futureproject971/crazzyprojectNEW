-- Include broadcast metadata in the authoritative room snapshot.
create or replace function public.get_call_room_snapshot(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_room public.call_rooms;
  v_participants jsonb;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_room from public.call_rooms where code=upper(btrim(p_code)) limit 1;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if not (v_room.owner_id=v_user or private.is_call_member(v_room.id,v_user) or private.has_role(v_user,'admin'::app_role)) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',cp.id,'user_id',cp.user_id,'display_name',cp.display_name,'avatar_url',cp.avatar_url,
    'role',cp.role,'joined_at',cp.joined_at,'left_at',cp.left_at,'kicked_at',cp.kicked_at,
    'is_connected',cp.is_connected,'last_seen_at',cp.last_seen_at
  ) order by case cp.role when 'host' then 0 when 'cohost' then 1 when 'participant' then 2 else 3 end,cp.joined_at),'[]'::jsonb)
  into v_participants
  from public.call_participants cp
  where cp.room_id=v_room.id and cp.left_at is null and cp.kicked_at is null;

  return jsonb_build_object('room',jsonb_build_object(
    'id',v_room.id,'code',v_room.code,'owner_id',v_room.owner_id,'title',v_room.title,
    'room_mode',v_room.room_mode,'password_protected',v_room.password_protected,
    'status',v_room.status,'locked',v_room.locked,'max_participants',v_room.max_participants,
    'allow_guests',v_room.allow_guests,'allow_screen_share',v_room.allow_screen_share,
    'allow_camera',v_room.allow_camera,'allow_microphone',v_room.allow_microphone,
    'created_at',v_room.created_at,'started_at',v_room.started_at,'ended_at',v_room.ended_at,
    'updated_at',v_room.updated_at
  ),'participants',v_participants);
end;
$$;

grant execute on function public.get_call_room_snapshot(text) to authenticated;
