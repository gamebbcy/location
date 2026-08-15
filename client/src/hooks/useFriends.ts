import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { friendsStore } from '@client/src/lib/storage';
import {
  getMyInviteCode,
  refreshInviteCode,
  verifyInviteCode,
} from '@client/src/lib/utils/invite';
import { APP_CONFIG } from '@client/src/config';
import type { Friend, MotionState } from '@shared/api.interface';

export type { Friend };

// 简单的邀请码→userId 哈希（本地模拟，双方相同邀请码→相同 userId）
function hashInviteToUserId(code: string): string {
  let hash = 0;
  const upper = code.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    hash = (hash * 31 + upper.charCodeAt(i)) >>> 0;
  }
  return `user_${hash.toString(36).padStart(10, '0')}`;
}

// 模拟搜索用户池（本地 demo）
const MOCK_SEARCH_USERS = [
  { nickname: '小太阳', avatar: '#f59e0b' },
  { nickname: '月光下的猫', avatar: '#8b5cf6' },
  { nickname: '海边的风', avatar: '#0ea5e9' },
  { nickname: '山间小鹿', avatar: '#10b981' },
  { nickname: '星河漫步', avatar: '#ec4899' },
  { nickname: '清晨露水', avatar: '#14b8a6' },
];

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myInviteCode, setMyInviteCode] = useState<string>('');
  const [myInviteExpiresAt, setMyInviteExpiresAt] = useState<number | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const list: Friend[] = await friendsStore.getAll<Friend>();
      setFriends(
        list.sort((a: Friend, b: Friend) => {
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return b.addedAt - a.addedAt;
        }),
      );
    } catch (err) {
      logger.error('load friends failed', err);
    }
  }, []);

  const onlineFriends = useMemo<Friend[]>(
    () => friends.filter((f: Friend) => f.isOnline),
    [friends],
  );

  const offlineFriends = useMemo<Friend[]>(
    () => friends.filter((f: Friend) => !f.isOnline),
    [friends],
  );

  const isFriend = useCallback(
    (userId: string): boolean => {
      return friends.some((f: Friend) => f.userId === userId);
    },
    [friends],
  );

  const loadMyInviteCode = useCallback((): void => {
    const info = getMyInviteCode();
    setMyInviteCode(info.code);
    setMyInviteExpiresAt(info.expiresAt);
  }, []);

  const refreshMyInviteCode = useCallback((): { code: string; expiresAt: number } => {
    const result = refreshInviteCode();
    setMyInviteCode(result.code);
    setMyInviteExpiresAt(result.expiresAt);
    return result;
  }, []);

  useEffect(() => {
    loadMyInviteCode();
    loadFriends();
  }, [loadMyInviteCode, loadFriends]);

  const addFriend = useCallback(
    async (
      inviteCode: string,
      nickname: string,
      avatar: string,
      remark?: string,
    ): Promise<Friend> => {
      const code = inviteCode.trim().toUpperCase();
      if (!code) throw new Error('邀请码不能为空');
      if (!verifyInviteCode(code)) throw new Error('邀请码格式不正确');

      const userId = hashInviteToUserId(code);

      // 检查是否已添加
      const existing = await friendsStore.get<Friend>(userId);
      if (existing) {
        throw new Error('该好友已添加');
      }

      const friend: Friend = {
        userId,
        nickname: nickname || APP_CONFIG.defaultNickname,
        avatar: avatar || '',
        inviteCode: code,
        addedAt: Date.now(),
        isOnline: false,
        status: '',
        motionState: 'stay',
        remark: remark || undefined,
      };

      await friendsStore.put(friend);
      await loadFriends();
      return friend;
    },
    [loadFriends],
  );

  const removeFriend = useCallback(
    async (userId: string) => {
      await friendsStore.delete(userId);
      await loadFriends();
    },
    [loadFriends],
  );

  const updateFriend = useCallback(
    async (userId: string, updates: Partial<Friend>) => {
      const existing = await friendsStore.get<Friend>(userId);
      if (!existing) return;
      const updated: Friend = { ...existing, ...updates };
      await friendsStore.put(updated);
      await loadFriends();
    },
    [loadFriends],
  );

  const getFriend = useCallback(
    (userId: string): Friend | undefined => {
      return friends.find((f: Friend) => f.userId === userId);
    },
    [friends],
  );

  /**
   * 按昵称搜索用户（本地 demo：从好友 + mock 池中模糊匹配）
   */
  const searchUsersByNickname = useCallback(
    (keyword: string): Array<{ nickname: string; avatar: string; inviteCode: string; isFriend: boolean }> => {
      const kw = keyword.trim().toLowerCase();
      if (!kw) return [];

      const fromFriends = friends
        .filter((f: Friend) => f.nickname.toLowerCase().includes(kw))
        .map((f: Friend) => ({
          nickname: f.nickname,
          avatar: f.avatar,
          inviteCode: f.inviteCode,
          isFriend: true,
        }));

      const friendCodes = new Set(friends.map((f: Friend) => f.inviteCode));
      const fromMock = MOCK_SEARCH_USERS
        .filter((u) => u.nickname.toLowerCase().includes(kw))
        .map((u) => ({
          nickname: u.nickname,
          avatar: u.avatar,
          inviteCode: hashInviteToUserId(u.nickname).slice(-6).toUpperCase(),
          isFriend: false,
        }))
        .filter((u) => !friendCodes.has(u.inviteCode));

      // 去重 + 截断
      const seen = new Set<string>();
      const result: Array<{ nickname: string; avatar: string; inviteCode: string; isFriend: boolean }> = [];
      for (const item of [...fromFriends, ...fromMock]) {
        if (seen.has(item.inviteCode)) continue;
        seen.add(item.inviteCode);
        result.push(item);
        if (result.length >= 10) break;
      }
      return result;
    },
    [friends],
  );

  return {
    friends,
    onlineFriends,
    offlineFriends,
    myInviteCode,
    myInviteExpiresAt,
    loadFriends,
    addFriend,
    removeFriend,
    deleteFriend: removeFriend,
    updateFriend,
    isFriend,
    refreshMyInviteCode,
    loadMyInviteCode,
    getFriend,
    searchUsersByNickname,
  };
}
