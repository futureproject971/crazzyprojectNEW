-- CRAZZY CALL table privilege hardening.
-- Browser clients may read rows allowed by RLS, but all writes must go through RPC/API.

revoke all on public.call_rooms from anon, authenticated;
revoke all on public.call_participants from anon, authenticated;
revoke all on public.call_messages from anon, authenticated;
revoke all on public.call_events from anon, authenticated;

grant select on public.call_rooms to authenticated;
grant select on public.call_participants to authenticated;
grant select on public.call_messages to authenticated;
grant select on public.call_events to authenticated;
