create or replace function public.send_poke(
  p_recipient_id uuid,
  p_message_id text,
  p_sender_nickname text,
  p_sender_avatar text default null,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
begin
  if v_sender_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_sender_id = p_recipient_id then
    raise exception 'CANNOT_POKE_SELF';
  end if;
  if not public.are_friends(v_sender_id, p_recipient_id)
     or public.is_blocked_between(v_sender_id, p_recipient_id) then
    raise exception 'NOT_FRIENDS';
  end if;

  insert into public.pending_pokes (
    recipient_id,
    sender_id,
    message_id,
    sender_nickname,
    sender_avatar,
    created_at
  ) values (
    p_recipient_id,
    v_sender_id,
    p_message_id,
    coalesce(nullif(trim(p_sender_nickname), ''), '好友'),
    p_sender_avatar,
    coalesce(p_created_at, now())
  )
  on conflict (recipient_id) do update set
    sender_id = excluded.sender_id,
    message_id = excluded.message_id,
    sender_nickname = excluded.sender_nickname,
    sender_avatar = excluded.sender_avatar,
    created_at = excluded.created_at;
end;
$$;

revoke all on function public.send_poke(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.send_poke(uuid, text, text, text, timestamptz) to authenticated;
