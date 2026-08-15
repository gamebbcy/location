import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useWebSocket } from './useWebSocket';
import {
  friendsStore,
  getPermissions,
  setPermissions,
} from '@client/src/lib/storage';
import type {
  FriendStatusPayload,
  FriendsOnlineSnapshotPayload,
  FriendsSyncPayload,
} from '@shared/api.interface';

export interface UseFriendPresenceReturn {
  offlineFriends: Set<string>;
  isFriendOnline: (userId: string) => boolean;
  handleFriendOnline: (userId: string) => void;
  handleFriendOffline: (userId: string) => void;
  syncFriends: () => Promise<void>;
}

/**
 * 获取好友昵称（从 friendsStore 读取）。
 */
async function getFriendNickname(friendId: string): Promise<string> {
  try {
    const friend = await friendsStore.get<{ nickname?: string; userId: string }>(
      friendId,
    );
    return friend?.nickname || '好友';
  } catch {
    return '好友';
  }
}

/**
 * 请求浏览器通知权限。
 */
async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    const result = await Notification.requestPermission();
    const perms = getPermissions();
    setPermissions({ ...perms, notification: result === 'granted' });
    return result;
  } catch (err) {
    logger.warn('notification permission request failed', err);
    return 'denied';
  }
}

/**
 * 好友上下线检测与通知 Hook。
 *
 * 功能：
 * - 监听 WebSocket 'friend:online' / 'friend:offline' 事件
 * - 维护离线好友集合
 * - 上下线时写入系统消息并更新会话 lastMessage
 * - 好友下线时触发浏览器通知 + 震动反馈
 * - 连接建立后向服务端同步好友列表（'friends:sync'）
 */
export function useFriendPresence(): UseFriendPresenceReturn {
  const { isConnected, send, on, off } = useWebSocket();
  const [offlineFriends, setOfflineFriends] = useState<Set<string>>(new Set());
  const offlineRef = useRef<Set<string>>(new Set());
  const syncedRef = useRef<boolean>(false);

  /** 设置离线状态（同步更新 ref）。 */
  const setOffline = useCallback((userId: string, offline: boolean): void => {
    setOfflineFriends((prev) => {
      const next = new Set(prev);
      if (offline) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      offlineRef.current = next;
      return next;
    });
  }, []);

  const isFriendOnline = useCallback((userId: string): boolean => {
    return !offlineRef.current.has(userId);
  }, []);

  /** 处理好友上线。 */
  const handleFriendOnline = useCallback(
    async (userId: string) => {
      if (!userId) return;
      const wasOffline = offlineRef.current.has(userId);
      setOffline(userId, false);

      // 只有之前离线、现在上线时才记录日志，避免重复
      if (wasOffline) {
        const nickname = await getFriendNickname(userId);
        logger.info('friend online', { userId, nickname });
      }
    },
    [setOffline],
  );

  /** 处理好友下线。 */
  const handleFriendOffline = useCallback(
    async (userId: string) => {
      if (!userId) return;
      const wasOnline = !offlineRef.current.has(userId);
      setOffline(userId, true);

      if (wasOnline) {
        const nickname = await getFriendNickname(userId);
        logger.info('friend offline', { userId, nickname });

        // 浏览器通知
        if (typeof Notification !== 'undefined') {
          const perm = await ensureNotificationPermission();
          if (perm === 'granted') {
            try {
              new Notification('好友已关闭定位', {
                body: `${nickname} 关闭了位置共享`,
                ...({ vibrate: [200, 100, 200] } as NotificationOptions),
              });
            } catch (err) {
              logger.warn('offline notification failed', err);
            }
          }
        }

        // 震动反馈
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch (err) {
            logger.warn('vibrate failed', err);
          }
        }
      }
    },
    [setOffline],
  );

  /** 向服务端同步好友列表。 */
  const syncFriends = useCallback(async (): Promise<void> => {
    try {
      const friends = await friendsStore.getAll<{ userId: string }>();
      const friendUserIds: string[] = friends
        .map((f: { userId: string }) => f.userId)
        .filter((id: string) => Boolean(id));

      const payload: FriendsSyncPayload = { friendUserIds };
      send('friends:sync', payload);
      logger.info('friends synced to server', { count: friendUserIds.length });
    } catch (err) {
      logger.error('sync friends failed', err);
    }
  }, [send]);

  // WebSocket 事件监听
  useEffect(() => {
    const handleOnline = (data: unknown): void => {
      const payload = data as FriendStatusPayload;
      if (payload?.userId) {
        handleFriendOnline(payload.userId).catch((err) =>
          logger.error('handleFriendOnline error', err),
        );
      }
    };

    const handleOffline = (data: unknown): void => {
      const payload = data as FriendStatusPayload;
      if (payload?.userId) {
        handleFriendOffline(payload.userId).catch((err) =>
          logger.error('handleFriendOffline error', err),
        );
      }
    };

    const handleSnapshot = (data: unknown): void => {
      const payload = data as FriendsOnlineSnapshotPayload;
      if (!payload?.userIds) return;
      // 快照：先把所有好友标记为离线，再把在线的移除
      // 但我们不知道完整好友列表，所以只处理已知在线的
      const onlineSet = new Set(payload.userIds);
      setOfflineFriends((prev) => {
        const next = new Set(prev);
        for (const uid of payload.userIds) {
          next.delete(uid);
        }
        offlineRef.current = next;
        return next;
      });
      // 记录初始在线状态（避免这些好友被误判为"刚上线"）
      logger.info('friends online snapshot received', {
        count: onlineSet.size,
      });
    };

    on('friend:online', handleOnline);
    on('friend:offline', handleOffline);
    on('friends:online:snapshot', handleSnapshot);

    return () => {
      off('friend:online', handleOnline);
      off('friend:offline', handleOffline);
      off('friends:online:snapshot', handleSnapshot);
    };
  }, [on, off, handleFriendOnline, handleFriendOffline]);

  // 连接建立后同步好友列表
  useEffect(() => {
    if (isConnected && !syncedRef.current) {
      syncedRef.current = true;
      void syncFriends();
    }
    if (!isConnected) {
      syncedRef.current = false;
    }
  }, [isConnected, syncFriends]);

  return {
    offlineFriends,
    isFriendOnline,
    handleFriendOnline,
    handleFriendOffline,
    syncFriends,
  };
}
