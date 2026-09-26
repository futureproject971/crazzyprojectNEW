-- CRAZZY CALL: protected rooms and owner-led live broadcasts.
-- Password material is kept outside the exposed call_rooms table.
create extension if not exists pgcrypto with schema extensions;

alter table public.call_rooms
  add column if not exists room_mode text not null default 'call'
    check (room_mode in ('call','live')),
  add column if not exists password_protected boolean not null default false;

create index if not exists call_rooms_live_discovery_idx
  on public.call_rooms(room_mode,status,updated_at desc)
  where room_mode='live' and status in ('waiting','live');

create table if not exists private.call_room_passwords (
  room_id uuid primary key references public.call_rooms(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.call_room_password_attempts (
  room_id uuid not null references public.call_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(room_id,user_id)
);

alter table private.call_room_passwords enable row level security;
alter table private.call_room_password_attempts enable row level security;
revoke all on private.call_room_passwords, private.call_room_password_attempts from public, anon, authenticated;

create or replace function public.create_call_room_secure(
  p_title text default null,
  p_max_participants integer default 20,
  p_room_mode text default 'call',
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,extensions,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_room jsonb;
  v_room_id uuid;
  v_password text := coalesce(p_password,'');
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_room_mode not in ('call','live') then raise exception 'INVALID_ROOM_MODE'; end if;
  if char_length(v_password) > 72 then raise exception 'INVALID_ROOM_PASSWORD'; end if;
  if char_length(v_password) > 0 and char_length(v_password) < 4 then raise exception 'INVALID_ROOM_PASSWORD'; end if;

  v_room := public.create_call_room(p_title,p_max_participants);
  v_room_id := (v_room->>'id')::uuid;
  update public.call_rooms
    set room_mode=p_room_mode,
        password_protected=(char_length(v_password)>0),
        updated_at=now()
  where id=v_room_id;

  if char_length(v_password)>0 then
    insert into private.call_room_passwords(room_id,password_hash)
    values(v_room_id,extensions.crypt(v_password,extensions.gen_salt('bf')));
  end if;

  return v_room || jsonb_build_object(
    'room_mode',p_room_mode,
    'password_protected',(char_length(v_password)>0)
  );
end;
$$;

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
    'id',v_room.id,'code',v_room.code,'owner_id',v_room.owner_id,'title',v_room.title,'status',v_room.status,
    'room_mode',v_room.room_mode,'password_protected',v_room.password_protected,
    'locked',v_room.locked,'max_participants',v_room.max_participants,
    'participant_count',v_count,'allow_screen_share',v_room.allow_screen_share,
    'allow_camera',v_room.allow_camera,'allow_microphone',v_room.allow_microphone
  );
end;
$$;

create or replace function public.join_call_room_secure(
  p_code text,
  p_display_name text default null,
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,extensions,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_room public.call_rooms;
  v_attempt private.call_room_password_attempts;
  v_hash text;
  v_password text := coalesce(p_password,'');
  v_result jsonb;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_room from public.call_rooms where code=upper(btrim(p_code)) for update;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status='ended' then raise exception 'ROOM_ENDED'; end if;
  if v_room.status='disabled' then raise exception 'ROOM_DISABLED'; end if;

  if v_room.password_protected and v_room.owner_id<>v_user and not private.has_role(v_user,'admin'::app_role) then
    select * into v_attempt from private.call_room_password_attempts
      where room_id=v_room.id and user_id=v_user for update;
    if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
      return jsonb_build_object('ok',false,'error','PASSWORD_RATE_LIMITED');
    end if;
    select password_hash into v_hash from private.call_room_passwords where room_id=v_room.id;
    if v_hash is null or extensions.crypt(v_password,v_hash) <> v_hash then
      insert into private.call_room_password_attempts(room_id,user_id,failed_count,locked_until)
      values(v_room.id,v_user,1,case when v_attempt.failed_count>=4 then now()+interval '10 minutes' else null end)
      on conflict(room_id,user_id) do update set
        failed_count=private.call_room_password_attempts.failed_count+1,
        locked_until=case when private.call_room_password_attempts.failed_count+1>=5 then now()+interval '10 minutes' else null end,
        updated_at=now();
      return jsonb_build_object('ok',false,'error','INVALID_ROOM_PASSWORD');
    end if;
    delete from private.call_room_password_attempts where room_id=v_room.id and user_id=v_user;
  end if;

  v_result := public.join_call_room(v_room.code,p_display_name);
  if v_room.room_mode='live' and v_room.owner_id<>v_user and not private.has_role(v_user,'admin'::app_role) then
    update public.call_participants set role='viewer'
      where room_id=v_room.id and user_id=v_user and role='participant';
    v_result := public.get_call_room_snapshot(v_room.code);
  end if;
  return v_result;
end;
$$;

create or replace function public.list_call_broadcasts()
returns jsonb
language sql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb)
  from (
    select id,code,owner_id,title,status,room_mode,password_protected,max_participants,
      created_at,started_at,ended_at,updated_at
    from public.call_rooms
    where auth.uid() is not null and room_mode='live' and status in ('waiting','live')
    order by updated_at desc limit 50
  ) x;
$$;

-- Prevent the old unprotected entry points from bypassing the new policy.
revoke execute on function public.create_call_room(text,integer) from public,anon,authenticated;
revoke execute on function public.join_call_room(text,text) from public,anon,authenticated;
grant execute on function public.create_call_room_secure(text,integer,text,text) to authenticated;
grant execute on function public.join_call_room_secure(text,text,text) to authenticated;
grant execute on function public.get_call_room_preview(text) to authenticated;
grant execute on function public.list_call_broadcasts() to authenticated;
