-- M13 Support realtime publication
-- Enables live ticket conversation updates for customer and staff screens.

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='support_messages'
    ) then
      alter publication supabase_realtime add table public.support_messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets'
    ) then
      alter publication supabase_realtime add table public.support_tickets;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='support_attachments'
    ) then
      alter publication supabase_realtime add table public.support_attachments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='support_ticket_events'
    ) then
      alter publication supabase_realtime add table public.support_ticket_events;
    end if;
  end if;
end $$;
