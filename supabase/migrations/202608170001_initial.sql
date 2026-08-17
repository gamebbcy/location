create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '新朋友' check (char_length(nickname) between 1 and 30),
  avatar_url text,
  status text not null default '在线' check (char_length(status) <= 30),
  music_state jsonb,
  location_sharing_enabled boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a::text < user_b::text)
);

create table if not exists public.share_consents (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create table if not exists public.friend_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  used_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.blocks (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, blocked_id),
  check (owner_id <> blocked_id)
);

create table if not exists public.friend_remarks (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  remark text check (char_length(remark) <= 30),
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

create or replace function public.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.enabled
  );
$$;

create or replace function public.are_friends(p_first uuid, p_second uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and f.user_a = least(p_first::text, p_second::text)::uuid
      and f.user_b = greatest(p_first::text, p_second::text)::uuid
  );
$$;

create or replace function public.is_blocked_between(p_first uuid, p_second uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.owner_id = p_first and b.blocked_id = p_second)
       or (b.owner_id = p_second and b.blocked_id = p_first)
  );
$$;

create or replace function public.can_view_location(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user(p_owner)
     and public.is_active_user(p_viewer)
     and public.are_friends(p_owner, p_viewer)
     and not public.is_blocked_between(p_owner, p_viewer)
     and exists (
       select 1 from public.profiles p
       where p.id = p_owner and p.location_sharing_enabled
     )
     and exists (
       select 1 from public.share_consents c
       where c.owner_id = p_owner
         and c.viewer_id = p_viewer
         and c.enabled
     );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    left(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), '新朋友'), 30)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.profiles (id, nickname)
  values (
    auth.uid(),
    left(coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), '新朋友'), 30)
  )
  on conflict (id) do nothing;
end;
$$;

insert into public.profiles (id, nickname)
select
  u.id,
  left(coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), '新朋友'), 30)
from auth.users u
on conflict (id) do nothing;

