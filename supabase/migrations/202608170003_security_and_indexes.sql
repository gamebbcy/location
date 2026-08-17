-- Supabase projects may grant default function execution privileges to API
-- roles. Make every SECURITY DEFINER entry point opt-in.
revoke execute on function public.is_active_user(uuid) from public, anon;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
revoke execute on function public.can_view_location(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_my_profile() from public, anon;
revoke execute on function public.get_my_friends() from public, anon;
revoke execute on function public.create_friend_invite() from public, anon;
revoke execute on function public.redeem_friend_invite(text, text) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.realtime_topic_user_id(text, text, text) from public, anon;

-- Authenticated users need these helpers for RLS evaluation and the public RPC
-- entry points used by the application.
grant execute on function public.is_active_user(uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function public.can_view_location(uuid, uuid) to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.create_friend_invite() to authenticated;
grant execute on function public.redeem_friend_invite(text, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.realtime_topic_user_id(text, text, text) to authenticated;

-- Cover the reverse side of foreign keys used by friendship and consent
-- lookups. Composite primary keys already cover the forward side.
create index if not exists friendships_user_b_idx
  on public.friendships (user_b);
create index if not exists share_consents_viewer_id_idx
  on public.share_consents (viewer_id);
create index if not exists friend_invite_codes_created_by_idx
  on public.friend_invite_codes (created_by);
create index if not exists friend_invite_codes_used_by_idx
  on public.friend_invite_codes (used_by)
  where used_by is not null;
create index if not exists blocks_blocked_id_idx
  on public.blocks (blocked_id);
create index if not exists friend_remarks_friend_id_idx
  on public.friend_remarks (friend_id);
