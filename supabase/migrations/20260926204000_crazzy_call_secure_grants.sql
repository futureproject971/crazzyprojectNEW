-- Explicitly remove Postgres' default PUBLIC execute grant from the new APIs.
revoke execute on function public.create_call_room_secure(text,integer,text,text) from public,anon;
revoke execute on function public.join_call_room_secure(text,text,text) from public,anon;
revoke execute on function public.list_call_broadcasts() from public,anon;
revoke execute on function public.get_call_room_preview(text) from public,anon;
revoke execute on function public.get_call_room_snapshot(text) from public,anon;
grant execute on function public.create_call_room_secure(text,integer,text,text) to authenticated;
grant execute on function public.join_call_room_secure(text,text,text) to authenticated;
grant execute on function public.list_call_broadcasts() to authenticated;
grant execute on function public.get_call_room_preview(text) to authenticated;
grant execute on function public.get_call_room_snapshot(text) to authenticated;