create or replace function public.get_my_friends()
returns table (
  user_id uuid,
  nickname text,
  avatar_url text,
  phone text,
  added_at timestamptz,
  status text,
  remark text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nickname,
    p.avatar_url,
    null::text,
    f.created_at,
    p.status,
    r.remark
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  left join public.friend_remarks r
    on r.owner_id = auth.uid() and r.friend_id = p.id
  where auth.uid() in (f.user_a, f.user_b)
    and f.status = 'accepted'
    and p.enabled
    and public.is_active_user(auth.uid())
    and not public.is_blocked_between(auth.uid(), p.id)
  order by f.created_at desc;
$$;

create or replace function public.create_friend_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_expires_at timestamptz := now() + interval '3 minutes';
begin
  if auth.uid() is null or not public.is_active_user(auth.uid()) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  delete from public.friend_invite_codes
  where created_by = auth.uid() and used_by is null;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.friend_invite_codes (code_hash, created_by, expires_at)
      values (extensions.digest(v_code, 'sha256'), auth.uid(), v_expires_at);
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return query select v_code, v_expires_at;
end;
$$;

create or replace function public.redeem_friend_invite(
  p_code text,
  p_remark text default null
)
returns table (
  user_id uuid,
  nickname text,
  avatar_url text,
  phone text,
  added_at timestamptz,
  status text,
  remark text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.friend_invite_codes%rowtype;
  v_user_a uuid;
  v_user_b uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null or not public.is_active_user(auth.uid()) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_invite
  from public.friend_invite_codes i
  where i.code_hash = extensions.digest(upper(trim(p_code)), 'sha256')
    and i.used_by is null
    and i.expires_at > now()
  for update;

  if not found then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  if v_invite.created_by = auth.uid() then raise exception 'CANNOT_ADD_SELF'; end if;
  if public.are_friends(v_invite.created_by, auth.uid()) then raise exception 'ALREADY_FRIENDS'; end if;

  v_user_a := least(v_invite.created_by::text, auth.uid()::text)::uuid;
  v_user_b := greatest(v_invite.created_by::text, auth.uid()::text)::uuid;

  if public.is_blocked_between(v_user_a, v_user_b) then
    raise exception 'RELATIONSHIP_BLOCKED';
  end if;

  insert into public.friendships (user_a, user_b, status)
  values (v_user_a, v_user_b, 'accepted')
  on conflict (user_a, user_b) do update set status = 'accepted'
  returning created_at into v_created_at;

  insert into public.share_consents (owner_id, viewer_id, enabled)
  values
    (v_user_a, v_user_b, true),
    (v_user_b, v_user_a, true)
  on conflict (owner_id, viewer_id)
  do update set enabled = true, updated_at = now();

  if nullif(trim(p_remark), '') is not null then
    insert into public.friend_remarks (owner_id, friend_id, remark)
    values (auth.uid(), v_invite.created_by, left(trim(p_remark), 30))
    on conflict (owner_id, friend_id)
    do update set remark = excluded.remark, updated_at = now();
  end if;

  update public.friend_invite_codes
  set used_by = auth.uid(), used_at = now()
  where id = v_invite.id;

  return query
  select p.id, p.nickname, p.avatar_url, null::text, v_created_at, p.status, r.remark
  from public.profiles p
  left join public.friend_remarks r
    on r.owner_id = auth.uid() and r.friend_id = p.id
  where p.id = v_invite.created_by;
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid := least(auth.uid()::text, p_friend_id::text)::uuid;
  v_user_b uuid := greatest(auth.uid()::text, p_friend_id::text)::uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.share_consents
  where (owner_id = auth.uid() and viewer_id = p_friend_id)
     or (owner_id = p_friend_id and viewer_id = auth.uid());
  delete from public.friend_remarks
  where (owner_id = auth.uid() and friend_id = p_friend_id)
     or (owner_id = p_friend_id and friend_id = auth.uid());
  delete from public.friendships where user_a = v_user_a and user_b = v_user_b;
end;
$$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.share_consents enable row level security;
alter table public.friend_invite_codes enable row level security;
alter table public.blocks enable row level security;
alter table public.friend_remarks enable row level security;

create policy "profiles_select_self_or_friend"
on public.profiles for select to authenticated
using (
  public.is_active_user(auth.uid())
  and (id = auth.uid() or public.are_friends(auth.uid(), id))
  and not public.is_blocked_between(auth.uid(), id)
);

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid() and public.is_active_user(auth.uid()))
with check (id = auth.uid() and public.is_active_user(auth.uid()));

create policy "friendships_select_members"
on public.friendships for select to authenticated
using (auth.uid() in (user_a, user_b) and public.is_active_user(auth.uid()));

create policy "consents_select_members"
on public.share_consents for select to authenticated
using (auth.uid() in (owner_id, viewer_id) and public.is_active_user(auth.uid()));

create policy "consents_update_owner"
on public.share_consents for update to authenticated
using (owner_id = auth.uid() and public.is_active_user(auth.uid()))
with check (owner_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "invite_select_owner"
on public.friend_invite_codes for select to authenticated
using (created_by = auth.uid() and public.is_active_user(auth.uid()));

create policy "blocks_manage_owner"
on public.blocks for all to authenticated
using (owner_id = auth.uid() and public.is_active_user(auth.uid()))
with check (owner_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "remarks_manage_owner"
on public.friend_remarks for all to authenticated
using (owner_id = auth.uid() and public.is_active_user(auth.uid()))
with check (
  owner_id = auth.uid()
  and public.is_active_user(auth.uid())
  and public.are_friends(auth.uid(), friend_id)
);

-- Hosted Supabase enables RLS on realtime.messages and locks ALTER TABLE on
-- the realtime schema. Custom authorization policies remain supported.

create policy "realtime_send_own_location"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = 'user:' || auth.uid()::text || ':location'
  and public.is_active_user(auth.uid())
);

create policy "realtime_receive_friend_location"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1 from public.profiles owner
    where realtime.topic() = 'user:' || owner.id::text || ':location'
      and public.can_view_location(owner.id, auth.uid())
  )
);

create policy "realtime_send_friend_notification"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1 from public.profiles receiver
    where realtime.topic() = 'user:' || receiver.id::text || ':notifications'
      and public.is_active_user(auth.uid())
      and public.are_friends(auth.uid(), receiver.id)
      and not public.is_blocked_between(auth.uid(), receiver.id)
  )
);

create policy "realtime_receive_own_notification"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = 'user:' || auth.uid()::text || ':notifications'
  and public.is_active_user(auth.uid())
);

create policy "realtime_track_own_presence"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and realtime.topic() = 'friends:' || auth.uid()::text || ':presence'
  and public.is_active_user(auth.uid())
);

create policy "realtime_receive_friend_presence"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and (
    realtime.topic() = 'friends:' || auth.uid()::text || ':presence'
    or exists (
    select 1 from public.profiles friend
    where realtime.topic() = 'friends:' || friend.id::text || ':presence'
      and public.are_friends(auth.uid(), friend.id)
      and not public.is_blocked_between(auth.uid(), friend.id)
      and public.is_active_user(auth.uid())
    )
  )
);

grant usage on schema public to authenticated;
grant select on public.profiles, public.friendships, public.share_consents,
  public.friend_invite_codes, public.blocks, public.friend_remarks to authenticated;
grant update (nickname, avatar_url, status, music_state, location_sharing_enabled, updated_at)
  on public.profiles to authenticated;
grant update (enabled, updated_at) on public.share_consents to authenticated;
grant insert, update, delete on public.blocks, public.friend_remarks to authenticated;

revoke all on function public.ensure_my_profile() from public;
revoke all on function public.get_my_friends() from public;
revoke all on function public.create_friend_invite() from public;
revoke all on function public.redeem_friend_invite(text, text) from public;
revoke all on function public.remove_friend(uuid) from public;

grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.create_friend_invite() to authenticated;
grant execute on function public.redeem_friend_invite(text, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
