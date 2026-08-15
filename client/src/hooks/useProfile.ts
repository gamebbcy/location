import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getProfile,
  setProfile as setStoredProfile,
  getSensitiveWords,
  type ProfileState,
  type MusicState,
} from '@client/src/lib/storage';
import { filterSensitiveWords } from '@client/src/lib/utils/sensitive';
import { APP_CONFIG } from '@client/src/config';
import { useWebSocket } from './useWebSocket';

interface UseProfileReturn {
  profile: ProfileState | null;
  statusExpireAt: number | null;
  statusRemainingText: string | null;
  loadProfile: () => void;
  updateNickname: (nickname: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  updateStatus: (status: string, durationMinutes?: number) => Promise<void>;
  updateMusicState: (musicState: MusicState | null) => Promise<void>;
}

/** 保存时统一走的敏感词过滤（内置 + 自定义词库） */
function filterOnSave(text: string): string {
  try {
    const customWords = getSensitiveWords();
    return filterSensitiveWords(text, customWords);
  } catch {
    return text;
  }
}

/** 格式化剩余时间：X小时Y分 / X分钟 / 已过期 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

function getInitialProfile(): ProfileState {
  const stored = getProfile();
  if (stored) return stored;
  return {
    nickname: APP_CONFIG.defaultNickname,
    avatar: '',
    status: '在线',
    musicState: null,
  };
}

const STATUS_EXPIRE_KEY = 'fl_status_expire_at';

export function useProfile(): UseProfileReturn {
  const [profile, setProfileState] = useState<ProfileState | null>(null);
  const [statusExpireAt, setStatusExpireAt] = useState<number | null>(null);
  const [statusRemainingText, setStatusRemainingText] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const { send } = useWebSocket();

  // 加载资料
  const loadProfile = useCallback((): void => {
    const stored = getInitialProfile();
    setProfileState(stored);
    const expireStr = localStorage.getItem(STATUS_EXPIRE_KEY);
    setStatusExpireAt(expireStr ? Number(expireStr) : null);
  }, []);

  // 初始化加载
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 持久化
  const persist = useCallback((next: ProfileState): void => {
    try {
      setStoredProfile(next);
    } catch (err) {
      logger.error('persist profile failed', err);
    }
  }, []);

  // 通过 WebSocket 通知好友状态更新
  const notifyStatusUpdate = useCallback(
    (next: ProfileState): void => {
      try {
        send('status:update', {
          status: next.status,
          musicState: next.musicState,
        });
      } catch (err) {
        logger.warn('ws status:update send failed', err);
      }
    },
    [send],
  );

  // 清除状态定时器
  const clearStatusTimer = useCallback((): void => {
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }, []);

  // 设置状态定时器
  const setupStatusTimer = useCallback(
    (expireAt: number): void => {
      clearStatusTimer();
      const delay = expireAt - Date.now();
      if (delay <= 0) {
        // 已过期，立即恢复
        setProfileState((prev) => {
          if (!prev) return prev;
          const next: ProfileState = { ...prev, status: '在线' };
          persist(next);
          return next;
        });
        setStatusExpireAt(null);
        localStorage.removeItem(STATUS_EXPIRE_KEY);
        return;
      }
      statusTimerRef.current = window.setTimeout(() => {
        setProfileState((prev) => {
          if (!prev) return prev;
          const next: ProfileState = { ...prev, status: '在线' };
          persist(next);
          notifyStatusUpdate(next);
          return next;
        });
        setStatusExpireAt(null);
        localStorage.removeItem(STATUS_EXPIRE_KEY);
        statusTimerRef.current = null;
      }, delay);
    },
    [clearStatusTimer, persist, notifyStatusUpdate],
  );

  // 初始化 / expireAt 变化时设置定时器
  useEffect(() => {
    if (statusExpireAt) {
      setupStatusTimer(statusExpireAt);
    } else {
      clearStatusTimer();
    }
    return clearStatusTimer;
  }, [statusExpireAt, setupStatusTimer, clearStatusTimer]);

  // 剩余时间倒计时（每分钟刷新文案）
  useEffect(() => {
    if (!statusExpireAt) {
      setStatusRemainingText(null);
      return;
    }

    const update = (): void => {
      const remaining = statusExpireAt - Date.now();
      if (remaining <= 0) {
        setStatusRemainingText(null);
        return;
      }
      setStatusRemainingText(`还剩 ${formatRemaining(remaining)}`);
    };

    update();
    countdownRef.current = window.setInterval(update, 60 * 1000);
    return () => {
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [statusExpireAt]);

  const updateNickname = useCallback(
    async (nickname: string): Promise<void> => {
      const filtered = filterOnSave(nickname);
      setProfileState((prev) => {
        if (!prev) return prev;
        const next: ProfileState = { ...prev, nickname: filtered };
        persist(next);
        notifyStatusUpdate(next);
        return next;
      });
    },
    [persist, notifyStatusUpdate],
  );

  const updateAvatar = useCallback(
    async (avatar: string): Promise<void> => {
      setProfileState((prev) => {
        if (!prev) return prev;
        const next: ProfileState = { ...prev, avatar };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateStatus = useCallback(
    async (status: string, durationMinutes?: number): Promise<void> => {
      const filtered = filterOnSave(status);
      setProfileState((prev) => {
        if (!prev) return prev;
        const next: ProfileState = { ...prev, status: filtered };
        persist(next);
        notifyStatusUpdate(next);
        return next;
      });

      if (durationMinutes && durationMinutes > 0) {
        const expireAt = Date.now() + durationMinutes * 60 * 1000;
        setStatusExpireAt(expireAt);
        localStorage.setItem(STATUS_EXPIRE_KEY, String(expireAt));
      } else {
        setStatusExpireAt(null);
        localStorage.removeItem(STATUS_EXPIRE_KEY);
      }
    },
    [persist, notifyStatusUpdate],
  );

  const updateMusicState = useCallback(
    async (musicState: MusicState | null): Promise<void> => {
      setProfileState((prev) => {
        if (!prev) return prev;
        const next: ProfileState = { ...prev, musicState };
        persist(next);
        notifyStatusUpdate(next);
        return next;
      });
    },
    [persist, notifyStatusUpdate],
  );

  return {
    profile,
    statusExpireAt,
    statusRemainingText,
    loadProfile,
    updateNickname,
    updateAvatar,
    updateStatus,
    updateMusicState,
  };
}
