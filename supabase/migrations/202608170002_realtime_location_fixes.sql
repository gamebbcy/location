-- A private Realtime channel checks read permission while joining, even when
-- the client mainly uses it to publish. Let users join their own location
-- channel and keep friend reads behind the existing consent function.
create or replace function public.realtime_topic_user_id(
  p_topic text,
  p_prefix text,
  p_suffix text
)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  raw_id text;
begin
  if p_topic is null
    or left(p_topic, char_length(p_prefix)) <> p_prefix
    or right(p_topic, char_length(p_suffix)) <> p_suffix
  then
    return null;
  end if;

  raw_id := substring(
    p_topic
    from char_length(p_prefix) + 1
    for char_length(p_topic) - char_length(p_prefix) - char_length(p_suffix)
  );
  return raw_id::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.realtime_topic_user_id(text, text, text) from public;
grant execute on function public.realtime_topic_user_id(text, text, text) to authenticated;

drop policy if exists "realtime_receive_friend_location" on realtime.messages;
drop policy if exists "realtime_receive_allowed_location" on realtime.messages;

create policy "realtime_receive_allowed_location"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    public.realtime_topic_user_id(
      (select realtime.topic()), 'user:', ':location'
    ) = (select auth.uid())
    or public.can_view_location(
      public.realtime_topic_user_id(
        (select realtime.topic()), 'user:', ':location'
      ),
      (select auth.uid())
    )
  )
);

-- Location requests use a separate topic. Authorized friends can join and
-- publish a request, while only viewers that already have location consent
-- can observe the topic. No coordinates are carried on this channel.
drop policy if exists "realtime_send_location_request" on realtime.messages;
create policy "realtime_send_location_request"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_view_location(
    public.realtime_topic_user_id(
      (select realtime.topic()), 'user:', ':location-requests'
    ),
    (select auth.uid())
  )
);

drop policy if exists "realtime_receive_location_request" on realtime.messages;
create policy "realtime_receive_location_request"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    public.realtime_topic_user_id(
      (select realtime.topic()), 'user:', ':location-requests'
    ) = (select auth.uid())
    or public.can_view_location(
      public.realtime_topic_user_id(
        (select realtime.topic()), 'user:', ':location-requests'
      ),
      (select auth.uid())
    )
  )
);

-- Recreate the remaining policies here as well. Some self-hosted Supabase
-- bootstrap flows create realtime.messages after the initial app migration,
-- so the original policy block may not have been installed.
drop policy if exists "realtime_send_own_location" on realtime.messages;
create policy "realtime_send_own_location"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'user:' || (select auth.uid())::text || ':location'
  and public.is_active_user((select auth.uid()))
);

drop policy if exists "realtime_send_friend_notification" on realtime.messages;
create policy "realtime_send_friend_notification"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.is_active_user((select auth.uid()))
  and public.are_friends(
    (select auth.uid()),
    public.realtime_topic_user_id(
      (select realtime.topic()), 'user:', ':notifications'
    )
  )
  and not public.is_blocked_between(
    (select auth.uid()),
    public.realtime_topic_user_id(
      (select realtime.topic()), 'user:', ':notifications'
    )
  )
);

drop policy if exists "realtime_receive_own_notification" on realtime.messages;
create policy "realtime_receive_own_notification"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'user:' || (select auth.uid())::text || ':notifications'
  and public.is_active_user((select auth.uid()))
);

drop policy if exists "realtime_track_own_presence" on realtime.messages;
create policy "realtime_track_own_presence"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) = 'friends:' || (select auth.uid())::text || ':presence'
  and public.is_active_user((select auth.uid()))
);

drop policy if exists "realtime_receive_friend_presence" on realtime.messages;
create policy "realtime_receive_friend_presence"
on realtime.messages for select to authenticated
using (
  -- supabase-js includes Broadcast capability in every channel config. A
  -- Presence-only topic therefore needs read authorization for both
  -- extensions to join, while the INSERT policy below remains Presence-only.
  realtime.messages.extension in ('presence', 'broadcast')
  and (
    (select realtime.topic()) = 'friends:' || (select auth.uid())::text || ':presence'
    or (
      public.are_friends(
        (select auth.uid()),
        public.realtime_topic_user_id(
          (select realtime.topic()), 'friends:', ':presence'
        )
      )
      and not public.is_blocked_between(
        (select auth.uid()),
        public.realtime_topic_user_id(
          (select realtime.topic()), 'friends:', ':presence'
        )
      )
      and public.is_active_user((select auth.uid()))
    )
  )
);
