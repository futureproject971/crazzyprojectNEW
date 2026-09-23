
create or replace function public.admin_create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text default null,
  p_discord boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public,private,auth,pg_temp
as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if not exists(select 1 from public.profiles p where p.user_id=p_user_id) then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  return public.create_user_notification(
    p_user_id,
    coalesce(nullif(btrim(p_type),''),'info'),
    p_title,
    p_body,
    p_href,
    'admin:'||gen_random_uuid()::text,
    coalesce(p_discord,false),
    jsonb_build_object('source','admin','actor_user_id',auth.uid())
  );
end;
$$;

revoke all on function public.admin_create_user_notification(uuid,text,text,text,text,boolean)
from public,anon;
grant execute on function public.admin_create_user_notification(uuid,text,text,text,text,boolean)
to authenticated;
