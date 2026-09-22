-- M27 privilege follow-up for already-applied stock manager base.

drop policy if exists "Admins insert stock batches" on public.stock_batches;
drop policy if exists "Admins update stock batches" on public.stock_batches;

create policy "Admins insert stock batches"
on public.stock_batches for insert to authenticated
with check (
  private.has_role((select auth.uid()),'admin'::app_role)
  and imported_by=(select auth.uid())
);

create policy "Admins update stock batches"
on public.stock_batches for update to authenticated
using (
  private.has_role((select auth.uid()),'admin'::app_role)
  and imported_by=(select auth.uid())
)
with check (
  private.has_role((select auth.uid()),'admin'::app_role)
  and imported_by=(select auth.uid())
);

grant select,insert,update on public.stock_batches to authenticated;

drop policy if exists "Admins insert stock events" on public.stock_events;
create policy "Admins insert stock events"
on public.stock_events for insert to authenticated
with check (
  private.has_role((select auth.uid()),'admin'::app_role)
  and actor_user_id=(select auth.uid())
);

grant select,insert on public.stock_events to authenticated;
