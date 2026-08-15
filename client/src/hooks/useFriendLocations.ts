import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useWebSocket } from './useWebSocket';
import type { FriendLocationUpdate, AlertReceivePayload } from '@shared/api.interface';
import { friendsStore } from '@client/src/lib/storage';

export interface AlertNotification {
  fromUserId: string;
  fromNickname: string;
  fromAvatar?: string;
  messageId: string;
  timestamp: number;
  title: string;
  content: string;
}

export interface UseFriendLocationsReturn {
  friendLocations: Map<string, FriendLocationUpdate>;
  onlineFriends: string[];
  isOnline: (userId: string) => boolean;
  requestFriendLocation: (userId: string) => void;
  requestAllFriendsLocations: () => Promise<void>;
  alertNotification: AlertNotification | null;
  dismissAlertNotification: () => void;
}

const ONLINE_TIMEOUT_MS = 30_000; // 30s without update → considered offline

export function useFriendLocations(): UseFriendLocationsReturn {
  const { isConnected, send, on, off, connect } = useWebSocket();
  const [friendLocations, setFriendLocations] = useState<
    Map<string, FriendLocationUpdate>
  >(new Map());
  const [onlineFriends, setOnlineFriends] = useState<string[]>([]);
  const [alertNotification, setAlertNotification] = useState<AlertNotification | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const onlineRef = useRef<Set<string>>(new Set());
  const requestedRef = useRef<Set<string>>(new Set());
  const alertDedupRef = useRef<Map<string, number>>(new Map());

  // Update online status helper
  const updateOnline = useCallback((userId: string, online: boolean) => {
    setOnlineFriends((prev) => {
      const set = new Set(prev);
      if (online) {
        set.add(userId);
      } else {
        set.delete(userId);
      }
      onlineRef.current = set;
      return Array.from(set);
    });
  }, []);

  // Handle friend location update
  const handleLocationUpdate = useCallback(
    (data: unknown) => {
      const update = data as FriendLocationUpdate;
      if (!update || !update.userId) {
        logger.warn('friend:location:update missing userId', data);
        return;
      }

      setFriendLocations((prev) => {
        const next = new Map(prev);
        next.set(update.userId, {
          ...update,
          lastUpdate: update.lastUpdate || Date.now(),
        });
        return next;
      });

      updateOnline(update.userId, true);
    },
    [updateOnline],
  );

  // Handle friend online
  const handleFriendOnline = useCallback(
    (data: unknown) => {
      const payload = data as { userId: string };
      if (payload?.userId) {
        updateOnline(payload.userId, true);
        // Request location for newly online friend
        if (!requestedRef.current.has(payload.userId)) {
          send('friend:location:request', { userId: payload.userId });
        }
      }
    },
    [send, updateOnline],
  );

  // Handle friend offline
  const handleFriendOffline = useCallback(
    (data: unknown) => {
      const payload = data as { userId: string };
      if (payload?.userId) {
        updateOnline(payload.userId, false);
      }
    },
    [updateOnline],
  );

  // Handle alert received from a friend
  const handleAlertReceive = useCallback(
    async (data: unknown) => {
      const payload = data as AlertReceivePayload;
      if (!payload || !payload.fromUserId) {
        logger.warn('alert:receive missing fromUserId', data);
        return;
      }

      const now = Date.now();
      const lastTs = alertDedupRef.current.get(payload.fromUserId) ?? 0;
      // 2s dedup per sender
      if (now - lastTs < 2000) {
        logger.warn('alert:receive deduped', { fromUserId: payload.fromUserId });
        return;
      }
      alertDedupRef.current.set(payload.fromUserId, now);

      // Use nickname from payload; fallback to friend store if missing
      let nickname: string = payload.fromNickname || '好友';
      let avatar: string | undefined;
      try {
        const friend = await friendsStore.get<{ nickname?: string; avatar?: string }>(payload.fromUserId);
        if (friend) {
          if (friend.nickname) nickname = friend.nickname;
          avatar = friend.avatar;
        }
      } catch (err) {
        logger.warn('resolve alert friend info failed', err);
      }

      setAlertNotification({
        fromUserId: payload.fromUserId,
        fromNickname: nickname,
        fromAvatar: avatar,
        messageId: payload.messageId,
        timestamp: payload.timestamp,
        title: payload.title || '提醒',
        content: payload.content || '',
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
      }

      // 5秒自动消失
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
      alertTimerRef.current = window.setTimeout(() => {
        setAlertNotification(null);
        alertTimerRef.current = null;
      }, 5000);
    },
    [],
  );

  const dismissAlertNotification = useCallback((): void => {
    setAlertNotification(null);
  }, []);

  const isOnline = useCallback(
    (userId: string): boolean => {
      return onlineRef.current.has(userId);
    },
    [],
  );

  const requestFriendLocation = useCallback(
    (userId: string) => {
      send('friend:location:request', { userId });
      requestedRef.current.add(userId);
    },
    [send],
  );

  const requestAllFriendsLocations = useCallback(async () => {
    try {
      const friends = await friendsStore.getAll<{ userId: string }>();
      for (const friend of friends) {
        if (friend.userId) {
          requestFriendLocation(friend.userId);
        }
      }
    } catch (err) {
      logger.error('requestAllFriendsLocations failed', err);
    }
  }, [requestFriendLocation]);

  // Register WebSocket listeners
  useEffect(() => {
    on('friend:location:update', handleLocationUpdate);
    on('friend:online', handleFriendOnline);
    on('friend:offline', handleFriendOffline);
    on('alert:receive', handleAlertReceive);

    return () => {
      off('friend:location:update', handleLocationUpdate);
      off('friend:online', handleFriendOnline);
      off('friend:offline', handleFriendOffline);
      off('alert:receive', handleAlertReceive);
    };
  }, [on, off, handleLocationUpdate, handleFriendOnline, handleFriendOffline, handleAlertReceive]);

  // On connect, request all friends' locations
  useEffect(() => {
    if (isConnected) {
      // Connect to ensure socket is alive
      connect();
      void requestAllFriendsLocations();
    }
  }, [isConnected, connect, requestAllFriendsLocations]);

  // Periodically check for stale (offline) friends
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const stale: string[] = [];
      friendLocations.forEach((loc, userId) => {
        if (now - loc.lastUpdate > ONLINE_TIMEOUT_MS) {
          stale.push(userId);
        }
      });
      if (stale.length > 0) {
        setOnlineFriends((prev) => {
          const set = new Set(prev);
          for (const id of stale) {
            set.delete(id);
          }
          onlineRef.current = set;
          return Array.from(set);
        });
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [friendLocations]);

  return {
    friendLocations,
    onlineFriends,
    isOnline,
    requestFriendLocation,
    requestAllFriendsLocations,
    alertNotification,
    dismissAlertNotification,
  };
}
