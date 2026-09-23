
create or replace function private.notify_support_staff_reply()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid;
begin
  if new.sender_role='staff' then
    select st.user_id into v_user
    from public.support_tickets st
    where st.id=new.ticket_id;

    if v_user is not null and new.sender_id is distinct from v_user then
      perform public.create_user_notification(
        v_user,'support','Nova resposta no suporte',
        left(coalesce(new.message,'Você recebeu uma nova resposta.'),240),
        '/tickets/'||new.ticket_id::text,'support:'||new.id::text,false,
        jsonb_build_object('ticket_id',new.ticket_id)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_support_staff_reply() from public;
