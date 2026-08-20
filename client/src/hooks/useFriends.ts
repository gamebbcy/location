import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { friendRepository } from '@client/src/data/friend-repository';
import type { Friend } from '@shared/api.interface';
import { useWebSocket } from './useWebSocket';
import { friendsStore } from '@client/src/lib/storage';
import { useAuth } from './useAuth';
import { useInviteCode } from './useInviteCode';

export type { Friend };

function sortFriends(list: Friend[]): Friend[] {
  return [...list].sort((a, b) => b.addedAt - a.addedAt);
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const { user } = useAuth();
  const {
    code: myInviteCode,
    expiresAt: myInviteExpiresAt,
    load: loadMyInviteCode,
    refresh: refreshMyInviteCode,
  } = useInviteCode(user?.userId);
  const { connect, isConnected, on, off, send } = useWebSocket();

  const loadFriends = useCallback(async () => {
    try {
      setFriends(sortFriends(await friendRepository.syncCache()));
    } catch (error) {
      logger.error('load friends failed', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadFriends(), loadMyInviteCode()]).catch((error) => {
      logger.error('初始化好友数据失败', error);
    });
  }, [loadFriends, loadMyInviteCode]);

  useEffect(() => {
    if (!isConnected) connect();
  }, [connect, isConnected]);

  useEffect(() => {
    const setOnline = (data: unknown, isOnline: boolean) => {
      const userId = (data as { userId?: string })?.userId;
      if (!userId) return;
      setFriends((previous) => previous.map((friend) => {
        if (friend.userId !== userId) return friend;
        const next = { ...friend, isOnline };
        void friendsStore.put(next);
        return next;
      }));
    };
    const handleOnline = (data: unknown) => setOnline(data, true);
    const handleOffline = (data: unknown) => setOnline(data, false);
    on('friend:online', handleOnline);
    on('friend:offline', handleOffline);
    return () => {
      off('friend:online', handleOnline);
      off('friend:offline', handleOffline);
    };
  }, [off, on]);

  useEffect(() => {
    if (!isConnected) return;
    send('friends:sync', { friendUserIds: friends.map((friend) => friend.userId) });
  }, [friends, isConnected, send]);

  const onlineFriends = useMemo(() => friends.filter((friend) => friend.isOnline), [friends]);
  const offlineFriends = useMemo(() => friends.filter((friend) => !friend.isOnline), [friends]);
  const isFriend = useCallback(
    (userId: string) => friends.some((friend) => friend.userId === userId),
    [friends],
  );

  const addFriend = useCallback(async (
    inviteCode: string,
    _nickname: string,
    _avatar: string,
    remark?: string,
  ): Promise<Friend> => {
    const friend = await friendRepository.redeemInvite(inviteCode, remark);
    await loadFriends();
    return friend;
  }, [loadFriends]);

  const removeFriend = useCallback(async (userId: string) => {
    await friendRepository.remove(userId);
    await loadFriends();
  }, [loadFriends]);

  const updateFriend = useCallback(async (userId: string, updates: Partial<Friend>) => {
    if ('remark' in updates) await friendRepository.updateRemark(userId, updates.remark);
    await loadFriends();
  }, [loadFriends]);

  const getFriend = useCallback(
    (userId: string) => friends.find((friend) => friend.userId === userId),
    [friends],
  );

  const searchUsersByNickname = useCallback((keyword: string) => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return friends
      .filter((friend) => (friend.remark || friend.nickname).toLocaleLowerCase().includes(normalized))
      .slice(0, 10)
      .map((friend) => ({
        nickname: friend.remark || friend.nickname,
        avatar: friend.avatar,
        inviteCode: '',
        isFriend: true,
      }));
  }, [friends]);

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
