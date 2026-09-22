-- CRAZZY PROJECT / CRAZZY CALL
-- Backup/reference SQL. Canonical migrations live in supabase/migrations.
-- Apply migrations in filename order.

-- CRAZZY CALL / SCREEN SHARE
-- Isolated realtime room state for CRAZZY PROJECT.
-- Media is NOT stored in Supabase. LiveKit/WebRTC owns audio/video/screen tracks.

create table if not exists public.call_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'waiting'
    check (status in ('waiting','live','ended','disabled')),
  locked boolean not null default false,
  max_participants integer not null default 20
    check (max_participants between 2 and 100),
  allow_guests boolean not null default false,
  allow_screen_share boolean not null default true,
  allow_camera boolean not null default true,
  allow_microphone boolean not null default true,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.call_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.call_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 64),
  avatar_url text,
  role text not null default 'participant'
    check (role in ('host','cohost','participant','viewer')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  kicked_at timestamptz,
  is_connected boolean not null default false,
  last_seen_at timestamptz not null default now(),
  unique(room_id,user_id)
);

create table if not exists public.call_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.call_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null
    check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.call_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_rooms_owner_created_idx
  on public.call_rooms(owner_id,created_at desc);
create index if not exists call_rooms_status_updated_idx
  on public.call_rooms(status,updated_at desc);
create index if not exists call_participants_room_role_idx
  on public.call_participants(room_id,role);
create index if not exists call_participants_user_joined_idx
  on public.call_participants(user_id,joined_at desc);
create index if not exists call_messages_room_created_idx
  on public.call_messages(room_id,created_at asc)
  where deleted_at is null;
create index if not exists call_events_room_created_idx
  on public.call_events(room_id,created_at desc);

alter table public.call_rooms enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_messages enable row level security;
alter table public.call_events enable row level security;

create or replace function private.is_call_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
  select exists (
    select 1
    from public.call_participants cp
    where cp.room_id=p_room_id
      and cp.user_id=p_user_id
      and cp.kicked_at is null
      and cp.left_at is null
  );
$$;

