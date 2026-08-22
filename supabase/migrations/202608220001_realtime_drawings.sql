create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drawings_recipient_created_idx
  on public.drawings (recipient_id, created_at desc);
create index if not exists drawings_sender_created_idx
  on public.drawings (sender_id, created_at desc);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.drawings enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "drawings_select_members"
on public.drawings for select to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
  and public.are_friends(sender_id, recipient_id)
  and not public.is_blocked_between(sender_id, recipient_id)
);

create policy "drawings_insert_sender"
on public.drawings for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.are_friends(sender_id, recipient_id)
  and not public.is_blocked_between(sender_id, recipient_id)
);

create policy "drawings_mark_read_recipient"
on public.drawings for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy "push_subscriptions_manage_own"
on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('friend-drawings', 'friend-drawings', false, 5242880, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "drawing_objects_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'friend-drawings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "drawing_objects_select_members"
on storage.objects for select to authenticated
using (
  bucket_id = 'friend-drawings'
  and exists (
    select 1 from public.drawings d
    where d.storage_path = name
      and (select auth.uid()) in (d.sender_id, d.recipient_id)
      and public.are_friends(d.sender_id, d.recipient_id)
  )
);

create policy "drawing_objects_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'friend-drawings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.can_access_drawing_topic(p_topic text, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_first uuid;
  v_second uuid;
begin
  if p_topic is null or left(p_topic, 8) <> 'drawing:' then return false; end if;
  v_first := split_part(p_topic, ':', 2)::uuid;
  v_second := split_part(p_topic, ':', 3)::uuid;
  return p_user_id in (v_first, v_second)
    and v_first::text < v_second::text
    and public.are_friends(v_first, v_second)
    and not public.is_blocked_between(v_first, v_second);
exception when others then
  return false;
end;
$$;

create or replace function public.get_drawing_push_targets(p_drawing_id uuid)
returns table (
  endpoint text,
  p256dh text,
  auth text,
  sender_nickname text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.endpoint, s.p256dh, s.auth, p.nickname
  from public.drawings d
  join public.push_subscriptions s on s.user_id = d.recipient_id
  join public.profiles p on p.id = d.sender_id
  where d.id = p_drawing_id
    and d.sender_id = (select auth.uid())
    and public.are_friends(d.sender_id, d.recipient_id)
    and not public.is_blocked_between(d.sender_id, d.recipient_id);
$$;

drop policy if exists "realtime_send_drawing" on realtime.messages;
create policy "realtime_send_drawing"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_access_drawing_topic((select realtime.topic()), (select auth.uid()))
);

drop policy if exists "realtime_receive_drawing" on realtime.messages;
create policy "realtime_receive_drawing"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_access_drawing_topic((select realtime.topic()), (select auth.uid()))
);

grant select, insert, update on public.drawings to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

revoke all on function public.can_access_drawing_topic(text, uuid) from public, anon;
revoke all on function public.get_drawing_push_targets(uuid) from public, anon;
grant execute on function public.can_access_drawing_topic(text, uuid) to authenticated;
grant execute on function public.get_drawing_push_targets(uuid) to authenticated;
