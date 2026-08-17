import type { Friend } from '@shared/api.interface';
import { friendsStore } from '@client/src/lib/storage';
import { assertSupabaseConfigured, supabase } from '@client/src/lib/supabase';

type FriendRow = {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  added_at: string;
  status: string | null;
  remark: string | null;
};

type InviteRow = {
  code: string;
  expires_at: string;
};

function mapFriend(row: FriendRow): Friend {
  return {
    userId: row.user_id,
    nickname: row.nickname || '好友',
    avatar: row.avatar_url || '',
    phone: row.phone || undefined,
    inviteCode: '',
    addedAt: new Date(row.added_at).getTime(),
    isOnline: false,
    status: row.status || '',
    motionState: 'stay',
    remark: row.remark || undefined,
  };
}

async function list(): Promise<Friend[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_my_friends');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FriendRow[]).map(mapFriend);
}

async function syncCache(): Promise<Friend[]> {
  const cached = await friendsStore.getAll<Friend>();
  const cachedById = new Map(cached.map((friend) => [friend.userId, friend]));
  const friends = (await list()).map((friend) => ({
    ...friend,
    phone: cachedById.get(friend.userId)?.phone,
  }));
  await friendsStore.clear();
  if (friends.length > 0) await friendsStore.bulkPut(friends);
  return friends;
}

async function get(userId: string): Promise<Friend | undefined> {
  const friends = await syncCache();
  return friends.find((friend) => friend.userId === userId);
}

async function createInvite(): Promise<{ code: string; expiresAt: number }> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('create_friend_invite');
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as InviteRow | undefined;
  if (!row?.code || !row.expires_at) {
    throw new Error('创建好友绑定码失败');
  }
  return { code: row.code, expiresAt: new Date(row.expires_at).getTime() };
}

async function redeemInvite(code: string, remark?: string): Promise<Friend> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('redeem_friend_invite', {
    p_code: code.trim().toUpperCase(),
    p_remark: remark?.trim() || null,
  });
  if (error) {
    if (error.message.includes('INVALID_OR_EXPIRED_CODE')) throw new Error('邀请码无效或已过期');
    if (error.message.includes('CANNOT_ADD_SELF')) throw new Error('不能添加自己为好友');
    if (error.message.includes('ALREADY_FRIENDS')) throw new Error('你们已经是好友');
    if (error.message.includes('RELATIONSHIP_BLOCKED')) throw new Error('当前无法建立好友关系');
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as FriendRow | undefined;
  if (!row?.user_id) throw new Error('绑定好友失败');
  const friend = mapFriend(row);
  await friendsStore.put(friend);
  return friend;
}

async function remove(userId: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc('remove_friend', {
    p_friend_id: userId,
  });
  if (error) throw new Error(error.message);
  await friendsStore.delete(userId);
}

async function updateRemark(userId: string, remark?: string): Promise<void> {
  assertSupabaseConfigured();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('登录状态已失效');

  const { error } = await supabase.from('friend_remarks').upsert(
    {
      owner_id: user.id,
      friend_id: userId,
      remark: remark?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id,friend_id' },
  );
  if (error) throw new Error(error.message);
}

export const friendRepository = {
  list,
  syncCache,
  get,
  createInvite,
  redeemInvite,
  remove,
  updateRemark,
};
