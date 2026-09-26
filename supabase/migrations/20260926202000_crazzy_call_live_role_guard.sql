-- A live audience can never be promoted to a publishing participant.
create or replace function public.set_call_participant_role(
  p_room_id uuid,
  p_participant_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_room_mode text;
  v_target_user uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  select owner_id,room_mode into v_owner,v_room_mode from public.call_rooms where id=p_room_id;
  if v_owner is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_owner<>v_user and not private.has_role(v_user,'admin'::app_role) then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('cohost','participant','viewer') then raise exception 'INVALID_ROLE'; end if;
  if v_room_mode='live' and p_role='participant' then raise exception 'LIVE_AUDIENCE_VIEW_ONLY'; end if;
  select user_id into v_target_user from public.call_participants where id=p_participant_id and room_id=p_room_id;
  if v_target_user is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if v_target_user=v_owner then raise exception 'HOST_ROLE_IMMUTABLE'; end if;
  if v_target_user=v_user then raise exception 'CANNOT_CHANGE_SELF_ROLE'; end if;
  update public.call_participants set role=p_role where id=p_participant_id and room_id=p_room_id;
  insert into public.call_events(room_id,user_id,event_type,metadata)
    values(p_room_id,v_user,'ROLE_CHANGED',jsonb_build_object('participant_id',p_participant_id,'role',p_role));
  return true;
end;
$$;
grant execute on function public.set_call_participant_role(uuid,uuid,text) to authenticated;
