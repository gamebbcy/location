import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useWebSocket } from './useWebSocket';
import type { PokeReceivePayload, PokeSendPayload } from '@shared/api.interface';

const POKE_COOLDOWN_MS = 30_000; // 30s cooldown per friend
const POKE_NOTIFICATION_DEDUP_MS = 2_000; // 2s dedup per sender
const POKE_NOTIFICATION_DURATION_MS = 3_000; // 3s auto-dismiss
const SHAKE_DURATION_MS = 500; // 0.5s shake animation

export interface PokeNotification {
  fromUserId: string;
  fromNickname: string;
  fromAvatar?: string;
  messageId: string;
  timestamp: number;
}

export interface UsePokeReturn {
  /** Active poke notification (only one at a time) */
  activeNotification: PokeNotification | null;
  /** User IDs currently in shake animation state */
  shakingUserIds: Set<string>;
  /** Send a poke to a friend; returns false if in cooldown */
  sendPoke: (toUserId: string) => boolean;
  /** Check if a friend is on cooldown */
  isCooldown: (toUserId: string) => boolean;
  /** Get remaining cooldown ms for a friend */
  getCooldownRemaining: (toUserId: string) => number;
  /** Programmatically trigger shake for a user id */
  triggerShake: (userId: string) => void;
  /** Dismiss the active notification */
  dismissNotification: () => void;
  /** Update friend info for notification display */
  updateFriendInfo: (userId: string, info: { nickname: string; avatar?: string }) => void;
  /** Replace entire friend info map */
  setFriendInfoMap: (map: Map<string, { nickname: string; avatar?: string }>) => void;
}

function generateMessageId(): string {
  return `poke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function usePoke(): UsePokeReturn {
  const { send, on, off, isConnected } = useWebSocket();
  const [activeNotification, setActiveNotification] = useState<PokeNotification | null>(null);
  const [shakingUserIds, setShakingUserIds] = useState<Set<string>>(new Set());

  const cooldownRef = useRef<Map<string, number>>(new Map());
  const lastReceiveRef = useRef<Map<string, number>>(new Map());
  const queueRef = useRef<PokeNotification[]>([]);
  const activeRef = useRef<PokeNotification | null>(null);
  const notificationTimerRef = useRef<number | null>(null);
  const shakeTimersRef = useRef<Map<string, number>>(new Map());
  const friendInfoRef = useRef<Map<string, { nickname: string; avatar?: string }>>(new Map());

  // Keep activeRef in sync with state (for use in callbacks)
  useEffect(() => {
    activeRef.current = activeNotification;
  }, [activeNotification]);

  const triggerShake = useCallback((userId: string) => {
    setShakingUserIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    const existing = shakeTimersRef.current.get(userId);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(() => {
      setShakingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      shakeTimersRef.current.delete(userId);
    }, SHAKE_DURATION_MS);

    shakeTimersRef.current.set(userId, timer);
  }, []);

  const showNextFromQueue = useCallback(() => {
    if (notificationTimerRef.current) {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }

    const next = queueRef.current.shift();
    if (!next) {
      setActiveNotification(null);
      return;
    }

    setActiveNotification(next);
    triggerShake(next.fromUserId);

    notificationTimerRef.current = window.setTimeout(() => {
      showNextFromQueue();
    }, POKE_NOTIFICATION_DURATION_MS);
  }, [triggerShake]);

  const dismissNotification = useCallback(() => {
    showNextFromQueue();
  }, [showNextFromQueue]);

  const showNotification = useCallback(
    (notification: PokeNotification) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }

      if (activeRef.current) {
        queueRef.current.push(notification);
        return;
      }

      setActiveNotification(notification);
      triggerShake(notification.fromUserId);

      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }
      notificationTimerRef.current = window.setTimeout(() => {
        showNextFromQueue();
      }, POKE_NOTIFICATION_DURATION_MS);
    },
    [triggerShake, showNextFromQueue],
  );

  const handlePokeReceive = useCallback(
    (data: unknown) => {
      const payload = data as PokeReceivePayload;
      if (!payload || !payload.fromUserId) {
        logger.warn('poke:receive missing fromUserId', data);
        return;
      }

      const now = Date.now();
      const lastTs = lastReceiveRef.current.get(payload.fromUserId) ?? 0;

      if (now - lastTs < POKE_NOTIFICATION_DEDUP_MS) {
        logger.warn('poke:receive deduped', { fromUserId: payload.fromUserId });
        return;
      }

      lastReceiveRef.current.set(payload.fromUserId, now);

      const friendInfo = friendInfoRef.current.get(payload.fromUserId);

      showNotification({
        fromUserId: payload.fromUserId,
        fromNickname: friendInfo?.nickname || '好友',
        fromAvatar: friendInfo?.avatar,
        messageId: payload.messageId,
        timestamp: payload.timestamp,
      });
    },
    [showNotification],
  );

  const updateFriendInfo = useCallback((userId: string, info: { nickname: string; avatar?: string }) => {
    friendInfoRef.current.set(userId, info);
  }, []);

  const setFriendInfoMap = useCallback((map: Map<string, { nickname: string; avatar?: string }>) => {
    friendInfoRef.current = map;
  }, []);

  const sendPoke = useCallback(
    (toUserId: string): boolean => {
      const now = Date.now();
      const cooldownEnd = cooldownRef.current.get(toUserId) ?? 0;

      if (now < cooldownEnd) {
        logger.warn('poke:send on cooldown', { toUserId, remaining: cooldownEnd - now });
        return false;
      }

      if (!isConnected) {
        logger.warn('poke:send skipped (not connected)');
        return false;
      }

      const payload: PokeSendPayload = {
        toUserId,
        messageId: generateMessageId(),
        timestamp: now,
      };

      send('poke:send', payload);
      cooldownRef.current.set(toUserId, now + POKE_COOLDOWN_MS);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }

      triggerShake(toUserId);

      return true;
    },
    [send, isConnected, triggerShake],
  );

  const isCooldown = useCallback((toUserId: string): boolean => {
    const now = Date.now();
    const cooldownEnd = cooldownRef.current.get(toUserId) ?? 0;
    return now < cooldownEnd;
  }, []);

  const getCooldownRemaining = useCallback((toUserId: string): number => {
    const now = Date.now();
    const cooldownEnd = cooldownRef.current.get(toUserId) ?? 0;
    return Math.max(0, cooldownEnd - now);
  }, []);

  useEffect(() => {
    on('poke:receive', handlePokeReceive);
    return () => {
      off('poke:receive', handlePokeReceive);
    };
  }, [on, off, handlePokeReceive]);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }
      shakeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      shakeTimersRef.current.clear();
    };
  }, []);

  return {
    activeNotification,
    shakingUserIds,
    sendPoke,
    isCooldown,
    getCooldownRemaining,
    triggerShake,
    dismissNotification,
    updateFriendInfo,
    setFriendInfoMap,
  };
}
