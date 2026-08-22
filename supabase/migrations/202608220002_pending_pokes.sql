create table if not exists public.pending_pokes (
  recipient_id uuid primary key references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  sender_nickname text not null default '好友',
  sender_avatar text,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

alter table public.pending_pokes enable row level security;

create policy "pending_pokes_read_own"
on public.pending_pokes for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "pending_pokes_insert_friend"
on public.pending_pokes for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.are_friends(sender_id, recipient_id)
  and not public.is_blocked_between(sender_id, recipient_id)
);

create policy "pending_pokes_update_friend"
on public.pending_pokes for update to authenticated
using (
  public.are_friends((select auth.uid()), recipient_id)
  and not public.is_blocked_between((select auth.uid()), recipient_id)
)
with check (
  sender_id = (select auth.uid())
  and public.are_friends(sender_id, recipient_id)
  and not public.is_blocked_between(sender_id, recipient_id)
);

create policy "pending_pokes_delete_own"
on public.pending_pokes for delete to authenticated
using (recipient_id = (select auth.uid()));

grant select, insert, update, delete on public.pending_pokes to authenticated;
