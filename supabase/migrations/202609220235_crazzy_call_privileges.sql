-- CRAZZY CALL privilege hardening for the already-applied base migration.
revoke execute on function public.create_call_room(text,integer) from public, anon, authenticated;
revoke execute on function public.get_call_room_preview(text) from public, anon, authenticated;
revoke execute on function public.join_call_room(text,text) from public, anon, authenticated;
revoke execute on function public.get_call_room_snapshot(text) from public, anon, authenticated;
revoke execute on function public.leave_call_room(uuid) from public, anon, authenticated;
revoke execute on function public.set_call_presence(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.set_call_room_locked(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.set_call_participant_role(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.kick_call_participant(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.end_call_room(uuid) from public, anon, authenticated;
revoke execute on function public.send_call_message(uuid,text) from public, anon, authenticated;

revoke execute on function private.generate_call_code() from public, anon, authenticated;
revoke execute on function private.is_call_member(uuid,uuid) from public, anon;
revoke execute on function private.is_call_host_or_cohost(uuid,uuid) from public, anon;
grant execute on function private.is_call_member(uuid,uuid) to authenticated;
grant execute on function private.is_call_host_or_cohost(uuid,uuid) to authenticated;

grant execute on function public.create_call_room(text,integer) to authenticated;
grant execute on function public.get_call_room_preview(text) to authenticated;
grant execute on function public.join_call_room(text,text) to authenticated;
grant execute on function public.get_call_room_snapshot(text) to authenticated;
grant execute on function public.leave_call_room(uuid) to authenticated;
grant execute on function public.set_call_presence(uuid,boolean) to authenticated;
grant execute on function public.set_call_room_locked(uuid,boolean) to authenticated;
grant execute on function public.set_call_participant_role(uuid,uuid,text) to authenticated;
grant execute on function public.kick_call_participant(uuid,uuid) to authenticated;
grant execute on function public.end_call_room(uuid) to authenticated;
grant execute on function public.send_call_message(uuid,text) to authenticated;