create or replace function private.is_call_host_or_cohost(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
  select
    exists (
      select 1
      from public.call_rooms cr
      where cr.id=p_room_id and cr.owner_id=p_user_id
    )
    or exists (
      select 1
      from public.call_participants cp
      where cp.room_id=p_room_id
        and cp.user_id=p_user_id
        and cp.role in ('host','cohost')
        and cp.kicked_at is null
        and cp.left_at is null
    )
    or private.has_role(p_user_id,'admin'::app_role);
$$;

create or replace function private.generate_call_code()
returns text
language plpgsql
security definer
set search_path=public,pg_temp
volatile
as $$
declare
  v_code text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    exit when not exists (select 1 from public.call_rooms where code=v_code);
    if v_attempt >= 20 then
      raise exception 'CALL_CODE_GENERATION_FAILED';
    end if;
  end loop;
  return v_code;
end;
$$;

drop policy if exists "Call rooms member read" on public.call_rooms;
create policy "Call rooms member read"
on public.call_rooms for select to authenticated
using (
  owner_id=auth.uid()
  or private.is_call_member(id,auth.uid())
  or private.has_role(auth.uid(),'admin'::app_role)
);

drop policy if exists "Call rooms owner insert" on public.call_rooms;
create policy "Call rooms owner insert"
on public.call_rooms for insert to authenticated
with check (owner_id=auth.uid());

drop policy if exists "Call rooms host update" on public.call_rooms;
create policy "Call rooms host update"
on public.call_rooms for update to authenticated
using (
  owner_id=auth.uid()
  or private.has_role(auth.uid(),'admin'::app_role)
)
with check (
  owner_id=auth.uid()
  or private.has_role(auth.uid(),'admin'::app_role)
);

drop policy if exists "Call participants room read" on public.call_participants;
create policy "Call participants room read"
on public.call_participants for select to authenticated
using (
  private.is_call_member(room_id,auth.uid())
  or exists (
    select 1 from public.call_rooms cr
    where cr.id=room_id and cr.owner_id=auth.uid()
  )
  or private.has_role(auth.uid(),'admin'::app_role)
);

drop policy if exists "Call messages room read" on public.call_messages;
create policy "Call messages room read"
on public.call_messages for select to authenticated
using (
  private.is_call_member(room_id,auth.uid())
  or exists (
    select 1 from public.call_rooms cr
    where cr.id=room_id and cr.owner_id=auth.uid()
  )
  or private.has_role(auth.uid(),'admin'::app_role)
);

drop policy if exists "Call events host read" on public.call_events;
create policy "Call events host read"
on public.call_events for select to authenticated
using (
  private.is_call_host_or_cohost(room_id,auth.uid())
  or private.has_role(auth.uid(),'admin'::app_role)
);

create or replace function public.create_call_room(
  p_title text default null,
  p_max_participants integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_room public.call_rooms;
  v_name text;
  v_avatar text;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.user_id=v_user and p.banned=true
  ) then
    raise exception 'ACCOUNT_BANNED';
  end if;

  if p_title is not null and char_length(btrim(p_title)) > 80 then
    raise exception 'INVALID_TITLE';
  end if;

  if p_max_participants < 2 or p_max_participants > 100 then
    raise exception 'INVALID_MAX_PARTICIPANTS';
  end if;

  select
    coalesce(nullif(btrim(pp.display_name),''),nullif(btrim(p.username),''),'Usuário'),
    p.avatar_url
  into v_name,v_avatar
  from public.profiles p
  left join public.profile_preferences pp on pp.user_id=p.user_id
  where p.user_id=v_user;

  v_code := private.generate_call_code();

  insert into public.call_rooms(
    code,owner_id,title,status,max_participants
  )
  values(
    v_code,v_user,nullif(btrim(p_title),''),'waiting',p_max_participants
  )
  returning * into v_room;

  insert into public.call_participants(
    room_id,user_id,display_name,avatar_url,role,is_connected
  )
  values(
    v_room.id,v_user,coalesce(v_name,'Usuário'),v_avatar,'host',false
  );

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(v_room.id,v_user,'ROOM_CREATED',jsonb_build_object('code',v_room.code));

  return jsonb_build_object(
    'id',v_room.id,
    'code',v_room.code,
    'title',v_room.title,
    'status',v_room.status,
    'locked',v_room.locked,
    'max_participants',v_room.max_participants,
    'created_at',v_room.created_at
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
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_room
  from public.call_rooms
  where code=upper(btrim(p_code))
  limit 1;

  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.status='disabled' then
    raise exception 'ROOM_DISABLED';
  end if;

  select count(*)::integer
  into v_count
  from public.call_participants cp
  where cp.room_id=v_room.id
    and cp.left_at is null
    and cp.kicked_at is null;

  return jsonb_build_object(
    'id',v_room.id,
    'code',v_room.code,
    'title',v_room.title,
    'status',v_room.status,
    'locked',v_room.locked,
    'max_participants',v_room.max_participants,
    'participant_count',v_count,
    'allow_screen_share',v_room.allow_screen_share,
    'allow_camera',v_room.allow_camera,
    'allow_microphone',v_room.allow_microphone
  );
end;
$$;

create or replace function public.join_call_room(
  p_code text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_room public.call_rooms;
  v_existing public.call_participants;
  v_name text;
  v_avatar text;
  v_count integer;
  v_role text := 'participant';
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_room
  from public.call_rooms
  where code=upper(btrim(p_code))
  for update;

  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.status='ended' then
    raise exception 'ROOM_ENDED';
  end if;

  if v_room.status='disabled' then
    raise exception 'ROOM_DISABLED';
  end if;

  if v_room.locked and v_room.owner_id<>v_user and not private.has_role(v_user,'admin'::app_role) then
    raise exception 'ROOM_LOCKED';
  end if;

  select *
  into v_existing
  from public.call_participants cp
  where cp.room_id=v_room.id and cp.user_id=v_user
  limit 1;

  if v_existing.id is not null and v_existing.kicked_at is not null
     and v_room.owner_id<>v_user
     and not private.has_role(v_user,'admin'::app_role) then
    raise exception 'PARTICIPANT_KICKED';
  end if;

  select count(*)::integer
  into v_count
  from public.call_participants cp
  where cp.room_id=v_room.id
    and cp.left_at is null
    and cp.kicked_at is null
    and cp.user_id<>v_user;

  if v_count >= v_room.max_participants then
    raise exception 'ROOM_FULL';
  end if;

  select
    coalesce(
      nullif(btrim(p_display_name),''),
      nullif(btrim(pp.display_name),''),
      nullif(btrim(p.username),''),
      'Usuário'
    ),
    p.avatar_url
  into v_name,v_avatar
  from public.profiles p
  left join public.profile_preferences pp on pp.user_id=p.user_id
  where p.user_id=v_user;

  if v_room.owner_id=v_user then
    v_role := 'host';
  elsif v_existing.role='cohost' then
    v_role := 'cohost';
  elsif v_existing.role='viewer' then
    v_role := 'viewer';
  end if;

  insert into public.call_participants(
    room_id,user_id,display_name,avatar_url,role,joined_at,left_at,kicked_at,is_connected,last_seen_at
  )
  values(
    v_room.id,v_user,coalesce(v_name,'Usuário'),v_avatar,v_role,now(),null,null,false,now()
  )
  on conflict(room_id,user_id)
  do update set
    display_name=excluded.display_name,
    avatar_url=excluded.avatar_url,
    role=case
      when public.call_participants.role='cohost' then 'cohost'
      when public.call_participants.role='viewer' then 'viewer'
      else excluded.role
    end,
    joined_at=now(),
    left_at=null,
    kicked_at=null,
    is_connected=false,
    last_seen_at=now();

  if v_room.status='waiting' then
    update public.call_rooms
    set status='live',started_at=coalesce(started_at,now()),updated_at=now()
    where id=v_room.id;
  end if;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(v_room.id,v_user,'ROOM_JOINED','{}'::jsonb);

  return public.get_call_room_snapshot(v_room.code);
end;
$$;

create or replace function public.get_call_room_snapshot(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
stable
as $$
declare
  v_user uuid := auth.uid();
  v_room public.call_rooms;
  v_participants jsonb;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_room
  from public.call_rooms
  where code=upper(btrim(p_code))
  limit 1;

  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if not (
    v_room.owner_id=v_user
    or private.is_call_member(v_room.id,v_user)
    or private.has_role(v_user,'admin'::app_role)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',cp.id,
      'user_id',cp.user_id,
      'display_name',cp.display_name,
      'avatar_url',cp.avatar_url,
      'role',cp.role,
      'joined_at',cp.joined_at,
      'left_at',cp.left_at,
      'kicked_at',cp.kicked_at,
      'is_connected',cp.is_connected,
      'last_seen_at',cp.last_seen_at
    )
    order by
      case cp.role when 'host' then 0 when 'cohost' then 1 when 'participant' then 2 else 3 end,
      cp.joined_at
  ),'[]'::jsonb)
  into v_participants
  from public.call_participants cp
  where cp.room_id=v_room.id
    and cp.left_at is null
    and cp.kicked_at is null;

  return jsonb_build_object(
    'room',jsonb_build_object(
      'id',v_room.id,
      'code',v_room.code,
      'owner_id',v_room.owner_id,
      'title',v_room.title,
      'status',v_room.status,
      'locked',v_room.locked,
      'max_participants',v_room.max_participants,
      'allow_guests',v_room.allow_guests,
      'allow_screen_share',v_room.allow_screen_share,
      'allow_camera',v_room.allow_camera,
      'allow_microphone',v_room.allow_microphone,
      'created_at',v_room.created_at,
      'started_at',v_room.started_at,
      'ended_at',v_room.ended_at,
      'updated_at',v_room.updated_at
    ),
    'participants',v_participants
  );
end;
$$;

create or replace function public.leave_call_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  update public.call_participants
  set left_at=now(),is_connected=false,last_seen_at=now()
  where room_id=p_room_id and user_id=v_user and kicked_at is null;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(p_room_id,v_user,'ROOM_LEFT','{}'::jsonb);

  return true;
end;
$$;

create or replace function public.set_call_presence(
  p_room_id uuid,
  p_connected boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  update public.call_participants
  set
    is_connected=p_connected,
    last_seen_at=now(),
    left_at=case when p_connected then null else left_at end
  where room_id=p_room_id
    and user_id=v_user
    and kicked_at is null;

  if not found then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  return true;
end;
$$;

create or replace function public.set_call_room_locked(
  p_room_id uuid,
  p_locked boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not private.is_call_host_or_cohost(p_room_id,v_user) then
    raise exception 'FORBIDDEN';
  end if;

  update public.call_rooms
  set locked=p_locked,updated_at=now()
  where id=p_room_id and status in ('waiting','live');

  if not found then
    raise exception 'ROOM_NOT_ACTIVE';
  end if;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(
    p_room_id,
    v_user,
    case when p_locked then 'ROOM_LOCKED' else 'ROOM_UNLOCKED' end,
    '{}'::jsonb
  );

  return true;
end;
$$;

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
  v_target_user uuid;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select owner_id into v_owner from public.call_rooms where id=p_room_id;
  if v_owner is null then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_owner<>v_user and not private.has_role(v_user,'admin'::app_role) then
    raise exception 'FORBIDDEN';
  end if;

  if p_role not in ('cohost','participant','viewer') then
    raise exception 'INVALID_ROLE';
  end if;

  select user_id into v_target_user
  from public.call_participants
  where id=p_participant_id and room_id=p_room_id;

  if v_target_user is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if v_target_user=v_owner then raise exception 'HOST_ROLE_IMMUTABLE'; end if;
  if v_target_user=v_user then raise exception 'CANNOT_CHANGE_SELF_ROLE'; end if;

  update public.call_participants
  set role=p_role
  where id=p_participant_id and room_id=p_room_id;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(
    p_room_id,
    v_user,
    'ROLE_CHANGED',
    jsonb_build_object('participant_id',p_participant_id,'role',p_role)
  );

  return true;
end;
$$;

create or replace function public.kick_call_participant(
  p_room_id uuid,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_target public.call_participants;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select owner_id into v_owner from public.call_rooms where id=p_room_id;
  if v_owner is null then raise exception 'ROOM_NOT_FOUND'; end if;

  if not private.is_call_host_or_cohost(p_room_id,v_user) then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_target
  from public.call_participants
  where id=p_participant_id and room_id=p_room_id;

  if v_target.id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if v_target.user_id=v_owner then raise exception 'CANNOT_KICK_HOST'; end if;
  if v_target.role='cohost' and v_owner<>v_user and not private.has_role(v_user,'admin'::app_role) then
    raise exception 'FORBIDDEN';
  end if;

  update public.call_participants
  set kicked_at=now(),left_at=now(),is_connected=false,last_seen_at=now()
  where id=p_participant_id;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(
    p_room_id,
    v_user,
    'PARTICIPANT_KICKED',
    jsonb_build_object('participant_id',p_participant_id,'target_user_id',v_target.user_id)
  );

  return true;
end;
$$;

create or replace function public.end_call_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not (
    exists(select 1 from public.call_rooms where id=p_room_id and owner_id=v_user)
    or private.has_role(v_user,'admin'::app_role)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.call_rooms
  set status='ended',ended_at=coalesce(ended_at,now()),locked=true,updated_at=now()
  where id=p_room_id and status<>'ended';

  if not found then
    raise exception 'ROOM_NOT_ACTIVE';
  end if;

  update public.call_participants
  set left_at=coalesce(left_at,now()),is_connected=false,last_seen_at=now()
  where room_id=p_room_id and left_at is null;

  insert into public.call_events(room_id,user_id,event_type,metadata)
  values(p_room_id,v_user,'ROOM_ENDED','{}'::jsonb);

  return true;
end;
$$;

create or replace function public.send_call_message(
  p_room_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_message public.call_messages;
  v_recent integer;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not private.is_call_member(p_room_id,v_user) then
    raise exception 'FORBIDDEN';
  end if;

  if p_message is null
     or char_length(btrim(p_message)) < 1
     or char_length(btrim(p_message)) > 2000 then
    raise exception 'INVALID_MESSAGE';
  end if;

  select count(*)::integer
  into v_recent
  from public.call_messages cm
  where cm.user_id=v_user
    and cm.created_at > now() - interval '10 seconds';

  if v_recent >= 8 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.call_messages(room_id,user_id,message)
  values(p_room_id,v_user,btrim(p_message))
  returning * into v_message;

  return jsonb_build_object(
    'id',v_message.id,
    'room_id',v_message.room_id,
    'user_id',v_message.user_id,
    'message',v_message.message,
    'created_at',v_message.created_at
  );
end;
$$;

revoke all on public.call_rooms from anon, authenticated;
revoke all on public.call_participants from anon, authenticated;
revoke all on public.call_messages from anon, authenticated;
revoke all on public.call_events from anon, authenticated;

grant select on public.call_rooms to authenticated;
grant select on public.call_participants to authenticated;
grant select on public.call_messages to authenticated;
grant select on public.call_events to authenticated;

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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='call_messages'
  ) then
    alter publication supabase_realtime add table public.call_messages;
  end if;
end
$$;


-- ============================================================
-- PRIVILEGE HARDENING
-- ============================================================

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


-- ============================================================
-- TABLE PRIVILEGE HARDENING
-- ============================================================

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

