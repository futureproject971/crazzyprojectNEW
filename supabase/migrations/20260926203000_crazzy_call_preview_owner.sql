create or replace function public.get_call_room_preview(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_room public.call_rooms;
  v_count integer;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_room from public.call_rooms where code=upper(btrim(p_code)) limit 1;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status='disabled' then raise exception 'ROOM_DISABLED'; end if;
  select count(*)::integer into v_count from public.call_participants cp
    where cp.room_id=v_room.id and cp.left_at is null and cp.kicked_at is null;
  return jsonb_build_object(
    'id',v_room.id,'code',v_room.code,'owner_id',v_room.owner_id,'title',v_room.title,
    'status',v_room.status,'room_mode',v_room.room_mode,'password_protected',v_room.password_protected,
    'locked',v_room.locked,'max_participants',v_room.max_participants,'participant_count',v_count,
    'allow_screen_share',v_room.allow_screen_share,'allow_camera',v_room.allow_camera,
    'allow_microphone',v_room.allow_microphone
  );
end;
$$;
grant execute on function public.get_call_room_preview(text) to authenticated;
