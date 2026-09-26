-- Discord is the voice transport; existing call_rooms remain the screen transport.
create table public.voice_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 category_id text, panel_channel_id text, panel_message_id text, farm_channel_id text, afk_channel_id text,
 grace_seconds integer not null default 60 check(grace_seconds between 30 and 600),
 max_rooms integer not null default 20 check(max_rooms between 1 and 50),
 farm_xp_per_minute integer not null default 0 check(farm_xp_per_minute between 0 and 1000),
 social_xp_per_minute integer not null default 0 check(social_xp_per_minute between 0 and 1000),
 screen_xp_per_minute integer not null default 0 check(screen_xp_per_minute between 0 and 1000),
 daily_xp_cap integer not null default 0 check(daily_xp_cap between 0 and 100000),
 session_xp_cap integer not null default 0 check(session_xp_cap between 0 and 100000),
 xp_per_bonus_cent integer not null default 0 check(xp_per_bonus_cent between 0 and 1000000),
 updated_at timestamptz not null default now()
);
insert into public.voice_settings(id) values(true);
alter table public.voice_settings enable row level security;
grant select,update on public.voice_settings to authenticated;
grant all on public.voice_settings to service_role;
create policy "Voice settings admin" on public.voice_settings for all to authenticated using(public.is_current_admin()) with check(public.is_current_admin());
create table public.voice_rooms (
 id uuid primary key default gen_random_uuid(), guild_id text not null, channel_id text unique,
 room_number integer not null, owner_discord_id text not null, call_room_id uuid unique references public.call_rooms(id),
 privacy text not null check(privacy in ('public','private','locked')), user_limit integer not null default 0 check(user_limit between 0 and 99),
 status text not null default 'provisioning' check(status in ('provisioning','active','closing','closed')),
 empty_since timestamptz, owner_left_since timestamptz, created_at timestamptz not null default now(), closed_at timestamptz
);
create unique index voice_owner_active on public.voice_rooms(guild_id,owner_discord_id) where status<>'closed';
create unique index voice_number_active on public.voice_rooms(guild_id,room_number) where status<>'closed';
create index voice_rooms_call_idx on public.voice_rooms(call_room_id,status);
create table public.voice_members (
 room_id uuid not null references public.voice_rooms(id), discord_user_id text not null,
 status text not null check(status in ('pending','accepted','rejected','removed')),
 joined_at timestamptz not null default now(), presence_at timestamptz, primary key(room_id,discord_user_id)
);
create index voice_member_user_idx on public.voice_members(discord_user_id,status);
create table public.voice_handoffs (
 token_hash text primary key,room_id uuid not null references public.voice_rooms(id),discord_user_id text not null,
 expires_at timestamptz not null default now()+interval '2 minutes',used_at timestamptz, revoked_at timestamptz
);
create index voice_handoff_room_idx on public.voice_handoffs(room_id);
create table public.voice_audit (
 id bigint generated always as identity primary key,room_id uuid references public.voice_rooms(id),discord_user_id text,event text not null,created_at timestamptz not null default now()
);
create index voice_audit_room_idx on public.voice_audit(room_id,created_at);
create table public.activity_xp_sessions (
 discord_user_id text not null,source text not null check(source in ('voice','screen')), session_id uuid not null default gen_random_uuid(),
 started_at timestamptz not null default now(),last_validated_at timestamptz not null default now(),remainder numeric not null default 0,awarded integer not null default 0,
 primary key(discord_user_id,source)
);
create table public.activity_xp_ledger (
 id bigint generated always as identity primary key,discord_user_id text not null,amount integer not null,source text not null,reference text not null unique,created_at timestamptz not null default now()
);
create index xp_user_date_idx on public.activity_xp_ledger(discord_user_id,created_at);
do $$ declare t text; begin
 foreach t in array array['voice_rooms','voice_members','voice_handoffs','voice_audit','activity_xp_sessions','activity_xp_ledger'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy "Voice admin read" on public.%I for select to authenticated using(public.is_current_admin())',t);
 end loop;
end $$;
-- Handoff hashes are never exposed, including through admin clients.
revoke select on public.voice_handoffs from authenticated;
grant usage,select on sequence public.voice_audit_id_seq,public.activity_xp_ledger_id_seq to service_role;
create or replace function public.reserve_voice_room(p_guild text,p_owner text,p_privacy text,p_limit integer) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare cfg public.voice_settings; r public.voice_rooms; u uuid; call_id uuid; number integer;
begin
 select * into cfg from public.voice_settings where id for update;
 if not cfg.enabled then raise exception 'VOICE_DISABLED'; end if;
 if p_privacy not in ('public','private') or p_limit not between 0 and 99 then raise exception 'INVALID_ROOM'; end if;
 select user_id into u from public.discord_identities where discord_user_id=p_owner and guild_member=true and guild_id=p_guild;
 if u is null then raise exception 'LOGIN_REQUIRED'; end if;
 select * into r from public.voice_rooms where guild_id=p_guild and owner_discord_id=p_owner and status<>'closed';
 if found then return to_jsonb(r); end if;
 if exists(select 1 from public.voice_rooms where owner_discord_id=p_owner and created_at>now()-interval '60 seconds') then raise exception 'RATE_LIMITED'; end if;
 select n into number from generate_series(1,cfg.max_rooms) n where not exists(select 1 from public.voice_rooms where guild_id=p_guild and room_number=n and status<>'closed') order by n limit 1;
 if number is null then raise exception 'ROOM_LIMIT'; end if;
 insert into public.call_rooms(code,owner_id,title,allow_microphone,max_participants) values(private.generate_call_code(),u,'Call '||lpad(number::text,3,'0'),false,case when p_limit=0 then 100 else greatest(2,p_limit) end) returning id into call_id;
 insert into public.voice_rooms(guild_id,room_number,owner_discord_id,privacy,user_limit,call_room_id) values(p_guild,number,p_owner,p_privacy,p_limit,call_id) returning * into r;
 insert into public.voice_members(room_id,discord_user_id,status) values(r.id,p_owner,'accepted');
 insert into public.voice_audit(room_id,discord_user_id,event) values(r.id,p_owner,'ROOM_RESERVED');
 return to_jsonb(r);
end $$;
revoke all on function public.reserve_voice_room(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_voice_room(text,text,text,integer) to service_role;
create or replace function private.voice_authorized(p_call uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=public,private,pg_temp as $$
select not exists(select 1 from public.voice_rooms where call_room_id=p_call)
or exists(select 1 from public.voice_rooms r join public.voice_members m on m.room_id=r.id join public.discord_identities di on di.discord_user_id=m.discord_user_id
where r.call_room_id=p_call and r.status='active' and m.status='accepted' and di.user_id=p_user and di.guild_member=true and di.guild_id=r.guild_id);
$$;
revoke all on function private.voice_authorized(uuid,uuid) from public,anon,authenticated;
create or replace function private.guard_voice_join() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 if new.left_at is null and new.kicked_at is null and not private.voice_authorized(new.room_id,new.user_id) then raise exception 'FORBIDDEN'; end if;
 return new;
end $$;
revoke all on function private.guard_voice_join() from public,anon,authenticated;
create trigger voice_participant_guard before insert or update on public.call_participants for each row execute function private.guard_voice_join();
create or replace function public.consume_voice_handoff(p_token text) returns text
language plpgsql security definer set search_path=public,private,extensions,pg_temp as $$
declare h public.voice_handoffs; discord_id text; r public.voice_rooms; code text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select discord_user_id into discord_id from public.discord_identities where user_id=auth.uid() and guild_member=true;
 select * into h from public.voice_handoffs where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if h.token_hash is null or h.discord_user_id is distinct from discord_id or h.used_at is not null or h.revoked_at is not null or h.expires_at<=now() then raise exception 'FORBIDDEN'; end if;
 select * into r from public.voice_rooms where id=h.room_id;
 if not private.voice_authorized(r.call_room_id,auth.uid()) then raise exception 'FORBIDDEN'; end if;
 update public.voice_handoffs set used_at=now() where token_hash=h.token_hash;
 select cr.code into code from public.call_rooms cr where cr.id=r.call_room_id;
 return code;
end $$;
revoke all on function public.consume_voice_handoff(text) from public,anon;
grant execute on function public.consume_voice_handoff(text) to authenticated;
-- Trusted bot/server observations only. Long gaps/restarts never mint offline time.
create or replace function public.record_activity_xp(p_discord_id text,p_source text,p_active boolean,p_farm boolean default false) returns integer
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare cfg public.voice_settings; s public.activity_xp_sessions; rate integer; elapsed numeric; points integer; today integer; key text;
begin
 if p_source not in ('voice','screen') then raise exception 'INVALID_SOURCE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('xp:'||p_discord_id,887));
 select * into cfg from public.voice_settings where id;
 if not p_active or not cfg.enabled then delete from public.activity_xp_sessions where discord_user_id=p_discord_id and source=p_source;return 0;end if;
 select * into s from public.activity_xp_sessions where discord_user_id=p_discord_id and source=p_source for update;
 if not found then insert into public.activity_xp_sessions(discord_user_id,source) values(p_discord_id,p_source);return 0;end if;
 rate:=case when p_source='screen' then cfg.screen_xp_per_minute when p_farm then cfg.farm_xp_per_minute else cfg.social_xp_per_minute end;
 elapsed:=extract(epoch from now()-s.last_validated_at);
 if elapsed>90 or elapsed<1 then update public.activity_xp_sessions set last_validated_at=now(),remainder=0 where discord_user_id=p_discord_id and source=p_source;return 0;end if;
 select coalesce(sum(amount),0) into today from public.activity_xp_ledger where discord_user_id=p_discord_id and amount>0 and (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
 points:=greatest(0,least(floor(elapsed*rate/60+s.remainder)::integer,cfg.daily_xp_cap-today,cfg.session_xp_cap-s.awarded));
 key:=s.session_id::text||':'||s.last_validated_at::text;
 if points>0 then insert into public.activity_xp_ledger(discord_user_id,amount,source,reference) values(p_discord_id,points,p_source,key) on conflict(reference) do nothing;end if;
 update public.activity_xp_sessions set last_validated_at=now(),awarded=awarded+points,remainder=mod(elapsed*rate/60+s.remainder,1) where discord_user_id=p_discord_id and source=p_source;
 return points;
end $$;
revoke all on function public.record_activity_xp(text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.record_activity_xp(text,text,boolean,boolean) to service_role;
create or replace function public.my_activity_xp(p_convert boolean default false) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare d text; balance bigint; ratio integer; cents bigint;ref text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 select discord_user_id into d from public.discord_identities where user_id=auth.uid();
 if d is null then raise exception 'DISCORD_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('xp:'||d,887));
 select coalesce(sum(amount),0) into balance from public.activity_xp_ledger where discord_user_id=d;
 select xp_per_bonus_cent into ratio from public.voice_settings where id;
 if p_convert then
  if ratio<=0 then raise exception 'CONVERSION_DISABLED';end if;
  cents:=balance/ratio;if cents<1 then raise exception 'XP_LOW';end if;
  ref:='xp-convert:'||gen_random_uuid()::text;
  insert into public.activity_xp_ledger(discord_user_id,amount,source,reference) values(d,-(cents*ratio),'bonus_conversion',ref);
  perform private.bonus_credit(auth.uid(),cents::integer,'xp',ref,'Recompensa por atividade',null);
  balance:=balance-cents*ratio;
 end if;
 return jsonb_build_object('balance',balance,'xp_per_bonus_cent',ratio,'conversion_enabled',ratio>0);
end $$;
revoke all on function public.my_activity_xp(boolean) from public,anon;
grant execute on function public.my_activity_xp(boolean) to authenticated;

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
  if not private.voice_authorized(v_room.id,v_user) then raise exception 'FORBIDDEN'; end if;
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
  if not private.voice_authorized(v_room.id,v_user) then raise exception 'FORBIDDEN'; end if;
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
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_room from public.call_rooms where code=upper(btrim(p_code)) limit 1;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if not private.voice_authorized(v_room.id,v_user) then raise exception 'FORBIDDEN'; end if;
  if not (v_room.owner_id=v_user or private.is_call_member(v_room.id,v_user) or private.has_role(v_user,'admin'::app_role)) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',cp.id,'user_id',cp.user_id,'display_name',cp.display_name,'avatar_url',cp.avatar_url,
    'role',cp.role,'joined_at',cp.joined_at,'left_at',cp.left_at,'kicked_at',cp.kicked_at,
    'is_connected',cp.is_connected,'last_seen_at',cp.last_seen_at
  ) order by case cp.role when 'host' then 0 when 'cohost' then 1 when 'participant' then 2 else 3 end,cp.joined_at),'[]'::jsonb)
  into v_participants
  from public.call_participants cp
  where cp.room_id=v_room.id and cp.left_at is null and cp.kicked_at is null;

  return jsonb_build_object('room',jsonb_build_object(
    'id',v_room.id,'code',v_room.code,'owner_id',v_room.owner_id,'title',v_room.title,
    'room_mode',v_room.room_mode,'password_protected',v_room.password_protected,
    'status',v_room.status,'locked',v_room.locked,'max_participants',v_room.max_participants,
    'allow_guests',v_room.allow_guests,'allow_screen_share',v_room.allow_screen_share,
    'allow_camera',v_room.allow_camera,'allow_microphone',v_room.allow_microphone,
    'created_at',v_room.created_at,'started_at',v_room.started_at,'ended_at',v_room.ended_at,
    'updated_at',v_room.updated_at
  ),'participants',v_participants);
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
  if not private.voice_authorized(v_room.id,v_user) then raise exception 'FORBIDDEN'; end if;
  if v_room.status='disabled' then raise exception 'ROOM_DISABLED'; end if;
  select count(*)::integer into v_count from public.call_participants cp
    where cp.room_id=v_room.id and cp.left_at is null and cp.kicked_at is null;
  return jsonb_build_object(
    'id',v_room.id,'code',v_room.code,'owner_id',v_room.owner_id,'title',v_room.title,
    'status',v_room.status,'room_mode',v_room.room_mode,'password_protected',v_room.password_protected,
    'locked',v_room.locked,'max_participants',v_room.max_participants,'participant_count',v_count,
    'allow_screen_share',v_room.allow_screen_share,'allow_camera',v_room.allow_camera,
    'allow_microphone',v_room.allow_microphone
  );
end;
$$;

-- Keep Realtime policies consistent with explicit API checks after membership revocation.
create or replace function private.is_call_member(p_room_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,private,pg_temp as $$
select private.voice_authorized(p_room_id,p_user_id) and exists(select 1 from public.call_participants where room_id=p_room_id and user_id=p_user_id and kicked_at is null and left_at is null);
$$;
revoke all on function private.is_call_member(uuid,uuid) from public,anon;
grant execute on function private.is_call_member(uuid,uuid) to authenticated;
